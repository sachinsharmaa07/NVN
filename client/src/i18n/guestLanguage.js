import { useSyncExternalStore } from "react";

// A signed-out visitor's language choice. Signed-in users keep theirs in the profile (server), which wins.
// Browser storage is a per-viewer convenience here: it can be missing or throw, and English is the fallback.
const KEY = "nivaran-language";
const listeners = new Set();

function read() {
  try {
    return localStorage.getItem(KEY) === "hi" ? "hi" : "en";
  } catch {
    return "en";
  }
}

export function setGuestLanguage(lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // private mode or blocked storage: the choice lasts until reload only
  }
  listeners.forEach((fn) => fn());
}

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const useGuestLanguage = () => useSyncExternalStore(subscribe, read, () => "en");
