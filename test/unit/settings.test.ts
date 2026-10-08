import { describe, expect, it } from 'vitest';
import {
    DEFAULT_SETTINGS,
    MAX_HOVER_DELAY_MS,
    MIN_HOVER_DELAY_MS,
    isOneOf,
    normalizeSettings,
} from '../../src/settings';

describe('settings loading', () => {
    it('returns the defaults when there is no saved data', () => {
        expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
        expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    });

    it.each([[[]], ['text'], [42], [true]])('returns the defaults for saved data of %j', (raw) => {
        expect(normalizeSettings(raw)).toEqual(DEFAULT_SETTINGS);
    });

    it('fills new fields with defaults when loading pre-1.1 data', () => {
        const loaded = normalizeSettings({ tagMap: { '#a': 'A' }, confirmDelete: false });

        expect(loaded.tagMap).toEqual({ '#a': 'A' });
        expect(loaded.confirmDelete).toBe(false);
        expect(loaded.ignoredTags).toEqual([]);
        expect(loaded.inheritFromParents).toBe(DEFAULT_SETTINGS.inheritFromParents);
        expect(loaded.triggerMode).toBe(DEFAULT_SETTINGS.triggerMode);
        expect(loaded.hoverDelayMs).toBe(DEFAULT_SETTINGS.hoverDelayMs);
        expect(loaded.modifierKey).toBe(DEFAULT_SETTINGS.modifierKey);
    });

    it('keeps valid saved preferences', () => {
        const saved = {
            tagMap: { '#a': 'A' },
            ignoredTags: ['#x'],
            confirmDelete: false,
            inheritFromParents: false,
            triggerMode: 'modifier',
            hoverDelayMs: 300,
            modifierKey: 'shift',
        };
        expect(normalizeSettings(saved)).toEqual(saved);
    });

    it('falls back to defaults for an invalid trigger mode or modifier key', () => {
        const loaded = normalizeSettings({ triggerMode: 'click', modifierKey: 'super' });
        expect(loaded.triggerMode).toBe(DEFAULT_SETTINGS.triggerMode);
        expect(loaded.modifierKey).toBe(DEFAULT_SETTINGS.modifierKey);
    });

    it('falls back to defaults for non-boolean toggles', () => {
        const loaded = normalizeSettings({ confirmDelete: 'no', inheritFromParents: 0 });
        expect(loaded.confirmDelete).toBe(DEFAULT_SETTINGS.confirmDelete);
        expect(loaded.inheritFromParents).toBe(DEFAULT_SETTINGS.inheritFromParents);
    });

    it('clamps the hover delay to the allowed range', () => {
        expect(normalizeSettings({ hoverDelayMs: 5000 }).hoverDelayMs).toBe(MAX_HOVER_DELAY_MS);
        expect(normalizeSettings({ hoverDelayMs: -20 }).hoverDelayMs).toBe(MIN_HOVER_DELAY_MS);
        expect(normalizeSettings({ hoverDelayMs: 0 }).hoverDelayMs).toBe(0);
        expect(normalizeSettings({ hoverDelayMs: 1000 }).hoverDelayMs).toBe(1000);
    });

    it.each([[Number.NaN], [Number.POSITIVE_INFINITY], ['200'], [null], [{}]])(
        'falls back to the default delay for %j',
        (value) => {
            expect(normalizeSettings({ hoverDelayMs: value }).hoverDelayMs).toBe(
                DEFAULT_SETTINGS.hoverDelayMs
            );
        }
    );

    it('normalizes, filters and deduplicates ignored tags', () => {
        const loaded = normalizeSettings({ ignoredTags: ['a', '#a', 3, '', '#b'] });
        expect(loaded.ignoredTags).toEqual(['#a', '#b']);
    });

    it('uses an empty ignored list when it is not an array', () => {
        expect(normalizeSettings({ ignoredTags: 'x' }).ignoredTags).toEqual([]);
    });

    it('drops corrupted tagMap entries and keeps valid ones', () => {
        const loaded = normalizeSettings({
            tagMap: { '#ok': 'fine', tagMap: { '#nested': 'x' }, confirmDelete: true, '#n': 5 },
        });
        expect(loaded.tagMap).toEqual({ '#ok': 'fine' });
    });

    it('uses an empty tag map when it is not an object', () => {
        expect(normalizeSettings({ tagMap: 'x' }).tagMap).toEqual({});
        expect(normalizeSettings({ tagMap: [] }).tagMap).toEqual({});
    });

    it('does not share mutable defaults between loads', () => {
        const first = normalizeSettings(null);
        first.tagMap['#x'] = 'changed';
        first.ignoredTags.push('#x');

        const second = normalizeSettings(null);
        expect(second.tagMap).toEqual({});
        expect(second.ignoredTags).toEqual([]);
        expect(DEFAULT_SETTINGS.tagMap).toEqual({});
        expect(DEFAULT_SETTINGS.ignoredTags).toEqual([]);
    });
});

describe('isOneOf', () => {
    it('accepts listed strings and rejects everything else', () => {
        const list = ['a', 'b'] as const;
        expect(isOneOf(list, 'a')).toBe(true);
        expect(isOneOf(list, 'c')).toBe(false);
        expect(isOneOf(list, 1)).toBe(false);
        expect(isOneOf(list, undefined)).toBe(false);
    });
});