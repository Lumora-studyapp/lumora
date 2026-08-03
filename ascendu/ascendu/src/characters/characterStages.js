export const CHARACTER_STAGES = Object.freeze({
  1: Object.freeze({ id: 1, label: "Beginning", auraStrength: .2, props: [] }),
  2: Object.freeze({ id: 2, label: "Developing", auraStrength: .42, props: ["books", "stationery"] }),
  3: Object.freeze({ id: 3, label: "Flourishing", auraStrength: .68, props: ["books", "stationery", "lamp", "notes"] }),
});

export function characterStageFromEnhancement(value) {
  const tier = Math.max(0, Math.min(3, Number(value) || 0));
  return tier >= 3 ? 3 : tier >= 2 ? 2 : 1;
}

export function normalizeCharacterStage(value, legacyEnhancement = 0) {
  const stage = Number(value);
  if (stage === 1 || stage === 2 || stage === 3) return stage;
  return characterStageFromEnhancement(legacyEnhancement);
}
