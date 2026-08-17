import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

export const DEFAULT_BACKGROUND_ID = "classic-grove";

export const BACKGROUND_CATALOGUE = Object.freeze([
  {
    id: DEFAULT_BACKGROUND_ID,
    name: "Study Corner",
    cost: 0,
    rarity: "Default",
    collection: "study",
    art: "classic",
    tone: "light",
    motion: "none",
    description: "A bright, plant-filled corner for calm everyday study.",
    imageSrc: "/backgrounds/study-corner.webp",
    imageSrcMobile: "/backgrounds/study-corner-mobile.webp",
    imageOpacity: .44,
    imagePreviewOpacity: .9,
    imagePosition: "center 48%",
    imagePositionMobile: "center center",
    baseColor: "#F5F7F2",
    gradient: "linear-gradient(155deg,#FBFCF7 0%,#F2F6EE 55%,#E8F1E6 100%)",
    shellSurface: "linear-gradient(180deg,#F9FBF7,#F3F8F1)",
    focusSurface: "#F4F8F3",
    uiAccent: "#6E9B72",
    uiAccentSoft: "rgba(110,155,114,.16)",
    darkPalette: {
      tone: "dark",
      baseColor: "#101A16",
      gradient: "linear-gradient(155deg,#1B2A22 0%,#101A16 55%,#0A110E 100%)",
      shellSurface: "linear-gradient(180deg,#F4F9F6,#E8F0EB)",
      focusSurface: "#EEF5F0",
      uiAccent: "#77A887",
      uiAccentSoft: "rgba(119,168,135,.19)",
    },
  },
  {
    id: "midnight-minimal",
    name: "Midnight Study",
    cost: 220,
    rarity: "Common",
    collection: "study",
    art: "midnight",
    tone: "dark",
    motion: "none",
    description: "A quiet blue study room made for late-night focus.",
    imageSrc: "/backgrounds/midnight-study.webp",
    imageSrcMobile: "/backgrounds/midnight-study-mobile.webp",
    imageOpacity: .4,
    imagePreviewOpacity: .88,
    imagePosition: "center 43%",
    imagePositionMobile: "center center",
    baseColor: "#0B1112",
    gradient: "linear-gradient(155deg,#111918 0%,#0B1112 52%,#080D0F 100%)",
    shellSurface: "linear-gradient(180deg,rgba(244,248,245,.72),rgba(230,237,232,.63))",
    focusSurface: "rgba(235,241,237,.91)",
    uiAccent: "#6D9A80",
    uiAccentSoft: "rgba(109,154,128,.18)",
    darkPalette: {
      tone: "dark",
      baseColor: "#050809",
      gradient: "linear-gradient(155deg,#0A100F 0%,#050809 54%,#020405 100%)",
      shellSurface: "linear-gradient(180deg,rgba(248,250,249,.76),rgba(237,242,239,.69))",
      focusSurface: "rgba(242,246,244,.93)",
      uiAccent: "#6D9A80",
      uiAccentSoft: "rgba(109,154,128,.16)",
    },
  },
  {
    id: "sunset-loft",
    name: "Sunset Loft",
    cost: 260,
    rarity: "Common",
    collection: "study",
    art: "forest",
    tone: "light",
    motion: "low",
    description: "A warm timber loft beneath a wide sunset skylight.",
    imageSrc: "/backgrounds/attic-study.webp",
    imageSrcMobile: "/backgrounds/attic-study-mobile.webp",
    imageOpacity: .42,
    imagePreviewOpacity: .9,
    imagePosition: "center 44%",
    imagePositionMobile: "center center",
    baseColor: "#DDEDD7",
    gradient: "linear-gradient(160deg,#FFF3D1 0%,#DDEFD8 48%,#A9CDA9 100%)",
    shellSurface: "linear-gradient(180deg,rgba(248,251,243,.62),rgba(235,245,233,.52))",
    focusSurface: "rgba(239,247,239,.86)",
    uiAccent: "#79A56F",
    uiAccentSoft: "rgba(121,165,111,.18)",
    darkPalette: {
      tone: "dark",
      baseColor: "#102318",
      gradient: "linear-gradient(160deg,#26392F 0%,#102318 50%,#08110D 100%)",
      shellSurface: "linear-gradient(180deg,rgba(244,249,243,.7),rgba(229,239,230,.61))",
      focusSurface: "rgba(237,245,238,.9)",
      uiAccent: "#75A87B",
      uiAccentSoft: "rgba(117,168,123,.2)",
    },
  },
  {
    id: "sakura-lake",
    name: "Sakura Lake",
    cost: 500,
    rarity: "Rare",
    collection: "nature",
    art: "blossom",
    tone: "light",
    motion: "none",
    description: "A quiet blossom-lined lake beneath a rose-coloured sky.",
    imageSrc: "/backgrounds/sakura-lake.webp",
    imageSrcMobile: "/backgrounds/sakura-lake-mobile.webp",
    imageOpacity: .4,
    imagePreviewOpacity: .9,
    imagePosition: "center 50%",
    imagePositionMobile: "center center",
    baseColor: "#F7DFE6",
    gradient: "linear-gradient(160deg,#FFF6F4 0%,#F7DFE6 52%,#EAC6D5 100%)",
    shellSurface: "linear-gradient(180deg,rgba(253,249,248,.64),rgba(250,238,243,.54))",
    focusSurface: "rgba(249,244,244,.87)",
    uiAccent: "#C58FA5",
    uiAccentSoft: "rgba(197,143,165,.18)",
    darkPalette: {
      tone: "dark",
      baseColor: "#24131D",
      gradient: "linear-gradient(160deg,#432C3B 0%,#24131D 54%,#120A10 100%)",
      shellSurface: "linear-gradient(180deg,rgba(250,245,248,.71),rgba(240,229,236,.62))",
      focusSurface: "rgba(246,238,243,.9)",
      uiAccent: "#BD849D",
      uiAccentSoft: "rgba(189,132,157,.2)",
    },
  },
  {
    id: "rainfall-sanctuary",
    name: "Rainfall Sanctuary",
    cost: 520,
    rarity: "Rare",
    collection: "nature",
    art: "rain",
    tone: "cool",
    motion: "none",
    description: "A misty mountain lake under a calm, steady rainfall.",
    imageSrc: "/backgrounds/rainfall-sanctuary.webp",
    imageSrcMobile: "/backgrounds/rainfall-sanctuary-mobile.webp",
    imageOpacity: .38,
    imagePreviewOpacity: .9,
    imagePosition: "center 48%",
    imagePositionMobile: "center center",
    baseColor: "#B8CAD3",
    gradient: "linear-gradient(155deg,#DDE8EC 0%,#B8CAD3 52%,#879FAB 100%)",
    shellSurface: "linear-gradient(180deg,rgba(246,250,250,.67),rgba(229,239,243,.58))",
    focusSurface: "rgba(237,244,244,.88)",
    uiAccent: "#718F9E",
    uiAccentSoft: "rgba(113,143,158,.18)",
    darkPalette: {
      tone: "dark",
      baseColor: "#0F1A22",
      gradient: "linear-gradient(155deg,#2A3945 0%,#14232C 52%,#080F15 100%)",
      shellSurface: "linear-gradient(180deg,rgba(243,247,249,.72),rgba(227,236,241,.63))",
      focusSurface: "rgba(235,242,245,.91)",
      uiAccent: "#7798A9",
      uiAccentSoft: "rgba(119,152,169,.2)",
    },
  },
  {
    id: "ivybound-library",
    name: "Ivybound Library",
    cost: 650,
    rarity: "Rare",
    collection: "study",
    art: "library",
    tone: "warm",
    motion: "none",
    description: "A leafy reading room filled with warm shelves and lamplight.",
    imageSrc: "/backgrounds/library-study.webp",
    imageSrcMobile: "/backgrounds/library-study-mobile.webp",
    imageOpacity: .42,
    imagePreviewOpacity: .9,
    imagePosition: "center 48%",
    imagePositionMobile: "center center",
    baseColor: "#B99D78",
    gradient: "linear-gradient(155deg,#F3E8D2 0%,#CCB38E 50%,#8A684B 100%)",
    shellSurface: "linear-gradient(180deg,rgba(252,248,239,.68),rgba(244,234,218,.58))",
    focusSurface: "rgba(248,243,234,.89)",
    uiAccent: "#96704E",
    uiAccentSoft: "rgba(150,112,78,.19)",
    darkPalette: {
      tone: "dark",
      baseColor: "#1A120D",
      gradient: "linear-gradient(155deg,#39291C 0%,#1A120D 52%,#0C0806 100%)",
      shellSurface: "linear-gradient(180deg,rgba(250,246,238,.73),rgba(239,231,220,.64))",
      focusSurface: "rgba(246,241,232,.91)",
      uiAccent: "#A77A52",
      uiAccentSoft: "rgba(167,122,82,.21)",
    },
  },
  {
    id: "lantern-study-hall",
    name: "Lantern Blossom Hall",
    cost: 720,
    rarity: "Rare",
    collection: "festival",
    art: "lanterns",
    tone: "warm",
    motion: "low",
    description: "A warm festival room glowing with lanterns and blossom light.",
    imageSrc: "/backgrounds/festival-study.webp",
    imageSrcMobile: "/backgrounds/festival-study-mobile.webp",
    imageOpacity: .38,
    imagePreviewOpacity: .88,
    imagePosition: "center 42%",
    imagePositionMobile: "center center",
    baseColor: "#7A493C",
    gradient: "linear-gradient(160deg,#D58A64 0%,#8D5547 48%,#382B35 100%)",
    shellSurface: "linear-gradient(180deg,rgba(252,244,232,.69),rgba(242,226,211,.59))",
    focusSurface: "rgba(248,239,229,.9)",
    uiAccent: "#A7664C",
    uiAccentSoft: "rgba(167,102,76,.2)",
    darkPalette: {
      tone: "dark",
      baseColor: "#190F13",
      gradient: "linear-gradient(160deg,#4D2C29 0%,#22151A 52%,#0B080D 100%)",
      shellSurface: "linear-gradient(180deg,rgba(250,243,235,.73),rgba(239,228,219,.64))",
      focusSurface: "rgba(247,239,232,.92)",
      uiAccent: "#B17359",
      uiAccentSoft: "rgba(177,115,89,.21)",
    },
  },
  {
    id: "violet-moonlands",
    name: "Violet Moonlands",
    cost: 780,
    rarity: "Epic",
    collection: "celestial",
    art: "moonlands",
    tone: "dark",
    motion: "none",
    description: "A vast violet lunar plain beneath planets and falling stars.",
    imageSrc: "/backgrounds/violet-moonlands.webp",
    imageSrcMobile: "/backgrounds/violet-moonlands-mobile.webp",
    imageOpacity: .38,
    imagePreviewOpacity: .9,
    imagePosition: "center 48%",
    imagePositionMobile: "center center",
    baseColor: "#17263D",
    gradient: "linear-gradient(160deg,#293C5C 0%,#17263D 56%,#0E1828 100%)",
    shellSurface: "linear-gradient(180deg,rgba(245,249,250,.72),rgba(229,238,243,.63))",
    focusSurface: "rgba(235,242,243,.89)",
    uiAccent: "#617B9E",
    uiAccentSoft: "rgba(97,123,158,.18)",
    darkPalette: {
      tone: "dark",
      baseColor: "#090F1B",
      gradient: "linear-gradient(160deg,#18263E 0%,#0B1424 56%,#050912 100%)",
      shellSurface: "linear-gradient(180deg,rgba(244,247,250,.74),rgba(229,235,243,.65))",
      focusSurface: "rgba(237,241,246,.92)",
      uiAccent: "#6F86A8",
      uiAccentSoft: "rgba(111,134,168,.2)",
    },
  },
  {
    id: "ocean-observatory",
    name: "Ocean Observatory",
    cost: 1180,
    rarity: "Epic",
    collection: "discovery",
    art: "ocean",
    tone: "cool",
    motion: "none",
    description: "A glass-walled learning room beneath blue water, drifting bubbles and quiet sea life.",
    imageSrc: "/backgrounds/ocean-observatory.webp",
    imageSrcMobile: "/backgrounds/ocean-observatory-mobile.webp",
    imageOpacity: .38,
    imagePreviewOpacity: .9,
    imagePosition: "center 46%",
    imagePositionMobile: "center center",
    baseColor: "#0C5268",
    gradient: "linear-gradient(165deg,#2195A6 0%,#0C5970 50%,#073047 100%)",
    shellSurface: "linear-gradient(180deg,rgba(237,249,248,.7),rgba(219,239,240,.61))",
    focusSurface: "rgba(231,244,244,.9)",
    uiAccent: "#3C8EA0",
    uiAccentSoft: "rgba(60,142,160,.2)",
    darkPalette: {
      tone: "dark",
      baseColor: "#041923",
      gradient: "linear-gradient(165deg,#0E5265 0%,#062B3A 52%,#021018 100%)",
      shellSurface: "linear-gradient(180deg,rgba(236,246,247,.74),rgba(219,235,238,.65))",
      focusSurface: "rgba(233,242,244,.92)",
      uiAccent: "#4F91A2",
      uiAccentSoft: "rgba(79,145,162,.21)",
    },
  },
  {
    id: "celestial-garden",
    name: "Celestial Nook",
    cost: 1400,
    rarity: "Mythical",
    collection: "celestial",
    art: "celestial",
    tone: "dark",
    motion: "medium",
    description: "A moonlit observatory room with soft celestial detail.",
    imageSrc: "/backgrounds/celestial-study.webp",
    imageSrcMobile: "/backgrounds/celestial-study-mobile.webp",
    imageOpacity: .4,
    imagePreviewOpacity: .9,
    imagePosition: "center 42%",
    imagePositionMobile: "center center",
    baseColor: "#181934",
    gradient: "linear-gradient(155deg,#34345F 0%,#181934 58%,#0E1027 100%)",
    shellSurface: "linear-gradient(180deg,rgba(246,247,251,.72),rgba(230,231,242,.63))",
    focusSurface: "rgba(237,240,246,.9)",
    uiAccent: "#7776A4",
    uiAccentSoft: "rgba(119,118,164,.18)",
    darkPalette: {
      tone: "dark",
      baseColor: "#090916",
      gradient: "linear-gradient(155deg,#242442 0%,#0E0F24 58%,#05050E 100%)",
      shellSurface: "linear-gradient(180deg,rgba(246,246,250,.75),rgba(232,231,241,.66))",
      focusSurface: "rgba(239,239,246,.92)",
      uiAccent: "#8583B3",
      uiAccentSoft: "rgba(133,131,179,.21)",
    },
  },
  {
    id: "starlight-planetarium",
    name: "Starlight Planetarium",
    cost: 1750,
    rarity: "Mythical",
    collection: "discovery",
    art: "planetarium",
    tone: "dark",
    motion: "medium",
    description: "A classroom planetarium with a turning star map, constellation lines and projector light.",
    baseColor: "#10142E",
    gradient: "linear-gradient(155deg,#292D58 0%,#121631 56%,#070918 100%)",
    shellSurface: "linear-gradient(180deg,rgba(246,247,252,.73),rgba(229,232,243,.64))",
    focusSurface: "rgba(237,239,247,.91)",
    uiAccent: "#747CB0",
    uiAccentSoft: "rgba(116,124,176,.2)",
    darkPalette: {
      tone: "dark",
      baseColor: "#050611",
      gradient: "linear-gradient(155deg,#1A1D3D 0%,#090B20 58%,#02030A 100%)",
      shellSurface: "linear-gradient(180deg,rgba(244,245,250,.76),rgba(229,230,241,.67))",
      focusSurface: "rgba(239,240,247,.93)",
      uiAccent: "#8289BC",
      uiAccentSoft: "rgba(130,137,188,.22)",
    },
  },
]);

export const BACKGROUND_RARITY_ORDER = Object.freeze({
  Default:0,
  Common:1,
  Rare:2,
  Epic:3,
  Mythical:4,
});

export const BACKGROUND_COLLECTIONS = Object.freeze([
  { id:"all", label:"All", icon:"◫" },
  { id:"study", label:"Study", icon:"📚" },
  { id:"nature", label:"Nature", icon:"🌸" },
  { id:"festival", label:"Festival", icon:"🏮" },
  { id:"celestial", label:"Celestial", icon:"🌙" },
  { id:"discovery", label:"Discovery", icon:"🔭" },
]);

// Removed catalogue IDs map to a visually related replacement so returning
// users keep an equivalent entitlement instead of losing a purchase.
const LEGACY_BACKGROUND_ALIASES = Object.freeze({
  "forest-dawn":"sunset-loft",
  "cloud-classroom":DEFAULT_BACKGROUND_ID,
  "cherry-blossom-sky":"sakura-lake",
  "rainy-window":"rainfall-sanctuary",
  "golden-sunset":"lantern-study-hall",
  "library-study":"ivybound-library",
  "moonlit-grove":"violet-moonlands",
  "aurora-night":"celestial-garden",
});

export function sortBackgroundsByRarity(items = BACKGROUND_CATALOGUE) {
  return [...items].sort((left,right) =>
    (BACKGROUND_RARITY_ORDER[left.rarity] ?? Number.MAX_SAFE_INTEGER)
      - (BACKGROUND_RARITY_ORDER[right.rarity] ?? Number.MAX_SAFE_INTEGER)
    || Number(left.cost || 0) - Number(right.cost || 0)
    || left.name.localeCompare(right.name)
  );
}

const SORTED_BACKGROUND_CATALOGUE = Object.freeze(sortBackgroundsByRarity());

const CATALOGUE_BY_ID = new Map(BACKGROUND_CATALOGUE.map(item => [item.id, item]));

export function getBackground(backgroundId) {
  return CATALOGUE_BY_ID.get(backgroundId) || CATALOGUE_BY_ID.get(DEFAULT_BACKGROUND_ID);
}

export function getBackgroundAppearance(backgroundId, theme = "light") {
  const background = getBackground(backgroundId);
  const mode = theme === "dark" ? "dark" : "light";
  const palette = mode === "dark" ? background.darkPalette : null;
  return {
    ...background,
    ...(palette || {}),
    mode,
  };
}

export function isValidBackgroundId(backgroundId) {
  return CATALOGUE_BY_ID.has(backgroundId);
}

export function normalizeBackgroundId(backgroundId) {
  const migrated = LEGACY_BACKGROUND_ALIASES[backgroundId] || backgroundId;
  return isValidBackgroundId(migrated) ? migrated : DEFAULT_BACKGROUND_ID;
}

export function normalizeOwnedBackgrounds(value) {
  const ids = Array.isArray(value)
    ? value.map(id => LEGACY_BACKGROUND_ALIASES[id] || id).filter(isValidBackgroundId)
    : [];
  return [...new Set([DEFAULT_BACKGROUND_ID, ...ids])];
}

export function canEquipBackground(backgroundId, ownedBackgrounds) {
  const id = normalizeBackgroundId(backgroundId);
  return id === DEFAULT_BACKGROUND_ID || normalizeOwnedBackgrounds(ownedBackgrounds).includes(id);
}

export function evaluateBackgroundPurchase(backgroundId, ownedBackgrounds, coinBalance) {
  const background = CATALOGUE_BY_ID.get(backgroundId);
  const owned = normalizeOwnedBackgrounds(ownedBackgrounds);
  const coins = Number.isFinite(Number(coinBalance)) ? Math.max(0, Number(coinBalance)) : 0;
  if (!background) return { ok:false, reason:"missing", coinBalance:coins, ownedBackgrounds:owned };
  if (owned.includes(backgroundId)) {
    return { ok:false, reason:"owned", coinBalance:coins, ownedBackgrounds:owned, background };
  }
  if (coins < background.cost) {
    return { ok:false, reason:"coins", coinBalance:coins, ownedBackgrounds:owned, background };
  }
  return {
    ok:true,
    coinBalance:coins-background.cost,
    ownedBackgrounds:normalizeOwnedBackgrounds([...owned,backgroundId]),
    background,
  };
}

export function backgroundCacheKey(username) {
  const owner = String(username || "").trim().normalize("NFC").toLowerCase();
  return owner ? `studygrove_background:${owner}` : "studygrove_background:guest";
}

export function ownedBackgroundsCacheKey(username) {
  const owner = String(username || "").trim().normalize("NFC").toLowerCase();
  return owner ? `studygrove_owned_backgrounds:${owner}` : "studygrove_owned_backgrounds:guest";
}

const AMBIENT_POINTS = Object.freeze([
  [12,18,.7],[28,31,.45],[46,14,.58],[68,26,.4],[84,12,.55],[91,45,.38],
  [18,69,.42],[38,82,.56],[61,70,.36],[78,88,.5],[7,48,.34],[54,45,.3],
]);

const RAIN_STREAKS = Object.freeze(Array.from({ length:28 },(_,index) => ({
  left:(index * 37 + 11) % 100,
  height:70 + (index % 6) * 24,
  delay:-(index % 11) * .47,
  duration:1.45 + (index % 5) * .22,
  drift:10 + (index % 4) * 4,
})));

const RAIN_TRAILS = Object.freeze(Array.from({ length:9 },(_,index) => ({
  left:(index * 23 + 7) % 96,
  height:120 + (index % 4) * 34,
  delay:-(index % 7) * 2.8,
  duration:10 + (index % 4) * 2.2,
})));

const OCEAN_BUBBLES = Object.freeze(Array.from({ length:12 },(_,index) => ({
  left:(index * 29 + 9) % 94,
  size:4 + (index % 4) * 3,
  delay:-(index % 8) * 1.7,
  duration:12 + (index % 5) * 2,
})));

function AmbientDots({ className = "", count = 8 }) {
  return <div className={`sg-bg-dots ${className}`} aria-hidden="true">
    {AMBIENT_POINTS.slice(0, count).map(([left,top,scale],index) => (
      <i key={`${left}-${top}`} style={{
        left:`${left}%`, top:`${top}%`, "--sg-bg-dot-scale":scale,
        "--sg-bg-dot-delay":`${-index * 1.9}s`,
      }}/>
    ))}
  </div>;
}

function RainField() {
  return <>
    <div className="sg-bg-rain-bokeh" aria-hidden="true"><i/><i/><i/><i/><i/></div>
    <div className="sg-bg-rain-sheet sg-bg-rain-sheet--far" aria-hidden="true">
      {RAIN_STREAKS.slice(0,18).map((streak,index)=><i key={`far-${index}`} style={{
        left:`${streak.left}%`,height:`${streak.height}px`,
        "--sg-rain-delay":`${streak.delay}s`,"--sg-rain-duration":`${streak.duration+.75}s`,
        "--sg-rain-drift":`${streak.drift}px`,
      }}/>) }
    </div>
    <div className="sg-bg-rain-sheet sg-bg-rain-sheet--near" aria-hidden="true">
      {RAIN_STREAKS.map((streak,index)=><i key={`near-${index}`} style={{
        left:`${streak.left}%`,height:`${streak.height+45}px`,
        "--sg-rain-delay":`${streak.delay-.9}s`,"--sg-rain-duration":`${streak.duration}s`,
        "--sg-rain-drift":`${streak.drift+5}px`,
      }}/>) }
    </div>
    <div className="sg-bg-rain-trails" aria-hidden="true">
      {RAIN_TRAILS.map((trail,index)=><i key={`trail-${index}`} style={{
        left:`${trail.left}%`,height:`${trail.height}px`,
        "--sg-rain-delay":`${trail.delay}s`,"--sg-rain-duration":`${trail.duration}s`,
      }}/>) }
    </div>
    <div className="sg-bg-rain-droplets" aria-hidden="true">
      {AMBIENT_POINTS.map(([left,top,scale],index)=><i key={`drop-${index}`} style={{
        left:`${left}%`,top:`${top}%`,width:`${5+scale*7}px`,height:`${8+scale*13}px`,
        "--sg-bg-dot-delay":`${-index*1.35}s`,
      }}/>) }
    </div>
  </>;
}

function ClassroomEnvironment({ art }) {
  if (art === "ocean") return <div className="sg-theme-room sg-theme-room--ocean" aria-hidden="true">
    <span className="sg-ocean-room-canopy"/>
    <span className="sg-ocean-room-arch sg-ocean-room-arch--left"/>
    <span className="sg-ocean-room-arch sg-ocean-room-arch--right"/>
    <span className="sg-ocean-room-ship"/>
    <span className="sg-ocean-room-kelp sg-ocean-room-kelp--left"/>
    <span className="sg-ocean-room-kelp sg-ocean-room-kelp--right"/>
    <span className="sg-ocean-room-floor"/>
    <span className="sg-ocean-room-desk sg-ocean-room-desk--one"><i/><i/><i/></span>
    <span className="sg-ocean-room-desk sg-ocean-room-desk--two"><i/><i/></span>
    <span className="sg-ocean-room-desk sg-ocean-room-desk--three"><i/><i/><i/></span>
  </div>;

  if (art === "planetarium") return <div className="sg-theme-room sg-theme-room--planetarium" aria-hidden="true">
    <span className="sg-space-room-ceiling"/>
    <span className="sg-space-room-board sg-space-room-board--left"/>
    <span className="sg-space-room-board sg-space-room-board--right"/>
    <span className="sg-space-room-planet sg-space-room-planet--one"/>
    <span className="sg-space-room-planet sg-space-room-planet--two"/>
    <span className="sg-space-room-planet sg-space-room-planet--three"/>
    <span className="sg-space-room-floor"/>
    <span className="sg-space-room-table sg-space-room-table--left"/>
    <span className="sg-space-room-table sg-space-room-table--right"/>
    <span className="sg-space-room-stool sg-space-room-stool--one"/>
    <span className="sg-space-room-stool sg-space-room-stool--two"/>
    <span className="sg-space-room-stool sg-space-room-stool--three"/>
  </div>;

  if (art === "celestial") return <div className="sg-theme-room sg-theme-room--celestial" aria-hidden="true">
    <span className="sg-celestial-room-dome"/>
    <span className="sg-celestial-room-observatory"><i/><i/><i/></span>
    <span className="sg-celestial-room-orbit-ring"/>
    <span className="sg-celestial-room-floor"/>
    <span className="sg-celestial-room-pod sg-celestial-room-pod--one"><i/></span>
    <span className="sg-celestial-room-pod sg-celestial-room-pod--two"><i/></span>
    <span className="sg-celestial-room-pod sg-celestial-room-pod--three"><i/></span>
  </div>;

  if (art === "moonlit") return <div className="sg-theme-room sg-theme-room--moonlit" aria-hidden="true">
    <span className="sg-moonlit-room-ceiling"/>
    <span className="sg-moonlit-room-wall sg-moonlit-room-wall--left"/>
    <span className="sg-moonlit-room-wall sg-moonlit-room-wall--right"/>
    <span className="sg-moonlit-room-sill"/>
    <span className="sg-moonlit-room-bookcase"/>
    <span className="sg-moonlit-room-floor"/>
    <span className="sg-moonlit-room-desk sg-moonlit-room-desk--one"><i/></span>
    <span className="sg-moonlit-room-desk sg-moonlit-room-desk--two"><i/></span>
  </div>;

  if (art === "blossom") return <div className="sg-theme-room sg-theme-room--blossom" aria-hidden="true">
    <span className="sg-blossom-room-ceiling"/>
    <span className="sg-blossom-room-window"><i/><i/><i/><i/><i/></span>
    <span className="sg-blossom-room-heater sg-blossom-room-heater--left"/>
    <span className="sg-blossom-room-heater sg-blossom-room-heater--right"/>
    <span className="sg-blossom-room-floor"/>
    <span className="sg-blossom-room-light"/>
    <span className="sg-blossom-room-desk sg-blossom-room-desk--left"/>
    <span className="sg-blossom-room-desk sg-blossom-room-desk--right"/>
  </div>;

  if (art === "rain") return <div className="sg-theme-room sg-theme-room--rain" aria-hidden="true">
    <span className="sg-rain-room-ceiling"/>
    <span className="sg-rain-room-wall sg-rain-room-wall--left"/>
    <span className="sg-rain-room-wall sg-rain-room-wall--right"/>
    <span className="sg-rain-room-window"><i/><i/><i/><i/></span>
    <span className="sg-rain-room-sill"/>
    <span className="sg-rain-room-floor"/>
    <span className="sg-rain-room-desk sg-rain-room-desk--left"/>
    <span className="sg-rain-room-desk sg-rain-room-desk--middle"/>
    <span className="sg-rain-room-desk sg-rain-room-desk--right"/>
  </div>;

  return <div className={`sg-theme-room sg-theme-room--everyday sg-theme-room--${art}`} aria-hidden="true">
    <span className="sg-everyday-room-ceiling"/>
    <span className="sg-everyday-room-window"><i/><i/><i/></span>
    <span className="sg-everyday-room-board"/>
    <span className="sg-everyday-room-feature"/>
    <span className="sg-everyday-room-floor"/>
    <span className="sg-everyday-room-table sg-everyday-room-table--one"/>
    <span className="sg-everyday-room-table sg-everyday-room-table--two"/>
  </div>;
}

function OceanField() {
  return <>
    <div className="sg-bg-ocean-window"/>
    <div className="sg-bg-ocean-rays"/>
    <div className="sg-bg-ocean-fish sg-bg-ocean-fish--one"/><div className="sg-bg-ocean-fish sg-bg-ocean-fish--two"/>
    <div className="sg-bg-ocean-bubbles">
      {OCEAN_BUBBLES.map((bubble,index)=><i key={index} style={{
        left:`${bubble.left}%`,width:`${bubble.size}px`,height:`${bubble.size}px`,
        "--sg-bubble-delay":`${bubble.delay}s`,"--sg-bubble-duration":`${bubble.duration}s`,
      }}/>) }
    </div>
  </>;
}

function BackgroundDecor({ art }) {
  switch (art) {
    case "midnight":
      return <>
        <div className="sg-bg-midnight-glow"/>
        <div className="sg-bg-midnight-horizon"/>
      </>;
    case "forest":
      return <>
        <span className="sg-bg-sun"/>
        <div className="sg-bg-forest sg-bg-forest--far"/><div className="sg-bg-forest sg-bg-forest--near"/>
        <AmbientDots className="sg-bg-pollen" count={7}/>
      </>;
    case "moonlit":
      return <>
        <div className="sg-bg-night-window"/><span className="sg-bg-moon"/><AmbientDots className="sg-bg-stars" count={10}/>
        <div className="sg-bg-moon-cloud sg-bg-moon-cloud--one"/><div className="sg-bg-moon-cloud sg-bg-moon-cloud--two"/>
        <div className="sg-bg-moonbeam"/><div className="sg-bg-curtain sg-bg-curtain--left"/><div className="sg-bg-curtain sg-bg-curtain--right"/>
      </>;
    case "blossom":
      return <>
        <div className="sg-bg-branch sg-bg-branch--left"/><div className="sg-bg-branch sg-bg-branch--right"/>
        <AmbientDots className="sg-bg-petals" count={10}/>
      </>;
    case "rain":
      return <>
        <div className="sg-bg-window-grid"/><RainField/><div className="sg-bg-rain-glow"/>
      </>;
    case "sunset":
      return <>
        <span className="sg-bg-sunset-sun"/><div className="sg-bg-hill sg-bg-hill--far"/>
        <div className="sg-bg-hill sg-bg-hill--near"/><AmbientDots className="sg-bg-sunset-motes" count={5}/>
      </>;
    case "library":
      return <>
        <div className="sg-bg-library-room"/>
        <div className="sg-bg-shelf sg-bg-shelf--left"/><div className="sg-bg-shelf sg-bg-shelf--right"/>
        <div className="sg-bg-library-window"/>
        <div className="sg-bg-library-desk"/>
        <div className="sg-bg-library-lamp"/>
        <div className="sg-bg-library-light"/>
      </>;
    case "lanterns":
      return <>
        <div className="sg-bg-lantern-window"/><div className="sg-bg-lantern-shelf"/>
        <div className="sg-bg-paper-lantern sg-bg-paper-lantern--one"/>
        <div className="sg-bg-paper-lantern sg-bg-paper-lantern--two"/>
        <div className="sg-bg-paper-lantern sg-bg-paper-lantern--three"/>
        <AmbientDots className="sg-bg-lantern-motes" count={7}/>
      </>;
    case "clouds":
      return <>
        <div className="sg-bg-cloud sg-bg-cloud--one"/><div className="sg-bg-cloud sg-bg-cloud--two"/>
        <div className="sg-bg-cloud sg-bg-cloud--three"/><span className="sg-bg-cloud-sun"/>
      </>;
    case "aurora":
      return <>
        <div className="sg-bg-aurora sg-bg-aurora--one"/><div className="sg-bg-aurora sg-bg-aurora--two"/>
        <div className="sg-bg-aurora sg-bg-aurora--three"/><AmbientDots className="sg-bg-stars" count={12}/>
        <div className="sg-bg-hill sg-bg-hill--night"/>
      </>;
    case "ocean":
      return <OceanField/>;
    case "celestial":
      return <>
        <span className="sg-bg-celestial-moon"/><span className="sg-bg-orbit sg-bg-orbit--one"/>
        <span className="sg-bg-orbit sg-bg-orbit--two"/><AmbientDots className="sg-bg-celestial-stars" count={12}/>
        <div className="sg-bg-celestial-garden"/>
      </>;
    case "planetarium":
      return <>
        <div className="sg-bg-planetarium-dome"/><div className="sg-bg-planetarium-map"/>
        <div className="sg-bg-planetarium-constellation sg-bg-planetarium-constellation--one"/>
        <div className="sg-bg-planetarium-constellation sg-bg-planetarium-constellation--two"/>
        <div className="sg-bg-planetarium-projector"/><div className="sg-bg-planetarium-beam"/>
        <AmbientDots className="sg-bg-celestial-stars" count={12}/>
      </>;
    default:
      return <>
        <div className="sg-bg-classic-leaves sg-bg-classic-leaves--left"/>
        <div className="sg-bg-classic-leaves sg-bg-classic-leaves--right"/>
      </>;
  }
}

export function BackgroundArtwork({
  backgroundId = DEFAULT_BACKGROUND_ID,
  theme = "light",
  compact = false,
  focusMode = false,
  paused = false,
  lowPower = false,
  className = "",
}) {
  const background = useMemo(
    () => getBackgroundAppearance(backgroundId, theme),
    [backgroundId, theme],
  );
  const style = useMemo(() => ({
    "--sg-bg-gradient": background.gradient,
    "--sg-bg-base": background.baseColor,
    "--sg-bg-photo-opacity": background.imageOpacity ?? .44,
    "--sg-bg-photo-preview-opacity": background.imagePreviewOpacity ?? .9,
    "--sg-bg-photo-position": background.imagePosition || "center center",
    "--sg-bg-photo-position-mobile": background.imagePositionMobile || background.imagePosition || "center center",
  }), [background]);
  return (
    <div
      className={[
        "sg-background-art sg-keepcolor",
        compact ? "sg-background-art--compact" : "sg-background-art--full",
        focusMode ? "sg-background-art--focus" : "",
        paused ? "sg-background-art--paused" : "",
        lowPower ? "sg-background-art--low-power" : "",
        className,
      ].filter(Boolean).join(" ")}
      data-background-art={background.art}
      data-background-mode={background.mode}
      data-background-tone={background.tone}
      style={style}
      aria-hidden="true"
    >
      {background.imageSrc && <picture className="sg-bg-photo">
        {background.imageSrcMobile && <source media="(max-width: 600px)" srcSet={background.imageSrcMobile}/>}
        <img
          src={background.imageSrc}
          alt=""
          decoding="async"
          draggable="false"
        />
      </picture>}
      <div className="sg-bg-wash"/>
      {!background.imageSrc && <BackgroundDecor art={background.art}/>}
      {!background.imageSrc && <ClassroomEnvironment art={background.art}/>}
      <div className="sg-bg-vignette"/>
    </div>
  );
}

export function BackgroundLayer({ backgroundId, theme = "light", focusMode = false, animationMode = "device" }) {
  const [hidden, setHidden] = useState(() => typeof document !== "undefined" && document.hidden);
  const lowPower = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const cores = Number(navigator.hardwareConcurrency) || 8;
    const memory = Number(navigator.deviceMemory) || 8;
    return cores <= 4 || memory <= 4;
  }, []);
  useEffect(() => {
    const sync = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  const artwork=<BackgroundArtwork
    backgroundId={backgroundId}
    theme={theme}
    focusMode={focusMode}
    paused={hidden||animationMode==="off"}
    lowPower={animationMode==="device"&&lowPower}
    className="sg-keepcolor"
  />;
  return typeof document!=="undefined"?createPortal(artwork,document.body):artwork;
}

export function ShopCategoryTabs({ active, onTrees, onDecorations, onBackgrounds }) {
  const items = [
    ["trees", "🧑‍🎓", "Skins", onTrees],
    ["decorations", "🏫", "Classroom Decor", onDecorations],
    ["backgrounds", "◫", "Backgrounds", onBackgrounds],
  ];
  return <div className="sg-shop-category-tabs" role="tablist" aria-label="Shop categories">
    {items.map(([id, icon, label, onClick]) => (
      <button
        key={id}
        type="button"
        role="tab"
        aria-selected={active === id}
        className={active === id ? "sg-shop-category-tab sg-shop-category-tab--active" : "sg-shop-category-tab"}
        onClick={onClick}
      >
        <span aria-hidden="true">{icon}</span><span>{label}</span>
      </button>
    ))}
  </div>;
}

function rarityClass(rarity) {
  return `sg-background-rarity sg-background-rarity--${String(rarity).toLowerCase()}`;
}

function BackgroundPreview({
  background,
  theme,
  owned,
  active,
  buying,
  onBuy,
  onEquip,
  onCancel,
}) {
  return <div className="sg-background-preview" role="dialog" aria-modal="true" aria-labelledby="sg-background-preview-title" onClick={event=>event.stopPropagation()}>
    <BackgroundArtwork backgroundId={background.id} theme={theme} paused/>
    <div className="sg-background-preview-shade"/>
    <div className="sg-background-preview-badge">PREVIEW</div>
    <div className="sg-background-preview-panel">
      <div className="sg-background-preview-copy">
        <span className={rarityClass(background.rarity)}>{background.rarity}</span>
        <h3 id="sg-background-preview-title">{background.name}</h3>
        <p>{background.description}</p>
      </div>
      <div className="sg-background-preview-actions">
        <button type="button" className="sg-background-secondary-btn" onClick={onCancel}>Cancel</button>
        {active
          ? <span className="sg-background-equipped">✓ Equipped</span>
          : owned
            ? <button type="button" className="sg-background-primary-btn" onClick={onEquip}>Equip</button>
            : <button type="button" className="sg-background-primary-btn" disabled={buying} onClick={onBuy}>
                {buying ? "Buying…" : `Buy · 🪙 ${background.cost}`}
              </button>}
      </div>
    </div>
  </div>;
}

export function BackgroundShop({
  coins,
  theme = "light",
  ownedBackgrounds,
  activeBackground,
  onBuy,
  onEquip,
  onPreview,
  onClose,
  onBack,
  onOpenTrees,
  onOpenDecorations,
}) {
  const ownedIds = normalizeOwnedBackgrounds(ownedBackgrounds);
  const [activeCollection, setActiveCollection] = useState("all");
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [previewId, setPreviewId] = useState(null);
  const [toast, setToast] = useState("");
  const [busyId, setBusyId] = useState("");
  const items = SORTED_BACKGROUND_CATALOGUE.filter(item =>
    (activeCollection === "all" || item.collection === activeCollection)
      && (!ownedOnly || ownedIds.includes(item.id))
  );

  const showToast = message => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };

  const closePreview = () => {
    setPreviewId(null);
    onPreview?.(null);
  };

  const openPreview = id => {
    setPreviewId(id);
    onPreview?.(id);
  };

  useEffect(() => () => onPreview?.(null), [onPreview]);

  const buy = async id => {
    if (busyId) return;
    setBusyId(id);
    const result = await onBuy(id);
    setBusyId("");
    if (result?.ok) showToast(`${result.background?.name || "Background"} added to your collection`);
    else if (result?.reason === "coins") showToast("Not enough coins");
    else if (result?.reason === "owned") showToast("You already own this background");
    else showToast("Purchase couldn’t be completed");
    return result;
  };

  const equip = async id => {
    if (busyId) return;
    setBusyId(id);
    const result = await onEquip(id);
    setBusyId("");
    if (result?.ok) {
      showToast(`${result.background?.name || "Background"} equipped`);
      closePreview();
    } else if (result?.reason === "locked") showToast("Buy this background first");
    else showToast("Couldn’t sync that background");
    return result;
  };

  const preview = previewId ? getBackground(previewId) : null;
  const previewOwned = preview ? ownedIds.includes(preview.id) : false;
  const previewActive = preview ? activeBackground === preview.id : false;

  return <div className="sg-background-shop-overlay sg-overlay-anim" onClick={onClose}>
    <div className="sg-background-shop sg-sheet-anim sg-shop-sheet" onClick={event => event.stopPropagation()}>
      <header className="sg-background-shop-header">
        <div className="sg-background-shop-heading">
          {onBack && <button type="button" className="sg-background-round-btn" onClick={onBack} aria-label="Back">←</button>}
          <div>
            <h3>◫ Backgrounds</h3>
            <p>{ownedIds.length} of {BACKGROUND_CATALOGUE.length} owned</p>
          </div>
        </div>
        <span className="sg-background-coin-balance">🪙 {coins}</span>
      </header>

      <ShopCategoryTabs
        active="backgrounds"
        onTrees={onOpenTrees}
        onDecorations={onOpenDecorations}
        onBackgrounds={() => {}}
      />

      <div className="sg-background-collection-wrap">
        <div className="sg-background-collection-row" role="tablist" aria-label="Background collections">
          {BACKGROUND_COLLECTIONS.map(collection => {
            const active = collection.id === activeCollection;
            const count = collection.id === "all"
              ? BACKGROUND_CATALOGUE.length
              : BACKGROUND_CATALOGUE.filter(item => item.collection === collection.id).length;
            return <button
              key={collection.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={active ? "is-active" : ""}
              onClick={() => setActiveCollection(collection.id)}
            >
              <span aria-hidden="true">{collection.icon}</span>
              {collection.label}
              <span className="sg-background-collection-count">{count}</span>
            </button>;
          })}
        </div>
      </div>

      <div className="sg-background-filter-row" role="group" aria-label="Background filter">
        <button type="button" className={!ownedOnly ? "is-active" : ""} onClick={() => setOwnedOnly(false)}>All items</button>
        <button type="button" className={ownedOnly ? "is-active" : ""} onClick={() => setOwnedOnly(true)}>Owned</button>
        {activeBackground !== DEFAULT_BACKGROUND_ID &&
          <button type="button" className="sg-background-use-default" onClick={() => equip(DEFAULT_BACKGROUND_ID)}>Use Default</button>}
      </div>

      {toast && <div className="sg-background-toast" role="status">{toast}</div>}

      {items.length === 0 ? <div className="sg-background-empty">
        <strong>No backgrounds here yet</strong>
        <span>Try another collection or show all items.</span>
      </div> : <div className="sg-background-grid">
        {items.map((background, index) => {
          const owned = ownedIds.includes(background.id);
          const active = activeBackground === background.id;
          const canAfford = coins >= background.cost;
          return <article
            key={background.id}
            className={`sg-background-card sg-card-anim${active ? " sg-background-card--active" : ""}`}
            style={{ animationDelay:`${Math.min(index * .035, .25)}s` }}
          >
            <button type="button" className="sg-background-thumb" onClick={() => openPreview(background.id)} aria-label={`Preview ${background.name}`}>
              <BackgroundArtwork backgroundId={background.id} theme={theme} compact paused/>
              <span>Preview</span>
            </button>
            <div className="sg-background-card-copy">
              <span className={rarityClass(background.rarity)}>{background.rarity}</span>
              <h4>{background.name}</h4>
              <p>{background.description}</p>
            </div>
            <div className="sg-background-card-meta">
              {background.cost === 0 ? <span className="sg-background-free">Free</span>
                : !owned ? <span className="sg-background-cost">🪙 {background.cost}</span> : <span/>}
              {active ? <span className="sg-background-equipped">✓ Equipped</span>
                : owned
                  ? <button type="button" className="sg-background-card-action" disabled={busyId === background.id} onClick={() => equip(background.id)}>Equip</button>
                  : <button
                      type="button"
                      className="sg-background-card-action"
                      disabled={!canAfford || !!busyId}
                      onClick={() => buy(background.id)}
                    >{canAfford ? (busyId === background.id ? "Buying…" : "Buy") : "Need more 🪙"}</button>}
            </div>
          </article>;
        })}
      </div>}
      <button type="button" className="sg-background-done" onClick={onClose}>Done</button>
    </div>

    {preview && <BackgroundPreview
      background={preview}
      theme={theme}
      owned={previewOwned}
      active={previewActive}
      buying={busyId === preview.id}
      onCancel={closePreview}
      onBuy={() => buy(preview.id)}
      onEquip={() => equip(preview.id)}
    />}
  </div>;
}

export const BACKGROUND_CSS = `
.sg-background-art {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: var(--sg-bg-gradient, #F5F7F2);
  transform: translateZ(0);
  contain: paint;
  transition: background-color .28s ease, filter .28s ease;
}
.sg-background-art--full {
  position: fixed;
  z-index: 0;
  width: 100vw;
  min-height: 100vh;
  min-height: 100dvh;
}
.sg-background-art--compact { border-radius: inherit; }
.sg-bg-photo {
  position:absolute;
  inset:0;
  display:block;
  opacity:var(--sg-bg-photo-opacity,.44);
  overflow:hidden;
  transform:translateZ(0);
}
.sg-bg-photo img {
  width:100%;
  height:100%;
  display:block;
  object-fit:cover;
  object-position:var(--sg-bg-photo-position,center center);
  filter:saturate(.84) contrast(.92);
  transform:translateZ(0) scale(1.002);
}
.sg-background-art--compact .sg-bg-photo {
  opacity:var(--sg-bg-photo-preview-opacity,.9);
}
.sg-background-art--compact .sg-bg-photo img {
  filter:saturate(.94) contrast(.96);
}
.sg-background-art--focus .sg-bg-photo {
  opacity:calc(var(--sg-bg-photo-opacity,.44) * .76);
}
.sg-bg-wash,.sg-bg-vignette,.sg-bg-rain-glow,.sg-bg-library-light,.sg-bg-library-room {
  position:absolute;inset:0;pointer-events:none;
}
.sg-bg-wash {
  background:
    radial-gradient(circle at 22% 12%,rgba(255,255,255,.42),transparent 30%),
    radial-gradient(circle at 82% 86%,rgba(255,255,255,.15),transparent 36%);
}
.sg-bg-vignette { box-shadow: inset 0 0 120px rgba(30,45,35,.11); }
.sg-background-art--compact .sg-bg-vignette { box-shadow:inset 0 0 28px rgba(30,45,35,.13); }
[data-background-mode="dark"] .sg-bg-wash {
  background:
    radial-gradient(circle at 22% 12%,rgba(216,232,222,.1),transparent 31%),
    radial-gradient(circle at 82% 86%,rgba(128,165,143,.055),transparent 38%);
}
[data-background-mode="dark"] .sg-bg-vignette {
  box-shadow:inset 0 0 140px rgba(0,0,0,.34);
}
.sg-background-art--compact[data-background-mode="dark"] .sg-bg-vignette {
  box-shadow:inset 0 0 30px rgba(0,0,0,.28);
}
.sg-bg-dots i {
  position:absolute;width:9px;height:9px;border-radius:50%;
  transform:scale(var(--sg-bg-dot-scale,.5));opacity:.48;
}
/* Each catalogue entry is a complete learning environment. These rooms sit
   in front of their own sky/weather artwork, so rain, water and space remain
   outside the architecture instead of tinting one reusable classroom. */
.sg-theme-room{position:absolute;inset:0;overflow:hidden;pointer-events:none}

/* Underwater classroom — arched observation glass, reef desks and sea-floor
   masonry are deliberately unlike every terrestrial room. */
.sg-ocean-room-canopy{position:absolute;left:-4%;right:-4%;top:-2%;height:11%;background:linear-gradient(180deg,rgba(3,29,45,.84),rgba(12,58,72,.54));border-bottom:clamp(4px,.7vw,10px) solid rgba(90,169,174,.38);clip-path:polygon(0 0,100% 0,96% 100%,4% 100%)}
.sg-ocean-room-arch{position:absolute;top:8%;height:49%;border:clamp(7px,.9vw,14px) solid rgba(12,55,66,.72);border-bottom-width:clamp(10px,1.2vw,18px);border-radius:46% 46% 6px 6px/28% 28% 6px 6px;box-shadow:inset 0 0 45px rgba(122,226,225,.08),0 12px 30px rgba(1,22,34,.22)}
.sg-ocean-room-arch::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent 49.3%,rgba(105,190,195,.28) 49.5% 50.5%,transparent 50.7%),linear-gradient(transparent 62%,rgba(105,190,195,.25) 62.5% 64%,transparent 64.5%)}
.sg-ocean-room-arch--left{left:5%;width:42%}.sg-ocean-room-arch--right{right:5%;width:35%}
.sg-ocean-room-ship{position:absolute;right:9%;top:34%;width:26%;height:10%;border-radius:60% 15% 48% 42%;background:rgba(6,35,45,.43);transform:rotate(-5deg);box-shadow:inset 0 -6px 0 rgba(68,112,117,.18)}
.sg-ocean-room-ship::before{content:"";position:absolute;right:7%;bottom:75%;width:42%;height:86%;border-left:3px solid rgba(12,43,51,.42);border-bottom:3px solid rgba(12,43,51,.42);transform:skewX(-18deg)}
.sg-ocean-room-kelp{position:absolute;bottom:19%;width:9%;height:48%;opacity:.62;background:repeating-radial-gradient(ellipse at 50% 88%,#3D9278 0 11%,transparent 12% 20%);transform-origin:50% 100%;animation:sgBgKelp 8s ease-in-out infinite}.sg-ocean-room-kelp--left{left:-1%;transform:rotate(-7deg)}.sg-ocean-room-kelp--right{right:1%;height:40%;animation-delay:-4s;filter:brightness(.82)}
.sg-ocean-room-floor{position:absolute;left:-5%;right:-5%;bottom:-3%;height:38%;border-top:clamp(4px,.5vw,8px) solid rgba(67,151,151,.3);background:repeating-linear-gradient(90deg,transparent 0 10%,rgba(5,36,45,.19) 10% 10.5%),repeating-linear-gradient(165deg,transparent 0 12%,rgba(2,27,38,.2) 12% 12.5%),linear-gradient(180deg,rgba(22,100,111,.48),rgba(3,40,54,.78));clip-path:polygon(5% 0,95% 0,100% 100%,0 100%)}
.sg-ocean-room-desk{position:absolute;bottom:7%;width:25%;height:15%;border-top:clamp(8px,1vw,15px) solid rgba(44,95,90,.85);border-radius:46% 46% 8px 8px;background:linear-gradient(180deg,rgba(22,67,68,.58),rgba(5,38,47,.72));clip-path:polygon(4% 0,96% 0,100% 76%,82% 76%,79% 100%,72% 100%,70% 76%,28% 76%,25% 100%,18% 100%,17% 76%,0 76%);filter:drop-shadow(0 9px 8px rgba(0,15,24,.3))}.sg-ocean-room-desk--one{left:5%;transform:scale(.78);transform-origin:bottom left}.sg-ocean-room-desk--two{left:38%;bottom:2%}.sg-ocean-room-desk--three{right:4%;transform:scale(.82);transform-origin:bottom right}
.sg-ocean-room-desk i{position:absolute;top:-48%;width:16%;height:51%;border-radius:50% 50% 12% 12%;background:linear-gradient(90deg,#D27E88,#E6A282);box-shadow:0 0 0 2px rgba(68,33,45,.18);transform-origin:bottom}.sg-ocean-room-desk i:nth-child(1){left:18%;transform:rotate(-14deg)}.sg-ocean-room-desk i:nth-child(2){left:43%;height:68%;background:linear-gradient(90deg,#7CB69B,#A1D0A8)}.sg-ocean-room-desk i:nth-child(3){right:15%;transform:rotate(16deg);background:linear-gradient(90deg,#C58DB1,#E2A6C2)}

/* Space rooms use laboratory tables, luminous learning boards and suspended
   planets rather than the ordinary desks/blackboard silhouette. */
.sg-space-room-ceiling{position:absolute;left:-3%;right:-3%;top:0;height:9%;background:linear-gradient(180deg,rgba(2,3,14,.9),rgba(22,27,65,.55));border-bottom:3px solid rgba(124,141,217,.26)}
.sg-space-room-board{position:absolute;top:15%;width:29%;height:22%;border:clamp(4px,.55vw,8px) solid rgba(91,111,192,.48);border-radius:9px;background:radial-gradient(circle at 28% 38%,#F4D36B 0 2px,transparent 3px),radial-gradient(circle at 62% 67%,#AFD7FF 0 2px,transparent 3px),linear-gradient(155deg,rgba(24,35,88,.72),rgba(7,12,38,.86));box-shadow:0 0 28px rgba(83,109,215,.12),inset 0 0 18px rgba(107,135,223,.09)}.sg-space-room-board::after{content:"";position:absolute;inset:14%;border:1px solid rgba(143,166,240,.24);border-radius:50%;transform:rotate(-14deg)}.sg-space-room-board--left{left:5%}.sg-space-room-board--right{right:5%;transform:scale(.82)}
.sg-space-room-planet{position:absolute;top:4%;border-radius:50%;box-shadow:0 0 18px rgba(145,172,255,.28);transform-origin:50% -80%;animation:sgBgPlanetSway 11s ease-in-out infinite}.sg-space-room-planet::before{content:"";position:absolute;left:50%;bottom:100%;height:90%;width:1px;background:rgba(160,178,229,.35)}.sg-space-room-planet--one{left:29%;width:clamp(28px,4.5vw,67px);aspect-ratio:1;background:linear-gradient(145deg,#E9B45D,#A85D6C)}.sg-space-room-planet--two{left:52%;top:7%;width:clamp(34px,5.5vw,82px);aspect-ratio:1;background:linear-gradient(145deg,#65BBD1,#5068B8);animation-delay:-4s}.sg-space-room-planet--two::after{content:"";position:absolute;left:-22%;right:-22%;top:44%;height:12%;border:2px solid rgba(237,222,165,.54);border-radius:50%;transform:rotate(-14deg)}.sg-space-room-planet--three{right:22%;width:clamp(20px,3.3vw,48px);aspect-ratio:1;background:linear-gradient(145deg,#B38DDB,#5F62AA);animation-delay:-7s}
.sg-space-room-floor{position:absolute;left:-4%;right:-4%;bottom:-4%;height:37%;background:repeating-linear-gradient(90deg,transparent 0 12%,rgba(105,119,192,.12) 12% 12.4%),linear-gradient(180deg,rgba(35,43,99,.5),rgba(6,10,35,.84));border-top:2px solid rgba(125,145,220,.2);clip-path:polygon(4% 0,96% 0,100% 100%,0 100%)}
.sg-space-room-table{position:absolute;bottom:6%;width:35%;height:15%;border-top:clamp(8px,1vw,15px) solid rgba(74,91,160,.78);background:linear-gradient(180deg,rgba(56,70,131,.52),rgba(16,24,70,.72));clip-path:polygon(3% 0,97% 0,100% 72%,86% 72%,84% 100%,77% 100%,75% 72%,25% 72%,23% 100%,16% 100%,14% 72%,0 72%)}.sg-space-room-table--left{left:3%;transform:scale(.82);transform-origin:bottom left}.sg-space-room-table--right{right:3%;bottom:1%}
.sg-space-room-stool{position:absolute;bottom:2%;width:5%;height:10%;border-radius:45% 45% 5px 5px;background:linear-gradient(180deg,#5366A8,#1C275D);box-shadow:0 7px 10px rgba(0,0,0,.22)}.sg-space-room-stool--one{left:18%}.sg-space-room-stool--two{left:59%}.sg-space-room-stool--three{right:12%}

/* Celestial classroom — a curved observatory gallery with learning pods,
   keeping its orbiting sky separate from the planetarium lab. */
.sg-celestial-room-dome{position:absolute;left:-8%;right:-8%;top:-28%;height:73%;border-radius:0 0 50% 50%;border-bottom:clamp(7px,.9vw,13px) solid rgba(151,139,205,.36);background:radial-gradient(ellipse at 50% 94%,rgba(119,102,176,.08),rgba(8,9,31,.5) 72%);box-shadow:inset 0 -18px 45px rgba(142,124,208,.1)}
.sg-celestial-room-observatory{position:absolute;left:14%;right:14%;top:11%;height:39%;border:clamp(5px,.65vw,10px) solid rgba(156,150,210,.32);border-bottom-width:clamp(9px,1vw,15px);border-radius:50% 50% 9px 9px/27% 27% 9px 9px;box-shadow:inset 0 0 44px rgba(177,165,231,.08),0 15px 35px rgba(3,4,20,.2)}.sg-celestial-room-observatory i{position:absolute;background:rgba(163,156,215,.22)}.sg-celestial-room-observatory i:nth-child(1){left:32.5%;top:0;bottom:0;width:3px}.sg-celestial-room-observatory i:nth-child(2){left:65.5%;top:0;bottom:0;width:3px}.sg-celestial-room-observatory i:nth-child(3){left:0;right:0;top:58%;height:3px}
.sg-celestial-room-orbit-ring{position:absolute;left:39%;top:21%;width:22%;aspect-ratio:1;border:1px solid rgba(224,213,157,.3);border-radius:50%;transform:rotate(-18deg);animation:sgBgOrbit 44s linear infinite}.sg-celestial-room-orbit-ring::after{content:"";position:absolute;left:9%;top:10%;width:clamp(4px,.65vw,10px);aspect-ratio:1;border-radius:50%;background:#E8D793;box-shadow:0 0 11px rgba(232,215,147,.54)}
.sg-celestial-room-floor{position:absolute;left:-5%;right:-5%;bottom:-5%;height:45%;border-top:3px solid rgba(151,137,204,.2);background:repeating-radial-gradient(ellipse at 50% 110%,transparent 0 13%,rgba(139,120,194,.11) 13.2% 13.8%,transparent 14% 24%),linear-gradient(180deg,rgba(57,48,108,.58),rgba(10,10,39,.9));clip-path:polygon(5% 0,95% 0,100% 100%,0 100%)}
.sg-celestial-room-pod{position:absolute;bottom:4%;width:23%;height:17%;border-top:clamp(7px,.9vw,13px) solid rgba(107,91,165,.82);border-radius:50% 50% 10px 10px/22% 22% 10px 10px;background:linear-gradient(180deg,rgba(73,61,135,.68),rgba(20,18,66,.84));filter:drop-shadow(0 9px 10px rgba(2,2,18,.28))}.sg-celestial-room-pod i{position:absolute;left:33%;right:33%;top:-43%;height:38%;border:2px solid rgba(158,190,227,.36);border-radius:6px;background:linear-gradient(155deg,rgba(103,151,198,.48),rgba(31,45,105,.76));box-shadow:0 0 13px rgba(115,154,211,.14)}.sg-celestial-room-pod--one{left:7%;transform:scale(.78);transform-origin:bottom left}.sg-celestial-room-pod--two{left:38%;bottom:1%}.sg-celestial-room-pod--three{right:6%;transform:scale(.8);transform-origin:bottom right}

/* Moonlit classroom — a quiet reading room framed around the existing night
   window, with book storage and warm desk lamps instead of space displays. */
.sg-moonlit-room-ceiling{position:absolute;left:-3%;right:-3%;top:0;height:8%;background:linear-gradient(180deg,rgba(10,17,35,.94),rgba(34,48,76,.62));border-bottom:3px solid rgba(141,166,194,.2)}
.sg-moonlit-room-wall{position:absolute;top:7%;bottom:34%;width:6%;background:linear-gradient(90deg,rgba(24,37,62,.92),rgba(73,91,118,.62));box-shadow:0 0 19px rgba(3,7,16,.25)}.sg-moonlit-room-wall--left{left:0}.sg-moonlit-room-wall--right{right:0;transform:scaleX(-1)}
.sg-moonlit-room-sill{position:absolute;left:4%;right:4%;top:64%;height:2%;border-radius:3px;background:rgba(98,119,145,.58);box-shadow:0 7px 15px rgba(1,5,13,.28)}
.sg-moonlit-room-bookcase{position:absolute;right:5%;top:18%;width:17%;height:43%;border:clamp(4px,.55vw,8px) solid rgba(71,75,99,.62);border-radius:5px;background:repeating-linear-gradient(0deg,transparent 0 27%,rgba(62,65,91,.78) 27% 30%),repeating-linear-gradient(90deg,#73819A 0 9%,#9A7790 9% 17%,#5A7790 17% 25%);opacity:.58;box-shadow:0 12px 25px rgba(2,5,13,.2)}
.sg-moonlit-room-floor{position:absolute;left:-4%;right:-4%;bottom:-4%;height:38%;border-top:2px solid rgba(138,160,184,.14);background:repeating-linear-gradient(90deg,transparent 0 13%,rgba(112,131,161,.09) 13% 13.4%),linear-gradient(180deg,rgba(40,53,83,.64),rgba(11,17,39,.9));clip-path:polygon(4% 0,96% 0,100% 100%,0 100%)}
.sg-moonlit-room-desk{position:absolute;bottom:5%;width:31%;height:15%;border-top:clamp(8px,.9vw,13px) solid rgba(80,88,112,.86);background:linear-gradient(180deg,rgba(55,65,94,.62),rgba(22,29,58,.82));clip-path:polygon(4% 0,96% 0,100% 72%,84% 72%,82% 100%,75% 100%,73% 72%,27% 72%,25% 100%,18% 100%,16% 72%,0 72%)}.sg-moonlit-room-desk::before{content:"";position:absolute;left:12%;top:-48%;width:3px;height:48%;background:rgba(199,177,127,.62)}.sg-moonlit-room-desk::after{content:"";position:absolute;left:5%;top:-66%;width:18%;height:28%;border-radius:50% 50% 10% 10%;background:#D8C18D;box-shadow:0 0 22px rgba(230,204,147,.38);clip-path:polygon(24% 0,76% 0,100% 100%,0 100%)}.sg-moonlit-room-desk i{position:absolute;right:15%;top:-25%;width:28%;height:18%;border-radius:2px;background:linear-gradient(90deg,#7888A1,#A0A9B6);transform:rotate(3deg)}.sg-moonlit-room-desk--one{left:7%;transform:scale(.84);transform-origin:bottom left}.sg-moonlit-room-desk--two{right:7%;bottom:1%}

/* Cherry-blossom classroom — the window wall and sun-cast branch shadow are
   the composition, matching the calm, almost empty reference room. */
.sg-blossom-room-ceiling{position:absolute;left:-2%;right:-2%;top:0;height:9%;background:linear-gradient(180deg,rgba(255,248,235,.8),rgba(238,205,191,.52));border-bottom:2px solid rgba(148,102,91,.16)}
.sg-blossom-room-window{position:absolute;left:5%;right:5%;top:7%;height:53%;border:clamp(6px,.8vw,12px) solid rgba(120,81,72,.42);background:rgba(255,242,236,.08);box-shadow:inset 0 0 34px rgba(255,223,211,.2),0 9px 23px rgba(83,53,48,.08)}.sg-blossom-room-window i{position:absolute;top:0;bottom:0;width:clamp(4px,.42vw,7px);background:rgba(128,83,74,.34)}.sg-blossom-room-window i:nth-child(1){left:18%}.sg-blossom-room-window i:nth-child(2){left:38%}.sg-blossom-room-window i:nth-child(3){left:58%}.sg-blossom-room-window i:nth-child(4){left:78%}.sg-blossom-room-window i:nth-child(5){left:0;right:0;top:48%;bottom:auto;width:100%;height:clamp(4px,.42vw,7px)}
.sg-blossom-room-heater{position:absolute;top:48%;width:10%;height:13%;border:3px solid rgba(126,97,91,.23);border-radius:4px;background:repeating-linear-gradient(90deg,rgba(255,255,255,.42) 0 9%,rgba(147,111,104,.18) 9% 13%)}.sg-blossom-room-heater--left{left:7%}.sg-blossom-room-heater--right{right:7%}
.sg-blossom-room-floor{position:absolute;left:-4%;right:-4%;bottom:-3%;height:42%;background:repeating-linear-gradient(92deg,transparent 0 12%,rgba(139,85,73,.08) 12% 12.3%),linear-gradient(180deg,rgba(227,173,151,.36),rgba(154,92,79,.46));border-top:3px solid rgba(255,233,220,.22);clip-path:polygon(4% 0,96% 0,100% 100%,0 100%)}
.sg-blossom-room-light{position:absolute;left:18%;bottom:0;width:62%;height:37%;background:linear-gradient(120deg,rgba(255,249,220,.52),rgba(255,224,211,.08) 60%,transparent 61%),repeating-radial-gradient(ellipse at 18% 12%,rgba(138,76,87,.14) 0 3%,transparent 4% 10%);clip-path:polygon(7% 0,74% 0,100% 100%,0 100%);animation:sgBgBlossomLight 16s ease-in-out infinite;transform-origin:top left}
.sg-blossom-room-desk{position:absolute;bottom:5%;width:18%;height:12%;border-top:clamp(7px,.8vw,12px) solid rgba(129,76,58,.42);background:rgba(126,82,67,.18);clip-path:polygon(4% 0,96% 0,100% 65%,82% 65%,80% 100%,73% 100%,72% 65%,28% 65%,27% 100%,20% 100%,18% 65%,0 65%);opacity:.62}.sg-blossom-room-desk--left{left:-3%;transform:scale(.72)}.sg-blossom-room-desk--right{right:-2%;transform:scale(.78)}

/* Rain classroom — the storm is visible through one broad wall of glass; the
   opaque ceiling, side walls, floor and furniture remain dry foreground. */
.sg-rain-room-ceiling{position:absolute;left:-2%;right:-2%;top:0;height:8%;background:linear-gradient(180deg,rgba(210,220,222,.96),rgba(139,156,162,.82));border-bottom:3px solid rgba(60,76,82,.25)}
.sg-rain-room-wall{position:absolute;top:7%;bottom:33%;width:7%;background:linear-gradient(90deg,rgba(83,105,113,.92),rgba(150,167,171,.78));box-shadow:0 0 18px rgba(27,45,53,.2)}.sg-rain-room-wall--left{left:0}.sg-rain-room-wall--right{right:0;transform:scaleX(-1)}
.sg-rain-room-window{position:absolute;left:6%;right:6%;top:7%;height:59%;border:clamp(7px,.9vw,14px) solid rgba(59,83,91,.66);background:rgba(150,189,200,.04);box-shadow:inset 0 0 65px rgba(8,29,40,.22),0 10px 26px rgba(24,41,49,.15)}.sg-rain-room-window i{position:absolute;background:rgba(78,102,109,.55)}.sg-rain-room-window i:nth-child(1){left:24.5%;top:0;bottom:0;width:clamp(4px,.48vw,8px)}.sg-rain-room-window i:nth-child(2){left:49.5%;top:0;bottom:0;width:clamp(4px,.48vw,8px)}.sg-rain-room-window i:nth-child(3){left:74.5%;top:0;bottom:0;width:clamp(4px,.48vw,8px)}.sg-rain-room-window i:nth-child(4){left:0;right:0;top:51%;height:clamp(4px,.48vw,8px)}
.sg-rain-room-sill{position:absolute;left:4%;right:4%;top:65%;height:2%;border-radius:2px;background:rgba(59,77,83,.72);box-shadow:0 6px 13px rgba(23,38,45,.17)}
.sg-rain-room-floor{position:absolute;left:-4%;right:-4%;bottom:-3%;height:37%;background:repeating-linear-gradient(100deg,transparent 0 13%,rgba(51,67,70,.1) 13% 13.5%),linear-gradient(180deg,rgba(112,126,126,.72),rgba(56,70,73,.86));border-top:2px solid rgba(203,220,217,.16);clip-path:polygon(4% 0,96% 0,100% 100%,0 100%)}
.sg-rain-room-desk{position:absolute;bottom:5%;width:24%;height:14%;border-top:clamp(8px,.9vw,13px) solid rgba(72,67,61,.72);background:linear-gradient(180deg,rgba(103,99,92,.54),rgba(47,52,54,.68));clip-path:polygon(4% 0,96% 0,100% 73%,84% 73%,82% 100%,76% 100%,74% 73%,26% 73%,24% 100%,18% 100%,16% 73%,0 73%);filter:drop-shadow(0 8px 9px rgba(18,27,31,.24))}.sg-rain-room-desk::after{content:"";position:absolute;left:11%;right:53%;top:-36%;height:28%;border-radius:3px;background:linear-gradient(90deg,#7D91A0,#A5B4BA);transform:rotate(-3deg)}.sg-rain-room-desk--left{left:5%;transform:scale(.78);transform-origin:bottom left}.sg-rain-room-desk--middle{left:38%;bottom:1%}.sg-rain-room-desk--right{right:4%;transform:scale(.82);transform-origin:bottom right}

/* Remaining catalogue entries retain their own art direction while receiving
   a light room shell tailored through per-theme colour variables. */
.sg-theme-room--everyday{--room-wall:rgba(232,239,228,.52);--room-trim:rgba(92,78,61,.32);--room-floor-a:rgba(209,177,132,.34);--room-floor-b:rgba(104,76,55,.38);--room-desk:rgba(124,84,54,.48);opacity:.72}
.sg-everyday-room-ceiling{position:absolute;left:-3%;right:-3%;top:0;height:9%;background:linear-gradient(180deg,rgba(255,255,247,.56),rgba(255,255,255,.12));border-bottom:3px solid var(--room-trim);clip-path:polygon(0 0,100% 0,96% 100%,4% 100%)}
.sg-everyday-room-window{position:absolute;left:4%;top:8%;width:46%;height:46%;border:clamp(6px,.7vw,11px) solid var(--room-trim);border-radius:8px;background:rgba(255,255,255,.035);box-shadow:inset 0 0 40px rgba(255,255,255,.08)}.sg-everyday-room-window i{position:absolute;background:var(--room-trim)}.sg-everyday-room-window i:nth-child(1){left:33%;top:0;bottom:0;width:4px}.sg-everyday-room-window i:nth-child(2){left:66%;top:0;bottom:0;width:4px}.sg-everyday-room-window i:nth-child(3){left:0;right:0;top:55%;height:4px}
.sg-everyday-room-board{position:absolute;right:6%;top:15%;width:34%;height:24%;border:clamp(5px,.6vw,9px) solid var(--room-trim);border-radius:5px;background:linear-gradient(150deg,rgba(39,78,65,.5),rgba(18,55,49,.66));box-shadow:0 8px 20px rgba(23,35,29,.1)}.sg-everyday-room-board::before{content:"STUDY  •  GROW  •  SHINE";position:absolute;left:8%;right:8%;top:42%;color:rgba(246,241,211,.44);font:700 clamp(5px,.7vw,11px)/1 system-ui;letter-spacing:.1em;text-align:center}
.sg-everyday-room-feature{position:absolute;right:7%;top:44%;width:15%;height:18%;border:4px solid var(--room-trim);border-radius:6px;background:repeating-linear-gradient(90deg,#C78667 0 9%,#799685 9% 17%,#D4AE63 17% 25%);opacity:.58}
.sg-everyday-room-floor{position:absolute;left:-4%;right:-4%;bottom:-4%;height:39%;background:repeating-linear-gradient(104deg,transparent 0 12%,rgba(86,64,49,.08) 12% 12.4%),linear-gradient(180deg,var(--room-floor-a),var(--room-floor-b));border-top:2px solid rgba(255,255,255,.14);clip-path:polygon(4% 0,96% 0,100% 100%,0 100%)}
.sg-everyday-room-table{position:absolute;bottom:4%;width:31%;height:14%;border-top:clamp(8px,.9vw,13px) solid var(--room-desk);background:color-mix(in srgb,var(--room-desk),transparent 44%);clip-path:polygon(4% 0,96% 0,100% 72%,84% 72%,82% 100%,75% 100%,73% 72%,27% 72%,25% 100%,18% 100%,16% 72%,0 72%)}.sg-everyday-room-table--one{left:7%;transform:scale(.82);transform-origin:bottom left}.sg-everyday-room-table--two{right:6%}
.sg-theme-room--forest{--room-trim:rgba(72,105,72,.36);--room-floor-a:rgba(190,197,139,.28);--room-floor-b:rgba(82,116,75,.42);--room-desk:rgba(93,110,68,.5)}.sg-theme-room--forest .sg-everyday-room-window{width:60%;border-radius:42% 42% 8px 8px/20% 20% 8px 8px}.sg-theme-room--clouds{--room-trim:rgba(94,139,157,.3);--room-floor-a:rgba(205,223,225,.3);--room-floor-b:rgba(115,151,161,.38);--room-desk:rgba(97,131,142,.45)}.sg-theme-room--sunset{--room-trim:rgba(136,85,65,.34);--room-floor-a:rgba(232,173,123,.34);--room-floor-b:rgba(139,77,66,.42);--room-desk:rgba(142,80,54,.5)}.sg-theme-room--library{opacity:.44;--room-trim:rgba(101,66,40,.36);--room-floor-a:rgba(174,126,73,.28);--room-floor-b:rgba(74,47,30,.34);--room-desk:rgba(83,50,29,.45)}.sg-theme-room--lanterns{opacity:.5;--room-trim:rgba(114,58,43,.38);--room-floor-a:rgba(179,94,60,.3);--room-floor-b:rgba(72,41,39,.38);--room-desk:rgba(109,54,37,.5)}.sg-theme-room--aurora{--room-trim:rgba(115,149,181,.25);--room-floor-a:rgba(75,105,138,.28);--room-floor-b:rgba(17,32,62,.5);--room-desk:rgba(66,89,122,.5)}.sg-theme-room--midnight{opacity:.45;--room-trim:rgba(104,142,119,.2);--room-floor-a:rgba(39,61,49,.28);--room-floor-b:rgba(9,20,16,.48);--room-desk:rgba(49,75,59,.44)}
[data-background-mode="dark"] .sg-theme-room--everyday{filter:brightness(.72) saturate(.82);opacity:.62}
.sg-background-art--compact .sg-theme-room{font-size:6px}.sg-background-art--compact .sg-space-room-planet--three,.sg-background-art--compact .sg-ocean-room-ship,.sg-background-art--compact .sg-everyday-room-feature,.sg-background-art--compact .sg-celestial-room-pod--three{display:none}.sg-background-art--compact .sg-ocean-room-desk,.sg-background-art--compact .sg-space-room-table,.sg-background-art--compact .sg-rain-room-desk,.sg-background-art--compact .sg-everyday-room-table,.sg-background-art--compact .sg-celestial-room-pod,.sg-background-art--compact .sg-moonlit-room-desk{border-top-width:4px}.sg-background-art--compact .sg-blossom-room-window,.sg-background-art--compact .sg-rain-room-window,.sg-background-art--compact .sg-ocean-room-arch,.sg-background-art--compact .sg-celestial-room-observatory{border-width:4px}
.sg-bg-classic-leaves {
  position:absolute;width:34vw;height:34vw;max-width:420px;max-height:420px;opacity:.22;
  background:
    radial-gradient(ellipse at 24% 30%,#8AB681 0 8%,transparent 9%),
    radial-gradient(ellipse at 50% 16%,#A4C69B 0 8%,transparent 9%),
    radial-gradient(ellipse at 68% 42%,#7EAA77 0 9%,transparent 10%),
    linear-gradient(58deg,transparent 48%,#8EAE87 49% 51%,transparent 52%);
}
.sg-bg-classic-leaves--left{left:-10vw;bottom:-13vw;transform:rotate(14deg)}
.sg-bg-classic-leaves--right{right:-12vw;top:-15vw;transform:rotate(196deg)}
[data-background-mode="dark"][data-background-art="classic"] .sg-bg-classic-leaves {
  opacity:.13;
  filter:saturate(.72) brightness(.74);
}
.sg-bg-midnight-glow{
  position:absolute;inset:0;
  background:
    radial-gradient(ellipse at 50% 8%,rgba(90,137,105,.1),transparent 38%),
    radial-gradient(ellipse at 50% 88%,rgba(65,100,78,.07),transparent 42%);
}
.sg-bg-midnight-horizon{
  position:absolute;left:0;right:0;bottom:0;height:32%;
  background:linear-gradient(180deg,transparent,rgba(24,39,30,.12));
  border-top:1px solid rgba(120,158,132,.035);
}
.sg-bg-sun,.sg-bg-cloud-sun {
  position:absolute;left:15%;top:9%;width:clamp(78px,13vw,180px);aspect-ratio:1;border-radius:50%;
  background:rgba(255,232,161,.76);box-shadow:0 0 55px rgba(255,224,141,.52);
}
.sg-bg-forest {position:absolute;left:-4%;right:-4%;bottom:-2%;height:48%;clip-path:polygon(0 100%,0 76%,5% 57%,9% 76%,13% 42%,18% 72%,23% 34%,29% 69%,34% 47%,40% 73%,46% 28%,52% 68%,58% 43%,64% 73%,70% 35%,76% 70%,82% 45%,88% 75%,94% 38%,100% 67%,100% 100%)}
.sg-bg-forest--far{background:rgba(80,126,83,.26);transform:translateY(-9%) scale(1.05)}
.sg-bg-forest--near{background:rgba(52,94,62,.32)}
.sg-bg-pollen i{background:#FFF1B2;box-shadow:0 0 8px rgba(255,240,174,.62);animation:sgBgFloat 14s ease-in-out var(--sg-bg-dot-delay) infinite}
[data-background-mode="dark"][data-background-art="forest"] .sg-bg-sun {
  background:rgba(214,225,204,.28);box-shadow:0 0 60px rgba(165,197,171,.2);
}
[data-background-mode="dark"][data-background-art="forest"] .sg-bg-forest--far{background:rgba(70,112,81,.3)}
[data-background-mode="dark"][data-background-art="forest"] .sg-bg-forest--near{background:rgba(21,57,35,.56)}
[data-background-mode="dark"][data-background-art="forest"] .sg-bg-pollen i{opacity:.24;background:#D8E8B6;box-shadow:0 0 7px rgba(180,218,166,.34)}
.sg-bg-night-window{position:absolute;left:5%;right:5%;top:5%;height:60%;border:clamp(6px,.7vw,11px) solid rgba(168,188,209,.24);border-radius:9px;background:linear-gradient(90deg,transparent 33%,rgba(190,207,223,.15) 33.2% 33.8%,transparent 34% 66%,rgba(190,207,223,.15) 66.2% 66.8%,transparent 67%),linear-gradient(transparent 56%,rgba(190,207,223,.14) 56.2% 57%,transparent 57.2%);box-shadow:inset 0 0 60px rgba(7,14,29,.38),0 16px 42px rgba(5,9,18,.2)}
.sg-bg-moon{position:absolute;left:16%;top:10%;width:clamp(82px,12vw,168px);aspect-ratio:1;border-radius:50%;background:#E8F2F7;box-shadow:0 0 55px rgba(197,224,244,.5);animation:sgBgMoonPulse 12s ease-in-out infinite}
.sg-bg-moon::after{content:"";position:absolute;left:30%;top:-5%;width:92%;height:92%;border-radius:50%;background:#243650}
.sg-bg-stars i,.sg-bg-celestial-stars i{width:4px;height:4px;background:#F4F5D5;box-shadow:0 0 7px rgba(235,241,214,.72);animation:sgBgTwinkle 8s ease-in-out var(--sg-bg-dot-delay) infinite}
.sg-bg-moon-cloud{position:absolute;width:clamp(150px,25vw,330px);height:clamp(34px,5vw,66px);border-radius:80%;background:rgba(170,190,207,.12);filter:blur(6px);animation:sgBgMoonCloud 34s ease-in-out infinite}
.sg-bg-moon-cloud--one{left:4%;top:19%}.sg-bg-moon-cloud--two{right:4%;top:36%;transform:scale(.7);animation-delay:-16s}
.sg-bg-moonbeam{position:absolute;left:4%;top:20%;width:62%;height:72%;clip-path:polygon(8% 0,39% 0,100% 100%,0 100%);background:linear-gradient(135deg,rgba(201,225,245,.22),rgba(178,207,237,.02));animation:sgBgBeam 10s ease-in-out infinite}
.sg-bg-curtain{position:absolute;top:4%;width:9%;height:63%;border-radius:12% 12% 34% 34%;background:repeating-linear-gradient(90deg,rgba(71,88,119,.48) 0 17%,rgba(110,126,153,.32) 17% 34%);filter:drop-shadow(0 8px 8px rgba(6,11,21,.16));transform-origin:top center;animation:sgBgCurtain 11s ease-in-out infinite}
.sg-bg-curtain--left{left:3%}.sg-bg-curtain--right{right:3%;animation-delay:-5s}
.sg-bg-mist{position:absolute;left:-25%;width:150%;height:16%;border-radius:50%;background:rgba(213,229,235,.13);filter:blur(16px);animation:sgBgMist 28s ease-in-out infinite}
.sg-bg-mist--one{bottom:28%}.sg-bg-mist--two{bottom:14%;animation-delay:-13s;opacity:.65}
.sg-bg-branch{position:absolute;width:44%;height:15%;border-radius:50%;border-bottom:clamp(4px,.7vw,10px) solid rgba(104,75,70,.34)}
.sg-bg-branch::before,.sg-bg-branch::after{content:"";position:absolute;width:36%;height:85%;border-radius:50%;border-top:3px solid rgba(104,75,70,.26)}
.sg-bg-branch::before{left:24%;top:35%;transform:rotate(18deg)}.sg-bg-branch::after{right:4%;top:22%;transform:rotate(-20deg)}
.sg-bg-branch--left{left:-8%;top:2%;transform:rotate(13deg)}.sg-bg-branch--right{right:-10%;bottom:5%;transform:rotate(192deg)}
.sg-bg-petals i{width:12px;height:8px;border-radius:70% 30% 65% 35%;background:#F6B8CA;opacity:.42;animation:sgBgPetal 18s linear var(--sg-bg-dot-delay) infinite}
[data-background-mode="dark"][data-background-art="blossom"] .sg-bg-branch{border-bottom-color:rgba(192,144,157,.23)}
[data-background-mode="dark"][data-background-art="blossom"] .sg-bg-branch::before,
[data-background-mode="dark"][data-background-art="blossom"] .sg-bg-branch::after{border-top-color:rgba(192,144,157,.17)}
[data-background-mode="dark"][data-background-art="blossom"] .sg-bg-petals i{background:#D799B3;opacity:.28}
.sg-bg-window-grid{position:absolute;left:4%;right:4%;top:4%;height:64%;border:clamp(5px,.65vw,10px) solid rgba(238,245,246,.22);border-radius:8px;background:linear-gradient(90deg,transparent 32.8%,rgba(240,247,248,.2) 33% 33.5%,transparent 33.7% 66%,rgba(240,247,248,.2) 66.2% 66.7%,transparent 66.9%),linear-gradient(transparent 52%,rgba(240,247,248,.18) 52.2% 52.8%,transparent 53%);box-shadow:inset 0 0 70px rgba(31,55,68,.2),0 16px 46px rgba(38,58,69,.18)}
.sg-bg-rain-sheet,.sg-bg-rain-trails,.sg-bg-rain-droplets,.sg-bg-rain-bokeh{position:absolute;left:4%;right:4%;top:4%;height:64%;overflow:hidden;border-radius:8px}
.sg-bg-rain-sheet i{position:absolute;top:-42%;width:1.4px;border-radius:999px;background:linear-gradient(180deg,transparent 0 5%,rgba(232,246,252,.16) 18%,rgba(235,248,252,.72) 72%,rgba(255,255,255,.18));transform:rotate(-6deg);animation:sgBgRainStreak var(--sg-rain-duration,1.8s) linear var(--sg-rain-delay,0s) infinite;will-change:transform,opacity}
.sg-bg-rain-sheet--far{opacity:.46;filter:blur(.35px)}.sg-bg-rain-sheet--near{opacity:.78}.sg-bg-rain-sheet--near i:nth-child(3n){width:2.4px;filter:drop-shadow(0 0 2px rgba(227,244,250,.42))}
.sg-bg-rain-trails i{position:absolute;top:-28%;width:clamp(2px,.24vw,4px);border-radius:999px 999px 50% 50%;background:linear-gradient(180deg,rgba(255,255,255,.02),rgba(226,242,248,.4) 18%,rgba(244,251,253,.6) 86%,rgba(250,254,255,.1));box-shadow:0 0 4px rgba(232,247,252,.26);opacity:.56;animation:sgBgRainTrail var(--sg-rain-duration,12s) ease-in var(--sg-rain-delay,0s) infinite;will-change:transform,opacity}
.sg-bg-rain-droplets i{position:absolute;border-radius:60% 45% 58% 48%;background:radial-gradient(circle at 35% 28%,rgba(255,255,255,.8) 0 8%,rgba(228,244,249,.36) 24%,rgba(133,173,189,.13) 68%,rgba(255,255,255,.42) 72% 77%,transparent 79%);box-shadow:inset -1px -2px 2px rgba(58,103,121,.2),0 1px 2px rgba(255,255,255,.25);animation:sgBgDropCreep 18s ease-in-out var(--sg-bg-dot-delay) infinite;will-change:transform,opacity}
.sg-bg-rain-bokeh{background:radial-gradient(circle at 12% 61%,rgba(255,184,88,.36) 0 1.8%,transparent 6%),radial-gradient(circle at 81% 22%,rgba(122,202,224,.28) 0 1.5%,transparent 6%),radial-gradient(circle at 70% 68%,rgba(255,216,136,.24) 0 1.2%,transparent 5%),linear-gradient(180deg,rgba(55,101,122,.12),rgba(19,54,72,.2));filter:blur(2px);opacity:.72}
.sg-bg-rain-bokeh i{position:absolute;width:clamp(26px,5vw,68px);aspect-ratio:1;border-radius:50%;background:rgba(255,184,87,.2);filter:blur(8px);animation:sgBgBokeh 9s ease-in-out infinite}.sg-bg-rain-bokeh i:nth-child(1){left:6%;top:18%}.sg-bg-rain-bokeh i:nth-child(2){left:25%;top:66%;background:rgba(93,185,218,.2);animation-delay:-2s}.sg-bg-rain-bokeh i:nth-child(3){right:8%;top:42%;animation-delay:-4s}.sg-bg-rain-bokeh i:nth-child(4){right:28%;top:15%;background:rgba(119,194,219,.2);animation-delay:-6s}.sg-bg-rain-bokeh i:nth-child(5){left:48%;top:48%;animation-delay:-7s}
.sg-bg-rain-glow{background:radial-gradient(circle at 75% 20%,rgba(242,248,246,.26),transparent 28%),linear-gradient(115deg,transparent 42%,rgba(210,233,243,.08) 55%,transparent 68%)}
[data-background-mode="dark"][data-background-art="rain"] .sg-bg-window-grid{border-color:rgba(205,225,234,.12);box-shadow:0 16px 50px rgba(0,0,0,.28)}
[data-background-mode="dark"][data-background-art="rain"] .sg-bg-rain-glow{background:radial-gradient(circle at 75% 20%,rgba(183,210,221,.13),transparent 30%)}
[data-background-mode="dark"][data-background-art="rain"] .sg-bg-rain-sheet{opacity:.54}[data-background-mode="dark"][data-background-art="rain"] .sg-bg-rain-trails{opacity:.64}[data-background-mode="dark"][data-background-art="rain"] .sg-bg-rain-bokeh{opacity:.52}
.sg-bg-sunset-sun{position:absolute;left:62%;top:25%;width:clamp(94px,14vw,190px);aspect-ratio:1;border-radius:50%;background:rgba(255,230,168,.7);box-shadow:0 0 70px rgba(255,214,147,.38)}
.sg-bg-hill{position:absolute;left:-10%;right:-10%;bottom:-24%;height:58%;border-radius:50% 50% 0 0/38% 38% 0 0}
.sg-bg-hill--far{background:rgba(119,115,91,.21);transform:translate(-9%,-16%) rotate(2deg)}
.sg-bg-hill--near{background:rgba(80,91,72,.29);transform:translate(18%,4%) rotate(-3deg)}
.sg-bg-sunset-motes i{background:#FFF0BD;box-shadow:0 0 8px rgba(255,231,171,.65);animation:sgBgFloat 18s ease-in-out var(--sg-bg-dot-delay) infinite}
[data-background-mode="dark"][data-background-art="sunset"] .sg-bg-sunset-sun{background:rgba(226,157,125,.38);box-shadow:0 0 72px rgba(203,119,101,.22)}
[data-background-mode="dark"][data-background-art="sunset"] .sg-bg-hill--far{background:rgba(93,66,70,.34)}
[data-background-mode="dark"][data-background-art="sunset"] .sg-bg-hill--near{background:rgba(37,44,38,.55)}
[data-background-mode="dark"][data-background-art="sunset"] .sg-bg-sunset-motes i{opacity:.22}
.sg-bg-library-room{background:linear-gradient(90deg,rgba(86,58,37,.14),transparent 27% 73%,rgba(86,58,37,.14)),repeating-linear-gradient(0deg,transparent 0 12%,rgba(255,245,222,.045) 12% 12.4%)}
.sg-bg-shelf{position:absolute;top:5%;bottom:7%;width:min(23vw,300px);border:clamp(5px,.65vw,10px) solid rgba(81,52,32,.42);border-radius:12px 12px 4px 4px;opacity:.62;background:repeating-linear-gradient(0deg,transparent 0 21%,rgba(72,46,29,.72) 21% 23.5%,transparent 23.5% 32%),repeating-linear-gradient(90deg,#755239 0 7%,#B88859 7% 12%,#526C5B 12% 17%,#D0AE68 17% 23%,#845B46 23% 28%,#6C7D69 28% 32%);box-shadow:inset 0 0 0 3px rgba(244,216,169,.11),0 16px 30px rgba(72,46,29,.12)}
.sg-bg-shelf::before{content:"";position:absolute;inset:-2% 47% -2% auto;width:clamp(3px,.45vw,7px);background:rgba(75,47,28,.48);box-shadow:0 0 0 1px rgba(243,213,168,.08)}
.sg-bg-shelf--left{left:2.5%}.sg-bg-shelf--right{right:2.5%;transform:scaleX(-1)}
.sg-bg-library-window{position:absolute;left:50%;top:7%;width:min(34vw,380px);height:43%;transform:translateX(-50%);border:clamp(6px,.75vw,11px) solid rgba(101,67,41,.4);border-radius:16px 16px 4px 4px;background:linear-gradient(180deg,rgba(255,242,194,.68),rgba(229,202,152,.24));box-shadow:inset 0 0 36px rgba(255,248,216,.42),0 14px 34px rgba(87,57,35,.1)}
.sg-bg-library-window::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent 49%,rgba(101,67,41,.28) 49% 51%,transparent 51%),linear-gradient(transparent 58%,rgba(101,67,41,.28) 58% 61%,transparent 61%)}
.sg-bg-library-window::after{content:"";position:absolute;left:-6%;right:-6%;bottom:-14px;height:clamp(8px,1vw,14px);border-radius:3px;background:rgba(92,60,36,.45);box-shadow:0 4px 9px rgba(70,45,27,.13)}
.sg-bg-library-desk{position:absolute;left:25%;right:25%;bottom:4%;height:17%;border-top:clamp(7px,.8vw,12px) solid rgba(79,49,29,.5);border-radius:48% 48% 5px 5px/18% 18% 5px 5px;background:linear-gradient(180deg,rgba(126,84,50,.34),rgba(79,49,30,.4));box-shadow:0 -10px 26px rgba(92,58,34,.08)}
.sg-bg-library-lamp{position:absolute;left:31%;bottom:21%;width:clamp(32px,5vw,72px);height:clamp(46px,7vw,102px);border-left:clamp(3px,.35vw,5px) solid rgba(77,62,44,.46);transform:skewX(-7deg)}
.sg-bg-library-lamp::before{content:"";position:absolute;left:-70%;top:-12%;width:145%;height:34%;clip-path:polygon(25% 0,75% 0,100% 100%,0 100%);background:rgba(222,184,112,.66);box-shadow:0 8px 24px rgba(255,221,147,.3)}
.sg-bg-library-lamp::after{content:"";position:absolute;left:-70%;bottom:-4%;width:140%;height:7%;border-radius:50%;background:rgba(71,51,34,.48)}
.sg-bg-library-light{background:radial-gradient(ellipse at 50% 18%,rgba(255,247,207,.42),transparent 35%),radial-gradient(circle at 29% 73%,rgba(255,223,153,.22),transparent 18%)}
[data-background-mode="dark"][data-background-art="library"] .sg-bg-library-room{background:linear-gradient(90deg,rgba(20,12,7,.38),transparent 27% 73%,rgba(20,12,7,.38)),repeating-linear-gradient(0deg,transparent 0 12%,rgba(236,204,155,.025) 12% 12.4%)}
[data-background-mode="dark"][data-background-art="library"] .sg-bg-shelf{opacity:.54;filter:brightness(.68) saturate(.8);box-shadow:inset 0 0 0 3px rgba(220,179,121,.06),0 18px 34px rgba(0,0,0,.28)}
[data-background-mode="dark"][data-background-art="library"] .sg-bg-library-window{background:linear-gradient(180deg,rgba(212,166,102,.25),rgba(91,64,45,.16));box-shadow:inset 0 0 38px rgba(238,192,118,.16),0 14px 36px rgba(0,0,0,.22)}
[data-background-mode="dark"][data-background-art="library"] .sg-bg-library-desk{filter:brightness(.63)}
[data-background-mode="dark"][data-background-art="library"] .sg-bg-library-lamp{filter:brightness(.78)}
[data-background-mode="dark"][data-background-art="library"] .sg-bg-library-light{background:radial-gradient(ellipse at 50% 18%,rgba(239,190,112,.16),transparent 36%),radial-gradient(circle at 29% 73%,rgba(246,186,93,.13),transparent 19%)}
.sg-background-art--compact .sg-bg-shelf{top:5%;bottom:5%;width:27%;border-width:4px}.sg-background-art--compact .sg-bg-shelf--left{left:2%}.sg-background-art--compact .sg-bg-shelf--right{right:2%}.sg-background-art--compact .sg-bg-library-window{top:8%;width:34%;height:43%;border-width:4px}.sg-background-art--compact .sg-bg-library-window::after{bottom:-7px;height:6px}.sg-background-art--compact .sg-bg-library-desk{left:27%;right:27%;height:18%;border-top-width:5px}.sg-background-art--compact .sg-bg-library-lamp{left:30%;width:24px;height:36px;border-left-width:2px}
.sg-bg-lantern-window{position:absolute;left:5%;right:33%;top:6%;height:54%;border:clamp(6px,.7vw,10px) solid rgba(84,53,40,.35);border-radius:8px;background:linear-gradient(180deg,rgba(255,191,115,.46),rgba(102,61,65,.2)),linear-gradient(90deg,transparent 49.5%,rgba(83,54,43,.32) 49.7% 50.3%,transparent 50.5%);box-shadow:inset 0 0 50px rgba(255,193,111,.18),0 12px 28px rgba(47,29,26,.13)}
.sg-bg-lantern-shelf{position:absolute;right:4%;top:8%;width:23%;height:57%;border:clamp(5px,.6vw,9px) solid rgba(67,43,33,.42);border-radius:8px;background:repeating-linear-gradient(0deg,transparent 0 22%,rgba(61,39,30,.48) 22% 25%),repeating-linear-gradient(90deg,#A5674F 0 7%,#D0A55C 7% 13%,#526C63 13% 20%,#7D5069 20% 26%);opacity:.7}
.sg-bg-paper-lantern{position:absolute;top:5%;width:clamp(30px,4.6vw,66px);height:clamp(43px,6vw,88px);border-radius:44% 44% 38% 38%;background:repeating-linear-gradient(0deg,rgba(153,64,47,.74) 0 12%,rgba(224,106,68,.8) 12% 24%);border:2px solid rgba(84,41,34,.32);box-shadow:0 0 34px rgba(255,151,78,.32);transform-origin:50% -20%;animation:sgBgLanternSway 8s ease-in-out infinite}
.sg-bg-paper-lantern::before{content:"";position:absolute;left:50%;top:-38%;width:1px;height:38%;background:rgba(50,38,36,.42)}.sg-bg-paper-lantern::after{content:"";position:absolute;left:42%;bottom:-24%;width:16%;height:24%;background:repeating-linear-gradient(90deg,#E8A44D 0 24%,transparent 24% 44%)}
.sg-bg-paper-lantern--one{left:12%}.sg-bg-paper-lantern--two{left:43%;top:8%;transform:scale(.8);animation-delay:-3s}.sg-bg-paper-lantern--three{right:8%;top:3%;transform:scale(.68);animation-delay:-5.5s}
.sg-bg-lantern-motes i{background:#FFD28A;box-shadow:0 0 9px rgba(255,181,92,.64);animation:sgBgFloat 17s ease-in-out var(--sg-bg-dot-delay) infinite}
[data-background-mode="dark"][data-background-art="lanterns"] .sg-bg-paper-lantern{filter:brightness(.76);box-shadow:0 0 26px rgba(255,140,71,.2)}
.sg-bg-cloud{position:absolute;width:clamp(130px,23vw,300px);height:clamp(36px,6vw,84px);border-radius:80px;background:rgba(255,255,255,.54);filter:blur(.2px);animation:sgBgCloud 40s ease-in-out infinite}
.sg-bg-cloud::before,.sg-bg-cloud::after{content:"";position:absolute;border-radius:50%;background:inherit}
.sg-bg-cloud::before{width:42%;aspect-ratio:1;left:16%;bottom:16%}.sg-bg-cloud::after{width:33%;aspect-ratio:1;right:17%;bottom:17%}
.sg-bg-cloud--one{left:8%;top:18%}.sg-bg-cloud--two{right:4%;top:48%;animation-delay:-17s;transform:scale(.72)}.sg-bg-cloud--three{left:32%;bottom:8%;animation-delay:-29s;transform:scale(.58)}
.sg-bg-cloud-sun{left:auto;right:15%;top:9%;background:rgba(255,245,191,.52);box-shadow:0 0 52px rgba(255,238,174,.3)}
[data-background-mode="dark"][data-background-art="clouds"] .sg-bg-cloud{background:rgba(205,220,230,.14)}
[data-background-mode="dark"][data-background-art="clouds"] .sg-bg-cloud-sun{background:rgba(195,214,218,.18);box-shadow:0 0 55px rgba(169,198,209,.12)}
.sg-bg-aurora{position:absolute;left:-15%;width:130%;height:30%;border-radius:50%;filter:blur(18px);opacity:.22;animation:sgBgAurora 20s ease-in-out infinite;transform-origin:center}
.sg-bg-aurora--one{top:5%;background:linear-gradient(90deg,transparent,#78D9B1 30%,#7AA8E6 65%,transparent)}
.sg-bg-aurora--two{top:18%;background:linear-gradient(90deg,transparent,#97C6E8 25%,#B99AE4 70%,transparent);animation-delay:-8s}
.sg-bg-aurora--three{top:34%;opacity:.12;background:linear-gradient(90deg,transparent,#64CFA7 45%,#7D8BE2 76%,transparent);animation-delay:-14s}
.sg-bg-hill--night{background:rgba(6,14,25,.62);bottom:-35%;height:58%}
.sg-bg-ocean-window{position:absolute;left:4%;right:4%;top:4%;height:65%;border:clamp(8px,1vw,15px) solid rgba(20,57,68,.42);border-radius:18px;background:linear-gradient(90deg,transparent 49.4%,rgba(155,224,229,.16) 49.6% 50.4%,transparent 50.6%),linear-gradient(180deg,rgba(90,207,218,.18),rgba(2,42,61,.34));box-shadow:inset 0 0 65px rgba(1,29,44,.38),0 18px 38px rgba(1,27,38,.18)}
.sg-bg-ocean-rays{position:absolute;left:-8%;right:-8%;top:-8%;height:82%;background:repeating-linear-gradient(104deg,transparent 0 10%,rgba(158,232,229,.1) 11% 14%,transparent 15% 25%);clip-path:polygon(0 0,100% 0,78% 100%,18% 100%);animation:sgBgOceanRays 15s ease-in-out infinite;transform-origin:top center}
.sg-bg-ocean-fish{position:absolute;width:clamp(34px,6vw,84px);height:clamp(13px,2.2vw,30px);border-radius:60% 48% 48% 60%;background:rgba(5,42,57,.46);animation:sgBgFish 24s linear infinite;will-change:transform}
.sg-bg-ocean-fish::after{content:"";position:absolute;right:-28%;top:10%;width:34%;height:80%;background:inherit;clip-path:polygon(0 50%,100% 0,100% 100%)}.sg-bg-ocean-fish::before{content:"";position:absolute;left:18%;top:25%;width:7%;aspect-ratio:1;border-radius:50%;background:rgba(196,237,234,.62)}
.sg-bg-ocean-fish--one{left:-12%;top:23%}.sg-bg-ocean-fish--two{left:-26%;top:46%;transform:scale(.58);animation-duration:32s;animation-delay:-14s;opacity:.62}
.sg-bg-ocean-bubbles{position:absolute;inset:0}.sg-bg-ocean-bubbles i{position:absolute;bottom:-8%;border:1px solid rgba(190,244,242,.54);border-radius:50%;box-shadow:inset 1px 1px 2px rgba(255,255,255,.24);animation:sgBgBubble var(--sg-bubble-duration,15s) ease-in var(--sg-bubble-delay,0s) infinite;will-change:transform,opacity}
[data-background-mode="dark"][data-background-art="ocean"] .sg-bg-ocean-window{filter:brightness(.7)}[data-background-mode="dark"][data-background-art="ocean"] .sg-bg-ocean-rays{opacity:.58}
.sg-bg-celestial-moon{position:absolute;left:12%;top:9%;width:clamp(60px,9vw,126px);aspect-ratio:1;border-radius:50%;border:clamp(6px,.8vw,12px) solid rgba(229,226,191,.68);box-shadow:0 0 35px rgba(216,217,192,.26)}
.sg-bg-orbit{position:absolute;right:10%;top:10%;width:clamp(170px,28vw,390px);aspect-ratio:1;border:1px solid rgba(197,195,231,.18);border-radius:50%;animation:sgBgOrbit 42s linear infinite}
.sg-bg-orbit::after{content:"";position:absolute;width:10px;height:10px;border-radius:50%;background:#E5D89D;left:18%;top:8%;box-shadow:0 0 12px rgba(232,217,157,.5)}
.sg-bg-orbit--two{right:16%;top:17%;transform:scale(.62);animation-direction:reverse;animation-duration:34s}
.sg-bg-celestial-garden{position:absolute;left:-5%;right:-5%;bottom:-3%;height:35%;opacity:.36;background:radial-gradient(ellipse at 15% 100%,#62648D 0 19%,transparent 20%),radial-gradient(ellipse at 38% 100%,#4F537B 0 24%,transparent 25%),radial-gradient(ellipse at 70% 100%,#64678E 0 21%,transparent 22%),radial-gradient(ellipse at 92% 100%,#4B5179 0 24%,transparent 25%)}
.sg-bg-planetarium-dome{position:absolute;left:-8%;right:-8%;top:-31%;height:88%;border-radius:0 0 50% 50%;border-bottom:clamp(8px,1vw,14px) solid rgba(105,112,159,.28);background:radial-gradient(ellipse at 50% 84%,rgba(80,91,151,.16),rgba(4,6,20,.38) 68%);box-shadow:inset 0 -25px 65px rgba(79,89,149,.1)}
.sg-bg-planetarium-map{position:absolute;left:50%;top:5%;width:clamp(260px,46vw,620px);aspect-ratio:1;border:1px solid rgba(184,193,239,.15);border-radius:50%;transform:translateX(-50%);background:repeating-radial-gradient(circle,transparent 0 15%,rgba(171,181,230,.09) 15.2% 15.5%,transparent 15.8% 25%);animation:sgBgPlanetarium 70s linear infinite}
.sg-bg-planetarium-map::before,.sg-bg-planetarium-map::after{content:"";position:absolute;inset:15%;border:1px solid rgba(174,184,232,.11);border-radius:50%;transform:rotate(58deg)}.sg-bg-planetarium-map::after{inset:31%;transform:rotate(118deg)}
.sg-bg-planetarium-constellation{position:absolute;width:24%;height:16%;background:linear-gradient(28deg,transparent 48%,rgba(182,195,246,.2) 49% 51%,transparent 52%),linear-gradient(-32deg,transparent 48%,rgba(182,195,246,.16) 49% 51%,transparent 52%);opacity:.7;animation:sgBgTwinkle 10s ease-in-out infinite}.sg-bg-planetarium-constellation::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 5% 76%,#F4EDBE 0 2px,transparent 3px),radial-gradient(circle at 48% 38%,#DDE7FF 0 2px,transparent 3px),radial-gradient(circle at 96% 7%,#F4EDBE 0 2px,transparent 3px),radial-gradient(circle at 77% 91%,#DDE7FF 0 2px,transparent 3px)}
.sg-bg-planetarium-constellation--one{left:7%;top:17%}.sg-bg-planetarium-constellation--two{right:8%;top:31%;transform:rotate(24deg);animation-delay:-5s}
.sg-bg-planetarium-projector{position:absolute;left:50%;bottom:16%;width:clamp(42px,6vw,82px);height:clamp(28px,4vw,54px);transform:translateX(-50%);border-radius:50% 50% 12px 12px;background:linear-gradient(180deg,#62709A,#262E52);box-shadow:0 9px 19px rgba(0,0,0,.25)}
.sg-bg-planetarium-projector::before{content:"";position:absolute;left:50%;top:-38%;width:34%;aspect-ratio:1;border-radius:50%;transform:translateX(-50%);background:#B9C8F1;box-shadow:0 0 18px rgba(167,189,244,.55)}
.sg-bg-planetarium-beam{position:absolute;left:50%;bottom:24%;width:70%;height:67%;transform:translateX(-50%);clip-path:polygon(47% 100%,53% 100%,100% 0,0 0);background:linear-gradient(180deg,rgba(162,181,239,.02),rgba(164,184,242,.1));animation:sgBgBeam 12s ease-in-out infinite}
[data-background-mode="dark"][data-background-art="moonlit"] .sg-bg-moon,
[data-background-mode="dark"][data-background-art="aurora"] .sg-bg-stars,
[data-background-mode="dark"][data-background-art="celestial"] .sg-bg-celestial-moon{opacity:.78}
[data-background-mode="dark"][data-background-art="aurora"] .sg-bg-aurora{filter:blur(21px);opacity:.18}
[data-background-mode="dark"][data-background-art="celestial"] .sg-bg-celestial-garden{opacity:.25}
@keyframes sgBgFloat{0%,100%{transform:translate3d(0,4px,0) scale(var(--sg-bg-dot-scale,.5));opacity:.2}50%{transform:translate3d(7px,-10px,0) scale(var(--sg-bg-dot-scale,.5));opacity:.62}}
@keyframes sgBgTwinkle{0%,100%{opacity:.18}48%{opacity:.72}62%{opacity:.34}}
@keyframes sgBgMist{0%,100%{transform:translate3d(-3%,0,0)}50%{transform:translate3d(7%,4px,0)}}
@keyframes sgBgPetal{0%{transform:translate3d(-10px,-16px,0) rotate(0);opacity:0}12%{opacity:.48}100%{transform:translate3d(42px,120px,0) rotate(260deg);opacity:0}}
@keyframes sgBgRainStreak{0%{transform:translate3d(0,-35vh,0) rotate(-6deg);opacity:.18}8%{opacity:.78}92%{opacity:.72}100%{transform:translate3d(var(--sg-rain-drift,16px),115vh,0) rotate(-6deg);opacity:.2}}
@keyframes sgBgRainTrail{0%,8%{transform:translate3d(0,-18%,0) scaleY(.78);opacity:0}18%{opacity:.45}78%{opacity:.64}100%{transform:translate3d(2px,92vh,0) scaleY(1.08);opacity:0}}
@keyframes sgBgDropCreep{0%,18%,100%{transform:translate3d(0,0,0) scale(.82);opacity:.28}34%{opacity:.72}72%{transform:translate3d(1px,46px,0) scale(1);opacity:.58}84%{transform:translate3d(2px,73px,0) scale(.86);opacity:0}}
@keyframes sgBgBokeh{0%,100%{transform:scale(.9);opacity:.35}50%{transform:scale(1.08);opacity:.7}}
@keyframes sgBgMoonPulse{0%,100%{transform:scale(.985);opacity:.92}50%{transform:scale(1.025);opacity:1}}
@keyframes sgBgMoonCloud{0%,100%{transform:translate3d(-14px,0,0) scale(.92);opacity:.35}50%{transform:translate3d(28px,-2px,0) scale(1.02);opacity:.62}}
@keyframes sgBgCurtain{0%,100%{transform:skewX(-1.5deg) scaleX(.98)}50%{transform:skewX(2.4deg) scaleX(1.04)}}
@keyframes sgBgBeam{0%,100%{opacity:.38}50%{opacity:.72}}
@keyframes sgBgLanternSway{0%,100%{rotate:-2.5deg}50%{rotate:2.5deg}}
@keyframes sgBgOceanRays{0%,100%{transform:skewX(-2deg) scaleX(.98);opacity:.54}50%{transform:skewX(3deg) scaleX(1.04);opacity:.82}}
@keyframes sgBgFish{0%{transform:translate3d(-10vw,0,0)}45%{transform:translate3d(58vw,-10px,0)}50%{transform:translate3d(58vw,-10px,0) scaleX(-1)}95%{transform:translate3d(-10vw,7px,0) scaleX(-1)}100%{transform:translate3d(-10vw,0,0)}}
@keyframes sgBgBubble{0%{transform:translate3d(0,0,0) scale(.7);opacity:0}12%{opacity:.6}74%{opacity:.48}100%{transform:translate3d(10px,-92vh,0) scale(1.22);opacity:0}}
@keyframes sgBgPlanetarium{to{transform:translateX(-50%) rotate(360deg)}}
@keyframes sgBgKelp{0%,100%{rotate:-2deg;scale:1 .98}50%{rotate:3deg;scale:1 1.025}}
@keyframes sgBgPlanetSway{0%,100%{rotate:-2.2deg;translate:0 0}50%{rotate:2.4deg;translate:0 3px}}
@keyframes sgBgBlossomLight{0%,100%{transform:skewX(-1deg);opacity:.62}50%{transform:skewX(2deg) translateX(1.5%);opacity:.82}}
@keyframes sgBgCloud{0%,100%{translate:-8px 0}50%{translate:18px -3px}}
@keyframes sgBgAurora{0%,100%{transform:skewX(-6deg) scaleY(.9);opacity:.14}50%{transform:skewX(7deg) scaleY(1.12);opacity:.28}}
@keyframes sgBgOrbit{to{transform:rotate(360deg)}}
.sg-background-art--focus .sg-bg-petals i,
.sg-background-art--focus .sg-bg-rain-sheet i,
.sg-background-art--focus .sg-bg-rain-trails i,
.sg-background-art--focus .sg-bg-rain-droplets i,
.sg-background-art--focus .sg-bg-ocean-bubbles i,
.sg-background-art--focus .sg-bg-dots i { animation-duration:36s!important;opacity:.22 }
.sg-background-art--focus .sg-bg-aurora,
.sg-background-art--focus .sg-bg-cloud,
.sg-background-art--focus .sg-bg-mist,
.sg-background-art--focus .sg-bg-ocean-fish,
.sg-background-art--focus .sg-bg-planetarium-map,
.sg-background-art--focus .sg-ocean-room-kelp,
.sg-background-art--focus .sg-space-room-planet,
.sg-background-art--focus .sg-celestial-room-orbit-ring,
.sg-background-art--focus .sg-blossom-room-light { animation-duration:60s!important;opacity:.18 }
.sg-background-art--focus { filter:saturate(.72) contrast(.9); }
[data-theme="dark"] .sg-shell .sg-background-art--focus.sg-keepcolor {
  filter:invert(1) hue-rotate(180deg) saturate(.72) contrast(.9);
}
.sg-background-art--paused *,
.sg-background-art--low-power .sg-bg-dots i,
.sg-background-art--low-power .sg-bg-aurora,
.sg-background-art--low-power .sg-bg-cloud,
.sg-background-art--low-power .sg-bg-mist,
.sg-background-art--low-power .sg-bg-orbit,
.sg-background-art--low-power .sg-bg-rain-trails,
.sg-background-art--low-power .sg-bg-rain-droplets,
.sg-background-art--low-power .sg-bg-ocean-fish,
.sg-background-art--low-power .sg-bg-ocean-bubbles,
.sg-background-art--low-power .sg-bg-planetarium-map,
.sg-background-art--low-power .sg-ocean-room-kelp,
.sg-background-art--low-power .sg-space-room-planet,
.sg-background-art--low-power .sg-celestial-room-orbit-ring,
.sg-background-art--low-power .sg-blossom-room-light { animation-play-state:paused!important; }
.sg-shop-category-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4;padding:4;margin:0 0 11px;background:#EEF3EB;border-radius:13px}
.sg-shop-category-tab{min-width:0;min-height:40px;border:0;border-radius:10px;background:transparent;color:#7C887E;padding:8px 5px;font-size:10.5px;font-weight:700;cursor:pointer;display:flex;gap:4px;align-items:center;justify-content:center;white-space:nowrap}
.sg-shop-category-tab--active{color:#2D6A4F;background:#fff;box-shadow:0 1px 4px rgba(35,58,42,.1)}
.sg-background-shop-overlay{position:fixed;inset:0;z-index:300;background:rgba(8,18,12,.5);display:flex;align-items:flex-end;justify-content:center;overflow:hidden}
.sg-background-shop{position:relative;width:100%;max-width:460px;max-height:min(88dvh,88vh);overflow:auto;overscroll-behavior:contain;background:#fff;border-radius:26px 26px 0 0;padding:22px max(14px,env(safe-area-inset-right)) max(34px,calc(env(safe-area-inset-bottom) + 18px)) max(14px,env(safe-area-inset-left))}
.sg-background-shop-header{position:sticky;top:-22px;z-index:8;display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin:-22px 0 10px;padding:22px 0 10px;background:linear-gradient(180deg,#fff 82%,rgba(255,255,255,.95))}
.sg-background-shop-heading{display:flex;align-items:center;gap:8px;min-width:0}.sg-background-shop-heading h3{font-size:18px;color:#1A1A2E;margin:0}.sg-background-shop-heading p{font-size:11.5px;color:#98A39A;font-weight:600;margin:2px 0 0}
.sg-background-round-btn{width:32px;height:32px;border:0;border-radius:50%;background:#F0F2EE;color:#666;font-size:17px;cursor:pointer}
.sg-background-coin-balance{flex-shrink:0;font-size:14px;font-weight:700;color:#B8860B;background:#FFF8E7;border:1px solid #F0D060;border-radius:20px;padding:5px 10px}
.sg-background-collection-wrap{position:relative;width:100%;min-width:0;overflow:hidden;margin-bottom:7px}
.sg-background-collection-row{display:flex;gap:7px;overflow-x:auto;overflow-y:hidden;padding:1px 0 5px;scrollbar-width:none;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch}
.sg-background-collection-row::-webkit-scrollbar{display:none}
.sg-background-collection-row>button{flex:0 0 auto;display:flex;align-items:center;gap:5px;min-height:34px;border:1.5px solid transparent;border-radius:18px;background:#F5F7F2;color:#5A6A5C;padding:6px 11px;font-size:11px;font-weight:700;white-space:nowrap;cursor:pointer}
.sg-background-collection-row>button.is-active{color:#2D6A4F;background:#E8F5EE;border-color:#BFE3CE}
.sg-background-collection-count{min-width:17px;border-radius:8px;background:#fff;color:#929D94;padding:1px 5px;font-size:9px;text-align:center}
.sg-background-collection-row>button.is-active .sg-background-collection-count{background:#D7EEDF;color:#2D6A4F}
.sg-background-filter-row{display:flex;gap:6;align-items:center;margin-bottom:10px}.sg-background-filter-row button{min-height:34px;border:1px solid #DFE7DC;border-radius:18px;background:#F7F9F5;color:#718075;padding:6px 11px;font-size:11px;font-weight:700;cursor:pointer}.sg-background-filter-row button.is-active{color:#2D6A4F;background:#E9F4EA;border-color:#BFD8C2}.sg-background-filter-row .sg-background-use-default{margin-left:auto;color:#53685A;background:#fff}
.sg-background-toast{position:sticky;top:54px;z-index:10;background:#20352A;color:#fff;border-radius:12px;padding:9px 12px;margin-bottom:10px;text-align:center;font-size:11.5px;font-weight:650;box-shadow:0 5px 18px rgba(20,40,28,.16)}
.sg-background-empty{display:flex;flex-direction:column;align-items:center;gap:4px;padding:28px 12px;color:#506057;text-align:center}.sg-background-empty strong{font-size:13px}.sg-background-empty span{font-size:11px;color:#929B95}
.sg-background-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.sg-background-card{min-width:0;overflow:hidden;border:1.5px solid #E4EAE1;border-radius:16px;background:#fff;padding:7px;box-shadow:0 2px 7px rgba(29,49,35,.045)}
.sg-background-card--active{border-color:#75B98E;box-shadow:0 0 0 2px rgba(86,182,139,.11)}
.sg-background-thumb{position:relative;display:block;width:100%;height:96px;overflow:hidden;border:0;border-radius:12px;padding:0;background:#EEF3EB;cursor:pointer}
.sg-background-thumb>span{position:absolute;right:7px;bottom:7px;padding:4px 7px;border-radius:10px;background:rgba(20,32,24,.63);backdrop-filter:blur(5px);color:#fff;font-size:9px;font-weight:750}
.sg-background-card-copy{padding:8px 3px 4px}.sg-background-card-copy h4{font-size:13px;line-height:1.2;color:#26352B;margin:5px 0 3px}.sg-background-card-copy p{font-size:10px;line-height:1.35;color:#8D978F;margin:0;min-height:27px;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.sg-background-rarity{display:inline-flex;border-radius:9px;padding:2px 6px;font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.45px;color:#667269;background:#EEF2EC}.sg-background-rarity--common{color:#4F715D;background:#EAF3EC}.sg-background-rarity--rare{color:#3A6F83;background:#E7F4F7}.sg-background-rarity--epic{color:#73549A;background:#F0E9F8}.sg-background-rarity--mythical{color:#9A672B;background:#FFF1D8}.sg-background-rarity--default{color:#55715C;background:#EAF3E9}
.sg-background-card-meta{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:2px 3px 3px;min-height:34px}.sg-background-cost{font-size:10.5px;font-weight:800;color:#B8860B}.sg-background-free{font-size:10px;font-weight:800;color:#2D6A4F;background:#E8F5EE;border-radius:10px;padding:3px 7px}.sg-background-equipped{font-size:10px;font-weight:800;color:#2D6A4F;background:#E8F5EE;border:1px solid #CBE3D2;border-radius:11px;padding:5px 8px;white-space:nowrap}.sg-background-card-action{min-height:34px;border:0;border-radius:11px;background:#2D6A4F;color:#fff;padding:6px 10px;font-size:10px;font-weight:750;cursor:pointer}.sg-background-card-action:disabled{background:#C8CECA;color:#fff;cursor:not-allowed}
.sg-background-done{display:block;width:100%;margin-top:14px;border:0;border-radius:14px;background:#F0F2EE;color:#59665C;padding:11px;font-size:13px;font-weight:700;cursor:pointer}
.sg-background-preview{position:fixed;inset:0;z-index:390;overflow:hidden;display:flex;align-items:flex-end;justify-content:center;padding:max(18px,env(safe-area-inset-top)) 16px max(18px,env(safe-area-inset-bottom));isolation:isolate}
.sg-background-preview>.sg-background-art{z-index:-2}.sg-background-preview-shade{position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(7,12,9,.04),rgba(7,12,9,.1) 50%,rgba(7,12,9,.46))}
.sg-background-preview-badge{position:absolute;top:max(18px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);border:1px solid rgba(255,255,255,.6);border-radius:18px;background:rgba(20,29,23,.5);backdrop-filter:blur(8px);color:#fff;padding:7px 12px;font-size:10px;font-weight:850;letter-spacing:1.4px}
.sg-background-preview-panel{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;width:min(100%,720px);padding:18px;border:1px solid rgba(255,255,255,.58);border-radius:20px;background:rgba(250,252,249,.88);backdrop-filter:blur(14px);box-shadow:0 14px 45px rgba(9,18,12,.25);color:#223128}
.sg-background-preview-copy h3{font-size:22px;margin:6px 0 4px}.sg-background-preview-copy p{font-size:12.5px;line-height:1.45;color:#627068;margin:0;max-width:420px}.sg-background-preview-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}.sg-background-secondary-btn,.sg-background-primary-btn{min-height:42px;border-radius:13px;padding:9px 15px;font-size:12px;font-weight:750;cursor:pointer}.sg-background-secondary-btn{border:1px solid #D8E1D7;background:#fff;color:#647168}.sg-background-primary-btn{border:0;background:#2D6A4F;color:#fff}.sg-background-primary-btn:disabled{background:#AAB5AE}
.sg-background-shop button:focus-visible,.sg-background-preview button:focus-visible{outline:3px solid rgba(86,182,139,.34);outline-offset:2px}
@media(max-width:600px){.sg-shell{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}.sg-bg-photo img{object-position:var(--sg-bg-photo-position-mobile,center center);filter:saturate(.8) contrast(.9)}.sg-background-art--full .sg-bg-dots i:nth-child(n+7),.sg-background-art--full .sg-bg-cloud--three,.sg-background-art--full .sg-bg-aurora--three,.sg-background-art--full .sg-bg-shelf--right,.sg-background-art--full .sg-bg-rain-sheet--far i:nth-child(n+13),.sg-background-art--full .sg-bg-rain-sheet--near i:nth-child(n+19),.sg-background-art--full .sg-bg-rain-trails i:nth-child(n+6),.sg-background-art--full .sg-bg-ocean-bubbles i:nth-child(n+8){display:none}.sg-background-art--full .sg-bg-vignette{box-shadow:inset 0 0 65px rgba(30,45,35,.1)}.sg-bg-classroom-shelf{opacity:.42}.sg-bg-classroom-desk--one{left:-2%}.sg-bg-classroom-desk--three{right:-2%}.sg-background-preview-panel{align-items:stretch;flex-direction:column;gap:13px;padding:15px}.sg-background-preview-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.sg-background-preview-actions>.sg-background-equipped{display:grid;place-items:center;min-height:42px}.sg-background-preview-copy h3{font-size:19px}}
@media(max-width:370px){.sg-background-grid{grid-template-columns:minmax(0,1fr)}.sg-shop-category-tab{font-size:9.5px}.sg-background-thumb{height:110px}}
html[data-animation-disabled="true"] .sg-background-art *{animation:none!important;transition:none!important}
html[data-animation-disabled="true"] .sg-background-art--focus{filter:saturate(.82) contrast(.94)}
`;
