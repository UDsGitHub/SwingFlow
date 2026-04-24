import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'swingflow.theme';

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeClass(theme: ResolvedTheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
  root.setAttribute('data-theme', theme);
}

export function initializeThemeFromStorage() {
  if (typeof window === 'undefined') return;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const pref: ThemePreference = raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
  applyThemeClass(pref === 'system' ? getSystemTheme() : pref);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    if (typeof window === 'undefined') return 'system';
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
  });
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    preference === 'system' ? getSystemTheme() : preference,
  );

  useEffect(() => {
    const next = preference === 'system' ? getSystemTheme() : preference;
    setResolved(next);
    applyThemeClass(next);
    window.localStorage.setItem(STORAGE_KEY, preference);
  }, [preference]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (preference !== 'system') return;
      const next = media.matches ? 'dark' : 'light';
      setResolved(next);
      applyThemeClass(next);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [preference]);

  const value = useMemo<ThemeContextValue>(() => ({
    preference,
    resolved,
    setPreference: setPreferenceState,
  }), [preference, resolved]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

