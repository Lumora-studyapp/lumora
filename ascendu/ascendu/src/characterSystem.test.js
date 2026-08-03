import test from "node:test";
import assert from "node:assert/strict";
import {
  BOTTOMS, HAIRSTYLES, SHOES, TOPS, characterPrefsFromLegacy, normalizeCharacterStyle,
} from "./characters/characterDefinitions.js";
import { ACCESSORIES, AURAS, DESK_THEMES } from "./characters/characterAccessories.js";
import { HAIR_COLOURS, SKIN_TONES } from "./characters/characterPalettes.js";
import { characterStageFromEnhancement, normalizeCharacterStage } from "./characters/characterStages.js";

test("legacy enhancements map to stable character stages without resetting progress", () => {
  assert.equal(characterStageFromEnhancement(0), 1);
  assert.equal(characterStageFromEnhancement(1), 1);
  assert.equal(characterStageFromEnhancement(2), 2);
  assert.equal(characterStageFromEnhancement(3), 3);
  assert.equal(normalizeCharacterStage(undefined, 3), 3);
});

test("character preferences accept trusted IDs and replace arbitrary values", () => {
  const style = normalizeCharacterStyle({ skinTone:"tone-6", hairstyle:"not-real", top:"url(javascript:bad)" }, "moon");
  assert.equal(style.skinTone, "tone-6");
  assert.equal(style.hairstyle, "wavy-medium");
  assert.equal(style.top, "mint-sweater");
  assert.equal(style.aura, "moon-glow");
  assert.equal(style.deskTheme, "moon");
});

test("legacy preferences gain safe character defaults without changing legacy fields", () => {
  const prefs = characterPrefsFromLegacy({ activeSkin:"moon", ownedCharacterItems:["theme:moon", 3] });
  assert.equal(prefs.characterBase, "female");
  assert.equal(prefs.characterStyle.aura, "moon-glow");
  assert.deepEqual(prefs.ownedCharacterItems, ["theme:moon"]);
});

test("every controlled customisation option survives trusted-ID normalization", () => {
  const cases = [
    ["skinTone",SKIN_TONES], ["hairstyle",HAIRSTYLES], ["hairColour",HAIR_COLOURS], ["top",TOPS], ["bottom",BOTTOMS],
    ["shoes",SHOES], ["accessory",ACCESSORIES], ["aura",AURAS], ["deskTheme",DESK_THEMES],
  ];
  for (const [key,items] of cases) {
    for (const item of items) assert.equal(normalizeCharacterStyle({[key]:item.id})[key],item.id,`${key}:${item.id}`);
  }
});
