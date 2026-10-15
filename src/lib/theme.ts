"use client";

import { STORAGE_KEYS } from "./storage/keys";

export type ThemeMode = "system" | "dark" | "light";
export type ResolvedTheme = "dark" | "light";
export type AccentColor = "pine" | "ceramic" | "sand" | "clay";

export interface AccentConfig {
  id: AccentColor;
  name: string;
  lightHex: string;
  darkHex: string;
  lightSubtle: string;
  darkSubtle: string;
  lightBorder: string;
  darkBorder: string;
  previewBg: string;
}

export const ACCENT_PALETTES: AccentConfig[] = [
  {
    id: "pine",
    name: "Pine",
    lightHex: "#2d5a43",
    darkHex: "#4e9b74",
    lightSubtle: "rgba(45, 90, 67, 0.08)",
    darkSubtle: "rgba(78, 155, 116, 0.14)",
    lightBorder: "rgba(45, 90, 67, 0.22)",
    darkBorder: "rgba(78, 155, 116, 0.28)",
    previewBg: "#3e7b5c",
  },
  {
    id: "ceramic",
    name: "Ceramic",
    lightHex: "#2c6277",
    darkHex: "#5299b5",
    lightSubtle: "rgba(44, 98, 119, 0.08)",
    darkSubtle: "rgba(82, 153, 181, 0.14)",
    lightBorder: "rgba(44, 98, 119, 0.22)",
    darkBorder: "rgba(82, 153, 181, 0.28)",
    previewBg: "#4a8b9f",
  },
  {
    id: "sand",
    name: "Sand",
    lightHex: "#826533",
    darkHex: "#c4a56b",
    lightSubtle: "rgba(130, 101, 51, 0.08)",
    darkSubtle: "rgba(196, 165, 107, 0.14)",
    lightBorder: "rgba(130, 101, 51, 0.22)",
    darkBorder: "rgba(196, 165, 107, 0.28)",
    previewBg: "#a8884d",
  },
  {
    id: "clay",
    name: "Clay",
    lightHex: "#8a493a",
    darkHex: "#c2705e",
    lightSubtle: "rgba(138, 73, 58, 0.08)",
    darkSubtle: "rgba(194, 112, 94, 0.14)",
    lightBorder: "rgba(138, 73, 58, 0.22)",
    darkBorder: "rgba(194, 112, 94, 0.28)",
    previewBg: "#a65d4b",
  },
];

/**
 * Normalizes legacy accent names into approved Kanso accents.
 */
export function normalizeAccent(raw: string | null): AccentColor {
  if (!raw) return "pine";
  if (raw === "pine" || raw === "ceramic" || raw === "sand" || raw === "clay") {
    return raw;
  }
  // Map legacy names
  if (raw === "emerald") return "pine";
  if (raw === "cyan") return "ceramic";
  if (raw === "amber") return "sand";
  if (raw === "purple" || raw === "rose") return "clay";
  return "pine";
}

/**
 * Normalizes legacy theme mode names.
 */
export function normalizeThemeMode(raw: string | null): ThemeMode {
  if (raw === "light" || raw === "dark" || raw === "system") {
    return raw;
  }
  return "system";
}

/**
 * Resolves current theme given preference and system scheme.
 */
export function resolveThemeMode(mode: ThemeMode): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return mode;
}

/**
 * Applies theme mode and accent color to document root and persists preference.
 */
export function applyTheme(
  mode: ThemeMode = "system",
  accent: AccentColor = "pine"
): { resolvedMode: ResolvedTheme; accent: AccentColor } {
  if (typeof window === "undefined") {
    return { resolvedMode: "dark", accent: "pine" };
  }

  const root = document.documentElement;
  const resolvedMode = resolveThemeMode(mode);
  const normalizedAccent = normalizeAccent(accent);

  if (resolvedMode === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
  } else {
    root.classList.add("light");
    root.classList.remove("dark");
  }

  root.setAttribute("data-theme", resolvedMode);
  root.setAttribute("data-theme-preference", mode);
  root.setAttribute("data-accent", normalizedAccent);

  const found =
    ACCENT_PALETTES.find((p) => p.id === normalizedAccent) || ACCENT_PALETTES[0];

  const accentHex = resolvedMode === "dark" ? found.darkHex : found.lightHex;
  const accentSubtle =
    resolvedMode === "dark" ? found.darkSubtle : found.lightSubtle;
  const accentBorder =
    resolvedMode === "dark" ? found.darkBorder : found.lightBorder;

  root.style.setProperty("--theme-accent", accentHex);
  root.style.setProperty("--theme-accent-subtle", accentSubtle);
  root.style.setProperty("--theme-accent-border", accentBorder);

  // Persist modern keys
  localStorage.setItem(STORAGE_KEYS.THEME_MODE, mode);
  localStorage.setItem(STORAGE_KEYS.ACCENT_COLOR, normalizedAccent);

  // Sync legacy keys for backward compatibility
  localStorage.setItem("streakflow_theme_mode", mode);
  localStorage.setItem("streakflow_accent_color", normalizedAccent);

  // Broadcast change across the window
  window.dispatchEvent(
    new CustomEvent("kanso-theme-changed", {
      detail: { mode, resolvedMode, accent: normalizedAccent },
    })
  );
  window.dispatchEvent(
    new CustomEvent("streakflow-theme-changed", {
      detail: { mode, resolvedMode, accent: normalizedAccent },
    })
  );

  return { resolvedMode, accent: normalizedAccent };
}

/**
 * Reads initial theme preference from storage with fallback.
 */
export function getInitialTheme(): {
  mode: ThemeMode;
  resolvedMode: ResolvedTheme;
  accent: AccentColor;
} {
  if (typeof window === "undefined") {
    return { mode: "system", resolvedMode: "dark", accent: "pine" };
  }

  const rawMode =
    localStorage.getItem(STORAGE_KEYS.THEME_MODE) ||
    localStorage.getItem("streakflow_theme_mode");
  const mode = normalizeThemeMode(rawMode);

  const rawAccent =
    localStorage.getItem(STORAGE_KEYS.ACCENT_COLOR) ||
    localStorage.getItem("streakflow_accent_color");
  const accent = normalizeAccent(rawAccent);

  const resolvedMode = resolveThemeMode(mode);

  return { mode, resolvedMode, accent };
}
