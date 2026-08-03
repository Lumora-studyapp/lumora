export const ADMIN_CONSOLE_USERNAMES = Object.freeze(["phamalam", "v2trappy"]);

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
