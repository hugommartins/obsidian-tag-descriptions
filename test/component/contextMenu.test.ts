import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Menu, Notice } from '../mocks/obsidian';
import { buttonIn, createPlugin, flush, press, savedData, typeInto, type Harness } from '../helpers';

const TITLE = 'Set description for #idea';

function editorOver(token: { type: string; text: string } | null) {
    return {
        getCursor: () => ({ line: 0, ch: 1 }),
        getClickableTokenAt: () => token,
    };
}

const tagEditor = () => editorOver({ type: 'tag', text: '#idea' });

function titles(menu: Menu): string[] {
    return menu.items.map((i) => i.title);
}

function modalInput(): HTMLInputElement {
    const input = document.querySelector<HTMLInputElement>('.tag-tooltip-modal input');
    if (!input) throw new Error('Quick-add modal is not open');
    return input;
}

describe('context menu', () => {
    let harness: Harness;

    beforeEach(async () => {
        vi.useFakeTimers();
        harness = await createPlugin();
    });

    it('adds a Set description item when right-clicking a tag in the editor', () => {
        const menu = new Menu();
        harness.app.workspace.trigger('editor-menu', menu, tagEditor());

        expect(titles(menu)).toEqual([TITLE]);
        expect(menu.items[0].icon).toBe('tag');
    });

    it('adds a Set description item from the tag-menu event', () => {
        const menu = new Menu();
        harness.app.workspace.trigger('tag-menu', menu, '#idea');

        expect(titles(menu)).toEqual([TITLE]);
    });

    it('adds a single Set description item when both editor-menu and tag-menu fire', () => {
        const menu = new Menu();
        harness.app.workspace.trigger('editor-menu', menu, tagEditor());
        harness.app.workspace.trigger('tag-menu', menu, '#idea');

        expect(titles(menu)).toEqual([TITLE]);
    });

    it('adds a single Set description item when the two events carry different menu objects', () => {
        const first = new Menu();
        const second = new Menu();
        harness.app.workspace.trigger('editor-menu', first, tagEditor());
        harness.app.workspace.trigger('tag-menu', second, '#idea');

        expect(first.items.length + second.items.length).toBe(1);
    });

    it('adds the item again on the next right-click', () => {
        const first = new Menu();
        harness.app.workspace.trigger('tag-menu', first, '#idea');
        vi.advanceTimersByTime(1);

        const second = new Menu();
        harness.app.workspace.trigger('tag-menu', second, '#idea');

        expect(titles(first)).toEqual([TITLE]);
        expect(titles(second)).toEqual([TITLE]);
    });

    it('adds no item when the cursor is not on a tag', () => {
        const link = new Menu();
        harness.app.workspace.trigger('editor-menu', link, editorOver({ type: 'link', text: '[[x]]' }));
        const none = new Menu();
        harness.app.workspace.trigger('editor-menu', none, editorOver(null));

        expect(link.items).toHaveLength(0);
        expect(none.items).toHaveLength(0);
    });

    it('adds no item when the tag-menu event carries no tag', () => {
        const menu = new Menu();
        harness.app.workspace.trigger('tag-menu', menu, '');

        expect(menu.items).toHaveLength(0);
    });

    it('stops adding items after the plugin is unloaded', () => {
        harness.plugin.unload();
        const menu = new Menu();
        harness.app.workspace.trigger('tag-menu', menu, '#idea');

        expect(menu.items).toHaveLength(0);
    });
});

describe('set description dialog', () => {
    async function openDialog(data?: Record<string, unknown>) {
        vi.useFakeTimers();
        const harness = await createPlugin({ data });
        const menu = new Menu();
        harness.app.workspace.trigger('tag-menu', menu, '#idea');
        menu.items[0].clickHandler?.();
        return harness;
    }

    it('opens a dialog titled with the tag', async () => {
        await openDialog();
        expect(document.querySelector('.modal-title')?.textContent).toBe('Description for #idea');
    });

    it('starts empty for a tag without a description', async () => {
        await openDialog();
        expect(modalInput().value).toBe('');
    });

    it('starts with the existing description', async () => {
        await openDialog({ tagMap: { '#idea': 'Not started' } });
        expect(modalInput().value).toBe('Not started');
    });

    it('saves the description and closes the dialog', async () => {
        const { plugin } = await openDialog();
        typeInto(modalInput(), '  Raw thoughts  ');
        buttonIn(document.body, 'Save').click();
        await flush();

        expect(savedData(plugin).tagMap).toEqual({ '#idea': 'Raw thoughts' });
        expect(plugin.settings.tagMap['#idea']).toBe('Raw thoughts');
        expect(Notice.messages).toContain('Tooltip for #idea saved!');
        expect(document.querySelector('.tag-tooltip-modal')).toBeNull();
    });

    it('saves when Enter is pressed in the input', async () => {
        const { plugin } = await openDialog();
        const input = modalInput();
        typeInto(input, 'Quick');
        press(input, 'Enter');
        await flush();

        expect(savedData(plugin).tagMap).toEqual({ '#idea': 'Quick' });
    });

    it('rejects an empty description and keeps the dialog open', async () => {
        const { plugin } = await openDialog();
        typeInto(modalInput(), '   ');
        buttonIn(document.body, 'Save').click();
        await flush();

        expect(Notice.messages).toContain('Description cannot be empty!');
        expect(savedData(plugin)).toBeNull();
        expect(document.querySelector('.tag-tooltip-modal')).not.toBeNull();
    });

    it('limits the description to 100 characters', async () => {
        await openDialog();
        expect(modalInput().maxLength).toBe(100);
    });

    it('shows a live character counter', async () => {
        await openDialog();
        const counter = document.querySelector('.tag-modal-counter');
        expect(counter?.textContent).toBe('0/100');

        typeInto(modalInput(), 'abcd');
        expect(counter?.textContent).toBe('4/100');
    });
});