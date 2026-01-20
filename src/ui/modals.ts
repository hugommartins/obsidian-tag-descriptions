import { App, Modal, Setting, Notice } from 'obsidian';
import { MAX_DESC_LENGTH } from '../constants';
import type TagTooltipsPlugin from '../main';

export class DeleteConfirmModal extends Modal {
    constructor(
        app: App, 
        private plugin: TagTooltipsPlugin, 
        private tag: string, 
        private onConfirm: () => void
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl, titleEl } = this;
        
        titleEl.setText('Delete tag description');
        contentEl.addClass('tag-delete-modal');

        contentEl.createEl('p', {
            text: `Are you sure you want to remove the description for ${this.tag}?`,
        });

        const buttons = contentEl.createDiv({ cls: 'modal-button-container' });

        buttons.createEl('button', { text: 'Cancel' })
            .onclick = () => this.close();

        const deleteBtn = buttons.createEl('button', { 
            text: 'Delete', 
            cls: 'mod-warning' 
        });
        
        deleteBtn.onclick = () => {
            this.onConfirm();
            this.close();
        };
    }
}

export class QuickAddModal extends Modal {
    constructor(
        app: App, 
        private tag: string, 
        private value: string, 
        private onSave: (desc: string) => Promise<void>
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl, titleEl } = this;
        contentEl.addClass('tag-tooltip-modal');
        titleEl.setText(`Description for ${this.tag}`);

        const setting = new Setting(contentEl)
            .addText((input) => {
                input.setValue(this.value)
                    .onChange((v) => {
                        this.value = v;
                        counter.setText(`${v.length}/${MAX_DESC_LENGTH}`);
                    });
                input.inputEl.maxLength = MAX_DESC_LENGTH;
            });

        const counter = contentEl.createDiv({ 
            cls: 'tag-modal-counter', 
            text: `${this.value.length}/${MAX_DESC_LENGTH}` 
        });

        const inputEl = setting.controlEl.querySelector('input') as HTMLInputElement;
        inputEl.focus();

        const buttons = contentEl.createDiv({ cls: 'modal-button-container' });
        
        const save = async () => {
            if (!this.value.trim()) {
                new Notice('Description cannot be empty!');
                return;
            }
            await this.onSave(this.value.trim());
            this.close();
        };

        buttons.createEl('button', { text: 'Save', cls: 'mod-cta' }).onclick = () => { void save(); };

        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); 
                void save(); 
            }
        });
    }
}