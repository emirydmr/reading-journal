#!/usr/bin/env python3
"""Read Zotero's local API and generate a self-contained reading journal."""

from __future__ import annotations

import argparse
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
API = "http://127.0.0.1:23119/api/users/0"
PAGE_SIZE = 100
PRIMARY_STATUSES = {
    "status/to-read": "To read",
    "status/reading": "Reading",
    "status/read": "Read",
}
SUPPLEMENTARY_STATUS = "status/revisit"
CANONICAL_STATUS_TAGS = set(PRIMARY_STATUSES) | {SUPPLEMENTARY_STATUS}


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
        if not prefix:
            raise ValueError(f"Tag category {label!r} needs a non-empty prefix")
        matches = sorted(
            name for name in names
            if name.startswith(prefix) and (not allowed or name in allowed)
        )
        if matches:
            result[label] = matches
    return result


def reading_status(tags: list[dict], item_key: str) -> tuple[dict, list[str]]:
    names = {tag.get("tag", "") for tag in tags}
    present = [tag for tag in PRIMARY_STATUSES if tag in names]
    diagnostics = []
    for tag in sorted(name for name in names if name.startswith("status/") and name not in CANONICAL_STATUS_TAGS):
        hint = " (use status/to-read)" if tag == "status/to_read" else ""
        diagnostics.append(f"{item_key}: noncanonical status tag {tag}{hint}")
    if len(present) > 1:
        diagnostics.append(f"{item_key}: conflicting primary statuses: {', '.join(present)}")
    label = PRIMARY_STATUSES[present[0]] if len(present) == 1 else "Conflicting statuses" if present else "Unassigned"
    return {"label": label, "revisit": SUPPLEMENTARY_STATUS in names}, diagnostics


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
    return colors, list(colors.values())


def is_in_window(value: str | None, tz: ZoneInfo, first: date, last: date) -> bool:
    observed = local_date(value, tz)
    return observed is not None and first <= observed <= last


def build_report(config: dict, first: date, last: date) -> tuple[dict, list[str]]:
    tz = ZoneInfo(config.get("timezone", "Asia/Shanghai"))
    items = get_all("/items")
    collections = get_all("/collections")
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

    # A pie needs mutually exclusive slices. Multiple membership is explicit, never guessed.
    pie = Counter()
    multi_membership = 0
    for paper in scoped:
        memberships = [key for key in paper.get("collections") or [] if key in active_collection_keys and (selected is None or key in selected)]
        if len(memberships) > 1:
            multi_membership += 1
        if len(memberships) > 1:
            pie["Multiple collections"] += 1
        elif memberships:
            pie[paths[memberships[0]]] += 1
        else:
            pie["Unfiled"] += 1

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
    entries = []
    inventory = []
    diagnostics = []
    for paper in scoped:
        reasons = []
        activity_times = []
        newly_added = is_in_window(paper.get("dateAdded"), tz, first, last)
        if newly_added:
            reasons.append("Paper added")
            activity_times.append(paper["dateAdded"])
        recent_annotations = []
        all_annotations = annotations_by_paper.get(paper["key"], [])
        annotation_activity_at = max(
            (stamp for annotation in all_annotations
             for stamp in (annotation.get("dateAdded"), annotation.get("dateModified")) if stamp),
            default="",
        )
        for annotation in all_annotations:
            added = is_in_window(annotation.get("dateAdded"), tz, first, last)
            modified = is_in_window(annotation.get("dateModified"), tz, first, last)
            if not (added or modified):
                continue
            if added:
                reasons.append("Annotation added")
            elif modified:
                reasons.append("Annotation modified")
            activity_times.append((annotation.get("dateModified") if modified else annotation.get("dateAdded")) or "")
            raw_color = (annotation.get("annotationColor") or "").lower()
            if raw_color not in colors and not any(item["color"] == raw_color for item in color_legend):
                color_legend.append({"color": raw_color, "label": "Unmapped", "description": "No meaning is configured for this annotation color."})
            position = annotation.get("annotationPosition") or ""
            try:
                page_index = json.loads(position).get("pageIndex")
            except (ValueError, TypeError, AttributeError):
                page_index = None
            attachment_key = annotation.get("parentItem")
            link = f"zotero://select/library/items/{paper['key']}"
            if attachment_key:
                params = {"annotation": annotation["key"]}
                if isinstance(page_index, int) and page_index >= 0:
                    params["page"] = page_index + 1
                link = f"zotero://open-pdf/library/items/{attachment_key}?{urllib.parse.urlencode(params)}"
            recent_annotations.append({
                "key": annotation["key"],
                "text": annotation.get("annotationText") or "",
                "comment": annotation.get("annotationComment") or "",
                "color": raw_color,
                "meaning": colors.get(raw_color, {"label": "Unmapped"})["label"],
                "page": annotation.get("annotationPageLabel") or "?",
                "date_added": annotation.get("dateAdded") or "",
                "date_modified": annotation.get("dateModified") or "",
                "link": link,
                "tags": [tag for group in categorized_tags(annotation.get("tags") or [], config.get("tag_categories", {})).values() for tag in group],
            })
        tags = categorized_tags(paper.get("tags") or [], config.get("tag_categories", {}))
        status, status_diagnostics = reading_status(paper.get("tags") or [], paper["key"])
        diagnostics.extend(status_diagnostics)
        membership_keys = sorted(
            (key for key in paper.get("collections") or []
             if key in active_collection_keys and (selected is None or key in selected)),
            key=lambda key: paths[key],
        )
        memberships = [paths[key] for key in membership_keys]
        creators = [" ".join(part for part in (c.get("firstName"), c.get("lastName") or c.get("name")) if part) for c in paper.get("creators") or []]
        link = f"zotero://select/library/items/{paper['key']}"
        inventory.append({
            "key": paper["key"],
            "title": paper.get("title") or "Untitled",
            "creators": creators,
            "date_added": paper.get("dateAdded") or "",
            "status": status,
            "status_tags": tags.get("Status", []),
            "tags": tags,
            "collection_keys": membership_keys,
            "collections": memberships or ["Unfiled"],
            "annotation_count": len(all_annotations),
            "annotation_activity_at": annotation_activity_at,
            "new_in_period": newly_added,
            "annotated_in_period": bool(recent_annotations),
            "link": link,
        })
        if not reasons:
            continue
        recent_annotations.sort(key=lambda a: (a["date_added"], a["key"]))
        entries.append({
            "key": paper["key"],
            "title": paper.get("title") or "Untitled",
            "item_type": paper.get("itemType"),
            "creators": creators,
            "date_added": paper.get("dateAdded") or "",
            "date_modified": paper.get("dateModified") or "",
            "reasons": sorted(set(reasons)),
            "activity_at": max(activity_times),
            "status": status,
            "status_tags": tags.get("Status", []),
            "collection_keys": membership_keys,
            "collections": memberships or ["Unfiled"],
            "tags": tags,
            "annotations": recent_annotations,
            "link": link,
        })
    entries.sort(key=lambda p: (p["activity_at"], p["title"]), reverse=True)
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
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "timezone": str(tz),
        "range": {"from": first.isoformat(), "to": last.isoformat()},
        "scope": {"papers": len(scoped), "multi_membership": multi_membership},
        "growth": growth,
        "pie": [{"name": name, "count": count} for name, count in sorted(pie.items(), key=lambda pair: (-pair[1], pair[0]))],
        "color_legend": color_legend,
        "collections": collection_list,
        "inventory": inventory,
        "entries": entries,
    }, diagnostics


def render_html(report: dict) -> str:
    data = json.dumps(report, ensure_ascii=False).replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
    template = (HERE / "template.html").read_text(encoding="utf-8")
    return template.replace("__JOURNAL_DATA__", data)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=HERE / "config.json")
    parser.add_argument("--from", dest="first", type=date.fromisoformat)
    parser.add_argument("--to", dest="last", type=date.fromisoformat)
    parser.add_argument("--out", type=Path, default=HERE / "report.html")
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
        config = json.loads(args.config.read_text(encoding="utf-8"))
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
        args.out.write_text(render_html(report), encoding="utf-8")
        print(f"Wrote {args.out.resolve()} ({len(report['entries'])} entries, {report['scope']['papers']} papers in scope)")
        return 0
    except (OSError, ValueError, urllib.error.URLError, json.JSONDecodeError) as error:
        print(f"Reading Journal: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
