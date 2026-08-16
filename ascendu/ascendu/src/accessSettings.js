// Keep the original V2Trappy spelling for backwards compatibility and accept
// the V2Trapps preview account requested by the Lumora team. A verified
// roles/{uid}.admin document is still required for cross-user controls.
export const ADMIN_CONSOLE_USERNAMES = Object.freeze(["phamalam", "v2trappy", "v2trapps"]);

export const ANIMATION_MODES = Object.freeze(["device", "full", "off"]);

export function normalizeAnimationMode(value) {
  return ANIMATION_MODES.includes(value) ? value : "device";
}

export function shouldDisableAnimations(mode, prefersReducedMotion = false) {
  const normalized = normalizeAnimationMode(mode);
  if (normalized === "off") return true;
  if (normalized === "full") return false;
  return Boolean(prefersReducedMotion);
}

export function isAdminConsoleUsername(value, extraUsernames = []) {
  const canonical = String(value || "").trim().normalize("NFC").toLowerCase();
  const allowed = new Set([
    ...ADMIN_CONSOLE_USERNAMES,
    ...extraUsernames.map(name => String(name || "").trim().normalize("NFC").toLowerCase()),
  ]);
  return allowed.has(canonical);
}
