import json
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import app  # noqa: E402
import journal  # noqa: E402


class AppServerTests(unittest.TestCase):
    def setUp(self):
        self.config = journal.load_config(journal.HERE / "config.json")
        self.config["included_collections"] = ["C01"]
        self.token = "fixture-token"
        self.server = app.ThreadingHTTPServer(("127.0.0.1", 0), app.handler_factory(self.token))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.config_patch = patch.object(journal, "load_config", return_value=self.config)
        self.api_patch = patch.object(journal, "get_all", side_effect=lambda route: [{"key": "C01", "data": {"name": "Research", "parentCollection": False}}] if route == "/collections" else [])
        self.save_patch = patch.object(app, "save_config")
        self.config_patch.start()
        self.api_patch.start()
        self.saved = self.save_patch.start()
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.save_patch.stop()
        self.api_patch.stop()
        self.config_patch.stop()

    def request(self, path, payload=None):
        url = f"http://127.0.0.1:{self.server.server_port}{path}"
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
        return urllib.request.urlopen(request, timeout=3)

    def test_app_and_export_have_distinct_controls(self):
        with self.request(f"/?token={self.token}&from=2026-10-01&to=2026-10-14") as response:
            html = response.read().decode("utf-8")
            self.assertIn('id="settings-dialog"', html)
            self.assertIn('<select id="setting-timezone" required>', html)
            self.assertIn('id="setting-timezone-search"', html)
            self.assertIn('id="view-journal"', html)
            self.assertIn('id="range-dialog"', html)
        with self.request(f"/export?token={self.token}&from=2026-10-01&to=2026-10-14") as response:
            html = response.read().decode("utf-8")
            self.assertIn("attachment;", response.headers["Content-Disposition"])
            self.assertNotIn('id="settings-dialog"', html)
            self.assertIn('id="range-dialog"', html)
            self.assertNotIn("zotero://", html)
        with self.assertRaises(urllib.error.HTTPError) as denied:
            self.request("/")
        self.assertEqual(denied.exception.code, 403)

    def test_settings_validation_and_save(self):
        route = f"/settings?token={self.token}"
        valid = {"config": self.config, "from": "2026-10-01", "to": "2026-10-14"}
        with self.request(route, valid) as response:
            self.assertEqual(response.status, 200)
        self.saved.assert_called_once()
        invalid = json.loads(json.dumps(valid))
        invalid["config"]["status_roles"]["read"]["tag"] = invalid["config"]["status_roles"]["reading"]["tag"]
        with self.assertRaises(urllib.error.HTTPError) as rejected:
            self.request(route, invalid)
        self.assertEqual(rejected.exception.code, 400)
        self.saved.assert_called_once()
        invalid["config"] = json.loads(json.dumps(self.config))
        invalid["config"]["timezone"] = "Not/A_Timezone"
        with self.assertRaises(urllib.error.HTTPError) as rejected:
            self.request(route, invalid)
        self.assertEqual(rejected.exception.code, 400)
        self.saved.assert_called_once()
        invalid["config"] = json.loads(json.dumps(self.config))
        invalid["config"]["tag_categories"]["Status"] = {"prefix": "status/", "allowed_tags": []}
        with self.assertRaises(urllib.error.HTTPError) as rejected:
            self.request(route, invalid)
        self.assertEqual(rejected.exception.code, 400)
        self.saved.assert_called_once()
        invalid["config"] = json.loads(json.dumps(self.config))
        invalid["config"]["included_collections"] = []
        with self.assertRaises(urllib.error.HTTPError) as rejected:
            self.request(route, invalid)
        self.assertEqual(rejected.exception.code, 400)
        self.saved.assert_called_once()


class ConfigPersistenceTests(unittest.TestCase):
    def test_catalog_provides_collection_tree_and_effective_selection(self):
        config = journal.load_config(journal.HERE / "config.json")
        config["included_collections"] = ["ROOT"]
        collections = [
            {"key": "ROOT", "data": {"name": "Research", "parentCollection": False}},
            {"key": "CHILD", "data": {"name": "Child", "parentCollection": "ROOT"}},
            {"key": "GRAND", "data": {"name": "Grandchild", "parentCollection": "CHILD"}},
        ]
        catalog = app.make_catalog([], collections, [], config, [])
        self.assertEqual(set(catalog["selected_collections"]), {"ROOT", "CHILD", "GRAND"})
        self.assertEqual(next(c for c in catalog["collections"] if c["key"] == "GRAND")["parent_key"], "CHILD")
        self.assertIn(config["timezone"], catalog["timezones"])
        with patch.object(app, "available_timezones", return_value={"UTC"}):
            limited = app.make_catalog([], collections, [], config, [])
        self.assertEqual(limited["timezones"], ["Asia/Shanghai", "UTC"])

    def test_saved_settings_reload_and_legacy_status_category_migrates(self):
        config = json.loads((journal.HERE / "config.json").read_text(encoding="utf-8"))
        config.pop("status_roles")
        config["tag_categories"]["Status"] = {"prefix": "status/", "allowed_tags": []}
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "config.json"
            app.save_config(journal.validate_config(config), path)
            loaded = journal.load_config(path)
        self.assertEqual(loaded["status_roles"]["read"]["tag"], "status/read")
        self.assertNotIn("Status", loaded["tag_categories"])


if __name__ == "__main__":
    unittest.main()
