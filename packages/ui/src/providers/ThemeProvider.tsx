"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ResolvedTheme, Theme } from "@aegis/design-system";
import { invariant } from "@aegis/utils";

const STORAGE_KEY = "aegis_theme";

interface ThemeContextValue {
  /** What the customer chose — may be "system". */
  theme: Theme;
  /** What that actually resolves to right now. */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * The script that runs before the first paint.
 *
 * Without it the page renders in the light theme and then corrects itself once
 * React hydrates — the white flash that makes a dark-mode product feel broken,
 * and which is genuinely unpleasant for anyone using dark mode because bright
 * light hurts. It has to be inline and synchronous in `<head>`: any deferred
 * script is already too late.
 *
 * Kept deliberately tiny and dependency-free, because it blocks rendering.
 */
export const themeInitScript = `
(function(){try{
  var stored = localStorage.getItem("${STORAGE_KEY}");
  var theme = stored === "light" || stored === "dark" ? stored
    : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  var root = document.documentElement;
  root.classList.remove("light","dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;
}catch(e){}})();
`;

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
  root.style.colorScheme = resolved;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
}: {
  children: ReactNode;
  defaultTheme?: Theme;
}) {
  // Starts from the prop, not from storage: reading storage during render would
  // produce different markup on the server and the client. The effect below
  // reconciles with what the pre-paint script already applied.
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initial: Theme = stored ?? defaultTheme;
    setThemeState(initial);
    const resolved = initial === "system" ? systemTheme() : initial;
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, [defaultTheme]);

  // Follow the operating system while the choice is "system" — someone whose
  // phone switches to dark at sunset expects this to follow, without a reload.
  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const resolved = systemTheme();
      setResolvedTheme(resolved);
      applyTheme(resolved);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode or disabled storage. The choice still applies for this
      // visit; it simply will not be remembered.
    }
    const resolved = next === "system" ? systemTheme() : next;
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  invariant(context, "useTheme must be used within a <ThemeProvider>");
  return context;
}
