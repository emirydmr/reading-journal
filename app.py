#!/usr/bin/env python3
"""Local Reading Journal control app. Zotero is queried with GET only."""

from __future__ import annotations

import fcntl
import html
import json
import secrets
import threading
import urllib.parse
import webbrowser
from datetime import date, datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from zoneinfo import ZoneInfo, available_timezones

import journal


def date_range(config: dict, query: dict[str, list[str]]) -> tuple[date, date]:
    today = datetime.now(ZoneInfo(config.get("timezone", "Asia/Shanghai"))).date()
    last = date.fromisoformat(query["to"][0]) if query.get("to") else today
    first = date.fromisoformat(query["from"][0]) if query.get("from") else last - timedelta(days=int(config.get("default_window_days", 30)) - 1)
    if first > last:
        raise ValueError("From date must not be later than To date")
    return first, last


def library_snapshot() -> tuple[list[dict], list[dict], list[dict]]:
    return journal.get_all("/items"), journal.get_all("/collections"), journal.get_all("/tags")


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
            if path not in ("/", "/export"):
                self.error("Not found", 404)
                return
            try:
                config = journal.load_config()
                first, last = date_range(config, query)
                items, collections, tags = library_snapshot()
                report, diagnostics = journal.build_report(config, first, last, items=items, collections=collections)
                if path == "/export":
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
                webbrowser.open_new_tab(f"http://127.0.0.1:{running['port']}/?token={urllib.parse.quote(running['token'])}")
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
        threading.Thread(target=webbrowser.open_new_tab, args=(url,), daemon=True).start()
        try:
            server.serve_forever()
        finally:
            server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
