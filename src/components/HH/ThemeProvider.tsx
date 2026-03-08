import React, { createContext, useContext, useState, useEffect } from 'react';

type ThemeSetting = 'light' | 'dark' | 'auto';
type ResolvedTheme = 'light' | 'dark';

const ThemeContext = createContext<{
  theme: ThemeSetting;
  resolvedTheme: ResolvedTheme;
  setTheme: (mode: ThemeSetting) => void;
  toggleTheme: () => void;
}>({ theme: 'light', resolvedTheme: 'light', setTheme: () => {}, toggleTheme: () => {} });

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(setting: ThemeSetting): ResolvedTheme {
  if (setting === 'auto') return getSystemTheme();
  return setting;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeSetting>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlTheme = params.get('theme');
      if (urlTheme === 'dark' || urlTheme === 'light' || urlTheme === 'auto') {
        localStorage.setItem('hh-theme', urlTheme);
        return urlTheme;
      }
    } catch {}
    const saved = localStorage.getItem('hh-theme');
    if (saved === 'dark' || saved === 'light' || saved === 'auto') return saved;
    return 'light';
  });

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(theme));

  // Apply theme class to document
  useEffect(() => {
    const root = document.documentElement;
    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);

    if (resolved === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('hh-theme', theme);
  }, [theme]);

  // Listen for system theme changes when in auto mode
  useEffect(() => {
    if (theme !== 'auto') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const resolved = getSystemTheme();
      setResolvedTheme(resolved);
      const root = document.documentElement;
      if (resolved === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = (mode: ThemeSetting) => setThemeState(mode);
  const toggleTheme = () => setThemeState(prev => prev === 'light' ? 'dark' : 'light');

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
