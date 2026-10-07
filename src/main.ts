import { Menu, Plugin, Editor, Notice } from 'obsidian';
import { TagTooltipSettings, DEFAULT_SETTINGS } from './settings'
import { TAG_SELECTORS, TAGS_PROPERTY_SELECTOR, PILL_SELECTOR } from './constants'
import { TagTooltipSettingTab } from './ui/settingsTab';
import { formatTag, getTagAtCursor, sanitizeTagMap } from './utils/tagUtils';
import { QuickAddModal } from './ui/modals';

export default class TagTooltipsPlugin extends Plugin {
    settings: TagTooltipSettings = {
        tagMap: {},
        confirmDelete: DEFAULT_SETTINGS.confirmDelete,
    };
    tooltipEl!: HTMLDivElement;

    private showTimer: number | null = null;
    private readonly showDelayMs = 50;

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

    private scheduleShow(target: HTMLElement, desc: string) {
        this.cancelPendingShow();
        this.showTimer = window.setTimeout(() => {
            this.showTimer = null;
            this.showTooltip(target, desc);
        }, this.showDelayMs);
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

    registerHoverEvents() {
        this.registerDomEvent(activeDocument, 'mouseover', (evt: MouseEvent) => {
            const tagEl = this.findTagEl(evt.target as Element | null);

            if (!tagEl) {
                this.hideTooltip();
                return;
            }

            const tag = this.formatTag(tagEl.textContent ?? '');
            const desc = this.settings.tagMap[tag];

            if (desc) {
                this.scheduleShow(tagEl, desc);
            } else {
                this.hideTooltip();
            }
        });

        this.registerDomEvent(activeDocument, 'mouseout', (evt: MouseEvent) => {
            if (!this.findTagEl(evt.relatedTarget as Element | null)) {
                this.hideTooltip();
            }
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

    addTagMenuItem(menu: Menu, tag: string) {
        menu.addItem((item) => {
            item.setTitle(`Set description for ${tag}`)
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
        this.settings = {
            confirmDelete: typeof loadedData?.confirmDelete === 'boolean'
                ? loadedData.confirmDelete
                : DEFAULT_SETTINGS.confirmDelete,
            // Drops entries corrupted by earlier imports (e.g. non-string values).
            tagMap: sanitizeTagMap(loadedData?.tagMap ?? {}).map,
        };
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}