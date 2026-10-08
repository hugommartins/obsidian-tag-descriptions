import { afterEach, beforeEach, vi } from 'vitest';
import { Notice, Platform, installObsidianDom } from './mocks/obsidian';

installObsidianDom();

beforeEach(() => {
    Notice.__reset();
    Platform.isMacOS = false;
});

afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
});