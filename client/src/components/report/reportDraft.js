// The report draft survives Back and a refresh (docs/UI.md §7), in sessionStorage: it holds no
// secrets and is gone when the tab closes. Storage can be blocked, so every access is guarded.
const KEY = "nivaran.report.draft";

export function readDraft() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
}

export function saveDraft(patch) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...readDraft(), ...patch }));
  } catch {
    // Private mode or full storage: the wizard still works, the draft just won't survive a refresh.
  }
}
