# V1 audit, 2026-09-28

Authority: attached V9 TXT, especially sections 36, 39-43. The later V1 contract overrides earlier AI/translation ideas. This is a source audit and regression-fix pass, not certification that every V1 acceptance criterion passes.

## Confirmed defects corrected

| Area | Defect | Correction |
| --- | --- | --- |
| Home | Topic chips were spans, not controls | Real search links |
| Home | Work query was readonly with fabricated counts | Search form and counts derived from results |
| Home/topics | No empty state | Explicit empty results |
| Search | Full query treated as one substring | All query terms matched against title, text and metadata |
| Public | Storage errors silently showed seed content | Error boundary with retry; no false data |
| Article | Images emitted as text with nonexistent paths | Stored R2 URLs and image reader with vector overlays and zoom |
| Article | Table of contents did not navigate | Anchors linked to actual heading IDs |
| Cards | Published incorrectly called Verified | Correct Published status |
| Language | Switching language always returned home | Preserve current page path |
| About | Source JSON ignored; placeholder identity/timeline | Read profile/timeline data, omit invented placeholder milestones/contact links |
| Admin | Draft/Published/Recent panels were static text | D1-backed lists opening specific drafts |
| Draft | Reload generated a different article | Load by stable ID, recover per-article unsynced local copy |
| Autosave | Boolean dirty dependency missed later changes | Subscribe to document changes and debounce each edit |
| Autosave | Old response could mark newer changes saved | Snapshot-aware acknowledgement and serialized writes |
| Publish | Did not await save | Await latest save and show errors/success link |
| Publish | Editing could remove published article | Independent published snapshot, preserved on draft saves |
| Canvas | Object drag also moved stage camera | Stage event target guard |
| Canvas | Transformer attached to wrong image group | Attach to actual positioned image node |
| Canvas | Fixed stage size, fixed note insertion position | ResizeObserver and canvas-relative pointer coordinates |
| Canvas | Text editing only in inspector | Double-click textarea overlay |
| Canvas | Image toolbar/arrow tool not functional | File input and arrow creation/selection |
| Canvas | Keyboard undo/delete absent | Undo/redo, delete, Escape, save keyboard handlers |
| Sections | Moving section left members behind | Move members in same history action |
| Sections | Deleting section left invalid references | Preserve contents as unsectioned objects |
| Annotation | Drag bubbled into image position update | Stop bubbling; rectangle selection, handles and properties |
| Reader | Preview and manual order controls absent | Preview, auto/manual choice, reorder controls |
| Converter | Non-transitive row comparator | Stable row grouping before x ordering |
| Converter | New objects disappeared in manual mode | Append missing objects deterministically |
| Converter | Multiline notes lost quote formatting | Prefix each line |
| Stack | react-konva allowed unintended upgrades | Exact 19.2.1 pin |

## Verification

- Nine executable regression cases cover conversion, section movement/deletion, reload identity, stale preview cleanup and save acknowledgement races.
- TypeScript and production build checked.
- Live D1 binding and articles/assets table presence confirmed through Sites. This is not an end-to-end persistence test.
- Browser interaction/visual QA blocked: managed preview service unavailable. No claim of browser acceptance-test completion.

## Still open against TXT

- Section board mode, board snapshot derivatives and server-side annotated-image derivatives for portable Markdown (42.8, 42.13, 42.23). Web vector overlays work; portable Markdown currently references optimized source images, not flattened annotations.
- Full annotation toolset (arrow, text, freehand) and direct drawing gestures. Current editable tool is rectangle.
- Object copy/paste, snapping/guides, broader canvas performance tuning and complete section grouping interaction.
- Full metadata inspector, dedicated Vendor/Technology/Content Type filter controls, complete dictionary coverage and richer reader markdown support.
- Image upload failure recovery across browser restart: uploaded assets persist; in-flight blob previews cannot survive a restart. Original and optimized uploaded files remain in R2.
- Actual author name, career history and contact URLs were not provided. No links or personal history fabricated.
- Runtime D1/R2 reload tests, desktop/mobile visual checks and full V1 acceptance suite still require a working preview/browser environment.
- Framework root wrappers remain for Sites compatibility; knowledge application scripts are under web/scripts.

No AI, translation generation, admin authentication or other V2 functionality was added. The site remains owner-private; it is not ready for anonymous public admin access.
