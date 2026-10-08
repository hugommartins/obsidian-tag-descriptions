import { sanitizeIgnoredTags, sanitizeTagMap } from './tagUtils';

/** The data that travels in a backup file. */
export interface BackupData {
    tagMap: Record<string, string>;
    ignoredTags: string[];
}

export interface ImportResult extends BackupData {
    /** Descriptions found in the file. */
    imported: number;
    /** Ignored tags found in the file. */
    importedIgnored: number;
    /** Entries in the file that were not valid tag-to-text pairs. */
    skipped: number;
}

export function createBackup(data: BackupData): BackupData {
    return {
        tagMap: { ...data.tagMap },
        ignoredTags: [...data.ignoredTags],
    };
}

/**
 * Merges a parsed backup file into the current data without mutating it.
 * Descriptions in the file overwrite existing ones; ignored tags are added.
 * Accepts the current format and 1.0.0 flat backups.
 */
export function mergeBackup(current: BackupData, raw: unknown): ImportResult {
    const { map, skipped } = sanitizeTagMap(raw);
    const ignoredRaw = typeof raw === 'object' && raw !== null
        ? (raw as { ignoredTags?: unknown }).ignoredTags
        : undefined;
    const ignored = sanitizeIgnoredTags(ignoredRaw);

    return {
        tagMap: { ...current.tagMap, ...map },
        ignoredTags: [...new Set([...current.ignoredTags, ...ignored])],
        imported: Object.keys(map).length,
        importedIgnored: ignored.length,
        skipped,
    };
}

export function describeImport(
    result: Pick<ImportResult, 'imported' | 'importedIgnored' | 'skipped'>
): string {
    const { imported, importedIgnored, skipped } = result;

    let message = `Imported ${imported} ${imported === 1 ? 'tag' : 'tags'}`;
    if (importedIgnored) {
        message += ` and ${importedIgnored} ignored ${importedIgnored === 1 ? 'tag' : 'tags'}`;
    }
    message += skipped ? `, skipped ${skipped} invalid entries.` : '.';
    return message;
}