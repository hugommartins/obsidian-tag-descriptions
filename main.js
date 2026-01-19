const { Plugin, PluginSettingTab, Setting, Modal, Notice } = require('obsidian');

/* ==========================================================================
   CONSTANTS
   ========================================================================== */

const DEFAULT_SETTINGS = {
    tagMap: {},
    confirmDelete: true,
};

const TAG_SELECTORS = [
    '.tag',
    '.cm-hashtag',
    '.multi-select-pill-content',
    '.metadata-property-tag',
    'a.tag',
    '.cm-hashtag-begin',
    '.cm-hashtag-end',
].join(', ');

const MAX_DESC_LENGTH = 100;

/* ==========================================================================
   MAIN PLUGIN
   ========================================================================== */

module.exports = class TagTooltipsPlugin extends Plugin {
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

    showTooltip(target, text) {
        this.tooltipEl.setText(text);
        this.tooltipEl.style.display = 'block';

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
        this.tooltipEl.style.display = 'none';
    }

    registerHoverEvents() {
        this.registerDomEvent(document, 'mouseover', (evt) => {
            const tagEl = evt.target.closest(TAG_SELECTORS);
            if (!tagEl) return;

            const tag = this.formatTag(tagEl.textContent);
            const desc = this.settings.tagMap[tag];
            if (desc) this.showTooltip(tagEl, desc);
        });

        this.registerDomEvent(document, 'mouseout', (evt) => {
            if (evt.target.closest(TAG_SELECTORS)) {
                this.hideTooltip();
            }
        });
    }

    registerContextMenu() {
        this.registerEvent(
            this.app.workspace.on('editor-menu', (menu, editor) => {
                const tag = this.getTagAtCursor(editor);
                if (!tag) return;

                menu.addItem((item) =>
                    item
                        .setTitle(`Set description for ${tag}`)
                        .setIcon('tag')
                        .onClick(() =>
                            new QuickAddModal(
                                this.app,
                                tag,
                                this.settings.tagMap[tag] ?? '',
                                async (desc) => {
                                    this.settings.tagMap[tag] = desc;
                                    await this.saveSettings();
                                    new Notice(`Tooltip for ${tag} saved!`);
                                }
                            ).open()
                        )
                );
            })
        );
    }

    formatTag(text = '') {
        const clean = text.replace(/#/g, '').trim();
        return clean ? `#${clean}` : '';
    }

    getTagAtCursor(editor) {
        const cursor = editor.getCursor();
        const range = editor.wordAt(cursor);
        if (!range) return null;

        const word = editor.getRange(range.from, range.to);
        const prefix = editor.getRange(
            { line: cursor.line, ch: range.from.ch - 1 },
            range.from
        );

        return prefix === '#' ? `#${word}` : null;
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
};

/* ==========================================================================
   MODALS
   ========================================================================== */

class DeleteConfirmModal extends Modal {
    constructor(app, tag, onConfirm) {
        super(app);
        this.tag = tag;
        this.onConfirm = onConfirm;
    }

    onOpen() {
        const { contentEl, titleEl } = this;
        contentEl.addClass('tag-delete-modal');
        titleEl.setText('Delete Tag Description');

        contentEl.createEl('p', {
            text: `Are you sure you want to remove the description for ${this.tag}?`,
        });

        const buttons = contentEl.createDiv({ cls: 'modal-button-container' });

        buttons
            .createEl('button', { text: 'Cancel' })
            .onclick = () => this.close();

        buttons
            .createEl('button', { text: 'Delete', cls: 'mod-warning' })
            .onclick = () => {
                this.onConfirm();
                this.close();
            };
    }
}

class QuickAddModal extends Modal {
    constructor(app, tag, initialValue, onSave) {
        super(app);
        this.tag = tag;
        this.value = initialValue;
        this.onSave = onSave;
    }

    onOpen() {
        const { contentEl, titleEl } = this;
        contentEl.addClass('tag-tooltip-modal');
        titleEl.setText(`Description for ${this.tag}`);

        const counter = contentEl.createDiv({ 
            cls: 'tag-modal-counter', 
            text: `${this.value.length}/${MAX_DESC_LENGTH}` 
        });

        const setting = new Setting(contentEl)
        .addText((input) => {
            input.setValue(this.value)
                .onChange((v) => {
                    this.value = v;
                    // 2. Update the local variable directly
                    counter.setText(`${v.length}/${MAX_DESC_LENGTH}`);
                });
            input.inputEl.maxLength = MAX_DESC_LENGTH;
        });

        contentEl.appendChild(counter)

        const inputEl = setting.controlEl.querySelector('input');
        inputEl.style.width = '100%';
        inputEl.focus();

        const buttons = contentEl.createDiv({ cls: 'modal-button-container' });
        const save = () => {
            if (!this.value.trim()) {
                new Notice('Description cannot be empty!');
                return;
            }
            this.onSave(this.value.trim());
            this.close();
        };

        buttons
            .createEl('button', { text: 'Save', cls: 'mod-cta' })
            .onclick = save;

        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                    e.preventDefault(); 
                    save(); 
                }
        });
    }
}

/* ==========================================================================
   SETTINGS TAB
   ========================================================================== */

class TagTooltipSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.searchQuery = '';
        this.editingTag = null;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('General Settings')
            .setHeading();

        this.renderAddForm(containerEl);
        this.renderBackup(containerEl);
        this.renderPreferences(containerEl);
        this.renderLibrary(containerEl);
    }

    renderAddForm(container) {
        const addSetting = new Setting(container)
            .setName('Add New Tooltip')
            .setDesc('Assign a meaning to a tag.');

        const wrap = addSetting.controlEl.createDiv({ cls: 'tag-tooltip-input-wrapper' });

        const tagInput = wrap.createEl('input', { type: 'text', placeholder: '#tag', cls: 'setting-item-input' });
        tagInput.style.width = '100px';

        const descInput = wrap.createEl('input', { type: 'text', placeholder: 'Description...', cls: 'setting-item-input' });
        descInput.style.flexGrow = '1';
        descInput.maxLength = MAX_DESC_LENGTH;
        const counter = wrap.createDiv({ cls: 'tag-char-counter', text: `0/${MAX_DESC_LENGTH}` });

        descInput.addEventListener('input', () => {
            counter.setText(`${descInput.value.length}/${MAX_DESC_LENGTH}`);
        });

        const save = async () => {
            const tag = this.plugin.formatTag(tagInput.value.trim());
            const desc = descInput.value.trim();

            if (!tag || tag.length < 2) { new Notice('Invalid tag.'); return; }
            if (!desc) { new Notice('Description cannot be empty.'); return; }
            if (this.plugin.settings.tagMap[tag]) { new Notice(`${tag} already exists.`); return; }

            this.plugin.settings.tagMap[tag] = desc;
            await this.plugin.saveSettings();
            this.display();
            new Notice(`Added ${tag}`);
        };

        [tagInput, descInput].forEach((el) => {
            el.addEventListener('keydown', (e) => { 
                if (e.key === 'Enter') {
                    e.preventDefault();
                    save(); 
                }
            });
        });

        addSetting.addButton((b) => b.setButtonText('Add').setCta().onClick(save));
    }

    renderBackup(container) {
        new Setting(container)
            .setName('Backup & Restore')
            .setDesc('Export or import tag descriptions.')
            .addButton((b) => b.setButtonText('Export').onClick(() => this.exportLibrary()))
            .addButton((b) => b.setButtonText('Import').onClick(() => this.importLibrary()));
    }

    renderPreferences(container) {
        new Setting(container)
            .setName('Confirm before deleting')
            .setDesc('Show a confirmation popup before removing a description.')
            .addToggle((t) =>
                t
                    .setValue(this.plugin.settings.confirmDelete)
                    .onChange(async (v) => {
                        this.plugin.settings.confirmDelete = v;
                        await this.plugin.saveSettings();
                    })
            );
    }

    renderLibrary(container) {
        const entries = Object.entries(this.plugin.settings.tagMap);
        if (!entries.length) return;

        const settingGroup = container.createDiv({ cls: 'setting-group' });

        const headerRow = settingGroup.createDiv({ cls: 'setting-item setting-item-heading' });
        headerRow.createDiv({ cls: 'setting-item-name', text: 'Current Library' });
        const headerControl = headerRow.createDiv({ cls: 'setting-item-control' });

        new Setting(headerControl)
            .addSearch((s) => {
                    s.containerEl.style.width = '200px'
                    s.setPlaceholder('Filter tags...')
                    s.setValue(this.searchQuery)
                    s.onChange((v) => {
                        this.searchQuery = v.toLowerCase();
                        this.renderList(list);
                    })
                }
            );

        const list = settingGroup.createDiv({ cls: 'setting-items' });
        this.renderList(list);
    }

    renderList(container) {
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

    renderDisplayRow(container, tag, desc) {
        const s = new Setting(container);
        s.settingEl.addClass('tag-library-item');
        s.settingEl.tabIndex = -1; // Remove focusability from row container
        s.setName(tag).setDesc(desc);
        s.addExtraButton((b) => b.setIcon('pencil').onClick(() => { this.editingTag = tag; this.display(); }));
        s.addExtraButton((b) => b.setIcon('trash-2').onClick(() => this.deleteTag(tag)));
    }

    renderEditRow(container, tag, desc) {
        const s = new Setting(container);
        s.settingEl.addClass('tag-library-item');
        s.settingEl.tabIndex = -1;
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

        const autoExpand = (el) => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };
        setTimeout(() => { autoExpand(descInput); descInput.focus(); }, 0);

        const save = async () => {
            const newTag = this.plugin.formatTag(tagInput.value.trim());
            const newDesc = descInput.value.trim();
            if (!newDesc) { new Notice('Description cannot be empty!'); return; }
            if (newTag !== tag && this.plugin.settings.tagMap[newTag]) { new Notice(`Tag already exists.`); return; }

            const newMap = {};
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
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault(); 
                    save(); 
                }
            });
        });

        s.addExtraButton((b) => b.setIcon('check').onClick(save));
        s.addExtraButton((b) => b.setIcon('x').onClick(() => { this.editingTag = null; this.display(); }));
    }

    deleteTag(tag) {
        const perform = async () => {
            delete this.plugin.settings.tagMap[tag];
            await this.plugin.saveSettings();
            this.display();
            new Notice(`${tag} deleted.`);
        };
        if (!this.plugin.settings.confirmDelete) return perform();
        new DeleteConfirmModal(this.app, tag, perform).open();
    }

    exportLibrary() {
        const blob = new Blob([JSON.stringify(this.plugin.settings.tagMap, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        Object.assign(document.createElement('a'), { href: url, download: 'tag-tooltips-backup.json' }).click();
        URL.revokeObjectURL(url);
    }

    importLibrary() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const data = JSON.parse(await file.text());
                Object.assign(this.plugin.settings.tagMap, data);
                await this.plugin.saveSettings();
                this.display();
                new Notice('Library imported!');
            } catch { new Notice('Invalid JSON file.'); }
        };
        input.click();
    }
}