# Research Framework — Application Alignment

**Working addendum · 14 October 2026**

The original *Master's Research — Research Framework* remains the research and literature-management reference. This addendum records how the Reading Journal application currently interprets it. It does not revise the scientific taxonomy or replace the framework's reflective ambitions.

## 1. Distinguish three kinds of information

The application separates **current library state**, **dated activity**, and **annotation content**.

| Application page | Question answered | Contents |
|---|---|---|
| Dashboard | Which papers had activity in the selected period, and how are they classified now? | Papers added or annotated in range, current collections and reading states, charts, annotation-colour key |
| Activity Feed | What was added or annotated during this period? | Paper-addition and annotation-addition/modification events, without full annotation text |
| Journal Entries | What did I mark or write while reading? | One entry per selected-period annotation; source text and my comment remain separate |

The framework's Section 10 describes a broader *periodic reflection* on developing understanding. That is still valuable, but it is **not** what the application's current “Journal Entries” page claims to provide. Period-level reflections, Zotero child notes, and synthesis across papers are future features. This prevents an annotation list from masquerading as a finished reflective research diary.

## 2. Collection scope and taxonomy

The default report includes research collections 01–05 and their descendants. Collection 06 contains research-management material and is excluded from paper statistics by default. The 3 + 1 intellectual taxonomy still guides classification; the tool does not infer a paper's primary field from its title or abstract.

Collection membership is not forced to be exclusive. A paper genuinely assigned to two selected collections remains one paper. The pie chart counts it in “Multiple collections,” and the Collection grouper gives it one combined group, e.g. “02 + 04.” Neither view silently guesses a primary collection. If the researcher later reduces multi-membership, the report simply reflects that current state.

The Dashboard shows papers with a paper-addition or annotation event in the selected date range. Its growth chart uses their original `dateAdded`, so an older paper annotated this week can appear in an earlier month of the line. This is not a historical record of papers later deleted or moved out of scope.

## 3. Reading-state tags

The default exact tag mapping remains:

| Role | Default tag | Default display |
|---|---|---|
| Not started | `status/to-read` | Gray, “To read” |
| In progress | `status/reading` | Blue, “Reading” |
| First reading completed | `status/read` | Green, “Read” |
| Further examination needed | `status/revisit` | Orange, “Revisit” |

The first three are mutually exclusive in the framework; `status/revisit` is supplementary. The application now lets the researcher edit the exact tag names, labels, and display colours. This **remaps interpretation only**. It does not rename or apply Zotero tags. Conflicting primary states are flagged, and missing or unrecognised states remain visible as such. The existing `status/to_read` is not silently treated as `status/to-read` unless explicitly mapped.

Status and collection membership are current snapshots. Zotero's present tags do not reliably reveal when a paper became “Read,” so the Activity Feed cannot call that a dated reading event. A paper's `dateModified` alone is likewise not evidence of reading.

## 4. Annotation journal and colour meanings

The framework's six PDF annotation categories remain the default language: yellow important information; red criticism/disagreement; green personal insights/ideas; blue questions/uncertainty; purple literature connections; orange methods/technical details. The application lets these labels and descriptions evolve without changing existing annotations. Unknown colours remain visible and are labelled “Unmapped.”

Every selected-period annotation becomes one Journal Entry, including a comment-only annotation. Highlighted source text is presented as an author's passage; the annotation comment is presented separately as the researcher's contribution. Neither is paraphrased or auto-classified. The page can be grouped in any active order of current paper status, paper, annotation category, collection, day, week, and month. Calendar groups use the report timezone; weeks are Monday–Sunday ISO weeks. Its default is Status → Paper → Category.

Annotations added or modified within the selected inclusive dates appear once, even when both timestamps fall in the period. The feed calls them added or modified; the Journal Entries page contains their full text. A newly added paper without an annotation belongs in the Activity Feed, **not** in Journal Entries.

## 5. Tags, sharing, and future work

The editable `approach/*`, `method/*`, `meeting/*`, and `priority/*` category presets are display filters: only tags that both exist and pass the configured prefix/allowlist appear. They do not infer facts from paper text. Reading-state tags are managed separately by the exact role mapping.

The professor-facing HTML is self-contained and does not need Zotero or the app to display. When possible, a paper title links to its DOI, otherwise its bibliographic URL. The export does not use Zotero-only deep links. External paper links may need internet; the report's content and controls do not. Because annotations may contain provisional questions or private criticism, the researcher should review the selected scope and dates before sharing.

The date control under the report title filters all visible pages. A standalone export embeds annotation events only for its original selected dates; it can be narrowed offline but cannot reveal a wider period. The standalone file also omits papers with no activity in its exported window. The local app can request a new date range from Zotero without changing library records.

No library-write feature, background watcher, or change-history database is part of the current application. A later snapshot feature could compare deliberately saved reports without running continuously, but it could not recover changes made and reverted between snapshots. A separate periodic-reflection editor should be considered only after the annotation workflow proves useful in practice.
