export interface TagTooltipSettings {
    tagMap: Record<string, string>;
    confirmDelete: boolean;
}

export const DEFAULT_SETTINGS = {
    tagMap: {},
    confirmDelete: true,
};