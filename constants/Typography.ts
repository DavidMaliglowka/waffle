// Waffle App Typography System
// Based on PRD specifications: Poppins for headers, Inter for body text
// Note: Using SpaceMono as fallback until custom fonts are added

export const FontFamily = {
  // Header fonts - Poppins (friendly, bold sans-serif)
  // Temporarily using SpaceMono until custom fonts are added
  headerRegular: 'SpaceMono',
  headerMedium: 'SpaceMono', 
  headerBold: 'SpaceMono',
  headerExtraBold: 'SpaceMono',
  
  // Body fonts - Inter (clean, legible sans-serif)
  // Temporarily using SpaceMono until custom fonts are added
  bodyRegular: 'SpaceMono',
  bodyMedium: 'SpaceMono',
  bodySemiBold: 'SpaceMono',
  bodyBold: 'SpaceMono',
  
  // Fallback system fonts
  systemRegular: 'System',
  systemBold: 'System',
} as const;

export const FontSize = {
  // Headers
  h1: 32,
  h2: 28,
  h3: 24,
  h4: 20,
  h5: 18,
  h6: 16,
  
  // Body text
  large: 18,
  body: 16,
  small: 14,
  caption: 12,
  tiny: 10,
  
  // UI elements
  button: 16,
  tab: 12,
  input: 16,
} as const;

export const LineHeight = {
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
} as const;

export const Typography = {
  // Header styles
  h1: {
    fontFamily: FontFamily.headerBold,
    fontSize: FontSize.h1,
    lineHeight: FontSize.h1 * LineHeight.tight,
  },
  h2: {
    fontFamily: FontFamily.headerBold,
    fontSize: FontSize.h2,
    lineHeight: FontSize.h2 * LineHeight.tight,
  },
  h3: {
    fontFamily: FontFamily.headerMedium,
    fontSize: FontSize.h3,
    lineHeight: FontSize.h3 * LineHeight.tight,
  },
  h4: {
    fontFamily: FontFamily.headerMedium,
    fontSize: FontSize.h4,
    lineHeight: FontSize.h4 * LineHeight.normal,
  },
  
  // Body styles
  bodyLarge: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: FontSize.large,
    lineHeight: FontSize.large * LineHeight.normal,
  },
  body: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: FontSize.body,
    lineHeight: FontSize.body * LineHeight.normal,
  },
  bodySmall: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: FontSize.small,
    lineHeight: FontSize.small * LineHeight.normal,
  },
  caption: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: FontSize.caption,
    lineHeight: FontSize.caption * LineHeight.normal,
  },
  
  // UI element styles
  button: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSize.button,
    lineHeight: FontSize.button * LineHeight.tight,
  },
  buttonSmall: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.small,
    lineHeight: FontSize.small * LineHeight.tight,
  },
  tab: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.tab,
    lineHeight: FontSize.tab * LineHeight.tight,
  },
  input: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: FontSize.input,
    lineHeight: FontSize.input * LineHeight.normal,
  },
} as const; 