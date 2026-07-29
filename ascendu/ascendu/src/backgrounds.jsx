import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

export const DEFAULT_BACKGROUND_ID = "classic-grove";

export const BACKGROUND_CATALOGUE = Object.freeze([
  {
    id: DEFAULT_BACKGROUND_ID,
    name: "Classic Grove",
    cost: 0,
    rarity: "Default",
    art: "classic",
    tone: "light",
    motion: "none",
    description: "Lumora’s calm original cream canvas.",
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
    name: "Midnight Minimal",
    cost: 220,
    rarity: "Common",
    art: "midnight",
    tone: "dark",
    motion: "none",
    description: "A near-black, distraction-free canvas with a quiet grove tint.",
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
    id: "forest-dawn",
    name: "Forest Dawn",
    cost: 260,
    rarity: "Common",
    art: "forest",
    tone: "light",
    motion: "low",
    description: "Pale woodland layers warmed by first light.",
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
    id: "cloud-classroom",
    name: "Cloud Classroom",
    cost: 320,
    rarity: "Common",
    art: "clouds",
    tone: "light",
    motion: "low",
    description: "Open blue skies and slow, weightless clouds.",
    baseColor: "#DCEEF5",
    gradient: "linear-gradient(165deg,#F7FCFF 0%,#DCEEF5 55%,#C2DDEB 100%)",
    shellSurface: "linear-gradient(180deg,rgba(248,252,252,.62),rgba(234,246,249,.52))",
    focusSurface: "rgba(242,248,248,.87)",
    uiAccent: "#79AFC2",
    uiAccentSoft: "rgba(121,175,194,.18)",
    darkPalette: {
      tone: "dark",
      baseColor: "#101D2A",
      gradient: "linear-gradient(165deg,#2D4051 0%,#142533 55%,#09111A 100%)",
      shellSurface: "linear-gradient(180deg,rgba(243,248,250,.71),rgba(228,238,243,.62))",
      focusSurface: "rgba(236,243,246,.9)",
      uiAccent: "#74A6BC",
      uiAccentSoft: "rgba(116,166,188,.2)",
    },
  },
  {
    id: "cherry-blossom-sky",
    name: "Cherry Blossom Sky",
    cost: 500,
    rarity: "Rare",
    art: "blossom",
    tone: "light",
    motion: "medium",
    description: "A pale rose sky with restrained drifting petals.",
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
    id: "rainy-window",
    name: "Rainy Window",
    cost: 520,
    rarity: "Rare",
    art: "rain",
    tone: "cool",
    motion: "medium",
    description: "Cool window light and a quiet, steady shower.",
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
    id: "golden-sunset",
    name: "Golden Sunset",
    cost: 580,
    rarity: "Rare",
    art: "sunset",
    tone: "warm",
    motion: "low",
    description: "Peach horizons and a soft amber afterglow.",
    baseColor: "#F4CDA8",
    gradient: "linear-gradient(165deg,#FFF0CF 0%,#F4C3A5 48%,#C88E83 100%)",
    shellSurface: "linear-gradient(180deg,rgba(253,249,242,.64),rgba(249,232,218,.54))",
    focusSurface: "rgba(248,242,237,.87)",
    uiAccent: "#C58A68",
    uiAccentSoft: "rgba(197,138,104,.18)",
    darkPalette: {
      tone: "dark",
      baseColor: "#281721",
      gradient: "linear-gradient(165deg,#50313D 0%,#291821 50%,#100A11 100%)",
      shellSurface: "linear-gradient(180deg,rgba(250,245,240,.71),rgba(241,230,223,.62))",
      focusSurface: "rgba(246,239,234,.9)",
      uiAccent: "#C18569",
      uiAccentSoft: "rgba(193,133,105,.2)",
    },
  },
  {
    id: "library-study",
    name: "Library Study",
    cost: 650,
    rarity: "Rare",
    art: "library",
    tone: "warm",
    motion: "none",
    description: "A refined reading room with warm shelves and lamplight.",
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
    id: "moonlit-grove",
    name: "Moonlit Grove",
    cost: 780,
    rarity: "Epic",
    art: "moonlit",
    tone: "dark",
    motion: "low",
    description: "Deep navy woods beneath a restrained moon glow.",
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
    id: "aurora-night",
    name: "Aurora Night",
    cost: 1050,
    rarity: "Epic",
    art: "aurora",
    tone: "dark",
    motion: "medium",
    description: "Muted ribbons of colour across a midnight sky.",
    baseColor: "#101D38",
    gradient: "linear-gradient(160deg,#182D50 0%,#101D38 58%,#091225 100%)",
    shellSurface: "linear-gradient(180deg,rgba(243,249,248,.72),rgba(226,238,241,.63))",
    focusSurface: "rgba(233,241,243,.89)",
    uiAccent: "#638CA3",
    uiAccentSoft: "rgba(99,140,163,.18)",
    darkPalette: {
      tone: "dark",
      baseColor: "#060C19",
      gradient: "linear-gradient(160deg,#12223E 0%,#081326 58%,#030711 100%)",
      shellSurface: "linear-gradient(180deg,rgba(242,248,248,.74),rgba(226,236,241,.65))",
      focusSurface: "rgba(234,241,244,.92)",
      uiAccent: "#6C98AB",
      uiAccentSoft: "rgba(108,152,171,.2)",
    },
  },
  {
    id: "celestial-garden",
    name: "Celestial Garden",
    cost: 1400,
    rarity: "Mythical",
    art: "celestial",
    tone: "dark",
    motion: "medium",
    description: "Indigo gardens, orbiting motifs and quiet starlight.",
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
]);

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
  return isValidBackgroundId(backgroundId) ? backgroundId : DEFAULT_BACKGROUND_ID;
}

export function normalizeOwnedBackgrounds(value) {
  const ids = Array.isArray(value) ? value.filter(isValidBackgroundId) : [];
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
        <span className="sg-bg-moon"/><AmbientDots className="sg-bg-stars" count={10}/>
        <div className="sg-bg-forest sg-bg-forest--moon-far"/><div className="sg-bg-forest sg-bg-forest--moon-near"/>
        <div className="sg-bg-mist sg-bg-mist--one"/><div className="sg-bg-mist sg-bg-mist--two"/>
      </>;
    case "blossom":
      return <>
        <div className="sg-bg-branch sg-bg-branch--left"/><div className="sg-bg-branch sg-bg-branch--right"/>
        <AmbientDots className="sg-bg-petals" count={10}/>
      </>;
    case "rain":
      return <>
        <div className="sg-bg-window-grid"/><AmbientDots className="sg-bg-raindrops" count={12}/>
        <div className="sg-bg-rain-glow"/>
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
    case "celestial":
      return <>
        <span className="sg-bg-celestial-moon"/><span className="sg-bg-orbit sg-bg-orbit--one"/>
        <span className="sg-bg-orbit sg-bg-orbit--two"/><AmbientDots className="sg-bg-celestial-stars" count={12}/>
        <div className="sg-bg-celestial-garden"/>
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
      <div className="sg-bg-wash"/>
      <BackgroundDecor art={background.art}/>
      <div className="sg-bg-vignette"/>
    </div>
  );
}

export function BackgroundLayer({ backgroundId, theme = "light", focusMode = false }) {
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
    paused={hidden}
    lowPower={lowPower}
    className="sg-keepcolor"
  />;
  return typeof document!=="undefined"?createPortal(artwork,document.body):artwork;
}

export function ShopCategoryTabs({ active, onTrees, onDecorations, onBackgrounds }) {
  const items = [
    ["trees", "🌿", "Tree Skins", onTrees],
    ["decorations", "🏡", "Decorations", onDecorations],
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
  const [filter, setFilter] = useState("all");
  const [previewId, setPreviewId] = useState(null);
  const [toast, setToast] = useState("");
  const [busyId, setBusyId] = useState("");
  const items = filter === "owned"
    ? BACKGROUND_CATALOGUE.filter(item => ownedIds.includes(item.id))
    : BACKGROUND_CATALOGUE;

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

      <div className="sg-background-filter-row" role="group" aria-label="Background filter">
        <button type="button" className={filter === "all" ? "is-active" : ""} onClick={() => setFilter("all")}>All</button>
        <button type="button" className={filter === "owned" ? "is-active" : ""} onClick={() => setFilter("owned")}>Owned</button>
        {activeBackground !== DEFAULT_BACKGROUND_ID &&
          <button type="button" className="sg-background-use-default" onClick={() => equip(DEFAULT_BACKGROUND_ID)}>Use Default</button>}
      </div>

      {toast && <div className="sg-background-toast" role="status">{toast}</div>}

      <div className="sg-background-grid">
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
      </div>
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
.sg-bg-moon{position:absolute;right:13%;top:8%;width:clamp(72px,10vw,140px);aspect-ratio:1;border-radius:50%;background:#E8F2F7;box-shadow:0 0 48px rgba(197,224,244,.45)}
.sg-bg-moon::after{content:"";position:absolute;left:30%;top:-5%;width:92%;height:92%;border-radius:50%;background:#243650}
.sg-bg-stars i,.sg-bg-celestial-stars i{width:4px;height:4px;background:#F4F5D5;box-shadow:0 0 7px rgba(235,241,214,.72);animation:sgBgTwinkle 8s ease-in-out var(--sg-bg-dot-delay) infinite}
.sg-bg-forest--moon-far{background:rgba(58,83,105,.48);transform:translateY(-11%) scale(1.05)}
.sg-bg-forest--moon-near{background:rgba(20,43,52,.62)}
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
.sg-bg-window-grid{position:absolute;inset:6%;border:3px solid rgba(238,245,246,.2);background:linear-gradient(90deg,transparent 49.6%,rgba(240,247,248,.16) 49.8% 50.2%,transparent 50.4%),linear-gradient(transparent 49.6%,rgba(240,247,248,.16) 49.8% 50.2%,transparent 50.4%);box-shadow:0 16px 46px rgba(38,58,69,.18)}
.sg-bg-raindrops i{width:2px;height:48px;border-radius:2px;background:linear-gradient(transparent,rgba(232,243,247,.58));animation:sgBgRain 2.8s linear var(--sg-bg-dot-delay) infinite}
.sg-bg-rain-glow{background:radial-gradient(circle at 75% 20%,rgba(242,248,246,.25),transparent 28%)}
[data-background-mode="dark"][data-background-art="rain"] .sg-bg-window-grid{border-color:rgba(205,225,234,.12);box-shadow:0 16px 50px rgba(0,0,0,.28)}
[data-background-mode="dark"][data-background-art="rain"] .sg-bg-rain-glow{background:radial-gradient(circle at 75% 20%,rgba(183,210,221,.13),transparent 30%)}
[data-background-mode="dark"][data-background-art="rain"] .sg-bg-raindrops i{opacity:.34}
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
.sg-bg-celestial-moon{position:absolute;left:12%;top:9%;width:clamp(60px,9vw,126px);aspect-ratio:1;border-radius:50%;border:clamp(6px,.8vw,12px) solid rgba(229,226,191,.68);box-shadow:0 0 35px rgba(216,217,192,.26)}
.sg-bg-orbit{position:absolute;right:10%;top:10%;width:clamp(170px,28vw,390px);aspect-ratio:1;border:1px solid rgba(197,195,231,.18);border-radius:50%;animation:sgBgOrbit 42s linear infinite}
.sg-bg-orbit::after{content:"";position:absolute;width:10px;height:10px;border-radius:50%;background:#E5D89D;left:18%;top:8%;box-shadow:0 0 12px rgba(232,217,157,.5)}
.sg-bg-orbit--two{right:16%;top:17%;transform:scale(.62);animation-direction:reverse;animation-duration:34s}
.sg-bg-celestial-garden{position:absolute;left:-5%;right:-5%;bottom:-3%;height:35%;opacity:.36;background:radial-gradient(ellipse at 15% 100%,#62648D 0 19%,transparent 20%),radial-gradient(ellipse at 38% 100%,#4F537B 0 24%,transparent 25%),radial-gradient(ellipse at 70% 100%,#64678E 0 21%,transparent 22%),radial-gradient(ellipse at 92% 100%,#4B5179 0 24%,transparent 25%)}
[data-background-mode="dark"][data-background-art="moonlit"] .sg-bg-moon,
[data-background-mode="dark"][data-background-art="aurora"] .sg-bg-stars,
[data-background-mode="dark"][data-background-art="celestial"] .sg-bg-celestial-moon{opacity:.78}
[data-background-mode="dark"][data-background-art="aurora"] .sg-bg-aurora{filter:blur(21px);opacity:.18}
[data-background-mode="dark"][data-background-art="celestial"] .sg-bg-celestial-garden{opacity:.25}
@keyframes sgBgFloat{0%,100%{transform:translate3d(0,4px,0) scale(var(--sg-bg-dot-scale,.5));opacity:.2}50%{transform:translate3d(7px,-10px,0) scale(var(--sg-bg-dot-scale,.5));opacity:.62}}
@keyframes sgBgTwinkle{0%,100%{opacity:.18}48%{opacity:.72}62%{opacity:.34}}
@keyframes sgBgMist{0%,100%{transform:translate3d(-3%,0,0)}50%{transform:translate3d(7%,4px,0)}}
@keyframes sgBgPetal{0%{transform:translate3d(-10px,-16px,0) rotate(0);opacity:0}12%{opacity:.48}100%{transform:translate3d(42px,120px,0) rotate(260deg);opacity:0}}
@keyframes sgBgRain{0%{transform:translate3d(-8px,-70px,0);opacity:0}18%{opacity:.6}100%{transform:translate3d(26px,150px,0);opacity:0}}
@keyframes sgBgCloud{0%,100%{translate:-8px 0}50%{translate:18px -3px}}
@keyframes sgBgAurora{0%,100%{transform:skewX(-6deg) scaleY(.9);opacity:.14}50%{transform:skewX(7deg) scaleY(1.12);opacity:.28}}
@keyframes sgBgOrbit{to{transform:rotate(360deg)}}
.sg-background-art--focus .sg-bg-petals i,
.sg-background-art--focus .sg-bg-raindrops i,
.sg-background-art--focus .sg-bg-dots i { animation-duration:36s!important;opacity:.22 }
.sg-background-art--focus .sg-bg-aurora,
.sg-background-art--focus .sg-bg-cloud,
.sg-background-art--focus .sg-bg-mist { animation-duration:60s!important;opacity:.12 }
.sg-background-art--focus { filter:saturate(.72) contrast(.9); }
[data-theme="dark"] .sg-shell .sg-background-art--focus.sg-keepcolor {
  filter:invert(1) hue-rotate(180deg) saturate(.72) contrast(.9);
}
.sg-background-art--paused *,
.sg-background-art--low-power .sg-bg-dots i,
.sg-background-art--low-power .sg-bg-aurora,
.sg-background-art--low-power .sg-bg-cloud,
.sg-background-art--low-power .sg-bg-mist,
.sg-background-art--low-power .sg-bg-orbit { animation-play-state:paused!important; }
.sg-shop-category-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4;padding:4;margin:0 0 11px;background:#EEF3EB;border-radius:13px}
.sg-shop-category-tab{min-width:0;min-height:40px;border:0;border-radius:10px;background:transparent;color:#7C887E;padding:8px 5px;font-size:10.5px;font-weight:700;cursor:pointer;display:flex;gap:4px;align-items:center;justify-content:center;white-space:nowrap}
.sg-shop-category-tab--active{color:#2D6A4F;background:#fff;box-shadow:0 1px 4px rgba(35,58,42,.1)}
.sg-background-shop-overlay{position:fixed;inset:0;z-index:300;background:rgba(8,18,12,.5);display:flex;align-items:flex-end;justify-content:center;overflow:hidden}
.sg-background-shop{position:relative;width:100%;max-width:460px;max-height:min(88dvh,88vh);overflow:auto;overscroll-behavior:contain;background:#fff;border-radius:26px 26px 0 0;padding:22px max(14px,env(safe-area-inset-right)) max(34px,calc(env(safe-area-inset-bottom) + 18px)) max(14px,env(safe-area-inset-left))}
.sg-background-shop-header{position:sticky;top:-22px;z-index:8;display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin:-22px 0 10px;padding:22px 0 10px;background:linear-gradient(180deg,#fff 82%,rgba(255,255,255,.95))}
.sg-background-shop-heading{display:flex;align-items:center;gap:8px;min-width:0}.sg-background-shop-heading h3{font-size:18px;color:#1A1A2E;margin:0}.sg-background-shop-heading p{font-size:11.5px;color:#98A39A;font-weight:600;margin:2px 0 0}
.sg-background-round-btn{width:32px;height:32px;border:0;border-radius:50%;background:#F0F2EE;color:#666;font-size:17px;cursor:pointer}
.sg-background-coin-balance{flex-shrink:0;font-size:14px;font-weight:700;color:#B8860B;background:#FFF8E7;border:1px solid #F0D060;border-radius:20px;padding:5px 10px}
.sg-background-filter-row{display:flex;gap:6;align-items:center;margin-bottom:10px}.sg-background-filter-row button{min-height:34px;border:1px solid #DFE7DC;border-radius:18px;background:#F7F9F5;color:#718075;padding:6px 11px;font-size:11px;font-weight:700;cursor:pointer}.sg-background-filter-row button.is-active{color:#2D6A4F;background:#E9F4EA;border-color:#BFD8C2}.sg-background-filter-row .sg-background-use-default{margin-left:auto;color:#53685A;background:#fff}
.sg-background-toast{position:sticky;top:54px;z-index:10;background:#20352A;color:#fff;border-radius:12px;padding:9px 12px;margin-bottom:10px;text-align:center;font-size:11.5px;font-weight:650;box-shadow:0 5px 18px rgba(20,40,28,.16)}
.sg-background-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.sg-background-card{min-width:0;overflow:hidden;border:1.5px solid #E4EAE1;border-radius:16px;background:#fff;padding:7px;box-shadow:0 2px 7px rgba(29,49,35,.045);content-visibility:auto;contain-intrinsic-size:190px}
.sg-background-card--active{border-color:#75B98E;box-shadow:0 0 0 2px rgba(86,182,139,.11)}
.sg-background-thumb{position:relative;display:block;width:100%;height:96px;overflow:hidden;border:0;border-radius:12px;padding:0;background:#EEF3EB;cursor:pointer}
.sg-background-thumb>span{position:absolute;right:7px;bottom:7px;padding:4px 7px;border-radius:10px;background:rgba(20,32,24,.63);backdrop-filter:blur(5px);color:#fff;font-size:9px;font-weight:750}
.sg-background-card-copy{padding:8px 3px 4px}.sg-background-card-copy h4{font-size:13px;line-height:1.2;color:#26352B;margin:5px 0 3px}.sg-background-card-copy p{font-size:10px;line-height:1.35;color:#8D978F;margin:0;min-height:27px;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.sg-background-rarity{display:inline-flex;border-radius:9px;padding:2px 6px;font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.45px;color:#667269;background:#EEF2EC}.sg-background-rarity--rare{color:#3A6F83;background:#E7F4F7}.sg-background-rarity--epic{color:#73549A;background:#F0E9F8}.sg-background-rarity--mythical{color:#9A672B;background:#FFF1D8}.sg-background-rarity--default{color:#55715C;background:#EAF3E9}
.sg-background-card-meta{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:2px 3px 3px;min-height:34px}.sg-background-cost{font-size:10.5px;font-weight:800;color:#B8860B}.sg-background-free{font-size:10px;font-weight:800;color:#2D6A4F;background:#E8F5EE;border-radius:10px;padding:3px 7px}.sg-background-equipped{font-size:10px;font-weight:800;color:#2D6A4F;background:#E8F5EE;border:1px solid #CBE3D2;border-radius:11px;padding:5px 8px;white-space:nowrap}.sg-background-card-action{min-height:34px;border:0;border-radius:11px;background:#2D6A4F;color:#fff;padding:6px 10px;font-size:10px;font-weight:750;cursor:pointer}.sg-background-card-action:disabled{background:#C8CECA;color:#fff;cursor:not-allowed}
.sg-background-done{display:block;width:100%;margin-top:14px;border:0;border-radius:14px;background:#F0F2EE;color:#59665C;padding:11px;font-size:13px;font-weight:700;cursor:pointer}
.sg-background-preview{position:fixed;inset:0;z-index:390;overflow:hidden;display:flex;align-items:flex-end;justify-content:center;padding:max(18px,env(safe-area-inset-top)) 16px max(18px,env(safe-area-inset-bottom));isolation:isolate}
.sg-background-preview>.sg-background-art{z-index:-2}.sg-background-preview-shade{position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(7,12,9,.04),rgba(7,12,9,.1) 50%,rgba(7,12,9,.46))}
.sg-background-preview-badge{position:absolute;top:max(18px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);border:1px solid rgba(255,255,255,.6);border-radius:18px;background:rgba(20,29,23,.5);backdrop-filter:blur(8px);color:#fff;padding:7px 12px;font-size:10px;font-weight:850;letter-spacing:1.4px}
.sg-background-preview-panel{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;width:min(100%,720px);padding:18px;border:1px solid rgba(255,255,255,.58);border-radius:20px;background:rgba(250,252,249,.88);backdrop-filter:blur(14px);box-shadow:0 14px 45px rgba(9,18,12,.25);color:#223128}
.sg-background-preview-copy h3{font-size:22px;margin:6px 0 4px}.sg-background-preview-copy p{font-size:12.5px;line-height:1.45;color:#627068;margin:0;max-width:420px}.sg-background-preview-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}.sg-background-secondary-btn,.sg-background-primary-btn{min-height:42px;border-radius:13px;padding:9px 15px;font-size:12px;font-weight:750;cursor:pointer}.sg-background-secondary-btn{border:1px solid #D8E1D7;background:#fff;color:#647168}.sg-background-primary-btn{border:0;background:#2D6A4F;color:#fff}.sg-background-primary-btn:disabled{background:#AAB5AE}
.sg-background-shop button:focus-visible,.sg-background-preview button:focus-visible{outline:3px solid rgba(86,182,139,.34);outline-offset:2px}
@media(max-width:600px){.sg-shell{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}.sg-background-art--full .sg-bg-dots i:nth-child(n+7),.sg-background-art--full .sg-bg-cloud--three,.sg-background-art--full .sg-bg-aurora--three,.sg-background-art--full .sg-bg-shelf--right{display:none}.sg-background-art--full .sg-bg-vignette{box-shadow:inset 0 0 65px rgba(30,45,35,.1)}.sg-background-preview-panel{align-items:stretch;flex-direction:column;gap:13px;padding:15px}.sg-background-preview-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.sg-background-preview-actions>.sg-background-equipped{display:grid;place-items:center;min-height:42px}.sg-background-preview-copy h3{font-size:19px}}
@media(max-width:370px){.sg-background-grid{grid-template-columns:minmax(0,1fr)}.sg-shop-category-tab{font-size:9.5px}.sg-background-thumb{height:110px}}
@media(prefers-reduced-motion:reduce){.sg-background-art *{animation:none!important;transition:none!important}.sg-background-art--focus{filter:saturate(.82) contrast(.94)}}
`;
