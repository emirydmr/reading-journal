# Reading Journal

A small, local Python tool that reads the current Zotero library through its local API and writes a self-contained HTML research report. It makes no Zotero changes and keeps no history database.

## Run

1. Open Zotero and enable **Settings → Advanced → Allow other applications on this computer to communicate with Zotero**.
2. From this directory, run `python3 journal.py`.
3. Open `report.html` in a browser. It works offline after generation.

The default report window is the last 30 days. To choose a range:

```bash
python3 journal.py --from 2026-10-01 --to 2026-10-31
```

To choose a different output file:

```bash
python3 journal.py --out /path/to/report.html
```

The current version targets the personal library (`/api/users/0`). It reads items and collections with HTTP GET requests only. It does not read PDF files or full text; annotation text and comments come from Zotero's annotation records.

## Configure

Edit `config.json` before generating a report. The starting scope is research collections **01–05** and their descendants; collection 06 (Research Notes & Framework) is excluded from paper statistics. Empty `included_collections` means all collections. Add Zotero collection keys to limit the scope; `include_descendants` includes child collections recursively. `include_unfiled` controls papers with no active collection when a scope is selected. Memberships referring to deleted collections are ignored.

`annotation_colors` maps Zotero hex colors to journal meanings and descriptions. The six defaults come from the research framework. The complete legend appears in every report. Unknown colors remain visible as “Unmapped” with their original hex code.

`tag_categories` maps category names to prefixes and optional allowlists. The default presets cover `status/*`, `approach/*`, `method/*`, `meeting/*`, and `priority/*`. Put exact tag names in `allowed_tags` to admit only those; an empty list admits every tag with that prefix. Tags outside the configured categories remain in Zotero but are not displayed in the report. The report does not infer tags from article content.

The canonical primary reading tags are `status/to-read`, `status/reading`, and `status/read`; `status/revisit` is supplementary. The actual library currently contains `status/to_read` on one paper. The tool reports that as a command-line warning and does not treat it as `status/to-read` or change Zotero. Multiple primary statuses are also reported as warnings. Missing statuses remain “Unassigned.”

Find the available names and keys with `python3 journal.py --list-collections` and `python3 journal.py --list-tags status/`.

## What the first version means

- The growth line counts selected papers cumulatively by their Zotero `dateAdded`, month by month. It is a current-library view: deleted or moved-out papers cannot be reconstructed.
- The collection pie counts each paper once. Papers in several selected collections appear in a **Multiple collections** slice; their actual memberships remain visible on the paper card. The pie denominator equals the number of selected papers.
- A dated entry is triggered by a paper's `dateAdded` or an annotation's `dateAdded`/`dateModified`. A paper's `dateModified` alone does not create a journal entry because a metadata edit does not establish reading activity.
- Current tags and collection membership are shown for every entry. They are snapshots, not historical states.
- Annotation counts in a dated report refer to annotations whose added or modified date falls in the selected interval.
- The interface is in English. Highlighted source text and annotation comments are displayed separately and kept in their original language.

Run the fixture checks with `python3 -m unittest discover -s tests -v`.

## Next decisions after using this report

The main unresolved choice is the journal's narrative: should a professor-facing report lead with an activity timeline, with themes and questions, or with papers? The current report leads with papers and includes activity signals. A few real uses should decide this before building an editor, scheduler, or database.

Snapshots could later record deliberate report versions when generated, without a background process. That would allow comparisons between runs but would not recover changes made and reverted between runs. A live change log would require a watcher or Zotero plugin and is outside this first version.
