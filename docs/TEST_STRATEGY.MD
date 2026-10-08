# Test Strategy

| | |
|---|---|
| **Project** | Tag Descriptions (Obsidian plugin) |
| **Status** | Phases 1 and 2 implemented; phase 3 pending |
| **Last updated** | 2026-10-08 |
| **Applies to** | 1.1.0 and later |

## 1. Purpose and scope

This document defines how Tag Descriptions is verified before each release: what is tested, at which level, with which tools, and what must pass before a version is tagged.

In scope:

- Plugin logic: tag normalization, description resolution (including parent inheritance), settings loading and validation, import and export, vault tag discovery.
- Plugin behavior: tooltip triggers (hover, delay, modifier key), context menu, settings tab, modals.
- Build, type-check and lint health of the repository.
- Compatibility with the minimum supported Obsidian version and the current release.

Out of scope:

- Obsidian itself and other plugins.
- Mobile platforms (the plugin is `isDesktopOnly`). Revisit when mobile support is built.
- Load or security testing beyond the data-handling checks in section 4.

## 2. Product under test

| Module | Responsibility | Testability today |
|---|---|---|
| `src/utils/tagUtils.ts` | `formatTag`, `sanitizeTagMap`, `sanitizeFlatTagMap`, `sanitizeIgnoredTags`, `resolveDescription`, `getTooltipText` | Pure |
| `src/utils/backup.ts` | `createBackup`, `mergeBackup`, `describeImport` | Pure |
| `src/utils/tooltipUtils.ts` | `isModifierHeld`, `computeTooltipPosition` | Pure |
| `src/utils/vaultUtils.ts` | `collectVaultTags`, `getTagAtCursor` | Depends on Obsidian objects; stubbed |
| `src/settings.ts` | Settings types, defaults, `normalizeSettings`, `isOneOf` guard | Pure |
| `src/main.ts` | Plugin lifecycle, settings load and save, hover and keyboard events, tooltip rendering, context menu | DOM and Obsidian dependent |
| `src/ui/settingsTab.ts` | Add form, library, missing list, ignored list, preferences, import and export | DOM and Obsidian dependent |
| `src/ui/modals.ts` | Quick-add and delete-confirm modals | DOM and Obsidian dependent |
| `styles.css` | Tooltip and settings styling | Manual only |
| `data.json` (per vault) | Persisted settings: `tagMap`, `ignoredTags`, `confirmDelete`, `inheritFromParents`, `triggerMode`, `hoverDelayMs`, `modifierKey` | Covered through load and save tests |

## 3. Quality goals and risks

Risks drive where test effort goes. Ordered by impact.

| # | Risk | Impact | Primary mitigation |
|---|---|---|---|
| R1 | User descriptions are lost or corrupted (bad import, bad settings migration, overwrite) | High | Unit tests on `sanitizeTagMap` and settings loading; import and export round-trip tests |
| R2 | Settings tab or plugin crashes on malformed data | High | Unit tests with hostile inputs; regression test for the import crash |
| R3 | Wrong or stale tooltip (wrong tag, shown after leaving, stuck after key release) | Medium | Component tests with fake timers; manual checks in Live Preview and Reading view |
| R4 | Tooltips appear on non-tag elements (for example alias pills) | Medium | Component test on the tags-property scoping |
| R5 | Obsidian API drift breaks internal-API usage (`getClickableTokenAt`, `tag-menu`, menu `items`) | Medium | Guards in code, manual smoke on the latest Obsidian each release |
| R6 | Slow settings tab on large vaults (the missing-tags scan runs on every open) | Medium | Manual performance check against a large generated vault |
| R7 | Duplicate or missing context menu items | Low | Component test on `editor-menu` plus `tag-menu` firing together |

## 4. Test levels

### 4.1 Static analysis

- `npx tsc --noEmit` must pass.
- `npm run lint` (ESLint with `eslint-plugin-obsidianmd`) must pass with zero errors.
- `npm run build` must produce `main.js`.

These run in CI on every push and pull request, and locally before tagging.

### 4.2 Unit tests

Tool: [Vitest](https://vitest.dev). It runs TypeScript directly and needs no extra transpile step.

Scope: pure functions and data handling. The `obsidian` npm package ships types only, so tests that import it at runtime need a stub, resolved with a Vitest alias to `test/mocks/obsidian.ts`.

Target: at least 90 percent line, branch, function and statement coverage on `tagUtils.ts`, `backup.ts`, `tooltipUtils.ts` and `settings.ts`, enforced by thresholds in `vitest.config.mts`.

### 4.3 Component tests

Tool: Vitest with the `jsdom` environment and the Obsidian stub.

Scope: DOM behavior of the plugin without a running Obsidian: tooltip show, hide and positioning; hover and keyboard events; mode switching; context menu item registration; settings tab rendering and interactions. Use fake timers for delay behavior.

The stub only needs the surface the plugin uses (`Plugin`, `PluginSettingTab`, `Setting`, `Modal`, `Menu`, `Notice`, `Platform`, `debounce`, `getAllTags`, plus Obsidian's DOM helpers such as `createEl`, `createDiv`, `empty`, `addClass`, `setText`). Keep the stub small and put it in one file.

No target percentage for this level. Success is that every behavior listed in section 5 has at least one test.

### 4.4 Manual and exploratory testing in Obsidian

Some behavior only exists inside real Obsidian: Live Preview tag rendering, the Properties view, theme styling, the internal events behind the context menu. Use the checklist in section 8 against a prepared test vault (section 7).

### 4.5 Automated end-to-end (optional, later)

[`wdio-obsidian-service`](https://github.com/jesse-r-s-hines/wdio-obsidian-service) can drive a real Obsidian instance. Adopt it only if manual regression becomes a bottleneck. It is not required for any release gate in this document.

## 5. Coverage by feature

Level key: **U** unit, **C** component, **M** manual.

### Feature map

Every feature has a stable ID, a section below, and named test files. New features get the next ID and a row here (see [section 15](#15-extending-the-strategy)).

| ID | Feature | Section | Unit tests | Component tests | Smoke item |
|---|---|---|---|---|---|
| F1 | Tag normalization | 5.1 | `tagUtils.test.ts` | | |
| F2 | Backup import and export | 5.2 | `tagUtils.test.ts`, `backup.test.ts` | `settingsTab.test.ts` (import, export) | 8 |
| F3 | Parent inheritance | 5.3 | `tagUtils.test.ts` | `tooltip.test.ts`, `settingsTab.test.ts` | 6 |
| F4 | Settings loading | 5.4 | `settings.test.ts` | | 2 |
| F5 | Missing descriptions and ignore list | 5.5, 5.8 | `vaultUtils.test.ts` | `settingsTab.test.ts` (missing descriptions) | 7 |
| F6 | Tooltip triggers and placement | 5.6 | `tooltipUtils.test.ts` | `tooltip.test.ts` | 4, 5 |
| F7 | Context menu | 5.7 | `vaultUtils.test.ts` (`getTagAtCursor`) | `contextMenu.test.ts` | 3 |
| F8 | Settings tab (add, library, preferences) | 5.8 | | `settingsTab.test.ts` | 7, 8 |
| F09 | Mobile support (roadmap) | 16.2 | planned | planned | planned |
| F10 | Styling options (roadmap) | 16.3 | planned | planned | planned |

### 5.1 Tag normalization (`formatTag`)

| Case | Level |
|---|---|
| `tag`, `#tag`, ` tag `, `##tag` all normalize to `#tag` | U |
| Empty string and `#` alone return an empty string | U |
| Nested tag `a/b` becomes `#a/b` | U |
| Characters outside the leading position (`a#b`) behave as documented (all `#` removed) | U |

### 5.2 Map sanitization, import and export (`sanitizeTagMap`, `sanitizeIgnoredTags`)

The backup format is `{ "tagMap": { ... }, "ignoredTags": [ ... ] }`. Version 1.0.0 backups (a flat tag-to-description object) must remain importable.

| Case | Level |
|---|---|
| Current format `{ tagMap, ignoredTags }` is accepted | U |
| Flat 1.0.0 map is accepted; keys without `#` are normalized | U |
| `ignoredTags`: non-array becomes empty; non-strings dropped; entries normalized to `#tag`; duplicates removed | U |
| Export contains both `tagMap` and `ignoredTags` | C |
| Import merges ignored tags with the existing list (union, no duplicates) | C |
| A file containing only `ignoredTags` imports successfully | C |
| Non-string, empty and whitespace-only descriptions are skipped and counted | U |
| Entries such as `"confirmDelete": true` do not become tags | U |
| `null`, arrays, strings, numbers return an empty map | U |
| Keys `__proto__`, `constructor`, `toString` do not pollute prototypes or crash | U |
| Descriptions are trimmed | U |
| Import notice reports imported and skipped counts | C |
| Import with invalid JSON shows an error and leaves data unchanged | C |
| Export followed by import in a clean state reproduces the same descriptions and ignored tags (round trip) | C |
| Import overwrites existing tags, as documented | C |

### 5.3 Description resolution (`resolveDescription`)

| Case | Level |
|---|---|
| Own description wins over any parent | U |
| `#a/b/c` falls back to `#a/b`, then `#a`; nearest ancestor wins | U |
| Inheritance off returns nothing for undescribed tags | U |
| Tag without `/` and undescribed returns nothing | U |
| Edge shapes (`#/x`, trailing `/`, deep nesting) never loop or throw | U |
| `source` identifies the tag the description came from | U |

### 5.4 Settings loading

| Case | Level |
|---|---|
| Missing `data.json` (null) yields defaults | U |
| Pre-1.1 data (only `tagMap` and `confirmDelete`) loads with defaults for new fields | U |
| Invalid `triggerMode` or `modifierKey` falls back to defaults | U |
| `hoverDelayMs` is clamped to 0 to 1000; `NaN`, strings and `Infinity` fall back | U |
| `ignoredTags` is deduplicated, normalized and filtered; non-array falls back to empty | U |
| Corrupted `tagMap` values (numbers, objects) are dropped, valid ones kept | U |
| Defaults are not shared between loads (no shared mutable `tagMap` or `ignoredTags`) | U |

### 5.5 Vault tag discovery (`collectVaultTags`)

| Case | Level |
|---|---|
| Counts notes, not occurrences (a tag used twice in one note counts once) | U |
| Notes with no cache or no tags are skipped | U |
| Inline and frontmatter tags are both counted | U, M |
| Result on a vault of 5,000 notes completes within the budget in section 9 | M |

### 5.6 Tooltip behavior

| Case | Level |
|---|---|
| Hover on a described tag shows the tooltip after `hoverDelayMs`; delay 0 shows immediately | C |
| Leaving the tag before the delay elapses cancels the pending show | C |
| Moving between child elements of the same tag does not hide or flicker the tooltip | C |
| Tag without a description (own or inherited) shows nothing and hides any visible tooltip | C |
| Inherited description appends the "(inherited from ...)" line; own description does not | C |
| Pills outside the `tags` property are ignored; pills inside it work | C |
| Modifier mode: nothing shows without the key; showing on `keydown` while hovering; hiding on `keyup`; hiding on window blur | C |
| Modifier mapping: `mod` uses Ctrl on Windows and Linux, Cmd on macOS; `alt` and `shift` as named | C |
| Switching mode or modifier hides any visible tooltip | C |
| Positioning: placed above the tag, flips below when there is no room, clamped to viewport edges | C |
| Plugin unload removes the tooltip element and clears timers | C |
| Tooltip is readable in light and dark themes and with a community theme | M |

### 5.7 Context menu

| Case | Level |
|---|---|
| Right-click on a tag adds one "Set description" item | C, M |
| Both `editor-menu` and `tag-menu` firing for one click produces exactly one item | C, M |
| No item on non-tag text | C, M |
| Saving from the modal stores the description; empty input is rejected | C |
| Item works in Live Preview, Source mode, Reading view and the tag pane | M |

### 5.8 Settings tab

| Case | Level |
|---|---|
| Add form rejects invalid tag, empty description and duplicates; Enter key submits | C |
| Character counter and 100-character limit | C |
| Edit renames a tag, preserves list order, rejects empty or duplicate names | C |
| Delete asks for confirmation when enabled and deletes immediately when disabled | C |
| Search filters by tag and by description text | C |
| Missing list excludes described tags, ignored tags and tags covered by inheritance | C |
| Missing list is sorted by usage count, then name; shows 50 with a working show-all toggle | C |
| Ignore removes a tag from the missing list; restoring returns it; ignored tags persist across reloads | C |
| Trigger options swap between delay slider and modifier dropdown without clearing other inputs | C |
| Toggling inheritance updates the missing list | C |

## 6. Regression suite

Every behavior bug that reaches a user or is found in review gets a test at the lowest level that reproduces it. Tests are named after the behavior they verify, in the same style as every other test, not after the bug.

The link between a bug and its tests lives in [BUG_LOG.md](./BUG_LOG.md): each entry lists the test file and the describe and test names that guard against it, plus any manual check. When a bug is fixed, the entry is updated with the tests in the same pull request.

Hardening that has no observed bug behind it (the guard around the internal editor API, fresh defaults on every settings load) is tested through sections 5.4 and 5.7 but is not logged as a bug.

## 7. Test environment and data

### 7.1 Tooling

- Node.js 20, matching CI.
- Pin `typescript` and `obsidian` to specific versions instead of `latest`, so type-check and lint results are reproducible.

### 7.2 Test vault

A small vault kept outside the repo or under `test-vault/` (without `.obsidian/workspace.json`) containing:

- Notes using inline tags, frontmatter tags and nested tags (`#project`, `#project/alpha`, `#project/alpha/beta`).
- Case variants (`#Project` and `#project`) to document the case-sensitive behavior.
- Frontmatter with `aliases`, `cssclasses` and `tags` to verify pill scoping.
- A note with the same tag many times, and a note with no tags.
- Very long and very short descriptions, and descriptions with line breaks and special characters.

A generated large vault (script that writes 5,000 notes with random tags) is used only for the performance check.

### 7.3 Import fixtures

Current-format file, 1.0.0 flat file, file with only `ignoredTags`, file with mixed valid and invalid entries, empty object, array, invalid JSON, file with `__proto__` key.

## 8. Manual smoke checklist (per release)

Run on the current Obsidian release, and on the minimum supported version (1.5.0) at least for items 1 to 6. One operating system per release; rotate Windows, macOS and Linux across releases.

1. Fresh install of the built `main.js`, `manifest.json`, `styles.css`: plugin enables without console errors.
2. Upgrade from the previous release with an existing `data.json`: all descriptions and preferences intact.
3. Right-click a tag in Live Preview: one "Set description" item; saving shows a tooltip on hover.
4. Hover a tag in Reading view, Live Preview, the tag pane and the Properties view: tooltip appears with the expected delay.
5. Switch to modifier mode: no tooltip without the key; tooltip while the key is held over a tag; gone after release; gone after Alt-Tab away.
6. Nested tag without its own description shows the parent description with the inherited line; turning inheritance off removes it.
7. Settings: missing list shows undescribed tags; add one from the list; ignore one; restore it.
8. Export, delete a description, import: description returns. Import a deliberately broken file: friendly error, no data change.
9. Light and dark theme, plus one popular community theme: tooltip and settings readable.
10. Disable and re-enable the plugin: no leftover tooltip element, no console errors.
11. Performance (once per release or when scanning code changes): settings tab opens on the large generated vault within the budget in section 9.

## 9. Entry and exit criteria

**Entry** (testing a release candidate starts when):

- All planned changes are merged.
- `tsc`, lint and build pass.

**Exit / release gate** (a version is tagged only when):

- `tsc --noEmit`, `npm run lint`, `npm run build` and `npm test` are green in CI.
- Coverage thresholds in section 4.2 are met.
- The manual smoke checklist (section 8) is complete with no failures.
- No open defects of severity S1 or S2.
- `manifest.json` and `package.json` versions match the tag, and the tag has no `v` prefix.
- README and the roadmap reflect the release.

**Performance budget:** the settings tab opens in under 1 second on a 5,000-note vault. Measure it once the large generated vault exists and record the result in the release notes.

## 10. Compatibility matrix

| Dimension | Values |
|---|---|
| Obsidian version | Minimum supported (1.5.0), current release |
| Operating system | Windows, macOS, Linux (one per release, rotating) |
| Editor mode | Live Preview, Source mode, Reading view |
| Tag locations | Inline tags, frontmatter tags (Properties view), tag pane |
| Theme | Default light, default dark, one community theme |
| Window | Main window (pop-out windows are unsupported and documented as a limitation) |

## 11. Defect management

| Severity | Definition | Example |
|---|---|---|
| S1 | Data loss, crash, or plugin fails to load | Import wipes descriptions |
| S2 | A documented feature does not work | Modifier mode never shows tooltips |
| S3 | Wrong behavior with a workaround, or incorrect text | Tooltip shows slightly late |
| S4 | Cosmetic | Misaligned button in settings |

Each defect is filed as a GitHub issue with Obsidian version, OS, steps and the plugin version, and recorded in [BUG_LOG.md](./BUG_LOG.md) with its description, root cause and mitigation. Fixes for S1 and S2 require a regression test before merge, recorded in the bug entry.

## 12. Phased plan

| Phase | Content | Done when |
|---|---|---|
| 1 | Add Vitest, the Obsidian stub, prerequisites from section 12, unit tests for sections 5.1 to 5.4 and the regression set | `npm test` green in CI; coverage target met on pure modules. **Implemented** |
| 2 | Component tests for sections 5.5 to 5.8 | Every row in section 5 marked C has a test. **Implemented** |
| 3 | Test vault, manual checklist adopted in the release process, performance check | One release shipped using the full gate |
| 4 (optional) | Automated end-to-end with `wdio-obsidian-service` for the highest-risk manual items | Manual checklist items 3 to 5 automated |
| Ongoing | Every roadmap feature ships with its tests, following [section 15](#15-extending-the-strategy) | The feature's definition of done is met before merge |

## 14. Decisions

| Topic | Decision | Consequence for testing |
|---|---|---|
| Ignore list in backups | Included. The export format is `{ tagMap, ignoredTags }`; 1.0.0 flat files stay importable. | Round-trip, merge and legacy-format tests in section 5.2. |
| Tag matching | Stays case-sensitive by design and is documented as such. | Section 7.3 keeps case-variant notes to document the behavior; no migration tests needed. |
| Missing-tags scan | Run on demand each time the settings tab opens, without caching. The scan reads Obsidian's in-memory metadata cache, so it is cheap and always current. | The 1-second budget in section 9 is the trigger to revisit: if the measurement on the large vault exceeds it, add caching invalidated by metadata changes, and add tests for the invalidation. |
| Tests ship with the feature | A feature is not done until its unit and component tests, smoke-checklist entry, strategy section, README and bug-log updates are in the same pull request. | Section 15 defines the checklist; reviewers reject features without it. |
| Pure logic first | New behavior is written as a pure function in `src/utils/` or `src/settings.ts` where possible, with the UI as a thin layer on top. | Most new tests are unit tests; component tests cover wiring only. |

Open questions for planned features are listed in [section 16](#16-planned-features-test-plans) and must be decided before the feature starts. Nothing is open for the current feature set.

## 15. Extending the strategy

The strategy grows with the plugin through a fixed routine, so a new feature never needs a new test philosophy. It needs a section, a few tests and a checklist line.

### 15.1 Definition of done for a feature

A feature pull request is complete only with all of these:

1. **Spec:** a new subsection in section 5 (copy the template in 15.4), a new row in the feature map, and the next free feature ID.
2. **Pure logic extracted:** behavior that does not need the DOM or Obsidian lives in `src/utils/` or `src/settings.ts`, with its own test file named after the module.
3. **Unit tests** for every rule in the spec, including empty, malformed and boundary inputs.
4. **Component tests** for the wiring: the control or event that triggers it, the visible result, and what is saved to `data.json`.
5. **Persistence:** if the feature adds a setting, it is covered by the checklist in 15.2.
6. **Stub:** any new Obsidian API is added to `test/mocks/obsidian.ts` in the same change.
7. **Coverage:** any new pure module gets a threshold entry in `vitest.config.mts` (90 percent, as for the existing pure modules).
8. **Smoke checklist:** a line added to section 8 for anything only checkable in real Obsidian.
9. **Docs:** README feature list and roadmap, [TESTING.md](./TESTING.md) layout if files were added, and [BUG_LOG.md](./BUG_LOG.md) for any bug found along the way.
10. **Green gate:** `tsc`, lint, tests with coverage and build pass in CI.

### 15.2 Checklist: a new setting

Most roadmap items add settings. Each one needs tests for:

| Aspect | Level |
|---|---|
| Default value is present in `DEFAULT_SETTINGS`, and old `data.json` files without it load with that default | U |
| `normalizeSettings` rejects wrong types and unknown values, and clamps numbers | U |
| Mutable defaults (arrays, objects) are not shared between loads | U |
| The control renders with the saved value | C |
| Changing the control saves to `data.json` and updates `plugin.settings` | C |
| The change takes effect without reloading the plugin, and hides or refreshes any visible tooltip | C |
| Dependent controls appear and disappear correctly, without clearing other inputs | C |
| Backup decision recorded: included in export and import, or deliberately excluded and documented | U, C |
| Invalid imported values for it are skipped or repaired | U |

### 15.3 Which tests a change needs

| Kind of change | Required tests |
|---|---|
| New pure rule (parsing, resolution, calculation) | Unit tests with edge and hostile inputs |
| New setting | Checklist 15.2 |
| New element or event the plugin listens to | Component tests for match, no match, and cleanup on unload |
| New settings-tab section or list | Component tests for render, empty state, each action, persistence across reload |
| New menu item or command | Component tests for presence, absence, no duplicates, and the action |
| New use of an Obsidian API | Stub support, a guard for missing or changed APIs with a test for the missing case, a smoke-checklist line |
| New tag source or tag-detection rule | Unit tests for normalization, component test for the selector, case-variant and nesting cases, a Properties or editor check in the smoke checklist |
| Bug fix | Failing test first, bug-log entry with the test names |
| Change to a default | Update the tests that assert it, note it in the release notes |
| Change to the backup format | Importing the previous format still works; round trip test; README updated |

### 15.4 Section template for a new feature

```
### 5.N Feature name (Fn)

Spec in one or two sentences. Link to the roadmap item.

| Case | Level |
|---|---|
| Happy path | U or C |
| Empty and boundary inputs | U |
| Malformed or hostile input | U |
| Persistence and reload | C |
| Interaction with existing features (inheritance, ignore list, modes) | C |
| What can only be checked in Obsidian | M |

Decisions and open questions:
- ...
```

### 15.5 Structure rules that keep the suite scalable

- One test file per source module (`src/utils/foo.ts` has `test/unit/foo.test.ts`), and one component test file per user-facing area. Split a component file when it passes roughly 400 lines or covers two areas.
- Shared helpers go in `test/helpers.ts`. When a feature needs many helpers, add `test/helpers/<feature>.ts` and re-export from `helpers.ts`.
- The Obsidian stub stays a single file until it exceeds about 500 lines; then split it into `test/mocks/obsidian/*.ts` behind an `index.ts` with the same exports, so no test imports change.
- Features that interact are tested together in the feature added later. For example the progress bar test covers inheritance and the ignore list, because they change the numbers.
- Logic shared by two screens lives in one function with one set of tests, and both screens call it. Do not duplicate a rule in the UI.

### 15.6 When the scope changes

- Moving something out of the out-of-scope list (section 1) requires updating sections 1, 10 (compatibility matrix), 8 (smoke checklist) and 9 (exit criteria) in the same pull request.
- Dropping a feature removes its tests and its row from the feature map. Do not leave skipped tests behind.

## 16. Planned features: test plans

Test plans for the remaining roadmap items, written before implementation so the design leaves room for them. They are drafts: each one lists prerequisites, cases that will move into section 5 when the feature is built, and questions to settle first.

### 16.1 Mobile support

The plugin is desktop-only today because the tooltip depends on hover, modifier keys and Electron-era behavior. Mobile changes the trigger model, so it is the largest test addition.

**Prerequisites**

- Add `isMobile` to the `Platform` stub, and a helper to dispatch pointer and touch events.
- Decide the mobile trigger (tap, long press, or a tap on a tag opening a small popover) and write it as a pure state machine where possible, for example `decideTouchAction(events, thresholds)`, so the gesture rules are unit tested.
- Set `isDesktopOnly` to `false` in `manifest.json` only when the checklist below passes.

| Case | Level |
|---|---|
| Gesture rules: tap versus long press versus scroll, thresholds, cancel on move | U |
| Tap or long press on a described tag shows the description; elsewhere hides it | C |
| Hover and modifier handlers do not run on mobile; the modifier option is hidden from settings | C |
| Tooltip dismisses on outside tap, scroll and window blur | C |
| Positioning with a small viewport and with the on-screen keyboard open | U, M |
| Context menu entry reachable through the mobile long-press menu | C, M |
| Settings tab usable on a narrow screen: add form, library, missing list, import and export | M |
| Import and export work on mobile (file picker, share sheet) or have a documented alternative | M |
| Settings and descriptions sync between desktop and mobile through Obsidian Sync without corruption | M |
| No desktop-only API is called at load on mobile (no crash on enable) | C, M |

Compatibility matrix additions: Obsidian mobile on iOS and on Android, one phone and one tablet size. Smoke checklist additions: enable and disable, show a tooltip, add a description, restart. Check whether the end-to-end service in section 4.5 can emulate mobile before relying on real devices for every release.

Open questions: the mobile gesture; whether the modifier mode is removed or replaced on mobile; whether touch devices on desktop count as mobile.

### 16.2 Styling options

Lets users change how the tooltip looks (for example size, width, colors, position offset).

**Prerequisites**

- Settings validation in `normalizeSettings` with allow-lists or ranges, never free-form CSS. Colors accept a strict format (hex, or a theme variable name from a fixed list); numbers are clamped.
- A pure `tooltipStyleFor(settings)` returning a map of CSS variable names to values, applied to the tooltip element. `styles.css` reads those variables with defaults identical to today's look.

| Case | Level |
|---|---|
| Defaults produce no visible change from 1.1.0 (same variable values as the current CSS) | U |
| Each option follows checklist 15.2: default, validation, clamp, fallback on invalid values | U |
| Invalid or hostile values (`red; background:url(...)`, huge numbers, negatives, wrong types) fall back to defaults and are never written to a style attribute | U |
| `tooltipStyleFor` is deterministic and omits options left at their default | U |
| Changing an option updates a visible tooltip and the next one, without reload | C |
| Reset to defaults restores every option and saves | C |
| Options interact correctly with placement (a larger tooltip still flips and clamps to the viewport) | U, C |
| Options included in or excluded from backup, as decided | U, C |
| Rendering in light and dark themes, with a community theme, with long and multi-line text | M |
| Contrast stays readable at the extremes the options allow | M |

Limit of this approach: jsdom does not render CSS, so tests verify that the right variables and classes are set. How it looks is a manual check, or a screenshot test if phase 4 (section 13) is adopted.

Open questions: which options are in scope; whether styling follows the active theme by default; whether styling is part of the backup.

### 16.4 After the roadmap

New ideas follow section 15 from the start. Ideas that touch the data model (for example per-vault versus synced descriptions, or descriptions longer than 100 characters) add a migration test in `settings.test.ts`: old file in, new shape out, nothing lost.