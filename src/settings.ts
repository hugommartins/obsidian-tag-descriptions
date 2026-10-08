import { sanitizeIgnoredTags, sanitizeFlatTagMap } from './utils/tagUtils';

export const TRIGGER_MODES = ['hover', 'modifier'] as const;
export type TriggerMode = typeof TRIGGER_MODES[number];

/** `mod` is Cmd on macOS and Ctrl elsewhere. */
export const MODIFIER_KEYS = ['mod', 'alt', 'shift'] as const;
export type ModifierKey = typeof MODIFIER_KEYS[number];

export const MIN_HOVER_DELAY_MS = 0;
export const MAX_HOVER_DELAY_MS = 1000;
export const HOVER_DELAY_STEP_MS = 50;

export interface TagTooltipSettings {
    tagMap: Record<string, string>;
    /** Tags hidden from the "missing descriptions" list. */
    ignoredTags: string[];
    confirmDelete: boolean;
    /** Nested tags without their own description show the closest parent's. */
    inheritFromParents: boolean;
    triggerMode: TriggerMode;
    hoverDelayMs: number;
    modifierKey: ModifierKey;
}

export const DEFAULT_SETTINGS: TagTooltipSettings = {
    tagMap: {},
    ignoredTags: [],
    confirmDelete: true,
    inheritFromParents: true,
    triggerMode: 'hover',
    hoverDelayMs: 50,
    modifierKey: 'alt',
};

export function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
    return typeof value === 'string' && (list as readonly string[]).includes(value);
}

/**
 * Builds valid settings from whatever `loadData()` returned: missing or
 * malformed fields fall back to defaults, numbers are clamped, and entries
 * corrupted by earlier imports are dropped.
 */
export function normalizeSettings(raw: unknown): TagTooltipSettings {
    const data: Partial<Record<keyof TagTooltipSettings, unknown>> =
        typeof raw === 'object' && raw !== null && !Array.isArray(raw)
            ? (raw as Partial<Record<keyof TagTooltipSettings, unknown>>)
            : {};

    return {
        confirmDelete: typeof data.confirmDelete === 'boolean'
            ? data.confirmDelete
            : DEFAULT_SETTINGS.confirmDelete,
        inheritFromParents: typeof data.inheritFromParents === 'boolean'
            ? data.inheritFromParents
            : DEFAULT_SETTINGS.inheritFromParents,
        triggerMode: isOneOf(TRIGGER_MODES, data.triggerMode)
            ? data.triggerMode
            : DEFAULT_SETTINGS.triggerMode,
        modifierKey: isOneOf(MODIFIER_KEYS, data.modifierKey)
            ? data.modifierKey
            : DEFAULT_SETTINGS.modifierKey,
        hoverDelayMs: typeof data.hoverDelayMs === 'number' && Number.isFinite(data.hoverDelayMs)
            ? Math.min(MAX_HOVER_DELAY_MS, Math.max(MIN_HOVER_DELAY_MS, data.hoverDelayMs))
            : DEFAULT_SETTINGS.hoverDelayMs,
        // Flat on purpose: a stored map is never a backup wrapper, and a corrupted
        // one (from the 1.0.0 import bug) can contain a literal "tagMap" key.
        tagMap: sanitizeFlatTagMap(data.tagMap).map,
        ignoredTags: sanitizeIgnoredTags(data.ignoredTags),
    };
}