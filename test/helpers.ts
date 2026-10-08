import TagTooltipsPlugin from '../src/main';
import { App, type FakeCache } from './mocks/obsidian';
import type { TagTooltipSettings } from '../src/settings';

export interface PluginOptions {
    /** Contents of data.json before the plugin loads. */
    data?: Partial<Record<keyof TagTooltipSettings, unknown>> | null;
    /** Markdown files in the fake vault: path -> metadata cache. */
    files?: Record<string, FakeCache | null>;
}

export interface Harness {
    app: App;
    plugin: TagTooltipsPlugin;
}

/** Loads the real plugin against the stubbed Obsidian app and waits until it is ready. */
export async function createPlugin(options: PluginOptions = {}): Promise<Harness> {
    const app = new App();
    for (const [path, cache] of Object.entries(options.files ?? {})) app.__files.set(path, cache);

    const plugin = new TagTooltipsPlugin(app as never, { id: 'tag-descriptions', version: 'test' } as never);
    (plugin as unknown as { __data: unknown }).__data = options.data ?? null;

    plugin.onload();
    await plugin.ready;
    return { app, plugin };
}

/** What is currently saved in the fake data.json. */
export function savedData(plugin: TagTooltipsPlugin): Partial<TagTooltipSettings> {
    return (plugin as unknown as { __data: Partial<TagTooltipSettings> }).__data;
}

/** Lets pending promise callbacks run. Safe with fake timers, unlike awaiting a timeout. */
export async function flush(): Promise<void> {
    for (let i = 0; i < 20; i++) await Promise.resolve();
}

// ---------------------------------------------------------------------------
// Tag elements and events
// ---------------------------------------------------------------------------

/** Appends an element carrying one of the plugin's tag classes. */
export function addTag(cls: string, text: string, parent: HTMLElement = document.body): HTMLElement {
    const el = parent.createEl('span', { cls, text });
    return el;
}

/** A pill inside the Properties view, under the given property key. */
export function addPill(propertyKey: string, text: string): HTMLElement {
    const prop = document.body.createDiv({ attr: { 'data-property-key': propertyKey } });
    return prop.createDiv({ cls: 'multi-select-pill-content', text });
}

export interface ModifierInit {
    altKey?: boolean;
    shiftKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
}

export function mouseover(target: Element, init: ModifierInit = {}): void {
    target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, ...init }));
}

export function mouseout(target: Element, relatedTarget: Element | null = null): void {
    target.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget }));
}

export function keydown(key: string, init: ModifierInit = {}): void {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
}

export function keyup(key: string, init: ModifierInit = {}): void {
    document.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, ...init }));
}

export function isTooltipVisible(plugin: TagTooltipsPlugin): boolean {
    return plugin.tooltipEl.classList.contains('is-active');
}

/** Gives an element a fixed bounding box, since the DOM has no layout in tests. */
export function setRect(el: Element, rect: { top: number; bottom: number; left: number }): void {
    el.getBoundingClientRect = () => ({
        ...rect,
        right: rect.left + 10,
        width: 10,
        height: rect.bottom - rect.top,
        x: rect.left,
        y: rect.top,
        toJSON: () => ({}),
    });
}

export function setSize(el: HTMLElement, size: { width: number; height: number }): void {
    Object.defineProperty(el, 'offsetWidth', { configurable: true, value: size.width });
    Object.defineProperty(el, 'offsetHeight', { configurable: true, value: size.height });
}

// ---------------------------------------------------------------------------
// Settings tab and modals
// ---------------------------------------------------------------------------

export function renderSettingsTab(plugin: TagTooltipsPlugin): HTMLElement {
    const tab = (plugin as unknown as { settingTabs: { display(): void; containerEl: HTMLElement }[] }).settingTabs[0];
    tab.display();
    document.body.appendChild(tab.containerEl);
    return tab.containerEl;
}

export function settingsTab(plugin: TagTooltipsPlugin) {
    return (plugin as unknown as {
        settingTabs: {
            display(): void;
            containerEl: HTMLElement;
            importFromText(text: string): Promise<void>;
            exportLibrary(): void;
        }[];
    }).settingTabs[0];
}

export function settingNamed(root: ParentNode, name: string): HTMLElement {
    const match = [...root.querySelectorAll<HTMLElement>('.setting-item')].find(
        (s) => s.querySelector('.setting-item-name')?.textContent === name
    );
    if (!match) throw new Error(`No setting named "${name}"`);
    return match;
}

/** Settings whose name starts with the given text (for names that include counts). */
export function settingStartingWith(root: ParentNode, prefix: string): HTMLElement {
    const match = [...root.querySelectorAll<HTMLElement>('.setting-item')].find((s) =>
        s.querySelector('.setting-item-name')?.textContent?.startsWith(prefix)
    );
    if (!match) throw new Error(`No setting starting with "${prefix}"`);
    return match;
}

export function buttonIn(root: ParentNode, text: string): HTMLButtonElement {
    const match = [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === text);
    if (!match) throw new Error(`No button "${text}"`);
    return match;
}

export function extraButton(root: ParentNode, icon: string): HTMLElement {
    const match = root.querySelector<HTMLElement>(`[data-icon="${icon}"]`);
    if (!match) throw new Error(`No icon button "${icon}"`);
    return match;
}

export function typeInto(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

export function press(el: Element, key: string): void {
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

export function setSelect(select: HTMLSelectElement, value: string): void {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
}

export function setToggle(toggle: HTMLInputElement, value: boolean): void {
    toggle.checked = value;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Tag names in the Library list, in order. */
export function libraryNames(root: ParentNode): string[] {
    return [...root.querySelectorAll('.setting-group .setting-items .setting-item-name')]
        .map((n) => n.textContent ?? '')
        .filter(Boolean);
}

/** Names in the list that directly follows a setting (the missing list or the ignored list). */
export function listAfter(root: ParentNode, settingNamePrefix: string): string[] {
    const list = settingStartingWith(root, settingNamePrefix).nextElementSibling;
    if (!list || !list.classList.contains('setting-items')) return [];
    return [...list.querySelectorAll('.setting-item-name')]
        .map((n) => n.textContent ?? '')
        .filter(Boolean);
}

/** The container of the list that follows a setting. */
export function listElementAfter(root: ParentNode, settingNamePrefix: string): HTMLElement {
    const list = settingStartingWith(root, settingNamePrefix).nextElementSibling;
    if (!list || !list.classList.contains('setting-items')) {
        throw new Error(`No list after "${settingNamePrefix}"`);
    }
    return list as HTMLElement;
}

/** The setting row for a tag inside a list. */
export function rowFor(list: ParentNode, tag: string): HTMLElement {
    const match = [...list.querySelectorAll<HTMLElement>('.setting-item')].find(
        (s) => s.querySelector('.setting-item-name')?.textContent === tag
    );
    if (!match) throw new Error(`No row for ${tag}`);
    return match;
}

export function tabEl(plugin: TagTooltipsPlugin): HTMLElement {
    return settingsTab(plugin).containerEl;
}