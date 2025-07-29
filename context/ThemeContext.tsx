import React, { createContext, useContext } from 'react';

// Define our theme colors
const darkTheme = {
  background: '#121212',
  backgroundSecondary: '#1e1e1e',
  cardBackground: '#242424',
  text: '#ffffff',
  textSecondary: '#a0a0a0',
  textPlaceholder: '#888888',
  border: '#323232',
  accent: '#38bdf8', // Bolt style light blue
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  positive: '#22c55e',
  negative: '#ef4444',
  neutral: '#737373'
};

// Theme context type
type ThemeContextType = {
  isDark: boolean;
  colors: typeof darkTheme;
};

// Create context
const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  colors: darkTheme,
});

// Theme provider
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isDark = true; // We're only using dark theme for now
  
  const value = {
    isDark,
    colors: darkTheme,
  };
  
  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook for using theme
export const useTheme = () => useContext(ThemeContext);