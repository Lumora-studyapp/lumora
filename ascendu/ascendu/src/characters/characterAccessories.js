export const AURAS = Object.freeze([
  { id: "none", label: "No aura", colour: "transparent" },
  { id: "soft-mint", label: "Soft mint aura", colour: "#8FDFC0" },
  { id: "soft-gold", label: "Soft gold aura", colour: "#F0C86C" },
  { id: "moon-glow", label: "Moon glow aura", colour: "#9FB8FF" },
  { id: "coral-glow", label: "Coral glow aura", colour: "#F29A8D" },
]);

export const ACCESSORIES = Object.freeze([
  { id: "none", label: "No accessory" },
  { id: "round-glasses", label: "Round glasses" },
  { id: "square-glasses", label: "Square glasses" },
  { id: "star-pin", label: "Star study pin" },
  { id: "book-pin", label: "Book study pin" },
]);

export const DESK_THEMES = Object.freeze([
  { id: "default", label: "Maple study desk", top: "#D89B59", edge: "#A86B36", metal: "#486272" },
  { id: "mint", label: "Mint study desk", top: "#A9DCC9", edge: "#5D9F87", metal: "#405C69" },
  { id: "moon", label: "Moonlit study desk", top: "#556A9C", edge: "#344872", metal: "#C3CDE8" },
  { id: "coral", label: "Coral study desk", top: "#E9A08E", edge: "#B9665B", metal: "#4B6270" },
]);

export const LEGACY_CHARACTER_THEMES = Object.freeze({
  default: { name: "Lumora Learner", aura: "soft-mint", desk: "default", accent: "#55A986" },
  moon: { name: "Moonlit Scholar", aura: "moon-glow", desk: "moon", accent: "#829FE8" },
  lightning: { name: "Storm Scholar", aura: "soft-gold", desk: "moon", accent: "#E8C152" },
  dragon: { name: "Dragon Scholar", aura: "coral-glow", desk: "coral", accent: "#D96860" },
  willow: { name: "Willow Scholar", aura: "soft-mint", desk: "mint", accent: "#65A982" },
  sakura: { name: "Sakura Scholar", aura: "coral-glow", desk: "coral", accent: "#E68DA3" },
  diamond: { name: "Prism Scholar", aura: "moon-glow", desk: "moon", accent: "#72BBD0" },
});

export function legacyThemeForSkin(skinId = "default") {
  if (LEGACY_CHARACTER_THEMES[skinId]) return LEGACY_CHARACTER_THEMES[skinId];
  const names = String(skinId).split(/[-_]/).filter(Boolean).map(part => part[0]?.toUpperCase() + part.slice(1));
  return { ...LEGACY_CHARACTER_THEMES.default, name: `${names.join(" ") || "Lumora"} Scholar` };
}
