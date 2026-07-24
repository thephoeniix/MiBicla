import { useEffect, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "mb_theme";
export const THEME_EVENT = "theme:change";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  return preference === "system"
    ? systemPrefersDark
      ? "dark"
      : "light"
    : preference;
}

export function applyTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
  root: Pick<HTMLElement, "dataset"> = document.documentElement,
) {
  const resolved = resolveTheme(preference, systemPrefersDark);
  root.dataset.theme = resolved;
  root.dataset.themePreference = preference;
  if (typeof document !== "undefined" && root === document.documentElement) {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", resolved === "dark" ? "#110f10" : "#f7f6f7");
  }
  return resolved;
}

export function readThemePreference(
  storage: Pick<Storage, "getItem"> = localStorage,
): ThemePreference {
  try {
    const stored = storage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function persistThemePreference(
  preference: ThemePreference,
  storage: Pick<Storage, "setItem"> = localStorage,
) {
  storage.setItem(THEME_STORAGE_KEY, preference);
}

export function useThemePreference() {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    readThemePreference(),
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => applyTheme(preference, media.matches);
    const sync = (event: Event) => {
      const next = (event as CustomEvent<ThemePreference>).detail;
      if (isThemePreference(next)) setPreferenceState(next);
    };
    update();
    window.addEventListener(THEME_EVENT, sync);
    if (preference === "system") media.addEventListener("change", update);
    return () => {
      window.removeEventListener(THEME_EVENT, sync);
      media.removeEventListener("change", update);
    };
  }, [preference]);

  function setPreference(next: ThemePreference) {
    try {
      persistThemePreference(next);
    } catch {
      // The selected theme still applies when storage is unavailable.
    }
    setPreferenceState(next);
    window.dispatchEvent(
      new CustomEvent<ThemePreference>(THEME_EVENT, { detail: next }),
    );
  }

  return { preference, setPreference };
}
