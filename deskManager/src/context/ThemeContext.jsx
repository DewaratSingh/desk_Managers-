import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const ThemeContext = createContext();

export const defaultTheme = {
  primary: '#0f172a',
  secondary: '#D9352D',
  bgApp: '#f1f5f9', // slate-100
  bgSidebar: '#0f172a', // usually same as primary initially
  bgForm: '#ffffff', // Card & Form Background
  textPrimary: '#0f172a',
  textSidebar: '#ffffff',
  borderColor: '#cbd5e1'
};

const sanitizeTheme = (raw) => {
  if (!raw || typeof raw !== 'object') return { ...defaultTheme };
  // Only accent color (secondary) can be customized; other colors stay at design system defaults
  return {
    ...defaultTheme,
    secondary: typeof raw.secondary === 'string' && raw.secondary.trim() ? raw.secondary.trim() : defaultTheme.secondary
  };
};

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    // 1. Try sessionStorage user.theme first (user table synced)
    try {
      const userStr = sessionStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user.theme && typeof user.theme === 'object' && Object.keys(user.theme).length > 0) {
          return sanitizeTheme(user.theme);
        }
      }
    } catch (e) {
      // ignore
    }

    // 2. Try localStorage
    try {
      const saved = localStorage.getItem('deskmanager-theme');
      if (saved) {
        return sanitizeTheme(JSON.parse(saved));
      }
    } catch (e) {
      // ignore
    }

    return defaultTheme;
  });

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const debounceTimerRef = useRef(null);

  // Sync with backend /api/auth/me on mount or token change
  useEffect(() => {
    const fetchUserTheme = async () => {
      const token = sessionStorage.getItem('token');
      if (!token) return;

      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data?.user?.theme && typeof data.user.theme === 'object' && Object.keys(data.user.theme).length > 0) {
            const merged = sanitizeTheme(data.user.theme);
            setTheme(merged);
            localStorage.setItem('deskmanager-theme', JSON.stringify(merged));
            // Update sessionStorage
            sessionStorage.setItem('user', JSON.stringify({ ...data.user, theme: merged }));
          }
        }
      } catch (err) {
        console.error('Failed to load user theme from database:', err);
      }
    };

    fetchUserTheme();

    const handleLoginEvent = () => fetchUserTheme();
    window.addEventListener('user-logged-in', handleLoginEvent);
    return () => window.removeEventListener('user-logged-in', handleLoginEvent);
  }, []);

  // Apply to CSS variables and localStorage whenever theme changes
  useEffect(() => {
    // Save to localStorage
    localStorage.setItem('deskmanager-theme', JSON.stringify(theme));

    // Apply to CSS variables on root
    const root = document.documentElement;
    root.style.setProperty('--theme-primary', theme.primary || defaultTheme.primary);
    root.style.setProperty('--theme-secondary', theme.secondary || defaultTheme.secondary);
    root.style.setProperty('--bg-app', theme.bgApp || defaultTheme.bgApp);
    root.style.setProperty('--bg-sidebar', theme.bgSidebar || defaultTheme.bgSidebar);
    root.style.setProperty('--bg-form', theme.bgForm || defaultTheme.bgForm);
    root.style.setProperty('--text-primary', theme.textPrimary || defaultTheme.textPrimary);
    root.style.setProperty('--text-sidebar', theme.textSidebar || defaultTheme.textSidebar);
    root.style.setProperty('--border-color', theme.borderColor || defaultTheme.borderColor);
    root.style.setProperty('--theme-color', theme.secondary || defaultTheme.secondary);
    root.style.setProperty('--theme-accent', theme.secondary || defaultTheme.secondary);
    root.style.setProperty('--theme-color-secondary', theme.secondary || defaultTheme.secondary);
    root.style.setProperty('--theme-secondary-text', theme.secondary || defaultTheme.secondary);
  }, [theme]);

  // Function to save theme directly to backend user table
  const saveThemeToDb = async (themeToSave) => {
    const token = sessionStorage.getItem('token');
    if (!token) return false;

    setIsSaving(true);
    try {
      const res = await fetch('/api/auth/theme', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ theme: themeToSave })
      });

      if (res.ok) {
        setLastSaved(new Date());
        // Also update sessionStorage user object
        const userStr = sessionStorage.getItem('user');
        if (userStr) {
          try {
            const user = JSON.parse(userStr);
            user.theme = themeToSave;
            sessionStorage.setItem('user', JSON.stringify(user));
          } catch (e) {
            // ignore
          }
        }
        return true;
      }
    } catch (err) {
      console.error('Error saving theme to user table in DB:', err);
    } finally {
      setIsSaving(false);
    }
    return false;
  };

  const updateTheme = (newTheme) => {
    setTheme(prev => {
      const updated = {
        ...defaultTheme,
        ...prev,
        ...newTheme,
        secondary: newTheme.secondary || prev.secondary || defaultTheme.secondary
      };

      // Debounce saving to database (600ms)
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        saveThemeToDb(updated);
      }, 600);

      return updated;
    });
  };

  const resetTheme = async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setTheme(defaultTheme);
    return await saveThemeToDb(defaultTheme);
  };

  const saveTheme = async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    return await saveThemeToDb(theme);
  };

  return (
    <ThemeContext.Provider value={{ theme, updateTheme, resetTheme, saveTheme, isSaving, lastSaved }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
