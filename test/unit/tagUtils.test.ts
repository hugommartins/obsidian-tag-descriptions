import { describe, expect, it } from 'vitest';
import {
    formatTag,
    getTooltipText,
    resolveDescription,
    sanitizeFlatTagMap,
    sanitizeIgnoredTags,
    sanitizeTagMap,
} from '../../src/utils/tagUtils';

describe('formatTag', () => {
    it.each([
        ['tag', '#tag'],
        ['#tag', '#tag'],
        [' tag ', '#tag'],
        ['##tag', '#tag'],
        ['  #tag  ', '#tag'],
    ])('normalizes %j to %j', (input, expected) => {
        expect(formatTag(input)).toBe(expected);
    });

    it('returns an empty string for empty input, whitespace and a lone #', () => {
        expect(formatTag('')).toBe('');
        expect(formatTag('   ')).toBe('');
        expect(formatTag('#')).toBe('');
        expect(formatTag()).toBe('');
    });

    it('keeps the slashes of nested tags', () => {
        expect(formatTag('a/b')).toBe('#a/b');
        expect(formatTag('#a/b/c')).toBe('#a/b/c');
    });

    it('removes every # that is not at the start', () => {
        expect(formatTag('a#b')).toBe('#ab');
    });

    it('keeps letter case', () => {
        expect(formatTag('Project')).toBe('#Project');
    });
});

describe('resolveDescription', () => {
    const map = {
        '#project': 'Work in progress',
        '#project/alpha': 'Alpha team',
        '#a/b': 'Parent b',
    };

    it('returns the tag\'s own description over any parent', () => {
        expect(resolveDescription(map, '#project/alpha', true)).toEqual({
            description: 'Alpha team',
            source: '#project/alpha',
        });
    });

    it('falls back to the nearest ancestor that has a description', () => {
        expect(resolveDescription(map, '#project/alpha/beta', true)).toEqual({
            description: 'Alpha team',
            source: '#project/alpha',
        });
        expect(resolveDescription(map, '#project/other/deep', true)).toEqual({
            description: 'Work in progress',
            source: '#project',
        });
    });

    it('skips ancestors without a description', () => {
        expect(resolveDescription(map, '#a/b/c/d', true)?.source).toBe('#a/b');
    });

    it('returns null for an undescribed tag when inheritance is off', () => {
        expect(resolveDescription(map, '#project/beta', false)).toBeNull();
    });

    it('still returns the own description when inheritance is off', () => {
        expect(resolveDescription(map, '#project/alpha', false)?.source).toBe('#project/alpha');
    });

    it('returns null for an undescribed tag without a slash', () => {
        expect(resolveDescription(map, '#unknown', true)).toBeNull();
    });

    it('returns null when no ancestor has a description', () => {
        expect(resolveDescription(map, '#x/y/z', true)).toBeNull();
    });

    it.each(['#/x', '#a/', '#a//b', '#', '#/', '#a/b/c/d/e/f/g/h'])(
        'does not loop or throw for the odd tag shape %j',
        (tag) => {
            expect(() => resolveDescription(map, tag, true)).not.toThrow();
        }
    );

    it('does not treat a leading slash as a parent', () => {
        expect(resolveDescription({ '#': 'bad' }, '#/x', true)).toBeNull();
    });

    it('reports the tag itself as the source of its own description', () => {
        expect(resolveDescription(map, '#project', true)?.source).toBe('#project');
    });
});

describe('getTooltipText', () => {
    const map = { '#project': 'Work in progress' };

    it('returns just the description for a tag with its own', () => {
        expect(getTooltipText(map, '#project', true)).toBe('Work in progress');
    });

    it('adds an "inherited from" line for an inherited description', () => {
        expect(getTooltipText(map, '#project/alpha', true)).toBe(
            'Work in progress\n(inherited from #project)'
        );
    });

    it('returns undefined when there is no description', () => {
        expect(getTooltipText(map, '#other', true)).toBeUndefined();
        expect(getTooltipText(map, '#project/alpha', false)).toBeUndefined();
    });
});

describe('sanitizeTagMap', () => {
    it('accepts a flat tag-to-description map', () => {
        expect(sanitizeTagMap({ '#a': 'A', '#b': 'B' })).toEqual({
            map: { '#a': 'A', '#b': 'B' },
            skipped: 0,
        });
    });

    it('accepts the { tagMap } wrapper format', () => {
        const result = sanitizeTagMap({ tagMap: { '#a': 'A' }, ignoredTags: ['#x'] });
        expect(result.map).toEqual({ '#a': 'A' });
        expect(result.skipped).toBe(0);
    });

    it('returns an empty map for a backup that only has ignored tags', () => {
        expect(sanitizeTagMap({ ignoredTags: ['#x'] })).toEqual({ map: {}, skipped: 0 });
    });

    it('ignores non-tag entries such as confirmDelete', () => {
        const result = sanitizeTagMap({ tagMap: { '#a': 'A' }, confirmDelete: true });
        expect(result.map).toEqual({ '#a': 'A' });
        expect(Object.keys(result.map)).not.toContain('#confirmDelete');
    });

    it('does not turn settings keys of a flat map into tags with non-text values', () => {
        const result = sanitizeTagMap({ '#a': 'A', confirmDelete: true, tagMap: undefined });
        expect(result.map['#confirmDelete']).toBeUndefined();
    });

    it('skips non-string and empty descriptions and counts them', () => {
        const result = sanitizeTagMap({
            '#ok': 'fine',
            '#number': 5,
            '#object': { a: 1 },
            '#null': null,
            '#empty': '',
            '#blank': '   ',
        });
        expect(result.map).toEqual({ '#ok': 'fine' });
        expect(result.skipped).toBe(5);
    });

    it('adds a leading # to keys that lack one', () => {
        expect(sanitizeTagMap({ plain: 'x', '##double': 'y' }).map).toEqual({
            '#plain': 'x',
            '#double': 'y',
        });
    });

    it('skips keys that are empty after normalization', () => {
        const result = sanitizeTagMap({ '': 'x', '#': 'y', '  ': 'z' });
        expect(result.map).toEqual({});
        expect(result.skipped).toBe(3);
    });

    it('trims descriptions', () => {
        expect(sanitizeTagMap({ '#a': '  spaced  ' }).map['#a']).toBe('spaced');
    });

    it.each([null, undefined, [], ['#a'], 'text', 42, true])(
        'returns an empty map for %j',
        (input) => {
            expect(sanitizeTagMap(input)).toEqual({ map: {}, skipped: 0 });
        }
    );

    it('returns an empty map when tagMap itself is not an object', () => {
        expect(sanitizeTagMap({ tagMap: 'nope' })).toEqual({ map: {}, skipped: 0 });
        expect(sanitizeTagMap({ tagMap: ['#a'] })).toEqual({ map: {}, skipped: 0 });
        expect(sanitizeTagMap({ tagMap: null }).map).toEqual({});
    });

    it('does not let a __proto__ key change the prototype', () => {
        const parsed: unknown = JSON.parse('{"__proto__": {"polluted": "yes"}, "#a": "A"}');
        const result = sanitizeTagMap(parsed);

        expect(Object.getPrototypeOf(result.map)).toBe(Object.prototype);
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
        expect(result.map).toEqual({ '#a': 'A' });
        expect(result.skipped).toBe(1);
    });

    it('stores keys named constructor and toString as ordinary tags', () => {
        const result = sanitizeTagMap({ constructor: 'c', toString: 't' });
        expect(result.map).toEqual({ '#constructor': 'c', '#toString': 't' });
    });
});

describe('sanitizeFlatTagMap', () => {
    it('treats a key named tagMap as an invalid entry, not as a wrapper', () => {
        const result = sanitizeFlatTagMap({ '#ok': 'fine', tagMap: { '#nested': 'x' }, confirmDelete: true });
        expect(result.map).toEqual({ '#ok': 'fine' });
        expect(result.skipped).toBe(2);
    });

    it('normalizes keys and trims values', () => {
        expect(sanitizeFlatTagMap({ a: ' A ' }).map).toEqual({ '#a': 'A' });
    });

    it.each([null, undefined, [], 'text', 7])('returns an empty map for %j', (input) => {
        expect(sanitizeFlatTagMap(input)).toEqual({ map: {}, skipped: 0 });
    });
});

describe('sanitizeIgnoredTags', () => {
    it('drops non-strings, normalizes tags and removes duplicates', () => {
        expect(sanitizeIgnoredTags(['#a', 'a', '##a', 5, null, { x: 1 }, 'b', '#b', ' c '])).toEqual([
            '#a',
            '#b',
            '#c',
        ]);
    });

    it('drops entries that are empty after normalization', () => {
        expect(sanitizeIgnoredTags(['', '#', '   ', '#ok'])).toEqual(['#ok']);
    });

    it.each([undefined, null, 'text', 42, {}, true])('returns an empty list for %j', (input) => {
        expect(sanitizeIgnoredTags(input)).toEqual([]);
    });

    it('keeps the order of first appearance', () => {
        expect(sanitizeIgnoredTags(['#b', '#a', '#b'])).toEqual(['#b', '#a']);
    });
});