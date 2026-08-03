import { useMemo } from "react";
import CharacterRenderer from "./CharacterRenderer.jsx";
import {
  BOTTOMS, CHARACTER_BASES, HAIRSTYLES, SHOES, TOPS, normalizeCharacterBase,
  normalizeCharacterStyle,
} from "./characterDefinitions.js";
import { ACCESSORIES, AURAS, DESK_THEMES } from "./characterAccessories.js";
import { HAIR_COLOURS, SKIN_TONES } from "./characterPalettes.js";

const CATEGORIES = Object.freeze([
  ["skinTone", "Skin tone", SKIN_TONES], ["hairstyle", "Hairstyle", HAIRSTYLES],
  ["hairColour", "Hair colour", HAIR_COLOURS], ["top", "Top", TOPS],
  ["bottom", "Bottom", BOTTOMS], ["shoes", "Shoes", SHOES],
  ["accessory", "Accessory", ACCESSORIES], ["aura", "Aura", AURAS],
  ["deskTheme", "Desk", DESK_THEMES],
]);

export default function CharacterCustomizer({ base, value, legacySkin="default", stage=1, onChange, onClose }) {
  const safeBase = normalizeCharacterBase(base);
  const safeStyle = useMemo(() => normalizeCharacterStyle(value, legacySkin), [value, legacySkin]);
  const updateStyle = (key, id) => onChange({ characterBase:safeBase, characterStyle:{...safeStyle,[key]:id} });
  return <div className="lc-customizer" role="dialog" aria-modal="true" aria-labelledby="lc-custom-title">
    <div className="lc-custom-preview">
      <div><span>YOUR LEARNER</span><h2 id="lc-custom-title">Character studio</h2><p>Build a learner who feels like you. Every option works with either base.</p></div>
      <CharacterRenderer base={safeBase} characterStyle={safeStyle} legacySkin={legacySkin} stage={stage} view="three-quarter" activity="idle" size={180}/>
    </div>
    <fieldset className="lc-option-group"><legend>Base character</legend><div className="lc-option-row">{CHARACTER_BASES.map(item=><button type="button" key={item.id} aria-pressed={safeBase===item.id} className={safeBase===item.id?"is-selected":""} onClick={()=>onChange({characterBase:item.id,characterStyle:safeStyle})}>{item.label}</button>)}</div></fieldset>
    {CATEGORIES.map(([key,label,items])=><fieldset className="lc-option-group" key={key}><legend>{label}</legend><div className="lc-option-row">{items.map(item=><button type="button" key={item.id} aria-label={item.label} aria-pressed={safeStyle[key]===item.id} className={safeStyle[key]===item.id?"is-selected":""} onClick={()=>updateStyle(key,item.id)}>{item.value&&<i style={{background:item.value}}/>}{item.label}</button>)}</div></fieldset>)}
    <button type="button" className="lc-custom-done" onClick={onClose}>Done customising</button>
  </div>;
}
