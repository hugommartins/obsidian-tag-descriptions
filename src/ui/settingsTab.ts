import { PluginSettingTab, Setting, App, Notice, Platform, debounce } from "obsidian";
import {
    TRIGGER_MODES,
    MODIFIER_KEYS,
    MIN_HOVER_DELAY_MS,
    MAX_HOVER_DELAY_MS,
    HOVER_DELAY_STEP_MS,
    isOneOf,
} from "src/settings";
import { MAX_DESC_LENGTH } from "src/constants";
import { DeleteConfirmModal, QuickAddModal } from "src/ui/modals";
import { formatTag, resolveDescription } from "src/utils/tagUtils";
import { collectVaultTags } from "src/utils/vaultUtils";
import { createBackup, mergeBackup, describeImport } from "../../src/utils/backup";
import type TagTooltipsPlugin from '../main';

const MISSING_PREVIEW_LIMIT = 50;

export class TagTooltipSettingTab extends PluginSettingTab {
    searchQuery: string = '';
    editingTag: string | null = null;
    showAllMissing: boolean = false;
    showIgnored: boolean = false;

    constructor(app: App, public plugin: TagTooltipsPlugin) {
        super(app, plugin);
    }

    /** Obsidian entry point. Internal code calls `render()`, since `display()` is deprecated from 1.13. */
    display(): void {
        this.render();
    }

    render(): void {
        const { containerEl } = this;
        containerEl.empty();

        this.renderAddForm(containerEl);
        this.renderBackup(containerEl);
        this.renderPreferences(containerEl);
        this.renderMissing(containerEl);
        this.renderLibrary(containerEl);
    }

    renderMissing(container: HTMLElement) {
        const tagMap: Record<string, string> = this.plugin.settings.tagMap;
        const ignored = new Set(this.plugin.settings.ignoredTags);
        const missing = [...collectVaultTags(this.app).entries()]
            .filter(([tag]) =>
                !ignored.has(tag) &&
                !resolveDescription(tagMap, tag, this.plugin.settings.inheritFromParents)
            )
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

        new Setting(container)
            .setName(`Tags without a description (${missing.length})`)
            .setHeading();

        if (!missing.length) {
            container.createDiv({
                cls: 'tag-tooltip-empty',
                text: 'No tags are missing a description.',
            });
        } else {
            const list = container.createDiv({ cls: 'setting-items' });
            const visible = this.showAllMissing ? missing : missing.slice(0, MISSING_PREVIEW_LIMIT);

            for (const [tag, count] of visible) {
                new Setting(list)
                    .setName(tag)
                    .setDesc(`Used in ${count} ${count === 1 ? 'note' : 'notes'}`)
                    .addButton((b) =>
                        b.setButtonText('Add description').onClick(() => {
                            new QuickAddModal(this.app, tag, '', async (desc) => {
                                this.plugin.settings.tagMap[tag] = desc;
                                await this.plugin.saveSettings();
                                this.render();
                                new Notice(`Tooltip for ${tag} saved!`);
                            }).open();
                        })
                    )
                    .addExtraButton((b) =>
                        b.setIcon('eye-off')
                            .setTooltip('Ignore this tag')
                            .onClick(async () => {
                                this.plugin.settings.ignoredTags.push(tag);
                                await this.plugin.saveSettings();
                                this.render();
                            })
                    );
            }

            if (missing.length > MISSING_PREVIEW_LIMIT) {
                new Setting(list).addButton((b) =>
                    b.setButtonText(this.showAllMissing ? 'Show fewer' : `Show all ${missing.length}`)
                        .onClick(() => {
                            this.showAllMissing = !this.showAllMissing;
                            this.render();
                        })
                );
            }
        }

        this.renderIgnored(container);
    }

    renderIgnored(container: HTMLElement) {
        const ignoredTags = [...this.plugin.settings.ignoredTags].sort((a, b) => a.localeCompare(b));
        if (!ignoredTags.length) return;

        new Setting(container)
            .setName(`Ignored tags (${ignoredTags.length})`)
            .setDesc('Hidden from the list above. Tags stay ignored even if they are no longer used in the vault.')
            .addButton((b) =>
                b.setButtonText(this.showIgnored ? 'Hide' : 'Show').onClick(() => {
                    this.showIgnored = !this.showIgnored;
                    this.render();
                })
            );

        if (!this.showIgnored) return;

        const list = container.createDiv({ cls: 'setting-items' });
        for (const tag of ignoredTags) {
            new Setting(list)
                .setName(tag)
                .addExtraButton((b) =>
                    b.setIcon('eye')
                        .setTooltip('Stop ignoring')
                        .onClick(async () => {
                            this.plugin.settings.ignoredTags =
                                this.plugin.settings.ignoredTags.filter((t) => t !== tag);
                            await this.plugin.saveSettings();
                            this.render();
                        })
                );
        }
    }

    renderAddForm(container: HTMLElement) {
        const addSetting = new Setting(container)
            .setName('Add new tooltip')
            .setDesc('Assign a meaning to a tag.');

        addSetting.settingEl.addClass('tag-tooltip-add-row');

        let tagVal = "";
        let descVal = "";
        
        const saveAction = async () => {
            const tag = formatTag(tagVal.trim());
            const desc = descVal.trim();

            if (!tag || tag.length < 2) { new Notice('Invalid tag'); return; }
            if (!desc) { new Notice('Description cannot be empty'); return; }
            if (this.plugin.settings.tagMap[tag]) { new Notice(`${tag} already exists`); return; }

            this.plugin.settings.tagMap[tag] = desc;
            await this.plugin.saveSettings();
            this.render();
            new Notice(`Added ${tag}`);
        };

        addSetting
            .addText((text) => {
                text.setPlaceholder('#tag')
                    .onChange((v) => tagVal = v);
                text.inputEl.addEventListener('keydown', (e) => { 
                    if (e.key === 'Enter') void saveAction(); 
                });
            })
            .addText((text) => {
                text.setPlaceholder('Description...')
                    .onChange((v) => {
                        descVal = v;
                        counterEl.setText(`${v.length}/${MAX_DESC_LENGTH}`);
                    });
                text.inputEl.maxLength = MAX_DESC_LENGTH;
                text.inputEl.addEventListener('keydown', (e) => { 
                    if (e.key === 'Enter') void saveAction(); 
                });
            });

        const counterEl = addSetting.controlEl.createDiv({ 
            cls: 'tag-char-counter', 
            text: `0/${MAX_DESC_LENGTH}` 
        });

        addSetting.addButton((btn) => {
            btn.setButtonText('Add')
            .setCta()
            .onClick(() => { void saveAction(); });
        });
    }

    renderBackup(container: HTMLElement) {
        new Setting(container)
            .setName('Backup & restore')
            .setDesc('Export or import tag descriptions.')
            .addButton((b) => b.setButtonText('Export').onClick(() => void this.exportLibrary()))
            .addButton((b) => b.setButtonText('Import').onClick(() => void this.importLibrary()));
    }

    renderPreferences(container: HTMLElement) {
        const modeWrap = container.createDiv();
        const triggerOptions = container.createDiv();

        new Setting(modeWrap)
            .setName('Show tooltip')
            .setDesc('Choose when a tag description appears.')
            .addDropdown((d) =>
                d.addOption('hover', 'On hover')
                    .addOption('modifier', 'While holding a modifier key')
                    .setValue(this.plugin.settings.triggerMode)
                    .onChange(async (v) => {
                        if (!isOneOf(TRIGGER_MODES, v)) return;
                        this.plugin.settings.triggerMode = v;
                        await this.plugin.saveSettings();
                        this.plugin.hideTooltip();
                        triggerOptions.empty();
                        this.renderTriggerOptions(triggerOptions);
                    })
            );

        this.renderTriggerOptions(triggerOptions);

        new Setting(container)
            .setName('Inherit parent descriptions')
            .setDesc('Nested tags without their own description show the closest parent\'s, for example #project/alpha shows the description of #project.')
            .addToggle((t) =>
                t.setValue(this.plugin.settings.inheritFromParents)
                    .onChange(async (v) => {
                        this.plugin.settings.inheritFromParents = v;
                        await this.plugin.saveSettings();
                        this.plugin.hideTooltip();
                        this.render();
                    })
            );

        new Setting(container)
            .setName('Confirm before deleting')
            .setDesc('Show a confirmation popup before removing a description.')
            .addToggle((t) =>
                t.setValue(this.plugin.settings.confirmDelete)
                    .onChange(async (v) => {
                        this.plugin.settings.confirmDelete = v;
                        await this.plugin.saveSettings();
                    })
            );
    }

    renderTriggerOptions(container: HTMLElement) {
        if (this.plugin.settings.triggerMode === 'modifier') {
            new Setting(container)
                .setName('Modifier key')
                .setDesc('Hold this key while pointing at a tag to show its description.')
                .addDropdown((d) =>
                    d.addOption('mod', Platform.isMacOS ? 'Cmd' : 'Ctrl')
                        .addOption('alt', Platform.isMacOS ? 'Option' : 'Alt')
                        .addOption('shift', 'Shift')
                        .setValue(this.plugin.settings.modifierKey)
                        .onChange(async (v) => {
                            if (!isOneOf(MODIFIER_KEYS, v)) return;
                            this.plugin.settings.modifierKey = v;
                            await this.plugin.saveSettings();
                            this.plugin.hideTooltip();
                        })
                );
            return;
        }

        new Setting(container)
            .setName('Hover delay')
            .setDesc('Time to wait before the description appears, in milliseconds.')
            .addSlider((s) =>
                s.setLimits(MIN_HOVER_DELAY_MS, MAX_HOVER_DELAY_MS, HOVER_DELAY_STEP_MS)
                    .setValue(this.plugin.settings.hoverDelayMs)
                    .onChange(async (v) => {
                        this.plugin.settings.hoverDelayMs = v;
                        await this.plugin.saveSettings();
                    })
            );
    }

    renderLibrary(container: HTMLElement) {
        const entries = Object.entries(this.plugin.settings.tagMap);
        if (!entries.length) return;

        const settingGroup = container.createDiv({ cls: 'setting-group' });
        const headerRow = settingGroup.createDiv({ cls: 'setting-item setting-item-heading' });
        headerRow.createDiv({ cls: 'setting-item-name', text: 'Library' });
        const headerControl = headerRow.createDiv({ cls: 'setting-item-control' });
        const list = settingGroup.createDiv({ cls: 'setting-items' });

        new Setting(headerControl)
            .addSearch((s) => {
                s.setPlaceholder('Filter tags...')
                 .setValue(this.searchQuery)
                 .onChange(debounce((v) => {
                    this.searchQuery = v.toLowerCase();
                    this.renderList(list);
                }, 250, true));
            });

        this.renderList(list);
    }

    renderList(container: HTMLElement) {
        container.empty();
        const tagMap: Record<string, string> = this.plugin.settings.tagMap;
        const entries = Object.entries(tagMap).filter(
            ([tag, desc]) =>
                tag.toLowerCase().includes(this.searchQuery) ||
                desc.toLowerCase().includes(this.searchQuery)
        );

        if (!entries.length) {
            container.createDiv({ cls: 'tag-tooltip-empty', text: 'No matching tags' });
            return;
        }

        entries.forEach(([tag, desc]) =>
            this.editingTag === tag
                ? this.renderEditRow(container, tag, desc)
                : this.renderDisplayRow(container, tag, desc)
        );
    }

    renderDisplayRow(container: HTMLElement, tag: string, desc: string) {
        const s = new Setting(container);
        s.settingEl.addClass('tag-library-item');
        s.setName(tag).setDesc(desc);
        s.addExtraButton((b) => b.setIcon('pencil').onClick(() => { this.editingTag = tag; this.render(); }));
        s.addExtraButton((b) => b.setIcon('trash-2').onClick(() => this.deleteTag(tag)));
    }

    renderEditRow(container: HTMLElement, tag: string, desc: string) {
        const s = new Setting(container);
        s.settingEl.addClass('tag-library-item');
        s.infoEl.remove();

        const wrap = s.controlEl.createDiv({ cls: 'tag-tooltip-input-wrapper tag-tooltip-edit-mode' });
        const tagInput = wrap.createEl('input', { cls: 'tag-edit-input', value: tag });
        const descInput = wrap.createEl('textarea', { cls: 'tag-edit-textarea', attr: { rows: '1' } });
        descInput.value = desc;
        descInput.maxLength = MAX_DESC_LENGTH;

        const counter = wrap.createDiv({ cls: 'tag-char-counter', text: `${desc.length}/${MAX_DESC_LENGTH}` });

        descInput.addEventListener('input', () => {
            counter.setText(`${descInput.value.length}/${MAX_DESC_LENGTH}`);
        });

        setTimeout(() => {
            descInput.setAttribute('style', `height: auto; height: ${descInput.scrollHeight}px;`);
            descInput.focus();
        }, 0);

        const save = async () => {
            const newTag = formatTag(tagInput.value.trim());
            const newDesc = descInput.value.trim();
            if (newTag.length < 2) { new Notice('Invalid tag'); return; }
            if (!newDesc) { new Notice('Description cannot be empty!'); return; }
            if (newTag !== tag && this.plugin.settings.tagMap[newTag]) { new Notice(`Tag already exists.`); return; }

            const newMap: Record<string, string> = {};
            for (const key of Object.keys(this.plugin.settings.tagMap)) {
                if (key === tag) newMap[newTag] = newDesc;
                else newMap[key] = this.plugin.settings.tagMap[key];
            }

            this.plugin.settings.tagMap = newMap;
            await this.plugin.saveSettings();
            this.editingTag = null;
            this.render();
        };

        [tagInput, descInput].forEach((el) => {
            el.addEventListener('keydown', (e: Event) => {
                const keyboardEvent = e as KeyboardEvent;
                if (keyboardEvent.key === 'Enter') {
                    e.preventDefault();
                    void save();
                }
            });
        });

        s.addExtraButton((b) => b.setIcon('check').onClick(() => { void save(); }));
        s.addExtraButton((b) => b.setIcon('x').onClick(() => { this.editingTag = null; this.render(); }));
    }

    deleteTag(tag: string) {
        const perform = async () => {
            delete this.plugin.settings.tagMap[tag];
            await this.plugin.saveSettings();
            this.render();
            new Notice(`${tag} deleted.`);
        };
        if (!this.plugin.settings.confirmDelete) {
            void perform();
            return;
        }
        new DeleteConfirmModal(this.app, this.plugin, tag, () => {
            void perform();
        }).open();
    }

    exportLibrary() {
        const backup = createBackup(this.plugin.settings);
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tag-tooltips-backup.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    importLibrary() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e: Event) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            await this.importFromText(await file.text());
        };
        input.click();
    }

    /** Parses backup JSON and merges it into the current settings. */
    async importFromText(text: string) {
        let data: unknown;
        try {
            data = JSON.parse(text);
        } catch {
            new Notice('Invalid JSON file.');
            return;
        }

        const result = mergeBackup(this.plugin.settings, data);
        if (!result.imported && !result.importedIgnored) {
            new Notice('No valid tag descriptions found in file.');
            return;
        }

        this.plugin.settings.tagMap = result.tagMap;
        this.plugin.settings.ignoredTags = result.ignoredTags;
        await this.plugin.saveSettings();
        this.render();
        new Notice(describeImport(result));
    }
}