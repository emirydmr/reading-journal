#!/usr/bin/env python3
"""Local Reading Journal control app with user-authorized paper tag editing."""

from __future__ import annotations

import fcntl
import html
import json
import re
import secrets
import threading
import urllib.parse
import urllib.request
import urllib.error
from datetime import date, datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from zoneinfo import ZoneInfo, available_timezones

import journal

LOCAL_API = journal.API.rsplit("/users/0", 1)[0]


def date_range(config: dict, query: dict[str, list[str]]) -> tuple[date, date]:
    today = datetime.now(ZoneInfo(config.get("timezone", "Asia/Shanghai"))).date()
    last = date.fromisoformat(query["to"][0]) if query.get("to") else today
    first = date.fromisoformat(query["from"][0]) if query.get("from") else last - timedelta(days=int(config.get("default_window_days", 30)) - 1)
    if first > last:
        raise ValueError("From date must not be later than To date")
    return first, last


def library_snapshot() -> tuple[list[dict], list[dict], list[dict]]:
    return journal.get_all("/items"), journal.get_all("/collections"), journal.get_all("/tags")


def paper_tag_snapshot(key: str) -> tuple[dict, str]:
    if not re.fullmatch(r"[A-Z0-9]{8}", key):
        raise ValueError("Invalid Zotero item key")
    with urllib.request.urlopen(LOCAL_API + "/", timeout=15) as response:
        server_id = response.headers.get("Zotero-Server-ID", "")
    if not server_id:
        raise ValueError("Zotero 10 local API is required for tag editing")
    request = urllib.request.Request(journal.API + f"/items/{key}", headers={"Zotero-API-Version": "3", "Zotero-Server-ID": server_id})
    with urllib.request.urlopen(request, timeout=15) as response:
        item = json.load(response)
    data = item.get("data", {})
    if data.get("parentItem") or data.get("itemType") in ("annotation", "attachment", "note"):
        raise ValueError("Only paper tags can be edited here")
    return item, server_id


def update_paper_tags(key: str, version: int, names: list[str]) -> list[str]:
    if not isinstance(version, int) or not isinstance(names, list) or len(names) > 500 or any(not isinstance(name, str) or not name.strip() or len(name) > 255 for name in names):
        raise ValueError("Invalid tag selection")
    if len(set(names)) != len(names):
        raise ValueError("Duplicate tags")
    item, server_id = paper_tag_snapshot(key)
    if item["version"] != version:
        raise RuntimeError("This paper changed in Zotero. Reload its tags before saving.")
    existing = {tag["tag"]: tag for tag in item["data"].get("tags", [])}
    updated = [existing.get(name, {"tag": name}) for name in names]
    if updated == item["data"].get("tags", []):
        return names
    auth_request = urllib.request.Request(LOCAL_API + "/local/authorize", data=json.dumps({"appName": "Reading Journal"}).encode(),
        headers={"Content-Type": "application/json", "Zotero-Server-ID": server_id}, method="POST")
    with urllib.request.urlopen(auth_request, timeout=90) as response:
        authorization = json.load(response)
    patch_request = urllib.request.Request(journal.API + f"/items/{key}", data=json.dumps({"tags": updated}).encode(), method="PATCH",
        headers={"Content-Type": "application/json", "Zotero-API-Version": "3", "Zotero-Server-ID": server_id,
                 "Zotero-API-Key": authorization["key"], "If-Unmodified-Since-Version": str(version)})
    with urllib.request.urlopen(patch_request, timeout=30):
        pass
    return names


def make_catalog(items: list[dict], collections: list[dict], tags: list[dict], config: dict, diagnostics: list[str]) -> dict:
    paths = journal.collection_paths(collections)
    selected = journal.selected_collection_keys(config, collections)
    types = {entry["data"].get("itemType", "") for entry in items if not entry["data"].get("parentItem")}
    types |= set(config.get("paper_types", []))
    timezones = sorted(available_timezones() | {config.get("timezone", "Asia/Shanghai")})
    categories = journal.editable_tag_config(config)["tag_categories"]
    names = {entry.get("tag", "") for entry in tags if entry.get("tag")}
    unmatched = sorted(tag for tag in names if not any(rule["prefix"] and tag.startswith(rule["prefix"]) for rule in categories.values()))
    if unmatched and not any(not rule["prefix"] for rule in categories.values()):
        name = "Uncategorized"
        while name in categories:
            name += " tags"
        categories[name] = {"prefix": "", "color": "#7b9185", "description": "", "selection_mode": "explicit", "allowed_tags": [],
                            "tags": {tag: {"label": tag, "color": "#7b9185", "description": ""} for tag in unmatched}}
    return {
        "collections": [
            {"key": entry["key"], "name": entry["data"].get("name") or entry["key"],
             "path": paths[entry["key"]], "parent_key": entry["data"].get("parentCollection") or None}
            for entry in sorted(collections, key=lambda entry: paths[entry["key"]])
        ],
        "selected_collections": sorted(selected if selected is not None else paths),
        "paper_types": sorted(name for name in types if name and name not in ("annotation", "attachment", "note")),
        "tags": sorted({entry.get("tag", "") for entry in tags if entry.get("tag")}),
        "timezones": timezones,
        "tag_categories": categories,
        "diagnostics": diagnostics,
    }


def save_config(config: dict, destination: Path | None = None) -> None:
    target = destination or journal.user_config_path()
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(target.name + ".tmp")
    temporary.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(target)


def handler_factory(token: str):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass

        def respond(self, body: bytes, content_type: str, status: int = 200, extra: dict[str, str] | None = None) -> None:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            for key, value in (extra or {}).items():
                self.send_header(key, value)
            self.end_headers()
            self.wfile.write(body)

        def error(self, message: str, status: int = 400) -> None:
            self.respond(json.dumps({"error": message}).encode("utf-8"), "application/json; charset=utf-8", status)

        def route(self):
            parts = urllib.parse.urlsplit(self.path)
            query = urllib.parse.parse_qs(parts.query)
            if query.get("token", [""])[0] != token:
                self.error("Invalid app session", 403)
                return None, None
            return parts.path, query

        def do_GET(self):
            path, query = self.route()
            if path is None:
                return
            if path not in ("/", "/report", "/export", "/paper-tags"):
                self.error("Not found", 404)
                return
            try:
                if path == "/paper-tags":
                    item, _server_id = paper_tag_snapshot(query.get("key", [""])[0])
                    body = json.dumps({"version": item["version"], "tags": [tag["tag"] for tag in item["data"].get("tags", [])]}).encode()
                    self.respond(body, "application/json; charset=utf-8")
                    return
                config = journal.load_config()
                first, last = date_range(config, query)
                items, collections, tags = library_snapshot()
                report, diagnostics = journal.build_report(config, first, last, items=items, collections=collections)
                if path == "/report":
                    catalog = make_catalog(items, collections, tags, config, diagnostics)
                    self.respond(json.dumps({"report": report, "catalog": catalog}, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8")
                elif path == "/export":
                    html = journal.render_html(report).encode("utf-8")
                    filename = f"Reading-Journal-{first.isoformat()}-to-{last.isoformat()}.html"
                    self.respond(html, "text/html; charset=utf-8", extra={"Content-Disposition": f'attachment; filename="{filename}"'})
                else:
                    catalog = make_catalog(items, collections, tags, config, diagnostics)
                    html = journal.render_html(report, app_config=config, app_catalog=catalog, app_token=token).encode("utf-8")
                    self.respond(html, "text/html; charset=utf-8")
            except Exception as exc:
                if path == "/":
                    message = f"Reading Journal could not load Zotero: {exc}"
                    page = f"<!doctype html><html lang='en'><meta charset='utf-8'><title>Reading Journal</title><body style='font:16px system-ui;padding:2rem;color:#173d39'><h1>Reading Journal</h1><p>{html.escape(message)}</p><p>Open Zotero, enable its local API, and refresh this page.</p></body></html>"
                    self.respond(page.encode("utf-8"), "text/html; charset=utf-8", 503)
                else:
                    self.error(str(exc), 503)

        def do_POST(self):
            path, _query = self.route()
            if path is None:
                return
            if path == "/quit":
                self.respond(b'{"ok":true}', "application/json; charset=utf-8")
                threading.Thread(target=self.server.shutdown, daemon=True).start()
                return
            if path == "/paper-tags":
                try:
                    size = int(self.headers.get("Content-Length", "0"))
                    if size <= 0 or size > 100_000:
                        raise ValueError("Invalid tag selection size")
                    payload = json.loads(self.rfile.read(size))
                    names = update_paper_tags(payload["key"], payload["version"], payload["tags"])
                    self.respond(json.dumps({"tags": names}).encode(), "application/json; charset=utf-8")
                except RuntimeError as exc:
                    self.error(str(exc), 409)
                except urllib.error.HTTPError as exc:
                    self.error("Zotero rejected the change" if exc.code != 412 else "This paper changed in Zotero. Reload its tags before saving.", 409 if exc.code == 412 else exc.code)
                except Exception as exc:
                    self.error(str(exc))
                return
            if path != "/settings":
                self.error("Not found", 404)
                return
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if size <= 0 or size > 1_000_000:
                    raise ValueError("Invalid settings size")
                payload = json.loads(self.rfile.read(size))
                if payload["config"].get("tag_schema_version") != 2 and "Status" in payload["config"].get("tag_categories", {}):
                    raise ValueError("Status is reserved for reading-status tags")
                config = journal.validate_config(payload["config"])
                if not config.get("included_collections"):
                    raise ValueError("Select at least one collection")
                date_range(config, {"from": [payload["from"]], "to": [payload["to"]]})
                collections = journal.get_all("/collections")
                journal.selected_collection_keys(config, collections)
                save_config(config)
                self.respond(b'{"ok":true}', "application/json; charset=utf-8")
            except Exception as exc:
                self.error(str(exc))

    return Handler


def main() -> int:
    from desktop import run_window
    settings_dir = journal.user_config_path().parent
    settings_dir.mkdir(parents=True, exist_ok=True)
    lock_path = settings_dir / "app.lock"
    with lock_path.open("a+", encoding="utf-8") as lock:
        try:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            lock.seek(0)
            try:
                running = json.load(lock)
                url = f"http://127.0.0.1:{running['port']}/?token={urllib.parse.quote(running['token'])}"
                stopped = threading.Event()
                def stop_existing():
                    try:
                        request = urllib.request.Request(f"http://127.0.0.1:{running['port']}/quit?token={urllib.parse.quote(running['token'])}", data=b"", method="POST")
                        with urllib.request.urlopen(request, timeout=3):
                            pass
                    except OSError:
                        pass
                    stopped.set()
                run_window(url, stop_existing, stopped)
                return 0
            except (ValueError, KeyError):
                return 1
        token = secrets.token_urlsafe(32)
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler_factory(token))
        lock.seek(0)
        lock.truncate()
        json.dump({"port": server.server_port, "token": token}, lock)
        lock.flush()
        url = f"http://127.0.0.1:{server.server_port}/?token={urllib.parse.quote(token)}"
        stopped = threading.Event()
        def serve():
            try:
                server.serve_forever(poll_interval=0.1)
            finally:
                stopped.set()
        worker = threading.Thread(target=serve, daemon=True)
        worker.start()
        def stop():
            if not stopped.is_set():
                server.shutdown()
            worker.join(timeout=3)
            server.server_close()
        try:
            run_window(url, stop, stopped)
        finally:
            stop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
