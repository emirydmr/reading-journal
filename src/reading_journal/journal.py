#!/usr/bin/env python3
"""Read Zotero's local API and generate a self-contained reading journal."""

from __future__ import annotations

import argparse
import base64
import copy
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
WEB = HERE / "web"
API = "http://127.0.0.1:23119/api/users/0"
PAGE_SIZE = 100
ZOTERO_ANNOTATION_COLORS = ("#ffd400", "#ff6666", "#5fb236", "#2ea8e5", "#a28ae5", "#e56eee", "#f19837", "#aaaaaa")
ADDITIONAL_ANNOTATION_MEANINGS = {
    "#e56eee": {"label": "Research gaps", "description": "Open problems, missing comparisons or evidence, and opportunities for new research."},
    "#aaaaaa": {"label": "Needs verification", "description": "Claims, citations, or details to check against other sources before relying on them."},
}
DEFAULT_STATUS_ROLES = {
    "to_read": {"tag": "status/to-read", "label": "To read", "color": "#87958d", "background": "#f3f5f2"},
    "reading": {"tag": "status/reading", "label": "Reading", "color": "#4c87bd", "background": "#edf5fb"},
    "read": {"tag": "status/read", "label": "Read", "color": "#4c9a68", "background": "#edf8f0"},
    "revisit": {"tag": "status/revisit", "label": "Revisit", "color": "#dd9950", "background": "#fff5eb"},
}
PRIMARY_STATUSES = {DEFAULT_STATUS_ROLES[role]["tag"]: DEFAULT_STATUS_ROLES[role]["label"] for role in ("to_read", "reading", "read")}
SUPPLEMENTARY_STATUS = DEFAULT_STATUS_ROLES["revisit"]["tag"]
GROUPERS = ("status", "paper", "category", "collection", "day", "week", "month")
ANNOTATION_CREATION_GRACE = timedelta(minutes=20)


def annotation_event(annotation: dict, tz: ZoneInfo, first: date, last: date) -> tuple[str, str] | None:
    """Treat the first 20 minutes of edits as part of creating an annotation."""
    added_at = annotation.get("dateAdded") or ""
    modified_at = annotation.get("dateModified") or ""
    if added_at and modified_at:
        elapsed = datetime.fromisoformat(modified_at.replace("Z", "+00:00")) - datetime.fromisoformat(added_at.replace("Z", "+00:00"))
        if timedelta(0) <= elapsed <= ANNOTATION_CREATION_GRACE:
            return ("Annotation created", added_at) if is_in_window(added_at, tz, first, last) else None
    if modified_at > added_at and is_in_window(modified_at, tz, first, last):
        return "Annotation updated", modified_at
    if is_in_window(added_at, tz, first, last):
        return "Annotation created", added_at
    return None


def user_config_path() -> Path:
    return Path.home() / "Library" / "Application Support" / "Reading Journal" / "config.json"


def config_path() -> Path:
    return user_config_path() if user_config_path().exists() else HERE / "config.json"


def load_config(path: Path | None = None) -> dict:
    raw = json.loads((path or config_path()).read_text(encoding="utf-8"))
    if raw.get("annotation_color_schema_version", 1) < 2:
        raw.setdefault("annotation_colors", {})
        for color, meaning in ADDITIONAL_ANNOTATION_MEANINGS.items():
            raw["annotation_colors"].setdefault(color, meaning)
        raw["annotation_color_schema_version"] = 2
    return validate_config(raw)


def annotation_color_sort_key(color: str) -> tuple[int, str]:
    color = color.lower()
    return (ZOTERO_ANNOTATION_COLORS.index(color) if color in ZOTERO_ANNOTATION_COLORS else len(ZOTERO_ANNOTATION_COLORS), color)


def editable_tag_config(raw: dict) -> dict:
    """Migrate legacy mappings for the unified editor without changing saved settings."""
    config = copy.deepcopy(raw)
    if config.get("tag_schema_version") == 2:
        return config
    config["tag_schema_version"] = 2
    categories = config.setdefault("tag_categories", {})
    for index, rule in enumerate(categories.values()):
        rule.setdefault("color", ["#7b8db6", "#bd8d52", "#a17aa9", "#b86868"][index % 4])
        rule.setdefault("description", "")
        rule["selection_mode"] = "explicit" if rule.get("allowed_tags") else "prefix"
        rule["tags"] = {tag: {"label": tag.rsplit("/", 1)[-1], "color": rule["color"], "description": ""}
                        for tag in rule.get("allowed_tags", [])}
    roles = config.get("status_roles", DEFAULT_STATUS_ROLES)
    categories["Status"] = {"prefix": "status/", "color": "#4c87bd", "description": "Reading progress",
                            "selection_mode": "explicit", "allowed_tags": [value["tag"] for value in roles.values()],
                            "tags": {value["tag"]: {"label": value["label"], "color": value["color"],
                                      "description": "", "reading_role": role}
                                     for role, value in roles.items() if value["tag"]}}
    return config


def validate_config(raw: dict) -> dict:
    if not isinstance(raw, dict):
        raise ValueError("Configuration must be a JSON object")
    config = copy.deepcopy(raw)
    if not isinstance(config.get("tag_categories", {}), dict):
        raise ValueError("Tag categories must be an object")
    unified = config.get("tag_schema_version") == 2
    if not unified:
        config.setdefault("tag_categories", {}).pop("Status", None)
    else:
        roles = {role: {**value, "tag": ""} for role, value in DEFAULT_STATUS_ROLES.items()}
        assigned = set()
        defined_tags = set()
        for category, rule in config.get("tag_categories", {}).items():
            if not isinstance(rule, dict) or not re.fullmatch(r"#[0-9a-fA-F]{6}", str(rule.get("color", ""))):
                raise ValueError(f"Tag category {category!r} needs a hex color")
            if rule.get("selection_mode") not in ("prefix", "explicit") or not isinstance(rule.get("tags", {}), dict):
                raise ValueError(f"Invalid tag selection for {category!r}")
            for tag, definition in rule.get("tags", {}).items():
                if not isinstance(tag, str) or not tag.strip() or tag in defined_tags:
                    raise ValueError("Tag names must be nonempty and unique")
                defined_tags.add(tag)
                if not tag.startswith(rule.get("prefix", "")):
                    raise ValueError(f"Tag {tag!r} must start with its category prefix")
                if not isinstance(definition, dict) or not isinstance(definition.get("label"), str) or not definition["label"].strip():
                    raise ValueError(f"Tag {tag!r} needs a label")
                if not re.fullmatch(r"#[0-9a-fA-F]{6}", str(definition.get("color", ""))):
                    raise ValueError(f"Tag {tag!r} needs a hex color")
                role = definition.get("reading_role", "")
                if role:
                    if role not in roles or role in assigned:
                        raise ValueError("Assign each reading meaning to at most one tag")
                    assigned.add(role)
                    if rule["selection_mode"] == "prefix" or tag in rule.get("allowed_tags", []):
                        roles[role] = {"tag": tag, "label": definition["label"], "color": definition["color"], "background": definition["color"] + "18"}
        config["status_roles"] = roles
    roles = config.setdefault("status_roles", copy.deepcopy(DEFAULT_STATUS_ROLES))
    if not isinstance(roles, dict) or set(roles) != set(DEFAULT_STATUS_ROLES):
        raise ValueError("Status roles must be to_read, reading, read, and revisit")
    tags = []
    for role in DEFAULT_STATUS_ROLES:
        value = roles[role]
        if not isinstance(value, dict):
            raise ValueError(f"Status role {role} must be an object")
        for field in ("tag", "label"):
            if not isinstance(value.get(field), str) or (not value[field].strip() and not (unified and field == "tag")):
                raise ValueError(f"Status role {role} needs a nonempty {field}")
            value[field] = value[field].strip()
        for field in ("color", "background"):
            if not re.fullmatch(r"#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?" if unified and field == "background" else r"#[0-9a-fA-F]{6}", str(value.get(field, ""))):
                raise ValueError(f"Status role {role} needs a hex {field}")
        if value["tag"]:
            tags.append(value["tag"])
    if len(set(tags)) != len(tags):
        raise ValueError("Status role tags must be distinct")
    if len({roles[role]["label"].casefold() for role in roles}) != len(roles):
        raise ValueError("Status role labels must be distinct")
    if any(roles[role]["label"].casefold() in {"unassigned", "conflicting statuses"} for role in roles):
        raise ValueError("Status role labels cannot be Unassigned or Conflicting statuses")
    groupers = config.setdefault("default_groupers", ["status", "paper", "category"])
    if not isinstance(groupers, list) or any(not isinstance(group, str) for group in groupers) or len(groupers) != len(set(groupers)) or any(group not in GROUPERS for group in groupers):
        raise ValueError("Default groupers must be unique known dimensions")
    for field in ("included_collections", "paper_types"):
        if not isinstance(config.get(field, []), list) or any(not isinstance(item, str) for item in config.get(field, [])):
            raise ValueError(f"{field} must be a list of names")
    for label, rule in config.get("tag_categories", {}).items():
        if not isinstance(label, str) or not label.strip():
            raise ValueError("Tag category names must be nonempty")
        if not isinstance(rule, dict) or not isinstance(rule.get("prefix"), str) or (not rule["prefix"] and not (unified and rule.get("selection_mode") == "explicit")):
            raise ValueError(f"Tag category {label!r} needs a prefix")
        if not isinstance(rule.get("allowed_tags", []), list) or any(not isinstance(tag, str) for tag in rule.get("allowed_tags", [])):
            raise ValueError(f"Tag category {label!r} needs a list of allowed tags")
    annotation_color_legend(config)
    ZoneInfo(config.get("timezone", "Asia/Shanghai"))
    if int(config.get("default_window_days", 30)) < 1:
        raise ValueError("Default window must be at least one day")
    if not isinstance(config.get("include_abstracts", False), bool):
        raise ValueError("Include abstracts must be on or off")
    return config


def external_paper_link(paper: dict) -> str:
    doi_link, url_link = paper_links(paper)
    return doi_link or url_link


def paper_links(paper: dict) -> tuple[str, str]:
    doi = (paper.get("DOI") or "").strip()
    doi = re.sub(r"^(?:doi:|https?://(?:dx\.)?doi\.org/)", "", doi, flags=re.I).strip()
    doi_link = "https://doi.org/" + urllib.parse.quote(doi, safe="/.-_()") if re.fullmatch(r"10\.\d{4,9}/\S+", doi, flags=re.I) else ""
    url = (paper.get("url") or "").strip()
    parsed = urllib.parse.urlparse(url)
    return doi_link, url if parsed.scheme in ("http", "https") and parsed.netloc else ""


def zotero_paper_link(key: str) -> str:
    return f"zotero://select/library/items/{key}"


def zotero_annotation_link(attachment_key: str, annotation_key: str, position: str = "") -> str:
    query = {"annotation": annotation_key}
    try:
        page_index = json.loads(position).get("pageIndex")
        if isinstance(page_index, int) and page_index >= 0:
            query = {"page": str(page_index + 1), **query}
    except (ValueError, TypeError, AttributeError):
        pass
    return f"zotero://open-pdf/library/items/{attachment_key}?{urllib.parse.urlencode(query)}"


def get_all(route: str) -> list[dict]:
    result: list[dict] = []
    start = 0
    while True:
        query = urllib.parse.urlencode({"format": "json", "limit": PAGE_SIZE, "start": start})
        request = urllib.request.Request(
            f"{API}{route}?{query}", headers={"Zotero-API-Version": "3"}
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            page = json.load(response)
        if not isinstance(page, list):
            raise ValueError(f"Unexpected Zotero response for {route}")
        result.extend(page)
        if len(page) < PAGE_SIZE:
            return result
        start += len(page)


def local_date(value: str | None, tz: ZoneInfo) -> date | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(tz).date()
    except ValueError:
        return None


def local_periods(value: str | None, tz: ZoneInfo) -> dict[str, str]:
    """Calendar groups for an annotation event in the report's timezone.

    Weeks use ISO 8601: Monday to Sunday, with the ISO week-year at year edges.
    """
    if not value:
        return {"day": "", "week": "", "month": ""}
    try:
        observed = datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(tz)
    except ValueError:
        return {"day": "", "week": "", "month": ""}
    week_year, week_number, _ = observed.isocalendar()
    return {
        "day": observed.date().isoformat(),
        "week": f"{week_year:04d}-W{week_number:02d}",
        "month": f"{observed.year:04d}-{observed.month:02d}",
    }


def month_label(value: date) -> str:
    return f"{value.year:04d}-{value.month:02d}"


def month_range(first: str, last: str) -> list[str]:
    year, month = map(int, first.split("-"))
    end_year, end_month = map(int, last.split("-"))
    result = []
    while (year, month) <= (end_year, end_month):
        result.append(f"{year:04d}-{month:02d}")
        month += 1
        if month == 13:
            year, month = year + 1, 1
    return result


def collection_paths(collections: list[dict]) -> dict[str, str]:
    by_key = {entry["key"]: entry["data"] for entry in collections}
    paths: dict[str, str] = {}

    def resolve(key: str, seen: frozenset[str] = frozenset()) -> str:
        if key in paths:
            return paths[key]
        item = by_key.get(key)
        if not item:
            return key
        if key in seen:
            return item.get("name", key)
        parent = item.get("parentCollection")
        name = item.get("name", key)
        paths[key] = f"{resolve(parent, seen | {key})} / {name}" if parent else name
        return paths[key]

    for key in by_key:
        resolve(key)
    return paths


def selected_collection_keys(config: dict, collections: list[dict]) -> set[str] | None:
    roots = set(config.get("included_collections", []))
    if not roots:
        return None
    known = {entry["key"] for entry in collections}
    missing = roots - known
    if missing:
        raise ValueError(f"Unknown collection key(s): {', '.join(sorted(missing))}")
    if not config.get("include_descendants", True):
        return roots
    selected = set(roots)
    while True:
        children = {
            entry["key"]
            for entry in collections
            if entry["data"].get("parentCollection") in selected
        }
        if children <= selected:
            return selected
        selected.update(children)


def categorized_tags(tags: list[dict], categories: dict) -> dict[str, list[str]]:
    names = {tag.get("tag", "") for tag in tags}
    result: dict[str, list[str]] = {}
    for label, rule in categories.items():
        prefix = rule.get("prefix", "")
        allowed = set(rule.get("allowed_tags", []))
        if not prefix and rule.get("selection_mode") != "explicit":
            raise ValueError(f"Tag category {label!r} needs a non-empty prefix")
        matches = sorted(
            name for name in names
            if name.startswith(prefix) and (rule.get("selection_mode") == "prefix" or
                (name in allowed if rule.get("selection_mode") == "explicit" else not allowed or name in allowed))
        )
        if matches:
            result[label] = matches
    return result


def reading_status(tags: list[dict], item_key: str, config: dict | None = None) -> tuple[dict, list[str]]:
    roles = (config or {}).get("status_roles", DEFAULT_STATUS_ROLES)
    names = {tag.get("tag", "") for tag in tags}
    present = [role for role in ("to_read", "reading", "read") if roles[role]["tag"] in names]
    recognized = {value["tag"] for value in roles.values()}
    diagnostics = []
    for tag in sorted(name for name in names if name.startswith("status/") and name not in recognized and (config or {}).get("tag_schema_version") != 2):
        hint = " (use status/to-read)" if tag == "status/to_read" and roles["to_read"]["tag"] == "status/to-read" else ""
        diagnostics.append(f"{item_key}: noncanonical status tag {tag}{hint}")
    if len(present) > 1:
        diagnostics.append(f"{item_key}: conflicting primary statuses: {', '.join(roles[role]['tag'] for role in present)}")
    label = roles[present[0]]["label"] if len(present) == 1 else "Conflicting statuses" if present else "Unassigned"
    return {"label": label, "revisit": roles["revisit"]["tag"] in names}, diagnostics


def status_group(status: dict, config: dict) -> str:
    if status["label"] == "Conflicting statuses":
        return "Conflicting statuses"
    if status["revisit"]:
        return config["status_roles"]["revisit"]["label"]
    return status["label"]


def annotation_color_legend(config: dict) -> tuple[dict[str, dict], list[dict]]:
    colors: dict[str, dict] = {}
    for raw_hex, value in config.get("annotation_colors", {}).items():
        hex_color = raw_hex.lower()
        if not re.fullmatch(r"#[0-9a-f]{6}", hex_color):
            raise ValueError(f"Invalid annotation color: {raw_hex}")
        meaning = {"label": value, "description": ""} if isinstance(value, str) else value
        if not isinstance(meaning, dict) or not isinstance(meaning.get("label"), str):
            raise ValueError(f"Annotation color {raw_hex} needs a label")
        colors[hex_color] = {
            "color": hex_color,
            "label": meaning["label"],
            "description": meaning.get("description", ""),
        }
    return colors, sorted(colors.values(), key=lambda item: annotation_color_sort_key(item["color"]))


def is_in_window(value: str | None, tz: ZoneInfo, first: date, last: date) -> bool:
    observed = local_date(value, tz)
    return observed is not None and first <= observed <= last


def build_report(config: dict, first: date, last: date, *, items: list[dict] | None = None, collections: list[dict] | None = None) -> tuple[dict, list[str]]:
    config = validate_config(config)
    tz = ZoneInfo(config.get("timezone", "Asia/Shanghai"))
    items = get_all("/items") if items is None else items
    collections = get_all("/collections") if collections is None else collections
    paths = collection_paths(collections)
    active_collection_keys = set(paths)
    selected = selected_collection_keys(config, collections)
    by_key = {entry["key"]: entry["data"] for entry in items}
    paper_types = set(config.get("paper_types", []))
    include_unfiled = config.get("include_unfiled", True)
    annotations_by_paper: dict[str, list[dict]] = defaultdict(list)

    for entry in items:
        annotation = entry["data"]
        if annotation.get("itemType") != "annotation":
            continue
        attachment = by_key.get(annotation.get("parentItem"), {})
        paper_key = attachment.get("parentItem")
        if paper_key:
            annotations_by_paper[paper_key].append(annotation)

    scoped = []
    for entry in items:
        paper = entry["data"]
        if paper.get("itemType") not in paper_types or paper.get("parentItem"):
            continue
        memberships = set(paper.get("collections") or []) & active_collection_keys
        if selected is not None:
            if not (memberships & selected) and not (include_unfiled and not memberships):
                continue
        elif not memberships and not include_unfiled:
            continue
        scoped.append(paper)

    # Aggregate the current scope without embedding inactive papers' titles in an export.
    # Collection membership is a current snapshot, not reconstructed history.
    size_counts = Counter()
    # A pie needs mutually exclusive slices. Multiple membership is explicit, never guessed.
    pie = Counter()
    multi_membership = 0
    for paper in scoped:
        memberships = [key for key in paper.get("collections") or [] if key in active_collection_keys and (selected is None or key in selected)]
        if len(memberships) > 1:
            multi_membership += 1
        if len(memberships) > 1:
            pie["Multiple collections"] += 1
            bucket = "Multiple collections"
        elif memberships:
            pie[paths[memberships[0]]] += 1
            bucket = paths[memberships[0]]
        else:
            pie["Unfiled"] += 1
            bucket = "Unfiled"
        added_day = local_date(paper.get("dateAdded"), tz)
        size_counts[(added_day.isoformat() if added_day else "", bucket)] += 1

    added_months = Counter()
    for paper in scoped:
        stamp = local_date(paper.get("dateAdded"), tz)
        if stamp:
            added_months[month_label(stamp)] += 1
    months = month_range(min(added_months), max(added_months)) if added_months else []
    cumulative = 0
    growth = []
    for month in months:
        cumulative += added_months[month]
        growth.append({"month": month, "count": cumulative, "added": added_months[month]})

    colors, color_legend = annotation_color_legend(config)
    activity = []
    journal_entries = []
    inventory = []
    diagnostics = []
    for paper in scoped:
        newly_added = is_in_window(paper.get("dateAdded"), tz, first, last)
        recent_annotations = []
        all_annotations = annotations_by_paper.get(paper["key"], [])
        annotation_activity_at = max(
            (stamp for annotation in all_annotations
             for stamp in (annotation.get("dateAdded"), annotation.get("dateModified")) if stamp),
            default="",
        )
        for annotation in all_annotations:
            event = annotation_event(annotation, tz, first, last)
            if event is None:
                continue
            raw_color = (annotation.get("annotationColor") or "").lower()
            if raw_color not in colors and not any(item["color"] == raw_color for item in color_legend):
                color_legend.append({"color": raw_color, "label": "Unmapped", "description": "No meaning is configured for this annotation color."})
            event_type, event_at = event
            added_periods = local_periods(annotation.get("dateAdded"), tz)
            modified_periods = local_periods(annotation.get("dateModified"), tz)
            recent_annotations.append({
                "key": annotation["key"],
                "zotero_link": zotero_annotation_link(annotation.get("parentItem", ""), annotation["key"], annotation.get("annotationPosition") or ""),
                "text": annotation.get("annotationText") or "",
                "comment": annotation.get("annotationComment") or "",
                "color": raw_color,
                "meaning": colors.get(raw_color, {"label": "Unmapped"})["label"],
                "page": annotation.get("annotationPageLabel") or "?",
                "date_added": annotation.get("dateAdded") or "",
                "date_modified": annotation.get("dateModified") or "",
                "event_type": event_type,
                "event_at": event_at,
                "periods": local_periods(event_at, tz),
                "added_periods": added_periods,
                "modified_periods": modified_periods,
                "tags": [tag for group in categorized_tags(annotation.get("tags") or [], config.get("tag_categories", {})).values() for tag in group],
            })
        tags = categorized_tags(paper.get("tags") or [], config.get("tag_categories", {}))
        status, status_diagnostics = reading_status(paper.get("tags") or [], paper["key"], config)
        diagnostics.extend(status_diagnostics)
        mapped_status_tags = sorted(role["tag"] for role in config["status_roles"].values() if role["tag"] in {t.get("tag") for t in paper.get("tags") or []})
        if config.get("tag_schema_version") != 2:
            tags.pop("Status", None)
            if mapped_status_tags:
                tags["Status"] = mapped_status_tags
        membership_keys = sorted(
            (key for key in paper.get("collections") or []
             if key in active_collection_keys and (selected is None or key in selected)),
            key=lambda key: paths[key],
        )
        memberships = [paths[key] for key in membership_keys]
        creators = [" ".join(part for part in (c.get("firstName"), c.get("lastName") or c.get("name")) if part) for c in paper.get("creators") or []]
        resource_link = external_paper_link(paper)
        doi_link, url_link = paper_links(paper)
        if len(memberships) > 1:
            collection_group = " + ".join(re.match(r"\d+", path.split(" / ")[-1]).group() if re.match(r"\d+", path.split(" / ")[-1]) else path.split(" / ")[-1] for path in memberships)
        else:
            collection_group = memberships[0].split(" / ")[-1] if memberships else "Unfiled"
        group = status_group(status, config)
        inventory.append({
            "key": paper["key"],
            "title": paper.get("title") or "Untitled",
            "creators": creators,
            "date_added": paper.get("dateAdded") or "",
            "date_added_day": local_periods(paper.get("dateAdded"), tz)["day"],
            "status": status,
            "status_group": group,
            "status_tags": mapped_status_tags,
            "tags": tags,
            "collection_keys": membership_keys,
            "collections": memberships or ["Unfiled"],
            "annotation_count": len(all_annotations),
            "annotation_activity_at": annotation_activity_at,
            "new_in_period": newly_added,
            "annotated_in_period": bool(recent_annotations),
            "resource_link": resource_link,
            "doi_link": doi_link,
            "url_link": url_link,
            "abstract": (paper.get("abstractNote") or "") if config.get("include_abstracts", False) else "",
            "zotero_link": zotero_paper_link(paper["key"]),
        })
        common = {
            "paper_key": paper["key"], "paper_title": paper.get("title") or "Untitled",
            "creators": creators, "status": status, "status_group": group,
            "collections": memberships or ["Unfiled"], "collection_group": collection_group,
            "collection_keys": membership_keys, "resource_link": resource_link,
            "zotero_link": zotero_paper_link(paper["key"]),
            "paper_zotero_link": zotero_paper_link(paper["key"]),
            "paper_tags": tags,
        }
        if newly_added:
            activity.append({**common, "key": "paper:" + paper["key"], "type": "Paper added", "at": paper.get("dateAdded") or "", "day": local_periods(paper.get("dateAdded"), tz)["day"], "tags": tags})
        for annotation in recent_annotations:
            activity.append({**common, "key": "annotation:" + annotation["key"], "type": annotation["event_type"],
                             "at": annotation["event_at"], "category": annotation["meaning"], "color": annotation["color"],
                             "tags": tags, "annotation_tags": annotation["tags"]})
            journal_entries.append({**common, **annotation, "category": annotation["meaning"]})
    activity.sort(key=lambda event: (event["at"], event["key"]), reverse=True)
    journal_entries.sort(key=lambda entry: (entry["event_at"], entry["key"]), reverse=True)
    inventory.sort(key=lambda p: (p["title"].casefold(), p["key"]))
    collection_list = [
        {
            "key": entry["key"],
            "name": entry["data"].get("name") or entry["key"],
            "path": paths[entry["key"]],
            "parent_key": entry["data"].get("parentCollection") if selected is None or entry["data"].get("parentCollection") in selected else None,
        }
        for entry in collections if selected is None or entry["key"] in selected
    ]
    collection_list.sort(key=lambda c: c["path"])
    tag_styles = {}
    editable = editable_tag_config(config)
    actual_tags = [{"tag": tag} for paper in inventory for values in paper["tags"].values() for tag in values]
    actual_tags.extend({"tag": tag} for entry in journal_entries for tag in entry["tags"])
    for label, rule in sorted(editable["tag_categories"].items(), key=lambda pair: len(pair[1]["prefix"])):
        for tag in categorized_tags(actual_tags, {label: rule}).get(label, []):
            definition = rule.get("tags", {}).get(tag, {})
            tag_styles[tag] = {"label": definition.get("label") or tag.rsplit("/", 1)[-1],
                               "color": definition.get("color", rule["color"]), "category_color": rule["color"], "category": label}
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "timezone": str(tz),
        "range": {"from": first.isoformat(), "to": last.isoformat()},
        "scope": {"papers": len(scoped), "multi_membership": multi_membership},
        "growth": growth,
        "pie": [{"name": name, "count": count} for name, count in sorted(pie.items(), key=lambda pair: (-pair[1], pair[0]))],
        "size_events": [
            {"day": day, "bucket": bucket, "count": count}
            for (day, bucket), count in sorted(size_counts.items())
        ],
        "color_legend": sorted(color_legend, key=lambda item: annotation_color_sort_key(item["color"])),
        "status_roles": config["status_roles"],
        "tag_styles": tag_styles,
        "default_groupers": config["default_groupers"],
        "collections": collection_list,
        "inventory": inventory,
        "activity": activity,
        "journal": journal_entries,
    }, diagnostics


def safe_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False).replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")


def export_window_report(report: dict) -> dict:
    """Keep only papers with activity in the chosen export window."""
    limited = copy.deepcopy(report)
    for section in ("inventory", "activity", "journal"):
        for entry in limited[section]:
            entry.pop("zotero_link", None)
            entry.pop("paper_zotero_link", None)
    active_keys = {event["paper_key"] for event in limited["activity"]}
    limited["inventory"] = [paper for paper in limited["inventory"] if paper["key"] in active_keys]
    paths = {collection["key"]: collection["path"] for collection in limited["collections"]}
    pie = Counter()
    months = Counter()
    multi_membership = 0
    for paper in limited["inventory"]:
        memberships = [key for key in paper["collection_keys"] if key in paths]
        if len(memberships) > 1:
            multi_membership += 1
            pie["Multiple collections"] += 1
        elif memberships:
            pie[paths[memberships[0]]] += 1
        else:
            pie["Unfiled"] += 1
        if paper["date_added_day"]:
            months[paper["date_added_day"][:7]] += 1
    cumulative = 0
    growth = []
    for month in month_range(min(months), max(months)) if months else []:
        cumulative += months[month]
        growth.append({"month": month, "count": cumulative, "added": months[month]})
    limited["scope"] = {"papers": len(limited["inventory"]), "multi_membership": multi_membership}
    limited["growth"] = growth
    limited["pie"] = [{"name": name, "count": count} for name, count in sorted(pie.items(), key=lambda pair: (-pair[1], pair[0]))]
    return limited


def render_html(report: dict, *, app_config: dict | None = None, app_catalog: dict | None = None, app_token: str = "") -> str:
    template = (WEB / "template.html").read_text(encoding="utf-8")
    app_mode = app_config is not None
    if not app_mode:
        report = export_window_report(report)
    controls = (WEB / "app-controls.html").read_text(encoding="utf-8") if app_mode else ""
    app_js = (WEB / "app-ui.js").read_text(encoding="utf-8") if app_mode else ""
    replacements = {
        "__JOURNAL_DATA__": safe_json(report),
        "__APP_CONFIG__": safe_json(app_config),
        "__APP_CATALOG__": safe_json(app_catalog),
        "__APP_TOKEN__": safe_json(app_token),
        "__APP_CONTROLS__": controls,
        "__JOURNAL_JS__": (WEB / "report-ui.js").read_text(encoding="utf-8"),
        "__TREE_JS__": (WEB / "tree-picker.js").read_text(encoding="utf-8"),
        "__APP_JS__": app_js,
        "__ZOTERO_ICON__": "data:image/png;base64," + base64.b64encode((WEB / "zotero-icon.png").read_bytes()).decode("ascii"),
    }
    # Substitute once so a Zotero title matching a template marker stays ordinary data.
    return re.sub("|".join(map(re.escape, replacements)), lambda match: replacements[match.group()], template)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=None)
    parser.add_argument("--from", dest="first", type=date.fromisoformat)
    parser.add_argument("--to", dest="last", type=date.fromisoformat)
    parser.add_argument("--out", type=Path, default=Path.cwd() / "output" / "report.html")
    parser.add_argument("--list-collections", action="store_true", help="Show active collection paths and keys")
    parser.add_argument("--list-tags", nargs="?", const="", metavar="PREFIX", help="Show tag names, optionally limited by prefix")
    args = parser.parse_args()
    try:
        if args.list_collections:
            for key, path in sorted(collection_paths(get_all("/collections")).items(), key=lambda pair: pair[1]):
                print(f"{key}  {path}")
            return 0
        if args.list_tags is not None:
            for tag in sorted(entry["tag"] for entry in get_all("/tags") if entry["tag"].startswith(args.list_tags)):
                print(tag)
            return 0
        config = load_config(args.config)
        tz = ZoneInfo(config.get("timezone", "Asia/Shanghai"))
        today = datetime.now(tz).date()
        last = args.last or today
        first = args.first or (last - timedelta(days=max(1, int(config.get("default_window_days", 30))) - 1))
        if first > last:
            raise ValueError("--from must not be later than --to")
        report, diagnostics = build_report(config, first, last)
        for diagnostic in diagnostics:
            print(f"Reading Journal warning: {diagnostic}", file=sys.stderr)
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(render_html(report), encoding="utf-8")
        active_papers = len({event["paper_key"] for event in report["activity"]})
        print(f"Wrote {args.out.resolve()} ({len(report['journal'])} journal entries, {active_papers} papers active in the exported period)")
        return 0
    except (OSError, ValueError, urllib.error.URLError, json.JSONDecodeError) as error:
        print(f"Reading Journal: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
