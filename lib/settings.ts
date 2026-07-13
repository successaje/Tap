"use client";

export interface Settings {
  currency: string;
  proMode: boolean;
  hideBalance: boolean;
}

const SETTINGS_KEY = "tap:settings";

export const defaultSettings: Settings = {
  currency: "USD",
  proMode: false,
  hideBalance: false,
};

export function getSettings(): Settings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  }
  return next;
}
