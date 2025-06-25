// Waffle App Design System Colors
// Based on PRD specifications

const waffleColors = {
  // Primary Brand Colors
  creamyWhite: '#FAF7F2',
  waffleYellow: '#FDB833', 
  burntOrange: '#E57345',
  darkCharcoal: '#3A3A3A',
  
  // Additional UI Colors
  white: '#FFFFFF',
  black: '#000000',
  gray: {
    light: '#F5F5F5',
    medium: '#CCCCCC',
    dark: '#666666',
  },
  
  // Status Colors
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',
};

export default {
  light: {
    // Background Colors
    background: waffleColors.creamyWhite,
    surface: waffleColors.white,
    
    // Text Colors  
    text: waffleColors.darkCharcoal,
    textSecondary: waffleColors.gray.dark,
    textOnPrimary: waffleColors.darkCharcoal,
    
    // Brand Colors
    primary: waffleColors.waffleYellow,
    secondary: waffleColors.burntOrange,
    accent: waffleColors.burntOrange,
    
    // Navigation
    tint: waffleColors.waffleYellow,
    tabIconDefault: waffleColors.gray.medium,
    tabIconSelected: waffleColors.waffleYellow,
    
    // Interactive Elements
    buttonPrimary: waffleColors.waffleYellow,
    buttonSecondary: waffleColors.burntOrange,
    border: waffleColors.gray.light,
    
    // Status Colors
    success: waffleColors.success,
    warning: waffleColors.warning,
    error: waffleColors.error,
    info: waffleColors.info,
  },
  dark: {
    // Background Colors
    background: waffleColors.darkCharcoal,
    surface: '#2A2A2A',
    
    // Text Colors
    text: waffleColors.creamyWhite,
    textSecondary: waffleColors.gray.light,
    textOnPrimary: waffleColors.darkCharcoal,
    
    // Brand Colors
    primary: waffleColors.waffleYellow,
    secondary: waffleColors.burntOrange,
    accent: waffleColors.burntOrange,
    
    // Navigation
    tint: waffleColors.waffleYellow,
    tabIconDefault: waffleColors.gray.medium,
    tabIconSelected: waffleColors.waffleYellow,
    
    // Interactive Elements
    buttonPrimary: waffleColors.waffleYellow,
    buttonSecondary: waffleColors.burntOrange,
    border: '#444444',
    
    // Status Colors
    success: waffleColors.success,
    warning: waffleColors.warning,
    error: waffleColors.error,
    info: waffleColors.info,
  },
};

// Export individual colors for direct access
export { waffleColors };
