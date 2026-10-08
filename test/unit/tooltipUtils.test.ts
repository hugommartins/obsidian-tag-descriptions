import { describe, expect, it } from 'vitest';
import { computeTooltipPosition, isModifierHeld } from '../../src/utils/tooltipUtils';

const none = { altKey: false, shiftKey: false, ctrlKey: false, metaKey: false };

describe('isModifierHeld', () => {
    it('reads alt and shift directly', () => {
        expect(isModifierHeld({ ...none, altKey: true }, 'alt', false)).toBe(true);
        expect(isModifierHeld({ ...none, shiftKey: true }, 'shift', false)).toBe(true);
        expect(isModifierHeld(none, 'alt', false)).toBe(false);
        expect(isModifierHeld(none, 'shift', false)).toBe(false);
    });

    it('maps mod to Ctrl on Windows and Linux', () => {
        expect(isModifierHeld({ ...none, ctrlKey: true }, 'mod', false)).toBe(true);
        expect(isModifierHeld({ ...none, metaKey: true }, 'mod', false)).toBe(false);
    });

    it('maps mod to Cmd on macOS', () => {
        expect(isModifierHeld({ ...none, metaKey: true }, 'mod', true)).toBe(true);
        expect(isModifierHeld({ ...none, ctrlKey: true }, 'mod', true)).toBe(false);
    });

    it('does not mistake one modifier for another', () => {
        expect(isModifierHeld({ ...none, shiftKey: true }, 'alt', false)).toBe(false);
        expect(isModifierHeld({ ...none, altKey: true }, 'shift', false)).toBe(false);
    });
});

describe('computeTooltipPosition', () => {
    const tooltip = { width: 80, height: 20 };

    it('places the tooltip above the target', () => {
        expect(computeTooltipPosition({ top: 100, bottom: 120, left: 50 }, tooltip, 1000)).toEqual({
            top: 78,
            left: 50,
        });
    });

    it('flips below the target when there is no room above', () => {
        expect(computeTooltipPosition({ top: 10, bottom: 30, left: 50 }, tooltip, 1000)).toEqual({
            top: 32,
            left: 50,
        });
    });

    it('stays above when it fits exactly at the top edge', () => {
        expect(computeTooltipPosition({ top: 22, bottom: 40, left: 50 }, tooltip, 1000).top).toBe(0);
    });

    it('keeps the tooltip inside the right edge of the viewport', () => {
        expect(computeTooltipPosition({ top: 100, bottom: 120, left: 990 }, tooltip, 1000).left).toBe(905);
    });

    it('keeps the tooltip inside the left edge of the viewport', () => {
        expect(computeTooltipPosition({ top: 100, bottom: 120, left: 3 }, tooltip, 1000).left).toBe(15);
    });

    it('uses the left padding when the tooltip is wider than the viewport', () => {
        expect(computeTooltipPosition({ top: 100, bottom: 120, left: 50 }, { width: 2000, height: 20 }, 1000).left).toBe(15);
    });

    it('honors custom offset and padding', () => {
        const placed = computeTooltipPosition({ top: 100, bottom: 120, left: 0 }, tooltip, 1000, 10, 40);
        expect(placed).toEqual({ top: 70, left: 40 });
    });
});