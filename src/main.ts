import { Menu, Plugin, Editor, Notice, Platform } from 'obsidian';
import {
    TagTooltipSettings,
    DEFAULT_SETTINGS,
    TRIGGER_MODES,
    MODIFIER_KEYS,
    MIN_HOVER_DELAY_MS,
    MAX_HOVER_DELAY_MS,
    isOneOf,
} from './settings'
import { TAG_SELECTORS, TAGS_PROPERTY_SELECTOR, PILL_SELECTOR } from './constants'
import { TagTooltipSettingTab } from './ui/settingsTab';
import { formatTag, getTagAtCursor, sanitizeTagMap } from './utils/tagUtils';
import { QuickAddModal } from './ui/modals';

export default class TagTooltipsPlugin extends Plugin {
    settings: TagTooltipSettings = {
        ...DEFAULT_SETTINGS,
        tagMap: {},
        ignoredTags: [],
    };
    tooltipEl!: HTMLDivElement;

    private menuItemAdded = false;
    private showTimer: number | null = null;
    private hoveredEl: HTMLElement | null = null;
    private hoveredDesc = '';

    onload(): void {
        void this.initialize();
    }

    onunload(): void {
        this.cancelPendingShow();
        this.tooltipEl?.remove();
    }

    private async initialize(): Promise<void> {
        await this.loadSettings();
        this.createTooltip();
        this.registerHoverEvents();
        this.registerContextMenu();
        this.addSettingTab(new TagTooltipSettingTab(this.app, this));
    }

    createTooltip() {
        this.tooltipEl = document.body.createEl('div', {
            cls: 'tag-tooltip-container',
        });
        this.hideTooltip();
    }

    showTooltip(target: HTMLElement, text: string) {
        this.tooltipEl.setText(text);
        this.tooltipEl.addClass('is-active');

        const rect = target.getBoundingClientRect();
        const offset = 2;
        const padding = 15;

        let top = rect.top - this.tooltipEl.offsetHeight - offset;
        if (top < 0) top = rect.bottom + offset;

        let left = rect.left;
        const maxLeft = window.innerWidth - this.tooltipEl.offsetWidth - padding;

        if (left > maxLeft) left = maxLeft;
        if (left < padding) left = padding;

        Object.assign(this.tooltipEl.style, {
            top: `${top}px`,
            left: `${left}px`,
        });
    }

    hideTooltip() {
        // A pending show must not fire after the pointer has left the tag.
        this.cancelPendingShow();
        this.tooltipEl?.removeClass('is-active');
    }

    private scheduleShow(target: HTMLElement, desc: string, delayMs: number) {
        this.cancelPendingShow();
        if (delayMs <= 0) {
            this.showTooltip(target, desc);
            return;
        }
        this.showTimer = window.setTimeout(() => {
            this.showTimer = null;
            this.showTooltip(target, desc);
        }, delayMs);
    }

    private cancelPendingShow() {
        if (this.showTimer !== null) {
            window.clearTimeout(this.showTimer);
            this.showTimer = null;
        }
    }

    /** Closest tag element, ignoring pills that are not in the `tags` property. */
    private findTagEl(target: Element | null): HTMLElement | null {
        const el = target?.closest<HTMLElement>(TAG_SELECTORS) ?? null;
        if (!el) return null;
        if (el.matches(PILL_SELECTOR) && !el.closest(TAGS_PROPERTY_SELECTOR)) return null;
        return el;
    }

    private isModifierHeld(evt: MouseEvent | KeyboardEvent): boolean {
        switch (this.settings.modifierKey) {
            case 'alt':
                return evt.altKey;
            case 'shift':
                return evt.shiftKey;
            default:
                return Platform.isMacOS ? evt.metaKey : evt.ctrlKey;
        }
    }

    registerHoverEvents() {
        this.registerDomEvent(document, 'mouseover', (evt: MouseEvent) => {
            const tagEl = this.findTagEl(evt.target as Element | null);
            const desc: string | undefined = tagEl
                ? this.settings.tagMap[this.formatTag(tagEl.textContent ?? '')]
                : undefined;

            if (!tagEl || !desc) {
                this.hoveredEl = null;
                this.hideTooltip();
                return;
            }

            this.hoveredEl = tagEl;
            this.hoveredDesc = desc;

            if (this.settings.triggerMode === 'modifier') {
                if (this.isModifierHeld(evt)) {
                    this.showTooltip(tagEl, desc);
                } else {
                    this.hideTooltip();
                }
            } else {
                this.scheduleShow(tagEl, desc, this.settings.hoverDelayMs);
            }
        });

        this.registerDomEvent(document, 'mouseout', (evt: MouseEvent) => {
            if (!this.findTagEl(evt.relatedTarget as Element | null)) {
                this.hoveredEl = null;
                this.hideTooltip();
            }
        });

        // Modifier mode: pressing or releasing the key while the pointer rests on a tag.
        this.registerDomEvent(document, 'keydown', (evt: KeyboardEvent) => {
            if (this.settings.triggerMode !== 'modifier' || !this.hoveredEl) return;
            if (this.isModifierHeld(evt)) {
                this.showTooltip(this.hoveredEl, this.hoveredDesc);
            }
        });

        this.registerDomEvent(document, 'keyup', (evt: KeyboardEvent) => {
            if (this.settings.triggerMode === 'modifier' && !this.isModifierHeld(evt)) {
                this.hideTooltip();
            }
        });

        // A key released while the window is unfocused never produces a keyup.
        this.registerDomEvent(window, 'blur', () => {
            this.hideTooltip();
        });
    }

    formatTag(text: string): string {
        return formatTag(text);
    }

    registerContextMenu() {
        this.registerEvent(
            this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor) => {
                const tag = this.getTagAtCursor(editor);
                if (tag) {
                    this.addTagMenuItem(menu, tag);
                }
            })
        );

        this.registerEvent(
            //@ts-ignore - tag-menu is a valid but sometimes unlisted internal event
            this.app.workspace.on('tag-menu', (menu: Menu, tag: string) => {
                if (tag) {
                    this.addTagMenuItem(menu, tag);
                }
            })
        );
    }
    getTagAtCursor(editor: Editor): string | null {
        return getTagAtCursor(editor);
    }

    /** Checks the menu's (internal) item list for an entry with this title. */
    private menuHasTitle(menu: Menu, title: string): boolean {
        const items = (menu as unknown as { items?: { dom?: HTMLElement }[] }).items;
        return Array.isArray(items) && items.some((i) => i.dom?.textContent === title);
    }

    addTagMenuItem(menu: Menu, tag: string) {
        // Right-clicking a tag in the editor can fire both `editor-menu` and
        // `tag-menu` in the same event dispatch; only add the item once.
        const title = `Set description for ${tag}`;
        if (this.menuItemAdded || this.menuHasTitle(menu, title)) return;
        this.menuItemAdded = true;
        window.setTimeout(() => { this.menuItemAdded = false; }, 0);

        menu.addItem((item) => {
            item.setTitle(title)
                .setIcon('tag')
                .onClick(() => {
                    new QuickAddModal(
                        this.app,
                        tag,
                        this.settings.tagMap[tag] ?? '',
                        async (desc) => {
                            this.settings.tagMap[tag] = desc;
                            await this.saveSettings();
                            new Notice(`Tooltip for ${tag} saved!`);
                        }
                    ).open();
                });

            // setSection is not present in every version of Obsidian's public typings.
            (item as unknown as { setSection?: (section: string) => void })
                .setSection?.('action-section');
        });
    }

    async loadSettings() {
        const loadedData = (await this.loadData()) as Partial<TagTooltipSettings> | null;
        const data: Partial<TagTooltipSettings> = loadedData ?? {};

        this.settings = {
            confirmDelete: typeof data.confirmDelete === 'boolean'
                ? data.confirmDelete
                : DEFAULT_SETTINGS.confirmDelete,
            triggerMode: isOneOf(TRIGGER_MODES, data.triggerMode)
                ? data.triggerMode
                : DEFAULT_SETTINGS.triggerMode,
            modifierKey: isOneOf(MODIFIER_KEYS, data.modifierKey)
                ? data.modifierKey
                : DEFAULT_SETTINGS.modifierKey,
            hoverDelayMs: typeof data.hoverDelayMs === 'number' && Number.isFinite(data.hoverDelayMs)
                ? Math.min(MAX_HOVER_DELAY_MS, Math.max(MIN_HOVER_DELAY_MS, data.hoverDelayMs))
                : DEFAULT_SETTINGS.hoverDelayMs,
            // Drops entries corrupted by earlier imports (e.g. non-string values).
            tagMap: sanitizeTagMap(data.tagMap ?? {}).map,
            ignoredTags: Array.isArray(data.ignoredTags)
                ? [...new Set(
                    (data.ignoredTags as unknown[])
                        .filter((t): t is string => typeof t === 'string')
                        .map((t) => formatTag(t))
                        .filter((t) => t.length >= 2)
                )]
                : [],
        };
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}