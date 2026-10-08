import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

const defaultTheme = {
  primary: '#0f172a',
  secondary: '#D9352D',
  bgApp: '#f1f5f9', // slate-100
  bgSidebar: '#0f172a', // usually same as primary initially
  bgForm: 'transparent',
  textPrimary: '#0f172a',
  textSidebar: '#ffffff',
  borderColor: '#cbd5e1'
};

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('deskmanager-theme');
    return saved ? JSON.parse(saved) : defaultTheme;
  });

  useEffect(() => {
    // Save to localStorage
    localStorage.setItem('deskmanager-theme', JSON.stringify(theme));

    // Apply to CSS variables on root
    const root = document.documentElement;
    root.style.setProperty('--theme-primary', theme.primary);
    root.style.setProperty('--theme-secondary', theme.secondary);
    root.style.setProperty('--bg-app', theme.bgApp);
    root.style.setProperty('--bg-sidebar', theme.bgSidebar);
    root.style.setProperty('--bg-form', theme.bgForm);
    root.style.setProperty('--text-primary', theme.textPrimary);
    root.style.setProperty('--text-sidebar', theme.textSidebar);
    root.style.setProperty('--border-color', theme.borderColor);

    // Also update derivatives if needed (optional based on App.css)
  }, [theme]);

  const updateTheme = (newTheme) => {
    setTheme(prev => ({ ...prev, ...newTheme }));
  };

  const resetTheme = () => {
    setTheme(defaultTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, updateTheme, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
