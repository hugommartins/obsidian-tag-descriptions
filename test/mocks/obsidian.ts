/**
 * Minimal runtime stand-in for the `obsidian` module. The real package ships
 * types only, so tests alias `obsidian` to this file (see vitest.config.mts).
 * It implements only the surface this plugin uses, plus a few `__` helpers
 * that tests use to seed and inspect state.
 */

// ---------------------------------------------------------------------------
// DOM helpers that Obsidian adds to HTMLElement
// ---------------------------------------------------------------------------

interface CreateOptions {
    cls?: string | string[];
    text?: string;
    attr?: Record<string, string>;
    value?: string;
    type?: string;
    placeholder?: string;
}

function applyOptions(el: HTMLElement, options?: string | CreateOptions): void {
    if (options === undefined) return;
    const o: CreateOptions = typeof options === 'string' ? { cls: options } : options;
    if (o.cls) el.classList.add(...(Array.isArray(o.cls) ? o.cls : o.cls.split(/\s+/).filter(Boolean)));
    if (o.text !== undefined) el.textContent = o.text;
    if (o.attr) for (const [k, v] of Object.entries(o.attr)) el.setAttribute(k, v);
    if (o.value !== undefined) (el as HTMLInputElement).value = o.value;
    if (o.type !== undefined) (el as HTMLInputElement).type = o.type;
    if (o.placeholder !== undefined) (el as HTMLInputElement).placeholder = o.placeholder;
}

let domInstalled = false;

export function installObsidianDom(): void {
    if (domInstalled) return;
    domInstalled = true;

    const proto = HTMLElement.prototype as unknown as Record<string, unknown>;

    proto.createEl = function (this: HTMLElement, tag: string, options?: string | CreateOptions) {
        const el = document.createElement(tag);
        applyOptions(el, options);
        this.appendChild(el);
        return el;
    };
    proto.createDiv = function (this: HTMLElement, options?: string | CreateOptions) {
        return (this as unknown as { createEl: (t: string, o?: unknown) => HTMLElement }).createEl('div', options);
    };
    proto.createSpan = function (this: HTMLElement, options?: string | CreateOptions) {
        return (this as unknown as { createEl: (t: string, o?: unknown) => HTMLElement }).createEl('span', options);
    };
    proto.empty = function (this: HTMLElement) {
        this.replaceChildren();
    };
    proto.setText = function (this: HTMLElement, text: string) {
        this.textContent = text;
    };
    proto.addClass = function (this: HTMLElement, ...classes: string[]) {
        this.classList.add(...classes);
    };
    proto.removeClass = function (this: HTMLElement, ...classes: string[]) {
        this.classList.remove(...classes);
    };
    proto.hasClass = function (this: HTMLElement, cls: string) {
        return this.classList.contains(cls);
    };
    proto.toggleClass = function (this: HTMLElement, cls: string, on: boolean) {
        this.classList.toggle(cls, on);
    };
}

// ---------------------------------------------------------------------------
// Platform, Notice, debounce, getAllTags
// ---------------------------------------------------------------------------

export const Platform = { isMacOS: false };

export class Notice {
    /** Every notice shown since the last `Notice.__reset()`. */
    static messages: string[] = [];
    static __reset(): void {
        Notice.messages = [];
    }
    constructor(message: string | DocumentFragment) {
        Notice.messages.push(typeof message === 'string' ? message : (message.textContent ?? ''));
    }
    setMessage(): this { return this; }
    hide(): void { /* nothing to hide */ }
}

export function debounce<A extends unknown[]>(
    cb: (...args: A) => unknown,
    timeout = 0,
    resetTimer = false
): (...args: A) => void {
    let handle: ReturnType<typeof setTimeout> | undefined;
    return (...args: A) => {
        if (handle !== undefined && resetTimer) {
            clearTimeout(handle);
            handle = undefined;
        }
        if (handle === undefined) {
            handle = setTimeout(() => {
                handle = undefined;
                cb(...args);
            }, timeout);
        }
    };
}

export interface FakeCache {
    tags?: { tag: string }[];
    frontmatter?: { tags?: string | string[] };
}

/** Mirrors Obsidian: inline tags plus frontmatter tags, `#`-prefixed; null when there are none. */
export function getAllTags(cache: FakeCache): string[] | null {
    const tags: string[] = [];
    for (const t of cache.tags ?? []) tags.push(t.tag);

    const fm = cache.frontmatter?.tags;
    const list = typeof fm === 'string' ? fm.split(/[\s,]+/).filter(Boolean) : fm ?? [];
    for (const t of list) tags.push(t.startsWith('#') ? t : `#${t}`);

    return tags.length ? tags : null;
}

// ---------------------------------------------------------------------------
// App, Workspace, Vault
// ---------------------------------------------------------------------------

export interface EventRef {
    off: () => void;
}

export class Workspace {
    private handlers = new Map<string, Set<(...args: never[]) => unknown>>();

    on(name: string, cb: (...args: never[]) => unknown): EventRef {
        const set = this.handlers.get(name) ?? new Set();
        set.add(cb);
        this.handlers.set(name, set);
        return { off: () => set.delete(cb) };
    }

    trigger(name: string, ...args: unknown[]): void {
        for (const cb of [...(this.handlers.get(name) ?? [])]) {
            (cb as (...a: unknown[]) => unknown)(...args);
        }
    }

    __listenerCount(name: string): number {
        return this.handlers.get(name)?.size ?? 0;
    }
}

export interface FakeFile {
    path: string;
}

export class App {
    workspace = new Workspace();
    /** Test seam: file path -> metadata cache. */
    __files = new Map<string, FakeCache | null>();
    vault = {
        getMarkdownFiles: (): FakeFile[] => [...this.__files.keys()].map((path) => ({ path })),
    };
    metadataCache = {
        getFileCache: (file: FakeFile): FakeCache | null => this.__files.get(file.path) ?? null,
    };
}

// ---------------------------------------------------------------------------
// Plugin, PluginSettingTab, Modal
// ---------------------------------------------------------------------------

export class Plugin {
    app: App;
    manifest: { id: string; version: string };

    /** What `loadData()` returns. Seed it before `load()`. */
    __data: unknown = null;
    settingTabs: PluginSettingTab[] = [];

    private cleanups: (() => void)[] = [];

    constructor(app: App, manifest: { id: string; version: string } = { id: 'test', version: '0.0.0' }) {
        this.app = app;
        this.manifest = manifest;
    }

    onload(): void | Promise<void> { /* overridden */ }
    onunload(): void { /* overridden */ }

    load(): void {
        void this.onload();
    }

    unload(): void {
        this.onunload();
        for (const cleanup of this.cleanups.splice(0)) cleanup();
    }

    loadData(): Promise<unknown> {
        return Promise.resolve(this.__data === null ? null : JSON.parse(JSON.stringify(this.__data)));
    }

    saveData(data: unknown): Promise<void> {
        // Round trip through JSON, like data.json on disk.
        this.__data = JSON.parse(JSON.stringify(data));
        return Promise.resolve();
    }

    addSettingTab(tab: PluginSettingTab): void {
        this.settingTabs.push(tab);
    }

    registerEvent(ref: EventRef): void {
        this.cleanups.push(() => ref.off());
    }

    registerDomEvent(
        el: Document | Window | HTMLElement,
        type: string,
        cb: (evt: never) => unknown
    ): void {
        const listener = cb as unknown as EventListener;
        el.addEventListener(type, listener);
        this.cleanups.push(() => el.removeEventListener(type, listener));
    }
}

export abstract class PluginSettingTab {
    app: App;
    plugin: Plugin;
    containerEl: HTMLElement;

    constructor(app: App, plugin: Plugin) {
        this.app = app;
        this.plugin = plugin;
        this.containerEl = document.createElement('div');
        this.containerEl.classList.add('vertical-tab-content');
    }

    abstract display(): void;
    hide(): void { /* nothing */ }
}

export class Modal {
    app: App;
    containerEl: HTMLElement;
    modalEl: HTMLElement;
    titleEl: HTMLElement;
    contentEl: HTMLElement;

    constructor(app: App) {
        this.app = app;
        this.containerEl = document.createElement('div');
        this.containerEl.classList.add('modal-container');
        this.modalEl = this.containerEl.createDiv({ cls: 'modal' });
        this.titleEl = this.modalEl.createDiv({ cls: 'modal-title' });
        this.contentEl = this.modalEl.createDiv({ cls: 'modal-content' });
    }

    onOpen(): void { /* overridden */ }
    onClose(): void { /* overridden */ }

    open(): void {
        document.body.appendChild(this.containerEl);
        this.onOpen();
    }

    close(): void {
        this.onClose();
        this.containerEl.remove();
    }
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

export class MenuItem {
    dom: HTMLElement = document.createElement('div');
    title = '';
    icon = '';
    section = '';
    clickHandler: (() => unknown) | null = null;

    setTitle(title: string): this {
        this.title = title;
        this.dom.textContent = title;
        return this;
    }
    setIcon(icon: string): this {
        this.icon = icon;
        return this;
    }
    setSection(section: string): this {
        this.section = section;
        return this;
    }
    onClick(cb: () => unknown): this {
        this.clickHandler = cb;
        return this;
    }
}

export class Menu {
    /** Internal in Obsidian too; the plugin reads it to avoid duplicate items. */
    items: MenuItem[] = [];

    addItem(cb: (item: MenuItem) => void): this {
        const item = new MenuItem();
        cb(item);
        this.items.push(item);
        return this;
    }
}

// ---------------------------------------------------------------------------
// Setting and its components
// ---------------------------------------------------------------------------

class TextComponent {
    inputEl: HTMLInputElement;
    constructor(container: HTMLElement) {
        this.inputEl = container.createEl('input', { type: 'text' }) as HTMLInputElement;
    }
    setValue(v: string): this { this.inputEl.value = v; return this; }
    setPlaceholder(v: string): this { this.inputEl.placeholder = v; return this; }
    onChange(cb: (v: string) => unknown): this {
        this.inputEl.addEventListener('input', () => { void cb(this.inputEl.value); });
        return this;
    }
}

class SearchComponent extends TextComponent {}

class DropdownComponent {
    selectEl: HTMLSelectElement;
    constructor(container: HTMLElement) {
        this.selectEl = container.createEl('select') as HTMLSelectElement;
    }
    addOption(value: string, display: string): this {
        const o = this.selectEl.createEl('option', { text: display });
        (o as HTMLOptionElement).value = value;
        return this;
    }
    setValue(v: string): this { this.selectEl.value = v; return this; }
    onChange(cb: (v: string) => unknown): this {
        this.selectEl.addEventListener('change', () => { void cb(this.selectEl.value); });
        return this;
    }
}

class ToggleComponent {
    toggleEl: HTMLInputElement;
    constructor(container: HTMLElement) {
        this.toggleEl = container.createEl('input', { type: 'checkbox' }) as HTMLInputElement;
    }
    setValue(v: boolean): this { this.toggleEl.checked = v; return this; }
    onChange(cb: (v: boolean) => unknown): this {
        this.toggleEl.addEventListener('change', () => { void cb(this.toggleEl.checked); });
        return this;
    }
}

class SliderComponent {
    sliderEl: HTMLInputElement;
    constructor(container: HTMLElement) {
        this.sliderEl = container.createEl('input', { type: 'range' }) as HTMLInputElement;
    }
    setLimits(min: number, max: number, step: number): this {
        this.sliderEl.min = String(min);
        this.sliderEl.max = String(max);
        this.sliderEl.step = String(step);
        return this;
    }
    setValue(v: number): this { this.sliderEl.value = String(v); return this; }
    setDynamicTooltip(): this { return this; }
    onChange(cb: (v: number) => unknown): this {
        this.sliderEl.addEventListener('input', () => { void cb(Number(this.sliderEl.value)); });
        return this;
    }
}

class ButtonComponent {
    buttonEl: HTMLButtonElement;
    constructor(container: HTMLElement) {
        this.buttonEl = container.createEl('button') as HTMLButtonElement;
    }
    setButtonText(text: string): this { this.buttonEl.textContent = text; return this; }
    setCta(): this { this.buttonEl.classList.add('mod-cta'); return this; }
    onClick(cb: () => unknown): this {
        this.buttonEl.addEventListener('click', () => { void cb(); });
        return this;
    }
}

class ExtraButtonComponent {
    extraSettingsEl: HTMLElement;
    constructor(container: HTMLElement) {
        this.extraSettingsEl = container.createDiv({ cls: 'clickable-icon extra-setting-button' });
    }
    setIcon(icon: string): this { this.extraSettingsEl.setAttribute('data-icon', icon); return this; }
    setTooltip(tip: string): this { this.extraSettingsEl.setAttribute('aria-label', tip); return this; }
    onClick(cb: () => unknown): this {
        this.extraSettingsEl.addEventListener('click', () => { void cb(); });
        return this;
    }
}

export class Setting {
    settingEl: HTMLElement;
    infoEl: HTMLElement;
    nameEl: HTMLElement;
    descEl: HTMLElement;
    controlEl: HTMLElement;

    constructor(containerEl: HTMLElement) {
        this.settingEl = containerEl.createDiv({ cls: 'setting-item' });
        this.infoEl = this.settingEl.createDiv({ cls: 'setting-item-info' });
        this.nameEl = this.infoEl.createDiv({ cls: 'setting-item-name' });
        this.descEl = this.infoEl.createDiv({ cls: 'setting-item-description' });
        this.controlEl = this.settingEl.createDiv({ cls: 'setting-item-control' });
    }

    setName(name: string): this { this.nameEl.textContent = name; return this; }
    setDesc(desc: string): this { this.descEl.textContent = desc; return this; }
    setHeading(): this { this.settingEl.classList.add('setting-item-heading'); return this; }

    addText(cb: (c: TextComponent) => unknown): this { cb(new TextComponent(this.controlEl)); return this; }
    addSearch(cb: (c: SearchComponent) => unknown): this { cb(new SearchComponent(this.controlEl)); return this; }
    addDropdown(cb: (c: DropdownComponent) => unknown): this { cb(new DropdownComponent(this.controlEl)); return this; }
    addToggle(cb: (c: ToggleComponent) => unknown): this { cb(new ToggleComponent(this.controlEl)); return this; }
    addSlider(cb: (c: SliderComponent) => unknown): this { cb(new SliderComponent(this.controlEl)); return this; }
    addButton(cb: (c: ButtonComponent) => unknown): this { cb(new ButtonComponent(this.controlEl)); return this; }
    addExtraButton(cb: (c: ExtraButtonComponent) => unknown): this { cb(new ExtraButtonComponent(this.controlEl)); return this; }
}

// Type-only names the plugin imports. They have no runtime behavior.
export type Editor = unknown;