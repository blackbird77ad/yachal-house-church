export const REPORT_AUTOSAVE_DEBOUNCE_MS = 4000;
export const REPORT_AUTOSAVE_INTERVAL_MS = 15000;
export const REPORT_AUTOSAVE_FLUSH_COOLDOWN_MS = 3000;

export const flushDraftAutosaveIfDue = (lastSaveRef, autoSaveRef) => {
  const saveDraftNow = autoSaveRef?.current;

  if (typeof saveDraftNow !== "function") {
    return;
  }

  const lastSavedAt = Number(lastSaveRef?.current || 0);

  if (Date.now() - lastSavedAt <= REPORT_AUTOSAVE_FLUSH_COOLDOWN_MS) {
    return;
  }

  saveDraftNow();
};
