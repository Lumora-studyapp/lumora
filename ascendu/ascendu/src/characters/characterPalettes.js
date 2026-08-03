export const SKIN_TONES = Object.freeze([
  { id: "tone-1", label: "Porcelain", value: "#F6D1B8", shade: "#D99B7F" },
  { id: "tone-2", label: "Warm beige", value: "#EAB78F", shade: "#C77E5F" },
  { id: "tone-3", label: "Golden brown", value: "#CB8B61", shade: "#A55E43" },
  { id: "tone-4", label: "Amber", value: "#AA6848", shade: "#82452F" },
  { id: "tone-5", label: "Deep brown", value: "#754532", shade: "#512B22" },
  { id: "tone-6", label: "Espresso", value: "#4B2A24", shade: "#301817" },
]);

export const HAIR_COLOURS = Object.freeze([
  { id: "ink-black", label: "Ink black", value: "#22202C", highlight: "#484153" },
  { id: "dark-brown", label: "Dark brown", value: "#4B302B", highlight: "#755047" },
  { id: "warm-brown", label: "Warm brown", value: "#724532", highlight: "#A36A4D" },
  { id: "soft-auburn", label: "Soft auburn", value: "#873F35", highlight: "#BC6958" },
  { id: "golden", label: "Golden", value: "#B9833E", highlight: "#E9BC68" },
  { id: "silver", label: "Silver", value: "#85889B", highlight: "#C9CBDA" },
]);

export const LUMORA_COLOURS = Object.freeze({
  ink: "#273442",
  softInk: "#526579",
  paper: "#FFFDF7",
  green: "#55A986",
  greenDark: "#33745D",
  mint: "#BDE8D5",
  coral: "#E88575",
  gold: "#E7B85A",
  navy: "#405976",
  shadow: "rgba(35, 50, 65, .18)",
});

export function findPaletteItem(items, id, fallbackId) {
  return items.find(item => item.id === id) || items.find(item => item.id === fallbackId) || items[0];
}
