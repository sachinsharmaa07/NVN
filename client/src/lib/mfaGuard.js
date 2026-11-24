/*
 * Stops an endless "sign in again for two-step verification" loop.
 * When the server says MFA_REQUIRED we send the user to Auth0 with prompt=login ONCE. If they come
 * back and the server still says MFA_REQUIRED (the tenant is not adding the claim), asking again
 * would loop forever, so we stop and show an error with Sign out instead.
 * The flag is only a timestamp in sessionStorage (this tab only), never a token. Storage can be
 * blocked, so every access is wrapped; without it we fail safe and do not auto-redirect.
 */
const KEY = "nivaran.mfaAttemptAt";
export const MFA_WINDOW_MS = 2 * 60_000;

function read() {
  try {
    const value = Number(window.sessionStorage.getItem(KEY));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

// Was an automatic attempt made recently (in this tab)?
export function mfaAttempted(now = Date.now()) {
  return now - read() < MFA_WINDOW_MS;
}

// True if we may redirect now; records the attempt first, so a second call says false.
export function claimMfaAttempt(now = Date.now()) {
  if (mfaAttempted(now)) return false;
  try {
    window.sessionStorage.setItem(KEY, String(now));
  } catch {
    return false; // cannot remember the attempt, so do not risk a loop
  }
  return true;
}

// Called when /api/me works. A fresh flag stays (an admin call may still be about to fail with
// MFA_REQUIRED after the return from Auth0); only an old one is removed.
export function clearMfaAttempt(now = Date.now()) {
  if (mfaAttempted(now)) return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to clean up */
  }
}
