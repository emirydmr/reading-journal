import json
import re
import sys
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
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
        for i, color in enumerate(["#ffd400", "#ff6666", "#5fb236", "#2ea8e5", "#a28ae5", "#f19837", "#123456"]):
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
        self.assertEqual(next(s["count"] for s in report["pie"] if s["name"] == "Multiple collections"), 1)
        self.assertEqual({entry["title"] for entry in report["entries"]}, {"Annotated paper", "New paper"})
        self.assertNotIn("Excluded note collection paper", json.dumps(report))
        self.assertNotIn("Metadata only", json.dumps(report))
        annotated = next(entry for entry in report["entries"] if entry["title"] == "Annotated paper")
        self.assertEqual(annotated["reasons"], ["Annotation added", "Annotation modified"])
        self.assertEqual(annotated["status"]["label"], "Unassigned")
        self.assertEqual(annotated["tags"]["Method"], ["method/simulation"])
        self.assertNotIn("method/unlisted", json.dumps(report))
        self.assertEqual(len(annotated["annotations"]), 7)
        self.assertTrue(all(a["link"].startswith("zotero://open-pdf/library/items/ATTACH01?") for a in annotated["annotations"]))
        self.assertEqual(len(report["color_legend"]), 7)
        self.assertEqual({a["meaning"] for a in annotated["annotations"]},
                         {entry["label"] for entry in report["color_legend"]})
        new = next(entry for entry in report["entries"] if entry["title"] == "New paper")
        self.assertEqual(new["status"], {"label": "Read", "revisit": True})
        self.assertIn("status/read", new["tags"]["Status"])
        self.assertTrue(any("status/to_read" in message for message in diagnostics))
        self.assertTrue(any("conflicting primary statuses" in message for message in diagnostics))

    def test_html_is_self_contained_and_escapes_embedded_data(self):
        report, _ = self.build()
        report["entries"][0]["title"] = "</script><script>alert(1)</script>"
        html = journal.render_html(report)
        self.assertEqual(html.count("<script>"), 1)
        self.assertNotIn("<script>alert(1)</script>", html)
        self.assertNotRegex(html, re.compile(r"<(?:script|link)\b[^>]*(?:src|href)\s*=", re.I))


if __name__ == "__main__":
    unittest.main()
