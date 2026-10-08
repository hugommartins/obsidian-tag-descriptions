import type { ModifierKey } from '../settings';

/** The modifier flags shared by mouse and keyboard events. */
export interface ModifierState {
    altKey: boolean;
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
}

/** `mod` is Cmd on macOS and Ctrl elsewhere. */
export function isModifierHeld(state: ModifierState, key: ModifierKey, isMac: boolean): boolean {
    switch (key) {
        case 'alt':
            return state.altKey;
        case 'shift':
            return state.shiftKey;
        default:
            return isMac ? state.metaKey : state.ctrlKey;
    }
}

export interface TargetRect {
    top: number;
    bottom: number;
    left: number;
}

export interface Size {
    width: number;
    height: number;
}

export interface Placement {
    top: number;
    left: number;
}

/**
 * Places the tooltip above the target, flips it below when there is no room,
 * and keeps it inside the viewport horizontally.
 */
export function computeTooltipPosition(
    target: TargetRect,
    tooltip: Size,
    viewportWidth: number,
    offset = 2,
    padding = 15
): Placement {
    let top = target.top - tooltip.height - offset;
    if (top < 0) top = target.bottom + offset;

    let left = target.left;
    const maxLeft = viewportWidth - tooltip.width - padding;

    if (left > maxLeft) left = maxLeft;
    if (left < padding) left = padding;

    return { top, left };
}