import { Menu, Plugin, debounce, Editor, Notice } from 'obsidian';
import { TagTooltipSettings, DEFAULT_SETTINGS } from './settings'
import { TAG_SELECTORS } from './constants'
import { TagTooltipSettingTab } from './ui/settingsTab';
import { formatTag, getTagAtCursor } from './utils/tagUtils';
import { QuickAddModal } from './ui/modals';

export default class TagTooltipsPlugin extends Plugin {
    settings!: TagTooltipSettings;
    tooltipEl!: HTMLDivElement;

    async onload() {
        await this.loadSettings();
        this.createTooltip();
        this.registerHoverEvents();
        this.registerContextMenu();
        this.addSettingTab(new TagTooltipSettingTab(this.app, this));
    }

    onunload() {
        this.tooltipEl?.remove();
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
        this.tooltipEl.removeClass('is-active');
    }

    registerHoverEvents() {
        const debouncedShow = debounce((target: HTMLElement, desc: string) => {
            this.showTooltip(target, desc);
        }, 50, true);

        this.registerDomEvent(window.activeDocument, 'mouseover', (evt: MouseEvent) => {
            const target = evt.target as HTMLElement;
            const tagEl = target.closest(TAG_SELECTORS) as HTMLElement;
            
            if (!tagEl) {
                this.hideTooltip();
                return;
            }

            const tag = this.formatTag(tagEl.textContent ?? '');
            const desc = this.settings.tagMap[tag];

            if (desc) {
                debouncedShow(tagEl, desc);
            }
        });

        this.registerDomEvent(window.activeDocument, 'mouseout', (evt: MouseEvent) => {
            const related = evt.relatedTarget as Element;
            if (!related || !related.closest(TAG_SELECTORS)) {
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
        menu.addItem((item) =>
            item
                .setTitle(`Set description for ${tag}`)
                .setIcon('tag')
                .setSection('action-section')
                .onClick(async () => {
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
                })
        );
    }

    async loadSettings() {
        const loadedData = (await this.loadData()) as TagTooltipSettings | null;
        this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}
