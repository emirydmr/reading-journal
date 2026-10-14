import json
import re
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src" / "reading_journal"))
import journal  # noqa: E402


def item(key, item_type, **fields):
    return {"key": key, "data": {"key": key, "itemType": item_type, **fields}}


def collection(key, name, parent=False):
    return {"key": key, "data": {"key": key, "name": name, "parentCollection": parent}}


class StatusTests(unittest.TestCase):
    def check_status(self, names):
        return journal.reading_status([{"tag": name} for name in names], "PAPER001")

    def test_canonical_and_supplementary_statuses(self):
        for tag, label in journal.PRIMARY_STATUSES.items():
            with self.subTest(tag=tag):
                status, diagnostics = self.check_status([tag])
                self.assertEqual(status, {"label": label, "revisit": False})
                self.assertEqual(diagnostics, [])
        status, diagnostics = self.check_status(["status/read", "status/revisit"])
        self.assertEqual(status, {"label": "Read", "revisit": True})
        self.assertEqual(diagnostics, [])

    def test_missing_conflicting_and_noncanonical_statuses(self):
        self.assertEqual(self.check_status([]), ({"label": "Unassigned", "revisit": False}, []))
        status, diagnostics = self.check_status(["status/reading", "status/read"])
        self.assertEqual(status["label"], "Conflicting statuses")
        self.assertIn("conflicting primary statuses", diagnostics[0])
        status, diagnostics = self.check_status(["status/to_read"])
        self.assertEqual(status["label"], "Unassigned")
        self.assertIn("use status/to-read", diagnostics[0])


class ApiTests(unittest.TestCase):
    def test_local_api_reads_use_get(self):
        class EmptyResponse:
            def __enter__(self):
                return self

            def __exit__(self, *_):
                return False

            def read(self, *_):
                return b"[]"

        with patch.object(journal.urllib.request, "urlopen", return_value=EmptyResponse()) as urlopen:
            self.assertEqual(journal.get_all("/items"), [])
        self.assertEqual(urlopen.call_args.args[0].get_method(), "GET")


class ReportTests(unittest.TestCase):
    def test_new_colors_migrate_once_and_keep_user_edits(self):
        raw = json.loads((journal.HERE / "config.json").read_text(encoding="utf-8"))
        raw.pop("annotation_color_schema_version")
        raw["annotation_colors"].pop("#aaaaaa")
        raw["annotation_colors"]["#e56eee"]["label"] = "My research gap label"
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "config.json"
            path.write_text(json.dumps(raw), encoding="utf-8")
            migrated = journal.load_config(path)
            self.assertEqual(migrated["annotation_colors"]["#e56eee"]["label"], "My research gap label")
            self.assertEqual(migrated["annotation_colors"]["#aaaaaa"]["label"], "Needs verification")
            self.assertNotIn("#aaaaaa", json.loads(path.read_text())["annotation_colors"])
            migrated["annotation_colors"].pop("#aaaaaa")
            path.write_text(json.dumps(migrated), encoding="utf-8")
            self.assertNotIn("#aaaaaa", journal.load_config(path)["annotation_colors"])

    def test_annotation_calendar_groups_use_report_timezone_and_iso_week(self):
        periods = journal.local_periods("2026-10-14T23:30:00Z", ZoneInfo("Asia/Shanghai"))
        self.assertEqual(periods, {"day": "2026-10-15", "week": "2026-W42", "month": "2026-10"})
        self.assertEqual(journal.local_periods("2021-01-01T12:00:00Z", ZoneInfo("UTC"))["week"], "2020-W53")

    def setUp(self):
        self.config = json.loads((journal.HERE / "config.json").read_text(encoding="utf-8"))
        self.config["included_collections"] = ["C01", "C04"]
        self.config["paper_types"] = ["journalArticle"]
        self.collections = [
            collection("ROOT", "Masters Research"),
            collection("C01", "01 Vehicle Control", "ROOT"),
            collection("C04", "04 Testing", "ROOT"),
            collection("C06", "06 Notes", "ROOT"),
        ]
        old = "2026-09-01T10:00:00Z"
        recent = "2026-10-14T10:00:00Z"
        self.items = [
            item("PAPERA01", "journalArticle", title="Annotated paper", collections=["C01", "C04"], dateAdded=old, dateModified=recent,
                 tags=[{"tag": "status/to_read"}, {"tag": "method/simulation"}, {"tag": "method/unlisted"}, {"tag": "priority/high"}]),
            item("PAPERB01", "journalArticle", title="New paper", collections=["C01"], dateAdded=recent, dateModified=recent,
                 tags=[{"tag": "status/read"}, {"tag": "status/revisit"}, {"tag": "approach/control"}]),
            item("PAPERC06", "journalArticle", title="Excluded note collection paper", collections=["C06"], dateAdded=recent, dateModified=recent, tags=[]),
            item("PAPERD01", "journalArticle", title="Metadata only", collections=["C01"], dateAdded=old, dateModified=recent, tags=[]),
            item("PAPERE04", "journalArticle", title="Old testing paper", collections=["C04"], dateAdded=old, dateModified=old,
                 tags=[{"tag": "status/reading"}, {"tag": "status/read"}]),
            item("ATTACH01", "attachment", parentItem="PAPERA01", title="PDF"),
        ]
        for i, color in enumerate([*journal.ZOTERO_ANNOTATION_COLORS, "#123456"]):
            self.items.append(item(f"ANNOT{i:03}", "annotation", parentItem="ATTACH01", annotationColor=color,
                                   annotationText=f"Source passage {i}", annotationComment=f"Comment {i}",
                                   annotationPageLabel=str(i + 1), annotationPosition='{"pageIndex":1}', tags=[],
                                   dateAdded=old if i == 0 else recent, dateModified=recent))

    def build(self):
        def fake_get_all(route):
            return self.items if route == "/items" else self.collections
        with patch.object(journal, "get_all", side_effect=fake_get_all):
            return journal.build_report(self.config, date(2026, 10, 14), date(2026, 10, 14))

    def test_scope_activity_tags_colors_and_pie(self):
        report, diagnostics = self.build()
        self.assertEqual(report["scope"], {"papers": 4, "multi_membership": 1})
        self.assertEqual(sum(slice_["count"] for slice_ in report["pie"]), 4)
        self.assertEqual(sum(event["count"] for event in report["size_events"]), 4)
        self.assertEqual({event["bucket"] for event in report["size_events"]},
                         {"Multiple collections", "Masters Research / 01 Vehicle Control", "Masters Research / 04 Testing"})
        self.assertEqual(next(s["count"] for s in report["pie"] if s["name"] == "Multiple collections"), 1)
        self.assertEqual({event["paper_title"] for event in report["activity"]}, {"Annotated paper", "New paper"})
        self.assertEqual({paper["title"] for paper in report["inventory"]},
                         {"Annotated paper", "New paper", "Metadata only", "Old testing paper"})
        self.assertNotIn("Excluded note collection paper", json.dumps(report))
        self.assertNotIn("Metadata only", json.dumps(report["activity"]))
        self.assertEqual({c["key"] for c in report["collections"]}, {"C01", "C04"})
        annotated = next(entry for entry in report["journal"] if entry["paper_title"] == "Annotated paper")
        self.assertEqual(annotated["status"]["label"], "Unassigned")
        self.assertEqual(annotated["periods"], {"day": "2026-10-14", "week": "2026-W42", "month": "2026-10"})
        older_annotation = next(entry for entry in report["journal"] if entry["key"] == "ANNOT000")
        self.assertEqual(older_annotation["added_periods"]["day"], "2026-09-01")
        self.assertEqual(older_annotation["modified_periods"]["day"], "2026-10-14")
        self.assertEqual(annotated["paper_tags"]["Method"], ["method/simulation"])
        self.assertNotIn("method/unlisted", json.dumps(report))
        self.assertEqual(len(report["journal"]), 9)
        self.assertEqual(len(report["activity"]), 10)
        self.assertEqual({event["type"] for event in report["activity"]},
                         {"Paper added", "Annotation added", "Annotation modified"})
        self.assertTrue(all(entry["paper_key"] == "PAPERA01" for entry in report["journal"]))
        self.assertEqual({entry["collection_group"] for entry in report["journal"]}, {"01 + 04"})
        self.assertEqual(report["journal"][0]["zotero_link"].split("?", 1)[0], "zotero://open-pdf/library/items/ATTACH01")
        self.assertNotIn("zotero://", journal.render_html(report))
        self.assertEqual([entry["color"] for entry in report["color_legend"]], [*journal.ZOTERO_ANNOTATION_COLORS, "#123456"])
        self.assertEqual({a["meaning"] for a in report["journal"]},
                         {entry["label"] for entry in report["color_legend"]})
        new = next(paper for paper in report["inventory"] if paper["title"] == "New paper")
        self.assertEqual(new["status"], {"label": "Read", "revisit": True})
        self.assertIn("status/read", new["tags"]["Status"])
        inventory_new = next(p for p in report["inventory"] if p["key"] == "PAPERB01")
        self.assertEqual(inventory_new["date_added_day"], "2026-10-14")
        self.assertEqual(inventory_new["status_tags"], ["status/read", "status/revisit"])
        self.assertTrue(inventory_new["new_in_period"])
        self.assertFalse(inventory_new["annotated_in_period"])
        inventory_annotated = next(p for p in report["inventory"] if p["key"] == "PAPERA01")
        self.assertEqual(inventory_annotated["collection_keys"], ["C01", "C04"])
        self.assertTrue(inventory_annotated["annotated_in_period"])
        self.assertEqual(inventory_annotated["status_tags"], [])
        self.assertTrue(any("status/to_read" in message for message in diagnostics))
        self.assertTrue(any("conflicting primary statuses" in message for message in diagnostics))

    def test_descendant_is_in_collection_inventory_and_metadata_edit_is_not_activity(self):
        self.collections.append(collection("C011", "Child", "C01"))
        self.items.append(item("PAPERCHD", "journalArticle", title="Child paper", collections=["C011"],
                               dateAdded="2026-09-01T10:00:00Z", dateModified="2026-10-14T10:00:00Z", tags=[]))
        report, _ = self.build()
        child = next(c for c in report["collections"] if c["key"] == "C011")
        self.assertEqual(child["parent_key"], "C01")
        paper = next(p for p in report["inventory"] if p["key"] == "PAPERCHD")
        self.assertEqual(paper["collection_keys"], ["C011"])
        self.assertNotIn("PAPERCHD", {e["paper_key"] for e in report["activity"]})
        self.assertEqual(sum(s["count"] for s in report["pie"]), report["scope"]["papers"])

    def test_mixed_included_and_excluded_memberships_do_not_leak(self):
        self.items[1]["data"]["collections"] = ["C01", "C06"]
        report, _ = self.build()
        paper = next(p for p in report["inventory"] if p["key"] == "PAPERB01")
        self.assertEqual(paper["collection_keys"], ["C01"])
        self.assertEqual(paper["collections"], ["Masters Research / 01 Vehicle Control"])
        self.assertEqual(report["scope"]["multi_membership"], 1)
        self.assertNotIn("C06", json.dumps(report))

    def test_html_is_self_contained_and_escapes_embedded_data(self):
        report, _ = self.build()
        next(paper for paper in report["inventory"] if paper["key"] == "PAPERA01")["title"] = "</script><script>alert(1)</script> __APP_CONFIG__"
        html = journal.render_html(report)
        self.assertEqual(html.count("<script>"), 1)
        self.assertNotIn("<script>alert(1)</script>", html)
        self.assertIn("__APP_CONFIG__", html)
        self.assertNotRegex(html, re.compile(r"<(?:script|link)\b[^>]*(?:src|href)\s*=", re.I))
        self.assertIn('id="view-feed"', html)
        self.assertIn('id="view-dashboard"', html)
        self.assertIn('id="view-journal"', html)
        self.assertIn('id="range-dialog"', html)
        self.assertIn('id="range-label"', html)
        self.assertIn('id="status-summary"', html)
        self.assertNotIn('id="settings-dialog"', html)
        self.assertNotIn('<footer', html)
        self.assertNotIn('Source: local Zotero API', html)

    def test_export_omits_papers_without_activity_in_its_date_window(self):
        report, _ = self.build()
        limited = journal.export_window_report(report)
        self.assertEqual({paper["key"] for paper in limited["inventory"]}, {"PAPERA01", "PAPERB01"})
        self.assertEqual(limited["scope"]["papers"], 2)
        self.assertEqual(sum(slice_["count"] for slice_ in limited["pie"]), 2)
        self.assertEqual(sum(event["count"] for event in limited["size_events"]), 4)
        self.assertEqual(len(report["inventory"]), 4)
        html = journal.render_html(report)
        self.assertNotIn("Metadata only", html)
        self.assertNotIn("Old testing paper", html)

    def test_collection_selection_can_skip_parent_and_keep_grandchild(self):
        collections = [collection("ROOT", "Research"), collection("CHILD", "Child", "ROOT"),
                       collection("GRAND", "Grandchild", "CHILD")]
        config = dict(self.config, included_collections=["ROOT", "GRAND"], include_descendants=False)
        self.assertEqual(journal.selected_collection_keys(config, collections), {"ROOT", "GRAND"})
        config["included_collections"] = ["ROOT"]
        config["include_descendants"] = True
        self.assertEqual(journal.selected_collection_keys(config, collections), {"ROOT", "CHILD", "GRAND"})

    def test_external_link_precedence_and_comment_only_annotation(self):
        self.items[0]["data"]["DOI"] = "doi:10.1234/example.paper"
        self.items[0]["data"]["url"] = "https://publisher.example/article"
        self.items.append(item("ANNOTCOM", "annotation", parentItem="ATTACH01", annotationColor="#ffd400",
                               annotationText="", annotationComment="A comment without a highlight", annotationPageLabel="8",
                               dateAdded="2026-10-14T10:00:00Z", dateModified="2026-10-14T10:00:00Z", tags=[]))
        report, _ = self.build()
        self.assertEqual(next(p for p in report["inventory"] if p["key"] == "PAPERA01")["resource_link"],
                         "https://doi.org/10.1234/example.paper")
        comment = next(entry for entry in report["journal"] if entry["key"] == "ANNOTCOM")
        self.assertEqual(comment["text"], "")
        self.assertEqual(comment["comment"], "A comment without a highlight")
        self.items[0]["data"]["DOI"] = "invalid"
        report, _ = self.build()
        self.assertEqual(next(p for p in report["inventory"] if p["key"] == "PAPERA01")["resource_link"],
                         "https://publisher.example/article")

    def test_configurable_status_tags_and_validation(self):
        config = json.loads(json.dumps(self.config))
        config["status_roles"]["to_read"]["tag"] = "status/to_read"
        report, diagnostics = self.build_with_config(config)
        paper = next(p for p in report["inventory"] if p["key"] == "PAPERA01")
        self.assertEqual(paper["status"]["label"], "To read")
        self.assertEqual(paper["status_tags"], ["status/to_read"])
        self.assertFalse(any("PAPERA01: noncanonical" in warning for warning in diagnostics))
        config["status_roles"]["reading"]["tag"] = "status/to_read"
        with self.assertRaisesRegex(ValueError, "distinct"):
            journal.validate_config(config)
        config["status_roles"]["reading"]["tag"] = "status/reading"
        config["status_roles"]["reading"]["label"] = "Unassigned"
        with self.assertRaisesRegex(ValueError, "cannot be"):
            journal.validate_config(config)
        config["status_roles"]["reading"]["label"] = "Reading"
        config["default_groupers"] = ["month", "week", "day", "paper"]
        self.assertEqual(journal.validate_config(config)["default_groupers"], ["month", "week", "day", "paper"])

    def test_annotation_modified_after_addition_uses_modification_timestamp(self):
        annotation = next(entry for entry in self.items if entry["key"] == "ANNOT001")
        annotation["data"]["dateAdded"] = "2026-10-14T09:00:00Z"
        annotation["data"]["dateModified"] = "2026-10-14T10:00:00Z"
        annotation["data"]["tags"] = [{"tag": "method/simulation"}]
        report, _ = self.build()
        entry = next(entry for entry in report["journal"] if entry["key"] == "ANNOT001")
        self.assertEqual(entry["event_type"], "Annotation modified")
        self.assertEqual(entry["event_at"], "2026-10-14T10:00:00Z")
        event = next(event for event in report["activity"] if event["key"] == "annotation:ANNOT001")
        self.assertEqual(event["annotation_tags"], ["method/simulation"])

    def build_with_config(self, config):
        with patch.object(journal, "get_all", side_effect=lambda route: self.items if route == "/items" else self.collections):
            return journal.build_report(config, date(2026, 10, 14), date(2026, 10, 14))


if __name__ == "__main__":
    unittest.main()
