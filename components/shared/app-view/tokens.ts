export const APP_PRESSABLE_DEFAULTS = {
  hitSlop: { top: 8, bottom: 8, left: 8, right: 8 } as const,
  pressedOpacity: 0.85,
  pressedScale: 0.98,
} as const;

// Default shadow elevation when shadow is enabled but level not specified
export const SHADOW_DEFAULT_LEVEL = 4 as const;

// Fallback top inset for iOS status bar when using safeTop
export const SAFE_AREA_TOP_FALLBACK = 44 as const;

// Default ripple token name for themed ripple color
export const DEFAULT_RIPPLE_COLOR_NAME = 'overlay' as const;
