import React, { createContext, useContext } from 'react';
import { useColorScheme } from './useColorScheme';

export const WaffleTheme = {
  light: {
    background: '#FAF7F2', // Creamy White
    surface: '#FFFFFF',
    primary: '#FDB833',     // Waffle Yellow
    secondary: '#E57345',   // Burnt Orange
    text: '#3A3A3A',       // Dark Charcoal
    textSecondary: '#6B7280',
    border: '#E5E7EB',
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
  },
  dark: {
    background: '#1F2937',
    surface: '#374151',
    primary: '#FDB833',     // Waffle Yellow (same)
    secondary: '#E57345',   // Burnt Orange (same)
    text: '#F9FAFB',
    textSecondary: '#D1D5DB',
    border: '#4B5563',
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
  }
};

export const WaffleFonts = {
  header: {
    bold: 'SpaceMono', // Will be replaced with Poppins when added
    medium: 'SpaceMono',
    regular: 'SpaceMono',
  },
  body: {
    bold: 'SpaceMono', // Will be replaced with Inter when added
    medium: 'SpaceMono', 
    regular: 'SpaceMono',
  }
};

const ThemeContext = createContext(WaffleTheme.light);

export const useWaffleTheme = () => {
  return useContext(ThemeContext);
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const WaffleThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? WaffleTheme.dark : WaffleTheme.light;

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};