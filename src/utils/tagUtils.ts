/**
 * Pure tag helpers. This module must not import from `obsidian`, so it can be
 * unit tested without the app. Obsidian-dependent helpers live in `vaultUtils.ts`.
 */

export function formatTag(text = ''): string {
    const clean = text.replace(/#/g, '').trim();
    return clean ? `#${clean}` : '';
}

export interface ResolvedDescription {
    description: string;
    /** The tag the description belongs to: the tag itself, or the parent it was inherited from. */
    source: string;
}

/**
 * Finds the description for a tag. With `inherit`, a nested tag such as `#a/b/c`
 * falls back to the closest ancestor that has one (`#a/b`, then `#a`).
 */
export function resolveDescription(
    tagMap: Record<string, string>,
    tag: string,
    inherit: boolean
): ResolvedDescription | null {
    const own = tagMap[tag];
    if (own) return { description: own, source: tag };
    if (!inherit) return null;

    let cursor = tag;
    for (;;) {
        const slash = cursor.lastIndexOf('/');
        if (slash <= 1) return null;

        cursor = cursor.slice(0, slash);
        const parent = tagMap[cursor];
        if (parent) return { description: parent, source: cursor };
    }
}

/** Tooltip text for a tag, or undefined when it has no (inherited) description. */
export function getTooltipText(
    tagMap: Record<string, string>,
    tag: string,
    inherit: boolean
): string | undefined {
    const resolved = resolveDescription(tagMap, tag, inherit);
    if (!resolved) return undefined;

    return resolved.source === tag
        ? resolved.description
        : `${resolved.description}\n(inherited from ${resolved.source})`;
}

/** Normalizes a list of ignored tags: strings only, `#tag` format, no duplicates. */
export function sanitizeIgnoredTags(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];

    const tags = (raw as unknown[])
        .filter((t): t is string => typeof t === 'string')
        .map((t) => formatTag(t))
        .filter((t) => t.length >= 2);

    return [...new Set(tags)];
}

type SanitizedMap = { map: Record<string, string>; skipped: number };

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Keeps only valid `tag -> description` entries of a flat object. Keys are
 * normalised to `#tag`, values must be non-empty strings. A key named `tagMap`
 * is just another (invalid) entry here. Use this for data that is known to be
 * a tag map, such as the saved settings.
 */
export function sanitizeFlatTagMap(raw: unknown): SanitizedMap {
    const map: Record<string, string> = {};
    let skipped = 0;
    if (!isPlainObject(raw)) return { map, skipped };

    for (const [key, value] of Object.entries(raw)) {
        const tag = formatTag(key);
        const desc = typeof value === 'string' ? value.trim() : '';
        if (tag.length < 2 || !desc) {
            skipped++;
            continue;
        }
        map[tag] = desc;
    }

    return { map, skipped };
}

/**
 * Reads the tag map out of an imported file. Accepts a flat map (1.0.0
 * backups) or a `{ tagMap, ignoredTags }` backup object, from which only
 * `tagMap` is read.
 */
export function sanitizeTagMap(raw: unknown): SanitizedMap {
    if (!isPlainObject(raw)) return { map: {}, skipped: 0 };

    const isBackupObject = 'tagMap' in raw || 'ignoredTags' in raw;
    return sanitizeFlatTagMap(isBackupObject ? raw.tagMap ?? {} : raw);
}