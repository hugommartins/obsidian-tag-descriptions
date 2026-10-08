# Bug Log

Record of behavior bugs found in Tag Descriptions: what happened, why, how it was mitigated, and which test guards against it. Lint, type-check and tooling issues are not logged here. Severity levels (S1 to S4) are defined in [TEST_STRATEGY.md](./TEST_STRATEGY.md#11-defect-management).

**Status values:** Open, Fixed, Verified (confirmed in Obsidian and covered by a regression test), Won't fix.

## Summary

| ID | Title | Severity | Status | Found by |
|---|---|---|---|---|
| BUG-001 | Importing the documented backup format crashes the settings tab | S1 | Verified | Code review |
| BUG-002 | Import and load accept invalid data | S2 | Verified | Code review |
| BUG-003 | Stale tooltip appears after the pointer leaves a tag | S3 | Verified | Code review |
| BUG-004 | Alias and other property pills show tag tooltips | S2 | Verified | Code review |
| BUG-005 | Editing a tag can save an empty key | S3 | Verified | Code review |
| BUG-006 | "Set description" appears twice in the context menu | S3 | Verified | Manual test |
| BUG-007 | Tooltips do not work in pop-out windows | S3 | Won't do | Code review |
| BUG-008 | Loading a corrupted tag map discards valid descriptions | S1 | Verified | Automated test run |
| BUG-009 | Difference in hover delay between regular tag and nested tags | S4 | Open | Manual test |
| BUG-010 | Descriptions added via right-click on tags and similar nested tags are not assumed in the settings for the regular tag | S3| Open | Manual test |

## Details

### BUG-001: Importing the documented backup format crashes the settings tab

- **Severity:** S1
- **Status:** Fixed (awaiting verification)
- **Affected:** `src/ui/settingsTab.ts` (import and library rendering)
- **Description:** The README documented a backup file shaped like `{ "tagMap": { ... }, "confirmDelete": true }`, while export actually wrote a flat tag-to-description object. Importing a file in the documented shape added `tagMap` and `confirmDelete` as if they were tags, with an object and a boolean as their "descriptions". The library list then called `.toLowerCase()` on those values and threw, so the settings tab stopped rendering. Because the bad entries were saved to `data.json`, the failure repeated every time the tab was opened.
- **Root cause:** Import merged the parsed JSON straight into the tag map without checking its shape or value types. The README example, which did not match the export format, made the problem easy to trigger.
- **Mitigation:** `sanitizeTagMap` now accepts both the flat format and a `{ tagMap }` wrapper and skips entries that are not valid tag-to-text pairs. Settings loading runs the same sanitization, which repairs a `data.json` that was already corrupted by an earlier import. The README now documents the current export format, `{ tagMap, ignoredTags }`, and states that 1.0.0 flat backups remain importable.
- **Regression tests:**
  - `test/unit/tagUtils.test.ts` › `sanitizeTagMap` › "accepts the { tagMap } wrapper format"
  - `test/unit/tagUtils.test.ts` › `sanitizeTagMap` › "ignores non-tag entries such as confirmDelete"
  - `test/unit/settings.test.ts` › settings loading › "drops corrupted tagMap entries and keeps valid ones"
  - `test/component/settingsTab.test.ts` › import › "imports a backup in the current format"
  - `test/component/settingsTab.test.ts` › import › "imports a 1.0.0 flat backup"

### BUG-002: Import and load accept invalid data

- **Severity:** S2
- **Status:** Fixed (awaiting verification)
- **Affected:** `src/ui/settingsTab.ts`, `src/main.ts`
- **Description:** Neither import nor settings loading validated keys or values. Non-string descriptions, empty descriptions and keys without `#` were all accepted and saved. A `__proto__` key in an imported file could also change the prototype of the tag map through `Object.assign`. Invalid files gave no useful feedback.
- **Root cause:** Trusting external data (an imported file and the stored `data.json`) as already well-formed.
- **Mitigation:** Keys are normalized to `#tag` form, values must be non-empty strings, and invalid entries are skipped and counted. The import notice reports how many entries were imported and skipped. Ignored tags go through the same kind of normalization.
- **Regression tests:**
  - `test/unit/tagUtils.test.ts` › `sanitizeTagMap` › "skips non-string and empty descriptions"
  - `test/unit/tagUtils.test.ts` › `sanitizeTagMap` › "adds a leading # to keys that lack one"
  - `test/unit/tagUtils.test.ts` › `sanitizeTagMap` › "does not let a __proto__ key change the prototype"
  - `test/unit/tagUtils.test.ts` › `sanitizeIgnoredTags` › "drops non-strings, normalizes tags and removes duplicates"
  - `test/component/settingsTab.test.ts` › import › "reports how many entries were imported and skipped"

### BUG-003: Stale tooltip appears after the pointer leaves a tag

- **Severity:** S3
- **Status:** Fixed (awaiting verification)
- **Affected:** `src/main.ts` (hover handling)
- **Description:** The tooltip display was debounced by 50 ms and the pending call was never cancelled when the pointer left the tag. A tooltip could appear after the pointer had already moved away. A longer hover delay would have made this much more visible.
- **Root cause:** Hiding the tooltip did not cancel the pending show.
- **Mitigation:** The debounce was replaced by an explicit timer that hiding the tooltip always cancels. The same timer implements the configurable hover delay.
- **Regression tests:**
  - `test/component/tooltip.test.ts` › hover › "does not show the tooltip if the pointer leaves before the delay elapses"
  - `test/component/tooltip.test.ts` › hover › "hides the tooltip when the pointer leaves the tag"

### BUG-004: Alias and other property pills show tag tooltips

- **Severity:** S2
- **Status:** Fixed (awaiting verification)
- **Affected:** `src/constants.ts`, `src/main.ts`
- **Description:** The tag selector included `.multi-select-pill-content`, which matches pills of any multi-select property (aliases, cssclasses, custom lists). An alias such as `foo` was treated as the tag `#foo` and showed that tag's description.
- **Root cause:** The selector for frontmatter tags was not scoped to the `tags` property.
- **Mitigation:** Pills are accepted only when they sit inside `[data-property-key="tags"]`.
- **Regression tests:**
  - `test/component/tooltip.test.ts` › hover › "ignores pills outside the tags property"
  - `test/component/tooltip.test.ts` › hover › "shows a tooltip for pills inside the tags property"
  - Manual check against a note with `aliases`, `cssclasses` and `tags`.
- **Note:** The `data-property-key` attribute comes from Obsidian's current Properties DOM and has not yet been confirmed on every supported version. Include it in the smoke checklist.

### BUG-005: Editing a tag can save an empty key

- **Severity:** S3
- **Status:** Fixed (awaiting verification)
- **Affected:** `src/ui/settingsTab.ts` (edit row)
- **Description:** In the library edit row, clearing the tag name (or entering only `#`) produced an empty string after normalization. The edit saved without a check, creating an entry with an empty key.
- **Root cause:** The add form validated tag length, but the edit row validated only the description.
- **Mitigation:** The edit row now rejects tags shorter than two characters, matching the add form.
- **Regression tests:**
  - `test/component/settingsTab.test.ts` › edit › "rejects an empty tag name"
  - `test/component/settingsTab.test.ts` › edit › "rejects a tag name that is only #"

### BUG-006: "Set description" appears twice in the context menu

- **Severity:** S3
- **Status:** Fixed (awaiting verification)
- **Affected:** `src/main.ts` (`addTagMenuItem`)
- **Description:** Right-clicking a tag in the editor showed two "Set description for #tag" items.
- **Root cause:** Both the `editor-menu` and `tag-menu` events fire for a right-click on a tag in the editor, and each handler added an item.
- **Mitigation:** An item is added only once per click: a flag set for the current event dispatch, plus a check of the menu's item list for an existing entry with the same title.
- **History:** The first fix tracked menus in a `WeakSet`, assuming both events share one menu object. The user confirmed the duplicate still appeared, so that assumption was wrong. The current fix does not depend on menu identity.
- **Regression tests:**
  - `test/component/contextMenu.test.ts` › context menu › "adds a single Set description item when both editor-menu and tag-menu fire"
  - `test/component/contextMenu.test.ts` › context menu › "adds a single Set description item when the two events carry different menu objects"
  - Manual check in Live Preview, Source mode, Reading view and the tag pane.
- **Note:** The item-list check reads an internal property of Obsidian's menu; the same-dispatch flag keeps working if that property disappears.

### BUG-007: Tooltips do not work in pop-out windows

- **Severity:** S3
- **Status:** Open
- **Affected:** `src/main.ts` (`registerHoverEvents`)
- **Description:** Tags in a note opened in a pop-out window never show a tooltip. The same limitation existed in 1.0.0 and is documented in the README.
- **Root cause:** Hover and keyboard listeners are registered once, on the main window's `document` at load. A pop-out window has its own document.
- **Mitigation (proposed):** Register the listeners for each window as it opens (using the `window-open` workspace event) and for pop-out windows that already exist at load. Update the README limitation when fixed.
- **Regression tests:**
  - `test/component/tooltip.test.ts` › windows › "shows the tooltip for a tag in a pop-out window" (`it.todo`)
  - Manual check: open a note in a pop-out window and hover a described tag in both Hover and modifier modes.

### BUG-008: Loading a corrupted tag map discards valid descriptions

- **Severity:** S1
- **Status:** Fixed (awaiting verification)
- **Affected:** `src/utils/tagUtils.ts` (`sanitizeTagMap`), `src/settings.ts` (settings loading)
- **Description:** A `data.json` damaged by the 1.0.0 import bug (BUG-001) can contain the entries `tagMap` and `confirmDelete` next to real tags, inside the saved tag map. The repair added for BUG-001 ran the saved map through `sanitizeTagMap`, which treats any object with a `tagMap` key as a backup wrapper and reads only that key. Loading such a file would have kept the nested value and dropped every valid description beside it.
- **Root cause:** One function served two inputs with different shapes: an imported file (flat map or wrapper) and the stored tag map (always flat). The wrapper detection was wrong for the second.
- **Mitigation:** Added `sanitizeFlatTagMap`, which never looks for a wrapper, and used it for the stored map. `sanitizeTagMap` remains for imported files and delegates to it.
- **Found by:** The first run of the automated test suite, through the settings-loading test written for BUG-001. It was introduced by the BUG-001 fix and never shipped.
- **Regression tests:**
  - `test/unit/settings.test.ts` › settings loading › "drops corrupted tagMap entries and keeps valid ones"
  - `test/unit/tagUtils.test.ts` › `sanitizeFlatTagMap` › "treats a key named tagMap as an invalid entry, not as a wrapper"

### BUG-009: Difference in hover delay between regular tag and nested tags

- **Severity:** S4
- **Status:** Open
- **Affected:** files or areas
- **Description:** Having a regular tag and a nested tag on read and live view produce a difference in the hover delay for the description to appear, with the nested tag having a higher delay. Likely related to BUG-010, see entry below for more information
- **Root cause:** Why it happens.
- **Mitigation:** What was changed, or the proposed change.
- **Found by:** Manual tests on the live preview
- **Regression tests:** File path and describe and test names of the tests that prevent it from returning, plus any manual check.

### BUG-010: Descriptions added via right-click on tags and similar nested tags are not assumed in the settings for the regular tag

- **Severity:** S3
- **Status:** Open
- **Affected:** files or areas
- **Description:** Adding the tag for `tag` and for `tag/nested` via right click on the editor works at first glance if the user open the description setting page the `tag` description does not exist. Adding via settings for both will not cause any problems
- **Root cause:** Why it happens.
- **Mitigation:** What was changed, or the proposed change.
- **Found by:** Manual tests
- **Regression tests:** File path and describe and test names of the tests that prevent it from returning, plus any manual check.

## Template for new entries

```
### BUG-NNN: Short title

- **Severity:** S1 | S2 | S3 | S4
- **Status:** Open | Fixed (awaiting verification) | Verified | Won't fix
- **Affected:** files or areas
- **Description:** What the user sees or what goes wrong, with steps to reproduce.
- **Root cause:** Why it happens.
- **Mitigation:** What was changed, or the proposed change.
- **History:** Earlier attempts that failed, if any.
- **Regression tests:** File path and describe and test names of the tests that prevent it from returning, plus any manual check.
```

Add the row to the summary table. Name the tests after the behavior, and record them here.