import { Editor } from 'obsidian';

interface ClickableToken {
    type: string;
    text: string;
}

type InternalEditor = Editor & {
    getClickableTokenAt: (cursor: { line: number; ch: number }) => ClickableToken | null;
};

export function formatTag(text = ''): string {
    const clean = text.replace(/#/g, '').trim();
    return clean ? `#${clean}` : '';
}

export function getTagAtCursor(editor: Editor): string | null {
    const cursor = editor.getCursor();
    
    const internalEditor = editor as InternalEditor;
    const token = internalEditor.getClickableTokenAt(cursor);

    if (token && token.type === 'tag') {
        return token.text;
    }
    return null;
}