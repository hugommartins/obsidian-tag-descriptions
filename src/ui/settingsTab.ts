import { PluginSettingTab, Setting, App, Notice, debounce } from "obsidian";
import { MAX_DESC_LENGTH } from "src/constants";
import { DeleteConfirmModal } from "src/ui/modals";
import type TagTooltipsPlugin from '../main';

export class TagTooltipSettingTab extends PluginSettingTab {
    searchQuery: string = '';
    editingTag: string | null = null;

    constructor(app: App, public plugin: TagTooltipsPlugin) {
        super(app, plugin);
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        this.renderAddForm(containerEl);
        this.renderBackup(containerEl);
        this.renderPreferences(containerEl);
        this.renderLibrary(containerEl);
    }

    renderAddForm(container: HTMLElement) {
        const addSetting = new Setting(container)
            .setName('Add new tooltip')
            .setDesc('Assign a meaning to a tag.');

        addSetting.settingEl.addClass('tag-tooltip-add-row');

        let tagVal = "";
        let descVal = "";
        
        const saveAction = async () => {
            const tag = this.plugin.formatTag(tagVal.trim());
            const desc = descVal.trim();

            if (!tag || tag.length < 2) { new Notice('Invalid tag'); return; }
            if (!desc) { new Notice('Description cannot be empty'); return; }
            if (this.plugin.settings.tagMap[tag]) { new Notice(`${tag} already exists`); return; }

            this.plugin.settings.tagMap[tag] = desc;
            await this.plugin.saveSettings();
            this.display();
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
        const entries = Object.entries(this.plugin.settings.tagMap).filter(
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
        s.addExtraButton((b) => b.setIcon('pencil').onClick(() => { this.editingTag = tag; this.display(); }));
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
            const newTag = this.plugin.formatTag(tagInput.value.trim());
            const newDesc = descInput.value.trim();
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
            this.display();
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
        s.addExtraButton((b) => b.setIcon('x').onClick(() => { this.editingTag = null; this.display(); }));
    }

    deleteTag(tag: string) {
        const perform = async () => {
            delete this.plugin.settings.tagMap[tag];
            await this.plugin.saveSettings();
            this.display();
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
        const blob = new Blob([JSON.stringify(this.plugin.settings.tagMap, null, 2)], { type: 'application/json' });
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
            const target = e.target as HTMLInputElement;
            const file = target.files?.[0];
            if (!file) return;
            try {
                const data = JSON.parse(await file.text()) as Record<string, string>;
                if (typeof data !== 'object' || Array.isArray(data)) throw new Error();
                Object.assign(this.plugin.settings.tagMap, data);
                await this.plugin.saveSettings();
                this.display();
                new Notice('Library imported!');
            } catch { 
                new Notice('Invalid JSON file.'); 
            }
        };
        input.click();
    }

}
