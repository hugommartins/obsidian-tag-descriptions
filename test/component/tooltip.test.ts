import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Platform } from '../mocks/obsidian';
import {
    addPill,
    addTag,
    createPlugin,
    isTooltipVisible,
    keydown,
    keyup,
    mouseout,
    mouseover,
    setRect,
    setSize,
    type Harness,
} from '../helpers';

const TAGS = { '#project': 'Work in progress', '#idea': 'Not started' };

async function setup(data: Record<string, unknown> = {}): Promise<Harness> {
    return createPlugin({ data: { tagMap: TAGS, ...data } });
}

describe('hover', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    it('shows the description after the configured hover delay', async () => {
        const { plugin } = await setup({ hoverDelayMs: 300 });
        const tag = addTag('tag', '#project');

        mouseover(tag);
        vi.advanceTimersByTime(299);
        expect(isTooltipVisible(plugin)).toBe(false);

        vi.advanceTimersByTime(1);
        expect(isTooltipVisible(plugin)).toBe(true);
        expect(plugin.tooltipEl.textContent).toBe('Work in progress');
    });

    it('shows the description immediately when the delay is 0', async () => {
        const { plugin } = await setup({ hoverDelayMs: 0 });
        mouseover(addTag('tag', '#project'));
        expect(isTooltipVisible(plugin)).toBe(true);
    });

    it('uses a 50 ms delay by default', async () => {
        const { plugin } = await setup();
        mouseover(addTag('tag', '#project'));

        vi.advanceTimersByTime(49);
        expect(isTooltipVisible(plugin)).toBe(false);
        vi.advanceTimersByTime(1);
        expect(isTooltipVisible(plugin)).toBe(true);
    });

    it('does not show the tooltip if the pointer leaves before the delay elapses', async () => {
        const { plugin } = await setup({ hoverDelayMs: 300 });
        const tag = addTag('tag', '#project');

        mouseover(tag);
        vi.advanceTimersByTime(100);
        mouseout(tag, null);
        vi.advanceTimersByTime(1000);

        expect(isTooltipVisible(plugin)).toBe(false);
    });

    it('hides the tooltip when the pointer leaves the tag', async () => {
        const { plugin } = await setup({ hoverDelayMs: 0 });
        const tag = addTag('tag', '#project');

        mouseover(tag);
        expect(isTooltipVisible(plugin)).toBe(true);

        mouseout(tag, document.body);
        expect(isTooltipVisible(plugin)).toBe(false);
    });

    it('hides the tooltip when the pointer moves onto something that is not a tag', async () => {
        const { plugin } = await setup({ hoverDelayMs: 0 });
        const tag = addTag('tag', '#project');
        const other = document.body.createDiv({ text: 'plain text' });

        mouseover(tag);
        mouseover(other);

        expect(isTooltipVisible(plugin)).toBe(false);
    });

    it('keeps the tooltip while the pointer moves between parts of the same tag', async () => {
        const { plugin } = await setup({ hoverDelayMs: 0 });
        const tag = addTag('tag', '#project');
        const inner = tag.createSpan({ text: '' });

        mouseover(tag);
        mouseout(tag, inner);
        expect(isTooltipVisible(plugin)).toBe(true);

        mouseover(inner);
        expect(isTooltipVisible(plugin)).toBe(true);
        expect(plugin.tooltipEl.textContent).toBe('Work in progress');
    });

    it('shows nothing for a tag without a description', async () => {
        const { plugin } = await setup({ hoverDelayMs: 0 });
        mouseover(addTag('tag', '#unknown'));
        expect(isTooltipVisible(plugin)).toBe(false);
    });

    it('hides a visible tooltip when the pointer moves to a tag without a description', async () => {
        const { plugin } = await setup({ hoverDelayMs: 0 });
        const described = addTag('tag', '#project');
        const undescribed = addTag('tag', '#unknown');

        mouseover(described);
        expect(isTooltipVisible(plugin)).toBe(true);

        mouseover(undescribed);
        expect(isTooltipVisible(plugin)).toBe(false);
    });

    it('matches tags case-sensitively', async () => {
        const { plugin } = await setup({ hoverDelayMs: 0 });
        mouseover(addTag('tag', '#Project'));
        expect(isTooltipVisible(plugin)).toBe(false);
    });

    it.each(['tag', 'cm-hashtag', 'metadata-property-tag'])(
        'recognizes tags rendered with the %s class',
        async (cls) => {
            const { plugin } = await setup({ hoverDelayMs: 0 });
            mouseover(addTag(cls, 'project'));
            expect(isTooltipVisible(plugin)).toBe(true);
        }
    );

    it('appends an "inherited from" line for an inherited description', async () => {
        const { plugin } = await setup({ hoverDelayMs: 0 });
        mouseover(addTag('tag', '#project/alpha'));

        expect(plugin.tooltipEl.textContent).toBe('Work in progress\n(inherited from #project)');
    });

    it('does not add the "inherited from" line to a tag\'s own description', async () => {
        const { plugin } = await setup({
            hoverDelayMs: 0,
            tagMap: { ...TAGS, '#project/alpha': 'Alpha team' },
        });
        mouseover(addTag('tag', '#project/alpha'));

        expect(plugin.tooltipEl.textContent).toBe('Alpha team');
    });

    it('shows nothing for a nested tag when inheritance is off', async () => {
        const { plugin } = await setup({ hoverDelayMs: 0, inheritFromParents: false });
        mouseover(addTag('tag', '#project/alpha'));

        expect(isTooltipVisible(plugin)).toBe(false);
    });

    it('ignores pills outside the tags property', async () => {
        const { plugin } = await setup({ hoverDelayMs: 0 });
        mouseover(addPill('aliases', 'project'));
        expect(isTooltipVisible(plugin)).toBe(false);
    });

    it('shows a tooltip for pills inside the tags property', async () => {
        const { plugin } = await setup({ hoverDelayMs: 0 });
        mouseover(addPill('tags', 'project'));

        expect(isTooltipVisible(plugin)).toBe(true);
        expect(plugin.tooltipEl.textContent).toBe('Work in progress');
    });

    it('ignores pills that are not inside any property', async () => {
        const { plugin } = await setup({ hoverDelayMs: 0 });
        const orphan = document.body.createDiv({ cls: 'multi-select-pill-content', text: 'project' });

        mouseover(orphan);
        expect(isTooltipVisible(plugin)).toBe(false);
    });

    it('ignores modifier keys in hover mode', async () => {
        const { plugin } = await setup({ hoverDelayMs: 0, triggerMode: 'hover', modifierKey: 'alt' });
        mouseover(addTag('tag', '#project'), { altKey: false });
        expect(isTooltipVisible(plugin)).toBe(true);

        keyup('Alt');
        expect(isTooltipVisible(plugin)).toBe(true);
    });

    it('hides a visible tooltip when the window loses focus', async () => {
        const { plugin } = await setup({ hoverDelayMs: 0 });
        mouseover(addTag('tag', '#project'));

        window.dispatchEvent(new Event('blur'));
        expect(isTooltipVisible(plugin)).toBe(false);
    });

    // Open bugs: see docs/BUG_LOG.md (BUG-007, BUG-008). Enable when fixed.
    it.todo('shows the tooltip when the pointer is over the # of a split tag');
});

describe('modifier mode', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    it('shows nothing while the modifier key is not held', async () => {
        const { plugin } = await setup({ triggerMode: 'modifier', modifierKey: 'alt' });
        mouseover(addTag('tag', '#project'));

        vi.advanceTimersByTime(1000);
        expect(isTooltipVisible(plugin)).toBe(false);
    });

    it('shows the tooltip immediately when the key is already held on hover, ignoring the hover delay', async () => {
        const { plugin } = await setup({ triggerMode: 'modifier', modifierKey: 'alt', hoverDelayMs: 1000 });
        mouseover(addTag('tag', '#project'), { altKey: true });

        expect(isTooltipVisible(plugin)).toBe(true);
    });

    it('shows the tooltip when the key is pressed while the pointer rests on a tag', async () => {
        const { plugin } = await setup({ triggerMode: 'modifier', modifierKey: 'alt' });
        mouseover(addTag('tag', '#project'));

        keydown('Alt', { altKey: true });
        expect(isTooltipVisible(plugin)).toBe(true);
        expect(plugin.tooltipEl.textContent).toBe('Work in progress');
    });

    it('hides the tooltip when the key is released', async () => {
        const { plugin } = await setup({ triggerMode: 'modifier', modifierKey: 'alt' });
        mouseover(addTag('tag', '#project'), { altKey: true });

        keyup('Alt', { altKey: false });
        expect(isTooltipVisible(plugin)).toBe(false);
    });

    it('keeps the tooltip when another key is released while the modifier is still held', async () => {
        const { plugin } = await setup({ triggerMode: 'modifier', modifierKey: 'alt' });
        mouseover(addTag('tag', '#project'), { altKey: true });

        keyup('a', { altKey: true });
        expect(isTooltipVisible(plugin)).toBe(true);
    });

    it('hides the tooltip when the window loses focus', async () => {
        const { plugin } = await setup({ triggerMode: 'modifier', modifierKey: 'alt' });
        mouseover(addTag('tag', '#project'), { altKey: true });

        window.dispatchEvent(new Event('blur'));
        expect(isTooltipVisible(plugin)).toBe(false);
    });

    it('does nothing when the key is pressed while no tag is hovered', async () => {
        const { plugin } = await setup({ triggerMode: 'modifier', modifierKey: 'alt' });

        keydown('Alt', { altKey: true });
        expect(isTooltipVisible(plugin)).toBe(false);
    });

    it('does not show the tooltip after the pointer left the tag and the key is pressed', async () => {
        const { plugin } = await setup({ triggerMode: 'modifier', modifierKey: 'alt' });
        const tag = addTag('tag', '#project');

        mouseover(tag);
        mouseout(tag, null);
        keydown('Alt', { altKey: true });

        expect(isTooltipVisible(plugin)).toBe(false);
    });

    it('uses Shift when configured', async () => {
        const { plugin } = await setup({ triggerMode: 'modifier', modifierKey: 'shift' });
        const tag = addTag('tag', '#project');

        mouseover(tag, { altKey: true });
        expect(isTooltipVisible(plugin)).toBe(false);

        mouseover(tag, { shiftKey: true });
        expect(isTooltipVisible(plugin)).toBe(true);
    });

    it('maps mod to Ctrl on Windows and Linux', async () => {
        Platform.isMacOS = false;
        const { plugin } = await setup({ triggerMode: 'modifier', modifierKey: 'mod' });
        const tag = addTag('tag', '#project');

        mouseover(tag, { metaKey: true });
        expect(isTooltipVisible(plugin)).toBe(false);

        mouseover(tag, { ctrlKey: true });
        expect(isTooltipVisible(plugin)).toBe(true);
    });

    it('maps mod to Cmd on macOS', async () => {
        Platform.isMacOS = true;
        const { plugin } = await setup({ triggerMode: 'modifier', modifierKey: 'mod' });
        const tag = addTag('tag', '#project');

        mouseover(tag, { ctrlKey: true });
        expect(isTooltipVisible(plugin)).toBe(false);

        mouseover(tag, { metaKey: true });
        expect(isTooltipVisible(plugin)).toBe(true);
    });
});

describe('tooltip position', () => {
    const originalWidth = window.innerWidth;

    beforeEach(() => {
        vi.useFakeTimers();
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 });
    });

    afterEach(() => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
    });

    async function place(rect: { top: number; bottom: number; left: number }) {
        const { plugin } = await setup({ hoverDelayMs: 0 });
        setSize(plugin.tooltipEl, { width: 80, height: 20 });
        const tag = addTag('tag', '#project');
        setRect(tag, rect);

        mouseover(tag);
        return plugin.tooltipEl.style;
    }

    it('places the tooltip above the tag', async () => {
        const style = await place({ top: 100, bottom: 120, left: 50 });
        expect(style.top).toBe('78px');
        expect(style.left).toBe('50px');
    });

    it('places the tooltip below the tag when there is no room above', async () => {
        const style = await place({ top: 5, bottom: 25, left: 50 });
        expect(style.top).toBe('27px');
    });

    it('keeps the tooltip inside the right edge of the viewport', async () => {
        expect((await place({ top: 100, bottom: 120, left: 990 })).left).toBe('905px');
    });

    it('keeps the tooltip inside the left edge of the viewport', async () => {
        expect((await place({ top: 100, bottom: 120, left: 2 })).left).toBe('15px');
    });
});

describe('plugin lifecycle', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    it('creates one hidden tooltip container on load', async () => {
        const { plugin } = await setup();

        expect(document.querySelectorAll('.tag-tooltip-container')).toHaveLength(1);
        expect(isTooltipVisible(plugin)).toBe(false);
    });

    it('removes the tooltip element on unload', async () => {
        const { plugin } = await setup();
        plugin.unload();

        expect(document.querySelector('.tag-tooltip-container')).toBeNull();
    });

    it('cancels a pending tooltip on unload', async () => {
        const { plugin } = await setup({ hoverDelayMs: 300 });
        mouseover(addTag('tag', '#project'));

        plugin.unload();
        expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
        expect(document.querySelector('.tag-tooltip-container')).toBeNull();
    });

    it('stops reacting to hover events after unload', async () => {
        const { plugin } = await setup({ hoverDelayMs: 0 });
        const tag = addTag('tag', '#project');
        plugin.unload();

        expect(() => mouseover(tag)).not.toThrow();
        expect(document.querySelector('.tag-tooltip-container')).toBeNull();
    });
});

describe('windows', () => {
    // Open bug: see docs/BUG_LOG.md (BUG-008). Enable when fixed.
    it.todo('shows the tooltip for a tag in a pop-out window');
});