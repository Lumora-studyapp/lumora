import { ACCESSORIES, AURAS, DESK_THEMES, legacyThemeForSkin } from "./characterAccessories.js";
import { HAIR_COLOURS, SKIN_TONES } from "./characterPalettes.js";

export const CHARACTER_BASES = Object.freeze([
  { id: "male", label: "Male base" },
  { id: "female", label: "Female base" },
]);

export const HAIRSTYLES = Object.freeze([
  { id: "short-textured", label: "Short textured hairstyle" },
  { id: "wavy-medium", label: "Wavy medium hairstyle" },
  { id: "side-parted", label: "Side-parted hairstyle" },
  { id: "soft-curly", label: "Soft curly hairstyle" },
  { id: "short-bob", label: "Short bob hairstyle" },
  { id: "soft-bun", label: "Soft bun hairstyle" },
  { id: "braided", label: "Braided hairstyle" },
  { id: "long-straight", label: "Long straight hairstyle" },
]);

export const TOPS = Object.freeze([
  { id: "mint-sweater", label: "Mint study sweater", main: "#71B99B", light: "#A4D8C2", trim: "#397D65" },
  { id: "forest-cardigan", label: "Forest cardigan", main: "#477D68", light: "#6FA68E", trim: "#EDE0B8" },
  { id: "coral-cardigan", label: "Coral cardigan", main: "#D9796C", light: "#EC9B8F", trim: "#FFF0D5" },
  { id: "navy-jacket", label: "Navy study jacket", main: "#435D79", light: "#69839E", trim: "#D6E5E7" },
  { id: "gold-hoodie", label: "Golden study hoodie", main: "#CF9C44", light: "#E6BD72", trim: "#FFF1C7" },
]);

export const BOTTOMS = Object.freeze([
  { id: "navy-trousers", label: "Navy trousers", main: "#334B66", light: "#4E6883" },
  { id: "charcoal-trousers", label: "Charcoal trousers", main: "#3E4855", light: "#596574" },
  { id: "sage-trousers", label: "Sage trousers", main: "#587B70", light: "#71958A" },
  { id: "navy-skirt", label: "Navy skirt", main: "#3F5570", light: "#607691" },
  { id: "coral-skirt", label: "Coral skirt", main: "#AF625E", light: "#CD8079" },
]);

export const SHOES = Object.freeze([
  { id: "blue-sneakers", label: "Blue sneakers", main: "#4B7892", sole: "#EAF1EE" },
  { id: "white-sneakers", label: "White sneakers", main: "#E9EFEA", sole: "#ABBCC1" },
  { id: "forest-sneakers", label: "Forest sneakers", main: "#3E705D", sole: "#E8EFE9" },
  { id: "coral-flats", label: "Coral flats", main: "#B85E57", sole: "#773F3C" },
]);

export const CHARACTER_VIEWS = Object.freeze(["front", "three-quarter", "side", "back-three-quarter", "seated"]);
export const CHARACTER_ACTIVITIES = Object.freeze(["idle", "study", "break", "complete"]);

export const DEFAULT_CHARACTER_STYLE = Object.freeze({
  skinTone: "tone-3",
  hairstyle: "wavy-medium",
  hairColour: "dark-brown",
  top: "mint-sweater",
  bottom: "navy-trousers",
  shoes: "blue-sneakers",
  accessory: "none",
  aura: "soft-mint",
  deskTheme: "default",
});

const VALID_IDS = Object.freeze({
  skinTone: new Set(SKIN_TONES.map(item => item.id)),
  hairstyle: new Set(HAIRSTYLES.map(item => item.id)),
  hairColour: new Set(HAIR_COLOURS.map(item => item.id)),
  top: new Set(TOPS.map(item => item.id)),
  bottom: new Set(BOTTOMS.map(item => item.id)),
  shoes: new Set(SHOES.map(item => item.id)),
  accessory: new Set(ACCESSORIES.map(item => item.id)),
  aura: new Set(AURAS.map(item => item.id)),
  deskTheme: new Set(DESK_THEMES.map(item => item.id)),
});

export function normalizeCharacterBase(value) {
  return value === "male" ? "male" : "female";
}

export function normalizeCharacterStyle(value = {}, legacySkin = "default") {
  const theme = legacyThemeForSkin(legacySkin);
  const candidate = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const fallback = { ...DEFAULT_CHARACTER_STYLE, aura: theme.aura, deskTheme: theme.desk };
  return Object.fromEntries(Object.keys(VALID_IDS).map(key => [
    key,
    VALID_IDS[key].has(candidate[key]) ? candidate[key] : fallback[key],
  ]));
}

export function characterPrefsFromLegacy(prefs = {}) {
  const activeSkin = typeof prefs.activeSkin === "string" ? prefs.activeSkin : "default";
  return {
    characterBase: normalizeCharacterBase(prefs.characterBase),
    characterStyle: normalizeCharacterStyle(prefs.characterStyle, activeSkin),
    selectedDeskTheme: normalizeCharacterStyle(prefs.characterStyle, activeSkin).deskTheme,
    ownedCharacterItems: Array.isArray(prefs.ownedCharacterItems) ? prefs.ownedCharacterItems.filter(id => typeof id === "string") : [],
  };
}

export function optionById(options, id) {
  return options.find(item => item.id === id) || options[0];
}
