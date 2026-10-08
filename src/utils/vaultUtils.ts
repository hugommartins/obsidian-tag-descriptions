import { App, Editor, getAllTags } from 'obsidian';

interface ClickableToken {
    type: string;
    text: string;
}

type InternalEditor = Editor & {
    getClickableTokenAt?: (cursor: { line: number; ch: number }) => ClickableToken | null;
};

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