import { App, Editor, getAllTags } from 'obsidian';

interface ClickableToken {
    type: string;
    text: string;
}

type InternalEditor = Editor & {
    getClickableTokenAt?: (cursor: { line: number; ch: number }) => ClickableToken | null;
};

export function formatTag(text = ''): string {
    const clean = text.replace(/#/g, '').trim();
    return clean ? `#${clean}` : '';
}

export function getTagAtCursor(editor: Editor): string | null {
    const internalEditor = editor as InternalEditor;
    // Internal Obsidian API: may disappear in a future release.
    if (typeof internalEditor.getClickableTokenAt !== 'function') return null;

    const token = internalEditor.getClickableTokenAt(editor.getCursor());
    return token && token.type === 'tag' ? token.text : null;
}

/** Maps every tag used in the vault (inline and frontmatter) to the number of notes using it. */
export function collectVaultTags(app: App): Map<string, number> {
    const counts = new Map<string, number>();

    for (const file of app.vault.getMarkdownFiles()) {
        const cache = app.metadataCache.getFileCache(file);
        const tags = cache ? getAllTags(cache) : null;
        if (!tags) continue;

        for (const tag of new Set(tags)) {
            counts.set(tag, (counts.get(tag) ?? 0) + 1);
        }
    }

    return counts;
}

/**
 * Keeps only valid `tag -> description` entries. Keys are normalised to `#tag`,
 * values must be non-empty strings. Accepts a flat map or a `{ tagMap: {...} }`
 * wrapper (the format older docs described).
 */
export function sanitizeTagMap(raw: unknown): { map: Record<string, string>; skipped: number } {
    const map: Record<string, string> = {};
    let skipped = 0;

    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        return { map, skipped };
    }

    const source = (raw as { tagMap?: unknown }).tagMap ?? raw;
    if (typeof source !== 'object' || source === null || Array.isArray(source)) {
        return { map, skipped };
    }

    const entries = Object.entries(source as Record<string, unknown>) as [string, unknown][];
    for (const [key, value] of entries) {
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