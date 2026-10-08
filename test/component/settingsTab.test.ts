import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Notice, Platform } from '../mocks/obsidian';
import {
    addTag,
    buttonIn,
    createPlugin,
    extraButton,
    flush,
    isTooltipVisible,
    libraryNames,
    listAfter,
    listElementAfter,
    mouseover,
    press,
    renderSettingsTab,
    rowFor,
    savedData,
    setSelect,
    setToggle,
    settingNamed,
    settingStartingWith,
    settingsTab,
    tabEl,
    typeInto,
    type Harness,
    type PluginOptions,
} from '../helpers';

beforeEach(() => {
    vi.useFakeTimers();
});

async function openTab(options: PluginOptions = {}): Promise<Harness & { tab: HTMLElement }> {
    const harness = await createPlugin(options);
    const tab = renderSettingsTab(harness.plugin);
    return { ...harness, tab };
}

const LIBRARY = { '#alpha': 'First', '#beta': 'Second', '#gamma': 'Third thing' };

function tagsIn(...lists: string[][]): Record<string, { tags: { tag: string }[] }> {
    const files: Record<string, { tags: { tag: string }[] }> = {};
    lists.forEach((tags, i) => {
        files[`note-${i}.md`] = { tags: tags.map((tag) => ({ tag })) };
    });
    return files;
}

// ---------------------------------------------------------------------------

describe('add form', () => {
    function fields(plugin: Harness['plugin']) {
        const form = settingNamed(tabEl(plugin), 'Add new tooltip');
        const [tagInput, descInput] = [...form.querySelectorAll<HTMLInputElement>('input')];
        return { form, tagInput, descInput, add: buttonIn(form, 'Add') };
    }

    it('adds a tooltip and clears the form', async () => {
        const { plugin } = await openTab();
        const { tagInput, descInput, add } = fields(plugin);

        typeInto(tagInput, 'proj');
        typeInto(descInput, ' Active work ');
        add.click();
        await flush();

        expect(savedData(plugin).tagMap).toEqual({ '#proj': 'Active work' });
        expect(Notice.messages).toContain('Added #proj');
        expect(fields(plugin).tagInput.value).toBe('');
        expect(fields(plugin).descInput.value).toBe('');
    });

    it('submits with the Enter key from either field', async () => {
        const { plugin } = await openTab();
        const { tagInput, descInput } = fields(plugin);

        typeInto(tagInput, '#one');
        typeInto(descInput, 'First');
        press(descInput, 'Enter');
        await flush();
        expect(savedData(plugin).tagMap).toEqual({ '#one': 'First' });

        const next = fields(plugin);
        typeInto(next.tagInput, '#two');
        typeInto(next.descInput, 'Second');
        press(next.tagInput, 'Enter');
        await flush();
        expect(savedData(plugin).tagMap).toEqual({ '#one': 'First', '#two': 'Second' });
    });

    it('rejects an invalid tag', async () => {
        const { plugin } = await openTab();
        const { tagInput, descInput, add } = fields(plugin);

        typeInto(tagInput, '#');
        typeInto(descInput, 'Text');
        add.click();
        await flush();

        expect(Notice.messages).toContain('Invalid tag');
        expect(savedData(plugin)).toBeNull();
    });

    it('rejects an empty description', async () => {
        const { plugin } = await openTab();
        const { tagInput, descInput, add } = fields(plugin);

        typeInto(tagInput, '#proj');
        typeInto(descInput, '   ');
        add.click();
        await flush();

        expect(Notice.messages).toContain('Description cannot be empty');
        expect(savedData(plugin)).toBeNull();
    });

    it('rejects a tag that already has a description', async () => {
        const { plugin } = await openTab({ data: { tagMap: { '#proj': 'Existing' } } });
        const { tagInput, descInput, add } = fields(plugin);

        typeInto(tagInput, 'proj');
        typeInto(descInput, 'New');
        add.click();
        await flush();

        expect(Notice.messages).toContain('#proj already exists');
        expect(plugin.settings.tagMap['#proj']).toBe('Existing');
    });

    it('limits the description to 100 characters and shows a live counter', async () => {
        const { plugin } = await openTab();
        const { form, descInput } = fields(plugin);
        const counter = form.querySelector('.tag-char-counter');

        expect(descInput.maxLength).toBe(100);
        expect(counter?.textContent).toBe('0/100');

        typeInto(descInput, 'abcde');
        expect(counter?.textContent).toBe('5/100');
    });
});

// ---------------------------------------------------------------------------

describe('library', () => {
    it('lists every description in insertion order', async () => {
        const { tab } = await openTab({ data: { tagMap: LIBRARY } });
        expect(libraryNames(tab)).toEqual(['#alpha', '#beta', '#gamma']);
    });

    it('is hidden when there are no descriptions', async () => {
        const { tab } = await openTab();
        expect(tab.querySelector('.setting-group')).toBeNull();
    });

    describe('search', () => {
        function search(tab: HTMLElement, query: string) {
            const input = tab.querySelector<HTMLInputElement>('.setting-group input');
            if (!input) throw new Error('No library search box');
            typeInto(input, query);
            vi.advanceTimersByTime(250);
        }

        it('filters by tag name', async () => {
            const { tab } = await openTab({ data: { tagMap: LIBRARY } });
            search(tab, 'beta');
            expect(libraryNames(tab)).toEqual(['#beta']);
        });

        it('filters by description text', async () => {
            const { tab } = await openTab({ data: { tagMap: LIBRARY } });
            search(tab, 'thing');
            expect(libraryNames(tab)).toEqual(['#gamma']);
        });

        it('ignores letter case in the query', async () => {
            const { tab } = await openTab({ data: { tagMap: LIBRARY } });
            search(tab, 'SECOND');
            expect(libraryNames(tab)).toEqual(['#beta']);
        });

        it('shows a message when nothing matches', async () => {
            const { tab } = await openTab({ data: { tagMap: LIBRARY } });
            search(tab, 'zzz');
            expect(libraryNames(tab)).toEqual([]);
            expect(tab.querySelector('.setting-group .tag-tooltip-empty')?.textContent).toBe('No matching tags');
        });
    });

    describe('delete', () => {
        it('asks for confirmation before deleting', async () => {
            const { plugin, tab } = await openTab({ data: { tagMap: LIBRARY } });
            extraButton(rowFor(tab, '#alpha'), 'trash-2').click();

            expect(document.querySelector('.tag-delete-modal')).not.toBeNull();
            expect(plugin.settings.tagMap['#alpha']).toBe('First');

            buttonIn(document.body, 'Delete').click();
            await flush();

            expect(savedData(plugin).tagMap).toEqual({ '#beta': 'Second', '#gamma': 'Third thing' });
            expect(Notice.messages).toContain('#alpha deleted.');
            expect(libraryNames(tabEl(plugin))).toEqual(['#beta', '#gamma']);
        });

        it('keeps the description when the confirmation is cancelled', async () => {
            const { plugin, tab } = await openTab({ data: { tagMap: LIBRARY } });
            extraButton(rowFor(tab, '#alpha'), 'trash-2').click();
            buttonIn(document.body, 'Cancel').click();
            await flush();

            expect(plugin.settings.tagMap['#alpha']).toBe('First');
            expect(document.querySelector('.tag-delete-modal')).toBeNull();
        });

        it('deletes immediately when confirmation is turned off', async () => {
            const { plugin, tab } = await openTab({ data: { tagMap: LIBRARY, confirmDelete: false } });
            extraButton(rowFor(tab, '#alpha'), 'trash-2').click();
            await flush();

            expect(document.querySelector('.tag-delete-modal')).toBeNull();
            expect(savedData(plugin).tagMap).toEqual({ '#beta': 'Second', '#gamma': 'Third thing' });
        });
    });

    describe('edit', () => {
        async function startEditing(tag: string, data: PluginOptions['data'] = { tagMap: LIBRARY }) {
            const harness = await openTab({ data });
            extraButton(rowFor(harness.tab, tag), 'pencil').click();
            const tab = tabEl(harness.plugin);
            return {
                ...harness,
                tagInput: tab.querySelector<HTMLInputElement>('.tag-edit-input')!,
                descInput: tab.querySelector<HTMLTextAreaElement>('.tag-edit-textarea')!,
            };
        }

        it('opens an edit row with the current tag and description', async () => {
            const { tagInput, descInput } = await startEditing('#beta');
            expect(tagInput.value).toBe('#beta');
            expect(descInput.value).toBe('Second');
        });

        it('renames a tag and keeps its position in the list', async () => {
            const { plugin, tagInput } = await startEditing('#beta');
            typeInto(tagInput, 'renamed');
            press(tagInput, 'Enter');
            await flush();

            expect(Object.keys(savedData(plugin).tagMap ?? {})).toEqual(['#alpha', '#renamed', '#gamma']);
            expect(savedData(plugin).tagMap?.['#renamed']).toBe('Second');
            expect(libraryNames(tabEl(plugin))).toEqual(['#alpha', '#renamed', '#gamma']);
        });

        it('saves a new description under the same tag', async () => {
            const { plugin, descInput } = await startEditing('#beta');
            typeInto(descInput, 'Updated');
            extraButton(tabEl(plugin), 'check').click();
            await flush();

            expect(savedData(plugin).tagMap?.['#beta']).toBe('Updated');
        });

        it('rejects an empty tag name', async () => {
            const { plugin, tagInput } = await startEditing('#beta');
            typeInto(tagInput, '');
            press(tagInput, 'Enter');
            await flush();

            expect(Notice.messages).toContain('Invalid tag');
            expect(plugin.settings.tagMap).toEqual(LIBRARY);
            expect(savedData(plugin)).toEqual({ tagMap: LIBRARY });
        });

        it('rejects a tag name that is only #', async () => {
            const { plugin, tagInput } = await startEditing('#beta');
            typeInto(tagInput, '#');
            press(tagInput, 'Enter');
            await flush();

            expect(Notice.messages).toContain('Invalid tag');
            expect(Object.keys(plugin.settings.tagMap)).not.toContain('');
            expect(Object.keys(plugin.settings.tagMap)).toContain('#beta');
        });

        it('rejects an empty description', async () => {
            const { plugin, descInput } = await startEditing('#beta');
            typeInto(descInput, '  ');
            extraButton(tabEl(plugin), 'check').click();
            await flush();

            expect(Notice.messages).toContain('Description cannot be empty!');
            expect(plugin.settings.tagMap['#beta']).toBe('Second');
        });

        it('rejects a name that another tag already uses', async () => {
            const { plugin, tagInput } = await startEditing('#beta');
            typeInto(tagInput, '#alpha');
            press(tagInput, 'Enter');
            await flush();

            expect(Notice.messages).toContain('Tag already exists.');
            expect(plugin.settings.tagMap).toEqual(LIBRARY);
        });

        it('leaves the data unchanged when editing is cancelled', async () => {
            const { plugin, tagInput } = await startEditing('#beta');
            typeInto(tagInput, 'changed');
            extraButton(tabEl(plugin), 'x').click();
            await flush();

            expect(plugin.settings.tagMap).toEqual(LIBRARY);
            expect(tabEl(plugin).querySelector('.tag-edit-input')).toBeNull();
        });
    });
});

// ---------------------------------------------------------------------------

describe('missing descriptions', () => {
    const HEADING = 'Tags without a description';

    it('lists vault tags that have no description with their note counts', async () => {
        const { tab } = await openTab({ files: tagsIn(['#a'], ['#a', '#b']) });

        expect(settingStartingWith(tab, HEADING).textContent).toContain('(2)');
        const list = listElementAfter(tab, HEADING);
        expect(rowFor(list, '#a').querySelector('.setting-item-description')?.textContent).toBe('Used in 2 notes');
        expect(rowFor(list, '#b').querySelector('.setting-item-description')?.textContent).toBe('Used in 1 note');
    });

    it('excludes described tags, ignored tags and tags covered by inheritance', async () => {
        const { tab } = await openTab({
            data: { tagMap: { '#described': 'x', '#p': 'parent' }, ignoredTags: ['#ignored'] },
            files: tagsIn(['#described', '#ignored', '#p/child', '#open']),
        });

        expect(listAfter(tab, HEADING)).toEqual(['#open']);
    });

    it('includes tags covered only by a parent when inheritance is off', async () => {
        const { tab } = await openTab({
            data: { tagMap: { '#p': 'parent' }, inheritFromParents: false },
            files: tagsIn(['#p/child']),
        });

        expect(listAfter(tab, HEADING)).toEqual(['#p/child']);
    });

    it('sorts by usage count, then by name', async () => {
        const { tab } = await openTab({
            files: tagsIn(['#b', '#a'], ['#b', '#c'], ['#b']),
        });

        expect(listAfter(tab, HEADING)).toEqual(['#b', '#a', '#c']);
    });

    it('shows a message when nothing is missing', async () => {
        const { tab } = await openTab({ data: { tagMap: { '#a': 'x' } }, files: tagsIn(['#a']) });

        expect(settingStartingWith(tab, HEADING).textContent).toContain('(0)');
        expect(tab.querySelector('.tag-tooltip-empty')?.textContent).toBe('No tags are missing a description.');
    });

    it('shows the first 50 tags and expands to all of them', async () => {
        const many = Array.from({ length: 60 }, (_, i) => `#t${String(i).padStart(2, '0')}`);
        const { plugin, tab } = await openTab({ files: tagsIn(many) });

        expect(settingStartingWith(tab, HEADING).textContent).toContain('(60)');
        expect(listAfter(tab, HEADING)).toHaveLength(50);

        buttonIn(tab, 'Show all 60').click();
        expect(listAfter(tabEl(plugin), HEADING)).toHaveLength(60);

        buttonIn(tabEl(plugin), 'Show fewer').click();
        expect(listAfter(tabEl(plugin), HEADING)).toHaveLength(50);
    });

    it('does not show the expand button for 50 tags or fewer', async () => {
        const few = Array.from({ length: 50 }, (_, i) => `#t${i}`);
        const { tab } = await openTab({ files: tagsIn(few) });

        expect([...tab.querySelectorAll('button')].some((b) => b.textContent?.startsWith('Show all'))).toBe(false);
    });

    it('adds a description from the list and removes the tag from it', async () => {
        const { plugin, tab } = await openTab({ files: tagsIn(['#a', '#b']) });

        buttonIn(rowFor(listElementAfter(tab, HEADING), '#a'), 'Add description').click();
        typeInto(document.querySelector<HTMLInputElement>('.tag-tooltip-modal input')!, 'Alpha');
        buttonIn(document.body, 'Save').click();
        await flush();

        expect(savedData(plugin).tagMap).toEqual({ '#a': 'Alpha' });
        expect(listAfter(tabEl(plugin), HEADING)).toEqual(['#b']);
        expect(libraryNames(tabEl(plugin))).toEqual(['#a']);
    });

    describe('ignored tags', () => {
        it('removes an ignored tag from the missing list and saves it', async () => {
            const { plugin, tab } = await openTab({ files: tagsIn(['#a', '#b']) });

            extraButton(rowFor(listElementAfter(tab, HEADING), '#a'), 'eye-off').click();
            await flush();

            expect(savedData(plugin).ignoredTags).toEqual(['#a']);
            expect(listAfter(tabEl(plugin), HEADING)).toEqual(['#b']);
        });

        it('lists ignored tags on request and restores one', async () => {
            const { plugin, tab } = await openTab({
                data: { ignoredTags: ['#a'] },
                files: tagsIn(['#a', '#b']),
            });

            expect(settingStartingWith(tab, 'Ignored tags').textContent).toContain('(1)');
            expect(listAfter(tab, 'Ignored tags')).toEqual([]);

            buttonIn(settingStartingWith(tab, 'Ignored tags'), 'Show').click();
            const ignoredList = listElementAfter(tabEl(plugin), 'Ignored tags');
            expect(listAfter(tabEl(plugin), 'Ignored tags')).toEqual(['#a']);

            extraButton(rowFor(ignoredList, '#a'), 'eye').click();
            await flush();

            expect(savedData(plugin).ignoredTags).toEqual([]);
            expect(listAfter(tabEl(plugin), HEADING)).toEqual(['#a', '#b']);
        });

        it('hides the ignored section when nothing is ignored', async () => {
            const { tab } = await openTab({ files: tagsIn(['#a']) });
            expect(tab.textContent).not.toContain('Ignored tags');
        });

        it('keeps tags ignored after the plugin reloads', async () => {
            const files = tagsIn(['#a', '#b']);
            const first = await openTab({ files });

            extraButton(rowFor(listElementAfter(first.tab, HEADING), '#a'), 'eye-off').click();
            await flush();
            const persisted = savedData(first.plugin);
            first.plugin.unload();
            document.body.replaceChildren();

            const second = await openTab({ data: persisted as Record<string, unknown>, files });
            expect(listAfter(second.tab, HEADING)).toEqual(['#b']);
            expect(settingStartingWith(second.tab, 'Ignored tags').textContent).toContain('(1)');
        });

        it('keeps a tag ignored even if it is no longer used in the vault', async () => {
            const { tab } = await openTab({ data: { ignoredTags: ['#gone'] }, files: tagsIn(['#a']) });
            expect(settingStartingWith(tab, 'Ignored tags').textContent).toContain('(1)');
        });
    });
});

// ---------------------------------------------------------------------------

describe('preferences', () => {
    const triggerSelect = (plugin: Harness['plugin']) =>
        settingNamed(tabEl(plugin), 'Show tooltip').querySelector('select')!;
    const hasSetting = (plugin: Harness['plugin'], name: string) =>
        [...tabEl(plugin).querySelectorAll('.setting-item-name')].some((n) => n.textContent === name);

    it('shows the hover delay slider in hover mode and no modifier dropdown', async () => {
        const { plugin } = await openTab();

        expect(hasSetting(plugin, 'Hover delay')).toBe(true);
        expect(hasSetting(plugin, 'Modifier key')).toBe(false);
        const slider = settingNamed(tabEl(plugin), 'Hover delay').querySelector('input')!;
        expect(slider.value).toBe('50');
        expect([slider.min, slider.max, slider.step]).toEqual(['0', '1000', '50']);
    });

    it('swaps the delay slider for the modifier dropdown in modifier mode', async () => {
        const { plugin } = await openTab();

        setSelect(triggerSelect(plugin), 'modifier');
        await flush();

        expect(plugin.settings.triggerMode).toBe('modifier');
        expect(savedData(plugin).triggerMode).toBe('modifier');
        expect(hasSetting(plugin, 'Hover delay')).toBe(false);
        expect(hasSetting(plugin, 'Modifier key')).toBe(true);
    });

    it('saves the hover delay', async () => {
        const { plugin } = await openTab();
        const slider = settingNamed(tabEl(plugin), 'Hover delay').querySelector('input')!;

        typeInto(slider, '300');
        await flush();

        expect(savedData(plugin).hoverDelayMs).toBe(300);
    });

    it('saves the modifier key', async () => {
        const { plugin } = await openTab({ data: { triggerMode: 'modifier' } });
        const select = settingNamed(tabEl(plugin), 'Modifier key').querySelector('select')!;

        setSelect(select, 'shift');
        await flush();

        expect(savedData(plugin).modifierKey).toBe('shift');
    });

    it('does not clear other inputs when switching between modes', async () => {
        const { plugin } = await openTab();

        typeInto(settingNamed(tabEl(plugin), 'Hover delay').querySelector('input')!, '300');
        await flush();
        setSelect(triggerSelect(plugin), 'modifier');
        await flush();
        setSelect(settingNamed(tabEl(plugin), 'Modifier key').querySelector('select')!, 'shift');
        await flush();
        setSelect(triggerSelect(plugin), 'hover');
        await flush();

        expect(settingNamed(tabEl(plugin), 'Hover delay').querySelector('input')!.value).toBe('300');
        expect(plugin.settings.modifierKey).toBe('shift');
        expect(plugin.settings.hoverDelayMs).toBe(300);
    });

    it('labels the modifier options for Windows and Linux', async () => {
        Platform.isMacOS = false;
        const { plugin } = await openTab({ data: { triggerMode: 'modifier' } });
        const options = [...settingNamed(tabEl(plugin), 'Modifier key').querySelectorAll('option')];

        expect(options.map((o) => o.textContent)).toEqual(['Ctrl', 'Alt', 'Shift']);
    });

    it('labels the modifier options for macOS', async () => {
        Platform.isMacOS = true;
        const { plugin } = await openTab({ data: { triggerMode: 'modifier' } });
        const options = [...settingNamed(tabEl(plugin), 'Modifier key').querySelectorAll('option')];

        expect(options.map((o) => o.textContent)).toEqual(['Cmd', 'Option', 'Shift']);
    });

    it('hides a visible tooltip when the trigger mode changes', async () => {
        const { plugin } = await openTab({ data: { tagMap: { '#a': 'A' }, hoverDelayMs: 0 } });
        mouseover(addTag('tag', '#a'));
        expect(isTooltipVisible(plugin)).toBe(true);

        setSelect(triggerSelect(plugin), 'modifier');
        await flush();

        expect(isTooltipVisible(plugin)).toBe(false);
    });

    it('hides a visible tooltip when the modifier key changes', async () => {
        const { plugin } = await openTab({
            data: { tagMap: { '#a': 'A' }, triggerMode: 'modifier', modifierKey: 'alt' },
        });
        mouseover(addTag('tag', '#a'), { altKey: true });
        expect(isTooltipVisible(plugin)).toBe(true);

        setSelect(settingNamed(tabEl(plugin), 'Modifier key').querySelector('select')!, 'shift');
        await flush();

        expect(isTooltipVisible(plugin)).toBe(false);
    });

    it('updates the missing list when inheritance is toggled', async () => {
        const { plugin } = await openTab({
            data: { tagMap: { '#p': 'parent' } },
            files: tagsIn(['#p/child']),
        });
        expect(listAfter(tabEl(plugin), 'Tags without a description')).toEqual([]);

        const toggle = () => settingNamed(tabEl(plugin), 'Inherit parent descriptions').querySelector('input')!;
        setToggle(toggle(), false);
        await flush();

        expect(savedData(plugin).inheritFromParents).toBe(false);
        expect(listAfter(tabEl(plugin), 'Tags without a description')).toEqual(['#p/child']);

        setToggle(toggle(), true);
        await flush();
        expect(listAfter(tabEl(plugin), 'Tags without a description')).toEqual([]);
    });

    it('saves the confirm-before-deleting preference', async () => {
        const { plugin } = await openTab();
        const toggle = settingNamed(tabEl(plugin), 'Confirm before deleting').querySelector('input')!;
        expect(toggle.checked).toBe(true);

        setToggle(toggle, false);
        await flush();

        expect(savedData(plugin).confirmDelete).toBe(false);
    });
});

// ---------------------------------------------------------------------------

describe('import', () => {
    const importText = async (plugin: Harness['plugin'], text: string) => {
        await settingsTab(plugin).importFromText(text);
    };

    it('imports a backup in the current format', async () => {
        const { plugin } = await openTab();
        await importText(plugin, JSON.stringify({ tagMap: { '#a': 'A' }, ignoredTags: ['#x'] }));

        expect(savedData(plugin).tagMap).toEqual({ '#a': 'A' });
        expect(savedData(plugin).ignoredTags).toEqual(['#x']);
        expect(libraryNames(tabEl(plugin))).toEqual(['#a']);
    });

    it('imports a 1.0.0 flat backup', async () => {
        const { plugin } = await openTab();
        await importText(plugin, JSON.stringify({ a: 'A', '#b': 'B' }));

        expect(savedData(plugin).tagMap).toEqual({ '#a': 'A', '#b': 'B' });
    });

    it('imports a file that only contains ignored tags', async () => {
        const { plugin } = await openTab();
        await importText(plugin, JSON.stringify({ ignoredTags: ['#x'] }));

        expect(savedData(plugin).ignoredTags).toEqual(['#x']);
        expect(Notice.messages).toEqual(['Imported 0 tags and 1 ignored tag.']);
    });

    it('merges ignored tags with the existing list without duplicates', async () => {
        const { plugin } = await openTab({ data: { ignoredTags: ['#x', '#y'] } });
        await importText(plugin, JSON.stringify({ ignoredTags: ['#y', '#z'] }));

        expect(savedData(plugin).ignoredTags).toEqual(['#x', '#y', '#z']);
    });

    it('overwrites existing descriptions and keeps the others', async () => {
        const { plugin } = await openTab({ data: { tagMap: { '#a': 'old', '#keep': 'kept' } } });
        await importText(plugin, JSON.stringify({ tagMap: { '#a': 'new' } }));

        expect(savedData(plugin).tagMap).toEqual({ '#a': 'new', '#keep': 'kept' });
    });

    it('reports how many entries were imported and skipped', async () => {
        const { plugin } = await openTab();
        await importText(plugin, JSON.stringify({ tagMap: { '#a': 'A', '#b': 5, '#c': '' } }));

        expect(Notice.messages).toEqual(['Imported 1 tag, skipped 2 invalid entries.']);
    });

    it('shows an error and changes nothing when the file is not valid JSON', async () => {
        const { plugin } = await openTab({ data: { tagMap: { '#a': 'A' } } });
        await importText(plugin, '{ not json');

        expect(Notice.messages).toEqual(['Invalid JSON file.']);
        expect(plugin.settings.tagMap).toEqual({ '#a': 'A' });
        expect(savedData(plugin)).toEqual({ tagMap: { '#a': 'A' } });
    });

    it.each(['{}', '[]', '"text"', '42', 'null', '{"tagMap": {"#a": 5}}'])(
        'shows a message and changes nothing for a file with no valid entries: %s',
        async (text) => {
            const { plugin } = await openTab({ data: { tagMap: { '#a': 'A' } } });
            await importText(plugin, text);

            expect(Notice.messages).toEqual(['No valid tag descriptions found in file.']);
            expect(plugin.settings.tagMap).toEqual({ '#a': 'A' });
        }
    );

    it('does not let a __proto__ key change the prototype', async () => {
        const { plugin } = await openTab();
        await importText(plugin, '{"__proto__": {"polluted": "yes"}, "#a": "A"}');

        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
        expect(plugin.settings.tagMap).toEqual({ '#a': 'A' });
    });
});

describe('export', () => {
    // Blob contents are captured when the Blob is built. Reading one back
    // (FileReader, Blob.text) relies on timers that fake timers would freeze.
    interface RecordedBlob extends Blob {
        recorded: string;
    }

    let exported: RecordedBlob[];
    let downloads: string[];
    const original = {
        Blob: globalThis.Blob,
        create: URL.createObjectURL,
        revoke: URL.revokeObjectURL,
        click: HTMLAnchorElement.prototype.click,
    };

    beforeEach(() => {
        exported = [];
        downloads = [];

        globalThis.Blob = class extends original.Blob {
            recorded: string;
            constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
                super(parts, options);
                this.recorded = (parts ?? []).map(String).join('');
            }
        };
        URL.createObjectURL = (blob: Blob | MediaSource) => {
            exported.push(blob as RecordedBlob);
            return 'blob:test';
        };
        URL.revokeObjectURL = () => undefined;
        HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
            downloads.push(this.download);
        };

        return () => {
            globalThis.Blob = original.Blob;
            URL.createObjectURL = original.create;
            URL.revokeObjectURL = original.revoke;
            HTMLAnchorElement.prototype.click = original.click;
        };
    });

    async function exportFrom(plugin: Harness['plugin']): Promise<unknown> {
        buttonIn(settingNamed(tabEl(plugin), 'Backup & restore'), 'Export').click();
        await flush();
        return JSON.parse(exported[exported.length - 1].recorded);
    }

    it('contains both the tag map and the ignored tags', async () => {
        const { plugin } = await openTab({ data: { tagMap: { '#a': 'A' }, ignoredTags: ['#x'] } });

        expect(await exportFrom(plugin)).toEqual({ tagMap: { '#a': 'A' }, ignoredTags: ['#x'] });
        expect(downloads).toEqual(['tag-tooltips-backup.json']);
        expect(exported[0].type).toBe('application/json');
    });

    it('restores the same data when imported into a clean install', async () => {
        const source = await openTab({
            data: { tagMap: { '#a': 'A', '#b/c': 'B/C' }, ignoredTags: ['#x', '#y'] },
        });
        const backup = JSON.stringify(await exportFrom(source.plugin));
        source.plugin.unload();
        document.body.replaceChildren();

        const target = await openTab();
        await settingsTab(target.plugin).importFromText(backup);

        expect(savedData(target.plugin).tagMap).toEqual({ '#a': 'A', '#b/c': 'B/C' });
        expect(savedData(target.plugin).ignoredTags).toEqual(['#x', '#y']);
    });
});