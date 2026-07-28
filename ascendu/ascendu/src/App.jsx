import { useState, useEffect, useRef, useCallback, useMemo, useId } from "react";
import { db } from "./firebase.js";
import LumoraShell from "./components/LumoraShell.jsx";
import ClassroomScene from "./components/ClassroomScene.jsx";
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, arrayUnion,
  collection, getDocs, query, where, increment
} from "firebase/firestore";

/* ════════════════════════════════════════════════════════════════════════
   LUMORA — a focus app where your light grows as you study.
   Built on Lumora's established mechanics (timer, subjects, coins, leaderboards,
   presence, badges, targets, weekly recap, an evolving avatar, class codes
   and co-op focus rooms). Lumora gives it its own identity: an aurora
   indigo→violet palette with a warm amber glow on a cool "dusk" surface,
   rather than the forest-green look it was forked from.
   ════════════════════════════════════════════════════════════════════════ */

// ── BRAND: Lumora ─────────────────────────────────────────────────────────────
// Single source of truth for Lumora's look. Change values here to re-theme the
// whole app. (NOTE: the ascendu_* storage keys below are intentionally left
// unchanged — renaming them would sign every existing user out and lose their
// saved data. The rebrand is visual, not a data migration.)
const BRAND = {
  name:     "Lumora",
  logo:     "✦",
  tagline:  "Focus, and let your light grow.",
  // CSS variables keep inline styles theme-aware without colour-inverting the UI.
  primary:  "var(--lm-primary)",
  primaryDk:"var(--lm-primary-dark)",
  primarySoft:"var(--lm-primary-soft)",
  primaryShadow:"var(--lm-primary-shadow)",
  accent:   "var(--lm-accent)",
  ink:      "var(--lm-ink)",
  bg:       "var(--lm-bg)",
  bgGrad:   "var(--lm-bg-gradient)",
  surface:  "var(--lm-surface)",
  surfaceRaised:"var(--lm-surface-raised)",
  border:   "var(--lm-border)",
  borderHi: "var(--lm-border-strong)",
  track:    "var(--lm-track)",
  muted:    "var(--lm-muted)",
  mutedSoft:"var(--lm-muted-soft)",
  coinText: "var(--lm-coin-text)",
  coinBg:   "var(--lm-coin-bg)",
  coinBorder:"var(--lm-coin-border)",
  live:     "var(--lm-live)",
  danger:   "var(--lm-danger)",
};

// ── localStorage keys ─────────────────────────────────────────────────────────
const LS_USER     = "ascendu_username";
const LS_PASSWORD = "ascendu_password";
const LS_SUBJECT  = "ascendu_subject";
const LS_SUBJECTS = "ascendu_subjects";
const LS_MODE     = "ascendu_mode";
const LS_COINS    = "ascendu_coins";
const LS_XP       = "ascendu_xp";
const LS_AVATAR   = "ascendu_avatar";       // equipped cosmetics + base look
const LS_OWNED    = "ascendu_owned_cosmetics";
const LS_THEME    = "ascendu_theme";
const LS_STAKES   = "ascendu_streak_stakes"; // optional Forest-style penalty for giving up
const LS_TARGETS  = "ascendu_targets";
const LS_BADGES   = "ascendu_badges";
const LS_RECAP    = "ascendu_recap_shown";
const LS_CLASSES  = "ascendu_classes";      // joined class codes
const LS_ACTIVE   = "ascendu_active_session";
const LS_DAILY_GOAL = "ascendu_daily_goal_minutes";
const LS_INTENTION  = "ascendu_focus_intention";

// ── XP / level system ──────────────────────────────────────────────────────────
// 1 XP per minute focused. Levels use a gentle curve. Evolution tiers gate on level.
const XP_PER_MIN = 1;
const COINS_PER_MIN = 1;
const levelFromXp = (xp) => Math.floor(Math.sqrt(xp / 25)) + 1;       // lvl 1 at 0, lvl 2 at 25, lvl 3 at 100...
const xpForLevel  = (lvl) => 25 * (lvl - 1) * (lvl - 1);
const xpToNext    = (xp) => {
  const lvl = levelFromXp(xp);
  const cur = xpForLevel(lvl), next = xpForLevel(lvl + 1);
  return { lvl, into: xp - cur, span: next - cur, pct: (xp - cur) / (next - cur) };
};

// Evolution tiers tell a gentle life-stage story. Progress is expressed through
// curiosity, light and experience — never through body shape or physical ideals.
const EVO_TIERS = [
  { id:"sprout",  name:"New Light",       minLvl:1,  desc:"A tiny spark has arrived" },
  { id:"learner", name:"Little Spark",    minLvl:3,  desc:"Curiosity is waking up" },
  { id:"scholar", name:"Young Learner",   minLvl:6,  desc:"Every session reveals something new" },
  { id:"adept",   name:"Wayfinder",       minLvl:10, desc:"A steady rhythm is taking shape" },
  { id:"sage",    name:"Lightkeeper",     minLvl:16, desc:"Focus has become a trusted skill" },
  { id:"luminary",name:"Luminary",        minLvl:24, desc:"A calm light for the path ahead" },
  { id:"beacon",  name:"Beacon",          minLvl:36, desc:"Consistency that guides the way" },
  { id:"astral",  name:"Astral Scholar",  minLvl:50, desc:"A whole world shaped by focus" },
];
const tierForLevel = (lvl) => [...EVO_TIERS].reverse().find(t => lvl >= t.minLvl) || EVO_TIERS[0];

// ── Subjects ────────────────────────────────────────────────────────────────────
const DEFAULT_SUBJECTS = [
  { id:"math",    label:"Mathematics", emoji:"📐", color:"#5B8DEF" },
  { id:"english", label:"English",     emoji:"📖", color:"#E07B54" },
];
const EMOJI_OPTIONS = ["📐","📖","🔬","🏛️","🌏","📊","🎨","✏️","💻","🎵","🏃","🧪","📝","🌍","🔭","💡","📚","🧠","⚙️","🎯"];
const COLOR_OPTIONS = ["#5B8DEF","#E07B54","#56B68B","#C57BDB","#E8B84B","#6ECBD1","#F07B8F","#A0A0B0","#FF6B6B","#4ECDC4","#45B7D1","#96CEB4"];

// ── Cosmetics (coins) ──────────────────────────────────────────────────────────
// Equippable identity items, grouped by slot. The avatar reads as *you*, not a tree.
const COSMETICS = [
  // hats
  { id:"none_hat",  slot:"hat",  name:"No hat",        cost:0,    draw:"none" },
  { id:"cap",       slot:"hat",  name:"Study Cap",     cost:120,  draw:"cap",     color:"#E07B54" },
  { id:"beanie",    slot:"hat",  name:"Cozy Beanie",   cost:150,  draw:"beanie",  color:"#56B68B" },
  { id:"grad",      slot:"hat",  name:"Grad Cap",      cost:400,  draw:"grad",    color:"#2A2A3A" },
  { id:"crown",     slot:"hat",  name:"Focus Crown",   cost:1200, draw:"crown",   color:"#E8B84B" },
  { id:"halo",      slot:"hat",  name:"Sage Halo",     cost:1800, draw:"halo",    color:"#FFE08A" },
  // auras (the "glow" while focusing)
  { id:"none_aura", slot:"aura", name:"No aura",       cost:0,    draw:"none" },
  { id:"warm",      slot:"aura", name:"Warm Glow",     cost:200,  draw:"glow",    color:"#FFB36B" },
  { id:"cool",      slot:"aura", name:"Cool Glow",     cost:200,  draw:"glow",    color:"#6EC6FF" },
  { id:"violet",    slot:"aura", name:"Violet Glow",   cost:300,  draw:"glow",    color:"#B07BE0" },
  { id:"galaxy",    slot:"aura", name:"Galaxy Aura",   cost:900,  draw:"galaxy",  color:"#9B59B6" },
  // companions (a little buddy that orbits you)
  { id:"none_pet",  slot:"pet",  name:"No companion",  cost:0,    draw:"none" },
  { id:"cat",       slot:"pet",  name:"Study Cat",     cost:500,  draw:"cat",     color:"#E8A87C" },
  { id:"owl",       slot:"pet",  name:"Night Owl",     cost:650,  draw:"owl",     color:"#8B7355" },
  { id:"sprite",    slot:"pet",  name:"Focus Sprite",  cost:1500, draw:"sprite",  color:"#56D6A0" },
];
const SLOTS = [
  { id:"hat",  label:"Headwear",   emoji:"🎓" },
  { id:"aura", label:"Aura",       emoji:"✨" },
  { id:"pet",  label:"Companion",  emoji:"🐾" },
];
const cosmeticById = (id) => COSMETICS.find(c => c.id === id);

const DAY_LABELS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ── Badges ──────────────────────────────────────────────────────────────────────
const BADGE_REWARDS = { easy:25, mid:50, hard:100 };
const BADGES = [
  { id:"first_session", name:"First Focus",   emoji:"🌱", tier:"easy", desc:"Finish your first session",
    check:c=>c.totalSessions>=1 },
  { id:"first_5h_day",  name:"Deep Work",      emoji:"🔥", tier:"mid",  desc:"Focus 5h in a single day",
    check:c=>c.maxDaySecs>=5*3600 },
  { id:"streak_7",      name:"Week Warrior",   emoji:"📅", tier:"mid",  desc:"Hit a 7-day streak",
    check:c=>c.streak>=7 },
  { id:"streak_30",     name:"Unstoppable",    emoji:"🏆", tier:"hard", desc:"Hit a 30-day streak",
    check:c=>c.streak>=30 },
  { id:"all_subjects",  name:"Well Rounded",   emoji:"🎯", tier:"mid",  desc:"Study every subject in one week",
    check:c=>c.allSubjectsThisWeek },
  { id:"sessions_100",  name:"Centurion",      emoji:"💯", tier:"hard", desc:"Complete 100 sessions",
    check:c=>c.totalSessions>=100 },
  { id:"first_cosmetic",name:"Dressed Up",     emoji:"🎩", tier:"easy", desc:"Equip your first cosmetic",
    check:c=>c.cosmeticCount>=1 },
  { id:"night_owl",     name:"Night Owl",      emoji:"🦉", tier:"easy", desc:"Finish a session after midnight",
    check:c=>c.hasNightOwl },
  { id:"early_bird",    name:"Early Bird",     emoji:"🌅", tier:"easy", desc:"Finish a session before 6am",
    check:c=>c.hasEarlyBird },
  { id:"joined_class",  name:"Classmate",      emoji:"🏫", tier:"easy", desc:"Join your first class",
    check:c=>c.classCount>=1 },
  { id:"coop_session",  name:"Better Together",emoji:"🤝", tier:"mid",  desc:"Finish a co-op focus room",
    check:c=>c.hasCoop },
  { id:"evolve_scholar",name:"Scholar",        emoji:"📜", tier:"mid",  desc:"Evolve to Scholar (level 6)",
    check:c=>c.level>=6 },
];

function buildBadgeCtx({ history, streak, cosmeticCount, subjects, classCount, level }) {
  const hist = Array.isArray(history) ? history : [];
  const totalSessions = hist.length;
  const dayTotals = {};
  let hasNightOwl = false, hasEarlyBird = false, hasCoop = false;
  hist.forEach(s => {
    const d = new Date(s.ts);
    const key = startOfDay(d).getTime();
    dayTotals[key] = (dayTotals[key] || 0) + s.secs;
    const hr = d.getHours();
    if (hr >= 0 && hr < 5) hasNightOwl = true;
    if (hr >= 4 && hr < 6) hasEarlyBird = true;
    if (s.coop) hasCoop = true;
  });
  const maxDaySecs = Object.values(dayTotals).reduce((a,b)=>Math.max(a,b),0);
  const ws = startOfWeek(new Date());
  const weekSubj = new Set(hist.filter(s=>new Date(s.ts)>=ws).map(s=>s.subject));
  const allSubjectsThisWeek = subjects.length>0 && subjects.every(s=>weekSubj.has(s.id));
  return { totalSessions, maxDaySecs, streak, allSubjectsThisWeek, cosmeticCount,
           hasNightOwl, hasEarlyBird, hasCoop, classCount, level };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const getWeekKey = () => {
  const d = new Date(), jan = new Date(d.getFullYear(),0,1);
  const wk = Math.ceil(((d - jan)/86400000 + jan.getDay() + 1)/7);
  return `${d.getFullYear()}-W${wk}`;
};
const pad = n => String(n).padStart(2,"0");
const fmt = s => {
  const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=s%60;
  return h>0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
};
const fmtMins = s => { const h=Math.floor(s/3600), m=Math.floor((s%3600)/60); return h>0?`${h}h ${m}m`:`${m}m`; };
const fmtHrs = s => { const h=s/3600; return h>=1?`${h.toFixed(1)}h`:`${Math.floor(s/60)}m`; };
const lsGet  = (k,fb) => { try{const v=localStorage.getItem(k);return v?JSON.parse(v):fb;}catch{return fb;} };
const lsSet  = (k,v)  => { try{localStorage.setItem(k,JSON.stringify(v));}catch{} };
const lsRaw  = (k,fb) => { try{return localStorage.getItem(k)||fb;}catch{return fb;} };
const lsSetR = (k,v)  => { try{localStorage.setItem(k,v);}catch{} };
const startOfDay   = d => { const x=new Date(d); x.setHours(0,0,0,0); return x; };
const startOfWeek  = d => { const x=startOfDay(d); x.setDate(x.getDate()-x.getDay()); return x; };
const startOfMonth = d => new Date(d.getFullYear(), d.getMonth(), 1);
const startOfYear  = d => new Date(d.getFullYear(), 0, 1);
const genClassCode = () => { const a="ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s=""; for(let i=0;i<6;i++) s+=a[Math.floor(Math.random()*a.length)]; return s; };

// ── App-level CSS (responsive shell, motion + real dark theme) ────────────────────
const DARK_CSS = `
:root, [data-theme="light"] {
  color-scheme: light;
  --lm-primary:#6D5DF6;
  --lm-primary-dark:#5545D8;
  --lm-primary-soft:#EFEDFF;
  --lm-primary-shadow:rgba(109,93,246,.24);
  --lm-accent:#F2A93B;
  --lm-ink:#1C1933;
  --lm-bg:#F4F3FA;
  --lm-bg-gradient:linear-gradient(145deg,#F7F6FC 0%,#EFEDFA 52%,#F7F4F0 100%);
  --lm-surface:rgba(255,255,255,.78);
  --lm-surface-raised:#FFFFFF;
  --lm-border:rgba(77,67,125,.12);
  --lm-border-strong:rgba(109,93,246,.24);
  --lm-track:#E9E6F5;
  --lm-muted:#77738F;
  --lm-muted-soft:#A7A3B9;
  --lm-coin-text:#9A6610;
  --lm-coin-bg:#FFF6DF;
  --lm-coin-border:#EED18C;
  --lm-live:#36B978;
  --lm-danger:#D85E62;
  --lm-shadow:0 18px 55px rgba(42,34,85,.10);
  --lm-shadow-soft:0 8px 30px rgba(42,34,85,.07);
}
[data-theme="dark"] {
  color-scheme: dark;
  --lm-primary:#9C8CFF;
  --lm-primary-dark:#8170F4;
  --lm-primary-soft:rgba(136,116,255,.15);
  --lm-primary-shadow:rgba(124,105,255,.30);
  --lm-accent:#FFC66D;
  --lm-ink:#F3F0FF;
  --lm-bg:#11101A;
  --lm-bg-gradient:linear-gradient(145deg,#12111C 0%,#181524 52%,#17151C 100%);
  --lm-surface:rgba(30,27,45,.78);
  --lm-surface-raised:#211E30;
  --lm-border:rgba(219,211,255,.12);
  --lm-border-strong:rgba(156,140,255,.30);
  --lm-track:#302C43;
  --lm-muted:#B3AEC7;
  --lm-muted-soft:#79748E;
  --lm-coin-text:#FFD489;
  --lm-coin-bg:rgba(255,190,79,.11);
  --lm-coin-border:rgba(255,204,113,.25);
  --lm-live:#62D79B;
  --lm-danger:#FF888E;
  --lm-shadow:0 22px 65px rgba(0,0,0,.30);
  --lm-shadow-soft:0 10px 34px rgba(0,0,0,.22);
}
`;
const APP_CSS = `
html, body, #root { min-height:100%; margin:0; }
body { background:var(--lm-bg); }
* { box-sizing:border-box; }
@keyframes sgpulse { 0%{box-shadow:0 0 0 0 rgba(52,199,89,0.5);} 70%{box-shadow:0 0 0 7px rgba(52,199,89,0);} 100%{box-shadow:0 0 0 0 rgba(52,199,89,0);} }
.sg-shell ::-webkit-scrollbar { height:5px; width:5px; }
.sg-shell ::-webkit-scrollbar-thumb { background:var(--lm-border-strong); border-radius:8px; }
.sg-shell { min-height:100vh; background:var(--lm-bg-gradient); color:var(--lm-ink); position:relative; isolation:isolate; overflow-x:hidden; }
.sg-shell::before, .sg-shell::after { content:""; position:fixed; width:42vw; height:42vw; border-radius:50%; filter:blur(80px); opacity:.17; pointer-events:none; z-index:-1; }
.sg-shell::before { background:#7E6BFF; top:-18vw; right:-12vw; }
.sg-shell::after { background:#F5B85D; bottom:-24vw; left:-16vw; }
.sg-app { width:100%; margin:0 auto; }
.sg-header { backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px); }
.sg-nav { backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); }
.sg-main { width:100%; }
.lm-focus-layout { display:grid; grid-template-columns:minmax(0,1fr); gap:14px; align-items:stretch; }
.lm-focus-card, .lm-stage-card { min-width:0; background:var(--lm-surface); border:1px solid var(--lm-border); border-radius:18px; box-shadow:0 1px 4px rgba(35,28,75,.07); }
.lm-focus-card { width:100%; padding:19px 16px; }
.lm-stage-card { padding:16px; display:flex; flex-direction:column; justify-content:center; position:relative; overflow:hidden; }
.lm-stage-card::before { content:""; position:absolute; width:280px; height:280px; border-radius:50%; background:radial-gradient(circle,var(--lm-primary-shadow),transparent 68%); top:26px; left:50%; transform:translateX(-50%); pointer-events:none; }
.lm-section-kicker { display:flex; align-items:center; gap:8px; color:var(--lm-primary); font-size:11px; font-weight:850; letter-spacing:.12em; text-transform:uppercase; margin-bottom:7px; }
.lm-section-kicker::before { content:""; width:18px; height:2px; border-radius:2px; background:linear-gradient(90deg,var(--lm-primary),var(--lm-accent)); }
.lm-focus-heading { margin:0 0 6px; font-size:clamp(25px,3vw,34px); line-height:1.08; letter-spacing:-.045em; color:var(--lm-ink); }
.lm-focus-copy { margin:0 0 22px; max-width:42ch; color:var(--lm-muted); font-size:13px; line-height:1.55; }
.lm-field-label { display:block; margin:14px 0 7px; color:var(--lm-muted); font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
.lm-essential-block { margin-top:17px; }
.lm-essential-block:first-of-type { margin-top:0; }
.lm-choice-row { display:flex; flex-wrap:wrap; gap:8px; }
.lm-session-options { margin-top:16px; border:1px solid var(--lm-border); border-radius:16px; background:color-mix(in srgb,var(--lm-surface-raised) 72%,transparent); overflow:hidden; }
.lm-session-options summary { list-style:none; display:flex; align-items:center; justify-content:space-between; min-height:46px; padding:0 14px; color:var(--lm-muted); cursor:pointer; font-size:11px; font-weight:800; letter-spacing:.02em; }
.lm-session-options summary::-webkit-details-marker { display:none; }
.lm-session-options summary::after { content:"+"; width:22px; height:22px; display:grid; place-items:center; border-radius:50%; background:var(--lm-primary-soft); color:var(--lm-primary); font-size:16px; font-weight:500; transition:transform .2s ease; }
.lm-session-options[open] summary::after { transform:rotate(45deg); }
.lm-session-options[open] summary { color:var(--lm-ink); border-bottom:1px solid var(--lm-border); }
.lm-session-options-body { padding:2px 14px 15px; }
.lm-first-session-note { display:flex; gap:10px; align-items:flex-start; margin:14px 0 0; padding:12px 13px; border:1px solid var(--lm-border-strong); border-radius:15px; background:var(--lm-primary-soft); color:var(--lm-muted); font-size:11px; line-height:1.5; }
.lm-first-session-note strong { display:block; margin-bottom:2px; color:var(--lm-ink); font-size:12px; }
.lm-primary-action { width:100%; min-height:52px; margin-top:18px; border:0; border-radius:17px; color:#fff; cursor:pointer; font-family:inherit; font-size:13px; font-weight:850; letter-spacing:.01em; box-shadow:0 13px 30px var(--lm-primary-shadow); }
.lm-growth-stage { display:flex; align-items:center; justify-content:center; gap:8px; margin:2px auto 10px; color:var(--lm-muted); font-size:11px; }
.lm-growth-stage strong { color:var(--lm-ink); }
.lm-growth-dot { width:7px; height:7px; border-radius:50%; background:var(--lm-accent); box-shadow:0 0 12px var(--lm-accent); }
.lm-intention { width:100%; min-height:48px; resize:none; color:var(--lm-ink); background:var(--lm-surface-raised); border:1px solid var(--lm-border); border-radius:14px; padding:13px 14px; font-family:inherit; font-size:13px; font-weight:600; line-height:1.45; outline:none; transition:border-color .2s, box-shadow .2s; }
.lm-intention:focus { border-color:var(--lm-primary); box-shadow:0 0 0 4px var(--lm-primary-soft); }
.lm-intention::placeholder { color:var(--lm-muted-soft); }
.lm-custom-duration { height:36px; display:inline-flex; align-items:center; border:1.5px solid var(--lm-border); border-radius:20px; background:var(--lm-surface-raised); overflow:hidden; color:var(--lm-muted); font-size:11px; font-weight:750; }
.lm-custom-duration:focus-within { border-color:var(--lm-primary); box-shadow:0 0 0 3px var(--lm-primary-soft); }
.lm-custom-duration input { width:45px; height:100%; border:0; outline:0; background:transparent; color:var(--lm-ink); text-align:right; font-family:inherit; font-size:12px; font-weight:750; padding:0 3px 0 8px; appearance:textfield; }
.lm-custom-duration input::-webkit-inner-spin-button { display:none; }
.lm-custom-duration span { padding-right:9px; }
.lm-session-intent { margin:14px 0 2px; padding:13px 14px; border-radius:15px; border:1px solid var(--lm-border-strong); background:var(--lm-primary-soft); display:flex; flex-direction:column; gap:4px; }
.lm-session-intent span { color:var(--lm-muted); font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; }
.lm-session-intent strong { color:var(--lm-ink); font-size:13px; line-height:1.4; overflow-wrap:anywhere; }
.lm-orb-stage { min-height:270px; display:flex; justify-content:center; align-items:flex-end; position:relative; z-index:1; }
.lm-orb-stage::after { content:""; position:absolute; width:210px; height:34px; bottom:19px; border-radius:50%; background:radial-gradient(ellipse,rgba(38,30,83,.19),transparent 70%); filter:blur(7px); z-index:-1; }
.lm-world-frame { position:relative; width:100%; height:300px; margin:8px 0 0; overflow:hidden; border:1px solid rgba(255,255,255,.24); border-radius:24px; background:var(--lm-surface-raised); box-shadow:inset 0 1px 0 rgba(255,255,255,.24),0 18px 42px rgba(34,27,77,.14); isolation:isolate; }
.lm-world-frame::after { content:""; position:absolute; inset:0; border-radius:inherit; box-shadow:inset 0 -44px 70px rgba(18,20,45,.12); pointer-events:none; z-index:3; }
.lm-world-avatar { position:absolute; inset:0 0 -12px; z-index:2; display:flex; justify-content:center; align-items:flex-end; pointer-events:none; transform:scale(.9); transform-origin:center bottom; }
.lm-world-weather { position:absolute; z-index:4; top:12px; left:12px; display:flex; align-items:center; gap:6px; padding:7px 10px; border:1px solid rgba(255,255,255,.25); border-radius:999px; background:rgba(19,22,48,.45); color:#fff; box-shadow:0 5px 18px rgba(16,20,52,.15); backdrop-filter:blur(10px); font-size:10px; font-weight:800; letter-spacing:.02em; }
.lm-world-progress { margin:12px 0 2px; padding:11px 12px; border:1px solid var(--lm-border); border-radius:15px; background:var(--lm-surface-raised); }
.lm-world-progress-top { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px; }
.lm-world-progress-top strong { color:var(--lm-ink); font-size:11px; }
.lm-world-progress-top span { color:var(--lm-muted); font-size:10px; text-transform:capitalize; }
.lm-world-progress-track { height:6px; overflow:hidden; border-radius:999px; background:var(--lm-track); }
.lm-world-progress-fill { height:100%; border-radius:inherit; background:linear-gradient(90deg,var(--lm-primary),var(--lm-accent)); transition:width .6s cubic-bezier(.22,1,.36,1); }
.lm-progress-halo { position:absolute; width:244px; height:244px; top:13px; border-radius:50%; background:conic-gradient(var(--lm-subject) calc(var(--lm-progress) * 1turn),var(--lm-track) 0); opacity:.72; -webkit-mask:radial-gradient(circle,transparent 67%,#000 68%); mask:radial-gradient(circle,transparent 67%,#000 68%); transform:rotate(-90deg); transition:background .5s ease; }
.lm-spark { position:absolute; width:6px; height:6px; border-radius:50%; background:var(--lm-accent); box-shadow:0 0 14px var(--lm-accent); animation:lmFloat 4s ease-in-out infinite; }
.lm-spark-a { left:18%; top:30%; }
.lm-spark-b { right:17%; top:20%; animation-delay:-1.4s; width:4px; height:4px; }
.lm-spark-c { right:25%; top:58%; animation-delay:-2.7s; }
@keyframes lmFloat { 0%,100%{transform:translateY(0) scale(.85);opacity:.45;} 50%{transform:translateY(-14px) scale(1.15);opacity:1;} }
@keyframes lmAuraBreathe { 0%,100%{opacity:.42;transform:scale(.96);} 50%{opacity:.7;transform:scale(1.04);} }
@keyframes lmBubbleRise { 0%{opacity:0;transform:translateY(9px) scale(.65);} 18%{opacity:.82;} 78%{opacity:.46;} 100%{opacity:0;transform:translateY(-42px) scale(1.12);} }
@keyframes lmFigureFloat { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-3px);} }
@keyframes lmOrbitSlow { to{transform:rotate(360deg);} }
@keyframes lmAvatarBlink { 0%,92%,100%{transform:scaleY(1);} 95%{transform:scaleY(.08);} 97%{transform:scaleY(1);} }
@keyframes lmSparkOut { 0%{opacity:0;transform:translate(0,0) scale(.4);} 22%{opacity:1;} 100%{opacity:0;transform:translate(var(--spark-x),var(--spark-y)) scale(1.15);} }
.lm-avatar-aura { animation:lmAuraBreathe 4.8s ease-in-out infinite; transform-box:fill-box; transform-origin:center; }
.lm-effervescent-bubble { animation:lmBubbleRise var(--bubble-duration,5s) ease-in-out infinite; animation-delay:var(--bubble-delay,0s); transform-box:fill-box; transform-origin:center; }
.lm-avatar-figure { animation:lmFigureFloat 4.2s ease-in-out infinite; transform-box:fill-box; transform-origin:center bottom; }
.lm-avatar-orbit { animation:lmOrbitSlow 24s linear infinite; transform-box:fill-box; transform-origin:center; }
.lm-avatar-eyes { animation:lmAvatarBlink 6.4s ease-in-out infinite; transform-box:fill-box; transform-origin:center; }
.lm-celebrate-spark { animation:lmSparkOut 1.25s cubic-bezier(.22,1,.36,1) both; transform-box:fill-box; transform-origin:center; }
@keyframes lmCelebrate { 0%,100%{transform:translateY(0) scale(1);} 24%{transform:translateY(-16px) scale(1.03);} 52%{transform:translateY(0) scale(.98);} 72%{transform:translateY(-7px) scale(1.01);} }
.lm-avatar-svg.is-celebrating { animation:lmCelebrate 1.5s cubic-bezier(.22,1,.36,1); transform-box:fill-box; transform-origin:center bottom; }
.lm-daily-card { display:flex; align-items:center; gap:12px; margin-top:16px; padding:12px 14px; border:1px solid var(--lm-border); border-radius:15px; background:var(--lm-surface-raised); }
.lm-daily-ring { width:42px; height:42px; border-radius:50%; display:grid; place-items:center; flex:none; background:conic-gradient(var(--lm-primary) var(--lm-goal),var(--lm-track) 0); position:relative; }
.lm-daily-ring::after { content:""; width:32px; height:32px; border-radius:50%; background:var(--lm-surface-raised); position:absolute; }
.lm-daily-ring span { position:relative; z-index:1; font-size:10px; font-weight:900; color:var(--lm-primary); }
.lm-quick-actions { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-top:18px; }
.lm-nav-icon { display:block; font-size:16px; line-height:1; margin-bottom:4px; }
.lm-modal-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; }
.lm-modal-close { width:34px; height:34px; border:1px solid var(--lm-border); border-radius:50%; background:var(--lm-bg); color:var(--lm-muted); font-size:20px; line-height:1; cursor:pointer; flex:none; }
.lm-login-brand { margin-bottom:24px; }
.lm-login-logo { width:64px; height:64px; margin:0 auto 14px; border-radius:21px; display:grid; place-items:center; color:white; font-size:30px; background:linear-gradient(145deg,var(--lm-primary),#9C73FF); box-shadow:0 14px 36px var(--lm-primary-shadow); }
.lm-login-features { display:flex; justify-content:center; flex-wrap:wrap; gap:7px; margin:18px 0 2px; }
.lm-login-feature { padding:6px 10px; border-radius:999px; color:var(--lm-muted); background:var(--lm-bg); border:1px solid var(--lm-border); font-size:10px; font-weight:750; }
.sg-shell button:focus-visible, .sg-shell input:focus-visible, .sg-shell textarea:focus-visible { outline:3px solid var(--lm-primary-soft); outline-offset:2px; }
.sg-shell button:disabled { opacity:.48; cursor:not-allowed; }
.sg-shell button { transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1), filter 0.18s ease, box-shadow 0.2s ease; -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
.sg-shell button:active { transform: scale(0.94); filter: brightness(0.97); }
.sg-plant-btn:active { transform: scale(0.97) translateY(1px); }
@keyframes sgFadeIn  { from{opacity:0;} to{opacity:1;} }
@keyframes sgPopIn   { from{opacity:0;transform:scale(0.9) translateY(8px);} to{opacity:1;transform:scale(1) translateY(0);} }
@keyframes sgSlideUp { from{opacity:0;transform:translateY(10px);} to{opacity:1;transform:translateY(0);} }
@keyframes sgGrowIn  { from{opacity:0;transform:scale(0.96);} to{opacity:1;transform:scale(1);} }
.sg-overlay-anim { animation: sgFadeIn 0.22s ease both; }
.sg-pop-anim     { animation: sgPopIn 0.32s cubic-bezier(0.34,1.4,0.64,1) both; }
.sg-view-anim    { animation: sgSlideUp 0.28s cubic-bezier(0.22,1,0.36,1) both; }
.sg-card-anim    { animation: sgGrowIn 0.3s cubic-bezier(0.22,1,0.36,1) both; }
.sg-tap-card { transition: transform 0.2s cubic-bezier(0.34,1.4,0.64,1), box-shadow 0.2s ease; }
.sg-tap-card:active { transform: scale(0.97); }
@media (hover:hover) {
  .sg-shell button:hover:not(:disabled) { filter:brightness(1.025); }
  .sg-tap-card:hover { transform:translateY(-2px); box-shadow:var(--lm-shadow-soft); }
}
@media (min-width:760px) {
  .sg-app { padding:0 0 30px; }
  .sg-header { position:sticky; top:14px; z-index:80; border:1px solid var(--lm-border); border-radius:22px; background:var(--lm-surface); box-shadow:var(--lm-shadow-soft); margin-bottom:14px; }
  .sg-nav { position:sticky; top:88px; z-index:70; width:max-content; margin:0 auto 20px; padding:5px !important; border:1px solid var(--lm-border) !important; border-radius:16px; background:var(--lm-surface); box-shadow:var(--lm-shadow-soft); }
  .sg-nav button { min-width:112px; }
  .lm-nav-icon { display:inline; margin:0 7px 0 0; }
  .sg-board-view { width:min(760px,100%); margin:0 auto; }
}
@media (max-width:759px) {
  .sg-app { padding-bottom:30px !important; }
  .sg-header { background:linear-gradient(180deg,var(--lm-bg) 58%,transparent); }
  .sg-nav { position:fixed !important; left:12px; right:12px; bottom:10px; z-index:250; padding:6px !important; border:1px solid var(--lm-border) !important; border-radius:21px; background:var(--lm-surface) !important; box-shadow:0 16px 50px rgba(24,20,48,.22); }
  .sg-nav button { padding:8px 0 !important; }
  .lm-focus-layout { grid-template-columns:1fr; gap:14px; }
  .lm-focus-card, .lm-stage-card { grid-column:auto; grid-row:auto; }
  .lm-stage-card { min-height:0; }
  .lm-focus-card { padding:19px 16px; }
  .lm-quick-actions { gap:7px; }
}
@media (max-width:390px) {
  .lm-stage-card { min-height:0; padding-inline:14px; }
  .lm-orb-stage { min-height:245px; transform:scale(.92); margin:-8px 0; }
  .lm-world-frame { height:238px; }
  .lm-world-avatar { transform:scale(.76); }
  .lm-quick-actions { grid-template-columns:1fr; }
}
@media (prefers-reduced-motion: reduce) {
  .sg-shell *, .sg-shell::before, .sg-shell::after, .sg-overlay-anim, .sg-pop-anim, .sg-view-anim, .sg-card-anim { animation:none !important; transition:none !important; scroll-behavior:auto !important; }
}
`;


// ── Firebase: sessions + leaderboards ─────────────────────────────────────────
const weekKey = getWeekKey();

// Trusted path: call the Cloud Function so the server validates and writes the
// leaderboard. If the function isn't deployed yet (early local dev), fall back
// to a direct client write so the app still works — but ship with the function.
async function fbSaveSession(username, subjId, secs, { coop=false, classCode=null, startedAt=null } = {}) {
  try {
    const record = httpsCallable(functions, "recordSession");
    await record({ subjectId: subjId, secs, startedAt, coop, classCode });
    return;
  } catch(e) {
    // not-found / internal => function likely not deployed; use fallback below
    console.warn("recordSession unavailable, using direct write fallback:", e?.code || e);
  }
  try {
    const bump = async (ref) => {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, { [username]: { totalSecs: secs, sessions: 1, subjects: { [subjId]: secs } } });
      } else {
        const data = snap.data();
        const u = data[username] || { totalSecs:0, sessions:0, subjects:{} };
        u.totalSecs += secs; u.sessions += 1;
        u.subjects = u.subjects || {}; u.subjects[subjId] = (u.subjects[subjId]||0) + secs;
        await setDoc(ref, { ...data, [username]: u });
      }
    };
    await bump(doc(db, "leaderboard_weekly", weekKey));
    await bump(doc(db, "leaderboard_alltime", "data"));
    if (classCode) await bump(doc(db, "class_boards", `${classCode}_${weekKey}`));

    const hRef = doc(db, "history", username);
    const hSnap = await getDoc(hRef);
    const entry = { subject: subjId, secs, ts: Date.now(),
                    ...(coop?{coop:true}:{}), ...(classCode?{classCode}:{}) };
    if (!hSnap.exists()) await setDoc(hRef, { sessions:[entry] });
    else {
      const existing = hSnap.data().sessions || [];
      await setDoc(hRef, { sessions: [...existing, entry].slice(-2000) });
    }
  } catch(e) { console.error("save session:", e); }
}

async function fbLoadLeaderboard() {
  try {
    const [wSnap, aSnap] = await Promise.all([
      getDoc(doc(db, "leaderboard_weekly", weekKey)),
      getDoc(doc(db, "leaderboard_alltime", "data")),
    ]);
    const toArr = snap => !snap.exists() ? [] :
      Object.entries(snap.data()).map(([username,d])=>({username,...d}))
        .sort((a,b)=>b.totalSecs-a.totalSecs).slice(0,20);
    return { weekly: toArr(wSnap), allTime: toArr(aSnap) };
  } catch(e) { console.error("LB:", e); return { weekly:[], allTime:[] }; }
}

async function fbLoadClassBoard(classCode) {
  try {
    const snap = await getDoc(doc(db, "class_boards", `${classCode}_${weekKey}`));
    if (!snap.exists()) return [];
    return Object.entries(snap.data()).map(([username,d])=>({username,...d}))
      .sort((a,b)=>b.totalSecs-a.totalSecs).slice(0,50);
  } catch(e) { console.error("class board:", e); return []; }
}

async function fbLoadHistory(username) {
  try { const snap = await getDoc(doc(db,"history",username)); return snap.exists()?(snap.data().sessions||[]):[]; }
  catch(e) { console.error("history:", e); return []; }
}

// ── Firebase: prefs (subjects, cosmetics, classes — synced) ───────────────────
async function fbLoadPrefs(username) {
  try { const snap=await getDoc(doc(db,"prefs",username)); return snap.exists()?snap.data():null; }
  catch(e) { console.error("prefs load:", e); return null; }
}
async function fbSavePrefs(username, patch) {
  try {
    const uid = auth.currentUser?.uid;
    const data = uid ? { ...patch, ownerUid: uid } : patch;
    const ref=doc(db,"prefs",username), snap=await getDoc(ref);
    if(snap.exists()) await updateDoc(ref,data); else await setDoc(ref,data);
  } catch(e) { console.error("prefs save:", e); }
}

// ── Firebase: presence ("Focusing now") with avatar snapshot ──────────────────
const PRESENCE_TTL = 120 * 1000;
async function fbHeartbeat(username, payload) {
  try { await setDoc(doc(db,"presence",username), { username, ...payload, ts:Date.now() }); } catch(e) {}
}
async function fbClearPresence(username) { try{ await deleteDoc(doc(db,"presence",username)); }catch(e){} }
async function fbLoadPresence(classCode=null) {
  try {
    const snap = await getDocs(collection(db,"presence"));
    const now = Date.now(), out=[];
    snap.forEach(d=>{ const v=d.data(); if(v && now-v.ts<PRESENCE_TTL){
      if(!classCode || (v.classes && v.classes.includes(classCode))) out.push(v);
    }});
    return out.sort((a,b)=>a.username.localeCompare(b.username));
  } catch(e) { console.error("presence:", e); return []; }
}

// ── Firebase: classes ─────────────────────────────────────────────────────────
async function fbCreateClass(name, ownerUsername) {
  try {
    let code, exists = true, tries = 0;
    while (exists && tries < 8) { code = genClassCode(); exists = (await getDoc(doc(db,"classes",code))).exists(); tries++; }
    await setDoc(doc(db,"classes",code), { name, owner: ownerUsername, members:[ownerUsername], createdAt:Date.now() });
    return { ok:true, code, name };
  } catch(e) { console.error("create class:", e); return { ok:false, error:"Couldn't create class. Try again." }; }
}
async function fbJoinClass(code, username) {
  try {
    const ref = doc(db,"classes",code.toUpperCase());
    const snap = await getDoc(ref);
    if (!snap.exists()) return { ok:false, error:"No class with that code." };
    await updateDoc(ref, { members: arrayUnion(username) });
    return { ok:true, code:code.toUpperCase(), name: snap.data().name };
  } catch(e) { console.error("join class:", e); return { ok:false, error:"Couldn't join. Check the code." }; }
}
async function fbLoadClass(code) {
  try { const snap=await getDoc(doc(db,"classes",code)); return snap.exists()?{code,...snap.data()}:null; }
  catch(e) { return null; }
}

// ── Firebase: co-op focus rooms ───────────────────────────────────────────────
// A room is a doc with participants writing heartbeats. Anyone can host.
async function fbCreateRoom(host, subjLabel, goalMin) {
  try {
    let code, exists=true, tries=0;
    while(exists && tries<8){ code=genClassCode(); exists=(await getDoc(doc(db,"rooms",code))).exists(); tries++; }
    await setDoc(doc(db,"rooms",code), {
      host, subjLabel, goalMin, createdAt:Date.now(),
      participants: { [host]: { joinedAt:Date.now(), focusing:false } }
    });
    return { ok:true, code };
  } catch(e) { return { ok:false, error:"Couldn't open room." }; }
}
async function fbJoinRoom(code, username) {
  try {
    const ref=doc(db,"rooms",code.toUpperCase()), snap=await getDoc(ref);
    if(!snap.exists()) return { ok:false, error:"No room with that code." };
    await updateDoc(ref, { [`participants.${username}`]: { joinedAt:Date.now(), focusing:false } });
    return { ok:true, code:code.toUpperCase(), room:snap.data() };
  } catch(e) { return { ok:false, error:"Couldn't join room." }; }
}
async function fbRoomHeartbeat(code, username, focusing, elapsedSecs) {
  try { await updateDoc(doc(db,"rooms",code), {
    [`participants.${username}`]: { focusing, elapsedSecs, ts:Date.now() } }); } catch(e) {}
}
async function fbLoadRoom(code) {
  try { const snap=await getDoc(doc(db,"rooms",code)); return snap.exists()?{code,...snap.data()}:null; }
  catch(e) { return null; }
}
async function fbLeaveRoom(code, username) {
  try {
    const ref=doc(db,"rooms",code), snap=await getDoc(ref);
    if(!snap.exists()) return;
    const data=snap.data(); const p={...data.participants}; delete p[username];
    if(Object.keys(p).length===0) await deleteDoc(ref);
    else await updateDoc(ref, { participants:p });
  } catch(e) {}
}

// ── Firebase Auth ─────────────────────────────────────────────────────────────
// Real auth via Firebase Authentication (email + password). The app's public
// identity is still a username; we map username -> { uid, email } in a
// `usernames` collection so leaderboards/presence stay keyed by username and
// usernames are unique. Password reset uses Firebase's built-in email flow.
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut as fbSignOut, sendPasswordResetEmail, onAuthStateChanged,
} from "firebase/auth";
import { auth } from "./firebase.js";
import { functions } from "./firebase.js";
import { httpsCallable } from "firebase/functions";

const normUser = (u) => (u||"").trim().normalize("NFC").toLowerCase();

// Sign up: reserve username, create auth account, link them.
async function authSignUp(username, email, password) {
  const uname = username.trim();
  const key = normUser(uname);
  if (key.length < 2) return { ok:false, error:"Username needs 2+ characters." };
  if (!/^[a-z0-9_]+$/.test(key)) return { ok:false, error:"Username can use letters, numbers, and underscores only." };
  try {
    // Create the auth account FIRST so the user is signed in for all Firestore
    // operations below (security rules require an authenticated request).
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    // Now signed in: check whether the username is already reserved.
    const uref = doc(db, "usernames", key);
    const existing = await getDoc(uref);
    if (existing.exists() && existing.data().uid !== cred.user.uid) {
      // Username taken by someone else — roll back the just-created auth account.
      try { await cred.user.delete(); } catch(_) {}
      return { ok:false, error:"That username is taken. Pick another." };
    }
    // Reserve the username.
    await setDoc(uref, { uid: cred.user.uid, email: email.trim(), displayName: uname, createdAt: Date.now() });
    return { ok:true, username: uname };
  } catch(e) {
    const code = e?.code || "";
    if (code.includes("email-already-in-use")) return { ok:false, error:"That email already has an account — try signing in." };
    if (code.includes("invalid-email")) return { ok:false, error:"That email doesn't look right." };
    if (code.includes("weak-password")) return { ok:false, error:"Password needs 6+ characters." };
    // Surface the real error code so problems are diagnosable instead of generic.
    return { ok:false, error:`Couldn't create account: ${e?.code || e?.message || "unknown error"}` };
  }
}

// Sign in by email OR username (we look up the email if a username is given).
async function authSignIn(identifier, password) {
  try {
    let email = identifier.trim();
    if (!email.includes("@")) {
      const snap = await getDoc(doc(db, "usernames", normUser(identifier)));
      if (!snap.exists()) return { ok:false, error:"No account with that username." };
      email = snap.data().email;
    }
    const cred = await signInWithEmailAndPassword(auth, email, password);
    // Resolve the username for this uid
    const uname = await usernameForUid(cred.user.uid);
    return { ok:true, username: uname };
  } catch(e) {
    const code = e?.code || "";
    if (code.includes("wrong-password") || code.includes("invalid-credential")) return { ok:false, error:"Wrong email/username or password." };
    if (code.includes("user-not-found")) return { ok:false, error:"No account with that email." };
    if (code.includes("too-many-requests")) return { ok:false, error:"Too many tries — wait a moment." };
    return { ok:false, error:"Couldn't sign in. Try again." };
  }
}

// Find the username doc that belongs to a uid (one lookup; usernames are 1:1 with uid).
async function usernameForUid(uid) {
  try {
    const snap = await getDocs(query(collection(db, "usernames"), where("uid", "==", uid)));
    let found = null;
    snap.forEach(d => { if (!found) found = d.data().displayName || d.id; });
    return found;
  } catch(e) { return null; }
}

async function authResetEmail(email) {
  try { await sendPasswordResetEmail(auth, email.trim()); return { ok:true }; }
  catch(e) {
    if ((e?.code||"").includes("user-not-found")) return { ok:false, error:"No account with that email." };
    return { ok:false, error:"Couldn't send reset email. Check the address." };
  }
}

async function authLogout() { try { await fbSignOut(auth); } catch(e) {} }

// ── Avatar SVG ──────────────────────────────────────────────────────────────────
// The "you" character. `progress` (0..1) grows it during a session; `tier` sets
// the silhouette (sprout→luminary); `equipped` = {hat,aura,pet}; `color` is the
// subject accent. Pure SVG, GPU-friendly, no external assets.
// ════════════════════════════════════════════════════════════════════════════════
// LIVING WORLD  —  Phase 1
// A self-contained SVG world that grows permanently with lifetime study hours.
// Pure SVG + CSS animation (GPU-composited transforms/opacity only) so it stays
// smooth on mobile. Deterministic per-user randomness keeps each world unique
// but stable across visits. Day/night tint reads local time; star brightness
// reads streak. Nothing here ever resets — every hour is permanent.
// ════════════════════════════════════════════════════════════════════════════════

// Milestone ladder: world features unlock at lifetime-hour thresholds.
const WORLD_STAGES = [
  { h:0,    id:"barren",   reveal:["ground"] },
  { h:0.25, id:"sprout",   reveal:["grass"] },
  { h:1,    id:"firsttree",reveal:["tree1"] },
  { h:3,    id:"grove",    reveal:["tree2","tree3"] },
  { h:6,    id:"river",    reveal:["river"] },
  { h:10,   id:"forest",   reveal:["tree4","tree5","bush"] },
  { h:16,   id:"falls",    reveal:["waterfall"] },
  { h:24,   id:"hills",    reveal:["hill"] },
  { h:40,   id:"village",  reveal:["house1","house2"] },
  { h:60,   id:"island",   reveal:["floatingIsland"] },
  { h:90,   id:"ruins",    reveal:["ruins"] },
  { h:130,  id:"celestial",reveal:["constellation"] },
];
// Resolve which features are unlocked + how far into the *next* stage we are.
function worldState(lifetimeHours) {
  const unlocked = new Set();
  let stageIdx = 0;
  WORLD_STAGES.forEach((s,i)=>{ if(lifetimeHours>=s.h){ s.reveal.forEach(r=>unlocked.add(r)); stageIdx=i; } });
  const next = WORLD_STAGES[stageIdx+1];
  const cur  = WORLD_STAGES[stageIdx];
  const toNext = next ? Math.min(1,(lifetimeHours-cur.h)/(next.h-cur.h)) : 1;
  return { unlocked, stageIdx, stageId:cur.id, next, toNext, maxed:!next };
}
// Time-of-day → sky palette + ambient flags. Reads the user's local clock.
function timeOfDay(date=new Date()) {
  const h = date.getHours();
  if (h>=5  && h<8)  return { id:"dawn",      sky:["#FBD3A5","#F6A6B2","#C9B6E8"], sun:"#FFC56B", ground:"#A9C99A", glow:0.30, stars:0 };
  if (h>=8  && h<17) return { id:"day",        sky:["#AFE0FB","#CDEBFA","#EAF6FB"], sun:"#FFE08A", ground:"#9ED08C", glow:0.10, stars:0 };
  if (h>=17 && h<19) return { id:"sunset",     sky:["#FF9E6B","#FF7E8A","#A86CC4"], sun:"#FF8A4B", ground:"#7FA773", glow:0.45, stars:0.2 };
  if (h>=19 && h<22) return { id:"night",      sky:["#2B2A60","#3D2E6B","#5A3E84"], sun:"#E9D6FF", ground:"#3E5648", glow:0.55, stars:0.85 };
  return                     { id:"midnight",  sky:["#141433","#1E1B44","#2A2156"], sun:"#CFE0FF", ground:"#26382E", glow:0.65, stars:1 };
}
// Tiny deterministic PRNG so a given username always gets the same world layout.
function seedFrom(str=""){ let h=2166136261; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619);} return ()=>{ h+=0x6D2B79F5; let t=h; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }

// ── WEATHER (Phase 2) ─────────────────────────────────────────────────────────
// No UI, no buttons: weather just *happens*. It's chosen deterministically from
// the calendar date + a per-user seed, so it's stable for the whole day, differs
// day-to-day, and is unique per person. Distribution is realistic — clear most of
// the time, rain sometimes, storms/snow/fog rarely. Winter months bias toward snow.
function weatherFor(date=new Date(), seedStr="lumora") {
  const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const rnd = seedFrom(seedStr+"|wx|"+dayKey);
  const roll = rnd();
  const month = date.getMonth(); // 0=Jan
  const winter = (month===11||month===0||month===1);
  // Weighted pick. Winter swaps some rain for snow.
  let id;
  if      (roll < 0.50) id = "clear";
  else if (roll < 0.70) id = "cloudy";
  else if (roll < 0.84) id = winter ? "snow" : "rain";
  else if (roll < 0.92) id = "fog";
  else if (roll < 0.97) id = winter ? "snow" : "rain";
  else                  id = winter ? "snow" : "storm";
  // Intensity 0.5–1 adds variety to particle counts.
  const intensity = 0.5 + rnd()*0.5;
  return { id, intensity, rnd };
}

const WEATHER_LABEL = { clear:"Clear", cloudy:"Cloudy", rain:"Rain", storm:"Thunderstorm", snow:"Snow", fog:"Fog" };
const CLASSROOM_STAGE_LABEL = {
  barren:"Quiet desk", sprout:"Reading corner", firsttree:"Shared table", grove:"Class bookshelf",
  river:"Creative wall", forest:"Study lounge", falls:"Science station", hills:"Community board",
  village:"Full classroom", island:"Studio loft", ruins:"Archive room", celestial:"Lumora academy",
};

const WORLD_CSS = `
@keyframes lwClouds  { from{transform:translateX(-30px);} to{transform:translateX(330px);} }
@keyframes lwClouds2 { from{transform:translateX(-60px);} to{transform:translateX(360px);} }
@keyframes lwClouds3 { from{transform:translateX(-40px);} to{transform:translateX(340px);} }
@keyframes lwTwinkle { 0%,100%{opacity:0.2;} 50%{opacity:1;} }
@keyframes lwFly     { 0%{transform:translate(0,0);} 25%{transform:translate(40px,-12px);} 50%{transform:translate(90px,4px);} 75%{transform:translate(140px,-8px);} 100%{transform:translate(190px,0);} }
@keyframes lwSway    { 0%,100%{transform:rotate(-1.5deg);} 50%{transform:rotate(1.5deg);} }
@keyframes lwFloat   { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-5px);} }
@keyframes lwFall    { 0%{transform:translateY(-6px) translateX(0) rotate(0deg);opacity:0;} 10%{opacity:0.9;} 50%{transform:translateY(60px) translateX(14px) rotate(180deg);} 100%{transform:translateY(120px) translateX(26px) rotate(360deg);opacity:0;} }
@keyframes lwFlow    { from{stroke-dashoffset:0;} to{stroke-dashoffset:-14;} }
@keyframes lwFirefly { 0%{transform:translate(0,0);opacity:0;} 20%{opacity:1;} 50%{transform:translate(18px,-14px);} 80%{opacity:1;} 100%{transform:translate(36px,-4px);opacity:0;} }
@keyframes lwRevealUp{ from{opacity:0;transform:translateY(8px) scale(0.96);} to{opacity:1;transform:translateY(0) scale(1);} }
@keyframes lwParticle{ 0%{transform:translate(0,0);opacity:0;} 15%{opacity:0.7;} 50%{transform:translate(12px,-22px);} 85%{opacity:0.5;} 100%{transform:translate(26px,-46px);opacity:0;} }
@keyframes lwAmbient { 0%,100%{opacity:var(--lw-glow-lo);} 50%{opacity:var(--lw-glow-hi);} }
@keyframes lwSunPulse{ 0%,100%{transform:scale(1);opacity:0.85;} 50%{transform:scale(1.06);opacity:1;} }
@keyframes lwShimmer { 0%,100%{opacity:0.5;} 50%{opacity:0.85;} }
.lw-cloud  { animation: lwClouds 46s linear infinite; }
.lw-cloud2 { animation: lwClouds2 70s linear infinite; }
.lw-cloud3 { animation: lwClouds3 58s linear infinite; }
.lw-star   { animation: lwTwinkle 3.5s ease-in-out infinite; transform-box:fill-box; transform-origin:center; }
.lw-bird   { animation: lwFly 20s linear infinite; }
.lw-tree   { animation: lwSway 6s ease-in-out infinite; transform-box:fill-box; transform-origin:bottom center; }
.lw-float  { animation: lwFloat 7s ease-in-out infinite; }
.lw-leaf   { animation: lwFall 9s linear infinite; transform-box:fill-box; }
.lw-water  { stroke-dasharray:6 8; animation: lwFlow 1.1s linear infinite; }
.lw-fire   { animation: lwFirefly 6s ease-in-out infinite; }
.lw-particle{ animation: lwParticle 11s ease-in-out infinite; transform-box:fill-box; }
.lw-ambient{ animation: lwAmbient 8s ease-in-out infinite; }
.lw-sun    { animation: lwSunPulse 9s ease-in-out infinite; transform-box:fill-box; transform-origin:center; }
.lw-shimmer{ animation: lwShimmer 5s ease-in-out infinite; }
.lw-reveal { animation: lwRevealUp 0.9s cubic-bezier(0.22,1,0.36,1) both; }
/* ── Weather ── */
@keyframes lwRain  { 0%{transform:translateY(-20px);opacity:0;} 10%{opacity:0.8;} 100%{transform:translateY(220px);opacity:0.8;} }
@keyframes lwSnow  { 0%{transform:translateY(-12px) translateX(0);opacity:0;} 10%{opacity:0.95;} 50%{transform:translateY(110px) translateX(10px);} 100%{transform:translateY(220px) translateX(-8px);opacity:0.9;} }
@keyframes lwFog   { 0%{transform:translateX(-40px);} 100%{transform:translateX(40px);} }
@keyframes lwFlash { 0%,93%,100%{opacity:0;} 94%{opacity:0.85;} 95%{opacity:0.1;} 96%{opacity:0.7;} 97%{opacity:0;} }
@keyframes lwRipple{ 0%{transform:scale(0.3);opacity:0.6;} 100%{transform:scale(1.6);opacity:0;} }
.lw-rain   { animation: lwRain 0.7s linear infinite; }
.lw-snow   { animation: lwSnow 5s linear infinite; transform-box:fill-box; }
.lw-fog    { animation: lwFog 18s ease-in-out infinite alternate; }
.lw-flash  { animation: lwFlash 9s linear infinite; }
.lw-ripple { animation: lwRipple 1.4s ease-out infinite; transform-box:fill-box; transform-origin:center; }
@media (prefers-reduced-motion: reduce){
  .lw-cloud,.lw-cloud2,.lw-cloud3,.lw-star,.lw-bird,.lw-tree,.lw-float,.lw-leaf,.lw-water,.lw-fire,.lw-particle,.lw-ambient,.lw-sun,.lw-shimmer,.lw-reveal,
  .lw-rain,.lw-snow,.lw-fog,.lw-flash,.lw-ripple{ animation:none !important; }
}
`;

// ── Avatar life & evolution animations ──
// Always-alive idle motion (breathe, blink, occasional glance) plus a
// session-complete celebration. All GPU-composited transforms/opacity.
const AVATAR_CSS = `
@keyframes avBreathe { 0%,100%{transform:translateY(0) scaleY(1);} 50%{transform:translateY(-1px) scaleY(1.015);} }
@keyframes avBlink   { 0%,94%,100%{transform:scaleY(1);} 96%{transform:scaleY(0.1);} 98%{transform:scaleY(1);} }
@keyframes avGlance  { 0%,88%,100%{transform:translateX(0);} 40%,60%{transform:translateX(1.5px);} }
@keyframes avCelebrate{ 0%{transform:translateY(0);} 20%{transform:translateY(-14px);} 40%{transform:translateY(0);} 55%{transform:translateY(-7px);} 70%{transform:translateY(0);} 100%{transform:translateY(0);} }
@keyframes avConfetti { 0%{transform:translateY(0) rotate(0);opacity:0;} 12%{opacity:1;} 100%{transform:translateY(90px) rotate(320deg);opacity:0;} }
@keyframes avGlowPulse{ 0%,100%{opacity:var(--av-glow-lo,0.12);} 50%{opacity:var(--av-glow-hi,0.26);} }
.av-breathe  { animation: avBreathe 4.2s ease-in-out infinite; transform-box:fill-box; transform-origin:center bottom; }
.av-eyes     { animation: avBlink 5.5s ease-in-out infinite; transform-box:fill-box; transform-origin:center; }
.av-glance   { animation: avGlance 9s ease-in-out infinite; transform-box:fill-box; }
.av-celebrate{ animation: avCelebrate 1.5s ease-in-out; transform-box:fill-box; }
.av-confetti { animation: avConfetti 1.4s ease-out forwards; transform-box:fill-box; }
.av-glow     { animation: avGlowPulse 3.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce){
  .av-breathe,.av-eyes,.av-glance,.av-celebrate,.av-confetti,.av-glow{ animation:none !important; }
}
`;

function LivingWorld({ lifetimeHours=0, streak=0, seedStr="lumora", focusing=false, weather=null }) {
  const W = 360, H = 200;
  const { unlocked } = worldState(lifetimeHours);
  const tod = timeOfDay();
  const wx = weather || weatherFor(new Date(), seedStr);
  const rnd = seedFrom(seedStr+"|world");
  const has = id => unlocked.has(id);
  // Overcast conditions dim the sky and hide sun/stars a little.
  const overcast = wx.id==="cloudy"||wx.id==="rain"||wx.id==="storm"||wx.id==="fog";
  const heavyDim = wx.id==="rain"||wx.id==="storm";
  const showStars = tod.stars>0 && !overcast;
  const starCount = Math.round(10 + tod.stars*30 + Math.min(streak,30));
  const stars = Array.from({length: showStars?starCount:0}, ()=>({ x:rnd()*W, y:rnd()*H*0.5, r:0.6+rnd()*1.4, d:rnd()*3.5 }));
  const fireCount = (!overcast && (tod.id==="night"||tod.id==="midnight"||tod.id==="sunset")) ? Math.min(3+Math.floor(streak/7),9) : 0;
  const fireflies = Array.from({length:fireCount}, ()=>({ x:40+rnd()*(W-80), y:120+rnd()*60, d:rnd()*6 }));
  const leafCount = (has("tree1") && wx.id!=="snow") ? (has("tree4")?6:3) : 0;
  const leaves = Array.from({length:leafCount}, ()=>({ x:40+rnd()*(W-80), d:rnd()*9, dur:7+rnd()*5 }));
  // Floating particles — ambient dust/pollen by day, soft motes of light by night.
  const particleCount = overcast ? 6 : 14;
  const particles = Array.from({length:particleCount}, ()=>({
    x: rnd()*W, y: 70+rnd()*110, r: 0.5+rnd()*1.3, d: rnd()*11, dur: 9+rnd()*7,
  }));
  const night = tod.stars>0.4;
  const particleFill = night ? "#FFF1C0" : "#FFFFFF";
  // ── Weather particle fields ──
  const rainCount = wx.id==="rain" ? Math.round(40*wx.intensity) : wx.id==="storm" ? Math.round(60*wx.intensity) : 0;
  const rain = Array.from({length:rainCount}, ()=>({ x:rnd()*W, d:rnd()*0.7, len:8+rnd()*8 }));
  const snowCount = wx.id==="snow" ? Math.round(34*wx.intensity) : 0;
  const snow = Array.from({length:snowCount}, ()=>({ x:rnd()*W, r:1+rnd()*2, d:rnd()*5, dur:4+rnd()*4 }));
  const rippleCount = (wx.id==="rain"||wx.id==="storm") ? 5 : 0;
  const ripples = Array.from({length:rippleCount}, ()=>({ x:30+rnd()*(W-60), y:165+rnd()*25, d:rnd()*1.4 }));
  const fogBands = wx.id==="fog" ? [ {y:120,o:0.22,d:0}, {y:140,o:0.30,d:4}, {y:160,o:0.26,d:8} ] : [];
  // Ambient light pulse range — dimmed under cloud/rain/storm.
  const wxGlowMul = wx.id==="storm"?0.4 : heavyDim?0.55 : overcast?0.7 : 1;
  const glowBase = tod.glow*(focusing?0.55:0.4)*wxGlowMul;
  const glowLo = (glowBase*0.6).toFixed(2);
  const glowHi = (glowBase*1.15).toFixed(2);
  const skyDim = wx.id==="storm"?0.42 : heavyDim?0.28 : wx.id==="cloudy"?0.16 : wx.id==="fog"?0.18 : 0;
  const tree = (x,by,scale,anim,hue) => (
    <g transform={`translate(${x} ${by}) scale(${scale})`}>
      <g className={`${anim?"lw-tree ":""}lw-reveal`}>
        <rect x={-3} y={-2} width={6} height={18} rx={2} fill="#7A5A3C"/>
        <circle cx={0}  cy={-12} r={15} fill={hue||"#5FAE72"}/>
        <circle cx={-10} cy={-6} r={11} fill={hue||"#5FAE72"} opacity={0.92}/>
        <circle cx={10} cy={-6} r={11} fill={hue||"#6FBE82"} opacity={0.92}/>
      </g>
    </g>
  );
  return (
    <div style={{position:"absolute",inset:0,borderRadius:20,overflow:"hidden"}} aria-hidden="true">
      <style>{WORLD_CSS}</style>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style={{display:"block"}}>
        <defs>
          <linearGradient id="lwSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor={tod.sky[0]}/>
            <stop offset="55%" stopColor={tod.sky[1]}/>
            <stop offset="100%" stopColor={tod.sky[2]}/>
          </linearGradient>
          <radialGradient id="lwSun" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={tod.sun} stopOpacity="0.95"/>
            <stop offset="100%" stopColor={tod.sun} stopOpacity="0"/>
          </radialGradient>
          <linearGradient id="lwGround" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tod.ground}/>
            <stop offset="100%" stopColor="#2F4A38"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={W} height={H} fill="url(#lwSky)"/>
        {tod.id==="midnight" && (
          <g opacity="0.35" className="lw-float">
            <path d="M0,40 Q90,10 180,40 T360,40" stroke="#6CF0C8" strokeWidth="14" fill="none" opacity="0.5"/>
            <path d="M0,55 Q90,28 180,55 T360,55" stroke="#8A7CF0" strokeWidth="10" fill="none" opacity="0.4"/>
          </g>
        )}
        {stars.map((s,i)=>(
          <circle key={i} className="lw-star" cx={s.x} cy={s.y} r={s.r} fill="#FFFDF5" style={{animationDelay:`${s.d}s`}}/>
        ))}
        {has("constellation") && tod.stars>0 && (
          <g stroke="#FFF6C8" strokeWidth="0.8" opacity="0.8" fill="#FFF6C8">
            <polyline points="60,30 80,46 104,38 120,54" fill="none"/>
            <circle cx="60" cy="30" r="1.6"/><circle cx="80" cy="46" r="1.6"/>
            <circle cx="104" cy="38" r="1.6"/><circle cx="120" cy="54" r="1.6"/>
          </g>
        )}
        <circle cx={W-70} cy={50} r={46} fill="url(#lwSun)" className="lw-ambient"
                style={{"--lw-glow-lo":0.5,"--lw-glow-hi":0.9}}/>
        <circle className="lw-sun" cx={W-70} cy={50} r={tod.stars>0.5?13:18} fill={tod.sun} opacity={tod.stars>0.5?0.9:0.85}/>
        <g className="lw-cloud"  opacity="0.85"><ellipse cx="40" cy="44" rx="26" ry="11" fill="#FFFFFF"/><ellipse cx="62" cy="40" rx="18" ry="9" fill="#FFFFFF"/></g>
        <g className="lw-cloud2" opacity="0.6"><ellipse cx="160" cy="30" rx="22" ry="9" fill="#FFFFFF"/><ellipse cx="178" cy="27" rx="14" ry="7" fill="#FFFFFF"/></g>
        <g className="lw-cloud3" opacity="0.5"><ellipse cx="240" cy="58" rx="20" ry="8" fill="#FFFFFF"/><ellipse cx="256" cy="55" rx="13" ry="6" fill="#FFFFFF"/></g>
        {has("floatingIsland") && (
          <g transform="translate(70 78)">
            <g className="lw-float lw-reveal">
              <ellipse cx="0" cy="0" rx="26" ry="8" fill="#6B8E5A"/>
              <path d="M-26,0 L-14,18 L14,18 L26,0 Z" fill="#5A4632"/>
              {tree(0,-2,0.7,true,"#7CCF8C")}
            </g>
          </g>
        )}
        {(tod.id==="dawn"||tod.id==="day") && (
          <>
            <g className="lw-bird" opacity="0.7" style={{animationDelay:"0s"}}>
              <path d="M0,60 q5,-5 10,0 q5,-5 10,0" stroke="#3A3A55" strokeWidth="2" fill="none"/>
            </g>
            <g transform="translate(0 -14) scale(.8)">
              <g className="lw-bird" opacity="0.5" style={{animationDelay:"6s"}}>
                <path d="M0,60 q5,-5 10,0 q5,-5 10,0" stroke="#3A3A55" strokeWidth="2" fill="none"/>
              </g>
            </g>
            <g transform="translate(0 8) scale(.7)">
              <g className="lw-bird" opacity="0.55" style={{animationDelay:"11s"}}>
                <path d="M0,60 q5,-5 10,0 q5,-5 10,0" stroke="#3A3A55" strokeWidth="2" fill="none"/>
              </g>
            </g>
          </>
        )}
        {has("hill") && (
          <g className="lw-reveal">
            <path d={`M0,150 Q70,110 150,150 T360,150 L360,${H} L0,${H} Z`} fill="#5C7A55" opacity="0.7"/>
          </g>
        )}
        <path d={`M0,150 Q120,140 240,150 T360,150 L360,${H} L0,${H} Z`} fill="url(#lwGround)"/>
        {has("grass") && (
          <path d="M0,152 Q120,144 240,152 T360,152 L360,160 L0,160 Z" fill="#7FBE6A" opacity="0.5" className="lw-reveal"/>
        )}
        {has("river") && (
          <g className="lw-reveal">
            <path d="M250,150 C235,168 255,182 240,200" stroke="#9FD8E6" strokeWidth="10" fill="none" opacity="0.85"/>
            <path d="M250,150 C235,168 255,182 240,200" className="lw-water" stroke="#E8FBFF" strokeWidth="3" fill="none"/>
          </g>
        )}
        {has("waterfall") && has("hill") && (
          <g className="lw-reveal">
            <rect x="300" y="120" width="9" height="34" rx="3" fill="#BFEAF2" opacity="0.9"/>
            <rect x="300" y="120" width="9" height="34" rx="3" className="lw-water" stroke="#FFFFFF" strokeWidth="1.4" fill="none"/>
          </g>
        )}
        {has("tree1") && tree(70,150,1,true)}
        {has("tree2") && tree(110,152,0.8,true,"#6CB97E")}
        {has("tree3") && tree(40,153,0.7,true,"#54A56A")}
        {has("tree4") && tree(150,151,0.9,true,"#62B277")}
        {has("tree5") && tree(20,154,0.6,true,"#7CCF8C")}
        {has("bush")  && <ellipse cx={190} cy={156} rx={14} ry={9} fill="#5FAE72" className="lw-reveal"/>}
        {has("house1") && (
          <g transform="translate(280 128)">
            <g className="lw-reveal">
              <rect x="0" y="6" width="22" height="18" fill="#C98A5E"/>
              <path d="M-2,6 L11,-4 L24,6 Z" fill="#8A4B36"/>
              <rect x="8" y="14" width="6" height="10" fill="#5A3A28"/>
              {(tod.stars>0.3) && <rect x="3" y="10" width="5" height="5" fill="#FFD86B"/>}
            </g>
          </g>
        )}
        {has("house2") && (
          <g transform="translate(315 134)">
            <g className="lw-reveal">
              <rect x="0" y="4" width="16" height="14" fill="#B8C4D0"/>
              <path d="M-2,4 L8,-3 L18,4 Z" fill="#6B7785"/>
              {(tod.stars>0.3) && <rect x="3" y="8" width="4" height="4" fill="#FFD86B"/>}
            </g>
          </g>
        )}
        {has("ruins") && (
          <g transform="translate(135 132)" opacity="0.9">
            <g className="lw-reveal">
              <rect x="0" y="0" width="5" height="20" fill="#C9C2B0"/>
              <rect x="16" y="0" width="5" height="20" fill="#C9C2B0"/>
              <rect x="-3" y="-4" width="27" height="5" rx="2" fill="#D8D2C2"/>
            </g>
          </g>
        )}
        {leaves.map((l,i)=>(
          <g key={i} transform={`translate(${l.x} 0)`}>
            <path className="lw-leaf" d="M0,0 q4,-3 8,0 q-4,3 -8,0 Z" fill="#E0A85C"
                  style={{animationDelay:`${l.d}s`,animationDuration:`${l.dur}s`,transformBox:"fill-box"}}/>
          </g>
        ))}
        {fireflies.map((f,i)=>(
          <circle key={i} className="lw-fire" cx={f.x} cy={f.y} r="2" fill="#FFE89A" style={{animationDelay:`${f.d}s`}}/>
        ))}
        {/* Floating particles — soft ambient dust by day, motes of light by night */}
        {particles.map((p,i)=>(
          <circle key={"p"+i} className="lw-particle" cx={p.x} cy={p.y} r={p.r} fill={particleFill}
                  style={{animationDelay:`${p.d}s`,animationDuration:`${p.dur}s`,
                          filter: night ? "drop-shadow(0 0 2px #FFE89A)" : "none"}}/>
        ))}

        {/* ── WEATHER ── */}
        {/* Overcast sky dimming (grey wash under cloud/rain/storm/fog) */}
        {skyDim>0 && <rect x="0" y="0" width={W} height={H} fill="#48506A" opacity={skyDim}/>}
        {/* Rain ripples on the ground */}
        {ripples.map((r,i)=>(
          <ellipse key={"rp"+i} className="lw-ripple" cx={r.x} cy={r.y} rx="5" ry="1.6"
                   fill="none" stroke="#CFE8F0" strokeWidth="0.8" style={{animationDelay:`${r.d}s`}}/>
        ))}
        {/* Rain */}
        {rain.map((r,i)=>(
          <line key={"rn"+i} className="lw-rain" x1={r.x} y1="-10" x2={r.x-2} y2={-10+r.len}
                stroke="#C3DDEC" strokeWidth="1.2" opacity="0.6"
                style={{animationDelay:`${r.d}s`}}/>
        ))}
        {/* Snow */}
        {snow.map((s,i)=>(
          <circle key={"sn"+i} className="lw-snow" cx={s.x} cy="-8" r={s.r} fill="#FFFFFF" opacity="0.9"
                  style={{animationDelay:`${s.d}s`,animationDuration:`${s.dur}s`}}/>
        ))}
        {/* Fog banks drifting over the ground */}
        {fogBands.map((f,i)=>(
          <ellipse key={"fg"+i} className="lw-fog" cx={W/2} cy={f.y} rx={W*0.7} ry="18"
                   fill="#E8EBF2" opacity={f.o} style={{animationDelay:`${f.d}s`}}/>
        ))}
        {/* Lightning flash (storm only) */}
        {wx.id==="storm" && (
          <rect className="lw-flash" x="0" y="0" width={W} height={H} fill="#EAF0FF"
                style={{mixBlendMode:"screen"}}/>
        )}

        {/* Soft ambient lighting — gently breathes between glowLo and glowHi */}
        <rect className="lw-ambient" x="0" y="0" width={W} height={H} fill={tod.sun}
              style={{mixBlendMode:"soft-light","--lw-glow-lo":glowLo,"--lw-glow-hi":glowHi}}/>
        {/* Faint warm vignette near the horizon for depth (shimmers slowly) */}
        <rect className="lw-shimmer" x="0" y={H-60} width={W} height="60" fill={tod.sun} opacity="0.12"
              style={{mixBlendMode:"soft-light"}}/>
      </svg>
    </div>
  );
}
function AvatarSVG({ progress=0.5, tier="sprout", equipped={}, color="#5B8DEF", paused=false, large=false, idle=false, celebrate=false }) {
  const uid = useId().replace(/:/g, "");
  const W = large ? 240 : 160, H = large ? 260 : 190;
  const size = large ? 240 : 160;
  const u = large ? 1 : 0.68;
  const cx = W/2;
  const groundY = H - (large ? 24 : 16);
  const tierIdx = Math.max(0, EVO_TIERS.findIndex(t=>t.id===tier));
  const stage = EVO_TIERS[tierIdx] || EVO_TIERS[0];
  const stages = [
    { bodyH:54,  headR:31, topW:23, botW:31, robeA:"#EEE9FF", robeB:"#A99BFF", glow:"#FFE6A8" },
    { bodyH:70,  headR:30, topW:25, botW:34, robeA:"#DCEBFF", robeB:"#87B6F2", glow:"#CDEBFF" },
    { bodyH:86,  headR:28, topW:27, botW:38, robeA:"#DDE8FF", robeB:"#6F9EEA", glow:"#BFDFFF" },
    { bodyH:96,  headR:27, topW:29, botW:41, robeA:"#DCD8FF", robeB:"#7668E8", glow:"#C8C0FF" },
    { bodyH:104, headR:26, topW:30, botW:43, robeA:"#E6D8FF", robeB:"#8D66DC", glow:"#DCC6FF" },
    { bodyH:111, headR:25, topW:32, botW:45, robeA:"#F1DFFF", robeB:"#A45FD1", glow:"#F0C9FF" },
    { bodyH:116, headR:25, topW:33, botW:47, robeA:"#FFF0D5", robeB:"#B477D8", glow:"#FFE6A8" },
    { bodyH:120, headR:24, topW:34, botW:49, robeA:"#FFF3D9", robeB:"#876FE8", glow:"#FFF0B8" },
  ];
  const cfg = stages[Math.min(tierIdx, stages.length-1)];
  const bodyH = cfg.bodyH*u, headR = cfg.headR*u;
  const topW = cfg.topW*u, botW = cfg.botW*u;
  const headCy = groundY - bodyH - headR*.48;
  const bodyTopY = headCy + headR*.72;
  const isBaby = tierIdx===0;
  const opacity = paused ? .58 : 1;
  const sessionScale = idle ? 1 : .96 + Math.min(1,progress)*.04;
  const auraCenterY = headCy + (groundY-headCy)*.48;
  const auraRadius = (bodyH*.62 + headR) * (1 + Math.min(1,progress)*.05);
  const skin = "#F1C9A4", skinShade = "#DAA982";

  const hat = cosmeticById(equipped.hat);
  const aura = cosmeticById(equipped.aura);
  const pet = cosmeticById(equipped.pet);
  const auraTone = aura?.draw==="glow" || aura?.draw==="galaxy" ? aura.color : cfg.glow;

  const robeGradient = `${uid}-robe`;
  const skinGradient = `${uid}-skin`;
  const auraGradient = `${uid}-aura`;
  const lightGradient = `${uid}-light`;
  const blur = `${uid}-blur`;
  const baseProps = {
    viewBox:`0 0 ${W} ${H}`, width:size, height:large?260:190,
    className:`lm-avatar-svg${celebrate?" is-celebrating":""}`, role:"img",
    "aria-label":`${stage.name}, growth stage ${tierIdx+1} of ${EVO_TIERS.length}`,
    style:{overflow:"visible",filter:paused?"grayscale(35%)":"drop-shadow(0 16px 22px rgba(48,38,96,.18))",transition:"filter .4s"},
  };

  const bubbles = [
    [-.74,.18,4,-1.2,5.2],[-.56,.72,2.6,-3.4,4.6],[-.34,.04,3,-2.1,5.8],
    [.38,.14,3.4,-4.1,5.4],[.58,.62,2.5,-.8,4.8],[.76,.30,4,-2.8,6.1],
    [-.12,.82,2.2,-1.7,4.4],[.15,.48,2.8,-3.1,5.1],
  ];
  const celebration = [
    [-28,-35,-34,-42,"#FFE28A"],[24,-40,30,-46,"#CDBFFF"],[-42,-5,-48,-22,"#8DE1D1"],
    [38,-8,48,-25,"#FFB2C8"],[-12,-55,-8,-52,"#FFFFFF"],[12,-18,18,-38,"#FFD28C"],
  ];

  const body = isBaby ? (
    <g opacity={opacity}>
      <path d={`M${cx-topW*.88} ${bodyTopY-2} Q${cx} ${bodyTopY-10} ${cx+topW*.88} ${bodyTopY-2}
                Q${cx+botW*1.02} ${groundY-20*u} ${cx} ${groundY}
                Q${cx-botW*1.02} ${groundY-20*u} ${cx-topW*.88} ${bodyTopY-2} Z`}
            fill={`url(#${robeGradient})`} stroke="rgba(255,255,255,.68)" strokeWidth={1.4*u}/>
      <path d={`M${cx-topW*.68} ${bodyTopY+15*u} Q${cx+4*u} ${bodyTopY+28*u} ${cx+botW*.6} ${groundY-15*u}`}
            fill="none" stroke="rgba(255,255,255,.62)" strokeWidth={3*u} strokeLinecap="round"/>
      <path d={`M${cx+topW*.66} ${bodyTopY+14*u} Q${cx-2*u} ${bodyTopY+29*u} ${cx-botW*.48} ${groundY-14*u}`}
            fill="none" stroke="rgba(84,68,159,.18)" strokeWidth={1.2*u} strokeLinecap="round"/>
      <circle cx={cx-topW*.65} cy={bodyTopY+8*u} r={4*u} fill={`url(#${skinGradient})`}/>
    </g>
  ) : (
    <g opacity={opacity}>
      <path d={`M${cx-topW} ${bodyTopY} Q${cx-topW*1.12} ${groundY-bodyH*.42} ${cx-botW} ${groundY}
                L${cx+botW} ${groundY} Q${cx+topW*1.12} ${groundY-bodyH*.42} ${cx+topW} ${bodyTopY} Z`}
            fill={`url(#${robeGradient})`} stroke="rgba(255,255,255,.52)" strokeWidth={1.35*u}/>
      <path d={`M${cx-topW} ${bodyTopY+3*u} Q${cx} ${bodyTopY+17*u} ${cx+topW} ${bodyTopY+3*u}`}
            fill="none" stroke="rgba(255,255,255,.72)" strokeWidth={(tierIdx>=4?4:2.5)*u} strokeLinecap="round"/>
      <path d={`M${cx-topW*.78} ${bodyTopY+15*u} Q${cx-topW*1.34} ${bodyTopY+38*u} ${cx-topW*.72} ${bodyTopY+50*u}`}
            fill="none" stroke={cfg.robeB} strokeWidth={10*u} strokeLinecap="round" opacity=".88"/>
      <path d={`M${cx+topW*.78} ${bodyTopY+15*u} Q${cx+topW*1.34} ${bodyTopY+38*u} ${cx+topW*.72} ${bodyTopY+50*u}`}
            fill="none" stroke={cfg.robeB} strokeWidth={10*u} strokeLinecap="round" opacity=".88"/>
      <circle cx={cx-topW*.72} cy={bodyTopY+51*u} r={4.5*u} fill={`url(#${skinGradient})`}/>
      <circle cx={cx+topW*.72} cy={bodyTopY+51*u} r={4.5*u} fill={`url(#${skinGradient})`}/>
      {tierIdx>=2 && (
        <g>
          <circle cx={cx} cy={bodyTopY+51*u} r={(8+tierIdx*.6)*u} fill={`url(#${lightGradient})`} filter={`url(#${blur})`} opacity=".75"/>
          <circle cx={cx} cy={bodyTopY+51*u} r={(3.5+tierIdx*.25)*u} fill="#FFF8CF" stroke="#fff" strokeWidth={.8*u}/>
        </g>
      )}
      {tierIdx>=5 && <path d={`M${cx-botW*.72} ${groundY-20*u} Q${cx} ${groundY-29*u} ${cx+botW*.72} ${groundY-20*u}`}
        fill="none" stroke="#FFE6A2" strokeWidth={2*u} opacity=".82"/>}
    </g>
  );

  const head = (
    <g opacity={opacity}>
      <circle cx={cx} cy={headCy} r={headR} fill={`url(#${skinGradient})`} stroke="rgba(255,255,255,.7)" strokeWidth={1.3*u}/>
      {isBaby ? (
        <path d={`M${cx-5*u} ${headCy-headR*.96} C${cx-13*u} ${headCy-headR-8*u} ${cx+3*u} ${headCy-headR-12*u} ${cx+4*u} ${headCy-headR-3*u}
                  C${cx+4*u} ${headCy-headR+2*u} ${cx-2*u} ${headCy-headR+1*u} ${cx-1*u} ${headCy-headR-4*u}`}
              fill="none" stroke="#72513C" strokeWidth={2.8*u} strokeLinecap="round"/>
      ) : (
        <path d={`M${cx-headR*1.02} ${headCy-headR*.08} Q${cx-headR*.8} ${headCy-headR*1.02} ${cx} ${headCy-headR*1.08}
                  Q${cx+headR*.82} ${headCy-headR*1.02} ${cx+headR*1.02} ${headCy-headR*.08}
                  Q${cx+headR*.56} ${headCy-headR*.53} ${cx} ${headCy-headR*.47}
                  Q${cx-headR*.56} ${headCy-headR*.53} ${cx-headR*1.02} ${headCy-headR*.08} Z`}
              fill={["#72513C","#674735","#51382E","#4C382F","#5B4538","#66503F","#715B47","#806A50"][tierIdx]}/>
      )}
      {!paused ? (
        <g className="lm-avatar-eyes">
          <ellipse cx={cx-headR*.34} cy={headCy+headR*.08} rx={headR*.095} ry={headR*.125} fill="#34313D"/>
          <ellipse cx={cx+headR*.34} cy={headCy+headR*.08} rx={headR*.095} ry={headR*.125} fill="#34313D"/>
          <circle cx={cx-headR*.31} cy={headCy+headR*.035} r={headR*.032} fill="#fff"/>
          <circle cx={cx+headR*.37} cy={headCy+headR*.035} r={headR*.032} fill="#fff"/>
        </g>
      ) : (
        <g stroke="#4B4140" strokeWidth={1.6*u} strokeLinecap="round">
          <path d={`M${cx-headR*.5} ${headCy+headR*.08} Q${cx-headR*.34} ${headCy+headR*.17} ${cx-headR*.18} ${headCy+headR*.08}`}/>
          <path d={`M${cx+headR*.18} ${headCy+headR*.08} Q${cx+headR*.34} ${headCy+headR*.17} ${cx+headR*.5} ${headCy+headR*.08}`}/>
        </g>
      )}
      <path d={`M${cx-headR*.22} ${headCy+headR*.48} Q${cx} ${headCy+headR*(isBaby?.58:.66)} ${cx+headR*.22} ${headCy+headR*.48}`}
            stroke="#B57664" strokeWidth={1.5*u} fill="none" strokeLinecap="round"/>
      {isBaby && <>
        <circle cx={cx-headR*.58} cy={headCy+headR*.38} r={headR*.12} fill="#F29A9A" opacity=".23"/>
        <circle cx={cx+headR*.58} cy={headCy+headR*.38} r={headR*.12} fill="#F29A9A" opacity=".23"/>
      </>}
    </g>
  );

  let hatEl = null;
  if(hat && hat.draw!=="none"){
    const hy = headCy-headR*.86;
    if(hat.draw==="cap") hatEl = <g opacity={opacity}><path d={`M${cx-headR*.95} ${hy+headR*.35} Q${cx} ${hy-headR*.5} ${cx+headR*.95} ${hy+headR*.35} Z`} fill={hat.color}/><ellipse cx={cx+headR*.7} cy={hy+headR*.4} rx={headR*.55} ry={headR*.14} fill={hat.color}/></g>;
    else if(hat.draw==="beanie") hatEl = <g opacity={opacity}><path d={`M${cx-headR} ${hy+headR*.5} Q${cx} ${hy-headR*.65} ${cx+headR} ${hy+headR*.5} Z`} fill={hat.color}/><rect x={cx-headR} y={hy+headR*.4} width={headR*2} height={headR*.28} rx={headR*.14} fill={hat.color} opacity=".82"/><circle cx={cx} cy={hy-headR*.45} r={headR*.18} fill="#fff"/></g>;
    else if(hat.draw==="grad") hatEl = <g opacity={opacity}><polygon points={`${cx},${hy-headR*.35} ${cx-headR*1.25},${hy+headR*.1} ${cx},${hy+headR*.55} ${cx+headR*1.25},${hy+headR*.1}`} fill={hat.color}/><line x1={cx+headR*1.08} y1={hy+headR*.1} x2={cx+headR*1.08} y2={hy+headR*.72} stroke="#E8B84B" strokeWidth={1.5*u}/></g>;
    else if(hat.draw==="crown") hatEl = <path d={`M${cx-headR*.86} ${hy+headR*.5} L${cx-headR*.86} ${hy} L${cx-headR*.4} ${hy+headR*.3} L${cx} ${hy-headR*.2} L${cx+headR*.4} ${hy+headR*.3} L${cx+headR*.86} ${hy} L${cx+headR*.86} ${hy+headR*.5} Z`} fill={hat.color} stroke="#C99A2E" strokeWidth={u}/>;
    else if(hat.draw==="halo") hatEl = <ellipse cx={cx} cy={headCy-headR*1.25} rx={headR*.86} ry={headR*.27} fill="none" stroke={hat.color} strokeWidth={4*u} opacity={paused?.4:.95}/>;
  }

  let petEl = null;
  if(pet && pet.draw!=="none"){
    const px=cx+66*u, py=groundY-20*u+Math.sin(progress*8)*3*u;
    if(pet.draw==="cat") petEl = <g opacity={opacity}><ellipse cx={px} cy={py} rx={11*u} ry={9*u} fill={pet.color}/><circle cx={px} cy={py-9*u} r={7*u} fill={pet.color}/><path d={`M${px-6*u} ${py-12*u} l${4*u} ${-5*u} l${3*u} ${6*u} M${px+6*u} ${py-12*u} l${-4*u} ${-5*u} l${-3*u} ${6*u}`} fill={pet.color} stroke={pet.color} strokeWidth={2*u}/><circle cx={px-2.5*u} cy={py-9*u} r={1.2*u} fill="#25232A"/><circle cx={px+2.5*u} cy={py-9*u} r={1.2*u} fill="#25232A"/></g>;
    else if(pet.draw==="owl") petEl = <g opacity={opacity}><ellipse cx={px} cy={py} rx={10*u} ry={12*u} fill={pet.color}/><circle cx={px-3.5*u} cy={py-3*u} r={3.5*u} fill="#fff"/><circle cx={px+3.5*u} cy={py-3*u} r={3.5*u} fill="#fff"/><circle cx={px-3.5*u} cy={py-3*u} r={1.4*u} fill="#25232A"/><circle cx={px+3.5*u} cy={py-3*u} r={1.4*u} fill="#25232A"/></g>;
    else if(pet.draw==="sprite") petEl = <g opacity={paused?.4:.95}><circle cx={px} cy={py} r={10*u} fill={pet.color} opacity=".18"/><circle cx={px} cy={py} r={4*u} fill={pet.color}/><circle cx={px-5*u} cy={py-2*u} r={1.2*u} fill="#fff"/><circle cx={px+5*u} cy={py+2*u} r={1.2*u} fill="#fff"/></g>;
  }

  return (
    <svg {...baseProps}>
      <defs>
        <linearGradient id={robeGradient} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={cfg.robeA}/><stop offset="52%" stopColor={color}/><stop offset="100%" stopColor={cfg.robeB}/></linearGradient>
        <radialGradient id={skinGradient} cx="34%" cy="25%" r="80%"><stop offset="0%" stopColor="#FFE9D0"/><stop offset="70%" stopColor={skin}/><stop offset="100%" stopColor={skinShade}/></radialGradient>
        <radialGradient id={auraGradient}><stop offset="0%" stopColor="#fff" stopOpacity=".78"/><stop offset="36%" stopColor={auraTone} stopOpacity=".45"/><stop offset="100%" stopColor={auraTone} stopOpacity="0"/></radialGradient>
        <radialGradient id={lightGradient}><stop offset="0%" stopColor="#fff"/><stop offset="44%" stopColor="#FFF4B5"/><stop offset="100%" stopColor={auraTone} stopOpacity="0"/></radialGradient>
        <filter id={blur} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation={5*u}/></filter>
      </defs>

      <circle className="lm-avatar-aura" cx={cx} cy={auraCenterY} r={auraRadius*1.13} fill={`url(#${auraGradient})`} opacity={paused?.25:.72}/>
      <g className="lm-avatar-orbit" opacity={paused?.15:.36}>
        <ellipse cx={cx} cy={auraCenterY} rx={auraRadius*.88} ry={auraRadius*.64} fill="none" stroke={auraTone} strokeWidth={1.2*u} strokeDasharray={`${2*u} ${9*u}`}/>
      </g>
      {bubbles.map(([dx,dy,r,d,t],i)=><circle key={i} className="lm-effervescent-bubble" cx={cx+dx*auraRadius} cy={auraCenterY+dy*auraRadius*.55} r={r*u} fill="none" stroke={i%3===0?"#fff":auraTone} strokeWidth={1.15*u} opacity=".72" style={{"--bubble-delay":`${d}s`,"--bubble-duration":`${t}s`}}/>)}
      {aura?.draw==="galaxy" && <g className="lm-avatar-orbit">{[0,1,2,3,4,5].map(i=>{const a=i*Math.PI/3, rr=auraRadius*.93;return <circle key={i} cx={cx+Math.cos(a)*rr} cy={auraCenterY+Math.sin(a)*rr*.7} r={2.2*u} fill="#fff"/>;})}</g>}

      <ellipse cx={cx} cy={groundY+5*u} rx={botW*1.28} ry={7*u} fill="rgba(34,29,74,.14)" filter={`url(#${blur})`}/>
      <g transform={`translate(${cx} ${groundY}) scale(${sessionScale}) translate(${-cx} ${-groundY})`}>
        <g className="lm-avatar-figure">
          {body}
          {petEl}
          {head}
          {hatEl}
        </g>
      </g>

      {celebrate && celebration.map(([x,y,tx,ty,c],i)=><circle key={i} className="lm-celebrate-spark" cx={cx+x*u} cy={auraCenterY+y*u*.25} r={(i%2?3:4)*u} fill={c} style={{"--spark-x":`${tx*u}px`,"--spark-y":`${ty*u}px`,animationDelay:`${i*.06}s`}}/>)}
      {paused && <g opacity=".72" transform={`translate(${cx-12*u} ${headCy-headR*1.75})`}><rect width={24*u} height={20*u} rx={10*u} fill="rgba(28,25,53,.55)"/><rect x={8*u} y={6*u} width={3*u} height={8*u} rx={1.5*u} fill="#fff"/><rect x={14*u} y={6*u} width={3*u} height={8*u} rx={1.5*u} fill="#fff"/></g>}
    </svg>
  );
}

// ── Toast ───────────────────────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((msg) => { setToast(msg); setTimeout(()=>setToast(null), 2600); }, []);
  const node = toast ? <div style={S.toast} className="sg-pop-anim">{toast}</div> : null;
  return [node, show];
}

// ── "Focusing now" presence strip ────────────────────────────────────────────────
function FocusingNow({ presence, currentUser, scopeLabel }) {
  if (!presence || presence.length === 0) {
    return (
      <div style={S.presenceEmpty}>
        <span style={{fontSize:13}}>No one's focusing right now{scopeLabel?` in ${scopeLabel}`:""}.</span>
        <span style={{fontSize:12,color:BRAND.mutedSoft}}>Start a session to light up the campus.</span>
      </div>
    );
  }
  return (
    <div style={S.presenceWrap}>
      <div style={S.presenceTitle}>
        <span style={{...S.liveDot}}/> Focusing now{scopeLabel?` · ${scopeLabel}`:""} ({presence.length})
      </div>
      <div style={S.presenceRow}>
        {presence.map(p=>(
          <div key={p.username} style={{...S.presenceChip, ...(p.username===currentUser?{borderColor:BRAND.primary,background:BRAND.primarySoft}:{})}}>
            <span style={{fontSize:15}}>{p.subjEmoji||"📚"}</span>
            <div style={{display:"flex",flexDirection:"column"}}>
              <span style={{fontSize:12,fontWeight:700,color:BRAND.ink}}>{p.username}{p.username===currentUser?" (you)":""}</span>
              <span style={{fontSize:10,color:p.subjColor||"#888"}}>{p.subjLabel||"studying"}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Leaderboard panel ─────────────────────────────────────────────────────────────
function LeaderboardPanel({ data, currentUser, loading, subjects, title }) {
  const [scope, setScope] = useState("weekly"); // weekly | allTime
  const rows = scope==="weekly" ? data.weekly : data.allTime;
  const medal = i => i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}`;
  return (
    <div>
      {title && <div style={S.sectionTitle}>{title}</div>}
      <div style={S.toggleRow}>
        <button style={{...S.toggleBtn,...(scope==="weekly"?S.toggleBtnActive:{})}} onClick={()=>setScope("weekly")}>This week</button>
        <button style={{...S.toggleBtn,...(scope==="allTime"?S.toggleBtnActive:{})}} onClick={()=>setScope("allTime")}>All time</button>
      </div>
      {loading ? <div style={S.empty}>Loading…</div> :
       rows.length===0 ? <div style={S.empty}>No focus time logged yet. Be the first.</div> :
       rows.map((r,i)=>(
        <div key={r.username} style={{...S.boardRow,...(r.username===currentUser?S.boardRowMe:{})}} className="sg-card-anim" >
          <div style={S.boardRank}>{medal(i)}</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:14,color:BRAND.ink}}>{r.username}{r.username===currentUser?" (you)":""}</div>
            <div style={{fontSize:11,color:BRAND.muted}}>{r.sessions||0} sessions</div>
          </div>
          <div style={{fontWeight:800,fontSize:15,color:BRAND.primary}}>{fmtMins(r.totalSecs||0)}</div>
        </div>
      ))}
    </div>
  );
}

// ── Class campus — classmates' avatars populate a shared space ────────────────────
function ClassCampus({ cls, presence, board, currentUser, onLeave, loading }) {
  // Build avatar tiles: members from board (with focus totals) + live presence overlay.
  const liveSet = new Set(presence.map(p=>p.username));
  const members = (cls?.members || []);
  const byUser = {};
  board.forEach(b => { byUser[b.username] = b; });
  return (
    <div>
      <div style={S.campusHeader}>
        <div>
          <div style={{fontSize:18,fontWeight:800,color:BRAND.primary}}>{cls.name}</div>
          <div style={{fontSize:12,color:BRAND.muted}}>Code <b style={{letterSpacing:1}}>{cls.code}</b> · {members.length} members</div>
        </div>
        <button style={S.smallGhostBtn} onClick={onLeave}>Leave</button>
      </div>

      <div style={S.campusGrid}>
        {members.length===0 && <div style={S.empty}>No members yet. Share the code.</div>}
        {members.map(u=>{
          const live = liveSet.has(u);
          const b = byUser[u];
          const secs = b?.totalSecs || 0;
          const lvl = levelFromXp(Math.floor(secs/60)); // rough display level from class focus
          const tier = tierForLevel(lvl).id;
          return (
            <div key={u} style={{...S.campusTile,...(live?{borderColor:BRAND.primary,boxShadow:`0 0 0 3px ${BRAND.primarySoft}`}:{})}} className="sg-card-anim">
              {live && <div style={S.campusLive}><span style={S.liveDot}/>focusing</div>}
              <AvatarSVG progress={live?0.8:0.55} tier={tier} idle={!live} color="#5B8DEF"/>
              <div style={{fontSize:13,fontWeight:700,color:BRAND.ink,marginTop:-6}}>{u}{u===currentUser?" (you)":""}</div>
              <div style={{fontSize:11,color:BRAND.muted}}>{fmtMins(secs)} this week</div>
            </div>
          );
        })}
      </div>

      <div style={{marginTop:18}}>
        <LeaderboardPanel data={{weekly:board, allTime:board}} currentUser={currentUser} loading={loading} title="Class leaderboard"/>
      </div>
    </div>
  );
}

// ── Analytics panel ───────────────────────────────────────────────────────────────
function AnalyticsPanel({ user, subjects, targets }) {
  const [history, setHistory] = useState(null);
  const [range, setRange] = useState("week"); // week | month | year
  useEffect(()=>{ let on=true; fbLoadHistory(user).then(h=>on&&setHistory(h)); return ()=>{on=false;}; }, [user]);
  if (history===null) return <div style={S.empty}>Loading…</div>;
  if (history.length===0) return <div style={S.empty}>No sessions yet. Your stats will grow here.</div>;

  const now = new Date();
  const start = range==="week"?startOfWeek(now):range==="month"?startOfMonth(now):startOfYear(now);
  const inRange = history.filter(s=>new Date(s.ts)>=start);
  const totalSecs = inRange.reduce((a,s)=>a+s.secs,0);

  // streak
  const days = new Set(history.map(s=>startOfDay(new Date(s.ts)).getTime()));
  let streak=0; let cur=startOfDay(now).getTime();
  while(days.has(cur)){ streak++; cur-=86400000; }
  if(streak===0){ const y=startOfDay(now).getTime()-86400000; let c=y; while(days.has(c)){streak++; c-=86400000;} }

  // per-subject totals in range
  const subjTotals = {};
  inRange.forEach(s=>{ subjTotals[s.subject]=(subjTotals[s.subject]||0)+s.secs; });
  const subjArr = Object.entries(subjTotals).map(([id,secs])=>{
    const so = subjects.find(x=>x.id===id) || { label:id, color:"#aaa", emoji:"📚" };
    return { ...so, secs };
  }).sort((a,b)=>b.secs-a.secs);
  const maxSubj = Math.max(1, ...subjArr.map(s=>s.secs));

  // last-7-days bars
  const bars = [...Array(7)].map((_,i)=>{
    const d = startOfDay(new Date(now.getTime()-(6-i)*86400000));
    const key = d.getTime();
    const secs = history.filter(s=>startOfDay(new Date(s.ts)).getTime()===key).reduce((a,s)=>a+s.secs,0);
    return { label: DAY_LABELS[d.getDay()], secs };
  });
  const maxBar = Math.max(1, ...bars.map(b=>b.secs));

  return (
    <div>
      <div style={S.statCardRow}>
        <div style={S.statCard}><div style={S.statNum}>{fmtHrs(totalSecs)}</div><div style={S.statLbl}>focused</div></div>
        <div style={S.statCard}><div style={S.statNum}>{inRange.length}</div><div style={S.statLbl}>sessions</div></div>
        <div style={S.statCard}><div style={S.statNum}>{streak}🔥</div><div style={S.statLbl}>day streak</div></div>
      </div>

      <div style={S.toggleRow}>
        {["week","month","year"].map(r=>(
          <button key={r} style={{...S.toggleBtn,...(range===r?S.toggleBtnActive:{})}} onClick={()=>setRange(r)}>
            {r==="week"?"Week":r==="month"?"Month":"Year"}
          </button>
        ))}
      </div>

      <div style={S.panel}>
        <div style={S.panelTitle}>Last 7 days</div>
        <div style={S.barRow}>
          {bars.map((b,i)=>(
            <div key={i} style={S.barCol}>
              <div style={S.barTrack}>
                <div style={{...S.barFill, height:`${(b.secs/maxBar)*100}%`, background: b.secs>0?BRAND.primary:BRAND.track}}/>
              </div>
              <div style={S.barLbl}>{b.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={S.panel}>
        <div style={S.panelTitle}>By subject</div>
        {subjArr.map(s=>(
          <div key={s.id} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
              <span style={{fontWeight:600,color:BRAND.ink}}>{s.emoji} {s.label}</span>
              <span style={{color:BRAND.muted}}>{fmtMins(s.secs)}</span>
            </div>
            <div style={S.targetTrack}><div style={{...S.targetFill,width:`${(s.secs/maxSubj)*100}%`,background:s.color}}/></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Generic modal shell ───────────────────────────────────────────────────────────
function Modal({ children, onClose, title }) {
  useEffect(()=>{
    const closeOnEscape = e => { if(e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", closeOnEscape);
    return ()=>window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return (
    <div style={S.overlay} className="sg-overlay-anim" onClick={onClose} role="presentation">
      <div style={S.modal} className="sg-pop-anim" onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title||"Dialog"}>
        <div className="lm-modal-head" style={!title?{justifyContent:"flex-end"}:undefined}>
          {title && <div style={S.modalTitle}>{title}</div>}
          <button className="lm-modal-close" aria-label="Close dialog" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Login / signup ────────────────────────────────────────────────────────────────
function Login({ onAuth }) {
  const [mode, setMode] = useState("signin"); // signin | signup | reset
  const [username, setUsername] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const signin = async () => {
    setErr("");
    if (!username.trim()) return setErr("Enter your username or email.");
    if (!password) return setErr("Enter your password.");
    setBusy(true);
    const res = await authSignIn(username, password);
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    onAuth(res.username);
  };

  const signup = async () => {
    setErr("");
    if (username.trim().length < 2) return setErr("Pick a username (2+ characters).");
    if (!email.includes("@")) return setErr("Enter a valid email.");
    if (password.length < 6) return setErr("Password needs 6+ characters.");
    setBusy(true);
    const res = await authSignUp(username, email, password);
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    onAuth(res.username);
  };

  const reset = async () => {
    setErr("");
    if (!email.includes("@")) return setErr("Enter the email on your account.");
    setBusy(true);
    const res = await authResetEmail(email);
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    setResetSent(true);
  };

  return (
    <div style={S.loginWrap}>
      <div style={S.loginCard}>
        <div className="lm-login-brand">
          <div className="lm-login-logo">{BRAND.logo}</div>
          <div style={S.loginTitle}>{BRAND.name}</div>
          <div style={S.loginSub}>{BRAND.tagline}</div>
          <div className="lm-login-features" aria-label="Lumora features">
            <span className="lm-login-feature">Focus sessions</span>
            <span className="lm-login-feature">Study together</span>
            <span className="lm-login-feature">Grow your light</span>
          </div>
        </div>

        {mode==="signin" && <>
          <input style={S.input} placeholder="Username or email" value={username}
                 onChange={e=>setUsername(e.target.value)} autoCapitalize="none"/>
          <input style={S.input} type="password" placeholder="Password" value={password}
                 onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&signin()}/>
          {err && <div style={S.errText}>{err}</div>}
          <button style={S.primaryBtn} onClick={signin} disabled={busy}>{busy?"…":"Sign in"}</button>
          <button style={S.linkBtn} onClick={()=>{setMode("reset");setErr("");setResetSent(false);}}>Forgot password?</button>
          <button style={S.linkBtn} onClick={()=>{setMode("signup");setErr("");}}>New here? Create an account</button>
        </>}

        {mode==="signup" && <>
          <input style={S.input} placeholder="Username (your public name)" value={username}
                 onChange={e=>setUsername(e.target.value)} autoCapitalize="none"/>
          <input style={S.input} type="email" placeholder="Email" value={email}
                 onChange={e=>setEmail(e.target.value)} autoCapitalize="none"/>
          <input style={S.input} type="password" placeholder="Password (6+ characters)" value={password}
                 onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&signup()}/>
          {err && <div style={S.errText}>{err}</div>}
          <button style={S.primaryBtn} onClick={signup} disabled={busy}>{busy?"…":"Create account"}</button>
          <button style={S.linkBtn} onClick={()=>{setMode("signin");setErr("");}}>Already have an account? Sign in</button>
          <div style={S.loginHint}>Your email is used only for sign-in and password recovery. Your username is what classmates see.</div>
        </>}

        {mode==="reset" && <>
          {resetSent ? <>
            <div style={S.recHint}>Check your inbox — we sent a reset link to <b>{email}</b>.</div>
            <button style={S.primaryBtn} onClick={()=>{setMode("signin");setErr("");}}>Back to sign in</button>
          </> : <>
            <div style={S.recHint}>Enter your account email and we'll send a reset link.</div>
            <input style={S.input} type="email" placeholder="Email" value={email}
                   onChange={e=>setEmail(e.target.value)} autoCapitalize="none"/>
            {err && <div style={S.errText}>{err}</div>}
            <button style={S.primaryBtn} onClick={reset} disabled={busy}>{busy?"…":"Send reset link"}</button>
            <button style={S.linkBtn} onClick={()=>{setMode("signin");setErr("");}}>Back to sign in</button>
          </>}
        </>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// Main App
// ════════════════════════════════════════════════════════════════════════════════
export default function App() {
  // ── Auth ──
  const [user, setUser] = useState(() => lsRaw(LS_USER, ""));
  // ── Core prefs ──
  const [subjects, setSubjects] = useState(() => lsGet(LS_SUBJECTS, DEFAULT_SUBJECTS));
  const [subject, setSubject]   = useState(() => lsRaw(LS_SUBJECT, "math"));
  const [mode, setMode]         = useState(() => lsRaw(LS_MODE, "timer"));
  const [coins, setCoins]       = useState(() => Number(lsRaw(LS_COINS, "0")));
  const [xp, setXp]             = useState(() => Number(lsRaw(LS_XP, "0")));
  const [avatar, setAvatar]     = useState(() => lsGet(LS_AVATAR, { hat:"none_hat", aura:"none_aura", pet:"none_pet" }));
  const [owned, setOwned]       = useState(() => lsGet(LS_OWNED, ["none_hat","none_aura","none_pet"]));
  const [targets, setTargets]   = useState(() => lsGet(LS_TARGETS, {}));
  const [badges, setBadges]     = useState(() => lsGet(LS_BADGES, []));
  const [classes, setClasses]   = useState(() => lsGet(LS_CLASSES, [])); // [{code,name}]
  const [theme, setTheme]       = useState(() => lsRaw(LS_THEME, "light"));
  const [streakStakes, setStreakStakes] = useState(() => lsRaw(LS_STAKES, "off") === "on");
  const [dailyGoal, setDailyGoal] = useState(() => Math.max(15, Number(lsRaw(LS_DAILY_GOAL, "120")) || 120));
  const [intention, setIntention] = useState(() => lsRaw(LS_INTENTION, ""));
  const [todaySecs, setTodaySecs] = useState(0);
  const [studyClass, setStudyClass] = useState(null); // class code this session counts toward (null = none)

  // ── UI state ──
  const [tab, setTab] = useState("focus"); // focus | classes | board | stats
  const [editMode, setEditMode] = useState(false); // subject-edit mode (shows Remove)
  const [duration, setDuration] = useState(25*60);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [lb, setLb] = useState({ weekly:[], allTime:[] });
  const [lbLoading, setLbLoading] = useState(false);
  const [presence, setPresence] = useState([]);
  const [activeClass, setActiveClass] = useState(null); // {code,name,members}
  const [classBoard, setClassBoard] = useState([]);
  const [classPresence, setClassPresence] = useState([]);
  const [room, setRoom] = useState(null); // active co-op room {code, ...}
  const [modal, setModal] = useState(null); // 'subject' | 'shop' | 'badges' | 'class' | 'room' | 'menu' | 'levelup'
  const [levelUpInfo, setLevelUpInfo] = useState(null);
  const [celebrating, setCelebrating] = useState(false);
  const [toastNode, toast] = useToast();

  const tickRef = useRef(null);
  const heartbeatRef = useRef(null);
  const startedAtRef = useRef(null);

  // ── Persist prefs locally + to Firebase ──
  useEffect(()=>{ lsSet(LS_SUBJECTS, subjects); }, [subjects]);
  useEffect(()=>{ lsSetR(LS_SUBJECT, subject); }, [subject]);
  useEffect(()=>{ lsSetR(LS_MODE, mode); }, [mode]);
  useEffect(()=>{ lsSetR(LS_COINS, String(coins)); }, [coins]);
  useEffect(()=>{ lsSetR(LS_XP, String(xp)); }, [xp]);
  useEffect(()=>{ lsSet(LS_AVATAR, avatar); }, [avatar]);
  useEffect(()=>{ lsSet(LS_OWNED, owned); }, [owned]);
  useEffect(()=>{ lsSet(LS_TARGETS, targets); }, [targets]);
  useEffect(()=>{ lsSet(LS_BADGES, badges); }, [badges]);
  useEffect(()=>{ lsSet(LS_CLASSES, classes); }, [classes]);
  useEffect(()=>{ lsSetR(LS_THEME, theme); document.documentElement.setAttribute("data-theme", theme); }, [theme]);
  useEffect(()=>{ lsSetR(LS_STAKES, streakStakes?"on":"off"); }, [streakStakes]);
  useEffect(()=>{ lsSetR(LS_DAILY_GOAL, String(dailyGoal)); }, [dailyGoal]);
  useEffect(()=>{ lsSetR(LS_INTENTION, intention); }, [intention]);

  // ── Confirm the real auth session (survives reloads, handles sign-out elsewhere) ──
  useEffect(()=>{
    const unsub = onAuthStateChanged(auth, async (fbUser)=>{
      if(fbUser){
        const uname = await usernameForUid(fbUser.uid);
        if(uname){ setUser(uname); lsSetR(LS_USER, uname); }
      } else {
        // Firebase says signed out — clear local session
        setUser(""); localStorage.removeItem(LS_USER);
      }
    });
    return ()=>unsub();
  }, []);

  // ── Load remote prefs on login ──
  useEffect(()=>{
    if(!user) return;
    lsSetR(LS_USER, user);
    (async()=>{
      const p = await fbLoadPrefs(user);
      if(p){
        if(p.subjects) setSubjects(p.subjects);
        if(typeof p.coins==="number") setCoins(p.coins);
        if(typeof p.xp==="number") setXp(p.xp);
        if(p.avatar) setAvatar(p.avatar);
        if(p.owned) setOwned(p.owned);
        if(p.targets) setTargets(p.targets);
        if(p.badges) setBadges(p.badges);
        if(p.classes) setClasses(p.classes);
        if(typeof p.streakStakes==="boolean") setStreakStakes(p.streakStakes);
        if(typeof p.dailyGoal==="number") setDailyGoal(Math.max(15, Math.min(720, p.dailyGoal)));
      }
    })();
  }, [user]);

  // Daily progress is visible on the focus screen without opening analytics.
  useEffect(()=>{
    if(!user) return;
    let live = true;
    fbLoadHistory(user).then(history=>{
      if(!live) return;
      const today = startOfDay(new Date()).getTime();
      const total = history
        .filter(s=>startOfDay(new Date(s.ts)).getTime()===today)
        .reduce((sum,s)=>sum+(s.secs||0),0);
      setTodaySecs(total);
    });
    return ()=>{ live=false; };
  }, [user]);

  // ── Derived ──
  const subjectObj = subjects.find(s=>s.id===subject) || subjects[0] || DEFAULT_SUBJECTS[0];
  const xpInfo = xpToNext(xp);
  const level = xpInfo.lvl;
  const tier = tierForLevel(level);
  const sessionProgress = mode==="timer" ? Math.min(1, elapsed/duration) : Math.min(1, elapsed/(45*60));
  const todaysWeather = useMemo(()=>weatherFor(new Date(), user||"lumora"), [user]);
  const currentWorld = worldState(xp/60);

  // ── Leaderboard + presence polling ──
  const refreshBoard = useCallback(async ()=>{
    setLbLoading(true);
    const [d, p] = await Promise.all([fbLoadLeaderboard(), fbLoadPresence()]);
    setLb(d); setPresence(p); setLbLoading(false);
  }, []);
  useEffect(()=>{
    if(!user) return;
    refreshBoard();
    const iv = setInterval(()=>{ fbLoadPresence().then(setPresence); }, 20000);
    return ()=>clearInterval(iv);
  }, [user, refreshBoard]);

  // ── Class data polling ──
  useEffect(()=>{
    if(!activeClass) return;
    let on=true;
    const load = async ()=>{
      const [c, b, pr] = await Promise.all([
        fbLoadClass(activeClass.code), fbLoadClassBoard(activeClass.code), fbLoadPresence(activeClass.code)
      ]);
      if(!on) return;
      if(c) setActiveClass(c);
      setClassBoard(b); setClassPresence(pr);
    };
    load();
    const iv = setInterval(load, 15000);
    return ()=>{ on=false; clearInterval(iv); };
  }, [activeClass?.code]);

  // ── Room polling ──
  useEffect(()=>{
    if(!room) return;
    let on=true;
    const iv = setInterval(async ()=>{
      const r = await fbLoadRoom(room.code);
      if(on && r) setRoom(r);
    }, 5000);
    return ()=>{ on=false; clearInterval(iv); };
  }, [room?.code]);

  // ── Timer tick ──
  useEffect(()=>{
    if(running && !paused){
      tickRef.current = setInterval(()=>{
        setElapsed(e=>{
          const ne = e+1;
          if(mode==="timer" && ne>=duration){ finishSession(duration); return duration; }
          return ne;
        });
      }, 1000);
    }
    return ()=>clearInterval(tickRef.current);
  }, [running, paused, mode, duration]);

  // ── Heartbeat while focusing ──
  useEffect(()=>{
    if(running && !paused && user){
      const beat = ()=>{
        fbHeartbeat(user, {
          subjLabel: subjectObj.label, subjEmoji: subjectObj.emoji, subjColor: subjectObj.color,
          classes: classes.map(c=>c.code),
        });
        if(room) fbRoomHeartbeat(room.code, user, true, elapsed);
      };
      beat();
      heartbeatRef.current = setInterval(beat, 30000);
    } else if(user) {
      fbClearPresence(user);
      if(room && !running) fbRoomHeartbeat(room.code, user, false, 0);
    }
    return ()=>clearInterval(heartbeatRef.current);
  }, [running, paused, user, subject, room?.code]);

  // ── Session lifecycle ──
  const startSession = ()=>{ setElapsed(0); startedAtRef.current = Date.now(); setRunning(true); setPaused(false); };
  const togglePause = ()=> setPaused(p=>!p);
  const cancelSession = ()=>{
    const wasFocusing = elapsed >= 60; // only penalize if a real session was underway
    setRunning(false); setPaused(false); setElapsed(0);
    if(user) fbClearPresence(user);
    if(room) fbRoomHeartbeat(room.code, user, false, 0);

    if(streakStakes && wasFocusing){
      // Forest-style stakes: giving up costs a little XP (never below the current
      // level floor, so you can't be demoted). Coins are never taken.
      const penalty = Math.min(15, Math.floor(elapsed/60)); // up to 15 XP
      const floor = xpForLevel(levelFromXp(xp));            // don't drop below this level
      const newXp = Math.max(floor, xp - penalty);
      setXp(newXp);
      if(user) fbSavePrefs(user, { xp:newXp });
      toast(penalty>0 ? `Gave up — −${xp-newXp} XP. Your avatar shrinks back a little.` : "Gave up — no progress counted.");
    } else {
      toast("Session ended — no progress lost, just not counted.");
    }
  };

  const finishSession = async (secs)=>{
    clearInterval(tickRef.current);
    setRunning(false); setPaused(false);
    const mins = Math.floor(secs/60);
    if(mins < 1){ setElapsed(0); toast("Too short to count — focus at least a minute."); return; }

    const gainedCoins = mins*COINS_PER_MIN;
    const gainedXp = mins*XP_PER_MIN;
    const newCoins = coins + gainedCoins;
    const newXp = xp + gainedXp;
    const prevLevel = levelFromXp(xp);
    const newLevel = levelFromXp(newXp);
    setCoins(newCoins); setXp(newXp); setElapsed(0); setTodaySecs(v=>v+secs);
    setCelebrating(true);
    window.setTimeout(()=>setCelebrating(false), 1600);

    if(user){
      await fbSaveSession(user, subject, secs, { coop: !!room, classCode: studyClass || null, startedAt: startedAtRef.current });
      fbClearPresence(user);
      fbSavePrefs(user, { coins:newCoins, xp:newXp });
      refreshBoard();
    }

    // Level up?
    if(newLevel > prevLevel){
      const prevTier = tierForLevel(prevLevel), newTier = tierForLevel(newLevel);
      setLevelUpInfo({ level:newLevel, evolved: newTier.id!==prevTier.id, tierName:newTier.name });
      setModal("levelup");
    } else {
      toast(`+${gainedXp} XP · +${gainedCoins} coins 🪙`);
    }

    // Badges
    await checkBadges(newCoins, newLevel);
  };

  const checkBadges = async (curCoins, curLevel)=>{
    const history = await fbLoadHistory(user);
    const days = new Set(history.map(s=>startOfDay(new Date(s.ts)).getTime()));
    let streak=0, cur=startOfDay(new Date()).getTime();
    while(days.has(cur)){ streak++; cur-=86400000; }
    const ctx = buildBadgeCtx({
      history, streak, cosmeticCount: owned.filter(id=>!id.startsWith("none")).length,
      subjects, classCount: classes.length, level: curLevel,
    });
    const newly = BADGES.filter(b=>!badges.includes(b.id) && b.check(ctx));
    if(newly.length){
      const ids = newly.map(b=>b.id);
      const reward = newly.reduce((a,b)=>a+BADGE_REWARDS[b.tier],0);
      const nb=[...badges,...ids], nc=curCoins+reward;
      setBadges(nb); setCoins(nc);
      if(user) fbSavePrefs(user, { badges:nb, coins:nc });
      setTimeout(()=>toast(`🏅 ${newly.map(b=>b.name).join(", ")} · +${reward} coins`), 600);
    }
  };

  // ── Shop actions ──
  const buyCosmetic = (c)=>{
    if(owned.includes(c.id)) { equipCosmetic(c); return; }
    if(coins < c.cost){ toast("Not enough coins yet — keep focusing."); return; }
    const nc = coins-c.cost, no=[...owned,c.id];
    setCoins(nc); setOwned(no);
    const na = { ...avatar, [c.slot]: c.id };
    setAvatar(na);
    if(user) fbSavePrefs(user, { coins:nc, owned:no, avatar:na });
    toast(`Unlocked ${c.name} 🎉`);
  };
  const equipCosmetic = (c)=>{
    const na = { ...avatar, [c.slot]: c.id };
    setAvatar(na);
    if(user) fbSavePrefs(user, { avatar:na });
  };

  // ── Subject actions ──
  const addSubject = (label, emoji, color)=>{
    const id = label.toLowerCase().replace(/[^a-z0-9]/g,"_").slice(0,20) + "_" + Date.now().toString(36).slice(-3);
    const ns=[...subjects,{id,label,emoji,color}];
    setSubjects(ns); setSubject(id);
    if(user) fbSavePrefs(user, { subjects:ns });
  };
  const removeSubject = (id)=>{
    if(subjects.length<=1){ toast("Keep at least one subject."); return; }
    const ns=subjects.filter(s=>s.id!==id);
    setSubjects(ns);
    if(subject===id) setSubject(ns[0].id);
    if(user) fbSavePrefs(user, { subjects:ns });
  };

  // ── Class actions ──
  const createClass = async (name)=>{
    const r = await fbCreateClass(name, user);
    if(!r.ok){ toast(r.error); return; }
    const nc=[...classes,{code:r.code,name:r.name}];
    setClasses(nc); if(user) fbSavePrefs(user,{classes:nc});
    setActiveClass({code:r.code,name:r.name,members:[user]});
    setModal(null);
    toast(`Class created — code ${r.code}`);
  };
  const joinClass = async (code)=>{
    const r = await fbJoinClass(code, user);
    if(!r.ok){ toast(r.error); return; }
    if(!classes.find(c=>c.code===r.code)){
      const nc=[...classes,{code:r.code,name:r.name}];
      setClasses(nc); if(user) fbSavePrefs(user,{classes:nc});
    }
    const c = await fbLoadClass(r.code);
    setActiveClass(c); setModal(null);
    toast(`Joined ${r.name}`);
  };
  const leaveClassView = ()=> setActiveClass(null);

  // ── Room actions ──
  const createRoom = async (goalMin)=>{
    const r = await fbCreateRoom(user, subjectObj.label, goalMin);
    if(!r.ok){ toast(r.error); return; }
    const rm = await fbLoadRoom(r.code);
    setRoom(rm); setModal(null); setDuration(goalMin*60); setMode("timer");
    toast(`Room open — share code ${r.code}`);
  };
  const joinRoom = async (code)=>{
    const r = await fbJoinRoom(code, user);
    if(!r.ok){ toast(r.error); return; }
    const rm = await fbLoadRoom(r.code);
    setRoom(rm); setModal(null);
    if(rm?.goalMin){ setDuration(rm.goalMin*60); setMode("timer"); }
    toast(`Joined room ${r.code}`);
  };
  const leaveRoom = async ()=>{
    if(room && user) await fbLeaveRoom(room.code, user);
    setRoom(null);
    toast("Left the room.");
  };

  const logout = ()=>{
    if(running) cancelSession();
    if(room && user) fbLeaveRoom(room.code, user);
    if(user) fbClearPresence(user);
    authLogout();
    localStorage.removeItem(LS_USER);
    setUser(""); setTab("focus"); setActiveClass(null); setRoom(null);
  };

  // ── Targets ──
  const setTarget = (subjId, hrs)=>{
    const nt = { ...targets, [subjId]: hrs };
    setTargets(nt); if(user) fbSavePrefs(user,{targets:nt});
  };

  if(!user) return (<><style>{APP_CSS+DARK_CSS}</style><Login onAuth={setUser}/></>);

  // ── Today's focus for current subject (from leaderboard weekly subjects is coarse; use elapsed live) ──
  const initials = user.slice(0,2).toUpperCase();
  const dailyGoalSecs = Math.max(15, dailyGoal) * 60;
  const dailyGoalPct = Math.min(1, todaySecs / dailyGoalSecs);
  const isNewUser = xp < 1;
  const tierPosition = Math.max(0, EVO_TIERS.findIndex(t=>t.id===tier.id));
  const navItems = [
    { id:"focus", label:"Focus", icon:"◉" },
    { id:"classes", label:"Classroom", icon:"♧" },
    { id:"board", label:"Ranks", icon:"◇" },
    { id:"stats", label:"Progress", icon:"↗" },
  ];

  return (
    <div className="sg-shell" data-theme={theme}>
      <style>{APP_CSS+DARK_CSS}</style>
      <LumoraShell
        navItems={navItems}
        activeNav={tab}
        onNavigate={setTab}
        onOpenMenu={()=>setModal("menu")}
        initials={initials}
        coins={coins}
        level={level}
        tierName={tier.name}
        xpLabel={`${xpInfo.into}/${xpInfo.span} XP`}
        xpPercent={xpInfo.pct*100}
        compact={isNewUser}
      >
        <div style={S.app} className="sg-app">
          {toastNode}

        {/* ════════ FOCUS TAB ════════ */}
        {tab==="focus" && (
          <div style={S.timerView} className="sg-view-anim sg-main" key="view-focus">
            <div className="lm-focus-layout">
              <section className="lm-focus-card" aria-label="Focus session setup">
                <div className="lm-section-kicker">{running?"In focus":"Focus"}</div>
                <h1 className="lm-focus-heading">
                  {running ? (paused?"Take a breath.":"Stay with one thing.") : (isNewUser?"Begin with one quiet session.":"What will you focus on?")}
                </h1>
                <p className="lm-focus-copy">
                  {running ? (paused?"Your progress is safe. Resume when you're ready.":"Lumora is growing quietly while you work.") :
                    (isNewUser?"Choose a subject and a comfortable starting length. Your tiny light will grow with every focused minute.":"Simple defaults first. Open session options only when you need them.")}
                </p>

                {room && (
                  <div style={S.roomBanner}>
                    <div>
                      <div style={{fontSize:12,fontWeight:800,color:BRAND.primary}}>Co-op room · {room.code}</div>
                      <div style={{fontSize:11,color:BRAND.muted}}>
                        {Object.values(room.participants||{}).filter(p=>p.focusing).length} focusing · {Object.keys(room.participants||{}).length} here
                      </div>
                    </div>
                    <button style={S.smallGhostBtn} onClick={leaveRoom}>Leave</button>
                  </div>
                )}

                {!running && <>
                  <div className="lm-essential-block">
                    <span className="lm-field-label" style={{marginTop:0}}>Subject</span>
                    <div className="lm-choice-row">
                      {subjects.map(s=>{
                        const sel = subject===s.id;
                        return (
                          <button key={s.id} aria-pressed={sel}
                            style={{...S.subjPill,...(sel?{borderColor:s.color,background:s.color+"14",color:s.color,fontWeight:750}:{})}}
                            onClick={()=>setSubject(s.id)}>
                            <span style={{...S.subjDot,background:s.color}}/>{s.emoji} {s.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {mode==="timer" && (
                    <div className="lm-essential-block">
                      <span className="lm-field-label">Focus length</span>
                      <div className="lm-choice-row">
                        {[15,25,45].map(m=>(
                          <button key={m} aria-pressed={duration===m*60}
                            style={{...S.durBtn,...(duration===m*60?{...S.durBtnActive,borderColor:subjectObj.color,color:subjectObj.color,background:subjectObj.color+"12"}:{})}}
                            onClick={()=>{setDuration(m*60);setElapsed(0);}}>{m} min</button>
                        ))}
                      </div>
                    </div>
                  )}

                  <details className="lm-session-options">
                    <summary>Session options</summary>
                    <div className="lm-session-options-body">
                      <span className="lm-field-label">Session type</span>
                      <div style={S.modeRow}>
                        <button style={{...S.modeBtn,...(mode==="timer"?{...S.modeBtnActive,borderColor:subjectObj.color,color:subjectObj.color,background:subjectObj.color+"12"}:{})}} onClick={()=>setMode("timer")}>Countdown</button>
                        <button style={{...S.modeBtn,...(mode==="stopwatch"?{...S.modeBtnActive,borderColor:subjectObj.color,color:subjectObj.color,background:subjectObj.color+"12"}:{})}} onClick={()=>setMode("stopwatch")}>Open-ended</button>
                      </div>

                      <label className="lm-field-label" htmlFor="focus-intention">Focus intention <span style={{textTransform:"none",letterSpacing:0,fontWeight:600}}>· optional</span></label>
                      <textarea id="focus-intention" className="lm-intention" maxLength={90} rows={2}
                        value={intention} onChange={e=>setIntention(e.target.value)}
                        placeholder={`What would you like to finish in ${subjectObj.label}?`}/>

                      {mode==="timer" && <>
                        <span className="lm-field-label">Custom length</span>
                        <label className="lm-custom-duration" title="Custom session length">
                          <input aria-label="Custom duration in minutes" type="number" min="1" max="240"
                            value={Math.round(duration/60)} onChange={e=>setDuration(Math.max(1,Math.min(240,Number(e.target.value)||1))*60)}/>
                          <span>min</span>
                        </label>
                      </>}

                      <div style={S.subjHeader}>
                        <span className="lm-field-label">Manage subjects</span>
                        {subjects.length>1 && <button style={{...S.subjEditBtn,...(editMode?S.subjEditBtnActive:{})}} onClick={()=>setEditMode(e=>!e)}>{editMode?"Done":"Remove"}</button>}
                      </div>
                      <div style={S.subjScroll}>
                        {subjects.map(s=>{
                          const sel=subject===s.id;
                          return <button key={s.id} style={{...S.subjPill,...(sel?{borderColor:s.color,color:s.color}:{})}}
                            onClick={()=>editMode?(subjects.length>1&&removeSubject(s.id)):setSubject(s.id)}>
                            {s.emoji} {s.label}{editMode&&subjects.length>1?<span style={S.subjRemoveInline}>Remove</span>:null}
                          </button>;
                        })}
                        {!editMode && <button style={S.subjAddPill} onClick={()=>setModal("subject")}>＋ Add subject</button>}
                      </div>

                      {classes.length>0 && (
                        <>
                          <span className="lm-field-label">Counts toward</span>
                          <div style={S.classPickRow}>
                            <button style={{...S.classPickChip,...(studyClass===null?S.classPickChipActive:{})}} onClick={()=>setStudyClass(null)}>Just me</button>
                            {classes.map(c=><button key={c.code} style={{...S.classPickChip,...(studyClass===c.code?S.classPickChipActive:{})}} onClick={()=>setStudyClass(c.code)}>{c.name}</button>)}
                          </div>
                        </>
                      )}
                    </div>
                  </details>

                  {isNewUser && (
                    <div className="lm-first-session-note">
                      <span aria-hidden="true">✦</span>
                      <div><strong>Your first Lumora is a New Light.</strong>Complete one focused minute to begin its story and reveal the rest of the app.</div>
                    </div>
                  )}
                </>}

                {running && intention.trim() && (
                  <div className="lm-session-intent"><span>Now focusing on</span><strong>{intention.trim()}</strong></div>
                )}

                {!isNewUser && !running && <div className="lm-daily-card">
                  <div className="lm-daily-ring" style={{"--lm-goal":`${dailyGoalPct*100}%`}}><span>{Math.round(dailyGoalPct*100)}%</span></div>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:800,color:BRAND.ink}}>Today's light</div>
                    <div style={{fontSize:11,color:BRAND.muted,marginTop:2}}>{fmtMins(todaySecs)} of {fmtMins(dailyGoalSecs)} focused</div>
                  </div>
                </div>}

                {!running ? (
                  <button className="lm-primary-action sg-plant-btn" style={{background:`linear-gradient(135deg,${subjectObj.color},${BRAND.primary})`}} onClick={startSession}>
                    {mode==="timer"?`Begin ${Math.round(duration/60)} minute focus`:"Start open-ended focus"}
                  </button>
                ) : (
                  <div style={{display:"flex",gap:10,marginTop:16}}>
                    <button style={{...S.plantBtn,flex:1,background:paused?subjectObj.color:BRAND.surfaceRaised,color:paused?"#fff":BRAND.muted,border:`1.5px solid ${BRAND.border}`,boxShadow:"none"}} onClick={togglePause}>{paused?"Resume":"Pause"}</button>
                    {mode==="stopwatch" ? (
                      <button style={{...S.plantBtn,flex:1,background:subjectObj.color}} onClick={()=>finishSession(elapsed)}>Finish</button>
                    ) : (
                      <button style={{...S.plantBtn,flex:1,background:BRAND.surfaceRaised,color:BRAND.danger,border:`1.5px solid ${BRAND.border}`,boxShadow:"none"}}
                        onClick={()=>{ if(streakStakes && elapsed>=60){ if(window.confirm("End this session? With streak stakes on, some XP will be lost.")) cancelSession(); } else cancelSession(); }}>
                        End session
                      </button>
                    )}
                  </div>
                )}

              </section>

              <section className="lm-stage-card" aria-label="Your Lumora classroom">
                <div className="lm-section-kicker" style={{justifyContent:"center"}}>{paused?"Light resting":running?"Light in focus":"Your Lumora"}</div>
                <div className="lm-growth-stage"><span className="lm-growth-dot"/><strong>{tier.name}</strong><span>· stage {tierPosition+1} of {EVO_TIERS.length}</span></div>
                <div className="lm-world-frame lm-classroom-frame">
                  <ClassroomScene peers={presence} currentUser={user} stage={tierPosition}
                    weather={todaysWeather.id} focusing={running&&!paused}>
                    <AvatarSVG large progress={running?sessionProgress:(isNewUser ? 0.35 : 0.72)} tier={tier.id}
                      equipped={avatar} color={subjectObj.color} paused={paused} idle={!running} celebrate={celebrating}/>
                  </ClassroomScene>
                  <div className="lm-world-weather">
                    <span aria-hidden="true">{({clear:"☀️",cloudy:"☁️",rain:"🌧️",storm:"⛈️",snow:"❄️",fog:"🌫️"})[todaysWeather.id]}</span>
                    {!isNewUser && WEATHER_LABEL[todaysWeather.id]}
                  </div>
                </div>
                <div className="lm-world-progress">
                  <div className="lm-world-progress-top">
                    <strong>{isNewUser?"A new light is waiting":`${(xp/60).toFixed(1)} hours of classroom growth`}</strong>
                    <span>{isNewUser?"First session → quiet desk":(currentWorld.maxed ? "Classroom complete" : `Next: ${CLASSROOM_STAGE_LABEL[currentWorld.next?.id]||"new classroom detail"}`)}</span>
                  </div>
                  <div className="lm-world-progress-track" aria-label={`${Math.round((currentWorld.maxed?1:currentWorld.toNext)*100)}% to the next classroom milestone`}>
                    <div className="lm-world-progress-fill" style={{width:`${(currentWorld.maxed?1:currentWorld.toNext)*100}%`}}/>
                  </div>
                </div>
                <div style={{...S.timerDisplay,color:subjectObj.color}} aria-live="polite">
                  {running ? fmt(mode==="timer"?Math.max(0,duration-elapsed):elapsed) : (mode==="timer"?fmt(duration):"00:00")}
                </div>
                <div style={S.timerLabel}>
                  {running ? (paused?"Paused — return when you're ready":(mode==="timer"?"Stay with it. Your light is growing.":"Stopwatch running — stay in flow.")) :
                    (isNewUser?"Your first focused minute begins the story.":`${subjectObj.emoji} ${subjectObj.label} · ${mode==="timer"?"ready when you are":"open-ended focus"}`)}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ════════ CLASSES TAB ════════ */}
        {tab==="classes" && (
          <div style={S.boardView} className="sg-view-anim sg-board-view" key="view-classes">
            {!activeClass ? (
              <>
                <div style={S.sectionTitle}>Your classes</div>
                {classes.length===0 && <div style={S.empty}>Join a class with a code, or create one for your cohort.</div>}
                {classes.map(c=>(
                  <button key={c.code} style={S.classCard} onClick={()=>setActiveClass({code:c.code,name:c.name,members:[]})}>
                    <div>
                      <div style={{fontSize:15,fontWeight:700,color:BRAND.ink}}>{c.name}</div>
                      <div style={{fontSize:12,color:BRAND.muted}}>Code {c.code}</div>
                    </div>
                    <span style={{fontSize:18,color:BRAND.mutedSoft}}>›</span>
                  </button>
                ))}
                <button style={{...S.plantBtn,background:BRAND.primary,marginTop:14}} onClick={()=>setModal("class")}>＋ Join or create a class</button>
              </>
            ) : (
              <ClassCampus cls={activeClass} presence={classPresence} board={classBoard}
                           currentUser={user} loading={false} onLeave={leaveClassView}/>
            )}
          </div>
        )}

        {/* ════════ RANKS TAB ════════ */}
        {tab==="board" && (
          <div style={S.boardView} className="sg-view-anim sg-board-view" key="view-board">
            <FocusingNow presence={presence} currentUser={user}/>
            <div style={{height:14}}/>
            <LeaderboardPanel data={lb} currentUser={user} loading={lbLoading} subjects={subjects} title="Global ranks"/>
          </div>
        )}

        {/* ════════ STATS TAB ════════ */}
        {tab==="stats" && (
          <div style={S.boardView} className="sg-view-anim sg-board-view" key="view-stats">
            <AnalyticsPanel user={user} subjects={subjects} targets={targets}/>
          </div>
        )}

        {/* ════════ MODALS ════════ */}
        {modal==="subject" && (
          <SubjectModal onClose={()=>setModal(null)} onAdd={(l,e,c)=>{addSubject(l,e,c);setModal(null);}}/>
        )}

        {modal==="shop" && (
          <Modal title="Customize your avatar" onClose={()=>setModal(null)}>
            <div style={{display:"flex",justifyContent:"center",marginBottom:8}}>
              <AvatarSVG progress={0.9} tier={tier.id} equipped={avatar} color={subjectObj.color} idle/>
            </div>
            <div style={{fontSize:12,color:BRAND.muted,textAlign:"center",marginBottom:14}}>Lv {level} · {tier.name} · 🪙 {coins}</div>
            {SLOTS.map(slot=>(
              <div key={slot.id} style={{marginBottom:16}}>
                <div style={S.shopSlotTitle}>{slot.emoji} {slot.label}</div>
                <div style={S.shopGrid}>
                  {COSMETICS.filter(c=>c.slot===slot.id).map(c=>{
                    const isOwned = owned.includes(c.id);
                    const isEquipped = avatar[slot.id]===c.id;
                    return (
                      <button key={c.id} className="sg-tap-card"
                        style={{...S.shopCard,...(isEquipped?{borderColor:BRAND.primary,background:BRAND.primarySoft}:{})}}
                        onClick={()=>buyCosmetic(c)}>
                        <div style={{fontSize:11,fontWeight:700,color:BRAND.ink,marginBottom:2}}>{c.name}</div>
                        {isEquipped ? <div style={S.shopTag}>Equipped</div> :
                         isOwned ? <div style={{...S.shopTag,background:BRAND.bg,color:BRAND.muted}}>Equip</div> :
                         <div style={{...S.shopTag,background:BRAND.coinBg,color:BRAND.coinText}}>🪙 {c.cost}</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </Modal>
        )}

        {modal==="badges" && (
          <Modal title="Badges" onClose={()=>setModal(null)}>
            <div style={S.badgeGrid}>
              {BADGES.map(b=>{
                const got = badges.includes(b.id);
                return (
                  <div key={b.id} style={{...S.badgeCard,opacity:got?1:0.5}}>
                    <div style={{fontSize:28}}>{got?b.emoji:"🔒"}</div>
                    <div style={{fontSize:12,fontWeight:700,color:BRAND.ink,textAlign:"center"}}>{b.name}</div>
                    <div style={{fontSize:10,color:BRAND.muted,textAlign:"center"}}>{b.desc}</div>
                  </div>
                );
              })}
            </div>
          </Modal>
        )}

        {modal==="class" && (
          <ClassModal onClose={()=>setModal(null)} onCreate={createClass} onJoin={joinClass}/>
        )}

        {modal==="room" && (
          <RoomModal room={room} onClose={()=>setModal(null)} onCreate={createRoom} onJoin={joinRoom} onLeave={leaveRoom}/>
        )}

        {modal==="menu" && (
          <Modal title={`Hi, ${user}`} onClose={()=>setModal(null)}>
            <div style={{display:"flex",justifyContent:"center",marginBottom:10}}>
              <AvatarSVG progress={0.9} tier={tier.id} equipped={avatar} color={subjectObj.color} idle/>
            </div>
            <div style={{textAlign:"center",fontSize:13,color:BRAND.muted,marginBottom:16}}>Level {level} · {tier.name}</div>
            <button style={S.menuRow} onClick={()=>setModal("shop")}>✦ Customize Lumora</button>
            <button style={S.menuRow} onClick={()=>setModal("badges")}>◇ Achievements</button>
            <button style={S.menuRow} onClick={()=>setModal("room")}>◎ Co-op focus room</button>
            <button style={S.menuRow} onClick={()=>{setTheme(theme==="light"?"dark":"light");}}>
              {theme==="light"?"🌙 Dark mode":"☀️ Light mode"}
            </button>
            <button style={S.menuRow} onClick={()=>{setModal("targets");}}>🎯 Weekly targets</button>
            <div style={{...S.menuRow,cursor:"default"}}>
              <label htmlFor="daily-goal" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
                <span>☀️ Daily focus goal</span>
                <span style={{display:"flex",alignItems:"center",gap:5,color:BRAND.muted,fontSize:12}}>
                  <input id="daily-goal" type="number" min="15" max="720" step="15" value={dailyGoal}
                    onChange={e=>setDailyGoal(Math.max(15,Math.min(720,Number(e.target.value)||15)))}
                    onBlur={()=>user&&fbSavePrefs(user,{dailyGoal})}
                    style={{width:62,padding:"7px 8px",background:BRAND.surfaceRaised,color:BRAND.ink,border:`1px solid ${BRAND.border}`,borderRadius:9,textAlign:"right"}}/>
                  min
                </span>
              </label>
            </div>
            <button style={S.menuRow} onClick={()=>{ const v=!streakStakes; setStreakStakes(v); if(user) fbSavePrefs(user,{streakStakes:v}); }}>
              {streakStakes ? "🔥 Streak stakes: ON — ending early costs XP" : "🛡️ Streak stakes: OFF — no penalty"}
            </button>
            <button style={{...S.menuRow,color:BRAND.danger}} onClick={logout}>↩ Sign out</button>
          </Modal>
        )}

        {modal==="targets" && (
          <Modal title="Weekly targets (hours)" onClose={()=>setModal(null)}>
            {subjects.map(s=>(
              <div key={s.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                <span style={{fontSize:14,fontWeight:600}}>{s.emoji} {s.label}</span>
                <input type="number" min="0" step="0.5" value={targets[s.id]||""} placeholder="0"
                  style={{width:70,padding:"8px",background:BRAND.surfaceRaised,color:BRAND.ink,border:`1.5px solid ${BRAND.border}`,borderRadius:10,fontSize:14,textAlign:"center"}}
                  onChange={e=>setTarget(s.id, Number(e.target.value))}/>
              </div>
            ))}
          </Modal>
        )}

        {modal==="levelup" && levelUpInfo && (
          <Modal onClose={()=>setModal(null)}>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:13,fontWeight:700,letterSpacing:2,color:BRAND.primary,textTransform:"uppercase"}}>
                {levelUpInfo.evolved?"Evolution":"Level up"}
              </div>
              <div style={{fontSize:32,fontWeight:900,color:BRAND.primary,margin:"4px 0"}}>Level {levelUpInfo.level}</div>
              <div style={{display:"flex",justifyContent:"center",margin:"8px 0"}}>
                <AvatarSVG large progress={1} tier={tier.id} equipped={avatar} color={subjectObj.color} idle/>
              </div>
              {levelUpInfo.evolved && <div style={{fontSize:15,fontWeight:700,color:"#7B6FE0",marginBottom:6}}>You're now a {levelUpInfo.tierName} ✨</div>}
              <button style={{...S.plantBtn,background:BRAND.primary,marginTop:10}} onClick={()=>setModal(null)}>Keep going</button>
            </div>
          </Modal>
        )}

        </div>
      </LumoraShell>
    </div>
  );
}

// ── Subject modal ─────────────────────────────────────────────────────────────────
function SubjectModal({ onClose, onAdd }) {
  const [label,setLabel]=useState(""); const [emoji,setEmoji]=useState("📐"); const [color,setColor]=useState("#5B8DEF");
  return (
    <Modal title="New subject" onClose={onClose}>
      <input style={S.input} placeholder="Subject name" value={label} onChange={e=>setLabel(e.target.value)} autoFocus/>
      <div style={{fontSize:12,fontWeight:600,color:BRAND.muted,margin:"8px 0 6px"}}>Icon</div>
      <div style={S.pickGrid}>
        {EMOJI_OPTIONS.map(e=>(
          <button key={e} style={{...S.pickEmoji,...(emoji===e?{borderColor:color,background:"#F0FBF6"}:{})}} onClick={()=>setEmoji(e)}>{e}</button>
        ))}
      </div>
      <div style={{fontSize:12,fontWeight:600,color:BRAND.muted,margin:"10px 0 6px"}}>Color</div>
      <div style={S.pickGrid}>
        {COLOR_OPTIONS.map(c=>(
          <button key={c} style={{...S.pickColor,background:c,...(color===c?{outline:`3px solid ${BRAND.primary}`,outlineOffset:2}:{})}} onClick={()=>setColor(c)}/>
        ))}
      </div>
      <button style={{...S.plantBtn,background:color,marginTop:14}} disabled={!label.trim()} onClick={()=>label.trim()&&onAdd(label.trim(),emoji,color)}>Add subject</button>
    </Modal>
  );
}

// ── Class modal ───────────────────────────────────────────────────────────────────
function ClassModal({ onClose, onCreate, onJoin }) {
  const [tab,setTab]=useState("join"); const [code,setCode]=useState(""); const [name,setName]=useState("");
  return (
    <Modal title="Classes" onClose={onClose}>
      <div style={S.toggleRow}>
        <button style={{...S.toggleBtn,...(tab==="join"?S.toggleBtnActive:{})}} onClick={()=>setTab("join")}>Join</button>
        <button style={{...S.toggleBtn,...(tab==="create"?S.toggleBtnActive:{})}} onClick={()=>setTab("create")}>Create</button>
      </div>
      {tab==="join" ? <>
        <div style={S.recHint}>Enter the 6-character code your teacher or classmate shared.</div>
        <input style={{...S.input,textTransform:"uppercase",letterSpacing:3,textAlign:"center",fontWeight:700}}
               placeholder="ABC123" maxLength={6} value={code} onChange={e=>setCode(e.target.value)}/>
        <button style={{...S.plantBtn,background:BRAND.primary,marginTop:8}} disabled={code.length<6} onClick={()=>onJoin(code)}>Join class</button>
      </> : <>
        <div style={S.recHint}>Name your class — you'll get a code to share.</div>
        <input style={S.input} placeholder="e.g. Year 12 Physics" value={name} onChange={e=>setName(e.target.value)}/>
        <button style={{...S.plantBtn,background:BRAND.primary,marginTop:8}} disabled={!name.trim()} onClick={()=>onCreate(name.trim())}>Create class</button>
      </>}
    </Modal>
  );
}

// ── Room modal ────────────────────────────────────────────────────────────────────
function RoomModal({ room, onClose, onCreate, onJoin, onLeave }) {
  const [tab,setTab]=useState("join"); const [code,setCode]=useState(""); const [goal,setGoal]=useState(25);
  if(room) return (
    <Modal title={`Co-op room ${room.code}`} onClose={onClose}>
      <div style={S.recHint}>Share this code so classmates can focus alongside you. You'll see who's live on the Focus screen.</div>
      <div style={{textAlign:"center",fontSize:28,fontWeight:900,letterSpacing:4,color:BRAND.primary,margin:"6px 0"}}>{room.code}</div>
      <div style={{fontSize:12,color:BRAND.muted,textAlign:"center",marginBottom:12}}>{Object.keys(room.participants||{}).length} people here</div>
      <button style={{...S.plantBtn,background:BRAND.surfaceRaised,color:BRAND.danger,border:`1.5px solid ${BRAND.border}`,boxShadow:"none"}} onClick={()=>{onLeave();onClose();}}>Leave room</button>
    </Modal>
  );
  return (
    <Modal title="Co-op focus room" onClose={onClose}>
      <div style={S.toggleRow}>
        <button style={{...S.toggleBtn,...(tab==="join"?S.toggleBtnActive:{})}} onClick={()=>setTab("join")}>Join</button>
        <button style={{...S.toggleBtn,...(tab==="create"?S.toggleBtnActive:{})}} onClick={()=>setTab("create")}>Host</button>
      </div>
      {tab==="join" ? <>
        <div style={S.recHint}>Focus together in real time. Enter a room code.</div>
        <input style={{...S.input,textTransform:"uppercase",letterSpacing:3,textAlign:"center",fontWeight:700}}
               placeholder="ABC123" maxLength={6} value={code} onChange={e=>setCode(e.target.value)}/>
        <button style={{...S.plantBtn,background:BRAND.primary,marginTop:8}} disabled={code.length<6} onClick={()=>onJoin(code)}>Join room</button>
      </> : <>
        <div style={S.recHint}>Pick a session length. Everyone in the room aims for the same goal.</div>
        <div style={S.durationRow}>
          {[15,25,45,60].map(m=>(
            <button key={m} style={{...S.durBtn,...(goal===m?{...S.durBtnActive,borderColor:BRAND.primary,color:BRAND.primary}:{})}} onClick={()=>setGoal(m)}>{m}m</button>
          ))}
        </div>
        <button style={{...S.plantBtn,background:BRAND.primary,marginTop:8}} onClick={()=>onCreate(goal)}>Open room</button>
      </>}
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────────
const S = {
  app:{minHeight:"100vh",background:"transparent",color:BRAND.ink,fontFamily:"Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",maxWidth:"none",margin:"0 auto",position:"relative",paddingBottom:30},
  header:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"15px 18px"},
  logo:{fontSize:20,fontWeight:850,color:BRAND.primary,letterSpacing:"-0.5px",display:"flex",alignItems:"center",gap:7},
  coinChip:{fontSize:12,color:BRAND.coinText,background:BRAND.coinBg,border:`1px solid ${BRAND.coinBorder}`,borderRadius:20,padding:"5px 11px",fontWeight:700},
  menuBtn:{display:"flex",alignItems:"center",gap:6,background:BRAND.surface,border:`1px solid ${BRAND.border}`,borderRadius:20,padding:"3px 9px 3px 3px",cursor:"pointer"},
  menuAvatar:{width:28,height:28,borderRadius:"50%",background:`linear-gradient(145deg,${BRAND.primary},#9C73FF)`,color:"#fff",fontSize:11,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"},
  menuBars:{fontSize:14,color:BRAND.muted,lineHeight:1},

  xpWrap:{padding:"14px 16px 0"},
  xpTop:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6},
  xpTrack:{height:8,background:BRAND.track,borderRadius:8,overflow:"hidden"},
  xpFill:{height:"100%",borderRadius:8,background:`linear-gradient(90deg,${BRAND.accent},${BRAND.primary})`,transition:"width 0.6s cubic-bezier(0.22,1,0.36,1)"},

  nav:{display:"flex",gap:4,padding:"14px 12px 12px",borderBottom:`1px solid ${BRAND.border}`},
  navBtn:{flex:1,padding:"9px 0",border:"none",background:"transparent",borderRadius:11,fontSize:12,fontWeight:600,color:BRAND.muted,cursor:"pointer"},
  navBtnActive:{background:BRAND.surfaceRaised,color:BRAND.primary,fontWeight:800,boxShadow:`0 3px 14px ${BRAND.primaryShadow}`},

  timerView:{padding:"2px 16px 40px"},
  modeRow:{display:"flex",gap:8,marginBottom:14},
  modeBtn:{flex:1,padding:"10px 0",border:`1.5px solid ${BRAND.border}`,background:BRAND.surface,borderRadius:20,fontSize:13,fontWeight:600,color:BRAND.muted,cursor:"pointer"},
  modeBtnActive:{fontWeight:700},

  subjHeader:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8},
  subjHeaderLabel:{fontSize:11,fontWeight:800,color:BRAND.muted,textTransform:"uppercase",letterSpacing:"0.6px"},
  subjEditBtn:{fontSize:11,fontWeight:700,color:BRAND.muted,background:BRAND.surface,border:`1.5px solid ${BRAND.border}`,borderRadius:16,padding:"4px 12px",cursor:"pointer"},
  subjEditBtnActive:{color:BRAND.danger,borderColor:BRAND.danger,background:BRAND.primarySoft},
  subjScroll:{display:"flex",gap:8,overflowX:"auto",paddingBottom:6,marginBottom:10,WebkitOverflowScrolling:"touch"},
  classPickRow:{display:"flex",alignItems:"center",gap:6,overflowX:"auto",paddingBottom:6,marginBottom:8,WebkitOverflowScrolling:"touch"},
  classPickLabel:{fontSize:11,fontWeight:700,color:BRAND.mutedSoft,whiteSpace:"nowrap",flexShrink:0,textTransform:"uppercase",letterSpacing:"0.5px"},
  classPickChip:{padding:"6px 13px",border:`1.5px solid ${BRAND.border}`,background:BRAND.surface,borderRadius:18,fontSize:12,fontWeight:600,color:BRAND.muted,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0},
  classPickChipActive:{borderColor:BRAND.primary,background:BRAND.primarySoft,color:BRAND.primary},
  subjPill:{display:"flex",alignItems:"center",gap:6,padding:"10px 15px",border:`1.5px solid ${BRAND.border}`,background:BRAND.surface,borderRadius:22,cursor:"pointer",color:BRAND.muted,fontWeight:600,whiteSpace:"nowrap",flexShrink:0,transition:"all 0.15s"},
  subjDot:{width:8,height:8,borderRadius:"50%",flexShrink:0},
  subjRemoveInline:{marginLeft:4,fontSize:11,fontWeight:800,color:BRAND.danger,letterSpacing:"0.3px"},
  subjAddPill:{display:"flex",alignItems:"center",padding:"10px 15px",border:`1.5px dashed ${BRAND.borderHi}`,background:"transparent",borderRadius:22,cursor:"pointer",color:BRAND.primary,fontWeight:700,whiteSpace:"nowrap",flexShrink:0},

  avatarWrap:{display:"flex",justifyContent:"center",alignItems:"flex-end",minHeight:260,margin:"6px 0"},
  timerDisplay:{textAlign:"center",fontSize:54,fontWeight:850,letterSpacing:"-3px",margin:"2px 0 5px",fontVariantNumeric:"tabular-nums"},
  timerLabel:{textAlign:"center",fontSize:13,color:BRAND.muted,marginBottom:14,minHeight:18},
  durationRow:{display:"flex",gap:6,justifyContent:"center",marginBottom:14,flexWrap:"wrap"},
  durBtn:{padding:"7px 13px",border:`1.5px solid ${BRAND.border}`,background:BRAND.surface,borderRadius:20,fontSize:13,fontWeight:600,cursor:"pointer",color:BRAND.muted},
  durBtnActive:{fontWeight:700},
  plantBtn:{display:"block",width:"100%",padding:"16px 0",border:"none",borderRadius:16,fontSize:16,fontWeight:800,color:"#fff",cursor:"pointer",boxShadow:`0 10px 28px ${BRAND.primaryShadow}`,letterSpacing:"-0.3px"},
  quickRow:{display:"flex",gap:8,marginTop:16},
  quickBtn:{flex:1,padding:"12px 0",border:`1.5px solid ${BRAND.border}`,background:BRAND.surface,borderRadius:12,fontSize:12,fontWeight:700,color:BRAND.muted,cursor:"pointer"},

  roomBanner:{display:"flex",justifyContent:"space-between",alignItems:"center",background:BRAND.primarySoft,border:`1.5px solid ${BRAND.borderHi}`,borderRadius:14,padding:"11px 14px",marginBottom:12},
  smallGhostBtn:{background:BRAND.surface,border:`1px solid ${BRAND.border}`,borderRadius:16,padding:"6px 13px",fontSize:12,fontWeight:700,color:BRAND.muted,cursor:"pointer"},

  boardView:{padding:"18px 16px 40px"},
  sectionTitle:{fontSize:13,fontWeight:800,color:BRAND.muted,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:12},
  toggleRow:{display:"flex",gap:8,marginBottom:14},
  toggleBtn:{flex:1,padding:"10px 0",border:`1.5px solid ${BRAND.border}`,background:BRAND.surface,borderRadius:11,fontSize:13,fontWeight:600,color:BRAND.muted,cursor:"pointer"},
  toggleBtnActive:{background:BRAND.primary,color:"#fff",border:`1.5px solid ${BRAND.primary}`,fontWeight:700},
  boardRow:{display:"flex",alignItems:"center",gap:8,background:BRAND.surface,border:`1px solid ${BRAND.border}`,borderRadius:14,padding:"13px 15px",marginBottom:8,boxShadow:"var(--lm-shadow-soft)"},
  boardRowMe:{border:`2px solid ${BRAND.primary}`,background:BRAND.primarySoft},
  boardRank:{width:30,fontSize:17,textAlign:"center"},
  empty:{textAlign:"center",color:BRAND.mutedSoft,fontSize:14,marginTop:30,marginBottom:20,lineHeight:1.5},

  // presence
  presenceWrap:{background:BRAND.surface,border:`1px solid ${BRAND.border}`,borderRadius:16,padding:"13px 15px",boxShadow:"var(--lm-shadow-soft)"},
  presenceEmpty:{display:"flex",flexDirection:"column",gap:4,background:BRAND.surface,border:`1px solid ${BRAND.border}`,borderRadius:16,padding:"16px 14px",textAlign:"center",color:BRAND.muted,boxShadow:"var(--lm-shadow-soft)"},
  presenceTitle:{display:"flex",alignItems:"center",gap:6,fontSize:12,fontWeight:800,color:BRAND.primary,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.5px"},
  presenceRow:{display:"flex",gap:8,overflowX:"auto",paddingBottom:4},
  presenceChip:{display:"flex",alignItems:"center",gap:8,background:BRAND.bg,border:`1.5px solid ${BRAND.border}`,borderRadius:14,padding:"8px 12px",flexShrink:0},
  liveDot:{width:8,height:8,borderRadius:"50%",background:BRAND.live,boxShadow:"0 0 0 0 rgba(52,199,89,0.5)",animation:"sgpulse 2s infinite",display:"inline-block"},

  // class campus
  campusHeader:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16},
  campusGrid:{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10},
  campusTile:{display:"flex",flexDirection:"column",alignItems:"center",background:BRAND.surface,borderRadius:16,padding:"10px 8px 12px",border:`2px solid ${BRAND.border}`,position:"relative",boxShadow:"var(--lm-shadow-soft)"},
  campusLive:{position:"absolute",top:8,left:8,display:"flex",alignItems:"center",gap:4,fontSize:10,fontWeight:700,color:BRAND.live},
  classCard:{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",background:BRAND.surface,border:`1.5px solid ${BRAND.border}`,borderRadius:14,padding:"14px 16px",marginBottom:8,cursor:"pointer"},

  // analytics
  statCardRow:{display:"flex",gap:8,marginBottom:14},
  statCard:{flex:1,background:BRAND.surface,border:`1px solid ${BRAND.border}`,borderRadius:16,padding:"14px 8px",textAlign:"center",boxShadow:"var(--lm-shadow-soft)"},
  statNum:{fontSize:20,fontWeight:900,color:BRAND.primary},
  statLbl:{fontSize:11,color:BRAND.muted,marginTop:2},
  panel:{background:BRAND.surface,border:`1px solid ${BRAND.border}`,borderRadius:18,padding:"15px",marginBottom:14,boxShadow:"var(--lm-shadow-soft)"},
  panelTitle:{fontSize:13,fontWeight:700,color:BRAND.ink,marginBottom:12},
  barRow:{display:"flex",justifyContent:"space-between",alignItems:"flex-end",height:110,gap:6},
  barCol:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",height:"100%"},
  barTrack:{flex:1,width:"100%",display:"flex",alignItems:"flex-end",justifyContent:"center"},
  barFill:{width:"70%",borderRadius:"6px 6px 0 0",minHeight:3,transition:"height 0.5s ease"},
  barLbl:{fontSize:10,color:BRAND.mutedSoft,marginTop:6},
  targetTrack:{height:7,background:BRAND.track,borderRadius:8,overflow:"hidden"},
  targetFill:{height:"100%",borderRadius:8,transition:"width 0.5s ease"},

  // modal
  overlay:{position:"fixed",inset:0,background:"rgba(17,14,31,0.58)",display:"flex",alignItems:"center",justifyContent:"center",padding:18,zIndex:300,backdropFilter:"blur(7px)"},
  modal:{background:BRAND.surfaceRaised,color:BRAND.ink,border:`1px solid ${BRAND.border}`,borderRadius:26,padding:"20px",width:"100%",maxWidth:410,maxHeight:"88vh",overflowY:"auto",boxShadow:"0 24px 80px rgba(16,12,38,0.28)"},
  modalTitle:{fontSize:18,fontWeight:850,color:BRAND.ink,margin:0,textAlign:"left",letterSpacing:"-0.3px"},
  menuRow:{display:"block",width:"100%",textAlign:"left",background:BRAND.bg,border:`1.5px solid ${BRAND.border}`,borderRadius:12,padding:"13px 16px",fontSize:14,fontWeight:600,color:BRAND.ink,cursor:"pointer",marginBottom:8},

  // shop
  shopSlotTitle:{fontSize:12,fontWeight:800,color:BRAND.muted,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:8},
  shopGrid:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8},
  shopCard:{display:"flex",flexDirection:"column",alignItems:"center",gap:4,background:BRAND.surface,border:`1.5px solid ${BRAND.border}`,borderRadius:12,padding:"10px 6px",cursor:"pointer"},
  shopTag:{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,background:BRAND.primarySoft,color:BRAND.primary},

  // badges
  badgeGrid:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10},
  badgeCard:{display:"flex",flexDirection:"column",alignItems:"center",gap:4,background:BRAND.bg,borderRadius:14,padding:"12px 6px"},

  // pickers
  pickGrid:{display:"flex",flexWrap:"wrap",gap:6},
  pickEmoji:{width:40,height:40,border:`1.5px solid ${BRAND.border}`,background:BRAND.surface,borderRadius:10,fontSize:18,cursor:"pointer"},
  pickColor:{width:34,height:34,border:"none",borderRadius:"50%",cursor:"pointer"},

  // login
  loginWrap:{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:BRAND.bgGrad,padding:20,fontFamily:"Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"},
  loginCard:{background:BRAND.surface,border:`1px solid ${BRAND.border}`,borderRadius:30,padding:"34px 30px",width:"100%",maxWidth:400,boxShadow:"var(--lm-shadow)",backdropFilter:"blur(20px)",textAlign:"center"},
  loginTitle:{fontSize:30,fontWeight:900,color:BRAND.primary,margin:"0 0 4px",letterSpacing:"-0.5px"},
  loginSub:{fontSize:14,color:BRAND.muted,margin:0},
  loginHint:{fontSize:11,color:BRAND.mutedSoft,margin:"12px 0 0",lineHeight:1.6},
  input:{display:"block",width:"100%",padding:"12px 14px",border:`1.5px solid ${BRAND.border}`,background:BRAND.surfaceRaised,color:BRAND.ink,borderRadius:12,fontSize:15,outline:"none",boxSizing:"border-box",marginBottom:8},
  errText:{color:BRAND.danger,fontSize:12,margin:"0 0 8px",textAlign:"left"},
  primaryBtn:{display:"block",width:"100%",padding:"14px 0",background:BRAND.primary,color:"#fff",border:"none",borderRadius:14,fontSize:16,fontWeight:700,cursor:"pointer",marginTop:8},
  linkBtn:{display:"block",width:"100%",background:"none",border:"none",color:BRAND.primary,fontSize:13,fontWeight:600,cursor:"pointer",marginTop:12,padding:"4px 0"},
  recBox:{background:BRAND.bg,border:`1px solid ${BRAND.border}`,borderRadius:12,padding:"12px",margin:"4px 0 8px",textAlign:"left"},
  recHint:{fontSize:12,color:BRAND.muted,margin:"0 0 8px",lineHeight:1.5},
  toast:{position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",background:BRAND.ink,color:"#fff",padding:"10px 20px",borderRadius:24,fontSize:13,fontWeight:600,boxShadow:"0 4px 16px rgba(30,27,51,0.3)",zIndex:400,maxWidth:"90%",textAlign:"center"},
};
