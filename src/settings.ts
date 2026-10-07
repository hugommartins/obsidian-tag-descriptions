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
    confirmDelete: boolean;
    triggerMode: TriggerMode;
    hoverDelayMs: number;
    modifierKey: ModifierKey;
}

export const DEFAULT_SETTINGS: TagTooltipSettings = {
    tagMap: {},
    confirmDelete: true,
    triggerMode: 'hover',
    hoverDelayMs: 50,
    modifierKey: 'alt',
};

export function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
    return typeof value === 'string' && (list as readonly string[]).includes(value);
}