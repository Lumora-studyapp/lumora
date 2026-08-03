import { memo, useId } from "react";
import {
  BOTTOMS, CHARACTER_ACTIVITIES, CHARACTER_VIEWS, DEFAULT_CHARACTER_STYLE,
  HAIRSTYLES, SHOES, TOPS, normalizeCharacterBase, normalizeCharacterStyle, optionById,
} from "./characterDefinitions.js";
import { ACCESSORIES, AURAS, DESK_THEMES, legacyThemeForSkin } from "./characterAccessories.js";
import { HAIR_COLOURS, SKIN_TONES, findPaletteItem } from "./characterPalettes.js";
import { CHARACTER_STAGES, normalizeCharacterStage } from "./characterStages.js";
import "./characterAnimations.css";

function Hair({ style, colour, view }) {
  const back = view === "back-three-quarter";
  const side = view === "side";
  const xShift = side ? 3 : back ? -2 : 0;
  const common = { fill: colour.value, stroke: "#26303A", strokeWidth: 1.8, strokeLinejoin: "round" };
  const highlight = { fill: "none", stroke: colour.highlight, strokeWidth: 2.2, strokeLinecap: "round", opacity: .7 };
  if (style.id === "soft-bun") return <g transform={`translate(${xShift} 0)`}>
    <circle cx="72" cy="33" r="15" {...common}/><path d="M42 59C41 30 54 17 75 20c20 3 26 20 20 42-12-9-37-9-53-3Z" {...common}/>
    <path d="M53 36c12-10 25-11 35-3" {...highlight}/><path className="lc-hair-secondary" d="M45 49c-4 19 0 29 7 37-2-14 1-23 7-32Z" {...common}/>
  </g>;
  if (style.id === "braided") return <g transform={`translate(${xShift} 0)`}>
    <path d="M42 59C41 31 54 18 74 20c20 2 27 19 21 41-16-9-36-10-53-2Z" {...common}/>
    <path className="lc-hair-secondary" d="M91 50c11 12 10 27 5 39 7 5 7 12 1 17-7 5-14-1-12-8 5-15 1-28-5-38Z" {...common}/>
    <path d="M55 35c11-7 22-7 32-1" {...highlight}/>
  </g>;
  if (style.id === "long-straight") return <g transform={`translate(${xShift} 0)`}>
    <path className="lc-hair-secondary" d="M41 55c-4 29-1 57 8 75l17-9-4-58 26-1-3 60 17 8c8-24 8-51-6-79Z" {...common}/>
    <path d="M41 59C41 31 54 18 74 20c20 2 27 19 22 42-12-8-39-10-55-3Z" {...common}/><path d="M54 34c13-7 25-6 34 2" {...highlight}/>
  </g>;
  if (style.id === "short-bob") return <g transform={`translate(${xShift} 0)`}>
    <path d="M40 58C41 30 55 18 75 20c23 2 28 22 20 50l-12 6-7-19-18 1-5 18-13-8Z" {...common}/>
    <path d="M53 35c13-9 26-7 35 2" {...highlight}/>
  </g>;
  if (style.id === "soft-curly") return <g transform={`translate(${xShift} 0)`}>
    <path d="M40 60c-6-25 11-43 34-42 25 0 35 20 25 45l-10-2-6-9-31 11Z" {...common}/>
    {[48,58,70,82,92].map((x,i)=><circle key={x} cx={x} cy={i%2?29:35} r="10" {...common}/>) }
    <path className="lc-hair-secondary" d="M43 48c-8 8-6 22 5 27 7-7 8-18 3-26Z" {...common}/>
  </g>;
  if (style.id === "side-parted") return <g transform={`translate(${xShift} 0)`}>
    <path d="M42 59C41 31 55 19 74 20c22 1 29 17 23 40-12-10-27-13-47-7Z" {...common}/>
    <path d="M49 49c17-1 27-8 35-19" {...highlight}/><path d="M83 29c8 4 13 10 14 20" {...highlight}/>
  </g>;
  if (style.id === "short-textured") return <g transform={`translate(${xShift} 0)`}>
    <path d="M43 56c-2-18 6-31 18-36l5 7 7-10 7 9 9-7 1 10 9-2-3 15 5 6-5 14c-14-10-36-11-53-6Z" {...common}/>
    <path d="M55 35l7-5m8 5 7-7m6 10 7-5" {...highlight}/>
  </g>;
  return <g transform={`translate(${xShift} 0)`}>
    <path d="M40 58c-2-24 12-40 34-40 23 0 34 18 24 44-12-8-19-14-25-20-7 9-18 14-33 16Z" {...common}/>
    <path className="lc-hair-secondary" d="M44 47c-8 12-5 23 5 29 5-7 7-16 3-26Z" {...common}/><path d="M54 34c11-9 25-9 36 0" {...highlight}/>
  </g>;
}

function Face({ base, skin, accessory, view }) {
  const back = view === "back-three-quarter";
  const side = view === "side";
  const facePath=base==="male"
    ? "M48 49c0-17 11-27 27-27 17 0 27 11 27 28v14c0 19-11 33-27 33S48 83 48 64Z"
    : "M48 49c0-17 11-27 27-27 17 0 27 11 27 28v14c0 20-12 33-27 33S48 84 48 64Z";
  if (back) return <path d={facePath} fill={skin.value} stroke="#26303A" strokeWidth="1.8"/>;
  return <g>
    <path d={facePath} fill={skin.value} stroke="#26303A" strokeWidth="1.8"/>
    <path d="M76 56c-1 8-2 13-1 17 2 1 4 1 6 0" fill="none" stroke={skin.shade} strokeWidth="1.4" strokeLinecap="round"/>
    <g className="lc-eye" fill="#26303A">
      {!side&&<><ellipse cx="61" cy="56" rx={base==="male"?3.1:3.3} ry="2.4"/><ellipse cx="89" cy="56" rx={base==="male"?3.1:3.3} ry="2.4"/></>}
      {side&&<ellipse cx="87" cy="56" rx="3.4" ry="2.5"/>}
    </g>
    {!side&&<><path d="M57 49c3-2 7-2 10 0M84 49c3-2 7-2 10 0" fill="none" stroke="#37404A" strokeWidth="1.7" strokeLinecap="round"/>
      <path d="M67 82c5 4 12 4 17 0" fill="none" stroke="#9B4F53" strokeWidth="1.7" strokeLinecap="round"/></>}
    {side&&<path d="M84 81c4 2 8 1 10-1" fill="none" stroke="#9B4F53" strokeWidth="1.7" strokeLinecap="round"/>}
    {(accessory.id === "round-glasses" || accessory.id === "square-glasses")&&<g fill="none" stroke="#40586A" strokeWidth="1.8">
      <rect x="52" y="49" width="18" height="13" rx={accessory.id === "round-glasses" ? 7 : 3}/><rect x="81" y="49" width="18" height="13" rx={accessory.id === "round-glasses" ? 7 : 3}/><path d="M70 54h11"/>
    </g>}
  </g>;
}

function StandingBody({ base, skin, top, bottom, shoes, activity, stage }) {
  const skirt = bottom.id.includes("skirt");
  const celebrate = activity === "complete";
  return <g className="lc-breathe">
    <path d="M65 91h20v18H65Z" fill={skin.value} stroke="#26303A" strokeWidth="1.7"/>
    <path d="M50 105Q75 95 100 105l7 68H43Z" fill={top.main} stroke="#26303A" strokeWidth="2"/>
    <path d="M57 104 75 123l18-19" fill={top.light} stroke="#26303A" strokeWidth="1.5"/>
    <path d="M75 123v49M58 117l5 46M92 117l-5 46" fill="none" stroke={top.trim} strokeWidth="2" opacity=".65"/>
    {stage >= 2&&<path className="lc-detail" d="M69 133h13v12H69Z" fill="#F8F4E9" stroke="#4E5963" strokeWidth="1.2"/>}
    <g className={activity === "break" ? "lc-break-arm" : ""}>
      <path d={celebrate?"M49 111 32 128 19 103":"M49 111 35 151 39 177"} fill="none" stroke={top.main} strokeWidth="14" strokeLinecap="round"/>
      <path d={celebrate?"M19 103 17 88":"M39 177 40 190"} fill="none" stroke={skin.value} strokeWidth="11" strokeLinecap="round"/>
    </g>
    <path d="M101 111 113 151 109 184" fill="none" stroke={top.main} strokeWidth="14" strokeLinecap="round"/>
    <path d="M109 184v8" fill="none" stroke={skin.value} strokeWidth="11" strokeLinecap="round"/>
    {skirt?<path d="M47 170h56l12 54H36Z" fill={bottom.main} stroke="#26303A" strokeWidth="2"/>:<path d="M46 169h58l-5 69H78l-3-48-3 48H51Z" fill={bottom.main} stroke="#26303A" strokeWidth="2"/>}
    <path d="M52 235v46M97 235v46" stroke={skirt?skin.value:bottom.main} strokeWidth="17" strokeLinecap="round"/>
    <path d="M43 279c8-5 18-6 26 0v12H39c-3-4-1-9 4-12Zm38 0c8-5 18-6 26 0 4 3 5 8 2 12H81Z" fill={shoes.main} stroke="#26303A" strokeWidth="1.8"/>
    <path d="M40 287h29m12 0h29" stroke={shoes.sole} strokeWidth="4" strokeLinecap="round"/>
  </g>;
}

function Desk({ desk, stage }) {
  return <g className="lc-desk">
    <ellipse cx="80" cy="282" rx="65" ry="9" fill="rgba(28,44,57,.16)"/>
    <path d="M14 184h133v18H14Z" fill={desk.top} stroke="#263744" strokeWidth="2"/>
    <path d="M18 201h9l7 77h-8Zm115 0h9l-8 77h-8Z" fill={desk.metal} stroke="#263744" strokeWidth="1.7"/>
    <path d="M53 176c16-5 33-5 50 0v13H53Z" fill="#FFFDF4" stroke="#506170" strokeWidth="1.4"/>
    <path className="lc-page" d="M79 177c10-3 18-3 24 0v12H79Z" fill="#EAF4EF" stroke="#8BA39A" strokeWidth=".8"/>
    {stage >= 2&&<g className="lc-detail"><path d="M20 174h28v9H20Z" fill="#657E9F" stroke="#334655"/><path d="M24 168h24v7H24Z" fill="#D98172" stroke="#6E4641"/><path d="M116 170h5v15h-5Z" fill="#E1B34B"/></g>}
    {stage >= 3&&<g className="lc-detail"><path d="M126 147h4v38h-4Z" fill={desk.metal}/><path d="M117 147h22l-4-9h-14Z" fill="#F0C968" stroke="#756535"/><circle cx="128" cy="151" r="11" fill="#FFEAA3" opacity=".3"/></g>}
  </g>;
}

function SeatedBody({ skin, top, bottom, activity, stage }) {
  return <g>
    <path d="M64 91h20v16H64Z" fill={skin.value} stroke="#26303A" strokeWidth="1.7"/>
    <g className="lc-breathe"><path d="M50 104q24-10 49 0l7 61H45Z" fill={top.main} stroke="#26303A" strokeWidth="2"/><path d="M58 103 74 119l17-16" fill={top.light} stroke="#26303A" strokeWidth="1.5"/>
      <path d="M74 119v44" stroke={top.trim} strokeWidth="2" opacity=".7"/>
      <path d="M50 111 35 151 62 180" fill="none" stroke={top.main} strokeWidth="13" strokeLinecap="round"/><path d="M62 180 76 181" fill="none" stroke={skin.value} strokeWidth="10" strokeLinecap="round"/>
      <g className={activity === "break" ? "lc-break-arm" : "lc-writing-arm"}><path d="M98 111 108 148 91 179" fill="none" stroke={top.main} strokeWidth="13" strokeLinecap="round"/><path d="M91 179 80 184" fill="none" stroke={skin.value} strokeWidth="10" strokeLinecap="round"/></g>
    </g>
    <path d="M48 158h54l3 45-31 8-28-11Z" fill={bottom.main} stroke="#26303A" strokeWidth="2"/>
    <path d="M56 203 48 254m42-47 9 47" fill="none" stroke={bottom.main} strokeWidth="16" strokeLinecap="round"/>
    {stage >= 3&&<path className="lc-detail" d="M51 135h14v12H51Z" fill="#F8F4E9" stroke="#4E5963"/>}
  </g>;
}

function CharacterRendererComponent({
  base="female", characterStyle=DEFAULT_CHARACTER_STYLE, stage=1, legacySkin="default",
  view="front", activity="idle", size=260, motion="full", detail="full",
  className="", title="Lumora student character", decorative=false, style: svgStyle,
}) {
  const uid = useId().replace(/:/g, "");
  const safeBase = normalizeCharacterBase(base);
  const safeStyle = normalizeCharacterStyle(characterStyle, legacySkin);
  const safeView = CHARACTER_VIEWS.includes(view) ? view : "front";
  const safeActivity = CHARACTER_ACTIVITIES.includes(activity) ? activity : "idle";
  const safeStage = normalizeCharacterStage(stage);
  const skin = findPaletteItem(SKIN_TONES, safeStyle.skinTone, "tone-3");
  const hairColour = findPaletteItem(HAIR_COLOURS, safeStyle.hairColour, "dark-brown");
  const hair = optionById(HAIRSTYLES, safeStyle.hairstyle);
  const top = optionById(TOPS, safeStyle.top);
  const bottom = optionById(BOTTOMS, safeStyle.bottom);
  const shoes = optionById(SHOES, safeStyle.shoes);
  const accessory = optionById(ACCESSORIES, safeStyle.accessory);
  const theme = legacyThemeForSkin(legacySkin);
  const aura = optionById(AURAS, legacySkin!=="default" ? theme.aura : safeStyle.aura);
  const desk = optionById(DESK_THEMES, legacySkin!=="default" ? theme.desk : safeStyle.deskTheme);
  const seated = safeView === "seated";
  const turn = safeView === "side" ? "translate(7 0) scale(.94 1)" : safeView === "back-three-quarter" ? "translate(150 0) scale(-1 1)" : safeView === "three-quarter" ? "translate(3 0) skewY(-.4)" : "";
  const label = `${safeBase === "male" ? "Male" : "Female"} student, ${CHARACTER_STAGES[safeStage].label} stage, ${hair.label}`;
  return <svg className={`lumora-character ${className}`} width={size} height={size * 1.22} viewBox="0 0 160 315" role={decorative?undefined:"img"} aria-hidden={decorative||undefined} aria-labelledby={decorative?undefined:`${uid}-title`} data-base={safeBase} data-view={safeView} data-activity={safeActivity} data-motion={motion} data-detail={detail} style={svgStyle}>
    {!decorative&&<title id={`${uid}-title`}>{title || label}</title>}
    <defs><radialGradient id={`${uid}-aura`}><stop offset="0" stopColor={aura.colour} stopOpacity={safeStage*.12}/><stop offset=".7" stopColor={aura.colour} stopOpacity={safeStage*.07}/><stop offset="1" stopColor={aura.colour} stopOpacity="0"/></radialGradient><linearGradient id={`${uid}-shine`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff" stopOpacity=".28"/><stop offset="1" stopColor={theme.accent} stopOpacity=".12"/></linearGradient></defs>
    {aura.id!=="none"&&<ellipse className={safeActivity==="complete"?"lc-complete-aura":""} cx="80" cy={seated?"165":"160"} rx="76" ry="142" fill={`url(#${uid}-aura)`}/>}
    <ellipse cx="80" cy="299" rx="48" ry="7" fill="rgba(28,44,57,.14)"/>
    <g transform={turn}>
      {seated?<><SeatedBody skin={skin} top={top} bottom={bottom} activity={safeActivity} stage={safeStage}/><g className="lc-head"><Face base={safeBase} skin={skin} accessory={accessory} view={safeView}/><Hair style={hair} colour={hairColour} view={safeView}/></g><Desk desk={desk} stage={safeStage}/></>:<><StandingBody base={safeBase} skin={skin} top={top} bottom={bottom} shoes={shoes} activity={safeActivity} stage={safeStage}/><g className="lc-head"><Face base={safeBase} skin={skin} accessory={accessory} view={safeView}/><Hair style={hair} colour={hairColour} view={safeView}/></g></>}
    </g>
    {(accessory.id==="star-pin"||accessory.id==="book-pin")&&<g className="lc-detail"><circle cx="93" cy="131" r="6" fill={theme.accent} stroke="#344451"/><text x="93" y="134" textAnchor="middle" fontSize="7" fill="#fff">{accessory.id==="star-pin"?"★":"▤"}</text></g>}
    {safeActivity==="complete"&&<g fill={theme.accent}><path className="lc-spark" d="M25 72l3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/><path className="lc-spark" style={{animationDelay:".18s"}} d="M128 103l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/></g>}
    <path d="M6 24C35 7 125 7 153 26" fill="none" stroke={`url(#${uid}-shine)`} strokeWidth="2" opacity=".6"/>
  </svg>;
}

export const CharacterRenderer = memo(CharacterRendererComponent);
export default CharacterRenderer;
