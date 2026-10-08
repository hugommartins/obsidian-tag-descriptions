# Testing Guidelines

How to run, read and write tests for Tag Descriptions. For the reasoning behind the approach (risks, levels, release gate) see [TEST_STRATEGY.md](./TEST_STRATEGY.md). For bugs and the tests that guard them see [BUG_LOG.md](./BUG_LOG.md).

## Quick start

Requires Node.js 20 or later.

```bash
npm install
npm test
```

| Command | What it does |
|---|---|
| `npm test` | Runs every test once. |
| `npm run test:watch` | Re-runs affected tests when files change. |
| `npm run test:coverage` | Runs once with v8 coverage and enforces the thresholds. Writes a report to `coverage/`. |
| `npx vitest run test/unit` | Runs one folder. |
| `npx vitest run test/component/tooltip.test.ts` | Runs one file. |
| `npx vitest run -t "delay"` | Runs tests whose name contains the text. |
| `npx tsc --noEmit` | Type check. |
| `npm run lint` | ESLint with the Obsidian plugin rules. |
| `npm run build` | Bundles `main.js`. |

Before a pull request: `npx tsc --noEmit`, `npm run lint`, `npm test`. CI runs the same checks plus the build.

## What is tested, and how

| Level | Folder | Environment | Covers |
|---|---|---|---|
| Unit | `test/unit/` | jsdom, no plugin | Pure logic: tag normalization, description resolution, import sanitizing and merging, settings loading, tooltip placement, vault scanning. |
| Component | `test/component/` | jsdom, real plugin class, stubbed Obsidian | The loaded plugin: tooltip behavior, context menu, settings tab, import and export. |
| Manual | [Smoke checklist](./TEST_STRATEGY.md#8-manual-smoke-checklist-per-release) | Real Obsidian | Live Preview rendering, the Properties view, themes, internal Obsidian events, performance. |

Component tests load the real `TagTooltipsPlugin` and drive it through DOM events, workspace events and the settings tab. They do not mock the plugin's own modules. Only Obsidian is replaced.

### Layout

```
test/
  setup.ts                 # runs before every test file: DOM helpers, resets
  helpers.ts               # createPlugin, event helpers, settings-tab queries
  mocks/obsidian.ts        # stand-in for the `obsidian` module
  unit/
    tagUtils.test.ts       # formatTag, resolveDescription, sanitizers
    settings.test.ts       # normalizeSettings, defaults
    backup.test.ts         # createBackup, mergeBackup, describeImport
    tooltipUtils.test.ts   # modifier mapping, tooltip placement
    vaultUtils.test.ts     # collectVaultTags, getTagAtCursor
  component/
    tooltip.test.ts        # hover, modifier mode, position, lifecycle
    contextMenu.test.ts    # menu items, set-description dialog
    settingsTab.test.ts    # add form, library, missing list, preferences, import, export
vitest.config.mts          # aliases, environment, coverage thresholds
```

### Why a stub for Obsidian

The `obsidian` npm package ships type definitions only; the real implementation exists inside the app. Vitest resolves the `obsidian` import to `test/mocks/obsidian.ts`, which implements just what the plugin uses: `Plugin`, `PluginSettingTab`, `Setting` and its components, `Modal`, `Menu`, `Notice`, `Platform`, `debounce`, `getAllTags`, a minimal `App`, and the DOM helpers Obsidian adds to elements (`createEl`, `createDiv`, `empty`, `addClass`, `setText`, and so on).

The stub is a simplification. Behavior that depends on real Obsidian internals (what `getAllTags` returns for every edge case, how the context menu is built, how Live Preview renders tags) is covered by the manual checklist, not by these tests.

When the plugin starts using a new Obsidian API, add it to the stub in the same change. A test that fails with "x is not a function" or "x is not a constructor" from `test/mocks/obsidian.ts` usually means this.

## Writing tests

### Naming

- Name tests after the behavior, as a sentence: `shows the description after the configured hover delay`, `rejects a tag name that is only #`.
- Do not put bug IDs or the word "regression" in test names. The link between a bug and its tests is kept in [BUG_LOG.md](./BUG_LOG.md), using the file, `describe` and test name.
- Group with `describe` by feature or function (`hover`, `modifier mode`, `import`, `sanitizeTagMap`).
- One behavior per test. Several `expect` calls are fine when they describe one outcome.
- Use `it.each` for the same check over several inputs. Use `it.todo('...')` for a planned test whose bug is still open, and turn it into a real test in the fix.

### Where a test belongs

1. Can it be written against a pure function? Put it in `test/unit/`. If the logic is stuck inside `main.ts` or `settingsTab.ts`, extract it to `src/utils/` or `src/settings.ts` first. Pure modules must not import from `obsidian` (`tagUtils.ts`, `backup.ts`, `tooltipUtils.ts` and `settings.ts` follow this rule). Obsidian-dependent helpers go in `vaultUtils.ts`.
2. Does it need DOM events, timers, the menu or the settings tab? Put it in `test/component/`.
3. Does it depend on real Obsidian behavior? Add it to the manual checklist.

### Loading the plugin

```ts
import { createPlugin, savedData, mouseover, addTag, isTooltipVisible } from '../helpers';

it('shows the description immediately when the delay is 0', async () => {
    const { plugin } = await createPlugin({
        data: { tagMap: { '#project': 'Work in progress' }, hoverDelayMs: 0 },
        files: { 'note.md': { tags: [{ tag: '#project' }] } },
    });

    mouseover(addTag('tag', '#project'));

    expect(isTooltipVisible(plugin)).toBe(true);
});
```

- `data` is what `data.json` contains before the plugin loads. Leave it out for a fresh install.
- `files` is the fake vault: note path to metadata cache (`{ tags: [{ tag }], frontmatter: { tags } }`).
- `await createPlugin()` waits until settings are loaded and listeners are registered. Do not skip the `await`.
- `savedData(plugin)` returns what the plugin last wrote to `data.json`. Assert on it to verify persistence, and compare with `plugin.settings` for in-memory state.
- Every test gets a fresh plugin and app, and `document.body` is cleared after each test. Call `plugin.unload()` before creating a second plugin in the same test, so the first one stops listening to `document`.

### Time

Use fake timers for anything with a delay (hover delay, search debounce, the `setTimeout(0)` that resets the context-menu flag):

```ts
beforeEach(() => { vi.useFakeTimers(); });

mouseover(tag);
vi.advanceTimersByTime(299);
expect(isTooltipVisible(plugin)).toBe(false);
vi.advanceTimersByTime(1);
expect(isTooltipVisible(plugin)).toBe(true);
```

The shared setup restores real timers after every test. Never wait with a real `setTimeout` in a test.

To let async handlers finish (saving settings, closing a modal) use `await flush()` from the helpers. It only drains pending promises, so it is safe with fake timers. Awaiting a timer with fake timers hangs.

### Settings tab

After a save, the tab re-renders and previous element references are stale. Query again from `tabEl(plugin)` instead of reusing old elements. Useful helpers: `settingNamed`, `settingStartingWith`, `buttonIn`, `extraButton` (icon buttons, found by icon name), `typeInto`, `press`, `setSelect`, `setToggle`, `libraryNames`, `listAfter`, `rowFor`.

### Layout-dependent code

jsdom has no layout: `getBoundingClientRect()` returns zeros and `offsetWidth` is 0. Give elements a box with `setRect` and `setSize` before asserting on positions. Real positioning on screen is checked manually.

### Adding tests for a new feature

Follow the definition of done in [section 15 of the strategy](./TEST_STRATEGY.md#15-extending-the-strategy): add a section and feature ID, put the logic in a pure module with its own test file, add component tests for the wiring, add a threshold entry in `vitest.config.mts` for new pure modules, and add a smoke-checklist line when something only shows in real Obsidian. If the feature adds a setting, work through the [new-setting checklist](./TEST_STRATEGY.md#152-checklist-a-new-setting). Test plans for the remaining roadmap items are in [section 16](./TEST_STRATEGY.md#16-planned-features-test-plans).

### Adding a test for a bug

1. Reproduce the bug with a failing test at the lowest level that can show it.
2. Fix the code and watch the test pass.
3. Update the entry in [BUG_LOG.md](./BUG_LOG.md): status, mitigation, and the file, `describe` and test name.
4. Add a row to the summary table if it is a new bug. Only behavior bugs go in the log, not lint or tooling problems.

### Things to avoid

- Testing implementation details (private fields, call counts) when the behavior can be observed through the DOM or saved data.
- Asserting exact text copied from the code when the point is something else; assert the text only when the text is the behavior (notices, tooltip content).
- Sharing state between tests. If a test needs setup, do it inside the test or a `beforeEach`.
- Network, file system or real clock access.

## Coverage

`npm run test:coverage` enforces 90 percent lines, branches, functions and statements on the pure modules: `tagUtils.ts`, `backup.ts`, `tooltipUtils.ts` and `settings.ts`. The build fails if they drop below. Other files are reported but have no threshold; the rule for them is that every behavior in [section 5 of the strategy](./TEST_STRATEGY.md#5-coverage-by-feature) has a test.

Open `coverage/index.html` for a line-by-line report.

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request to `main`: type check, lint, tests with coverage, build. A release tag should only be created from a commit where this workflow is green.

## Manual testing

Run the [smoke checklist](./TEST_STRATEGY.md#8-manual-smoke-checklist-per-release) before every release, in a vault prepared as described in [section 7.3](./TEST_STRATEGY.md#73-test-vault). Copy `main.js`, `manifest.json` and `styles.css` into `<vault>/.obsidian/plugins/tag-descriptions/` and reload Obsidian.

Open bugs have `it.todo` placeholders in the test suite. When one is fixed, replace the placeholder with a real test.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `Cannot find module 'obsidian'` | The alias in `vitest.config.mts` is missing or the config is not being picked up. Run from the repository root. |
| `x is not a function` from `test/mocks/obsidian.ts` | The plugin uses an Obsidian API the stub lacks. Add it to the stub. |
| A tooltip test never sees the tooltip | Forgot `await createPlugin()`, forgot `vi.useFakeTimers()` and `advanceTimersByTime`, or the tag text is not in the tag map (matching is case-sensitive). |
| Test passes alone but fails in a run | State leaking between tests: a second plugin still listening on `document`, or a real timer. Call `plugin.unload()` and use fake timers. |
| Stale element in the settings tab | The tab re-rendered. Query again from `tabEl(plugin)`. |
| Coverage threshold failure | Add tests for the uncovered branches listed in the report. Do not lower the thresholds without updating the strategy. |