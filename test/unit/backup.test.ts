import { describe, expect, it } from 'vitest';
import { createBackup, describeImport, mergeBackup } from '../../src/utils/backup';

const empty = { tagMap: {}, ignoredTags: [] };

describe('createBackup', () => {
    it('contains both the tag map and the ignored tags', () => {
        expect(createBackup({ tagMap: { '#a': 'A' }, ignoredTags: ['#x'] })).toEqual({
            tagMap: { '#a': 'A' },
            ignoredTags: ['#x'],
        });
    });

    it('returns copies, not references to the live settings', () => {
        const source = { tagMap: { '#a': 'A' }, ignoredTags: ['#x'] };
        const backup = createBackup(source);

        backup.tagMap['#b'] = 'B';
        backup.ignoredTags.push('#y');

        expect(source.tagMap).toEqual({ '#a': 'A' });
        expect(source.ignoredTags).toEqual(['#x']);
    });
});

describe('mergeBackup', () => {
    it('imports a backup in the current format', () => {
        const result = mergeBackup(empty, { tagMap: { '#a': 'A' }, ignoredTags: ['#x'] });
        expect(result).toEqual({
            tagMap: { '#a': 'A' },
            ignoredTags: ['#x'],
            imported: 1,
            importedIgnored: 1,
            skipped: 0,
        });
    });

    it('imports a 1.0.0 flat backup and normalizes its keys', () => {
        const result = mergeBackup(empty, { a: 'A', '#b': 'B' });
        expect(result.tagMap).toEqual({ '#a': 'A', '#b': 'B' });
        expect(result.ignoredTags).toEqual([]);
        expect(result.imported).toBe(2);
    });

    it('imports a file that only contains ignored tags', () => {
        const result = mergeBackup(empty, { ignoredTags: ['#x', '#y'] });
        expect(result.tagMap).toEqual({});
        expect(result.ignoredTags).toEqual(['#x', '#y']);
        expect(result.imported).toBe(0);
        expect(result.importedIgnored).toBe(2);
    });

    it('overwrites existing descriptions with imported ones', () => {
        const result = mergeBackup({ tagMap: { '#a': 'old', '#keep': 'kept' }, ignoredTags: [] }, { tagMap: { '#a': 'new' } });
        expect(result.tagMap).toEqual({ '#a': 'new', '#keep': 'kept' });
    });

    it('merges ignored tags with the existing list without duplicates', () => {
        const result = mergeBackup({ tagMap: {}, ignoredTags: ['#x', '#y'] }, { ignoredTags: ['#y', '#z'] });
        expect(result.ignoredTags).toEqual(['#x', '#y', '#z']);
    });

    it('counts invalid entries as skipped', () => {
        const result = mergeBackup(empty, { tagMap: { '#a': 'A', '#b': 5, '#c': '' } });
        expect(result.imported).toBe(1);
        expect(result.skipped).toBe(2);
    });

    it('does not modify the current data', () => {
        const current = { tagMap: { '#a': 'A' }, ignoredTags: ['#x'] };
        mergeBackup(current, { tagMap: { '#b': 'B' }, ignoredTags: ['#y'] });
        expect(current).toEqual({ tagMap: { '#a': 'A' }, ignoredTags: ['#x'] });
    });

    it.each([null, undefined, 'text', 7, []])('imports nothing from %j', (raw) => {
        const result = mergeBackup({ tagMap: { '#a': 'A' }, ignoredTags: ['#x'] }, raw);
        expect(result.imported).toBe(0);
        expect(result.importedIgnored).toBe(0);
        expect(result.tagMap).toEqual({ '#a': 'A' });
        expect(result.ignoredTags).toEqual(['#x']);
    });

    it('reproduces the same data after an export and import round trip', () => {
        const original = { tagMap: { '#a': 'A', '#b/c': 'B/C' }, ignoredTags: ['#x', '#y'] };
        const file = JSON.stringify(createBackup(original));

        const restored = mergeBackup(empty, JSON.parse(file));

        expect(restored.tagMap).toEqual(original.tagMap);
        expect(restored.ignoredTags).toEqual(original.ignoredTags);
    });
});

describe('describeImport', () => {
    it('reports imported tags', () => {
        expect(describeImport({ imported: 2, importedIgnored: 0, skipped: 0 })).toBe('Imported 2 tags.');
    });

    it('uses the singular for one tag', () => {
        expect(describeImport({ imported: 1, importedIgnored: 0, skipped: 0 })).toBe('Imported 1 tag.');
    });

    it('mentions ignored tags when present', () => {
        expect(describeImport({ imported: 2, importedIgnored: 1, skipped: 0 })).toBe(
            'Imported 2 tags and 1 ignored tag.'
        );
        expect(describeImport({ imported: 0, importedIgnored: 3, skipped: 0 })).toBe(
            'Imported 0 tags and 3 ignored tags.'
        );
    });

    it('reports skipped entries', () => {
        expect(describeImport({ imported: 2, importedIgnored: 0, skipped: 4 })).toBe(
            'Imported 2 tags, skipped 4 invalid entries.'
        );
    });
});