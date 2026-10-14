# Reading Journal

A private, read-only Zotero companion. The local app provides settings and a preview; it exports a single interactive HTML report that works without the app or network assets.

## Open the app

The Apple Silicon build is `dist/Reading Journal.app.zip`. Extract it in Downloads or Applications, then open `Reading Journal.app`. A native control window stays open with **Open Journal**, **Open in Browser**, and **Quit** buttons. **Open Journal** opens the interface in an app window; closing that journal window leaves the control window available. Closing the control window, pressing Command-Q, or using the journal's **Quit** button stops the app and its local server. Keep Zotero open with its local API enabled.

The ZIP is the reliable macOS deliverable. The Documents file provider on this Mac attaches metadata to a loose `.app` copied into the project folder, invalidating its signature. The signed ZIP was verified after extraction outside Documents. This is a private local build, not a notarized public release. If macOS blocks the first launch, Control-click the extracted app and choose **Open**.

To rebuild on this Mac, run:

```bash
sh build_app.sh
```

The script uses Python 3.10, an isolated build environment, PyInstaller, and the native macOS Cocoa interface through PyObjC. It produces and verifies the ZIP under `dist/`. To run the source after building, use `.venv-build-310/bin/python app.py`.

## Use the app

- **Dashboard:** period activity counts; a cumulative Collection Size chart with Month/Day resolution and an exact-date selector; a Papers by Subcollection pie; the annotation colour key; clickable current-status counts; and an expandable collection inventory with search, status filters, tags, and sorting.
- **Activity Feed:** compact events for paper additions and annotation additions or modifications in the selected period. A paper metadata edit alone is not an event.
- **Journal Entries:** one entry per annotation in the selected period, including comment-only annotations. Source quotations and comments stay separate. Toggle and reorder Status, Paper, Annotation category, Collection, Day, Week, and Month groupers; the default is Status → Paper → Category. Day, Week, and Month use the configured report timezone, and weeks run Monday–Sunday. A paper in multiple selected collections belongs to one combined collection group such as “02 + 04.”

**Settings** starts with annotation colors, meanings, and descriptions. The tag editor uses the same two-row layout, with a category color and a separate color for each tag. Any tag can have an optional reading meaning (To read, Reading, Read, or Revisit); status tags use this same editor and can be renamed, recolored, excluded, or removed. Trash icons remove journal definitions. Tags outside the existing prefixes appear under Uncategorized, initially excluded. Existing settings migrate when saved through this editor.

Collections and tag selections use matching foldable trees: checking a parent includes descendants, while unchecking one node leaves its descendants selected. Collection and paper-type lists share aligned panels. Choose the timezone from the searchable dropdown. **Save grouping as default** stores the current Journal Entries grouping. These settings configure the journal; they do not change Zotero records. Tag chips show category color at the edge and individual tag color as a dot.

**Refresh** queries Zotero again. **Export HTML** also refreshes and downloads a self-contained, three-page report. The export omits the app’s settings and Zotero-only links. Paper titles link to a DOI when available, otherwise to the paper URL; neither means plain text. Those optional paper links need the internet, but the report itself does not.

Click the date range under **Reading Journal** to change the visible period. In the app, this reloads Zotero for the new dates. In an exported HTML file, the range can only be narrowed within the dates chosen at export; **Full range** restores that window. The date filter updates all three pages. The Collection Size chart includes a pre-period baseline, then shows cumulative paper additions within the chosen range. Click the line or choose an exact date to update the chart total and pie. Only papers with a paper-addition or annotation event in the exported window are embedded by title in the standalone file; collection-size aggregates remain available for the chart. To see earlier or later activity, make a new export with a wider window.

Settings are stored under `~/Library/Application Support/Reading Journal/config.json` after the first save. Before that, the project’s `config.json` is the seed. The CLI and app then read the same saved settings. The original research framework is untouched; `Research Framework — Application Alignment.md` records the application-specific interpretation.

## Command-line export

```bash
python3 journal.py --from 2026-10-01 --to 2026-10-14 --out report.html
```

The CLI can use `--config /path/to/config.json` to override saved settings. `--list-collections` and `--list-tags status/` show available Zotero names. The library source is the personal local API (`/api/users/0`); only HTTP GET is used. No PDF file or full text is read, and there is no change-history database or background polling.

## Date and status semantics

Collection Size counts papers in the *current* selected collection scope by their original `dateAdded`; the chart does not reconstruct past collection membership. Papers by Subcollection uses the same date cutoff and counts each paper once, with multi-membership in its own slice. Its legend omits the top-level collection name. The Dashboard inventory shows current status and collection membership for papers active in the selected period. Reading-status tags have no reliable assignment date, so **Read** and **Revisit** are never presented as dated events.

Run the checks with `python3 -m unittest discover -s tests -v`, `node tests/test_grouping.js`, and `node tests/test_collection_tree.js`.
