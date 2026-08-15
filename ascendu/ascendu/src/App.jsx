// STUDYGROVE PREMIUM SKINS BUILD: Moon Tree, Dragon Tree, King's Oak, Diamond Tree, Lion Tree
import { useState, useEffect, useRef, useCallback, useId, useMemo, memo, Fragment } from "react";
import { createPortal } from "react-dom";
import { auth, db, functions } from "./firebase.js";
import {
  POMODORO_PRESETS, advancePomodoroClock, createPomodoroState,
  pomodoroPhaseSeconds, sanitizePomodoroConfig, sanitizePomodoroState,
  startNextPomodoroFocus, validPomodoroFocusSeconds,
} from "./pomodoro.js";
import {
  formatStudyDate, getPreviousStudyWeekKey, getPreviousStudyWeekStart,
  getStudyDayOfWeek, getStudyWeekKey,
  shiftStudyDay, shiftStudyWeek, startOfStudyDay, startOfStudyWeek,
} from "./studyWeek.js";
import { getWeeklyRewardMode, pickDeterministicUnowned } from "./rewardRotation.js";
import {
  isAdminConsoleUsername, normalizeAnimationMode, shouldDisableAnimations,
} from "./accessSettings.js";
import {
  filterBoardForFriends, friendConnectionId, friendNetworkFromConnections,
  normalizeFriendUsername, normalizePresenceRecord,
} from "./friendships.js";
import {
  GROUP_REWARD_MIN_PARTICIPANTS, groupRewardEligibility, groupRows,
  selectLargestEligibleRewardGroup,
} from "./groupRewards.js";
import {
  BACKGROUND_CATALOGUE, BACKGROUND_CSS, BackgroundLayer, BackgroundShop,
  DEFAULT_BACKGROUND_ID, ShopCategoryTabs, backgroundCacheKey,
  canEquipBackground, evaluateBackgroundPurchase, getBackgroundAppearance, normalizeBackgroundId,
  normalizeOwnedBackgrounds, ownedBackgroundsCacheKey,
} from "./backgrounds.jsx";
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, arrayUnion,
  collection, getDocs, increment, runTransaction, onSnapshot,
  query, where, orderBy, limit, startAfter, serverTimestamp
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword, deleteUser, EmailAuthProvider,
  onAuthStateChanged, reauthenticateWithCredential,
  signInWithEmailAndPassword, signInWithCustomToken,
  signOut as firebaseSignOut, updatePassword,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";

// ── Constants ─────────────────────────────────────────────────────────────────
const LS_USER     = "studygrove_username";
const LS_PASSWORD = "studygrove_password";
const LS_SUBJECT  = "studygrove_subject";
const LS_SUBJECTS = "studygrove_subjects";
const LS_MODE     = "studygrove_mode";
const LS_COINS    = "studygrove_coins";
const ADMIN_USERS = (import.meta.env.VITE_LUMORA_ADMIN_USERNAMES || "")
  .split(",").map(canon => canon.trim().normalize("NFC").toLowerCase()).filter(Boolean);
const AUTH_FUNCTIONS_ENABLED = import.meta.env.VITE_LUMORA_AUTH_FUNCTIONS === "true";
const ANNOUNCEMENT_ADMIN = ADMIN_USERS[0] || "";
const ANNOUNCEMENT_REACTIONS = ["🌱","👏","❤️","🎉"];
const LS_EXAMS    = "studygrove_exams";
const LS_SKIN     = "studygrove_skin";
const LS_THEME    = "studygrove_theme";
const LS_ANIMATION_MODE = "lumora_animation_mode";
const LS_TARGETS  = "studygrove_targets";
const LS_DECOR    = "studygrove_decorations"; // owned garden decorations (account-level)
const LEGAL_EFFECTIVE_DATE = "14 August 2026";
const LEGAL_CONTACT_EMAIL = String(import.meta.env.VITE_LEGAL_CONTACT_EMAIL||"lumora.studyapp@gmail.com").trim();
const LS_BADGES   = "studygrove_badges";      // unlocked achievement ids
const LS_GARDEN_LAYOUT = "studygrove_garden_layout"; // exact tree/decor tile positions
const LS_TIMER_STYLE = "studygrove_timer_style";
const LS_POMODORO = "studygrove_pomodoro";
const LS_SELECTED_TASK = "studygrove_selected_task";
const LS_RECAP    = "studygrove_recap_shown";
  // last week-key the recap auto-showed

// Dark theme — a hue-preserving invert applied to the app shell. We invert +
// rotate hue (so colours stay roughly themselves rather than flipping), then
// COUNTER-invert the colourful/media bits (garden SVG, the focus screen, the
// tree) so they render normally. This is reliable across browsers and doesn't
// depend on how React serialises inline styles.
const DARK_CSS = `
[data-theme] .sg-shell { --sg-counter-filter: ; }
[data-theme="dark"] .sg-shell {
  filter: invert(0.93) hue-rotate(180deg);
  --sg-counter-filter: invert(1) hue-rotate(180deg);
  background: #ECF1ED;
  transition: filter 0.25s ease;
}
/* Counter-filter media and marked brand elements so they keep their real colours. */
[data-theme="dark"] .sg-shell .sg-keepcolor {
  filter: invert(1) hue-rotate(180deg);
}
[data-theme="dark"] .sg-shell img,
[data-theme="dark"] .sg-shell svg {
  filter: invert(1) hue-rotate(180deg);
}
/* Emoji are wrapped at runtime only while dark mode is active. */
[data-theme="dark"] .sg-shell [data-sg-emoji] {
  filter: invert(1) hue-rotate(180deg);
}
`;
const APP_CSS = `
@keyframes sgpulse {
  0%   { box-shadow: 0 0 0 0 rgba(52,199,89,0.5); }
  70%  { box-shadow: 0 0 0 7px rgba(52,199,89,0); }
  100% { box-shadow: 0 0 0 0 rgba(52,199,89,0); }
}
.sg-shell ::-webkit-scrollbar { height:5px; width:5px; }
.sg-shell ::-webkit-scrollbar-thumb { background:rgba(0,0,0,0.15); border-radius:8px; }
.sg-shell {
  overflow-x: hidden;
  isolation: isolate;
  position: relative;
  z-index: 1;
  background-color: transparent !important;
  backdrop-filter: blur(2px) saturate(.94);
  -webkit-backdrop-filter: blur(2px) saturate(.94);
  border-color: var(--sg-shell-border,rgba(255,255,255,.34)) !important;
  box-shadow:
    inset 1px 0 0 var(--sg-theme-accent-soft,rgba(110,155,114,.14)),
    inset -1px 0 0 var(--sg-theme-accent-soft,rgba(110,155,114,.14)),
    0 0 34px rgba(24,45,31,.1) !important;
}
.sg-shell::before {
  content:"";
  position:absolute;
  inset:0;
  z-index:-1;
  pointer-events:none;
  background:
    linear-gradient(90deg,rgba(255,255,255,.12),transparent 16%,transparent 84%,rgba(255,255,255,.12)),
    linear-gradient(180deg,rgba(255,255,255,.08),transparent 18%,transparent 82%,rgba(255,255,255,.06));
}
[data-theme="dark"] .sg-shell {
  backdrop-filter:blur(2px) saturate(.82);
  -webkit-backdrop-filter:blur(2px) saturate(.82);
  box-shadow:inset 1px 0 0 rgba(255,255,255,.08),inset -1px 0 0 rgba(255,255,255,.08),0 0 38px rgba(0,0,0,.32) !important;
}
[data-theme="dark"] .sg-shell::before {
  background:
    linear-gradient(90deg,rgba(255,255,255,.07),transparent 16%,transparent 84%,rgba(255,255,255,.07)),
    linear-gradient(180deg,rgba(255,255,255,.05),transparent 18%,transparent 82%,rgba(255,255,255,.04));
}
.sg-shell *, .sg-shell *::before, .sg-shell *::after { box-sizing: border-box; }
.sg-session-screen {
  background:
    linear-gradient(160deg, var(--sg-focus-accent, rgba(86,182,139,.11)) 0%,
    var(--sg-focus-surface, rgba(242,247,241,.91)) 100%) !important;
  backdrop-filter: blur(3px);
}

/* ── Motion system ──────────────────────────────────────────────────────────
   All transforms/opacity only — GPU-composited, no layout thrash, no JS. */

/* Tactile press feedback: every button gently scales down when held, springs
   back on release. The cubic-bezier overshoot gives it that Apple "give". */
.sg-shell button {
  transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.18s ease, box-shadow 0.2s ease;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
.sg-shell button:active { transform: scale(0.94); filter: brightness(0.97); }
/* The big plant button presses a touch deeper for a satisfying "commit" feel */
.sg-plant-btn:active { transform: scale(0.97) translateY(1px); }
.sg-focus-ring:focus { border-color: #56B68B !important; box-shadow: 0 0 0 3px rgba(86,182,139,0.15); }

/* Entrance animations */
@keyframes sgFadeIn   { from { opacity: 0; } to { opacity: 1; } }
@keyframes sgSheetUp  { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes sgPopIn    { from { opacity: 0; transform: scale(0.9) translateY(8px); }
                        to   { opacity: 1; transform: scale(1)   translateY(0); } }
@keyframes sgSlideUp  { from { opacity: 0; transform: translateY(10px); }
                        to   { opacity: 1; transform: translateY(0); } }
@keyframes sgGrowIn   { from { opacity: 0; transform: scale(0.96); }
                        to   { opacity: 1; transform: scale(1); } }

/* Overlays fade their dim background in */
.sg-overlay-anim { animation: sgFadeIn 0.22s ease both; }
/* Bottom sheets spring up from the bottom */
.sg-sheet-anim   { animation: sgSheetUp 0.34s cubic-bezier(0.22, 1, 0.36, 1) both; }
/* Centered modals pop in with a slight overshoot */
.sg-pop-anim     { animation: sgPopIn 0.32s cubic-bezier(0.34, 1.4, 0.64, 1) both; }
/* Tab content eases up when switching screens */
.sg-view-anim    { animation: sgSlideUp 0.28s cubic-bezier(0.22, 1, 0.36, 1) both; }
/* Grid cards grow in, lightly staggered via inline animation-delay */
.sg-card-anim    { animation: sgGrowIn 0.3s cubic-bezier(0.22, 1, 0.36, 1) both; }

/* Shop/menu cards lift slightly on hover (desktop) and press in on tap */
.sg-tap-card { transition: transform 0.2s cubic-bezier(0.34,1.4,0.64,1), box-shadow 0.2s ease; }
.sg-tap-card:active { transform: scale(0.97); }

/* Focus-screen entrance — the whole study view fades + scales in calmly */
.sg-focus-anim { animation: sgGrowIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) both; }

/* Active-session bubbles live only around the safe outer edge of the full-screen
   focus view. The symbol has its own slow motion so the bubble never feels like
   a rigid badge, but both layers remain transform/opacity-only. */
@keyframes sgSessionAtmosphereIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes sgSessionBubbleDrift {
  0%,100% { opacity: var(--sg-opacity-low, .09); transform: translate3d(0, 5px, 0) rotate(-1.5deg) scale(.96); }
  46%     { opacity: var(--sg-opacity-high, .2); transform: translate3d(var(--sg-drift-x, 5px), var(--sg-drift-y, -8px), 0) rotate(var(--sg-drift-rotate, 2deg)) scale(1.02); }
  72%     { opacity: var(--sg-opacity-mid, .15); transform: translate3d(var(--sg-return-x, -2px), var(--sg-return-y, 3px), 0) rotate(-1deg) scale(.99); }
}
@keyframes sgSessionSymbolFloat {
  0%,100% { transform: translate3d(0, 1px, 0) rotate(-2deg); opacity: .78; }
  50%     { transform: translate3d(1px, -2px, 0) rotate(3deg); opacity: 1; }
}
.sg-session-atmosphere {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  animation: sgSessionAtmosphereIn .7s ease-out both;
}
.sg-session-bubble {
  position: absolute;
  display: grid;
  place-items: center;
  border-radius: 50%;
  pointer-events: none;
  user-select: none;
  border: 1px solid currentColor;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.5), 0 5px 18px rgba(40,70,52,.035);
  animation: sgSessionBubbleDrift var(--sg-drift-duration, 20s) ease-in-out var(--sg-drift-delay, 0s) infinite;
  will-change: transform, opacity;
}
.sg-session-bubble--glow { filter: blur(.15px); }
.sg-session-symbol-core {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  animation: sgSessionSymbolFloat var(--sg-symbol-duration, 9s) ease-in-out var(--sg-symbol-delay, 0s) infinite;
}
.sg-session-atmosphere.sg-session-paused .sg-session-bubble,
.sg-session-atmosphere.sg-session-paused .sg-session-symbol-core {
  animation-play-state: paused;
}

/* Compact assessment disclosure. Grid-row interpolation gives the open panel
   a height-and-fade transition without measuring content in React. */
.sg-assessment-card button:focus-visible,
.sg-assessment-editor input:focus-visible,
.sg-assessment-editor select:focus-visible,
.sg-assessment-editor textarea:focus-visible,
.sg-assessment-editor button:focus-visible {
  outline: 3px solid rgba(86,182,139,.24);
  outline-offset: 2px;
}
.sg-assessment-panel {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition: grid-template-rows .24s cubic-bezier(.22,1,.36,1), opacity .18s ease;
}
.sg-assessment-panel.sg-assessment-panel--open {
  grid-template-rows: 1fr;
  opacity: 1;
}
.sg-assessment-panel-inner {
  min-height: 0;
  overflow: hidden;
}
.sg-assessment-chevron {
  transition: transform .22s cubic-bezier(.22,1,.36,1);
}
.sg-assessment-chevron--open {
  transform: rotate(180deg);
}
.sg-assessment-name {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  overflow-wrap: anywhere;
}
.sg-assessment-week {
  display: grid;
  grid-template-columns: repeat(7,minmax(0,1fr));
  gap: 3px;
  width: 100%;
  min-width: 0;
}
@media (max-width: 340px) {
  .sg-assessment-editor .sg-assessment-essential {
    grid-template-columns: minmax(0,1fr) !important;
  }
}

/* Announcements stay outside the 440px app column on roomy screens and become
   a safe-area-aware bottom drawer on phones. The panel overlays the app, so it
   never squeezes or reflows the focus, board or Stats views. */
.sg-announcement-launcher {
  position: fixed;
  z-index: 224;
  top: 82px;
  right: max(16px, calc(50vw - 380px));
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 154px;
  padding: 8px 10px;
  color: #42604B;
  background: rgba(255,255,255,.94);
  border: 1px solid #DDE7D9;
  border-radius: 13px;
  box-shadow: 0 3px 12px rgba(37,63,45,.08);
  cursor: pointer;
  backdrop-filter: blur(8px);
}
.sg-announcement-root {
  font-family: 'Inter','Segoe UI',sans-serif;
}
.sg-announcement-root *,
.sg-announcement-root *::before,
.sg-announcement-root *::after {
  box-sizing: border-box;
}
.sg-announcement-root button {
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
.sg-announcement-root--dark .sg-announcement-launcher,
.sg-announcement-root--dark .sg-announcement-panel {
  filter: invert(.93) hue-rotate(180deg);
}
.sg-announcement-launcher-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11.5px;
  font-weight: 750;
}
.sg-announcement-unread {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  border-radius: 50%;
  background: #E07B54;
  box-shadow: 0 0 0 3px rgba(224,123,84,.13);
}
.sg-announcement-backdrop {
  position: fixed;
  inset: 0;
  z-index: 360;
  background: rgba(18,28,21,.28);
  animation: sgFadeIn .18s ease both;
}
.sg-announcement-panel {
  position: fixed;
  z-index: 361;
  inset: 0 0 0 auto;
  width: min(390px, 100vw);
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  color: #25352A;
  background: #F7FAF6;
  border-left: 1px solid #DFE8DC;
  box-shadow: -10px 0 34px rgba(20,38,26,.15);
  animation: sgAnnouncementSideIn .25s cubic-bezier(.22,1,.36,1) both;
}
@keyframes sgAnnouncementSideIn {
  from { opacity: 0; transform: translate3d(24px,0,0); }
  to { opacity: 1; transform: translate3d(0,0,0); }
}
.sg-announcement-scroll {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 16px calc(22px + env(safe-area-inset-bottom));
}
.sg-announcement-panel button:focus-visible,
.sg-announcement-panel textarea:focus-visible,
.sg-announcement-panel input:focus-visible,
.sg-announcement-panel select:focus-visible,
.sg-announcement-launcher:focus-visible {
  outline: 3px solid rgba(86,182,139,.28);
  outline-offset: 2px;
}
.sg-announcement-copy {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.sg-announcement-clamp {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 5;
  overflow: hidden;
}
.sg-announcement-title,
.sg-announcement-reply-user {
  min-width: 0;
  overflow-wrap: anywhere;
}
.sg-announcement-archive-row {
  display: grid;
  grid-template-columns: minmax(0,1fr) auto;
  gap: 9px;
  align-items: center;
}
.sg-announcement-composer textarea {
  resize: vertical;
  min-height: 118px;
  max-height: 320px;
}
@media (min-width: 701px) and (max-width: 820px) {
  .sg-announcement-launcher {
    top: 78px;
    right: 14px;
    width: 44px;
    height: 44px;
    justify-content: center;
    padding: 0;
    border-radius: 15px;
  }
  .sg-announcement-launcher-label { display: none; }
  .sg-announcement-unread {
    position: absolute;
    top: 8px;
    right: 8px;
  }
}
@media (max-width: 700px) {
  .sg-announcement-launcher {
    top: auto;
    right: max(12px, env(safe-area-inset-right));
    bottom: calc(14px + env(safe-area-inset-bottom));
    max-width: 48px;
    width: 44px;
    height: 44px;
    justify-content: center;
    padding: 0;
    border-radius: 15px;
  }
  .sg-announcement-launcher-label { display: none; }
  .sg-announcement-unread {
    position: absolute;
    top: 8px;
    right: 8px;
  }
  .sg-announcement-backdrop { background: rgba(18,28,21,.34); }
  .sg-announcement-panel {
    inset: auto 0 0;
    width: 100%;
    max-width: none;
    max-height: min(88dvh, 760px);
    border-left: 0;
    border-top: 1px solid #DFE8DC;
    border-radius: 22px 22px 0 0;
    box-shadow: 0 -10px 34px rgba(20,38,26,.16);
    animation-name: sgAnnouncementDrawerIn;
  }
  @keyframes sgAnnouncementDrawerIn {
    from { opacity: 0; transform: translate3d(0,28px,0); }
    to { opacity: 1; transform: translate3d(0,0,0); }
  }
}

/* Grove birds use two flight paths and independent wing/body timelines. CSS
   transforms keep Chrome/Edge compositing smooth without React frame updates. */
@keyframes sgGardenFlockFlyA {
  0%   { transform: translate3d(-118px, 3px, 0) rotate(-1.5deg); opacity: 0; }
  7%   { opacity: 1; }
  28%  { transform: translate3d(55px, -5px, 0) rotate(.8deg); }
  58%  { transform: translate3d(260px, 3px, 0) rotate(-.5deg); }
  92%  { opacity: 1; }
  100% { transform: translate3d(510px, -3px, 0) rotate(1deg); opacity: 0; }
}
@keyframes sgGardenFlockFlyB {
  0%   { transform: translate3d(510px, -2px, 0) rotate(1.2deg); opacity: 0; }
  8%   { opacity: 1; }
  35%  { transform: translate3d(330px, 5px, 0) rotate(-.8deg); }
  67%  { transform: translate3d(115px, -4px, 0) rotate(.6deg); }
  92%  { opacity: 1; }
  100% { transform: translate3d(-118px, 2px, 0) rotate(-1deg); opacity: 0; }
}
@keyframes sgGardenBirdBob {
  0%,100% { transform: translate3d(0, 0, 0) rotate(var(--sg-bird-tilt-a, -1deg)); }
  50%     { transform: translate3d(0, var(--sg-bird-bob, -1.5px), 0) rotate(var(--sg-bird-tilt-b, 2deg)); }
}
@keyframes sgGardenBirdWing {
  0%,100% { transform: rotate(8deg) scaleY(1); }
  46%     { transform: rotate(-12deg) scaleY(-.32); }
  68%     { transform: rotate(3deg) scaleY(.72); }
}
@keyframes sgGardenBirdWingFar {
  0%,100% { transform: rotate(-5deg) scaleY(.72); }
  46%     { transform: rotate(10deg) scaleY(-.22); }
  68%     { transform: rotate(-2deg) scaleY(.5); }
}
.sg-garden-flock {
  animation-duration: var(--sg-flight-duration, 22s);
  animation-timing-function: linear;
  animation-delay: var(--sg-flight-delay, 0s);
  animation-iteration-count: infinite;
  will-change: transform;
}
.sg-garden-flock--a { animation-name: sgGardenFlockFlyA; }
.sg-garden-flock--b { animation-name: sgGardenFlockFlyB; }
.sg-garden-bird-motion {
  animation: sgGardenBirdBob var(--sg-bob-duration, 3.8s) ease-in-out var(--sg-bob-delay, 0s) infinite;
  transform-box: fill-box;
  transform-origin: center;
}
.sg-garden-bird-wing,
.sg-garden-bird-wing-far {
  transform-box: fill-box;
  transform-origin: 88% 72%;
  will-change: transform;
}
.sg-garden-bird-wing {
  animation: sgGardenBirdWing var(--sg-flap-duration, .9s) ease-in-out var(--sg-flap-delay, 0s) infinite;
}
.sg-garden-bird-wing-far {
  animation: sgGardenBirdWingFar var(--sg-flap-duration, .9s) ease-in-out var(--sg-flap-delay, 0s) infinite;
}
.sg-garden-paused .sg-garden-flock,
.sg-garden-paused .sg-garden-bird-motion,
.sg-garden-paused .sg-garden-bird-wing,
.sg-garden-paused .sg-garden-bird-wing-far { animation-play-state: paused !important; }

/* Shop layout safeguards. Inline styles provide the default two-column grid;
   these classes handle genuinely narrow viewports without widening the sheet. */
.sg-shop-sheet { width: min(100%, 460px) !important; max-width: 100vw !important; }
.sg-shop-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
.sg-shop-card { min-width: 0; overflow: hidden; }
@media (max-width: 370px) {
  .sg-shop-grid { grid-template-columns: minmax(0, 1fr) !important; }
}

/* Cards subtly lift on hover (desktop) — a quiet invitation, not a jump */
@media (max-width: 700px) {
  .sg-subj-scroll-arrow { display:none !important; }
}
@media (hover: hover) {
  .sg-lift-card:hover { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(26,42,32,0.10); }
  .sg-tap-card:hover  { transform: translateY(-1.5px); box-shadow: 0 6px 16px rgba(26,42,32,0.08); }
  .sg-shell button:hover:not(:disabled):not(:active) { filter: brightness(1.04); }
}
.sg-lift-card { transition: transform 0.25s cubic-bezier(0.22,1,0.36,1), box-shadow 0.25s ease, border-color 0.2s ease; }

/* Enhancement bloom — a soft ring of light that swells and dissolves */
@keyframes sgBloom {
  0%   { opacity: 0;   transform: scale(0.4); }
  30%  { opacity: 0.9; }
  100% { opacity: 0;   transform: scale(3.2); }
}
.sg-bloom { animation: sgBloom 0.9s cubic-bezier(0.22, 1, 0.36, 1) both; }

/* Preview settles into place when the tier changes — a gentle exhale */
@keyframes sgSettle {
  0%   { opacity: 0.4; transform: scale(0.94) translateY(4px); }
  60%  { transform: scale(1.015) translateY(-1px); }
  100% { opacity: 1;   transform: scale(1) translateY(0); }
}
.sg-preview-settle { animation: sgSettle 0.45s cubic-bezier(0.22, 1, 0.36, 1) both; transform-origin: bottom center; }
.sg-preview-settle > svg, .sg-preview-settle > * { transform-origin: bottom center; }

/* Loading skeletons — shimmer instead of blank space or bare "Loading..." */
@keyframes sgShimmer { from { background-position: -200% 0; } to { background-position: 200% 0; } }
.sg-skeleton {
  background: linear-gradient(90deg, #EDF1EA 25%, #F7FAF5 50%, #EDF1EA 75%);
  background-size: 200% 100%;
  animation: sgShimmer 1.4s ease-in-out infinite;
  border-radius: 12px;
}

/* Tooltips fade in smoothly (garden hover cards) */
@keyframes sgTipIn { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }
.sg-tip-fade { animation: sgTipIn 0.18s ease-out both; }

/* ── Celebration (session complete) ── */
@keyframes sgConfetti {
  0%   { opacity: 1; transform: translateY(-10px) rotate(0deg); }
  100% { opacity: 0; transform: translateY(150px) rotate(320deg); }
}
.sg-confetti { position: absolute; top: 0; width: 7px; height: 10px; border-radius: 2px;
  animation: sgConfetti 1.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both; pointer-events: none; }
@keyframes sgBounceIn {
  0%   { opacity: 0; transform: scale(0.3); }
  55%  { opacity: 1; transform: scale(1.15); }
  75%  { transform: scale(0.95); }
  100% { transform: scale(1); }
}
.sg-bounce-in { animation: sgBounceIn 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
@keyframes sgStreakPop {
  0%   { opacity: 0; transform: scale(0.6); }
  60%  { opacity: 1; transform: scale(1.12); }
  100% { transform: scale(1); }
}
.sg-streak-pop { animation: sgStreakPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s both; }

/* Honour users who prefer less motion */
@keyframes sgStormPulse{0%,100%{opacity:.46}50%{opacity:1}}
@keyframes sgStormArc{0%,82%,100%{opacity:.12}85%{opacity:.82}88%{opacity:.25}91%{opacity:.72}}
@keyframes sgStormOrb{0%,100%{transform:translateY(0);opacity:.5}50%{transform:translateY(-3px);opacity:.95}}
@keyframes sgStormFloat{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-2px) rotate(2deg)}}
.sg-energy-pulse{animation:sgStormPulse 3.8s ease-in-out infinite}.sg-storm-arc{animation:sgStormArc 7.5s ease-in-out infinite}.sg-storm-orb{animation:sgStormOrb 4.8s ease-in-out infinite}.sg-storm-float{animation:sgStormFloat 5.6s ease-in-out infinite}
.sg-garden-paused .sg-energy-pulse,.sg-garden-paused .sg-storm-arc,.sg-garden-paused .sg-storm-orb,.sg-garden-paused .sg-storm-float{animation-play-state:paused!important}
.sg-duration-slider{width:100%;height:5px;border-radius:999px;appearance:none;-webkit-appearance:none;outline:none;cursor:pointer;background:linear-gradient(90deg,var(--sg-slider-color) 0 var(--sg-slider-progress),#E5EAE3 var(--sg-slider-progress) 100%)}
.sg-duration-slider::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:#fff;border:3px solid var(--sg-slider-color);box-shadow:0 2px 8px rgba(30,50,35,.18)}
.sg-duration-slider::-moz-range-thumb{width:17px;height:17px;border-radius:50%;background:#fff;border:3px solid var(--sg-slider-color);box-shadow:0 2px 8px rgba(30,50,35,.18)}
.sg-duration-slider:focus-visible{outline:3px solid color-mix(in srgb,var(--sg-slider-color) 28%,transparent);outline-offset:8px}
.sg-timer-style{display:grid;grid-template-columns:1fr 1fr;gap:3px;padding:3px;background:#EAF0E7;border-radius:13px;margin-bottom:10px}
.sg-timer-style button{min-height:40px;border:0;border-radius:10px;background:transparent;color:#788177;font-size:12px;font-weight:700;cursor:pointer}
.sg-timer-style button[aria-pressed="true"]{background:#fff;color:#2D6A4F;box-shadow:0 1px 4px rgba(35,64,43,.1)}
.sg-pomodoro-presets{display:flex;gap:7px;overflow-x:auto;scrollbar-width:none;padding:1px 1px 5px;overscroll-behavior-inline:contain}
.sg-pomodoro-presets::-webkit-scrollbar{display:none}
.sg-pomodoro-presets button{flex:0 0 auto;min-height:40px;padding:7px 12px;border:1px solid #DDE7DA;border-radius:18px;background:#fff;color:#747D73;font-size:12px;font-weight:700;cursor:pointer}
.sg-pomodoro-presets button[aria-pressed="true"]{border-color:var(--sg-accent);background:color-mix(in srgb,var(--sg-accent) 10%,white);color:var(--sg-accent)}
.sg-pomo-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
.sg-pomo-field label{display:block;font-size:9.5px;font-weight:750;letter-spacing:.35px;text-transform:uppercase;color:#929A91;margin:0 0 4px}
.sg-pomo-field input,.sg-pomo-field select{width:100%;min-height:38px;border:1px solid #DDE5DB;border-radius:10px;background:#fff;color:#31443A;padding:7px 8px;font:600 12px/1.2 Inter,system-ui,sans-serif}
.sg-task-card button:focus-visible,.sg-task-card input:focus-visible,.sg-task-card select:focus-visible,
.sg-timer-style button:focus-visible,.sg-pomodoro-presets button:focus-visible{outline:3px solid rgba(45,106,79,.2);outline-offset:2px}
.sg-task-row{display:grid;grid-template-columns:40px minmax(0,1fr) 40px 40px;gap:4px;align-items:center;padding:7px 0;border-top:1px solid #EDF1EB}
.sg-task-row:first-child{border-top:0}
.sg-task-check{width:40px;height:40px;border-radius:50%;border:1px solid #DCE5D9;background:#fff;color:#2D6A4F;cursor:pointer;transition:transform .16s ease,background .16s ease,border-color .16s ease}
.sg-task-check[data-checked="true"]{background:#E6F3E8;border-color:#94B99B;transform:scale(.94)}
.sg-task-title{min-width:0;color:#34453B;font-size:12.5px;line-height:1.35;overflow-wrap:anywhere}
.sg-task-title[data-complete="true"]{color:#99A29A;text-decoration:line-through}
.sg-task-icon{width:40px;height:40px;border:0;border-radius:10px;background:transparent;color:#8A948A;cursor:pointer}
.sg-task-icon[aria-pressed="true"]{background:#E8F4EB;color:#2D6A4F}
.sg-task-edit{display:grid;grid-template-columns:minmax(0,1fr) minmax(92px,.55fr);gap:7px;margin-top:7px}
.sg-task-edit input,.sg-task-edit select{min-width:0;min-height:40px;border:1px solid #DDE5DB;border-radius:10px;background:#fff;padding:8px 10px;color:#31443A;font-size:12px}
.sg-task-due{grid-column:1/-1}
.sg-task-actions{display:flex;gap:7px;justify-content:flex-end;margin-top:7px}
.sg-task-actions button{min-height:38px;border:0;border-radius:10px;padding:7px 12px;font-size:12px;font-weight:700;cursor:pointer}
.sg-break-screen{background:linear-gradient(160deg,#EAF4EF 0%,#F7F2E9 100%)!important}
.sg-focus-task{position:relative;z-index:3;max-width:320px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;color:#68766D;background:rgba(255,255,255,.68);border:1px solid rgba(255,255,255,.85);border-radius:16px;padding:6px 11px;margin:0 0 10px}
@media (max-width:380px){
  .sg-pomo-grid{grid-template-columns:1fr 1fr}
  .sg-pomo-field:last-child{grid-column:1/-1}
  .sg-task-edit{grid-template-columns:1fr}
  .sg-task-due{grid-column:auto}
}
@media (max-height:720px){
  .sg-session-screen{padding-bottom:max(14px,env(safe-area-inset-bottom))!important}
  .sg-session-top{padding-top:max(18px,calc(env(safe-area-inset-top) + 8px))!important}
  .sg-session-tree{min-height:120px}
  .sg-session-tree svg{max-height:220px}
  .sg-session-time{font-size:54px!important;margin-bottom:3px!important}
  .sg-session-mode{margin-bottom:10px!important;font-size:13px!important}
  .sg-session-progress-label{margin-bottom:12px!important}
  .sg-session-warning{margin-top:8px!important}
}
html[data-animation-disabled="true"] .sg-shell * {
  animation: none !important;
  transition: none !important;
  scroll-behavior: auto !important;
}
html[data-animation-disabled="true"] .sg-session-atmosphere { opacity: 1; }
html[data-animation-disabled="true"] .sg-session-bubble { opacity: .13; transform: none; will-change: auto; }
html[data-animation-disabled="true"] .sg-garden-flock--a { transform: translate3d(86px, 1px, 0); opacity: .68; }
html[data-animation-disabled="true"] .sg-garden-flock--b { transform: translate3d(310px, 7px, 0); opacity: .56; }
html[data-animation-disabled="true"] .sg-garden-flock,
html[data-animation-disabled="true"] .sg-garden-bird-motion,
html[data-animation-disabled="true"] .sg-garden-bird-wing,
html[data-animation-disabled="true"] .sg-garden-bird-wing-far { will-change: auto; }
@media (max-width:520px){
  .sg-milestone-layout{
    grid-template-columns:repeat(3,minmax(0,1fr))!important;
  }
}
@media (max-width:350px){
  .sg-milestone-layout{grid-template-columns:repeat(3,minmax(0,1fr))!important}
}
@keyframes sgMilestoneSlideNext{
  from{opacity:.2;transform:translateX(18px) scale(.97)}
  to{opacity:1;transform:translateX(0) scale(1)}
}
@keyframes sgMilestoneSlidePrev{
  from{opacity:.2;transform:translateX(-18px) scale(.97)}
  to{opacity:1;transform:translateX(0) scale(1)}
}
@keyframes sgMilestoneDetails{
  from{opacity:0;transform:translateY(7px)}
  to{opacity:1;transform:translateY(0)}
}
.sg-milestone-art-next{animation:sgMilestoneSlideNext .38s cubic-bezier(.22,1,.36,1) both}
.sg-milestone-art-prev{animation:sgMilestoneSlidePrev .38s cubic-bezier(.22,1,.36,1) both}
.sg-milestone-details{animation:sgMilestoneDetails .32s ease-out both}
`;
const LS_ACTIVE   = "studygrove_active_session";
// Cross-tab session lock: LS_ACTIVE is a SINGLE shared localStorage slot, so
// without an owner tag two tabs can silently stomp on each other — one tab's
// clean finish can wipe out another tab's still-running snapshot, and two
// tabs each tracking their own "elapsed" for the same real hour can both
// credit it, doubling coins/leaderboard time. Tagging every write with a
// per-tab id + a refreshed heartbeat turns LS_ACTIVE into a real signal:
// "is a session live RIGHT NOW, and whose is it" — rather than an ambiguous
// last-write-wins snapshot.
const TAB_HEARTBEAT_MS = 4000;  // how often the running tab refreshes its heartbeat
const TAB_STALE_MS     = 12000; // beyond this with no heartbeat, treat the owner as dead
// The ONE function every username comparison/storage key should go through.
// .toLowerCase() alone is NOT enough: accented text (Vietnamese, French,
// Spanish, etc.) can be encoded as either precomposed characters (NFC) or a
// base letter + separate combining marks (NFD) — the two render pixel-
// identical but are different strings at the code-point level, so two
// people typing what looks like the exact same name on different devices/
// keyboards/OSes can still fork into two Firestore documents even after
// lowercasing. Normalizing to NFC first closes that gap for every script,
// not just ASCII case.
const canonUsername = (raw) => (raw||"").trim().normalize("NFC").toLowerCase();

async function usernameForUid(uid){
  const snap=await getDocs(query(collection(db,"usernames"),where("uid","==",uid),limit(1)));
  const match=snap.docs[0];
  return match?(match.data().displayName||match.id):null;
}

const genTabId = () => (crypto?.randomUUID ? crypto.randomUUID() : `t${Date.now()}_${Math.random().toString(36).slice(2)}`);
const parseActive = (raw) => { try { return raw ? JSON.parse(raw) : null; } catch { return null; } };
// "Live elsewhere" = owned by a different tab AND its heartbeat hasn't gone stale
const isLiveElsewhere = (active, myTabId) =>
  !!(active && active.tabId && active.tabId !== myTabId && (Date.now() - (active.hb||0)) < TAB_STALE_MS);
const activeBelongsToUser = (active,username) =>
  !active?.username || canonUsername(active.username)===canonUsername(username);
const getRecoverableSeconds = (active,now=Date.now(),maxSeconds=4*3600) => {
  if(!active)return 0;
  const base=Math.max(0,Number(active.base)||0);
  let secs=base;
  if(!active.paused && Number.isFinite(Number(active.startTs)) && Number(active.startTs)>0){
    secs+=Math.max(0,Math.floor((now-Number(active.startTs))/1000));
  }
  return Math.max(0,Math.min(secs,Math.max(60,Number(maxSeconds)||4*3600)));
};

const DEFAULT_SUBJECTS = [
  { id:"math",    label:"Mathematics", emoji:"📐", color:"#5B8DEF" },
  { id:"english", label:"English",     emoji:"📖", color:"#E07B54" },
];

// Subject scenery is matched against both ids and user-editable labels, so
// custom names such as "Maths Methods", "HPE" and "English Literature" work
// without creating a second subject system. Four marked bubbles is the hard
// scene cap; unrecognised subjects use the calm general-study family.
const subjectVisual = (value,kind="emoji") => ({ value,kind });
const SUBJECT_BACKDROP_FAMILIES = [
  { id:"math", match:/\b(math|maths|mathematics|numeracy|algebra|calculus|geometry|statistics|methods|specialist)\b/,
    visuals:[subjectVisual("+","glyph"),subjectVisual("−","glyph"),subjectVisual("×","glyph"),subjectVisual("÷","glyph")] },
  { id:"pe", match:/\b(pe|hpe|sport|sports|physical education|health and physical)\b/,
    visuals:[subjectVisual("💪"),subjectVisual("⚽"),subjectVisual("🏀"),subjectVisual("dumbbell","dumbbell")] },
  { id:"english", match:/\b(english|literature|writing|language arts|creative writing)\b/,
    visuals:[subjectVisual("✏️"),subjectVisual("🖊️"),subjectVisual("📖"),subjectVisual("💬")] },
  { id:"biology", match:/\b(biology|bio|life science|anatomy)\b/,
    visuals:[subjectVisual("🧬"),subjectVisual("◉","glyph"),subjectVisual("🌿"),subjectVisual("🔬")] },
  { id:"chemistry", match:/\b(chemistry|chem)\b/,
    visuals:[subjectVisual("⚛️"),subjectVisual("⚗️"),subjectVisual("H₂O","glyph"),subjectVisual("C","glyph")] },
  { id:"physics", match:/\b(physics|mechanics)\b/,
    visuals:[subjectVisual("🧲"),subjectVisual("⚡"),subjectVisual("🪐"),subjectVisual("∿","glyph")] },
  { id:"history", match:/\b(history|ancient|modern history)\b/,
    visuals:[subjectVisual("📜"),subjectVisual("🏛️"),subjectVisual("🕰️"),subjectVisual("🗺️")] },
  { id:"geography", match:/\b(geography|geo|earth science)\b/,
    visuals:[subjectVisual("🌍"),subjectVisual("🧭"),subjectVisual("⛰️"),subjectVisual("🗺️")] },
  { id:"computing", match:/\b(computing|computer science|software|coding|programming|digital technology|information technology|it)\b/,
    visuals:[subjectVisual("</>","glyph"),subjectVisual("01","glyph"),subjectVisual("▣","glyph"),subjectVisual("_","glyph")] },
  { id:"art", match:/\b(art|visual arts|design)\b/,
    visuals:[subjectVisual("🎨"),subjectVisual("🖌️"),subjectVisual("◆","glyph"),subjectVisual("○","glyph")] },
  { id:"music", match:/\b(music|instrumental)\b/,
    visuals:[subjectVisual("♪","glyph"),subjectVisual("♫","glyph"),subjectVisual("🎹"),subjectVisual("🎧")] },
  { id:"languages", match:/\b(language|languages|french|spanish|german|italian|japanese|chinese|mandarin|latin)\b/,
    visuals:[subjectVisual("💬"),subjectVisual("🌐"),subjectVisual("Aa","glyph"),subjectVisual("文","glyph")] },
  { id:"business", match:/\b(economics|economy|business|commerce|accounting|finance)\b/,
    visuals:[subjectVisual("📊"),subjectVisual("🧮"),subjectVisual("🪙"),subjectVisual("📄")] },
  { id:"psychology", match:/\b(psychology|psych)\b/,
    visuals:[subjectVisual("🧠"),subjectVisual("💭"),subjectVisual("◇","glyph"),subjectVisual("?","glyph")] },
  { id:"legal", match:/\b(legal|law|politics|civics)\b/,
    visuals:[subjectVisual("⚖️"),subjectVisual("📄"),subjectVisual("🏛️"),subjectVisual("✓","glyph")] },
  { id:"science", match:/\b(science|stem)\b/,
    visuals:[subjectVisual("🔬"),subjectVisual("🧪"),subjectVisual("⚛️"),subjectVisual("🧬")] },
];

function getSubjectBackdropFamily(subject) {
  const key=`${subject?.id||""} ${subject?.label||""}`.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  return SUBJECT_BACKDROP_FAMILIES.find(family=>family.match.test(key)) || {
    id:"general",
    visuals:[subjectVisual("📖"),subjectVisual("💡"),subjectVisual("📝"),subjectVisual("⭐")],
  };
}

// Fixed edge-only positions form a clear central lane for the tree, timer and
// controls at phone, tablet and desktop widths. Values are deterministic so a
// timer re-render never makes the atmosphere jump, while timings remain varied.
const SESSION_SYMBOL_LAYOUT = [
  {top:"16%",left:"4%",size:42,dx:"8px",dy:"-10px",rx:"-3px",ry:"4px",rot:"3deg",dur:22,delay:-2,opacityLow:.08,opacityMid:.14,opacityHigh:.2},
  {top:"27%",right:"5%",size:35,dx:"-7px",dy:"-13px",rx:"3px",ry:"5px",rot:"-4deg",dur:25,delay:-11,opacityLow:.07,opacityMid:.13,opacityHigh:.18},
  {bottom:"25%",left:"5%",size:38,dx:"10px",dy:"-7px",rx:"-4px",ry:"3px",rot:"4deg",dur:27,delay:-17,opacityLow:.07,opacityMid:.12,opacityHigh:.17},
  {bottom:"29%",right:"1%",size:40,dx:"-3px",dy:"-11px",rx:"1px",ry:"4px",rot:"-3deg",dur:24,delay:-7,opacityLow:.06,opacityMid:.12,opacityHigh:.18},
];
const SESSION_GLOW_LAYOUT = [
  {top:"40%",left:"2%",size:22,dx:"7px",dy:"-16px",rx:"-2px",ry:"5px",dur:29,delay:-19,opacityLow:.04,opacityMid:.08,opacityHigh:.12},
  {top:"48%",right:"3%",size:27,dx:"-8px",dy:"-12px",rx:"3px",ry:"5px",dur:31,delay:-4,opacityLow:.04,opacityMid:.08,opacityHigh:.11},
  {bottom:"23%",left:"17%",size:18,dx:"6px",dy:"-9px",rx:"-2px",ry:"3px",dur:26,delay:-13,opacityLow:.03,opacityMid:.07,opacityHigh:.1},
];

const EMOJI_OPTIONS = ["📐","📖","🔬","🏛️","🌏","📊","🎨","✏️","💻","🎵","🏃","🧪","📝","🌍","🔭","💡","📚","🧠","⚙️","🎯"];
const COLOR_OPTIONS = ["#5B8DEF","#E07B54","#56B68B","#C57BDB","#E8B84B","#6ECBD1","#F07B8F","#A0A0B0","#FF6B6B","#4ECDC4","#45B7D1","#96CEB4"];
const COINS_PER_MIN = 1;
const WEEKLY_PODIUM_REWARDS = [300, 150, 100];

// Collections power the shop's filter chips. Order here = chip order.
const SKIN_COLLECTIONS = [
  { id:"all",      label:"All",      icon:"🌱" },
  { id:"starter",  label:"Starter",  icon:"🌰" },
  { id:"classic",  label:"Classic",  icon:"🍂" },
  { id:"shapes",   label:"Shapes",   icon:"🌳" },
  { id:"tropical", label:"Tropical", icon:"🌴" },
  { id:"treats",   label:"Treats",   icon:"🍰" },
  { id:"mystical", label:"Mystical", icon:"✨" },
  { id:"premium",  label:"Premium",  icon:"💠" },
];

const TREE_SKINS = [
  // ── Starter ──
  { id:"default",  name:"Oak",           cost:0,    shape:"round",   trunk:"#8B6340", canopy:null,      desc:"Your starter tree", collection:"starter" },
  // ── Colour variants (round shape, recoloured) ──
  { id:"cherry",   name:"Cherry (colour)",cost:120, shape:"round",   trunk:"#A0624A", canopy:"#F4A7B9", desc:"Soft pink leaves", collection:"classic" },
  { id:"pine",     name:"Evergreen",      cost:120, shape:"round",   trunk:"#6B4F2A", canopy:"#2D6A4F", desc:"Deep forest green", collection:"classic" },
  { id:"autumn",   name:"Autumn",         cost:150, shape:"round",   trunk:"#7A4F2A", canopy:"#D4722A", desc:"Warm golden leaves", collection:"classic" },
  { id:"copperbeech",name:"Copper Beech", cost:180, shape:"round",   trunk:"#6B4A36", canopy:"#B5651D", desc:"Warm copper leaves, year-round", collection:"classic", isNew:true },
  // ── Magical premium skins (glowing canopies with moons, stars & sparkles) ──
  { id:"neon",     name:"Bioluminescent", cost:200,  shape:"round",   trunk:"#3A3352", canopy:"#22E39A", desc:"Glows softly in the dark", magic:{ glow:"#22E39A", sparkle:true }, collection:"mystical" },
  { id:"galaxy",   name:"Galaxy",         cost:400,  shape:"round",   trunk:"#2A1A4A", canopy:"#5B3A8E", desc:"A canopy full of stars", magic:{ glow:"#7A4FB0", stars:true, sparkle:true }, collection:"mystical" },
  { id:"enchanted",name:"Enchanted Tree", cost:1300, shape:"round",   trunk:"#4A3B2A", canopy:"#5FAE6E", desc:"Ivy, fireflies & a ring of toadstools 🍄", magic:{ glow:"#8FE0A0", enchanted:true }, collection:"mystical", isNew:true },
  { id:"moonlit",  name:"Moonlit Oak",    cost:900,  shape:"round",   trunk:"#3A2E4E", canopy:"#2E4A7A", desc:"A glowing crescent moon 🌙", magic:{ glow:"#7FA8E8", moon:true, stars:true }, collection:"mystical" },
  { id:"starlight",name:"Starlight Willow",cost:1100,shape:"willow",  trunk:"#3A3352", canopy:"#3E5C88", desc:"Draped in golden stars ✨", magic:{ glow:"#8FB0E8", stars:true, sparkle:true }, collection:"mystical" },
  { id:"celestial",name:"Celestial Bloom",cost:1400, shape:"blossom", trunk:"#4A3A5E", canopy:"#6E7BC8", desc:"Moon, stars & falling petals", magic:{ glow:"#9BA8E8", moon:true, stars:true, sparkle:true }, collection:"mystical" },
  { id:"rainbow",  name:"Rainbow Tree",   cost:1350, shape:"round",   trunk:"#6B4A3A", canopy:"#FF9C4A", desc:"A canopy that catches every colour ☀️", magic:{ glow:"#FFFFFF", rainbow:true, sparkle:true }, collection:"mystical", isNew:true },
  { id:"lightning",name:"Lightning Tree", cost:1450, shape:"round",   trunk:"#2E2A38", canopy:"#4A5FBF", desc:"Crackles with static after a storm ⚡", magic:{ glow:"#7FA8FF", storm:true }, collection:"mystical", isNew:true },
  // ── Flagship Premium Collection ──
  { id:"moontree", name:"Moon Tree", cost:1600, shape:"round", trunk:"#AEBECD", canopy:"#EAF5FF", desc:"A peaceful celestial sanctuary 🌙", collection:"premium", flagship:true, premiumTheme:"moon", isNew:true,
    enhanceTiers:[
      { tier:1, name:"Flourish", icon:"🌙", blurb:"Moon flowers bloom through glowing root grass while silver leaves shimmer with a soft blue aura." },
      { tier:2, name:"Living", icon:"💠", blurb:"Crystal moon charms, crescent ornaments, glowing mushrooms, blue flowers and drifting lunar motes appear." },
      { tier:3, name:"Radiant", icon:"✨", blurb:"A great crescent rises behind the canopy as stars orbit, crystal stones float, fireflies drift and moonbeams pulse." },
    ] },
  { id:"dragontree", name:"Dragon Tree", cost:1900, shape:"round", trunk:"#5A3A24", canopy:"#2F8A58", desc:"An ancient dragon sanctuary 🐉", collection:"premium", flagship:true, premiumTheme:"dragon", isNew:true,
    enhanceTiers:[
      { tier:1, name:"Flourish", icon:"🐲", blurb:"Golden vines wrap an ancient claw-marked trunk while enchanted gemstones brighten the roots." },
      { tier:2, name:"Living", icon:"🥚", blurb:"Dragon eggs, amber lanterns, banners, coins, root horns and rising embers turn the tree into a guarded nest." },
      { tier:3, name:"Radiant", icon:"🐉", blurb:"A crowned hatchling spreads its wings from the canopy while another sleeps beside treasure, glowing runes and giant gems." },
    ] },
  { id:"kingsoak", name:"King's Oak", cost:1750, shape:"round", trunk:"#765332", canopy:"#356F45", desc:"The royal oak of an ancient kingdom 👑", collection:"premium", flagship:true, premiumTheme:"king", isNew:true,
    enhanceTiers:[
      { tier:1, name:"Flourish", icon:"👑", blurb:"Gold detailing, a royal banner and a polished stone root platform establish the oak's noble identity." },
      { tier:2, name:"Living", icon:"🏰", blurb:"Lanterns, marble statues, a stone path, golden acorns, climbing ivy and royal flags complete the palace classroom." },
      { tier:3, name:"Radiant", icon:"✨", blurb:"The jeweled crown rests above the canopy while a marble fountain, royal benches, doves, fencing and golden sparkles complete the royal centrepiece." },
    ] },
  { id:"diamondtree", name:"Diamond Tree", cost:2200, shape:"round", trunk:"#BFE7F2", canopy:"#DDF7FF", desc:"The rarest crystal collectible 💎", collection:"premium", flagship:true, premiumTheme:"diamond", isNew:true,
    enhanceTiers:[
      { tier:1, name:"Flourish", icon:"💎", blurb:"Faceted diamond leaves, crystal roots and icy grass intensify the tree's clean radiant glow." },
      { tier:2, name:"Living", icon:"❄️", blurb:"Hanging shards, root diamonds, crystal flowers, floating gems, crystal bushes and frost sparkles emerge." },
      { tier:3, name:"Radiant", icon:"🌈", blurb:"A giant diamond finial locks into the canopy above crystal arches and an elevated platform while fragments orbit through rainbow refractions." },
    ] },
  { id:"liontree", name:"Lion Tree", cost:2800, shape:"round", trunk:"#623726", canopy:"#B62F3A", desc:"An awakened lion guarding a festival classroom 🦁", collection:"premium", flagship:true, premiumTheme:"lion", isNew:true,
    enhanceTiers:[
      { tier:1, name:"Flourish", icon:"🧧", blurb:"Gold brocade curls, knotted tassels and jade accents dress the awakened lion in an auspicious festival mantle." },
      { tier:2, name:"Living", icon:"🥁", blurb:"Lanterns glow beside an ornamental firecracker garland, ceremonial drum, oranges, prosperity greens and a cluster of red packets." },
      { tier:3, name:"Radiant", icon:"🦁", blurb:"The lion blinks and drums beneath a radiant festival halo, fortune seal, dancing ribbons and gold festival sparkles." },
    ] },
  // ── New distinct SHAPES (premium) ──
  { id:"blossom",  name:"Cherry Blossom", cost:600,  shape:"blossom", trunk:"#7C4A36", canopy:"#F7B7CE", desc:"Blooming pink sakura 🌸", collection:"shapes" },
  { id:"pinetree", name:"Pine Tree",      cost:650,  shape:"pine",    trunk:"#5E4327", canopy:"#2F7D4F", desc:"Tall layered conifer 🌲", collection:"shapes" },
  { id:"frostedpine",name:"Frosted Pine", cost:520,  shape:"pine",    trunk:"#5A4530", canopy:"#3A7D63", desc:"Dusted with a permanent frost ❄️", frosted:true, collection:"shapes", isNew:true },
  { id:"willow",   name:"Willow",         cost:750,  shape:"willow",  trunk:"#6E5331", canopy:"#8FB95A", desc:"Graceful drooping branches", collection:"shapes" },
  { id:"wisteria", name:"Wisteria",       cost:830,  shape:"willow",  trunk:"#5E4A3A", canopy:"#9B7EDE", desc:"Drooping clusters of lilac blossom", collection:"shapes", isNew:true },
  { id:"maple",    name:"Red Maple",      cost:800,  shape:"maple",   trunk:"#6B4226", canopy:"#E0533A", desc:"Fiery autumn crown 🍁", collection:"shapes" },
  { id:"ginkgo",   name:"Golden Ginkgo",  cost:840,  shape:"maple",   trunk:"#6E5433", canopy:"#E8B84B", desc:"Fan-shaped leaves that turn pure gold", leafEmoji:"🍂", collection:"shapes", isNew:true },
  // ── Tropical Collection (new silhouettes) ──
  { id:"goldenbamboo",name:"Golden Bamboo",cost:650, shape:"bamboo",  trunk:"#C9A227", canopy:"#7FAE52", desc:"Slender gold stalks, always swaying 🎋", collection:"tropical", isNew:true },
  { id:"bananatree",name:"Banana Tree",   cost:780,  shape:"banana",  trunk:"#9BB06E", canopy:"#3E8F4F", desc:"Broad leaves over a ripening bunch 🍌", collection:"tropical", isNew:true },
  { id:"coconutpalm",name:"Coconut Palm", cost:900,  shape:"palm",    trunk:"#B08A5A", canopy:"#4CAE72", desc:"Leans into the breeze, coconuts and all 🥥", collection:"tropical", isNew:true },
  // ── Food items (premium, playful) ──
  { id:"muffin",   name:"Blueberry Muffin",cost:1000, shape:"muffin",  trunk:"#B6885B", canopy:"#6B4E9E", desc:"A treat in your classroom 🧁", collection:"treats" },
  { id:"cupcake",  name:"Strawberry Cupcake",cost:1200,shape:"cupcake",trunk:"#E8B4C8", canopy:"#F25C8A", desc:"Sweet & frosted 🍓", collection:"treats" },
  { id:"cake",     name:"Layer Cake",     cost:1800, shape:"cake",    trunk:"#D9B38C", canopy:"#7EC9E0", desc:"The ultimate flex 🎂", collection:"treats" },
];

const TREE_SHOP_RARITY_ORDER = Object.freeze({
  starter:0,
  classic:1,
  shapes:2,
  tropical:2,
  treats:3,
  mystical:4,
  premium:5,
});
const TREE_SHOP_CATALOGUE = Object.freeze([...TREE_SKINS].sort((left,right)=>
  (TREE_SHOP_RARITY_ORDER[left.collection] ?? Number.MAX_SAFE_INTEGER)
    - (TREE_SHOP_RARITY_ORDER[right.collection] ?? Number.MAX_SAFE_INTEGER)
  || Number(left.cost||0)-Number(right.cost||0)
  || left.name.localeCompare(right.name)
));

// ── Tree Enhancements ─────────────────────────────────────────────────────────
// Three permanent tiers per skin, rendered by ONE parameterized layer engine
// (not hand-drawn variants) — each skin contributes only its palette + particle
// type; the engine applies the tier effects. A tier applies retroactively to
// every tree of that skin already in the forest AND all future ones, because
// tier is stored per-skin on the account (prefs.enhancements), not per-tree.
// Central visual-footprint metadata is shared by placement and rendering.
// Existing skin ids and saved tile keys stay untouched.
const TREE_SHAPE_STANDARDS = {
  round:{width:1.04,height:1.02,visualScale:1,canopyScale:1,trunkScale:1,gardenGap:.08,effectBounds:1.18,motionIntensity:.72,particleDensity:2},
  blossom:{width:1.17,height:1.06,visualScale:.99,canopyScale:1.03,trunkScale:1,gardenGap:.13,effectBounds:1.22,motionIntensity:.62,particleDensity:3},
  pine:{width:1.06,height:1.18,visualScale:.98,canopyScale:.95,trunkScale:1.08,gardenGap:.1,effectBounds:1.12,motionIntensity:.45,particleDensity:2},
  willow:{width:1.27,height:1.08,visualScale:.98,canopyScale:1.02,trunkScale:1.02,gardenGap:.2,effectBounds:1.22,motionIntensity:.5,particleDensity:2},
  maple:{width:1.15,height:1.06,visualScale:.99,canopyScale:1.03,trunkScale:.98,gardenGap:.12,effectBounds:1.18,motionIntensity:.68,particleDensity:3},
  bamboo:{width:.94,height:1.17,visualScale:1,canopyScale:.96,trunkScale:1.08,gardenGap:.07,effectBounds:1.05,motionIntensity:.8,particleDensity:2},
  banana:{width:1.16,height:1.08,visualScale:.99,canopyScale:1.02,trunkScale:.98,gardenGap:.12,effectBounds:1.14,motionIntensity:.72,particleDensity:2},
  palm:{width:1.26,height:1.16,visualScale:.98,canopyScale:1,trunkScale:1.08,gardenGap:.18,effectBounds:1.18,motionIntensity:.78,particleDensity:2},
  muffin:{width:.94,height:.9,visualScale:1,canopyScale:.96,trunkScale:.9,gardenGap:.06,effectBounds:1.05,motionIntensity:.42,particleDensity:2},
  cupcake:{width:.96,height:.92,visualScale:1,canopyScale:.98,trunkScale:.9,gardenGap:.07,effectBounds:1.06,motionIntensity:.42,particleDensity:2},
  cake:{width:1.08,height:1,visualScale:.99,canopyScale:1,trunkScale:.92,gardenGap:.1,effectBounds:1.08,motionIntensity:.36,particleDensity:2},
};
const TREE_COLLECTION_STANDARDS = {
  starter:{rarity:"Starter",highlightIntensity:.15,shadowOpacity:.13,tierStep:.03},
  classic:{rarity:"Classic",highlightIntensity:.17,shadowOpacity:.14,tierStep:.035},
  shapes:{rarity:"Distinct",highlightIntensity:.18,shadowOpacity:.15,tierStep:.045},
  tropical:{rarity:"Distinct",highlightIntensity:.18,shadowOpacity:.15,tierStep:.045},
  mystical:{rarity:"Mythical",highlightIntensity:.2,shadowOpacity:.16,tierStep:.06},
  premium:{rarity:"Flagship",highlightIntensity:.22,shadowOpacity:.17,tierStep:.08},
  treats:{rarity:"Playful",highlightIntensity:.2,shadowOpacity:.14,tierStep:.04},
};
const TREE_VISUAL_OVERRIDES = {
  default:{gardenGap:.1},
  cherry:{particleDensity:3,gardenGap:.12},
  pine:{canopyScale:.98,motionIntensity:.48},
  autumn:{particleDensity:3,gardenGap:.12},
  copperbeech:{particleDensity:2,gardenGap:.12},
  enchanted:{width:1.22,gardenGap:.18,effectBounds:1.25},
  moonlit:{width:1.18,gardenGap:.16,effectBounds:1.24},
  starlight:{width:1.31,gardenGap:.22,effectBounds:1.24},
  celestial:{width:1.23,gardenGap:.2,effectBounds:1.27},
  rainbow:{width:1.18,gardenGap:.16,effectBounds:1.22},
  lightning:{width:1.42,height:1.18,visualScale:.96,gardenGap:.25,effectBounds:1.28,motionIntensity:.4,tierStep:.1},
  moontree:{width:1.32,height:1.18,visualScale:.97,gardenGap:.22,effectBounds:1.28},
  dragontree:{width:1.36,height:1.16,visualScale:.97,gardenGap:.22,effectBounds:1.26},
  kingsoak:{width:1.34,height:1.14,visualScale:.97,gardenGap:.22,effectBounds:1.25},
  diamondtree:{width:1.38,height:1.2,visualScale:.96,gardenGap:.24,effectBounds:1.3,tierStep:.09,motionIntensity:.42},
  liontree:{width:1.55,height:1.28,visualScale:.94,gardenGap:.3,effectBounds:1.34,tierStep:.12,motionIntensity:.38},
  blossom:{particleDensity:3,gardenGap:.17},
  frostedpine:{gardenGap:.13,effectBounds:1.16,motionIntensity:.4},
  willow:{width:1.28,height:1.05,gardenGap:.22,tierStep:.05},
  wisteria:{width:1.3,height:1.08,gardenGap:.24,tierStep:.05,particleDensity:3},
  ginkgo:{particleDensity:3,gardenGap:.15},
  coconutpalm:{width:1.26,height:1.16,gardenGap:.2,tierStep:.04},
};
const getTreeVisualProfile=(skinOrId,tier=0)=>{
  const skin=typeof skinOrId==="string"
    ? TREE_SKINS.find(entry=>entry.id===skinOrId)||TREE_SKINS[0]
    : skinOrId||TREE_SKINS[0];
  const shape=TREE_SHAPE_STANDARDS[skin.shape]||TREE_SHAPE_STANDARDS.round;
  const collection=TREE_COLLECTION_STANDARDS[skin.collection]||TREE_COLLECTION_STANDARDS.classic;
  const override=TREE_VISUAL_OVERRIDES[skin.id]||{};
  const base={...shape,...collection,...override};
  const safeTier=Math.max(0,Math.min(3,Number(tier)||0));
  const step=safeTier*(base.tierStep||.035);
  return {
    ...base,
    width:(base.width||1)+step,
    height:(base.height||1)+step,
    scale:base.visualScale||1,
    tier:safeTier,
  };
};
const getSkinFootprint=(skinId,tier=0)=>getTreeVisualProfile(skinId,tier);

const ENHANCE_TIERS = [
  { tier:1, name:"Flourish", icon:"🌿", blurb:"A fuller, deeper canopy — richer colour, denser growth, new side branches." },
  { tier:2, name:"Living",   icon:"🍃", blurb:"The tree comes alive — the crown breathes in the breeze and softly sheds." },
  { tier:3, name:"Radiant",  icon:"✨", blurb:"Small visitors arrive, motes drift by, and it glows gently after dusk." },
];
// Cost scales with each skin's base price (25% / 50% / 100% per tier — so
// fully maxing a tree costs about as much as buying it once more), floored
// so the free Oak still has a meaningful path (100-coin base → 20/50/100).
const enhanceBase = skin => Math.max(skin.cost||0, 100);
const enhanceCost = (skin, tier) => {
  const mult = [0.25, 0.5, 1.0][tier-1] || 0;
  return Math.max(10, Math.round(enhanceBase(skin)*mult/10)*10);
};
// What falls / floats around an enhanced tree — derived from the skin so every
// species sheds something that belongs to it.
const enhanceParticle = (skin) => {
  if(!skin) return { kind:"leaf", color:"#7FB86A" };
  if(skin.id==="wisteria")                          return { kind:"petal",  color:"#9B7EDE" };
  if(skin.id==="enchanted")                         return { kind:"sparkle",color:"#8FE0A0" };
  if(skin.id==="rainbow")                           return { kind:"star",   color:"#FF6F91" };
  if(skin.id==="lightning")                         return { kind:"sparkle",color:"#7FA8FF" };
  if(skin.id==="moontree")                           return { kind:"star",   color:"#D9EEFF" };
  if(skin.id==="dragontree")                         return { kind:"sparkle",color:"#FF9A47" };
  if(skin.id==="kingsoak")                           return { kind:"star",   color:"#E7C455" };
  if(skin.id==="diamondtree")                        return { kind:"sparkle",color:"#EAFBFF" };
  if(skin.id==="liontree")                           return { kind:"star",   color:"#F2C94C" };
  if(skin.frosted)                                  return { kind:"sparkle",color:"#FFFFFF" };
  if(skin.shape==="blossom" || skin.id==="cherry")  return { kind:"petal",  color:"#F7B7CE" };
  if(skin.magic)                                    return { kind:"star",  color:"#FFD34D" };
  if(["muffin","cupcake","cake"].includes(skin.shape)) return { kind:"sparkle", color:"#FFFFFF" };
  if(skin.shape==="maple")                          return { kind:"leaf",  color: skin.canopy || "#E0533A" };
  if(skin.shape==="palm")                           return { kind:"leaf",  color: skin.canopy || "#4CAE72" };
  if(skin.shape==="banana")                         return { kind:"leaf",  color:"#F2C744" };
  if(skin.shape==="bamboo")                         return { kind:"leaf",  color: skin.canopy || "#7FAE52" };
  return { kind:"leaf", color: skin.canopy || "#7FB86A" };
};

// Where a Radiant-tier "visitor" rests, per silhouette. Returns a point ON the
// tree's actual surface (not the rough canopy centre), a facing direction, and
// the KIND of visitor that suits the shape — foliage trees get a perched bird,
// food skins get a drifting garnish instead (a bird on a cake reads wrong).
// px/py are expressed as multipliers of (canopyR, and offsets from a supplied
// canopy anchor) so both the large TreeSVG and the tiny garden trees can reuse
// the same intent at their own scale.
function perchFor(shape) {
  switch(shape) {
    // narrow spire — the bird sits at the very tip, facing out
    case "pine":     return { kind:"bird", ax:0.06,  ay:-1.05, face:1 };
    // drooping crown — perch tucked on the upper-left curve
    case "willow":   return { kind:"bird", ax:-0.52, ay:-0.55, face:-1 };
    // soft cloud — rest lightly on the right shoulder, lower so it sinks in
    case "blossom":  return { kind:"bird", ax:0.5,   ay:-0.5,  face:1 };
    // full rounded crowns — classic shoulder perch
    case "maple":
    case "round":    return { kind:"bird", ax:0.52,  ay:-0.62, face:1 };
    // leaning palm — the bird rides the base of the fronds, on the lean side
    case "palm":     return { kind:"bird", ax:0.4,   ay:-1.02, face:1 };
    // banana — tucked among the paddle leaves, away from the hanging bunch
    case "banana":   return { kind:"bird", ax:-0.45, ay:-0.85, face:-1 };
    // bamboo — perches on the tallest stalk's leaf tuft
    case "bamboo":   return { kind:"bird", ax:0.06,  ay:-1.12, face:1 };
    // treats — no bird; a garnish sparkle hovers just above the frosting
    case "muffin":
    case "cupcake":
    case "cake":     return { kind:"garnish", ax:0.0, ay:-0.9,  face:1 };
    default:         return { kind:"bird", ax:0.52,  ay:-0.62, face:1 };
  }
}

// Ten of the newer skins get a companion suited to THEM specifically rather
// than the generic songbird — a parrot for the palm, a panda for the bamboo,
// and so on. Everything not listed here keeps the shape-based bird/garnish
// from perchFor above. "ground" ones sit at the base of the trunk instead of
// up in the canopy (a fox doesn't belong on a branch).
const SKIN_COMPANIONS = {
  coconutpalm:  { kind:"parrot"    },
  bananatree:   { kind:"monkey"    },
  goldenbamboo: { kind:"panda",    ground:true },
  enchanted:    { kind:"frog",     ground:true },
  rainbow:      { kind:"butterfly" },
  lightning:    { kind:"owl"       },
  frostedpine:  { kind:"squirrel"  },
  copperbeech:  { kind:"fox",      ground:true },
  wisteria:     { kind:"bee"       },
  ginkgo:       { kind:"hedgehog", ground:true },
};

// Draws a Radiant-tier companion of the given kind, centred on (px,py),
// facing `f` (+1 right / -1 left), at scale B. Shared by every TreeSVG
// instance so the shop, focus screen and complete screen all agree on what
// each skin's visitor looks like. `bob*` picks the idle animation (perched
// creatures bob gently; ground ones barely move; fliers move more).
function renderCompanion(kind, px, py, f, B, opacity) {
  const bobTiny  = "0 0; 0 -0.5; 0 0";
  const bobSmall = "0 0; 0 -0.8; 0 0";
  const bobFly   = "0 0; 1.4 -2.4; 0 0; -1 -1.2; 0 0";
  switch(kind) {
    case "garnish": {
      const gc = "#FFD34D";
      return (
        <g>
          <animateTransform attributeName="transform" type="translate" values="0 0; 0 -2.2; 0 0" dur="4s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.5;1"/>
          {[0,90,180,270].map(a=>(
            <ellipse key={a} cx={px} cy={py} rx={2.4*B} ry={1.1*B} fill={gc} opacity={0.92} transform={`rotate(${a} ${px} ${py})`}/>
          ))}
          <circle cx={px} cy={py} r={1.3*B} fill="#FFF3C4"/>
          <circle cx={px} cy={py} r={3.6*B} fill={gc} opacity={0.18}>
            <animate attributeName="opacity" values="0.10;0.28;0.10" dur="3s" repeatCount="indefinite"/>
          </circle>
        </g>
      );
    }
    case "bird": return (
      <g opacity={opacity}>
        <animateTransform attributeName="transform" type="translate" values={bobSmall} dur="3.2s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.5;1"/>
        <ellipse cx={px} cy={py} rx={5*B} ry={3.4*B} fill="#4A4458"/>
        <ellipse cx={px - f*0.6*B} cy={py+0.4*B} rx={3.2*B} ry={2.2*B} fill="#5B5468"/>
        <circle cx={px + f*4.3*B} cy={py - 2.4*B} r={2.4*B} fill="#4A4458"/>
        <polygon points={`${px+f*6.4*B},${py-2.4*B} ${px+f*8.8*B},${py-1.9*B} ${px+f*6.4*B},${py-1.2*B}`} fill="#E8A24B"/>
        <circle cx={px + f*4.9*B} cy={py - 2.9*B} r={0.6*B} fill="#fff"/>
        <path d={`M${px - f*4.4*B} ${py} q${-f*4*B} ${1.3*B} ${-f*6*B} ${3*B}`} stroke="#4A4458" strokeWidth={2*B} fill="none" strokeLinecap="round"/>
        <path d={`M${px} ${py+3*B} l0 ${2.2*B} M${px+f*1.6*B} ${py+3*B} l0 ${2.2*B}`} stroke="#C98A3A" strokeWidth={0.9*B} strokeLinecap="round"/>
      </g>
    );
    case "parrot": return ( // Coconut Palm — bold tropical colour, long tail streamers
      <g opacity={opacity}>
        <animateTransform attributeName="transform" type="translate" values={bobSmall} dur="3s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.5;1"/>
        <path d={`M${px-f*3.6*B} ${py-0.4*B} q${-f*5*B} ${-1.4*B} ${-f*7.2*B} ${-3.2*B}`} stroke="#2D9A57" strokeWidth={2.2*B} fill="none" strokeLinecap="round"/>
        <path d={`M${px-f*3.6*B} ${py+0.6*B} q${-f*5*B} ${1.2*B} ${-f*7.2*B} ${3.2*B}`} stroke="#2E5FD8" strokeWidth={1.8*B} fill="none" strokeLinecap="round"/>
        <ellipse cx={px} cy={py} rx={4.4*B} ry={3.1*B} fill="#3FA65C"/>
        <ellipse cx={px-f*0.3*B} cy={py+1*B} rx={2.4*B} ry={1.7*B} fill="#F2C744"/>
        <circle cx={px+f*3.8*B} cy={py-2.5*B} r={2.2*B} fill="#2E5FD8"/>
        <path d={`M${px+f*5.6*B} ${py-2.5*B} q${f*2.2*B} 0.3 ${f*1.4*B} 1.8`} stroke="#2A2A2A" strokeWidth={1.5*B} fill="none" strokeLinecap="round"/>
        <circle cx={px+f*4.4*B} cy={py-3*B} r={0.5*B} fill="#fff"/>
        <path d={`M${px} ${py+2.9*B} l0 ${2*B} M${px+f*1.3*B} ${py+2.9*B} l0 ${2*B}`} stroke="#C98A3A" strokeWidth={0.85*B} strokeLinecap="round"/>
      </g>
    );
    case "monkey": return ( // Banana Tree — sitting among the leaves with a snack
      <g opacity={opacity}>
        <animateTransform attributeName="transform" type="translate" values={bobTiny} dur="3.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.5;1"/>
        <path d={`M${px-f*3*B} ${py+2*B} q${-f*4*B} 0 ${-f*4*B} ${-3*B} q0 ${-2.2*B} ${f*2*B} ${-1.8*B}`} stroke="#8A5A3C" strokeWidth={1.3*B} fill="none" strokeLinecap="round"/>
        <ellipse cx={px} cy={py+1*B} rx={3.3*B} ry={2.9*B} fill="#8A5A3C"/>
        <ellipse cx={px} cy={py+1.7*B} rx={1.9*B} ry={1.8*B} fill="#E8C99B"/>
        <circle cx={px-f*1.9*B} cy={py-3.4*B} r={1*B} fill="#8A5A3C"/>
        <circle cx={px+f*2.7*B} cy={py-3.4*B} r={1*B} fill="#8A5A3C"/>
        <circle cx={px+f*0.4*B} cy={py-2.5*B} r={2.5*B} fill="#8A5A3C"/>
        <ellipse cx={px+f*0.6*B} cy={py-2*B} rx={1.6*B} ry={1.4*B} fill="#E8C99B"/>
        <circle cx={px-f*0.1*B} cy={py-2.5*B} r={0.35*B} fill="#2A2A2A"/>
        <circle cx={px+f*1.5*B} cy={py-2.5*B} r={0.35*B} fill="#2A2A2A"/>
        <path d={`M${px+f*2.5*B} ${py+0.8*B} Q${px+f*4*B} ${py+1.3*B} ${px+f*3.4*B} ${py+2.6*B}`} stroke="#F2C744" strokeWidth={1.4*B} fill="none" strokeLinecap="round"/>
      </g>
    );
    case "panda": return ( // Golden Bamboo — sitting at the base, hugging a stalk
      <g opacity={opacity}>
        <animateTransform attributeName="transform" type="translate" values={bobTiny} dur="4s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.5;1"/>
        <ellipse cx={px} cy={py+1*B} rx={3.6*B} ry={3*B} fill="#fff" stroke="#00000012" strokeWidth={0.5*B}/>
        <circle cx={px-f*2.6*B} cy={py-3.4*B} r={1.3*B} fill="#2A2A2A"/>
        <circle cx={px+f*2.6*B} cy={py-3.4*B} r={1.3*B} fill="#2A2A2A"/>
        <circle cx={px+f*0.3*B} cy={py-1.6*B} r={2.6*B} fill="#fff"/>
        <ellipse cx={px-f*1.1*B} cy={py-1.6*B} rx={1*B} ry={1.3*B} fill="#2A2A2A"/>
        <ellipse cx={px+f*1.5*B} cy={py-1.6*B} rx={1*B} ry={1.3*B} fill="#2A2A2A"/>
        <circle cx={px-f*1*B} cy={py-1.5*B} r={0.32*B} fill="#fff"/>
        <circle cx={px+f*1.6*B} cy={py-1.5*B} r={0.32*B} fill="#fff"/>
        <ellipse cx={px+f*0.3*B} cy={py-0.3*B} rx={0.5*B} ry={0.35*B} fill="#2A2A2A"/>
        <path d={`M${px-f*3*B} ${py+1*B} q${-f*1.6*B} ${1.6*B} 0 ${3.2*B}`} stroke="#2A2A2A" strokeWidth={1.5*B} fill="none" strokeLinecap="round"/>
        <ellipse cx={px-f*1.6*B} cy={py+3.6*B} rx={1.3*B} ry={1*B} fill="#2A2A2A"/>
        <ellipse cx={px+f*1.8*B} cy={py+3.6*B} rx={1.3*B} ry={1*B} fill="#2A2A2A"/>
      </g>
    );
    case "frog": return ( // Enchanted Tree — sitting by the toadstool ring
      <g opacity={opacity}>
        <animateTransform attributeName="transform" type="translate" values={bobTiny} dur="3.4s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.5;1"/>
        <ellipse cx={px-f*3*B} cy={py+1.7*B} rx={1.3*B} ry={0.9*B} fill="#6FBF6A"/>
        <ellipse cx={px+f*3*B} cy={py+1.7*B} rx={1.3*B} ry={0.9*B} fill="#6FBF6A"/>
        <ellipse cx={px} cy={py+0.4*B} rx={3.6*B} ry={2.4*B} fill="#6FBF6A"/>
        <ellipse cx={px} cy={py+1.7*B} rx={2.8*B} ry={1.3*B} fill="#C8E8AE"/>
        <circle cx={px-f*1.6*B} cy={py-1.8*B} r={1.2*B} fill="#6FBF6A"/>
        <circle cx={px+f*0.6*B} cy={py-1.8*B} r={1.2*B} fill="#6FBF6A"/>
        <circle cx={px-f*1.6*B} cy={py-2*B} r={0.5*B} fill="#2A2A2A"/>
        <circle cx={px+f*0.6*B} cy={py-2*B} r={0.5*B} fill="#2A2A2A"/>
      </g>
    );
    case "butterfly": return ( // Rainbow Tree — flutters near the canopy
      <g opacity={opacity}>
        <animateTransform attributeName="transform" type="translate" values={bobFly} dur="2.4s" repeatCount="indefinite"/>
        <ellipse cx={px} cy={py} rx={0.7*B} ry={2.6*B} fill="#3A2A44"/>
        <ellipse cx={px-f*2.6*B} cy={py-1.6*B} rx={2.6*B} ry={2*B} fill="#FF7BA8">
          <animate attributeName="rx" values={`${2.6*B};${1.5*B};${2.6*B}`} dur="1s" repeatCount="indefinite"/>
        </ellipse>
        <ellipse cx={px+f*2.6*B} cy={py-1.6*B} rx={2.6*B} ry={2*B} fill="#7B9CFF">
          <animate attributeName="rx" values={`${2.6*B};${1.5*B};${2.6*B}`} dur="1s" repeatCount="indefinite"/>
        </ellipse>
        <ellipse cx={px-f*2.2*B} cy={py+1.3*B} rx={1.8*B} ry={1.4*B} fill="#FFD34D">
          <animate attributeName="rx" values={`${1.8*B};${1*B};${1.8*B}`} dur="1s" repeatCount="indefinite"/>
        </ellipse>
        <ellipse cx={px+f*2.2*B} cy={py+1.3*B} rx={1.8*B} ry={1.4*B} fill="#7BE0A0">
          <animate attributeName="rx" values={`${1.8*B};${1*B};${1.8*B}`} dur="1s" repeatCount="indefinite"/>
        </ellipse>
        <path d={`M${px} ${py-2.4*B} q-1 -1 -1.6 -1.6 M${px} ${py-2.4*B} q1 -1 1.6 -1.6`} stroke="#3A2A44" strokeWidth={0.5*B} fill="none"/>
      </g>
    );
    case "owl": return ( // Lightning Tree — a watchful, storm-toned owl
      <g opacity={opacity}>
        <animateTransform attributeName="transform" type="translate" values={bobTiny} dur="4.2s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.5;1"/>
        <ellipse cx={px-f*2.6*B} cy={py+1*B} rx={1.8*B} ry={2.6*B} fill="#4A3B5E"/>
        <ellipse cx={px+f*2.6*B} cy={py+1*B} rx={1.8*B} ry={2.6*B} fill="#4A3B5E"/>
        <ellipse cx={px} cy={py} rx={4.2*B} ry={4*B} fill="#5A4A6E"/>
        <path d={`M${px-2.2*B} ${py-3.6*B} l${-1*B} ${-2*B} l${1.8*B} ${0.6*B} Z`} fill="#5A4A6E"/>
        <path d={`M${px+2.2*B} ${py-3.6*B} l${1*B} ${-2*B} l${-1.8*B} ${0.6*B} Z`} fill="#5A4A6E"/>
        <circle cx={px} cy={py-0.8*B} r={2.6*B} fill="#7A6A94"/>
        <circle cx={px-1.1*B} cy={py-1*B} r={1.1*B} fill="#FFE9A8"/>
        <circle cx={px+1.1*B} cy={py-1*B} r={1.1*B} fill="#FFE9A8"/>
        <circle cx={px-1.1*B} cy={py-1*B} r={0.5*B} fill="#2A2A2A"/>
        <circle cx={px+1.1*B} cy={py-1*B} r={0.5*B} fill="#2A2A2A"/>
        <polygon points={`${px-0.5*B},${py-0.1*B} ${px+0.5*B},${py-0.1*B} ${px},${py+0.9*B}`} fill="#E8A24B"/>
        <path d={`M${px-1*B} ${py+3.8*B} l0 ${1.6*B} M${px+1*B} ${py+3.8*B} l0 ${1.6*B}`} stroke="#E8A24B" strokeWidth={0.9*B} strokeLinecap="round"/>
      </g>
    );
    case "squirrel": return ( // Frosted Pine — bushy tail, tucked on a branch tip
      <g opacity={opacity}>
        <animateTransform attributeName="transform" type="translate" values={bobSmall} dur="3.2s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.5;1"/>
        <path d={`M${px-f*2*B} ${py+1*B} q${-f*5*B} ${-1*B} ${-f*4*B} ${-6*B} q${f*0.5*B} ${-2.2*B} ${f*3*B} ${-1.6*B}`}
          stroke="#B5651D" strokeWidth={2.6*B} fill="none" strokeLinecap="round"/>
        <ellipse cx={px} cy={py+0.6*B} rx={3*B} ry={2.6*B} fill="#B5651D"/>
        <ellipse cx={px} cy={py+1.4*B} rx={1.8*B} ry={1.6*B} fill="#F0DDBB"/>
        <circle cx={px+f*3*B} cy={py-1.4*B} r={2*B} fill="#B5651D"/>
        <circle cx={px+f*3.8*B} cy={py-3*B} r={0.9*B} fill="#B5651D"/>
        <circle cx={px+f*3.7*B} cy={py-1.6*B} r={0.4*B} fill="#2A2A2A"/>
        <ellipse cx={px+f*1.4*B} cy={py+0.4*B} rx={1*B} ry={1.2*B} fill="#8A5A2A"/>
      </g>
    );
    case "fox": return ( // Copper Beech — curled up at the base, tail around its paws
      <g opacity={opacity}>
        <animateTransform attributeName="transform" type="translate" values={bobTiny} dur="4s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.5;1"/>
        <path d={`M${px-f*3*B} ${py+1.6*B} q${-f*5*B} ${0.6*B} ${-f*4*B} ${-3.6*B}`} stroke="#D4722A" strokeWidth={2.4*B} fill="none" strokeLinecap="round"/>
        <circle cx={px-f*7*B} cy={py-2*B} r={1.2*B} fill="#fff"/>
        <ellipse cx={px} cy={py} rx={3.6*B} ry={2.8*B} fill="#D4722A"/>
        <ellipse cx={px} cy={py+1.4*B} rx={2*B} ry={1.6*B} fill="#FBEFDD"/>
        <polygon points={`${px+f*1.8*B},${py-3.6*B} ${px+f*2.6*B},${py-5.6*B} ${px+f*3.4*B},${py-3.8*B}`} fill="#D4722A"/>
        <polygon points={`${px+f*3.4*B},${py-3.6*B} ${px+f*4.4*B},${py-5.4*B} ${px+f*4.8*B},${py-3.4*B}`} fill="#D4722A"/>
        <circle cx={px+f*3*B} cy={py-2.2*B} r={2*B} fill="#D4722A"/>
        <ellipse cx={px+f*4.6*B} cy={py-1.6*B} rx={1.1*B} ry={0.8*B} fill="#FBEFDD"/>
        <circle cx={px+f*5.3*B} cy={py-1.7*B} r={0.35*B} fill="#2A2A2A"/>
        <circle cx={px+f*3.3*B} cy={py-2.6*B} r={0.4*B} fill="#2A2A2A"/>
      </g>
    );
    case "bee": return ( // Wisteria — hovers near the drooping clusters
      <g opacity={opacity}>
        <animateTransform attributeName="transform" type="translate" values={bobFly} dur="2.6s" repeatCount="indefinite"/>
        <ellipse cx={px-f*0.6*B} cy={py-2*B} rx={1.6*B} ry={1.1*B} fill="#EAF2FF" opacity={0.85}/>
        <ellipse cx={px+f*1.6*B} cy={py-2*B} rx={1.6*B} ry={1.1*B} fill="#EAF2FF" opacity={0.85}/>
        <ellipse cx={px} cy={py} rx={2.6*B} ry={1.8*B} fill="#2A2A2A"/>
        <ellipse cx={px} cy={py} rx={1.9*B} ry={1.5*B} fill="#F2C744"/>
        <path d={`M${px-1.5*B} ${py-1*B} l0 ${2*B} M${px} ${py-1.3*B} l0 ${2.6*B} M${px+1.5*B} ${py-1*B} l0 ${2*B}`} stroke="#2A2A2A" strokeWidth={0.8*B}/>
        <polygon points={`${px-f*2.6*B},${py} ${px-f*3.6*B},${py-0.4*B} ${px-f*3.6*B},${py+0.4*B}`} fill="#2A2A2A"/>
      </g>
    );
    case "hedgehog": return ( // Golden Ginkgo — snuffling through the fallen leaves
      <g opacity={opacity}>
        <animateTransform attributeName="transform" type="translate" values={bobTiny} dur="3.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.5;1"/>
        {Array.from({length:9}).map((_,i)=>{
          const ang = (-160 + i*20)*Math.PI/180;
          const r1=3.2*B, r2=4.6*B;
          return <path key={i} d={`M${px+Math.cos(ang)*r1} ${py+0.6*B+Math.sin(ang)*r1*0.85} L${px+Math.cos(ang)*r2} ${py+0.6*B+Math.sin(ang)*r2*0.85}`} stroke="#6B5A4A" strokeWidth={0.8*B} strokeLinecap="round"/>;
        })}
        <ellipse cx={px} cy={py+0.6*B} rx={3.4*B} ry={2.6*B} fill="#8A7A6A"/>
        <ellipse cx={px+f*3.2*B} cy={py+1*B} rx={1.4*B} ry={1.1*B} fill="#D9C9B4"/>
        <circle cx={px+f*4*B} cy={py+1.1*B} r={0.35*B} fill="#2A2A2A"/>
        <circle cx={px+f*2.6*B} cy={py-0.2*B} r={0.4*B} fill="#2A2A2A"/>
      </g>
    );
    default: return null;
  }
}

// Garden-scale version of renderCompanion — same species, far fewer
// elements (many trees can be Radiant at once, so this stays cheap), sized
// off `cr` directly rather than a separate B multiplier.
function renderCompanionSmall(kind, ax, ay, f, cr, animated = true) {
  switch(kind) {
    case "garnish": {
      const gc = "#FFD34D";
      return (
        <g>
          {animated&&<animateTransform attributeName="transform" type="translate" values="0 0;0 -1;0 0" dur="4s" repeatCount="indefinite"/>}
          {[0,90,180,270].map(a=>(
            <ellipse key={a} cx={ax} cy={ay} rx={cr*0.16} ry={cr*0.08} fill={gc} opacity={0.9} transform={`rotate(${a} ${ax} ${ay})`}/>
          ))}
          <circle cx={ax} cy={ay} r={cr*0.07} fill="#FFF3C4"/>
        </g>
      );
    }
    case "bird": return (
      <g>
        {animated&&<animateTransform attributeName="transform" type="translate" values="0 0;0 -0.5;0 0" dur="3s" repeatCount="indefinite"/>}
        <ellipse cx={ax} cy={ay} rx={cr*0.24} ry={cr*0.16} fill="#4A4458"/>
        <circle cx={ax + f*cr*0.2} cy={ay - cr*0.14} r={cr*0.11} fill="#4A4458"/>
        <polygon points={`${ax+f*cr*0.3},${ay-cr*0.14} ${ax+f*cr*0.44},${ay-cr*0.11} ${ax+f*cr*0.3},${ay-cr*0.08}`} fill="#E8A24B"/>
        <path d={`M${ax-f*cr*0.22} ${ay} q${-f*cr*0.2} ${cr*0.08} ${-f*cr*0.34} ${cr*0.18}`} stroke="#4A4458" strokeWidth={cr*0.08} fill="none" strokeLinecap="round"/>
      </g>
    );
    case "parrot": return (
      <g>
        {animated&&<animateTransform attributeName="transform" type="translate" values="0 0;0 -0.5;0 0" dur="3s" repeatCount="indefinite"/>}
        <path d={`M${ax-f*cr*0.2} ${ay} q${-f*cr*0.3} ${-cr*0.1} ${-f*cr*0.4} ${-cr*0.3}`} stroke="#2D9A57" strokeWidth={cr*0.1} fill="none" strokeLinecap="round"/>
        <ellipse cx={ax} cy={ay} rx={cr*0.22} ry={cr*0.16} fill="#3FA65C"/>
        <circle cx={ax + f*cr*0.2} cy={ay - cr*0.14} r={cr*0.12} fill="#2E5FD8"/>
        <polygon points={`${ax+f*cr*0.3},${ay-cr*0.14} ${ax+f*cr*0.44},${ay-cr*0.1} ${ax+f*cr*0.3},${ay-cr*0.08}`} fill="#2A2A2A"/>
      </g>
    );
    case "monkey": return (
      <g>
        {animated&&<animateTransform attributeName="transform" type="translate" values="0 0;0 -0.3;0 0" dur="3.5s" repeatCount="indefinite"/>}
        <path d={`M${ax-f*cr*0.16} ${ay+cr*0.1} q${-f*cr*0.22} 0 ${-f*cr*0.2} ${-cr*0.18}`} stroke="#8A5A3C" strokeWidth={cr*0.07} fill="none" strokeLinecap="round"/>
        <ellipse cx={ax} cy={ay+cr*0.05} rx={cr*0.2} ry={cr*0.17} fill="#8A5A3C"/>
        <circle cx={ax+f*cr*0.02} cy={ay-cr*0.16} r={cr*0.14} fill="#8A5A3C"/>
        <ellipse cx={ax+f*cr*0.03} cy={ay-cr*0.13} rx={cr*0.09} ry={cr*0.08} fill="#E8C99B"/>
      </g>
    );
    case "panda": return (
      <g>
        {animated&&<animateTransform attributeName="transform" type="translate" values="0 0;0 -0.3;0 0" dur="4s" repeatCount="indefinite"/>}
        <ellipse cx={ax} cy={ay+cr*0.06} rx={cr*0.22} ry={cr*0.2} fill="#fff"/>
        <circle cx={ax-f*cr*0.15} cy={ay-cr*0.16} r={cr*0.07} fill="#2A2A2A"/>
        <circle cx={ax+f*cr*0.15} cy={ay-cr*0.16} r={cr*0.07} fill="#2A2A2A"/>
        <ellipse cx={ax-f*cr*0.06} cy={ay-cr*0.06} rx={cr*0.06} ry={cr*0.08} fill="#2A2A2A"/>
        <ellipse cx={ax+f*cr*0.09} cy={ay-cr*0.06} rx={cr*0.06} ry={cr*0.08} fill="#2A2A2A"/>
      </g>
    );
    case "frog": return (
      <g>
        {animated&&<animateTransform attributeName="transform" type="translate" values="0 0;0 -0.3;0 0" dur="3.4s" repeatCount="indefinite"/>}
        <ellipse cx={ax} cy={ay+cr*0.04} rx={cr*0.22} ry={cr*0.15} fill="#6FBF6A"/>
        <circle cx={ax-f*cr*0.1} cy={ay-cr*0.1} r={cr*0.08} fill="#6FBF6A"/>
        <circle cx={ax+f*cr*0.05} cy={ay-cr*0.1} r={cr*0.08} fill="#6FBF6A"/>
        <circle cx={ax-f*cr*0.1} cy={ay-cr*0.11} r={cr*0.03} fill="#2A2A2A"/>
        <circle cx={ax+f*cr*0.05} cy={ay-cr*0.11} r={cr*0.03} fill="#2A2A2A"/>
      </g>
    );
    case "butterfly": return (
      <g>
        {animated&&<animateTransform attributeName="transform" type="translate" values="0 0;1 -1.5;0 0;-1 -0.8;0 0" dur="2.4s" repeatCount="indefinite"/>}
        <ellipse cx={ax-f*cr*0.14} cy={ay} rx={cr*0.14} ry={cr*0.11} fill="#FF7BA8"/>
        <ellipse cx={ax+f*cr*0.14} cy={ay} rx={cr*0.14} ry={cr*0.11} fill="#7B9CFF"/>
        <ellipse cx={ax} cy={ay} rx={cr*0.04} ry={cr*0.14} fill="#3A2A44"/>
      </g>
    );
    case "owl": return (
      <g>
        {animated&&<animateTransform attributeName="transform" type="translate" values="0 0;0 -0.4;0 0" dur="4.2s" repeatCount="indefinite"/>}
        <ellipse cx={ax} cy={ay} rx={cr*0.22} ry={cr*0.22} fill="#5A4A6E"/>
        <circle cx={ax-cr*0.08} cy={ay-cr*0.04} r={cr*0.08} fill="#FFE9A8"/>
        <circle cx={ax+cr*0.08} cy={ay-cr*0.04} r={cr*0.08} fill="#FFE9A8"/>
        <circle cx={ax-cr*0.08} cy={ay-cr*0.04} r={cr*0.035} fill="#2A2A2A"/>
        <circle cx={ax+cr*0.08} cy={ay-cr*0.04} r={cr*0.035} fill="#2A2A2A"/>
      </g>
    );
    case "squirrel": return (
      <g>
        {animated&&<animateTransform attributeName="transform" type="translate" values="0 0;0 -0.5;0 0" dur="3.2s" repeatCount="indefinite"/>}
        <path d={`M${ax-f*cr*0.14} ${ay+cr*0.05} q${-f*cr*0.3} ${-cr*0.1} ${-f*cr*0.2} ${-cr*0.4}`} stroke="#B5651D" strokeWidth={cr*0.13} fill="none" strokeLinecap="round"/>
        <ellipse cx={ax} cy={ay+cr*0.03} rx={cr*0.18} ry={cr*0.16} fill="#B5651D"/>
        <circle cx={ax+f*cr*0.16} cy={ay-cr*0.1} r={cr*0.11} fill="#B5651D"/>
      </g>
    );
    case "fox": return (
      <g>
        {animated&&<animateTransform attributeName="transform" type="translate" values="0 0;0 -0.3;0 0" dur="4s" repeatCount="indefinite"/>}
        <path d={`M${ax-f*cr*0.16} ${ay+cr*0.08} q${-f*cr*0.28} ${cr*0.02} ${-f*cr*0.2} ${-cr*0.2}`} stroke="#D4722A" strokeWidth={cr*0.12} fill="none" strokeLinecap="round"/>
        <circle cx={ax-f*cr*0.36} cy={ay-cr*0.12} r={cr*0.06} fill="#fff"/>
        <ellipse cx={ax} cy={ay} rx={cr*0.2} ry={cr*0.16} fill="#D4722A"/>
        <polygon points={`${ax+f*cr*0.1},${ay-cr*0.18} ${ax+f*cr*0.14},${ay-cr*0.3} ${ax+f*cr*0.2},${ay-cr*0.18}`} fill="#D4722A"/>
        <circle cx={ax+f*cr*0.15} cy={ay-cr*0.1} r={cr*0.1} fill="#D4722A"/>
      </g>
    );
    case "bee": return (
      <g>
        {animated&&<animateTransform attributeName="transform" type="translate" values="0 0;0.8 -1.2;0 0;-0.8 -0.6;0 0" dur="2.6s" repeatCount="indefinite"/>}
        <ellipse cx={ax-cr*0.1} cy={ay-cr*0.1} rx={cr*0.09} ry={cr*0.06} fill="#EAF2FF" opacity={0.85}/>
        <ellipse cx={ax+cr*0.1} cy={ay-cr*0.1} rx={cr*0.09} ry={cr*0.06} fill="#EAF2FF" opacity={0.85}/>
        <ellipse cx={ax} cy={ay} rx={cr*0.14} ry={cr*0.1} fill="#F2C744"/>
      </g>
    );
    case "hedgehog": return (
      <g>
        {animated&&<animateTransform attributeName="transform" type="translate" values="0 0;0 -0.3;0 0" dur="3.6s" repeatCount="indefinite"/>}
        <ellipse cx={ax} cy={ay+cr*0.05} rx={cr*0.2} ry={cr*0.15} fill="#8A7A6A"/>
        {[-40,-15,10,35].map((deg,i)=>{
          const rad=deg*Math.PI/180;
          return <path key={i} d={`M${ax+Math.cos(rad)*cr*0.16} ${ay+cr*0.05+Math.sin(rad)*cr*0.14} l${Math.cos(rad)*cr*0.1} ${Math.sin(rad)*cr*0.09}`} stroke="#6B5A4A" strokeWidth={cr*0.05} strokeLinecap="round"/>;
        })}
        <circle cx={ax+f*cr*0.18} cy={ay+cr*0.02} r={cr*0.03} fill="#2A2A2A"/>
      </g>
    );
    default: return null;
  }
}

// Darken (negative) or lighten (positive) a hex colour by pct — powers the
// tier-1 "richer colour" accents without hand-picking a palette per skin.
function shade(hex, pct) {
  try {
    const n = parseInt(hex.slice(1), 16);
    const f = c => Math.max(0, Math.min(255, Math.round(c + (pct<0 ? c*pct : (255-c)*pct))));
    const r = f((n>>16)&255), g = f((n>>8)&255), b = f(n&255);
    return `#${((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1)}`;
  } catch { return hex; }
}
const DAY_LABELS    = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTH_LABELS  = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ── Garden decorations ────────────────────────────────────────────────────────
// Bought with coins, scattered into the isometric garden on tiles trees don't
// use. Each one is a small self-contained SVG drawn at an iso (x,y) anchor.
// "kind" decides which drawing routine ForestGarden uses. Owned ids are synced
// per-account via prefs/{username}.decorations.
const DECORATIONS = [
  { id:"bench",   name:"Shared Study Bench", cost:250, kind:"bench", emoji:"🪑", desc:"A warm timber seat for classmates" },
  { id:"pond",    name:"Classroom Aquarium", cost:400, kind:"pond", emoji:"🐟", desc:"A calm blue aquarium with gentle movement" },
  { id:"path",    name:"Floor Guide Tiles", cost:300, kind:"path", emoji:"◆", desc:"A neat path through the learning space" },
  { id:"fence",   name:"Bookcase Divider", cost:350, kind:"fence", emoji:"📚", desc:"A low shelf that organises the room" },
  { id:"lamp",    name:"Reading Floor Lamp", cost:450, kind:"lamp", emoji:"💡", desc:"Warm focused light for a study corner" },
  { id:"flowers", name:"Desk Planter", cost:200, kind:"flowers", emoji:"🪴", desc:"A small living accent for the classroom" },
  { id:"mushroom",name:"Pencil Cup Set", cost:220, kind:"mushroom",emoji:"✏️", desc:"Colourful stationery ready for class" },
  { id:"lantern", name:"Study Lantern", cost:500, kind:"lantern", emoji:"🏮", desc:"A soft lantern for the quiet reading area" },
  { id:"festivaldrum", name:"Music Room Drum", cost:520, kind:"festivaldrum", emoji:"🥁", desc:"A ceremonial instrument for the arts corner" },
  { id:"cloudstone", name:"Cloud Sculpture", cost:420, kind:"cloudstone", emoji:"☁️", desc:"A carved centrepiece for the room" },
  { id:"runestone", name:"Science Energy Display", cost:540, kind:"runestone", emoji:"⚡", desc:"A luminous experiment display" },
];

// ── Achievements / badges ─────────────────────────────────────────────────────
// Each badge has a check(ctx) that returns true when earned. ctx is built once
// from the user's full history + current stats. tier sets the coin reward.
const BADGE_REWARDS = { easy:25, mid:50, hard:100 };
const BADGES = [
  { id:"first_tree",   name:"First Growth",      emoji:"🌱", tier:"easy", desc:"Complete your first learner growth session",
    check:c=>c.totalSessions>=1 },
  { id:"first_5h_day", name:"Deep Work",         emoji:"🔥", tier:"mid",  desc:"Focus 5h in a single day",
    check:c=>c.maxDaySecs>=5*3600 },
  { id:"streak_7",     name:"Week Warrior",      emoji:"📅", tier:"mid",  desc:"Hit a 7-day streak",
    check:c=>c.streak>=7 },
  { id:"streak_30",    name:"Unstoppable",       emoji:"🏆", tier:"hard", desc:"Hit a 30-day streak",
    check:c=>c.streak>=30 },
  { id:"all_subjects", name:"Well Rounded",      emoji:"🎯", tier:"mid",  desc:"Study every subject in one week",
    check:c=>c.allSubjectsThisWeek },
  { id:"trees_100",    name:"Study Century",     emoji:"💯", tier:"hard", desc:"Complete 100 focused growth sessions",
    check:c=>c.totalSessions>=100 },
  { id:"first_decor",  name:"Decorator",         emoji:"🪑", tier:"easy", desc:"Buy your first decoration",
    check:c=>c.decorCount>=1 },
  { id:"night_owl",    name:"Night Owl",         emoji:"🦉", tier:"easy", desc:"Finish a session after midnight",
    check:c=>c.hasNightOwl },
  { id:"early_bird",   name:"Early Bird",        emoji:"🌅", tier:"easy", desc:"Finish a session before 6am",
    check:c=>c.hasEarlyBird },
];

// Build the context object the badge checks run against.
function buildBadgeCtx({ history, streak, decorCount, subjects }) {
  const hist = Array.isArray(history) ? history : [];
  const totalSessions = hist.length;
  // Per-day totals
  const dayTotals = {};
  let hasNightOwl = false, hasEarlyBird = false;
  hist.forEach(s=>{
    const sessionDay = new Date(s.ts);
    const key = startOfDay(sessionDay).getTime();
    dayTotals[key] = (dayTotals[key]||0) + s.secs;
    const hr = new Date(s.endTs||s.ts).getHours();
    if(hr>=0 && hr<5) hasNightOwl = true;     // finished in the small hours
    if(hr>=4 && hr<6) hasEarlyBird = true;    // finished pre-6am
  });
  const maxDaySecs = Object.values(dayTotals).reduce((a,b)=>Math.max(a,b),0);
  // All subjects studied this week?
  const ws = startOfWeek(new Date());
  const weekSubj = new Set(hist.filter(s=>new Date(s.ts)>=ws).map(s=>s.subject));
  const allSubjectsThisWeek = subjects.length>0 && subjects.every(s=>weekSubj.has(s.id));
  return { totalSessions, maxDaySecs, streak, allSubjectsThisWeek, decorCount, hasNightOwl, hasEarlyBird };
}

// ── Smart insights engine ─────────────────────────────────────────────────────
// Pure analysis over the full session history. Returns an ordered list of
// insight cards. Each insight is ONLY produced when it has real supporting data
// — so old sessions that predate the richer logging simply yield fewer cards,
// never fabricated ones. Tone is warm + encouraging (Duolingo-style).
function buildInsights({ history, subjects, targets, streak, coins }) {
  const hist = Array.isArray(history) ? history : [];
  const out = [];
  if(hist.length === 0) return out;

  const now = new Date();
  const subjName = id => (subjects.find(s=>s.id===id)||{label:"a subject",emoji:"📘"});
  const H = 3600;

  // Bucket helpers
  const ws = startOfWeek(now);
  const lastWs = getPreviousStudyWeekStart(now);
  const thisWeek = hist.filter(s=>new Date(s.ts)>=ws);
  const lastWeek = hist.filter(s=>{ const t=new Date(s.ts); return t>=lastWs && t<ws; });
  const sum = arr => arr.reduce((a,s)=>a+s.secs,0);

  // 1) Week-over-week focus change
  if(lastWeek.length>=2 && thisWeek.length>=2){
    const tw=sum(thisWeek), lw=sum(lastWeek);
    if(lw>0){
      const pct=Math.round(((tw-lw)/lw)*100);
      if(Math.abs(pct)>=8){
        out.push(pct>0
          ? { icon:"📈", tone:"good", title:`You focused ${pct}% longer than last week`, body:`That's ${fmtHrs(tw)} so far this week. Keep the momentum going!` }
          : { icon:"🌧️", tone:"soft", title:`A lighter week — down ${Math.abs(pct)}%`, body:`No worries, every week is different. A short session today gets you back on track.` });
      }
    }
  }

  // 2) Most productive day of week (needs spread across days)
  const dowTotals=[0,0,0,0,0,0,0], dowCount=[0,0,0,0,0,0,0];
  hist.forEach(s=>{ const d=getStudyDayOfWeek(s.ts); dowTotals[d]+=s.secs; dowCount[d]++; });
  const activeDows=dowTotals.filter(v=>v>0).length;
  if(activeDows>=3){
    const bestDow=dowTotals.indexOf(Math.max(...dowTotals));
    const FULL=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    out.push({ icon:"🗓️", tone:"good", title:`${FULL[bestDow]} is your power day`, body:`You consistently get the most focus done on ${FULL[bestDow]}s — ${fmtHrs(dowTotals[bestDow])} all-time.` });
  }

  // 3) Best time-of-day window (needs startTs logging on ≥5 sessions)
  const withStart=hist.filter(s=>s.startTs);
  if(withStart.length>=5){
    const blocks={}; // 0:morning 1:midday 2:afternoon 3:evening 4:night
    const label=["the early morning","the late morning","the afternoon","the evening","late at night"];
    const range=["5–9am","9am–12pm","12–5pm","5–9pm","9pm–5am"];
    withStart.forEach(s=>{
      const h=new Date(s.startTs).getHours();
      const b = h>=5&&h<9?0 : h>=9&&h<12?1 : h>=12&&h<17?2 : h>=17&&h<21?3 : 4;
      blocks[b]=(blocks[b]||0)+s.secs;
    });
    const bestB=Object.entries(blocks).sort((a,b)=>b[1]-a[1])[0];
    if(bestB){
      const bi=Number(bestB[0]);
      out.push({ icon:"🌙", tone:"good", title:`You focus best in ${label[bi]}`, body:`Your deepest sessions happen around ${range[bi]}. Try protecting that window for your hardest subjects.` });
    }
  }

  // 4) Fastest/most-focused subject by avg session length (needs ≥2 subjects w/ ≥3 sessions)
  const subjStats={};
  hist.forEach(s=>{ (subjStats[s.subject]=subjStats[s.subject]||{secs:0,n:0}).secs+=s.secs; subjStats[s.subject].n++; });
  const eligible=Object.entries(subjStats).filter(([,v])=>v.n>=3);
  if(eligible.length>=2){
    const byAvg=eligible.map(([id,v])=>({id,avg:v.secs/v.n})).sort((a,b)=>b.avg-a.avg);
    const top=byAvg[0]; const sn=subjName(top.id);
    out.push({ icon:sn.emoji||"⚡", tone:"good", title:`You go deepest on ${sn.label}`, body:`Your ${sn.label} sessions average ${fmtMins(Math.round(top.avg))} — your longest focus stretches.` });
  }

  // 5) Focus drop-off / break suggestion (needs pause logging on ≥5 sessions)
  const withPauses=hist.filter(s=>typeof s.pauses==="number" && s.secs>=300);
  if(withPauses.length>=5){
    // Average session length where the FIRST pause tends to happen ≈ secs/(pauses+1)
    const spans=withPauses.filter(s=>s.pauses>0).map(s=>s.secs/(s.pauses+1));
    if(spans.length>=3){
      const avgSpan=spans.reduce((a,b)=>a+b,0)/spans.length;
      const mins=Math.round(avgSpan/60);
      if(mins>=15 && mins<=90){
        out.push({ icon:"⏳", tone:"soft", title:`You tend to lose focus after ~${mins} min`, body:`That's totally normal. A 5-minute break around the ${mins}-minute mark could keep you sharper for longer.` });
      }
    }
  }

  // 6) Goal completion (needs weekly targets set)
  const hasTargets = targets && Object.values(targets).some(v=>v>0);
  if(hasTargets){
    let goalSecs=0, doneSecs=0;
    subjects.forEach(s=>{ if(targets[s.id]>0){ goalSecs+=targets[s.id]*H; doneSecs+=sum(thisWeek.filter(x=>x.subject===s.id)); } });
    if(goalSecs>0){
      const pct=Math.min(999,Math.round((doneSecs/goalSecs)*100));
      out.push(pct>=100
        ? { icon:"🏆", tone:"good", title:`You smashed your weekly goal — ${pct}%!`, body:`Incredible. You've hit ${fmtHrs(doneSecs)} against your ${fmtHrs(goalSecs)} target.` }
        : { icon:"🎯", tone:"good", title:`You're ${pct}% to your weekly goal`, body:`${fmtHrs(doneSecs)} of ${fmtHrs(goalSecs)} done. ${pct>=70?"So close — you've got this!":"Every session counts."}` });
    }
  }

  // 7) Streak encouragement
  if(streak>=3){
    out.push({ icon:"🔥", tone:"good", title:`${streak}-day streak — you're on fire`, body:`Showing up daily is the whole game. Don't break the chain!` });
  }

  // 8) Improving-every-week trend (needs ≥3 weeks of data)
  const weekBuckets={};
  hist.forEach(s=>{ const d=new Date(s.ts); const k=startOfWeek(d).getTime(); weekBuckets[k]=(weekBuckets[k]||0)+s.secs; });
  const weekVals=Object.entries(weekBuckets).sort((a,b)=>a[0]-b[0]).map(e=>e[1]);
  if(weekVals.length>=3){
    const last3=weekVals.slice(-3);
    if(last3[0]<last3[1] && last3[1]<last3[2]){
      out.push({ icon:"🚀", tone:"good", title:`You're improving every week`, body:`Three weeks of growth in a row. This is exactly how lasting study habits are built.` });
    }
  }

  return out;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
// Keep the long-standing helper names inside App.jsx, but route all of them to
// the single Melbourne Sunday-midnight contract in studyWeek.js.
const getWeekKeyFor = getStudyWeekKey;
const getWeekKey = () => getStudyWeekKey();
const getPreviousCompletedWeek = getPreviousStudyWeekStart;
const getPreviousWeekKey = getPreviousStudyWeekKey;
const pad = n => String(n).padStart(2,"0");
const fmt = s => {
  const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=s%60;
  return h>0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
};
const fmtMins = s => {
  const h=Math.floor(s/3600), m=Math.floor((s%3600)/60);
  return h>0 ? `${h}h ${m}m` : `${m}m`;
};
const fmtHrs = s => {
  const h = s/3600;
  return h >= 1 ? `${h.toFixed(1)}h` : `${Math.floor(s/60)}m`;
};
// Format a remaining duration (given in hours) as "Xh Ym" / "Xh" / "Ym".
const fmtRemaining = hours => {
  const mins = Math.max(0, Math.round(hours*60));
  const h = Math.floor(mins/60), m = mins%60;
  return h>0 && m>0 ? `${h}h ${m}m` : h>0 ? `${h}h` : `${m}m`;
};
const lsGet  = (k,fb) => { try{const v=localStorage.getItem(k);return v?JSON.parse(v):fb;}catch{return fb;} };
const lsSet  = (k,v)  => { try{localStorage.setItem(k,JSON.stringify(v));}catch{} };
const lsRaw  = (k,fb) => { try{return localStorage.getItem(k)||fb;}catch{return fb;} };
const lsSetR = (k,v)  => { try{localStorage.setItem(k,v);}catch{} };
const lsRemove = k    => { try{localStorage.removeItem(k);}catch{} };

// Carry forward only Lumora cache entries whose shapes match StudyGrove's.
// Firestore remains authoritative; incompatible avatar/class/session state is
// intentionally left under its old keys instead of being guessed or erased.
const migrateLumoraCache = () => {
  const compatibleKeys={
    ascendU_username:LS_USER,
    ascendu_username:LS_USER,
    ascendu_subject:LS_SUBJECT,
    ascendu_subjects:LS_SUBJECTS,
    ascendu_mode:LS_MODE,
    ascendu_coins:LS_COINS,
    ascendu_theme:LS_THEME,
    ascendu_targets:LS_TARGETS,
    ascendu_badges:LS_BADGES,
  };
  try{
    Object.entries(compatibleKeys).forEach(([oldKey,newKey])=>{
      if(localStorage.getItem(newKey)==null && localStorage.getItem(oldKey)!=null){
        localStorage.setItem(newKey,localStorage.getItem(oldKey));
      }
    });
    localStorage.removeItem(LS_PASSWORD);
    localStorage.removeItem("ascendu_password");
  }catch{}
};
migrateLumoraCache();

const startOfDay   = d => { const x=new Date(d); x.setHours(0,0,0,0); return x; };
const startOfWeek  = startOfStudyWeek;

const getWeeklyRewardPlan = date => {
  const mode = getWeeklyRewardMode(date);
  if(mode==="classroom") return [
    { place:"1st", medal:"🥇", type:"background", coins:0 },
    { place:"2nd", medal:"🥈", type:"decoration", coins:0 },
    { place:"3rd", medal:"🥉", type:"coins", coins:WEEKLY_PODIUM_REWARDS[2] },
  ];
  const skinWeek = mode==="skin";
  return [
    { place:"1st", medal:"🥇", type:skinWeek?"skin":"coins", coins:skinWeek?0:WEEKLY_PODIUM_REWARDS[0] },
    { place:"2nd", medal:"🥈", type:"coins", coins:WEEKLY_PODIUM_REWARDS[1] },
    { place:"3rd", medal:"🥉", type:"coins", coins:WEEKLY_PODIUM_REWARDS[2] },
  ];
};
const pickWeeklySkin = (weekKey,username,ownedSkins=[]) => {
  return pickDeterministicUnowned({
    weekKey,username,prizeType:"skin",items:TREE_SKINS,ownedIds:ownedSkins,
    eligible:item=>item.cost>0,
  });
};
const pickWeeklyBackground = (weekKey,username,ownedBackgrounds=[]) =>
  pickDeterministicUnowned({
    weekKey,username,prizeType:"background",items:BACKGROUND_CATALOGUE,ownedIds:ownedBackgrounds,
    eligible:item=>item.cost>0,
  });
const pickWeeklyDecoration = (weekKey,username,ownedDecorations=[]) =>
  pickDeterministicUnowned({
    weekKey,username,prizeType:"decoration",items:DECORATIONS,ownedIds:ownedDecorations,
    eligible:item=>item.cost>0,
  });

// Shared time-of-day palette — drives the garden ambiance so
// the world stays in sync (study at dusk → golden garden AND golden window).
function getTimeOfDay(date) {
  const hour = (date || new Date()).getHours();
  if(hour < 6)  return { name:"night", sky1:"#1d2b4a", sky2:"#33406b", sun:"#9fb4e8", sunGlow:0.20, amb:"#1c2c52", ambA:0.45, star:true };
  if(hour < 9)  return { name:"dawn",  sky1:"#ffd9a8", sky2:"#ffeccd", sun:"#ffd27a", sunGlow:0.42, amb:"#ffcaa0", ambA:0.20, star:false };
  if(hour < 17) return { name:"day",   sky1:"#bfe8ff", sky2:"#e8f8ec", sun:"#fff4c2", sunGlow:0.55, amb:"#ffffff", ambA:0.0,  star:false };
  if(hour < 20) return { name:"dusk",  sky1:"#ffb27a", sky2:"#ffe0c0", sun:"#ff9d5c", sunGlow:0.50, amb:"#ff9e5e", ambA:0.22, star:false };
  return { name:"night", sky1:"#1d2b4a", sky2:"#33406b", sun:"#9fb4e8", sunGlow:0.20, amb:"#1c2c52", ambA:0.45, star:true };
}

const startOfMonth = d => new Date(d.getFullYear(), d.getMonth(), 1);
const startOfYear  = d => new Date(d.getFullYear(), 0, 1);

// ── Firebase helpers ──────────────────────────────────────────────────────────

async function fbSaveSession(usernameRaw, subjId, secs, skin, meta, coinDelta=0) {
  const username = canonUsername(usernameRaw);
  const m=meta||{};
  const endTs=Number.isFinite(Number(m.endTs))&&Number(m.endTs)>0
    ? Number(m.endTs)
    : Date.now();
  // Attribute the session to the calendar day/week on which it began. Using
  // Date.now() here made a session started before midnight appear to vanish
  // from that day's history (and, on Sunday night, from that week's board)
  // when it was completed after midnight. The full duration still remains one
  // session and one tree; endTs preserves the real completion time.
  const requestedStart=Number(m.startTs);
  const sessionTs=Number.isFinite(requestedStart)&&requestedStart>0&&requestedStart<=endTs
    ? requestedStart
    : Math.max(0,endTs-Math.max(0,Number(secs)||0)*1000);
  const weekKey = getWeekKeyFor(sessionTs);
  const wRef=doc(db,"leaderboard_weekly",weekKey);
  const aRef=doc(db,"leaderboard_alltime","data");
  const hRef=doc(db,"history",username);
  const prefsRef=doc(db,"prefs",username);
  const entry={
    subject:subjId,secs,ts:sessionTs,endTs,
    ...(m.sessionId?{sessionId:m.sessionId}:{}),
    ...(skin&&skin!=="default"?{skin}:{}),
    startTs:sessionTs,
    ...(typeof m.pauses==="number"?{pauses:m.pauses}:{}),
    ...(typeof m.goalSecs==="number"&&m.goalSecs>0?{goalSecs:m.goalSecs}:{}),
    ...(m.mode?{mode:m.mode}:{}),
    ...(m.timerMode?{timerMode:m.timerMode}:{}),
    ...(Number.isFinite(Number(m.completedRounds))?{completedRounds:Math.max(0,Math.trunc(Number(m.completedRounds)))}:{}),
    ...(Number.isFinite(Number(m.plannedRounds))?{plannedRounds:Math.max(1,Math.trunc(Number(m.plannedRounds)))}:{}),
    ...(Number.isFinite(Number(m.focusLengthMinutes))?{focusLengthMinutes:Math.max(1,Math.trunc(Number(m.focusLengthMinutes)))}:{}),
    ...(Number.isFinite(Number(m.breakLengthMinutes))?{breakLengthMinutes:Math.max(1,Math.trunc(Number(m.breakLengthMinutes)))}:{}),
    ...(m.taskId?{taskId:String(m.taskId).slice(0,80)}:{}),
    ...(m.taskTitle?{taskTitle:cleanTaskTitle(m.taskTitle)}:{}),
  };
  const bumpBoard=data=>{
    const board=data&&typeof data==="object"?data:{};
    const current=board[username]||{};
    const subjects={...(current.subjects||{})};
    subjects[subjId]=(subjects[subjId]||0)+secs;
    return {...board,[username]:{
      totalSecs:(current.totalSecs||0)+secs,
      sessions:(current.sessions||0)+1,
      subjects,
    }};
  };
  try {
    return await runTransaction(db,async tx=>{
      const [wSnap,aSnap,hSnap,prefsSnap]=await Promise.all([
        tx.get(wRef),tx.get(aRef),tx.get(hRef),tx.get(prefsRef),
      ]);
      const history=hSnap.exists()?(hSnap.data().sessions||[]):[];
      const prefs=prefsSnap.exists()?prefsSnap.data():{};
      const currentCoins=typeof prefs.coins==="number"?prefs.coins:0;
      const change=Math.max(0,Math.trunc(Number(coinDelta)||0));
      const coinBalance=currentCoins+change;

      // A completed/recovered snapshot can survive a crash after Firestore
      // commits but before localStorage is cleared. Its stable session id makes
      // that retry a no-op instead of planting and paying the same session twice.
      if(m.sessionId&&history.some(s=>s.sessionId===m.sessionId)){
        return {ok:true,alreadySaved:true,coinBalance:currentCoins,weekKey,entry:history.find(s=>s.sessionId===m.sessionId)};
      }

      // One commit keeps history (source of truth), both derived boards and
      // the wallet in lockstep. A transaction retry reuses the same entry ts.
      tx.set(wRef,bumpBoard(wSnap.exists()?wSnap.data():{}));
      tx.set(aRef,bumpBoard(aSnap.exists()?aSnap.data():{}));
      tx.set(hRef,{sessions:[...history,entry].slice(-2000)});
      if(change>0)tx.set(prefsRef,{coins:coinBalance},{merge:true});
      return {ok:true,coinBalance,weekKey,entry};
    });
  } catch(e) { console.error("Firebase save error:", e); return {ok:false,error:e.message}; }
}

async function fbLoadLeaderboard() {
  const weekKey = getWeekKey(); // always resolved from the current Melbourne week
  try {
    const [wSnap, aSnap] = await Promise.all([
      getDoc(doc(db, "leaderboard_weekly", weekKey)),
      getDoc(doc(db, "leaderboard_alltime", "data")),
    ]);
    // The aggregate documents are already downloaded in full. Keep every row
    // in memory so a friend who is outside the former public top 20 can still
    // appear in the private friends leaderboard.
    const toArr = snap => snap.exists() ? normalizeBoardEntries(snap.data()) : [];
    return { weekly: toArr(wSnap), allTime: toArr(aSnap) };
  } catch(e) { console.error("Firebase LB error:", e); return { weekly: [], allTime: [] }; }
}

// ── Accepted friendships ─────────────────────────────────────────────────────
// Friend connections are keyed by the two Firebase UIDs, not usernames, so a
// later display-name change cannot create duplicate relationships. Username
// snapshots are retained for the current UI and existing username-keyed data.
async function fbSendFriendRequest(currentUsernameRaw,targetUsernameRaw){
  const currentUsername=canonUsername(currentUsernameRaw);
  const targetUsername=normalizeFriendUsername(targetUsernameRaw);
  const currentUid=auth.currentUser?.uid;
  if(!currentUid)return {ok:false,error:"Sign in again before adding a friend."};
  if(!targetUsername)return {ok:false,error:"Enter a username."};
  if(targetUsername===currentUsername)return {ok:false,error:"You can't add yourself."};
  try{
    const targetSnap=await getDoc(doc(db,"usernames",targetUsername));
    const targetUid=targetSnap.exists()?String(targetSnap.data()?.uid||""):"";
    if(!targetUid)return {ok:false,error:"No Lumora account uses that username."};
    const connectionId=friendConnectionId(currentUid,targetUid);
    if(!connectionId)return {ok:false,error:"That account can't be added right now."};
    await runTransaction(db,async tx=>{
      const ref=doc(db,"friend_connections",connectionId),snap=await tx.get(ref);
      if(snap.exists()){
        const status=snap.data()?.status;
        if(status==="accepted")throw new Error("You're already friends.");
        if(status==="pending")throw new Error("A friend request is already pending.");
      }
      const now=Date.now();
      tx.set(ref,{requesterUid:currentUid,requesterUsername:currentUsername,
        recipientUid:targetUid,recipientUsername:targetUsername,
        userUids:[currentUid,targetUid],status:"pending",createdAt:now,updatedAt:now});
    });
    return {ok:true};
  }catch(e){return {ok:false,error:e.message||"Couldn't send that friend request."};}
}

async function fbRespondFriendRequest(currentUsernameRaw,connectionId,accept){
  const currentUsername=canonUsername(currentUsernameRaw),currentUid=auth.currentUser?.uid;
  if(!currentUid)return {ok:false,error:"Sign in again to respond."};
  try{
    await runTransaction(db,async tx=>{
      const ref=doc(db,"friend_connections",connectionId),snap=await tx.get(ref);
      if(!snap.exists())throw new Error("That request is no longer available.");
      const connection=snap.data();
      if(connection.status!=="pending"||connection.recipientUid!==currentUid)throw new Error("That request can't be changed.");
      if(!accept){tx.delete(ref);return;}
      const now=Date.now();
      tx.update(ref,{status:"accepted",acceptedAt:now,updatedAt:now});
      tx.set(doc(db,"friend_access",currentUsername,"viewers",connection.requesterUid),{
        connectionId,ownerUsername:currentUsername,viewerUid:connection.requesterUid,
        viewerUsername:connection.requesterUsername,createdAt:now,
      });
      tx.set(doc(db,"friend_access",connection.requesterUsername,"viewers",currentUid),{
        connectionId,ownerUsername:connection.requesterUsername,viewerUid:currentUid,
        viewerUsername:currentUsername,createdAt:now,
      });
    });
    return {ok:true};
  }catch(e){return {ok:false,error:e.message||"Couldn't update that request."};}
}

async function fbCancelFriendRequest(connectionId){
  const currentUid=auth.currentUser?.uid;
  if(!currentUid)return {ok:false,error:"Sign in again to cancel this request."};
  try{
    await runTransaction(db,async tx=>{
      const ref=doc(db,"friend_connections",connectionId),snap=await tx.get(ref);
      if(!snap.exists())return;
      const connection=snap.data();
      if(connection.status!=="pending"||connection.requesterUid!==currentUid)throw new Error("That request can't be cancelled.");
      tx.delete(ref);
    });
    return {ok:true};
  }catch(e){return {ok:false,error:e.message||"Couldn't cancel that request."};}
}

async function fbRemoveFriend(currentUsernameRaw,friend){
  const currentUsername=canonUsername(currentUsernameRaw),currentUid=auth.currentUser?.uid;
  if(!currentUid||!friend?.id)return {ok:false,error:"That friendship couldn't be found."};
  try{
    await runTransaction(db,async tx=>{
      const ref=doc(db,"friend_connections",friend.id),snap=await tx.get(ref);
      if(!snap.exists())return;
      const connection=snap.data();
      if(connection.status!=="accepted"||!(connection.userUids||[]).includes(currentUid))throw new Error("That friendship can't be removed.");
      const otherUsername=connection.requesterUid===currentUid?connection.recipientUsername:connection.requesterUsername;
      const otherUid=connection.requesterUid===currentUid?connection.recipientUid:connection.requesterUid;
      tx.delete(ref);
      tx.delete(doc(db,"friend_access",currentUsername,"viewers",otherUid));
      tx.delete(doc(db,"friend_access",otherUsername,"viewers",currentUid));
    });
    return {ok:true};
  }catch(e){return {ok:false,error:e.message||"Couldn't remove that friend."};}
}

// Load a leaderboard for a specific (past) week key
async function fbLoadWeekBoard(wk) {
  try {
    const snap = await getDoc(doc(db, "leaderboard_weekly", wk));
    if (!snap.exists()) return [];
    // Keep the full aggregate so private friends outside the public top 20
    // remain visible when browsing historical weeks.
    return normalizeBoardEntries(snap.data());
  } catch(e) { console.error("Firebase week board error:", e); return []; }
}

// ── Invite-only group leaderboards ──────────────────────────────────────────
// Groups reuse the verified aggregate session totals. A group becomes reward
// eligible only after five distinct members participate during the week.
const GROUP_MAX_MEMBERS=20;
const GROUP_MAX_PER_USER=3;
const cleanGroupName=raw=>(raw||"").trim().replace(/\s+/g," ").slice(0,24);
const newGroupId=()=>`grp_${genTabId().replace(/[^a-zA-Z0-9]/g,"").slice(0,22)}`;
const groupInviteDocId=(groupId,username)=>`target_${groupId}_${encodeURIComponent(canonUsername(username))}`;
const newInviteCode=()=>{
  const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes=new Uint8Array(8);crypto.getRandomValues(bytes);
  return Array.from(bytes,b=>alphabet[b%alphabet.length]).join("");
};

async function fbLoadGroups(usernameRaw){
  const username=canonUsername(usernameRaw);
  try{
    const membership=await getDoc(doc(db,"leaderboard_group_memberships",username));
    const ids=membership.exists()&&Array.isArray(membership.data().groupIds)
      ? membership.data().groupIds.slice(0,GROUP_MAX_PER_USER):[];
    const snaps=await Promise.all(ids.map(id=>getDoc(doc(db,"leaderboard_groups",id))));
    const groups=snaps.filter(s=>s.exists()).map(s=>({id:s.id,...s.data()}));
    // Repair membership references left behind if an earlier group document
    // was removed outside the app or a previous network write was interrupted.
    const validIds=groups.map(g=>g.id);
    if(validIds.length!==ids.length)setDoc(doc(db,"leaderboard_group_memberships",username),{groupIds:validIds,updatedAt:Date.now()}).catch(()=>{});
    return {ok:true,groups};
  }catch(e){console.error("Group load error:",e);return {ok:false,groups:[],error:"Your groups couldn't be loaded. Try again."};}
}

async function fbLoadGroupBoard(group,view="weekly",weekKey=getWeekKey()){
  try{
    const ref=view==="allTime"
      ? doc(db,"leaderboard_alltime","data")
      : doc(db,"leaderboard_weekly",weekKey);
    const snap=await getDoc(ref);
    const ranked=snap.exists()?normalizeBoardEntries(snap.data()):[];
    const rows=groupRows(group,ranked);
    return {ok:true,rows};
  }catch(e){console.error("Group board error:",e);return {ok:false,rows:[],error:"The group standings couldn't be loaded. Try again."};}
}

// Targeted invites use a deterministic document id, plus a tiny per-user inbox.
// That makes duplicate pending invites for the same group/user impossible even
// when two send actions race. Legacy code-based invite documents continue to
// work and any old expiresAt fields are intentionally ignored.
async function fbLoadGroupInvites(usernameRaw){
  const username=canonUsername(usernameRaw);
  try{
    const inboxSnap=await getDoc(doc(db,"leaderboard_group_invite_inboxes",username));
    const inviteIds=inboxSnap.exists()&&Array.isArray(inboxSnap.data().inviteIds)?inboxSnap.data().inviteIds:[];
    const snaps=await Promise.all(inviteIds.map(id=>getDoc(doc(db,"leaderboard_group_invites",id))));
    const invites=snaps.filter(s=>s.exists()).map(s=>({id:s.id,...s.data()}))
      .filter(invite=>invite.kind==="targeted"&&invite.status==="pending"&&canonUsername(invite.invitedUser)===username);
    const validIds=invites.map(invite=>invite.id);
    if(validIds.length!==inviteIds.length){
      setDoc(doc(db,"leaderboard_group_invite_inboxes",username),{inviteIds:validIds,updatedAt:Date.now()}).catch(()=>{});
    }
    return {ok:true,invites};
  }catch(e){console.error("Group invite load error:",e);return {ok:false,invites:[],error:"Invitations couldn't be loaded."};}
}

async function fbLoadPendingGroupInvites(group){
  const ids=Array.isArray(group?.pendingInviteIds)?group.pendingInviteIds:[];
  try{
    const snaps=await Promise.all(ids.map(id=>getDoc(doc(db,"leaderboard_group_invites",id))));
    return snaps.filter(s=>s.exists()).map(s=>({id:s.id,...s.data()}))
      .filter(invite=>invite.kind==="targeted"&&invite.status==="pending");
  }catch(e){console.error("Pending group invite load error:",e);return [];}
}

async function fbSendGroupInvite(senderRaw,groupId,invitedRaw){
  const sender=canonUsername(senderRaw),invitedUser=canonUsername(invitedRaw);
  if(!invitedUser)return {ok:false,error:"Enter a username."};
  if(invitedUser===sender)return {ok:false,error:"You're already in this group."};
  try{
    const userSnap=await getDoc(doc(db,"usernames",invitedUser));
    if(!userSnap.exists())return {ok:false,error:"No Lumora account uses that username."};
    const inviteId=groupInviteDocId(groupId,invitedUser),now=Date.now();
    const invite=await runTransaction(db,async tx=>{
      const groupRef=doc(db,"leaderboard_groups",groupId);
      const inviteRef=doc(db,"leaderboard_group_invites",inviteId);
      const inboxRef=doc(db,"leaderboard_group_invite_inboxes",invitedUser);
      const [groupSnap,inviteSnap,inboxSnap]=await Promise.all([tx.get(groupRef),tx.get(inviteRef),tx.get(inboxRef)]);
      if(!groupSnap.exists())throw new Error("Group not found.");
      const group=groupSnap.data(),members=(group.members||[]).map(canonUsername);
      if(!members.includes(sender))throw new Error("Only group members can send invitations.");
      if(members.includes(invitedUser))throw new Error("That user is already in this group.");
      if(members.length>=GROUP_MAX_MEMBERS)throw new Error("This group is full.");
      if(inviteSnap.exists()&&inviteSnap.data().status==="pending")throw new Error("That user already has a pending invitation to this group.");
      const data={kind:"targeted",status:"pending",groupId,groupName:group.name,invitedUser,createdBy:sender,createdAt:now};
      const pendingInviteIds=[...new Set([...(group.pendingInviteIds||[]),inviteId])];
      const inboxIds=inboxSnap.exists()&&Array.isArray(inboxSnap.data().inviteIds)?inboxSnap.data().inviteIds:[];
      tx.set(inviteRef,data);
      tx.set(groupRef,{...group,pendingInviteIds,updatedAt:now});
      tx.set(inboxRef,{inviteIds:[...new Set([...inboxIds,inviteId])],updatedAt:now});
      return {id:inviteId,...data};
    });
    return {ok:true,invite};
  }catch(e){return {ok:false,error:e.message||"Couldn't send that invitation."};}
}

async function fbAcceptGroupInvite(usernameRaw,inviteId){
  const username=canonUsername(usernameRaw);
  try{
    const group=await runTransaction(db,async tx=>{
      const inviteRef=doc(db,"leaderboard_group_invites",inviteId);
      const membershipRef=doc(db,"leaderboard_group_memberships",username);
      const inboxRef=doc(db,"leaderboard_group_invite_inboxes",username);
      const [inviteSnap,membershipSnap,inboxSnap]=await Promise.all([tx.get(inviteRef),tx.get(membershipRef),tx.get(inboxRef)]);
      if(!inviteSnap.exists())throw new Error("That invitation is no longer pending.");
      const invite=inviteSnap.data();
      if(invite.kind!=="targeted"||invite.status!=="pending"||canonUsername(invite.invitedUser)!==username)throw new Error("That invitation isn't available.");
      const groupRef=doc(db,"leaderboard_groups",invite.groupId),groupSnap=await tx.get(groupRef);
      if(!groupSnap.exists())throw new Error("That group no longer exists.");
      const data=groupSnap.data(),members=(data.members||[]).map(canonUsername);
      const groupIds=membershipSnap.exists()&&Array.isArray(membershipSnap.data().groupIds)?membershipSnap.data().groupIds:[];
      if(!members.includes(username)&&groupIds.length>=GROUP_MAX_PER_USER)throw new Error(`You can join up to ${GROUP_MAX_PER_USER} groups.`);
      if(!members.includes(username)&&members.length>=GROUP_MAX_MEMBERS)throw new Error("That group is full.");
      const next={...data,members:[...new Set([...members,username])],pendingInviteIds:(data.pendingInviteIds||[]).filter(id=>id!==inviteId),updatedAt:Date.now()};
      tx.set(groupRef,next);
      tx.set(membershipRef,{groupIds:[...new Set([...groupIds,groupSnap.id])],updatedAt:Date.now()});
      tx.set(inboxRef,{inviteIds:(inboxSnap.data()?.inviteIds||[]).filter(id=>id!==inviteId),updatedAt:Date.now()});
      tx.delete(inviteRef);
      return {id:groupSnap.id,...next};
    });
    return {ok:true,group};
  }catch(e){return {ok:false,error:e.message||"Couldn't accept that invitation."};}
}

async function fbDeclineGroupInvite(usernameRaw,inviteId){
  const username=canonUsername(usernameRaw);
  try{
    await runTransaction(db,async tx=>{
      const inviteRef=doc(db,"leaderboard_group_invites",inviteId),inboxRef=doc(db,"leaderboard_group_invite_inboxes",username);
      const [inviteSnap,inboxSnap]=await Promise.all([tx.get(inviteRef),tx.get(inboxRef)]);
      if(!inviteSnap.exists())return;
      const invite=inviteSnap.data();
      if(canonUsername(invite.invitedUser)!==username)throw new Error("That invitation isn't yours.");
      const groupRef=doc(db,"leaderboard_groups",invite.groupId),groupSnap=await tx.get(groupRef);
      if(groupSnap.exists())tx.set(groupRef,{...groupSnap.data(),pendingInviteIds:(groupSnap.data().pendingInviteIds||[]).filter(id=>id!==inviteId),updatedAt:Date.now()});
      tx.set(inboxRef,{inviteIds:(inboxSnap.data()?.inviteIds||[]).filter(id=>id!==inviteId),updatedAt:Date.now()});
      tx.delete(inviteRef);
    });
    return {ok:true};
  }catch(e){return {ok:false,error:e.message||"Couldn't decline that invitation."};}
}

async function fbCancelGroupInvite(actorRaw,groupId,inviteId){
  const actor=canonUsername(actorRaw);
  try{
    await runTransaction(db,async tx=>{
      const inviteRef=doc(db,"leaderboard_group_invites",inviteId),groupRef=doc(db,"leaderboard_groups",groupId);
      const [inviteSnap,groupSnap]=await Promise.all([tx.get(inviteRef),tx.get(groupRef)]);
      if(!inviteSnap.exists())return;
      if(!groupSnap.exists()){tx.delete(inviteRef);return;}
      const invite=inviteSnap.data(),group=groupSnap.data();
      if(canonUsername(invite.createdBy)!==actor&&canonUsername(group.owner)!==actor)throw new Error("Only the sender or group owner can cancel this invitation.");
      const invitedUser=canonUsername(invite.invitedUser),inboxRef=doc(db,"leaderboard_group_invite_inboxes",invitedUser);
      const inboxSnap=await tx.get(inboxRef);
      tx.set(groupRef,{...group,pendingInviteIds:(group.pendingInviteIds||[]).filter(id=>id!==inviteId),updatedAt:Date.now()});
      tx.set(inboxRef,{inviteIds:(inboxSnap.data()?.inviteIds||[]).filter(id=>id!==inviteId),updatedAt:Date.now()});
      tx.delete(inviteRef);
    });
    return {ok:true};
  }catch(e){return {ok:false,error:e.message||"Couldn't cancel that invitation."};}
}

async function fbCreateGroup(usernameRaw,nameRaw){
  const username=canonUsername(usernameRaw),name=cleanGroupName(nameRaw);
  if(name.length<3)return {ok:false,error:"Group names need at least 3 characters."};
  try{
    for(let attempt=0;attempt<4;attempt++){
      const groupId=newGroupId(),inviteCode=newInviteCode(),now=Date.now();
      try{
        const group=await runTransaction(db,async tx=>{
          const membershipRef=doc(db,"leaderboard_group_memberships",username);
          const inviteRef=doc(db,"leaderboard_group_invites",inviteCode);
          const [membershipSnap,inviteSnap]=await Promise.all([tx.get(membershipRef),tx.get(inviteRef)]);
          if(inviteSnap.exists())throw new Error("invite-collision");
          const groupIds=membershipSnap.exists()&&Array.isArray(membershipSnap.data().groupIds)?membershipSnap.data().groupIds:[];
          if(groupIds.length>=GROUP_MAX_PER_USER)throw new Error(`You can join up to ${GROUP_MAX_PER_USER} groups.`);
          const data={name,owner:username,members:[username],inviteCode,createdAt:now,updatedAt:now};
          tx.set(doc(db,"leaderboard_groups",groupId),data);
          tx.set(membershipRef,{groupIds:[...new Set([...groupIds,groupId])],updatedAt:now});
          tx.set(inviteRef,{kind:"code",groupId,createdBy:username,createdAt:now});
          return {id:groupId,...data};
        });
        return {ok:true,group};
      }catch(e){if(e.message==="invite-collision")continue;throw e;}
    }
    return {ok:false,error:"Couldn't create an invite code. Try again."};
  }catch(e){return {ok:false,error:e.message||"Couldn't create the group."};}
}

async function fbJoinGroup(usernameRaw,codeRaw){
  const username=canonUsername(usernameRaw),code=(codeRaw||"").trim().toUpperCase();
  if(!/^[A-HJ-NP-Z2-9]{8}$/.test(code))return {ok:false,error:"Enter the 8-character group code."};
  try{
    const group=await runTransaction(db,async tx=>{
      const inviteRef=doc(db,"leaderboard_group_invites",code);
      const membershipRef=doc(db,"leaderboard_group_memberships",username);
      const [inviteSnap,membershipSnap]=await Promise.all([tx.get(inviteRef),tx.get(membershipRef)]);
      if(!inviteSnap.exists())throw new Error("That invite is invalid or has been revoked.");
      const invite=inviteSnap.data(); // legacy expiresAt is intentionally ignored
      const groupRef=doc(db,"leaderboard_groups",invite.groupId);
      const groupSnap=await tx.get(groupRef);
      if(!groupSnap.exists())throw new Error("That group no longer exists.");
      const data=groupSnap.data(),members=Array.isArray(data.members)?data.members.map(canonUsername):[];
      const groupIds=membershipSnap.exists()&&Array.isArray(membershipSnap.data().groupIds)?membershipSnap.data().groupIds:[];
      if(members.includes(username))return {id:groupSnap.id,...data,members};
      if(groupIds.length>=GROUP_MAX_PER_USER)throw new Error(`You can join up to ${GROUP_MAX_PER_USER} groups.`);
      if(members.length>=GROUP_MAX_MEMBERS)throw new Error("That group is full.");
      const next={...data,members:[...members,username],updatedAt:Date.now()};
      tx.set(groupRef,next);
      tx.set(membershipRef,{groupIds:[...new Set([...groupIds,groupSnap.id])],updatedAt:Date.now()});
      return {id:groupSnap.id,...next};
    });
    return {ok:true,group};
  }catch(e){return {ok:false,error:e.message||"Couldn't join the group."};}
}

async function fbLeaveGroup(usernameRaw,groupId){
  const username=canonUsername(usernameRaw);
  try{
    await runTransaction(db,async tx=>{
      const groupRef=doc(db,"leaderboard_groups",groupId),membershipRef=doc(db,"leaderboard_group_memberships",username);
      const [groupSnap,membershipSnap]=await Promise.all([tx.get(groupRef),tx.get(membershipRef)]);
      if(!groupSnap.exists())return;
      const data=groupSnap.data();
      if(canonUsername(data.owner)===username)throw new Error("Transfer ownership or delete the group before leaving.");
      tx.set(groupRef,{...data,members:(data.members||[]).filter(x=>canonUsername(x)!==username),updatedAt:Date.now()});
      tx.set(membershipRef,{groupIds:(membershipSnap.data()?.groupIds||[]).filter(id=>id!==groupId),updatedAt:Date.now()});
    });
    return {ok:true};
  }catch(e){return {ok:false,error:e.message||"Couldn't leave the group."};}
}

async function fbRemoveGroupMember(ownerRaw,groupId,memberRaw){
  const owner=canonUsername(ownerRaw),member=canonUsername(memberRaw);
  try{
    await runTransaction(db,async tx=>{
      const groupRef=doc(db,"leaderboard_groups",groupId),membershipRef=doc(db,"leaderboard_group_memberships",member);
      const [groupSnap,membershipSnap]=await Promise.all([tx.get(groupRef),tx.get(membershipRef)]);
      if(!groupSnap.exists())throw new Error("Group not found.");
      const data=groupSnap.data();
      if(canonUsername(data.owner)!==owner)throw new Error("Only the owner can remove members.");
      if(member===owner)throw new Error("The owner can't be removed.");
      tx.set(groupRef,{...data,members:(data.members||[]).filter(x=>canonUsername(x)!==member),updatedAt:Date.now()});
      tx.set(membershipRef,{groupIds:(membershipSnap.data()?.groupIds||[]).filter(id=>id!==groupId),updatedAt:Date.now()});
    });
    return {ok:true};
  }catch(e){return {ok:false,error:e.message||"Couldn't remove that member."};}
}

async function fbTransferGroup(ownerRaw,groupId,nextOwnerRaw){
  const owner=canonUsername(ownerRaw),nextOwner=canonUsername(nextOwnerRaw);
  try{
    await runTransaction(db,async tx=>{
      const ref=doc(db,"leaderboard_groups",groupId),snap=await tx.get(ref);
      if(!snap.exists())throw new Error("Group not found.");
      const data=snap.data();
      if(canonUsername(data.owner)!==owner)throw new Error("Only the owner can transfer the group.");
      if(!(data.members||[]).some(x=>canonUsername(x)===nextOwner))throw new Error("Choose a current member.");
      tx.set(ref,{...data,owner:nextOwner,updatedAt:Date.now()});
    });
    return {ok:true};
  }catch(e){return {ok:false,error:e.message||"Couldn't transfer ownership."};}
}

async function fbRefreshGroupInvite(ownerRaw,group){
  const owner=canonUsername(ownerRaw),nextCode=newInviteCode(),now=Date.now();
  try{
    const updated=await runTransaction(db,async tx=>{
      const groupRef=doc(db,"leaderboard_groups",group.id),nextInviteRef=doc(db,"leaderboard_group_invites",nextCode);
      const [groupSnap,nextInviteSnap]=await Promise.all([tx.get(groupRef),tx.get(nextInviteRef)]);
      if(!groupSnap.exists())throw new Error("Group not found.");
      const data=groupSnap.data();
      if(canonUsername(data.owner)!==owner)throw new Error("Only the owner can replace the invite.");
      if(nextInviteSnap.exists())throw new Error("Please try again.");
      if(data.inviteCode)tx.delete(doc(db,"leaderboard_group_invites",data.inviteCode));
      const {inviteExpiresAt:_legacyExpiry,...withoutLegacyExpiry}=data;
      const next={...withoutLegacyExpiry,inviteCode:nextCode,updatedAt:now};
      tx.set(groupRef,next);
      tx.set(nextInviteRef,{kind:"code",groupId:group.id,createdBy:owner,createdAt:now});
      return {id:group.id,...next};
    });
    return {ok:true,group:updated};
  }catch(e){return {ok:false,error:e.message||"Couldn't replace the invite."};}
}

async function fbDeleteGroup(ownerRaw,group){
  const owner=canonUsername(ownerRaw);
  try{
    await runTransaction(db,async tx=>{
      const groupRef=doc(db,"leaderboard_groups",group.id),groupSnap=await tx.get(groupRef);
      if(!groupSnap.exists())return;
      const data=groupSnap.data();
      if(canonUsername(data.owner)!==owner)throw new Error("Only the owner can delete the group.");
      const members=(data.members||[]).map(canonUsername);
      const pendingInviteIds=Array.isArray(data.pendingInviteIds)?data.pendingInviteIds:[];
      const membershipRefs=members.map(u=>doc(db,"leaderboard_group_memberships",u));
      const pendingInviteRefs=pendingInviteIds.map(id=>doc(db,"leaderboard_group_invites",id));
      const [membershipSnaps,pendingInviteSnaps]=await Promise.all([
        Promise.all(membershipRefs.map(ref=>tx.get(ref))),
        Promise.all(pendingInviteRefs.map(ref=>tx.get(ref))),
      ]);
      const inboxUsers=[...new Set(pendingInviteSnaps.filter(s=>s.exists()).map(s=>canonUsername(s.data().invitedUser)).filter(Boolean))];
      const inboxRefs=inboxUsers.map(u=>doc(db,"leaderboard_group_invite_inboxes",u));
      const inboxSnaps=await Promise.all(inboxRefs.map(ref=>tx.get(ref)));
      membershipRefs.forEach((ref,i)=>tx.set(ref,{groupIds:(membershipSnaps[i].data()?.groupIds||[]).filter(id=>id!==group.id),updatedAt:Date.now()}));
      inboxRefs.forEach((ref,i)=>tx.set(ref,{inviteIds:(inboxSnaps[i].data()?.inviteIds||[]).filter(id=>!pendingInviteIds.includes(id)),updatedAt:Date.now()}));
      pendingInviteRefs.forEach(ref=>tx.delete(ref));
      if(data.inviteCode)tx.delete(doc(db,"leaderboard_group_invites",data.inviteCode));
      tx.delete(groupRef);
    });
    return {ok:true};
  }catch(e){return {ok:false,error:e.message||"Couldn't delete the group."};}
}

// Old leaderboard documents may still contain the same person under different
// casing or Unicode compositions. Merge those rows before ranking or visiting
// a garden so canonUsername remains the single identity choke point everywhere.
function normalizeBoardEntries(data) {
  const merged = {};
  for(const [rawUsername, raw] of Object.entries(data||{})){
    if(!raw || typeof raw!=="object") continue;
    const username = canonUsername(rawUsername);
    if(!username) continue;
    const row = merged[username] || { username, totalSecs:0, sessions:0, subjects:{} };
    row.totalSecs += Math.max(0, Number(raw.totalSecs)||0);
    row.sessions += Math.max(0, Number(raw.sessions)||0);
    for(const [sid,secs] of Object.entries(raw.subjects||{})){
      row.subjects[sid] = (row.subjects[sid]||0) + Math.max(0, Number(secs)||0);
    }
    merged[username] = row;
  }
  return Object.values(merged).sort((a,b)=>b.totalSecs-a.totalSecs || a.username.localeCompare(b.username));
}

// Claim documents pre-date canonical usernames, so the same person can also
// appear here under multiple casings/compositions. Collapse those keys before
// deciding whether a prize was already paid; otherwise a renamed/canonicalized
// account could receive the same weekly reward twice.
function normalizeRewardClaims(data) {
  const normalized = {};
  for(const [rawUsername,claim] of Object.entries(data||{})){
    const username = canonUsername(rawUsername);
    if(!username) continue;
    const current = normalized[username];
    const hasPrize = value => value===true
      || ["coins","skin","background","decoration"].includes(value?.rewardType)
      || Number(value?.reward)>0 || !!value?.skinId || !!value?.backgroundId || !!value?.decorationId;
    if(!current || (!hasPrize(current) && hasPrize(claim))) normalized[username]=claim;
  }
  return normalized;
}

// Claim the previous completed week's podium reward exactly once. The claim
// ledger and coin update are committed in one Firestore transaction, so a
// refresh, second device or second tab cannot double-award the same placement.
async function fbClaimPreviousWeekReward(usernameRaw, now = new Date()) {
  const username = canonUsername(usernameRaw);
  const prev = getPreviousCompletedWeek(now);
  const weekKey = getWeekKeyFor(prev);
  const rewardMode = getWeeklyRewardMode(prev);
  const boardRef = doc(db, "leaderboard_weekly", weekKey);
  const claimRef = doc(db, "leaderboard_reward_claims", weekKey);
  const prefsRef = doc(db, "prefs", username);
  const membershipRef = doc(db, "leaderboard_group_memberships", username);
  try {
    return await runTransaction(db, async tx => {
      const membershipSnap=await tx.get(membershipRef);
      const groupIds=membershipSnap.exists()&&Array.isArray(membershipSnap.data().groupIds)
        ? membershipSnap.data().groupIds.slice(0,GROUP_MAX_PER_USER):[];
      const groupSnaps=await Promise.all(groupIds.map(groupId=>tx.get(doc(db,"leaderboard_groups",groupId))));
      const [boardSnap, claimSnap, prefsSnap] = await Promise.all([
        tx.get(boardRef), tx.get(claimRef), tx.get(prefsRef)
      ]);
      if(!boardSnap.exists()) return { ok:true, pending:true, reward:0, weekKey, rewardMode };
      const entries = normalizeBoardEntries(boardSnap.data());
      const groups=groupSnaps.filter(snap=>snap.exists()).map(snap=>({id:snap.id,...snap.data()}));
      const rewardGroup=selectLargestEligibleRewardGroup(groups,entries,username);
      if(!rewardGroup)return {
        ok:true,reward:0,noPrize:true,weekKey,rewardMode,rank:0,
        reason:"no-eligible-group",minimumParticipants:GROUP_REWARD_MIN_PARTICIPANTS,
      };
      const rank=rewardGroup.rank;
      const claimed = normalizeRewardClaims(claimSnap.exists() ? claimSnap.data().claimed : {});
      const prefs = prefsSnap.exists() ? prefsSnap.data() : {};
      const ownedSkins = Array.isArray(prefs.ownedSkins) && prefs.ownedSkins.length ? prefs.ownedSkins : ["default"];
      const ownedBackgrounds = normalizeOwnedBackgrounds(prefs.ownedBackgrounds);
      const ownedDecorations = Array.isArray(prefs.decorations) ? [...new Set(prefs.decorations)] : [];

      // There is no prize outside the podium. Do not write a zero-value claim:
      // if an admin later repairs a stale weekly board, the rightful winner can
      // still be settled automatically on their next check.
      if(rank<0 || rank>=3) return { ok:true, reward:0, noPrize:true, weekKey, rank:rank+1, rewardMode };

      const existing = claimed[username];
      const alreadySettled = !!existing && (
        existing===true || ["coins","skin","background","decoration"].includes(existing.rewardType) ||
        Number(existing.reward)>0 || !!existing.skinId || !!existing.backgroundId || !!existing.decorationId
      );
      if(alreadySettled) return {
        ok:true, reward:0, alreadyClaimed:true, weekKey, rank:rank+1, rewardMode,
        coinBalance:typeof prefs.coins==="number"?prefs.coins:0,
        ownedSkins,ownedBackgrounds,decorations:ownedDecorations,
      };

      let reward = rank>=0 && rank<3 ? WEEKLY_PODIUM_REWARDS[rank] : 0;
      let skin = null;
      let background = null;
      let decoration = null;
      let skinFallback = false;
      let backgroundFallback = false;
      let decorationFallback = false;

      // On alternating skin weeks, first place receives one deterministic
      // random unowned shop skin instead of 300 coins. Deterministic selection
      // keeps Firestore transaction retries from changing the prize. Someone
      // who already owns every shop skin receives the usual 300-coin fallback.
      if(rewardMode==="skin" && rank===0){
        skin = pickWeeklySkin(weekKey,username,ownedSkins);
        if(skin) reward=0;
        else skinFallback=true;
      }

      // The third rotation is the classroom collection week: first place gets
      // a deterministic random unowned background, second place gets an
      // unowned decor item and third place keeps the 100-coin podium prize.
      // Fully completed catalogues fall back to the normal placement coins.
      if(rewardMode==="classroom" && rank===0){
        background = pickWeeklyBackground(weekKey,username,ownedBackgrounds);
        if(background) reward=0;
        else backgroundFallback=true;
      }
      if(rewardMode==="classroom" && rank===1){
        decoration = pickWeeklyDecoration(weekKey,username,ownedDecorations);
        if(decoration) reward=0;
        else decorationFallback=true;
      }

      const claimData = {
        ts:Date.now(), rank:rank+1, reward,
        source:"group",groupId:rewardGroup.group.id,groupName:rewardGroup.group.name||"Group",
        participantCount:rewardGroup.participantCount,
        rewardType:background?"background":decoration?"decoration":skin?"skin":reward>0?"coins":"none",
        skinId:skin?.id||null, skinName:skin?.name||null,
        backgroundId:background?.id||null,backgroundName:background?.name||null,
        decorationId:decoration?.id||null,decorationName:decoration?.name||null,
        skinFallback,backgroundFallback,decorationFallback,
      };
      tx.set(claimRef, { claimed:{...claimed,[username]:claimData} });
      if(skin){
        const nextOwned=[...new Set([...ownedSkins,skin.id])];
        tx.set(prefsRef, { ownedSkins:nextOwned }, { merge:true });
      } else if(background){
        const nextOwned=normalizeOwnedBackgrounds([...ownedBackgrounds,background.id]);
        tx.set(prefsRef, { ownedBackgrounds:nextOwned }, { merge:true });
      } else if(decoration){
        const nextOwned=[...new Set([...ownedDecorations,decoration.id])];
        tx.set(prefsRef, { decorations:nextOwned }, { merge:true });
      } else if(reward>0){
        const current = typeof prefs.coins==="number" ? prefs.coins : 0;
        tx.set(prefsRef, { coins:current+reward }, { merge:true });
      }
      return { ok:true, reward, weekKey, rank:rank+1, rewardMode,
        groupId:rewardGroup.group.id,groupName:rewardGroup.group.name||"Group",
        participantCount:rewardGroup.participantCount,
        skinId:skin?.id||null, skinName:skin?.name||null, skinFallback,
        backgroundId:background?.id||null,backgroundName:background?.name||null,backgroundFallback,
        decorationId:decoration?.id||null,decorationName:decoration?.name||null,decorationFallback,
        repaired:!!existing,
        coinBalance:(skin||background||decoration) ? (typeof prefs.coins==="number"?prefs.coins:0) : (typeof prefs.coins==="number"?prefs.coins:0)+reward,
        ownedSkins:skin ? [...new Set([...ownedSkins,skin.id])] : ownedSkins,
        ownedBackgrounds:background ? normalizeOwnedBackgrounds([...ownedBackgrounds,background.id]) : ownedBackgrounds,
        decorations:decoration ? [...new Set([...ownedDecorations,decoration.id])] : ownedDecorations,
      };
    });
  } catch(e) { console.error("Weekly reward claim error:", e); return {ok:false,reward:0,error:e.message}; }
}

// ── Friend presence ────────────────────────────────────────────────────────────
// Signed-in users publish a small online heartbeat. Active focus replaces the
// status with "studying" plus the selected subject. Reads are performed only
// for accepted friends, which also matches the hardened Firestore rules.
const PRESENCE_TTL = 120 * 1000;
async function fbHeartbeat(username, status="online", subjLabel="", subjEmoji="", subjColor="") {
  try {
    await setDoc(doc(db, "presence", username), {
      username,status:status==="studying"?"studying":"online",
      subjLabel:status==="studying"?subjLabel:"",
      subjEmoji:status==="studying"?subjEmoji:"",
      subjColor:status==="studying"?subjColor:"",
      ts:Date.now()
    });
  } catch(e) {}
}
async function fbClearPresence(username) {
  try { await deleteDoc(doc(db, "presence", username)); } catch(e) {}
}
async function fbLoadFriendPresence(friends) {
  try {
    const usernames=[...new Set((Array.isArray(friends)?friends:[]).map(friend=>normalizeFriendUsername(friend?.username||friend)).filter(Boolean))];
    const snaps=await Promise.all(usernames.map(username=>getDoc(doc(db,"presence",username))));
    const now = Date.now();
    const out=snaps.filter(snap=>snap.exists()).map(snap=>normalizePresenceRecord(snap.data()))
      .filter(record=>record.username&&now-record.ts<PRESENCE_TTL);
    return out.sort((a,b)=>a.username.localeCompare(b.username));
  } catch(e) { console.error("Presence load error:", e); return []; }
}

// Simple hash — not cryptographic but fine for a study app
async function simpleHash(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
}

const authenticateUsername = httpsCallable(functions,"authenticateUsername");
const getRecoveryQuestion = httpsCallable(functions,"getRecoveryQuestion");
const resetUsernamePassword = httpsCallable(functions,"resetUsernamePassword");
const setRecoveryQuestion = httpsCallable(functions,"setRecoveryQuestion");

const callableError = (error, fallback) => {
  const message=String(error?.message||"").replace(/^Firebase:\s*/i,"").replace(/\s*\(functions\/[^)]+\)\.?$/i,"");
  return message||fallback;
};

const usernameAuthEmail = username => `${canonUsername(username)}@users.lumora.invalid`;
const isEmailLogin = value => String(value||"").trim().includes("@");

const directAuthError = error => {
  const code=String(error?.code||"");
  if(code.includes("invalid-credential")||code.includes("wrong-password"))return "That password isn't correct.";
  if(code.includes("too-many-requests"))return "Too many attempts. Wait a moment and try again.";
  if(code.includes("weak-password"))return "Password must be at least 6 characters.";
  if(code.includes("operation-not-allowed"))return "Lumora email/password sign-in is not enabled in Firebase.";
  if(code.includes("network-request-failed"))return "Couldn't reach Firebase. Check your connection and try again.";
  return `Couldn't sign in: ${code||error?.message||"unknown Firebase error"}`;
};

// The LUMORA Firebase project currently uses the Spark plan, so Cloud
// Functions are unavailable. Authenticate directly with Firebase Auth while
// retaining the same username-first StudyGrove UI and Lumora username mapping.
async function authenticateUsernameDirect(username,password){
  const displayName=String(username||"").trim();
  const key=canonUsername(displayName);
  if(key.length<2)return {ok:false,error:"Username needs at least 2 characters."};
  if(key.length>20)return {ok:false,error:"Username can be at most 20 characters."};
  if(!/^[a-z0-9_]+$/.test(key))return {ok:false,error:"Username can use letters, numbers, and underscores only."};
  const usernameRef=doc(db,"usernames",key);
  let usernameSnap;
  try{
    usernameSnap=await getDoc(usernameRef);
  }catch(error){
    return {ok:false,error:"Couldn't read the LUMORA username directory. Check Firestore permissions."};
  }

  if(usernameSnap.exists()){
    const account=usernameSnap.data()||{};
    const email=String(account.email||usernameAuthEmail(key));
    try{
      const credential=await signInWithEmailAndPassword(auth,email,password);
      if(account.uid&&account.uid!==credential.user.uid){
        await firebaseSignOut(auth);
        return {ok:false,error:"That username belongs to a different Lumora account."};
      }
      if(!account.uid||!account.email||!account.displayName){
        await setDoc(usernameRef,{
          uid:credential.user.uid,email,
          displayName:account.displayName||displayName,
        },{merge:true});
      }
      return {ok:true,created:false,username:account.displayName||displayName};
    }catch(error){
      return {ok:false,error:directAuthError(error)};
    }
  }

  const email=usernameAuthEmail(key);
  let credential;
  let created=false;
  try{
    credential=await createUserWithEmailAndPassword(auth,email,password);
    created=true;
  }catch(error){
    if(!String(error?.code||"").includes("email-already-in-use")){
      return {ok:false,error:directAuthError(error)};
    }
    try{
      credential=await signInWithEmailAndPassword(auth,email,password);
    }catch(signInError){
      return {ok:false,error:directAuthError(signInError)};
    }
  }

  try{
    const latest=await getDoc(usernameRef);
    if(latest.exists()&&latest.data()?.uid!==credential.user.uid){
      if(created)await deleteUser(credential.user).catch(()=>{});
      else await firebaseSignOut(auth).catch(()=>{});
      return {ok:false,error:"That username is already taken."};
    }
    await setDoc(usernameRef,{
      uid:credential.user.uid,email,displayName,createdAt:Date.now(),authVersion:2,
    },{merge:true});
    return {ok:true,created,username:displayName};
  }catch(error){
    if(created)await deleteUser(credential.user).catch(()=>{});
    return {ok:false,error:"Firebase created the login but couldn't connect its Lumora data. Please try again."};
  }
}

async function authenticateEmailDirect(email,password){
  const normalizedEmail=String(email||"").trim().toLowerCase();
  if(!normalizedEmail||normalizedEmail.length>254||!/^\S+@\S+\.\S+$/.test(normalizedEmail)){
    return {ok:false,error:"Enter a valid email address."};
  }
  let credential;
  try{
    credential=await signInWithEmailAndPassword(auth,normalizedEmail,password);
  }catch(error){
    const code=String(error?.code||"");
    if(code.includes("invalid-email"))return {ok:false,error:"Enter a valid email address."};
    if(code.includes("invalid-credential")||code.includes("wrong-password")||code.includes("user-not-found")){
      return {ok:false,error:"That email or password isn't correct."};
    }
    return {ok:false,error:directAuthError(error)};
  }
  try{
    const username=await usernameForUid(credential.user.uid);
    if(!username){
      await firebaseSignOut(auth).catch(()=>{});
      return {ok:false,error:"That Firebase account isn't connected to a Lumora username yet."};
    }
    return {ok:true,created:false,username};
  }catch(error){
    await firebaseSignOut(auth).catch(()=>{});
    return {ok:false,error:"Signed in, but Lumora couldn't connect that email to its username data."};
  }
}

async function fbSavePassword(usernameOrEmail, password, recovery) {
  if(isEmailLogin(usernameOrEmail))return authenticateEmailDirect(usernameOrEmail,password);
  if(!AUTH_FUNCTIONS_ENABLED)return authenticateUsernameDirect(usernameOrEmail,password);
  try{
    const response=await authenticateUsername({
      username:canonUsername(usernameOrEmail),password,recovery,
      firebaseApiKey:import.meta.env.VITE_FIREBASE_API_KEY,
    });
    const result=response.data||{};
    if(!result.ok||!result.customToken)return {ok:false,error:result.error||"Couldn't sign in."};
    await signInWithCustomToken(auth,result.customToken);
    return {ok:true,created:result.created===true};
  }catch(error){
    return {ok:false,error:callableError(error,"Couldn't sign in. Try again.")};
  }
}

// Fetch the recovery question for a username (for the forgot-password flow)
async function fbGetRecoveryQuestion(username) {
  if(!AUTH_FUNCTIONS_ENABLED)return {ok:false,error:"Password recovery requires Lumora Cloud Functions, which are not enabled yet."};
  try {
    const response=await getRecoveryQuestion({username:canonUsername(username)});
    return response.data||{ok:false,error:"Recovery isn't available for this account."};
  } catch(error) {
    return {ok:false,error:callableError(error,"Something went wrong, try again")};
  }
}

// Verify the recovery answer and set a new password
async function fbResetPassword(username, answer, newPassword) {
  if(!AUTH_FUNCTIONS_ENABLED)return {ok:false,error:"Password recovery requires Lumora Cloud Functions, which are not enabled yet."};
  try {
    const response=await resetUsernamePassword({
      username:canonUsername(username),answer,newPassword,
    });
    const result=response.data||{};
    if(!result.ok||!result.customToken)return {ok:false,error:result.error||"Recovery isn't available for this account"};
    await signInWithCustomToken(auth,result.customToken);
    return {ok:true};
  } catch(error) {
    return {ok:false,error:callableError(error,"Something went wrong, try again")};
  }
}

// ── Account management (logged-in user) ──
// Read which recovery question (if any) is set on the account.
async function fbGetAccountInfo(username) {
  if(!AUTH_FUNCTIONS_ENABLED)return {ok:true,recoveryQuestion:null,recoveryAvailable:false};
  try {
    const response=await getRecoveryQuestion({username:canonUsername(username)});
    const result=response.data||{};
    return result.ok?{ok:true,recoveryQuestion:result.question||null}:result;
  } catch(error) {
    return {ok:false,error:callableError(error,"Couldn't load account")};
  }
}

// Change password: verify the current password hash first, then set the new one.
async function fbChangePassword(username, currentPassword, newPassword) {
  try {
    const activeUser=auth.currentUser;
    if(!activeUser?.email)return {ok:false,error:"Your session needs to be refreshed. Please sign in again."};
    const credential=EmailAuthProvider.credential(activeUser.email,currentPassword);
    await reauthenticateWithCredential(activeUser,credential);
    await updatePassword(activeUser,newPassword);
    return {ok:true};
  } catch(error) {
    if(String(error?.code||"").includes("invalid-credential"))return {ok:false,error:"Your current password isn't correct"};
    return {ok:false,error:"Something went wrong, try again"};
  }
}

// Set or update the recovery question + hashed answer.
async function fbSetRecovery(username, question, answer) {
  if(!AUTH_FUNCTIONS_ENABLED)return {ok:false,error:"Password recovery requires Lumora Cloud Functions, which are not enabled yet."};
  try {
    const response=await setRecoveryQuestion({username:canonUsername(username),question,answer});
    return response.data||{ok:false,error:"Something went wrong, try again"};
  } catch(error) {
    return {ok:false,error:callableError(error,"Something went wrong, try again")};
  }
}

async function fbLoadHistory(usernameRaw) {
  const username = canonUsername(usernameRaw);
  try {
    const snap = await getDoc(doc(db, "history", username));
    return snap.exists() ? (snap.data().sessions || []) : [];
  } catch(e) { console.error("Firebase history error:", e); return []; }
}

// User preferences (subjects, exams, etc.) — synced across devices
async function fbLoadPrefs(usernameRaw) {
  const username = canonUsername(usernameRaw);
  try {
    const snap = await getDoc(doc(db, "prefs", username));
    return snap.exists() ? snap.data() : null;
  } catch(e) { console.error("Firebase prefs load error:", e); return null; }
}

async function fbSavePrefs(usernameRaw, patch) {
  const username = canonUsername(usernameRaw);
  try {
    const ref = doc(db, "prefs", username);
    const snap = await getDoc(ref);
    const ownedPatch={...patch,...(auth.currentUser?.uid?{ownerUid:auth.currentUser.uid}:{})};
    if (snap.exists()) await updateDoc(ref, ownedPatch);
    else await setDoc(ref, ownedPatch);
    return true;
  } catch(e) { console.error("Firebase prefs save error:", e); return false; }
}

async function fbClaimMilestoneReward(usernameRaw, stageIndex) {
  const username=canonUsername(usernameRaw);
  const index=Math.max(0,Math.min(MILESTONE_STAGES.length-1,Math.trunc(Number(stageIndex)||0)));
  const stage=MILESTONE_STAGES[index];
  const reward=getMilestoneReward(stage);
  try{
    return await runTransaction(db,async tx=>{
      const prefsRef=doc(db,"prefs",username),historyRef=doc(db,"history",username);
      const [prefsSnap,historySnap]=await Promise.all([tx.get(prefsRef),tx.get(historyRef)]);
      const prefs=prefsSnap.exists()?prefsSnap.data():{};
      const claimed=Array.isArray(prefs.claimedMilestoneRewards)?prefs.claimedMilestoneRewards:[];
      const currentCoins=typeof prefs.coins==="number"?prefs.coins:0;
      if(claimed.includes(index))return {ok:true,alreadyClaimed:true,claimed,coinBalance:currentCoins,reward};
      const sessions=historySnap.exists()&&Array.isArray(historySnap.data().sessions)?historySnap.data().sessions:[];
      const totalHours=sessions.reduce((sum,session)=>sum+(Number(session.secs)||0),0)/3600;
      if(totalHours<stage.max)return {ok:false,reason:"locked",claimed,coinBalance:currentCoins,reward};
      const nextClaimed=[...claimed,index].sort((a,b)=>a-b),coinBalance=currentCoins+reward;
      tx.set(prefsRef,{coins:coinBalance,claimedMilestoneRewards:nextClaimed},{merge:true});
      return {ok:true,claimed:nextClaimed,coinBalance,reward};
    });
  }catch(e){console.error("Milestone reward claim error:",e);return {ok:false,reason:"network",error:e.message};}
}

// ── Private checklist ────────────────────────────────────────────────────────
// Tasks live outside prefs so the preferences document never grows into an
// unbounded array. Firebase Auth is re-verified against the username mapping
// for every write, and Firestore rules enforce the same ownership boundary.
const taskCacheKey=username=>`studygrove_tasks_${canonUsername(username)}`;
const newTaskId=()=>`task_${genTabId().replace(/[^a-zA-Z0-9_-]/g,"").slice(0,42)}`;
const cleanTaskTitle=value=>String(value||"").trim().replace(/\s+/g," ").slice(0,180);
const cleanTaskSubject=value=>String(value||"").trim().slice(0,80);
const cleanTaskDueDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""))?String(value):"";
const taskRef=(username,id)=>doc(db,"tasks",canonUsername(username),"items",String(id));
const normalizeTask=(id,data={})=>({
  id:String(id),
  title:cleanTaskTitle(data.title),
  completed:data.completed===true,
  subject:cleanTaskSubject(data.subject),
  dueDate:cleanTaskDueDate(data.dueDate),
  order:Number.isFinite(Number(data.order))?Number(data.order):Number(data.createdAtMs)||Date.now(),
  createdAtMs:Number(data.createdAtMs)||Date.now(),
  updatedAtMs:Number(data.updatedAtMs)||Number(data.createdAtMs)||Date.now(),
  completedAtMs:Number(data.completedAtMs)||0,
});

async function fbLoadTasks(usernameRaw,password){
  const username=canonUsername(usernameRaw);
  try{
    const {passwordHash}=await verifiedSessionHash(username,password);
    const accountSnap=await getDoc(doc(db,"usernames",username));
    if(!accountSnap.exists()||accountSnap.data().uid!==passwordHash)
      throw new Error("Your session could not be verified. Please sign in again.");
    const snap=await getDocs(query(collection(db,"tasks",username,"items"),orderBy("order","asc"),limit(200)));
    return {ok:true,tasks:snap.docs.map(item=>normalizeTask(item.id,item.data())).filter(item=>item.title)};
  }catch(e){
    console.error("Checklist load error:",e);
    return {ok:false,error:e.message,tasks:[]};
  }
}

async function fbCreateTask(usernameRaw,password,id,input){
  const username=canonUsername(usernameRaw),title=cleanTaskTitle(input?.title);
  if(!title)return {ok:false,error:"Add a task title first."};
  try{
    const {passwordHash}=await verifiedSessionHash(username,password);
    const now=Date.now();
    const task=normalizeTask(id,{
      title,completed:false,subject:cleanTaskSubject(input?.subject),
      dueDate:cleanTaskDueDate(input?.dueDate),order:Number(input?.order)||now,
      createdAtMs:now,updatedAtMs:now,
    });
    await runTransaction(db,async tx=>{
      await assertVerifiedSessionTx(tx,username,passwordHash);
      tx.set(taskRef(username,id),{
        ...task,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),
      });
    });
    return {ok:true,task};
  }catch(e){console.error("Checklist create error:",e);return {ok:false,error:e.message};}
}

async function fbUpdateTask(usernameRaw,password,id,patch){
  const username=canonUsername(usernameRaw);
  try{
    const {passwordHash}=await verifiedSessionHash(username,password);
    const now=Date.now();
    return await runTransaction(db,async tx=>{
      await assertVerifiedSessionTx(tx,username,passwordHash);
      const ref=taskRef(username,id),snap=await tx.get(ref);
      if(!snap.exists())throw new Error("That task no longer exists.");
      const current=normalizeTask(id,snap.data());
      const next=normalizeTask(id,{
        ...current,
        ...(Object.prototype.hasOwnProperty.call(patch||{},"title")?{title:cleanTaskTitle(patch.title)}:{}),
        ...(Object.prototype.hasOwnProperty.call(patch||{},"subject")?{subject:cleanTaskSubject(patch.subject)}:{}),
        ...(Object.prototype.hasOwnProperty.call(patch||{},"dueDate")?{dueDate:cleanTaskDueDate(patch.dueDate)}:{}),
        ...(Object.prototype.hasOwnProperty.call(patch||{},"completed")?{
          completed:patch.completed===true,
          completedAtMs:patch.completed===true?now:0,
        }:{}),
        updatedAtMs:now,
      });
      if(!next.title)throw new Error("Task titles cannot be empty.");
      tx.set(ref,{
        title:next.title,completed:next.completed,subject:next.subject,dueDate:next.dueDate,
        order:next.order,createdAtMs:next.createdAtMs,updatedAtMs:now,
        completedAtMs:next.completedAtMs,
        updatedAt:serverTimestamp(),
        ...(next.completed?{completedAt:serverTimestamp()}:{completedAt:null}),
      },{merge:true});
      return {ok:true,task:next};
    });
  }catch(e){console.error("Checklist update error:",e);return {ok:false,error:e.message};}
}

async function fbDeleteTask(usernameRaw,password,id){
  const username=canonUsername(usernameRaw);
  try{
    const {passwordHash}=await verifiedSessionHash(username,password);
    await runTransaction(db,async tx=>{
      await assertVerifiedSessionTx(tx,username,passwordHash);
      tx.delete(taskRef(username,id));
    });
    return {ok:true};
  }catch(e){console.error("Checklist delete error:",e);return {ok:false,error:e.message};}
}

// ── Announcements + chronological community discussion ───────────────────────
// Lumora retains Firebase Authentication. Privileged announcement mutations
// verify the active Firebase uid against the username mapping inside the same
// transaction as the write, so a client-supplied author cannot impersonate
// another account or gain admin access by merely
// changing UI state. Moving to Firebase Auth would be required for identity-
// aware Firestore security rules, and is deliberately outside this feature.
const announcementMetaRef = () => doc(db,"announcementSystem","current");
const announcementRef = id => doc(db,"announcements",id);
const announcementReplyRef = (announcementId,replyId) =>
  doc(db,"announcements",announcementId,"replies",replyId);
const safeIdentityDocId = raw => encodeURIComponent(canonUsername(raw));
const announcementReactionRef = (announcementId,replyId,username) => replyId
  ? doc(db,"announcements",announcementId,"replies",replyId,"reactions",safeIdentityDocId(username))
  : doc(db,"announcements",announcementId,"reactions",safeIdentityDocId(username));

const cleanAnnouncementInput = input => {
  const title=(input?.title||"").trim().slice(0,100);
  const message=(input?.message||"").trim().slice(0,5000);
  const category=(input?.category||"").trim().slice(0,24);
  if(!title)throw new Error("Add a short announcement title.");
  if(!message)throw new Error("Add an announcement message.");
  return {title,message,category};
};
const cleanReplyMessage = raw => {
  const message=(raw||"").trim().slice(0,800);
  if(!message)throw new Error("Write a reply first.");
  return message;
};
const announcementData = snap => {
  if(!snap?.exists())return null;
  const data=snap.data()||{};
  return {
    id:snap.id,
    ...data,
    publishedAtMs:Number(data.publishedAtMs)||data.publishedAt?.toMillis?.()||0,
    createdAtMs:Number(data.createdAtMs)||data.createdAt?.toMillis?.()||0,
  };
};
async function verifiedSessionHash(usernameRaw,password){
  const username=canonUsername(usernameRaw);
  const uid=auth.currentUser?.uid;
  if(!username||!uid)throw new Error("Your session needs to be refreshed. Please sign in again.");
  return {username,passwordHash:uid};
}
async function assertVerifiedSessionTx(tx,username,passwordHash,{admin=false}={}){
  if(admin && (!ANNOUNCEMENT_ADMIN||username!==ANNOUNCEMENT_ADMIN))throw new Error("Only a configured Lumora administrator can manage announcements.");
  const accountSnap=await tx.get(doc(db,"usernames",username));
  if(!accountSnap.exists()||accountSnap.data().uid!==passwordHash)
    throw new Error("Your session could not be verified. Please sign in again.");
}
async function fbPublishAnnouncement(usernameRaw,password,input){
  const clean=cleanAnnouncementInput(input);
  const {username,passwordHash}=await verifiedSessionHash(usernameRaw,password);
  const nextRef=doc(collection(db,"announcements"));
  const metaRef=announcementMetaRef();
  const now=Date.now();
  await runTransaction(db,async tx=>{
    await assertVerifiedSessionTx(tx,username,passwordHash,{admin:true});
    const metaSnap=await tx.get(metaRef);
    const currentId=metaSnap.exists()?metaSnap.data().currentId:null;
    if(currentId){
      const currentRef=announcementRef(currentId);
      const currentSnap=await tx.get(currentRef);
      if(currentSnap.exists()&&currentSnap.data().status!=="deleted"){
        tx.set(currentRef,{
          status:"archived",archivedAt:serverTimestamp(),archivedAtMs:now,
          updatedAt:serverTimestamp(),updatedAtMs:now,
        },{merge:true});
      }
    }
    tx.set(nextRef,{
      ...clean,status:"published",authorUsername:ANNOUNCEMENT_ADMIN,
      createdAt:serverTimestamp(),createdAtMs:now,
      publishedAt:serverTimestamp(),publishedAtMs:now,
      updatedAt:serverTimestamp(),updatedAtMs:now,
      replyCount:0,reactionCounts:{},
    });
    tx.set(metaRef,{
      currentId:nextRef.id,publishedAt:serverTimestamp(),publishedAtMs:now,
      updatedBy:ANNOUNCEMENT_ADMIN,
    },{merge:true});
  });
  return nextRef.id;
}
async function fbEditAnnouncement(usernameRaw,password,id,input){
  const clean=cleanAnnouncementInput(input);
  const {username,passwordHash}=await verifiedSessionHash(usernameRaw,password);
  const ref=announcementRef(id),now=Date.now();
  await runTransaction(db,async tx=>{
    await assertVerifiedSessionTx(tx,username,passwordHash,{admin:true});
    const snap=await tx.get(ref);
    if(!snap.exists()||snap.data().status==="deleted")throw new Error("That announcement is no longer available.");
    tx.set(ref,{
      ...clean,editedAt:serverTimestamp(),editedAtMs:now,
      updatedAt:serverTimestamp(),updatedAtMs:now,updatedBy:ANNOUNCEMENT_ADMIN,
    },{merge:true});
  });
}
async function fbFindAnnouncementReplacement(excludeId){
  const snap=await getDocs(query(collection(db,"announcements"),orderBy("publishedAtMs","desc"),limit(16)));
  const match=snap.docs.find(item=>item.id!==excludeId&&item.data().status!=="deleted");
  return match?.id||null;
}
async function fbSetAnnouncementStatus(usernameRaw,password,id,nextStatus){
  const {username,passwordHash}=await verifiedSessionHash(usernameRaw,password);
  const replacementId=await fbFindAnnouncementReplacement(id);
  const ref=announcementRef(id),metaRef=announcementMetaRef(),now=Date.now();
  await runTransaction(db,async tx=>{
    await assertVerifiedSessionTx(tx,username,passwordHash,{admin:true});
    const replacementRef=replacementId?announcementRef(replacementId):null;
    const [targetSnap,metaSnap,replacementSnap]=await Promise.all([
      tx.get(ref),tx.get(metaRef),replacementRef?tx.get(replacementRef):Promise.resolve(null),
    ]);
    if(!targetSnap.exists()||targetSnap.data().status==="deleted")throw new Error("That announcement is no longer available.");
    const deleting=nextStatus==="deleted";
    const hasReplacement=!!(replacementRef&&replacementSnap?.exists()&&replacementSnap.data().status!=="deleted");
    tx.set(ref,{
      status:nextStatus,
      ...(deleting?{deletedAt:serverTimestamp(),deletedAtMs:now,deletedBy:ANNOUNCEMENT_ADMIN}:{archivedAt:serverTimestamp(),archivedAtMs:now}),
      updatedAt:serverTimestamp(),updatedAtMs:now,
    },{merge:true});
    if(metaSnap.exists()&&metaSnap.data().currentId===id){
      if(hasReplacement)
        tx.set(replacementRef,{status:"published",updatedAt:serverTimestamp(),updatedAtMs:now},{merge:true});
      tx.set(metaRef,{
        currentId:hasReplacement?replacementId:null,publishedAtMs:hasReplacement?now:0,
        updatedAt:serverTimestamp(),updatedBy:ANNOUNCEMENT_ADMIN,
      },{merge:true});
    }
  });
}
const fbArchiveAnnouncement=(username,password,id)=>fbSetAnnouncementStatus(username,password,id,"archived");
const fbDeleteAnnouncement=(username,password,id)=>fbSetAnnouncementStatus(username,password,id,"deleted");

function fbWatchCurrentAnnouncement(onValue,onError){
  let stopCurrent=()=>{};
  const stopMeta=onSnapshot(announcementMetaRef(),metaSnap=>{
    stopCurrent();
    const id=metaSnap.exists()?metaSnap.data().currentId:null;
    if(!id){onValue(null);return;}
    stopCurrent=onSnapshot(announcementRef(id),snap=>{
      const value=announcementData(snap);
      onValue(value?.status==="deleted"?null:value);
    },onError);
  },onError);
  return ()=>{stopCurrent();stopMeta();};
}
async function fbLoadAnnouncementArchive(cursor=null,batchSize=5){
  const base=[collection(db,"announcements"),orderBy("publishedAtMs","desc")];
  const q=cursor
    ? query(...base,startAfter(cursor),limit(batchSize))
    : query(...base,limit(batchSize));
  const snap=await getDocs(q);
  return {
    items:snap.docs.map(announcementData).filter(item=>item&&item.status==="archived"),
    cursor:snap.docs.at(-1)||null,
    hasMore:snap.docs.length===batchSize,
  };
}
function fbWatchAnnouncement(id,onValue,onError){
  return onSnapshot(announcementRef(id),snap=>onValue(announcementData(snap)),onError);
}
function fbWatchAnnouncementReplies(id,replyLimit,onValue,onError){
  const q=query(
    collection(db,"announcements",id,"replies"),
    orderBy("createdAtMs","desc"),
    limit(replyLimit)
  );
  return onSnapshot(q,snap=>{
    const replies=snap.docs.map(item=>({id:item.id,...item.data()}))
      .sort((a,b)=>(Number(a.createdAtMs)||0)-(Number(b.createdAtMs)||0));
    onValue(replies);
  },onError);
}
async function fbAddAnnouncementReply(usernameRaw,password,announcementId,rawMessage){
  const message=cleanReplyMessage(rawMessage);
  const {username,passwordHash}=await verifiedSessionHash(usernameRaw,password);
  const now=Date.now();
  const fingerprint=(await simpleHash(message)).slice(0,14);
  const replyId=`reply_${safeIdentityDocId(username)}_${Math.floor(now/10000)}_${fingerprint}`;
  const parentRef=announcementRef(announcementId);
  const replyRef=announcementReplyRef(announcementId,replyId);
  return runTransaction(db,async tx=>{
    await assertVerifiedSessionTx(tx,username,passwordHash);
    const [parentSnap,existingSnap]=await Promise.all([tx.get(parentRef),tx.get(replyRef)]);
    if(!parentSnap.exists()||parentSnap.data().status==="deleted")throw new Error("That announcement is no longer available.");
    if(existingSnap.exists())return {id:replyId,duplicate:true};
    tx.set(replyRef,{
      username,message,createdAt:serverTimestamp(),createdAtMs:now,
      reactionCounts:{},deleted:false,
    });
    tx.set(parentRef,{replyCount:Math.max(0,Number(parentSnap.data().replyCount)||0)+1},{merge:true});
    return {id:replyId,duplicate:false};
  });
}
async function fbDeleteAnnouncementReply(usernameRaw,password,announcementId,replyId){
  const {username,passwordHash}=await verifiedSessionHash(usernameRaw,password);
  const parentRef=announcementRef(announcementId);
  const replyRef=announcementReplyRef(announcementId,replyId);
  const now=Date.now();
  return runTransaction(db,async tx=>{
    await assertVerifiedSessionTx(tx,username,passwordHash);
    const [parentSnap,replySnap]=await Promise.all([tx.get(parentRef),tx.get(replyRef)]);
    if(!replySnap.exists()||replySnap.data().deleted)return;
    const owner=canonUsername(replySnap.data().username);
    if(owner!==username&&username!==ANNOUNCEMENT_ADMIN)throw new Error("You can only delete your own replies.");
    tx.set(replyRef,{
      deleted:true,message:"",deletedAt:serverTimestamp(),deletedAtMs:now,deletedBy:username,
    },{merge:true});
    if(parentSnap.exists()){
      tx.set(parentRef,{replyCount:Math.max(0,(Number(parentSnap.data().replyCount)||0)-1)},{merge:true});
    }
  });
}
async function fbLoadMyAnnouncementReactions(usernameRaw,announcementId,replyId=null){
  const username=canonUsername(usernameRaw);
  try{
    const snap=await getDoc(announcementReactionRef(announcementId,replyId,username));
    return snap.exists()&&snap.data().reactions&&typeof snap.data().reactions==="object"
      ? snap.data().reactions:{};
  }catch{return {};}
}
async function fbToggleAnnouncementReaction(usernameRaw,password,announcementId,replyId,emoji){
  if(!ANNOUNCEMENT_REACTIONS.includes(emoji))throw new Error("That reaction isn't available.");
  const {username,passwordHash}=await verifiedSessionHash(usernameRaw,password);
  const targetRef=replyId?announcementReplyRef(announcementId,replyId):announcementRef(announcementId);
  const reactionRef=announcementReactionRef(announcementId,replyId,username);
  const now=Date.now();
  return runTransaction(db,async tx=>{
    await assertVerifiedSessionTx(tx,username,passwordHash);
    const [targetSnap,reactionSnap]=await Promise.all([tx.get(targetRef),tx.get(reactionRef)]);
    if(!targetSnap.exists()||targetSnap.data().deleted||targetSnap.data().status==="deleted")
      throw new Error("That post is no longer available.");
    const reactions=reactionSnap.exists()&&reactionSnap.data().reactions
      ? {...reactionSnap.data().reactions}:{};
    const adding=!reactions[emoji];
    if(adding)reactions[emoji]=true;else delete reactions[emoji];
    const counts={...(targetSnap.data().reactionCounts||{})};
    counts[emoji]=Math.max(0,(Number(counts[emoji])||0)+(adding?1:-1));
    if(!counts[emoji])delete counts[emoji];
    tx.set(targetRef,{reactionCounts:counts},{merge:true});
    if(Object.keys(reactions).length){
      tx.set(reactionRef,{username,reactions,updatedAt:serverTimestamp(),updatedAtMs:now});
    }else tx.delete(reactionRef);
    return {adding,reactions};
  });
}

async function fbPurchaseSkin(usernameRaw,skinId){
  const username=canonUsername(usernameRaw);
  const skin=TREE_SKINS.find(s=>s.id===skinId);
  if(!skin)return {ok:false,reason:"missing"};
  const prefsRef=doc(db,"prefs",username);
  try{
    return await runTransaction(db,async tx=>{
      const snap=await tx.get(prefsRef);
      const prefs=snap.exists()?snap.data():{};
      const owned=Array.isArray(prefs.ownedSkins)&&prefs.ownedSkins.length?prefs.ownedSkins:["default"];
      const coins=typeof prefs.coins==="number"?prefs.coins:0;
      if(owned.includes(skinId))return {ok:false,reason:"owned",coinBalance:coins,ownedSkins:owned};
      if(coins<skin.cost)return {ok:false,reason:"coins",coinBalance:coins,ownedSkins:owned};
      const ownedSkins=[...new Set([...owned,skinId])];
      const coinBalance=coins-skin.cost;
      tx.set(prefsRef,{coins:coinBalance,ownedSkins,activeSkin:skinId},{merge:true});
      return {ok:true,coinBalance,ownedSkins,activeSkin:skinId,skin};
    });
  }catch(e){console.error("Skin purchase error:",e);return {ok:false,reason:"network",error:e.message};}
}

async function fbUpgradeSkin(usernameRaw,skinId,expectedTier=null){
  const username=canonUsername(usernameRaw);
  const skin=TREE_SKINS.find(s=>s.id===skinId);
  if(!skin)return {ok:false,reason:"missing"};
  const prefsRef=doc(db,"prefs",username);
  try{
    return await runTransaction(db,async tx=>{
      const snap=await tx.get(prefsRef);
      const prefs=snap.exists()?snap.data():{};
      const owned=Array.isArray(prefs.ownedSkins)&&prefs.ownedSkins.length?prefs.ownedSkins:["default"];
      const enhancements=prefs.enhancements&&typeof prefs.enhancements==="object"&&!Array.isArray(prefs.enhancements)?prefs.enhancements:{};
      const tier=Math.max(0,Math.min(3,Number(enhancements[skinId])||0));
      const coins=typeof prefs.coins==="number"?prefs.coins:0;
      if(!owned.includes(skinId))return {ok:false,reason:"locked",coinBalance:coins,enhancements};
      if(tier>=3)return {ok:false,reason:"max",coinBalance:coins,enhancements};
      if(expectedTier!==null && tier!==expectedTier)return {ok:false,reason:"stale",coinBalance:coins,enhancements};
      const nextTier=tier+1;
      const cost=enhanceCost(skin,nextTier);
      if(coins<cost)return {ok:false,reason:"coins",coinBalance:coins,enhancements};
      const nextEnhancements={...enhancements,[skinId]:nextTier};
      const coinBalance=coins-cost;
      tx.set(prefsRef,{coins:coinBalance,enhancements:nextEnhancements},{merge:true});
      return {ok:true,coinBalance,enhancements:nextEnhancements,tier:nextTier,cost,skin};
    });
  }catch(e){console.error("Skin enhancement error:",e);return {ok:false,reason:"network",error:e.message};}
}

async function fbPurchaseDecoration(usernameRaw,decorId){
  const username=canonUsername(usernameRaw);
  const decor=DECORATIONS.find(d=>d.id===decorId);
  if(!decor)return {ok:false,reason:"missing"};
  const prefsRef=doc(db,"prefs",username);
  try{
    return await runTransaction(db,async tx=>{
      const snap=await tx.get(prefsRef);
      const prefs=snap.exists()?snap.data():{};
      const decorations=Array.isArray(prefs.decorations)?prefs.decorations:[];
      const coins=typeof prefs.coins==="number"?prefs.coins:0;
      if(decorations.includes(decorId))return {ok:false,reason:"owned",coinBalance:coins,decorations};
      if(coins<decor.cost)return {ok:false,reason:"coins",coinBalance:coins,decorations};
      const nextDecorations=[...new Set([...decorations,decorId])];
      const coinBalance=coins-decor.cost;
      tx.set(prefsRef,{coins:coinBalance,decorations:nextDecorations},{merge:true});
      return {ok:true,coinBalance,decorations:nextDecorations,decor};
    });
  }catch(e){console.error("Decoration purchase error:",e);return {ok:false,reason:"network",error:e.message};}
}

async function fbPurchaseBackground(usernameRaw,backgroundId){
  const username=canonUsername(usernameRaw);
  const background=BACKGROUND_CATALOGUE.find(item=>item.id===backgroundId);
  if(!background)return {ok:false,reason:"missing"};
  const prefsRef=doc(db,"prefs",username);
  try{
    return await runTransaction(db,async tx=>{
      const snap=await tx.get(prefsRef);
      const prefs=snap.exists()?snap.data():{};
      const coins=typeof prefs.coins==="number"?prefs.coins:0;
      // The cost is resolved exclusively from the trusted local catalogue.
      // No UI-supplied price enters this transaction.
      const result=evaluateBackgroundPurchase(backgroundId,prefs.ownedBackgrounds,coins);
      if(!result.ok)return result;
      tx.set(prefsRef,{coins:result.coinBalance,ownedBackgrounds:result.ownedBackgrounds},{merge:true});
      return result;
    });
  }catch(e){
    console.error("Background purchase error:",e);
    return {ok:false,reason:"network",error:e.message};
  }
}

async function fbEquipBackground(usernameRaw,backgroundId){
  const username=canonUsername(usernameRaw);
  const background=BACKGROUND_CATALOGUE.find(item=>item.id===backgroundId);
  if(!background)return {ok:false,reason:"missing"};
  const prefsRef=doc(db,"prefs",username);
  try{
    return await runTransaction(db,async tx=>{
      const snap=await tx.get(prefsRef);
      const prefs=snap.exists()?snap.data():{};
      const ownedBackgrounds=normalizeOwnedBackgrounds(prefs.ownedBackgrounds);
      if(!canEquipBackground(backgroundId,ownedBackgrounds)){
        return {ok:false,reason:"locked",ownedBackgrounds};
      }
      tx.set(prefsRef,{activeBackground:backgroundId},{merge:true});
      return {ok:true,activeBackground:backgroundId,ownedBackgrounds,background};
    });
  }catch(e){
    console.error("Background equip error:",e);
    return {ok:false,reason:"network",error:e.message};
  }
}

async function fbAwardBadges(usernameRaw,eligibleIds){
  const username=canonUsername(usernameRaw);
  const eligible=new Set(Array.isArray(eligibleIds)?eligibleIds:[]);
  const prefsRef=doc(db,"prefs",username);
  try{
    return await runTransaction(db,async tx=>{
      const snap=await tx.get(prefsRef);
      const prefs=snap.exists()?snap.data():{};
      const currentBadges=Array.isArray(prefs.badges)?prefs.badges:[];
      const currentSet=new Set(currentBadges);
      const newlyEarned=BADGES.filter(b=>eligible.has(b.id)&&!currentSet.has(b.id));
      const reward=newlyEarned.reduce((sum,b)=>sum+BADGE_REWARDS[b.tier],0);
      const currentCoins=typeof prefs.coins==="number"?prefs.coins:0;
      if(!newlyEarned.length)return {ok:true,newlyEarned:[],reward:0,badges:currentBadges,coinBalance:currentCoins};
      const badges=[...new Set([...currentBadges,...newlyEarned.map(b=>b.id)])];
      const coinBalance=currentCoins+reward;
      tx.set(prefsRef,{badges,coins:coinBalance},{merge:true});
      return {ok:true,newlyEarned,reward,badges,coinBalance};
    });
  }catch(e){console.error("Badge award error:",e);return {ok:false,error:e.message};}
}

// ── Admin operations ──────────────────────────────────────────────────────────
// The console is shown only after roles/{uid}.admin is verified. Firestore
// rules remain authoritative for each protected write, and actions are logged
// to `adminLog/{admin}` for a lightweight audit trail.
async function fbAdminLog(admin, action, target, detail) {
  try {
    const ref = doc(db, "adminLog", admin);
    const snap = await getDoc(ref);
    const entry = { ts: Date.now(), action, target: target||"", detail: detail||"" };
    if (snap.exists()) await updateDoc(ref, { entries: [...(snap.data().entries||[]), entry].slice(-500) });
    else await setDoc(ref, { entries: [entry] });
  } catch(e) { console.error("adminLog error:", e); }
}

// Read a full snapshot of any user (for the lookup panel).
async function fbAdminInspect(username) {
  try {
    const uname = canonUsername(username);
    const [uSnap, prefs, hist] = await Promise.all([
      getDoc(doc(db, "users", uname)),
      fbLoadPrefs(uname),
      fbLoadHistory(uname),
    ]);
    if (!uSnap.exists()) return { ok:false, error:"No such user" };
    const sessions = Array.isArray(hist) ? hist : [];
    const totalSecs = sessions.reduce((a,s)=>a+(s.secs||0), 0);
    return { ok:true, username:uname,
      coins: (prefs && typeof prefs.coins==="number") ? prefs.coins : 0,
      sessions: sessions.length, totalSecs,
      hasRecovery: !!(uSnap.data().recoveryQuestion),
    };
  } catch(e) { return { ok:false, error:"Lookup failed" }; }
}

// Set a user's coin balance directly (syncs their prefs).
async function fbAdminSetUserCoins(admin, username, coins) {
  const uname = canonUsername(username);
  const uSnap = await getDoc(doc(db, "users", uname));
  if (!uSnap.exists()) return { ok:false, error:"No such user" };
  await fbSavePrefs(uname, { coins });
  fbAdminLog(admin, "setCoins", uname, String(coins));
  return { ok:true };
}

// Apply a signed seconds/sessions/subjects delta to one leaderboard doc.
// Clamps at zero and prunes the user's row entirely if they end up at 0s —
// so an over-correction can never leave negative or ghost entries.
async function fbBoardApplyDelta(ref, username, dSecs, dSessions, dSubjects) {
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    if (dSecs <= 0) return; // nothing to subtract from
    await setDoc(ref, { [username]: { totalSecs: dSecs, sessions: Math.max(1,dSessions), subjects: {...dSubjects} } });
    return;
  }
  const data = snap.data();
  const user = data[username] || { totalSecs: 0, sessions: 0, subjects: {} };
  user.totalSecs = Math.max(0, (user.totalSecs||0) + dSecs);
  user.sessions  = Math.max(0, (user.sessions||0)  + dSessions);
  user.subjects  = { ...(user.subjects||{}) };
  for (const [sid, ds] of Object.entries(dSubjects||{})) {
    const nv = Math.max(0, (user.subjects[sid]||0) + ds);
    if (nv > 0) user.subjects[sid] = nv; else delete user.subjects[sid];
  }
  if (user.totalSecs === 0) delete data[username];
  else data[username] = user;
  await setDoc(ref, { ...data });
}

// Rebuild one canonical leaderboard row from history. This is used inside
// session-edit transactions so history remains the source of truth even when
// an old board still contains casing/Unicode variants of the same username.
function boardWithHistoryRow(data, username, sessions) {
  const next={...(data||{})};
  for(const key of Object.keys(next)){
    if(canonUsername(key)===username)delete next[key];
  }
  if(sessions.length){
    const row={totalSecs:0,sessions:0,subjects:{}};
    for(const s of sessions){
      const secs=Math.max(0,Number(s.secs)||0);
      row.totalSecs+=secs;
      row.sessions+=1;
      row.subjects[s.subject]=(row.subjects[s.subject]||0)+secs;
    }
    next[username]=row;
  }
  return next;
}

// Self-service: a person reduces their OWN over-recorded session (left the
// stopwatch running by accident, etc). REDUCE ONLY — enforced here server-
// side too, never trusting the client, since allowing an increase would be a
// trivial coins/leaderboard exploit. Scoped to the last SESSION_EDIT_WINDOW_
// DAYS so this stays a quick self-correction, not a tool to rewrite already-
// settled leaderboard weeks (the same reasoning myLearners caps how many
// manual driving-log entries a learner can add — self-reported corrections
// need a limit or the log stops meaning anything). Reusing fbBoardApplyDelta
// keeps this on the exact same leaderboard-sync path the admin tools use.
const SESSION_EDIT_WINDOW_DAYS = 7;

async function fbUserEditSession(usernameRaw, sessionTs, requestedSecs) {
  const username = canonUsername(usernameRaw);
  const newSecs = Math.max(0, Math.round(requestedSecs));
  const hRef = doc(db, "history", username);
  if (newSecs > 0 && newSecs < 60) return { ok:false, error:"Reduce to at least 1 minute, or remove the session entirely" };
  try{
    return await runTransaction(db,async tx=>{
      // The session decides which weekly document participates, so read
      // history first, then perform every remaining read before any write.
      const hSnap=await tx.get(hRef);
      if(!hSnap.exists())return {ok:false,error:"No session history found"};
      const sessions=hSnap.data().sessions||[];
      const idx=sessions.findIndex(s=>s.ts===sessionTs);
      if(idx===-1)return {ok:false,error:"Session not found — it may have already been edited"};
      const s=sessions[idx];
      if(s.admin)return {ok:false,error:"This session was set by an admin correction and can't be self-edited"};
      if(Date.now()-s.ts>SESSION_EDIT_WINDOW_DAYS*24*3600*1000)return {ok:false,error:`Sessions can only be edited within ${SESSION_EDIT_WINDOW_DAYS} days`};
      // Ceiling is the CURRENT value, not the original — prevents creeping
      // back up across repeated edits.
      if(newSecs>=s.secs)return {ok:false,error:newSecs===s.secs?"No change":"You can only reduce a session's time, not increase it"};

      const wk=getWeekKeyFor(s.ts);
      const wRef=doc(db,"leaderboard_weekly",wk);
      const aRef=doc(db,"leaderboard_alltime","data");
      const prefsRef=doc(db,"prefs",username);
      const [wSnap,aSnap,prefsSnap]=await Promise.all([tx.get(wRef),tx.get(aRef),tx.get(prefsRef)]);
      const next=[...sessions];
      if(newSecs===0)next.splice(idx,1);
      else next[idx]={...s,secs:newSecs,originalSecs:s.originalSecs??s.secs,edited:true,editedAt:Date.now()};
      const weekSessions=next.filter(x=>getWeekKeyFor(x.ts)===wk);
      const coinsDelta=(Math.floor(newSecs/60)-Math.floor(s.secs/60))*COINS_PER_MIN;
      const prefs=prefsSnap.exists()?prefsSnap.data():{};
      const currentCoins=typeof prefs.coins==="number"?prefs.coins:0;
      const newCoinBalance=Math.max(0,currentCoins+coinsDelta);

      // History, both derived boards and the proportional clawback settle as
      // one unit, so a network interruption cannot leave any surface drifting.
      tx.set(hRef,{sessions:next});
      tx.set(wRef,boardWithHistoryRow(wSnap.exists()?wSnap.data():{},username,weekSessions));
      tx.set(aRef,boardWithHistoryRow(aSnap.exists()?aSnap.data():{},username,next));
      tx.set(prefsRef,{coins:newCoinBalance},{merge:true});
      return {ok:true,removed:newSecs===0,newSecs,coinsDelta,newCoinBalance};
    });
  }catch(e){console.error("Session edit error:",e);return {ok:false,error:"Couldn't save that edit — try again"};}
}

// Grant or remove study time by writing/removing a synthetic history session,
// AND propagate the same delta into the weekly + all-time leaderboard docs.
// The boards are pre-aggregated at session-save time, so history edits alone
// silently desync them — this keeps every derived surface (streaks, garden,
// badges, boards) telling the same story. Negative corrections trim the newest
// sessions first and route each trimmed chunk to the week it was earned in.
async function fbAdminAdjustTime(admin, username, minutes, subjId, forDate) {
  const uname = canonUsername(username);
  const hRef = doc(db, "history", uname);
  const hSnap = await getDoc(hRef);
  let sessions = hSnap.exists() ? (hSnap.data().sessions||[]) : [];
  const secs = Math.round(minutes*60);

  // weekDeltas: { weekKey: { secs, sessions, subjects:{sid:secs} } }
  const weekDeltas = {};
  const bump = (wk, ds, dn, sid) => {
    const w = weekDeltas[wk] || (weekDeltas[wk] = { secs:0, sessions:0, subjects:{} });
    w.secs += ds; w.sessions += dn;
    if (sid) w.subjects[sid] = (w.subjects[sid]||0) + ds;
  };

  if (secs >= 0) {
    // Anchor to the day it actually happened, not the moment of correction —
    // every streak/daily/garden calc buckets by startOfDay(ts), so stamping
    // "now" would misdate the streak AND, if the person studies for real
    // later that same day, double up that day's total with a phantom session.
    // Noon local time keeps it safely inside the intended calendar day
    // regardless of timezone edge cases.
    let ts = Date.now();
    if (forDate) {
      const [y,m,d] = forDate.split("-").map(Number);
      const anchored = new Date(y, m-1, d, 12, 0, 0, 0);
      if (!isNaN(anchored.getTime())) ts = Math.min(anchored.getTime(), Date.now());
    }
    sessions = [...sessions, { subject: subjId||"admin", secs, ts, admin: true }].slice(-2000);
    bump(getWeekKeyFor(ts), secs, 1, subjId||"admin");
  } else {
    // remove |secs| worth from the newest sessions, tracking exactly which
    // week + subject each removed chunk belonged to
    let toRemove = -secs;
    const kept = [];
    for (let i=sessions.length-1; i>=0; i--) {
      const s = sessions[i];
      if (toRemove<=0) { kept.unshift(s); continue; }
      const wk = getWeekKeyFor(s.ts);
      if (s.secs <= toRemove) {
        toRemove -= s.secs;
        bump(wk, -s.secs, -1, s.subject);
      } else {
        kept.unshift({ ...s, secs: s.secs - toRemove });
        bump(wk, -toRemove, 0, s.subject);
        toRemove = 0;
      }
    }
    sessions = kept;
  }
  await setDoc(hRef, { sessions });

  // Propagate into each affected weekly board + the all-time board
  let totalDelta = 0, totalSessDelta = 0; const allSubjDelta = {};
  for (const [wk, d] of Object.entries(weekDeltas)) {
    totalDelta += d.secs; totalSessDelta += d.sessions;
    for (const [sid, ds] of Object.entries(d.subjects)) allSubjDelta[sid]=(allSubjDelta[sid]||0)+ds;
    await fbBoardApplyDelta(doc(db, "leaderboard_weekly", wk), uname, d.secs, d.sessions, d.subjects);
  }
  await fbBoardApplyDelta(doc(db, "leaderboard_alltime", "data"), uname, totalDelta, totalSessDelta, allSubjDelta);

  fbAdminLog(admin, "adjustTime", uname, `${minutes}min${forDate?` (dated ${forDate})`:""} · boards: ${Object.keys(weekDeltas).join(",")||"none"}`);
  return { ok:true, weeks: Object.keys(weekDeltas) };
}

// Wipe a user's session history (resets streak, garden, stats). Destructive.
// Also removes them from every weekly board their sessions touched + the
// all-time board, so no phantom standings survive the wipe.
// Merge a stray case-variant identity (e.g. "Daisy") into the canonical
// lowercase account (e.g. "daisy"). This exists because usernames were, for
// a period, keyed by whatever case was typed at login for `history`/`prefs`/
// leaderboards — only the `users` auth doc was ever properly lowercased —
// so one real person could accidentally fork their sessions, coins, skins,
// and enhancements across two different-cased documents. handleLogin now
// canonicalizes on every future login, but existing forks need a one-time
// merge. Refuses to run unless source/target are case-variants of the SAME
// name, so it can never accidentally combine two different people.
// Scans `history` + `prefs` for any doc whose canonicalized key matches
// `target` but whose exact key differs — i.e. every stray variant of one
// person's identity, found by what it CANONICALIZES to rather than by
// asking an admin to reproduce an exact byte sequence. This matters because
// exact-match lookup is fragile for accented names: even copy-pasting a
// name can carry a different Unicode normalization than whatever's actually
// stored as the Firestore key, depending on the browser/OS in between.
async function fbFindStrayVariants(target) {
  const found = new Set();
  for (const col of ["history", "prefs"]) {
    const snap = await getDocs(collection(db, col));
    snap.forEach(d => { if (d.id !== target && canonUsername(d.id) === target) found.add(d.id); });
  }
  return [...found];
}

async function fbAdminMergeIdentity(admin, sourceRaw, targetRaw) {
  const target = canonUsername(targetRaw);
  const tSnap = await getDoc(doc(db, "users", target));
  if (!tSnap.exists()) return { ok:false, error:`No canonical account "${target}" exists` };

  let source = (sourceRaw||"").trim();
  let autoDetected = false;
  if (source) {
    // Safety guard: whatever was typed/pasted must at least CANONICALIZE to
    // the same target, or this could merge two genuinely different people.
    if (canonUsername(source) !== target) return { ok:false, error:"Source and target must be the same name in different casing" };
    if (source === target) {
      source = ""; // typed value IS the canonical key already — nothing distinct to reference, try auto-detect
    } else {
      // Does that exact string actually exist as a doc? If not, the typed/
      // pasted value carries a different Unicode form than what's really
      // stored — fall through to auto-discovery rather than silently no-op.
      const [sh, sp] = await Promise.all([getDoc(doc(db,"history",source)), getDoc(doc(db,"prefs",source))]);
      if (!sh.exists() && !sp.exists()) source = "";
    }
  }
  if (!source) {
    const candidates = await fbFindStrayVariants(target);
    if (candidates.length === 0) return { ok:false, error:`No stray variant of "${target}" found — nothing to merge` };
    if (candidates.length > 1) return { ok:false, error:`Found ${candidates.length} variants — be specific: ${candidates.join(", ")}` };
    source = candidates[0];
    autoDetected = true;
  }

  // ── History: concatenate real sessions from both, then dedupe on the tiny
  // chance the same navigator wrote the exact same session twice ──
  const [srcH, tgtH] = await Promise.all([getDoc(doc(db,"history",source)), getDoc(doc(db,"history",target))]);
  const srcSessions = srcH.exists() ? (srcH.data().sessions||[]) : [];
  const tgtSessions = tgtH.exists() ? (tgtH.data().sessions||[]) : [];
  if (srcSessions.length===0 && !srcH.exists()) {
    // still might have prefs to merge even with no history — keep going
  }
  const seen = new Set();
  const merged = [...tgtSessions, ...srcSessions]
    .sort((a,b)=>a.ts-b.ts)
    .filter(s => { const k = `${s.ts}|${s.secs}|${s.subject}`; if(seen.has(k)) return false; seen.add(k); return true; })
    .slice(-2000);
  await setDoc(doc(db,"history",target), { sessions: merged });
  if (srcH.exists()) await deleteDoc(doc(db,"history",source));

  // ── Prefs: combine conservatively — never discard earned progress ──
  const [srcP, tgtP] = await Promise.all([getDoc(doc(db,"prefs",source)), getDoc(doc(db,"prefs",target))]);
  if (srcP.exists()) {
    const sp = srcP.data(), tp = tgtP.exists() ? tgtP.data() : {};
    const mergedEnh = { ...(sp.enhancements||{}) };
    for (const [sk,t] of Object.entries(tp.enhancements||{})) mergedEnh[sk] = Math.max(mergedEnh[sk]||0, t);
    const unionArr = (a=[],b=[]) => [...new Set([...(a||[]),...(b||[])])];
    const unionById = (a=[],b=[]) => { const m=new Map(); [...(a||[]),...(b||[])].forEach(x=>m.set(x.id,x)); return [...m.values()]; };
    // Legacy assessments predate stable IDs. Keying those records by their
    // original name/date/subject keeps every old countdown during an account
    // merge instead of collapsing all id-less records into one Map entry.
    const unionAssessments = (a=[],b=[]) => {
      const m=new Map();
      [...(a||[]),...(b||[])].forEach((x,i)=>{
        const key=x?.id||`legacy:${x?.name||""}|${x?.date||""}|${x?.subject||""}|${i}`;
        m.set(key,x);
      });
      return [...m.values()];
    };
    const mergedOwnedBackgrounds=normalizeOwnedBackgrounds(unionArr(sp.ownedBackgrounds,tp.ownedBackgrounds));
    const preferredBackground=normalizeBackgroundId(tp.activeBackground||sp.activeBackground);
    const mergedPrefs = {
      ...sp, ...tp, // target's simple/single-value fields (activeSkin, theme, etc.) win by default
      coins: (sp.coins||0) + (tp.coins||0),
      ownedSkins: unionArr(sp.ownedSkins, tp.ownedSkins),
      ownedBackgrounds: mergedOwnedBackgrounds,
      activeBackground: canEquipBackground(preferredBackground,mergedOwnedBackgrounds)
        ? preferredBackground:DEFAULT_BACKGROUND_ID,
      enhancements: mergedEnh,
      subjects: unionById(sp.subjects, tp.subjects).length ? unionById(sp.subjects, tp.subjects) : (tp.subjects||sp.subjects),
      exams: unionAssessments(sp.exams, tp.exams),
      badges: unionById(sp.badges, tp.badges),
      decorations: unionArr(sp.decorations, tp.decorations),
      targets: { ...(sp.targets||{}), ...(tp.targets||{}) }, // target's per-subject value wins on conflict
    };
    await setDoc(doc(db,"prefs",target), mergedPrefs);
    await deleteDoc(doc(db,"prefs",source));
  }

  // ── Leaderboards: recompute target's row from the MERGED history for every
  // week the stray identity touched (not delta arithmetic on old numbers —
  // this guarantees the history-total === board-total invariant regardless
  // of whatever drift existed before) ──
  const weeks = [...new Set(srcSessions.map(s=>getWeekKeyFor(s.ts)))];
  const sumFor = (list) => {
    const out = { totalSecs:0, sessions:0, subjects:{} };
    for (const s of list) {
      out.totalSecs += s.secs; out.sessions += 1;
      out.subjects[s.subject] = (out.subjects[s.subject]||0) + s.secs;
    }
    return out;
  };
  for (const wk of weeks) {
    const ref = doc(db, "leaderboard_weekly", wk);
    const snap = await getDoc(ref);
    const data = snap.exists() ? { ...snap.data() } : {};
    delete data[source];
    const weekSessions = merged.filter(s=>getWeekKeyFor(s.ts)===wk);
    if (weekSessions.length) data[target] = sumFor(weekSessions);
    await setDoc(ref, data);
  }
  const aRef = doc(db, "leaderboard_alltime", "data");
  const aSnap = await getDoc(aRef);
  const aData = aSnap.exists() ? { ...aSnap.data() } : {};
  delete aData[source];
  if (merged.length) aData[target] = sumFor(merged);
  await setDoc(aRef, aData);

  fbAdminLog(admin, "mergeIdentity", target, `merged "${source}"${autoDetected?" (auto-detected)":""} → "${target}" · ${merged.length} sessions · ${weeks.length} weeks`);
  return { ok:true, source, autoDetected, sessions: merged.length, weeks: weeks.length, coinsGained: srcP.exists() ? (srcP.data().coins||0) : 0 };
}

// Admin-only: edit or delete ANY specific session for ANY user, in either
// direction, at any age — including sessions the admin previously added via
// "Adjust study time" (e.g. fixing a fat-fingered correction). Deliberately
// more permissive than the self-service My Sessions tool, which is reduce-
// only and time-windowed for good reason on a person's own account — an
// admin fixing a real mistake needs full control, not those guardrails.
//
// Coins only move for genuine, user-recorded sessions (s.admin is falsy).
// Synthetic admin-added sessions never granted coins in the first place —
// that's deliberately what "Set coins" is for, kept separate — so editing
// one shouldn't suddenly start touching currency as a side effect; that
// would be a surprising, inconsistent rule depending on which tool made it.
const ADMIN_SESSION_MAX_SECS = 16*3600; // sanity rail against a typo, not a hard product rule

async function fbAdminEditSession(admin, usernameRaw, sessionTs, requestedSecs) {
  const username = canonUsername(usernameRaw);
  const newSecs = Math.max(0, Math.round(requestedSecs));
  if (newSecs > ADMIN_SESSION_MAX_SECS) return { ok:false, error:`That's over ${ADMIN_SESSION_MAX_SECS/3600}h for one session — double check the value` };
  const hRef = doc(db, "history", username);
  if (newSecs > 0 && newSecs < 60) return { ok:false, error:"Reduce to at least 1 minute, or remove the session entirely" };
  try{
    const result=await runTransaction(db,async tx=>{
      const hSnap=await tx.get(hRef);
      if(!hSnap.exists())return {ok:false,error:"No session history found"};
      const sessions=hSnap.data().sessions||[];
      const idx=sessions.findIndex(s=>s.ts===sessionTs);
      if(idx===-1)return {ok:false,error:"Session not found — it may have already been edited"};
      const s=sessions[idx];
      if(newSecs===s.secs)return {ok:false,error:"No change"};

      const wk=getWeekKeyFor(s.ts);
      const wRef=doc(db,"leaderboard_weekly",wk);
      const aRef=doc(db,"leaderboard_alltime","data");
      const prefsRef=doc(db,"prefs",username);
      const [wSnap,aSnap,prefsSnap]=await Promise.all([tx.get(wRef),tx.get(aRef),tx.get(prefsRef)]);
      const next=[...sessions];
      if(newSecs===0)next.splice(idx,1);
      else next[idx]={...s,secs:newSecs,originalSecs:s.originalSecs??s.secs,edited:true,editedAt:Date.now(),editedBy:admin};
      const weekSessions=next.filter(x=>getWeekKeyFor(x.ts)===wk);
      const coinsDelta=s.admin?0:(Math.floor(newSecs/60)-Math.floor(s.secs/60))*COINS_PER_MIN;
      const prefs=prefsSnap.exists()?prefsSnap.data():{};
      const currentCoins=typeof prefs.coins==="number"?prefs.coins:0;
      const coinBalance=Math.max(0,currentCoins+coinsDelta);

      tx.set(hRef,{sessions:next});
      tx.set(wRef,boardWithHistoryRow(wSnap.exists()?wSnap.data():{},username,weekSessions));
      tx.set(aRef,boardWithHistoryRow(aSnap.exists()?aSnap.data():{},username,next));
      if(!s.admin&&coinsDelta!==0)tx.set(prefsRef,{coins:coinBalance},{merge:true});
      return {ok:true,removed:newSecs===0,newSecs,coinsDelta,newCoinBalance:s.admin?null:coinBalance,wasAdminSession:!!s.admin,oldSecs:s.secs};
    });
    if(result.ok)fbAdminLog(admin,"editSession",username,`${result.oldSecs}s → ${newSecs}s${result.wasAdminSession?" (was an admin entry)":""}`);
    return result;
  }catch(e){console.error("Admin session edit error:",e);return {ok:false,error:"Couldn't save that edit — try again"};}
}

// Rebuilds a user's ENTIRE leaderboard footprint (every week they've ever
// touched, plus all-time) directly from their history — the established
// source of truth throughout this app. Exists to repair damage from the
// stale-weekKey bug (a page that stayed open across a week boundary could
// silently write sessions to the wrong week's board while history stayed
// correct) and any other drift, whatever caused it. Unlike a delta-based
// correction, this doesn't trust the board's current numbers AT ALL — it
// scans for every week the board currently has a row for this user (which
// catches phantom rows from a wrong-week write too) and either overwrites
// it with the true value computed from history, or deletes it if history
// says they had nothing that week.
async function fbAdminResyncLeaderboard(admin, usernameRaw) {
  const username = canonUsername(usernameRaw);
  const hSnap = await getDoc(doc(db, "history", username));
  const sessions = hSnap.exists() ? (hSnap.data().sessions||[]) : [];

  const sumFor = (list) => {
    const out = { totalSecs:0, sessions:0, subjects:{} };
    for (const s of list) {
      out.totalSecs += s.secs; out.sessions += 1;
      out.subjects[s.subject] = (out.subjects[s.subject]||0) + s.secs;
    }
    return out;
  };

  // Correct truth, grouped by week, straight from history
  const byWeek = {};
  for (const s of sessions) {
    const wk = getWeekKeyFor(s.ts);
    (byWeek[wk] ||= []).push(s);
  }
  const correctWeeks = {};
  for (const [wk, list] of Object.entries(byWeek)) correctWeeks[wk] = sumFor(list);

  // Weeks that currently have ANY row for this user — including phantom ones
  // from a wrong-week write that history says shouldn't exist at all
  const wSnap = await getDocs(collection(db, "leaderboard_weekly"));
  const existingWeeksWithRow = [];
  wSnap.forEach(d => { if (d.data()[username]) existingWeeksWithRow.push(d.id); });

  const weeksToFix = [...new Set([...Object.keys(correctWeeks), ...existingWeeksWithRow])];
  let fixed = 0, removed = 0;
  for (const wk of weeksToFix) {
    const ref = doc(db, "leaderboard_weekly", wk);
    const snap = await getDoc(ref);
    const data = snap.exists() ? { ...snap.data() } : {};
    const correct = correctWeeks[wk];
    const before = JSON.stringify(data[username]||null);
    const hadRow = !!data[username];
    if (correct) { data[username] = correct; fixed++; }
    else { delete data[username]; if (hadRow) removed++; }
    if (JSON.stringify(data[username]||null) !== before) await setDoc(ref, data);
  }

  // All-time: same principle, one document
  const aRef = doc(db, "leaderboard_alltime", "data");
  const aSnap = await getDoc(aRef);
  const aData = aSnap.exists() ? { ...aSnap.data() } : {};
  const correctAllTime = sumFor(sessions);
  if (correctAllTime.totalSecs > 0) aData[username] = correctAllTime; else delete aData[username];
  await setDoc(aRef, aData);

  fbAdminLog(admin, "resyncLeaderboard", username, `${fixed} weeks corrected, ${removed} phantom rows removed`);
  return { ok:true, weeksChecked: weeksToFix.length, weeksFixed: fixed, phantomRowsRemoved: removed, trueTotalSecs: correctAllTime.totalSecs };
}

async function fbAdminResetHistory(admin, username) {
  const uname = canonUsername(username);
  const uSnap = await getDoc(doc(db, "users", uname));
  if (!uSnap.exists()) return { ok:false, error:"No such user" };
  const hSnap = await getDoc(doc(db, "history", uname));
  const sessions = hSnap.exists() ? (hSnap.data().sessions||[]) : [];
  const weeks = [...new Set(sessions.map(s=>getWeekKeyFor(s.ts)))];
  await setDoc(doc(db, "history", uname), { sessions: [] });
  const scrub = async ref => {
    const snap = await getDoc(ref);
    if (snap.exists() && snap.data()[uname]) {
      const data = { ...snap.data() }; delete data[uname];
      await setDoc(ref, data);
    }
  };
  for (const wk of weeks) await scrub(doc(db, "leaderboard_weekly", wk));
  await scrub(doc(db, "leaderboard_alltime", "data"));
  fbAdminLog(admin, "resetHistory", uname, `boards scrubbed: ${weeks.length} weeks`);
  return { ok:true };
}

// ── AnimatedNumber ────────────────────────────────────────────────────────────
// Smoothly tweens between values (rAF, ease-out cubic) so coin balances and
// Horizontal-scroll rows (filter chips, subject pills, …) are unreachable on
// desktop with a plain mouse wheel — only trackpads send a horizontal delta
// natively. This hook gives two independent ways in: (1) vertical wheel
// input is translated to horizontal scroll, normalized for deltaMode since
// a lot of Windows mice report tiny "line" units (~3) that would barely
// move the row even though the math is right; and (2) click-and-drag
// panning, which doesn't depend on wheel behavior at all — so it still
// works if a particular mouse/browser combination sends odd deltas. Also
// tracks whether either edge still has more content, so callers can show a
// fade hint. `wheel` must be attached as a native (non-passive) listener —
// React's synthetic onWheel is passive by default, so preventDefault() would
// silently no-op there.
function useHScroll(contentKey="") {
  const ref = useRef(null);
  const [edge, setEdge] = useState({ atStart:true, atEnd:true });
  const scrollBy = useCallback((amount) => {
    const el = ref.current;
    if(!el) return;
    el.scrollBy({ left:amount, behavior:"smooth" });
  }, []);
  useEffect(() => {
    const el = ref.current;
    if(!el) return;
    const update = () => {
      setEdge({
        atStart: el.scrollLeft <= 2,
        atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
      });
    };
    const onWheel = (e) => {
      if(el.scrollWidth <= el.clientWidth) return; // nothing to scroll
      if(Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // already a horizontal gesture — let the browser handle it
      e.preventDefault();
      // deltaMode: 0 = pixels, 1 = lines (~3 per notch on many Windows
      // setups — imperceptible if used raw), 2 = pages.
      const unit = e.deltaMode === 1 ? 22 : e.deltaMode === 2 ? el.clientWidth*0.9 : 1;
      el.scrollLeft += e.deltaY * unit;
    };
    // Click-and-drag panning. Only counts as a "drag" past a small
    // threshold, so ordinary clicks on the chips/pills inside still work —
    // we swallow the click that follows a real drag so it doesn't also
    // fire whatever button happened to be under the cursor on release.
    let dragging = false, moved = false, startX = 0, startScroll = 0;
    const onDown = (e) => {
      if(el.scrollWidth <= el.clientWidth) return;
      dragging = true; moved = false;
      startX = e.clientX; startScroll = el.scrollLeft;
    };
    const onMove = (e) => {
      if(!dragging) return;
      const dx = e.clientX - startX;
      if(Math.abs(dx) > 3){ moved = true; el.style.cursor = "grabbing"; }
      el.scrollLeft = startScroll - dx;
    };
    const onUp = () => { dragging = false; el.style.cursor = "grab"; };
    const onClickCapture = (e) => { if(moved){ e.stopPropagation(); e.preventDefault(); moved = false; } };

    // Subject presets are loaded from Firestore after the first render. The old
    // version measured the initial two pills only, then never noticed that the
    // row had become wider. Resize + mutation observers keep the edge state in
    // sync whenever subjects, labels or buttons change.
    let resizeObserver = null;
    let mutationObserver = null;
    const observeChildren = () => {
      if(!resizeObserver) return;
      Array.from(el.children).forEach(child=>resizeObserver.observe(child));
    };
    if(typeof ResizeObserver !== "undefined"){
      resizeObserver = new ResizeObserver(update);
      resizeObserver.observe(el);
      observeChildren();
    }
    if(typeof MutationObserver !== "undefined"){
      mutationObserver = new MutationObserver(()=>{ observeChildren(); update(); });
      mutationObserver.observe(el,{childList:true,subtree:true,characterData:true});
    }

    update();
    const raf = requestAnimationFrame(update);
    el.addEventListener("wheel", onWheel, { passive:false });
    el.addEventListener("scroll", update, { passive:true });
    el.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    el.addEventListener("click", onClickCapture, true);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("scroll", update);
      el.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      el.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("resize", update);
    };
  }, [contentKey]);
  return [ref, edge, scrollBy];
}

function AnimatedNumber({ value, prefix="", suffix="", duration=550 }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef(null);
  useEffect(()=>{
    const from = fromRef.current;
    if (from === value) return;
    if (document.documentElement.getAttribute("data-animation-disabled")==="true") {
      fromRef.current = value; setDisplay(value); return;
    }
    const start = performance.now();
    cancelAnimationFrame(rafRef.current);
    const step = now => {
      const t = Math.min(1, (now-start)/duration);
      const eased = 1 - Math.pow(1-t, 3);
      const v = Math.round(from + (value-from)*eased);
      setDisplay(v);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else fromRef.current = value;
    };
    rafRef.current = requestAnimationFrame(step);
    return ()=>cancelAnimationFrame(rafRef.current);
  },[value,duration]);
  return <span>{prefix}{display}{suffix}</span>;
}

// ── Flagship premium skin details ────────────────────────────────────────────
// One lightweight SVG layer is reused by the focus tree, shop previews and the
// permanent garden. `layer="back"` draws ambience behind the canopy while the
// front layer draws the tier-specific ornaments. All coordinates scale from the
// tree's existing canopy radius, so the premium skins keep the same footprint.
const sgDiamondPath = (x,y,rx,ry) => `M${x} ${y-ry} L${x+rx} ${y} L${x} ${y+ry} L${x-rx} ${y} Z`;
const sgStarPath = (x,y,r) => `M${x} ${y-r} L${x+r*0.28} ${y-r*0.28} L${x+r} ${y} L${x+r*0.28} ${y+r*0.28} L${x} ${y+r} L${x-r*0.28} ${y+r*0.28} L${x-r} ${y} L${x-r*0.28} ${y-r*0.28} Z`;

function LionDanceTreeDetails({cx,baseY,canopyY,r,tier=0,paused=false,layer="front",seed=0}){
  const t=Math.max(1,Math.min(3,Number(tier)||1)), animated=!paused, sw=Math.max(.65,r*.05);
  const pulse=(dur,begin="0s")=>animated?<animate attributeName="opacity" values="0;0;.9;.25;0" keyTimes="0;.65;.7;.82;1" dur={dur} begin={begin} repeatCount="indefinite"/>:null;
  if(layer==="back") return <g pointerEvents="none">
    <ellipse cx={cx} cy={canopyY+r*.08} rx={r*1.38} ry={r*1.06} fill="#F3A13C" opacity=".13"/>
    <ellipse cx={cx} cy={baseY+r*.03} rx={r*1.12} ry={r*.27} fill="#6E2730" opacity=".95"/>
    <ellipse cx={cx} cy={baseY-r*.01} rx={r*.98} ry={r*.2} fill="#B9363F" stroke="#E7BE53" strokeWidth={sw*.7}/>
    {t>=2&&[-1,1].map(side=><g key={side}>
      <path d={`M${cx+side*r*.48} ${baseY-r*.08} L${cx+side*r*.38} ${baseY-r*.98}`} stroke="#7A4328" strokeWidth={r*.13} strokeLinecap="round"/>
      <path d={`M${cx+side*r*.48} ${baseY-r*.1} L${cx+side*r*.38} ${baseY-r*.98}`} stroke="#D43D43" strokeWidth={r*.065} strokeDasharray={`${r*.12} ${r*.07}`}/>
      <rect x={cx+side*r*.58-r*.12} y={baseY-r*.28} width={r*.24} height={r*.17} rx={r*.035} fill="#C89B48" stroke="#F0D278" strokeWidth={sw*.5}/>
    </g>)}
    {t>=3&&<>
      {[-1,1].map((side,i)=><g key={`fc${side}`} transform={`translate(${cx+side*r*1.12},${canopyY-r*.7}) rotate(${side*8})`}>
        <path d={`M0 0 q${side*r*.1} ${r*.3} 0 ${r*.72}`} stroke="#E8BC4C" strokeWidth={sw*.7} fill="none"/>
        {Array.from({length:5}).map((_,j)=><rect key={j} x={side*(j%2?r*.025:-r*.075)} y={r*(.08+j*.12)} width={r*.1} height={r*.16} rx={r*.02} fill={j%2?"#D53B3E":"#B92835"} stroke="#F2CA5C" strokeWidth={sw*.28}/>)}
        <g opacity="0">{pulse(`${8+i*1.3}s`,`${-2-i}s`)}
          {[[0,0],[.16,-.08],[-.15,-.03]].map(([dx,dy],j)=><path key={j} d={sgStarPath(dx*r,(.7+dy)*r,r*(.08+j*.015))} fill={j?"#F4C957":"#FFF0B0"}/>)}
          <circle cy={r*.72} r={r*.18} fill="#E9E2D0" opacity=".22"/>
        </g>
      </g>)}
      <path d={`M${cx-r*1.02} ${baseY} Q${cx} ${baseY-r*.42} ${cx+r*1.02} ${baseY}`} fill="none" stroke="#F0CD70" strokeWidth={sw*.65} strokeDasharray={`${r*.12} ${r*.09}`}/>
    </>}
  </g>;
  return <g pointerEvents="none">
    <g className="sg-lion-idle" style={{transformOrigin:`${cx}px ${baseY}px`}}>
      {/* Broad Southern lion-dance forehead; the face replaces the canopy. */}
      <path d={`M${cx-r*.94} ${canopyY+r*.25} Q${cx-r*.98} ${canopyY-r*.48} ${cx-r*.44} ${canopyY-r*.78} Q${cx} ${canopyY-r*1.08} ${cx+r*.44} ${canopyY-r*.78} Q${cx+r*.98} ${canopyY-r*.48} ${cx+r*.94} ${canopyY+r*.25} Q${cx} ${canopyY+r*.7} ${cx-r*.94} ${canopyY+r*.25} Z`} fill="#B92F3B" stroke="#6D2630" strokeWidth={sw*1.2}/>
      <path d={`M${cx-r*.72} ${canopyY-r*.42} Q${cx} ${canopyY-r*.95} ${cx+r*.72} ${canopyY-r*.42} L${cx+r*.54} ${canopyY-r*.06} Q${cx} ${canopyY-r*.43} ${cx-r*.54} ${canopyY-r*.06} Z`} fill="#F1D083" stroke="#D7A93A" strokeWidth={sw*.7}/>
      <path d={`M${cx-r*.56} ${canopyY-r*.51} Q${cx-r*.31} ${canopyY-r*.72} ${cx-r*.07} ${canopyY-r*.48} M${cx+r*.56} ${canopyY-r*.51} Q${cx+r*.31} ${canopyY-r*.72} ${cx+r*.07} ${canopyY-r*.48}`} fill="none" stroke="#206D59" strokeWidth={r*.1} strokeLinecap="round"/>
      <g transform={`translate(${cx},${canopyY-r*.7})`}><path d={sgDiamondPath(0,0,r*.18,r*.22)} fill="#76B99A" stroke="#F7E4A0" strokeWidth={sw*.7}/><circle r={r*.07} fill="#FFF3C0"/></g>
      {[-1,1].map(side=><g key={`eye${side}`} transform={`translate(${cx+side*r*.38},${canopyY-r*.16})`}>
        <circle r={r*.27} fill="#F6E8C5" stroke="#E1B64B" strokeWidth={sw*1.15}/><circle r={r*.17} fill="#FFFFFF"/>
        <g className="sg-lion-blink" style={{transformOrigin:"center"}}><circle cx={side*r*.025} r={r*.085} fill="#202C2B"/><circle cx={side*r*.052} cy={-r*.035} r={r*.025} fill="#fff"/></g>
        <path d={`M${-side*r*.22} ${-r*.21} Q0 ${-r*.37} ${side*r*.22} ${-r*.18}`} fill="none" stroke="#F0CB65" strokeWidth={r*.075} strokeLinecap="round"/>
      </g>)}
      <path d={`M${cx-r*.26} ${canopyY+r*.12} Q${cx} ${canopyY-r*.02} ${cx+r*.26} ${canopyY+r*.12} Q${cx} ${canopyY+r*.34} ${cx-r*.26} ${canopyY+r*.12} Z`} fill="#D99A52" stroke="#73352F" strokeWidth={sw*.75}/>
      <circle cx={cx-r*.1} cy={canopyY+r*.13} r={r*.03} fill="#6D302C"/><circle cx={cx+r*.1} cy={canopyY+r*.13} r={r*.03} fill="#6D302C"/>
      <path d={`M${cx-r*.58} ${canopyY+r*.27} Q${cx} ${canopyY+r*.58} ${cx+r*.58} ${canopyY+r*.27} Q${cx} ${canopyY+r*.82} ${cx-r*.58} ${canopyY+r*.27} Z`} fill="#F4E7C8" stroke="#7D2930" strokeWidth={sw}/>
      <path d={`M${cx-r*.38} ${canopyY+r*.39} Q${cx} ${canopyY+r*.56} ${cx+r*.38} ${canopyY+r*.39}`} fill="none" stroke="#D94346" strokeWidth={r*.09} strokeLinecap="round"/>
      {[-.78,-.63,.63,.78].map((dx,i)=><circle key={dx} cx={cx+dx*r} cy={canopyY+r*(.2+(i%2)*.16)} r={r*.13} fill="#F3E6C8" stroke="#D9B762" strokeWidth={sw*.45}/>)}
      <path d={`M${cx-r*.14} ${canopyY+r*.7} Q${cx-r*.22} ${baseY-r*.65} ${cx-r*.2} ${baseY-r*.08} M${cx+r*.14} ${canopyY+r*.7} Q${cx+r*.22} ${baseY-r*.65} ${cx+r*.2} ${baseY-r*.08}`} stroke="#704329" strokeWidth={r*.14} fill="none" strokeLinecap="round"/>
      {t>=2&&<>
        {[-1,1].map((side,i)=><g key={`lan${side}`} className="sg-lion-sway" style={{transformOrigin:`${cx+side*r*.73}px ${canopyY+r*.15}px`,animationDelay:`${i*.7}s`}}><path d={`M${cx+side*r*.73} ${canopyY+r*.08} v${r*.24}`} stroke="#E5B749" strokeWidth={sw*.65}/><rect x={cx+side*r*.73-r*.1} y={canopyY+r*.3} width={r*.2} height={r*.25} rx={r*.05} fill="#D43A42" stroke="#F0CD69" strokeWidth={sw*.45}/><path d={`M${cx+side*r*.73} ${canopyY+r*.55} v${r*.2}`} stroke="#E6B84A" strokeWidth={sw*.55}/></g>)}
        <circle cx={cx} cy={baseY-r*.08} r={r*.18} fill="#A92D36" stroke="#E7C060" strokeWidth={sw*.8}/><circle cx={cx} cy={baseY-r*.08} r={r*.09} fill="#F1D386"/>
      </>}
      {t>=3&&[-.82,-.4,.43,.83].map((dx,i)=><path key={i} d={sgStarPath(cx+dx*r,canopyY+r*(-.8+(i%2)*1.25),r*.055)} fill="#F8D66B" opacity=".75"/>)}
    </g>
  </g>;
}

function LightningTreeDetails({cx,baseY,canopyY,r,trunkH,tier=0,paused=false,layer="front",seed=0}){
  const t=Math.max(1,Math.min(3,Number(tier)||1)), animated=!paused, sw=Math.max(.6,r*.047);
  if(layer==="back") return <g pointerEvents="none">
    <ellipse cx={cx} cy={canopyY} rx={r*1.32} ry={r*.95} fill="#5C63C9" opacity=".12"/>
    <ellipse cx={cx} cy={baseY+r*.02} rx={r*(.85+t*.1)} ry={r*(.2+t*.025)} fill="#6BBFFF" opacity=".16" stroke="#8DD8FF" strokeWidth={sw*.5}/>
    {t>=2&&[[-.68,-.5],[.55,-.62],[.12,-.92]].map(([dx,dy],i)=><g key={i} transform={`translate(${cx+dx*r},${canopyY+dy*r})`}><ellipse rx={r*.34} ry={r*.16} fill={i%2?"#444B86":"#373D72"}/><circle cx={-r*.14} cy={-r*.07} r={r*.13} fill="#535A96"/><circle cx={r*.12} cy={-r*.08} r={r*.15} fill="#4B528D"/></g>)}
    {t>=3&&<path d={`M${cx-r*1.05} ${canopyY-r*.45} l${r*.22} ${r*.22} l${-r*.16} ${r*.3} M${cx+r*.95} ${canopyY-r*.55} l${-r*.18} ${r*.25} l${r*.13} ${r*.24}`} stroke="#D7F4FF" strokeWidth={sw} fill="none" opacity=".7" className={animated?"sg-storm-arc":""}/>}
  </g>;
  return <g pointerEvents="none">
    <path d={`M${cx-r*.16} ${baseY} Q${cx-r*.35} ${baseY-trunkH*.35} ${cx-r*.06} ${baseY-trunkH*.56} Q${cx+r*.28} ${baseY-trunkH*.76} ${cx+r*.08} ${baseY-trunkH}`} stroke="#24263A" strokeWidth={r*.3} fill="none" strokeLinecap="round"/>
    <path d={`M${cx-r*.02} ${baseY-r*.04} l${r*.11} -${r*.35} l-${r*.12} -${r*.22} l${r*.13} -${r*.36}`} stroke="#70C9FF" strokeWidth={sw*1.15} fill="none" strokeLinecap="round" className={animated?"sg-energy-pulse":""}/>
    <circle cx={cx+r*.02} cy={baseY-trunkH*.52} r={r*(.1+t*.018)} fill="#9CE1FF" stroke="#E8FAFF" strokeWidth={sw*.65} opacity=".9"/>
    {[-.7,-.36,.34,.72].map((dx,i)=><path key={i} d={`M${cx+dx*r} ${baseY} Q${cx+dx*r*.55} ${baseY-r*.18} ${cx+dx*r*.42} ${baseY-r*.38}`} stroke={i%2?"#6673E7":"#69C8FF"} strokeWidth={sw*(.7+(i%2)*.2)} fill="none" opacity=".82"/>)}
    {t>=2&&<>
      {[-.78,.78].map((dx,i)=><g key={dx} transform={`translate(${cx+dx*r},${baseY-r*.04})`}><path d={sgDiamondPath(0,-r*.13,r*.12,r*.2)} fill="#4B527B" stroke="#8998D7" strokeWidth={sw*.55}/><path d={`M${-r*.04} -${r*.2} l${r*.08} ${r*.08} l-${r*.07} ${r*.09}`} stroke="#9ADFFF" strokeWidth={sw*.6} fill="none"/></g>)}
      {[[-.88,-.62],[.82,-.46],[.16,-1.02]].map(([dx,dy],i)=><circle key={i} cx={cx+dx*r} cy={canopyY+dy*r} r={r*(.055+i*.008)} fill="#A7E5FF" opacity=".85" className={animated?"sg-storm-orb":""} style={{animationDelay:`${-i*1.2}s`}}/>)}
    </>}
    {t>=3&&<>
      {[-.52,0,.52].map((dx,i)=><path key={i} d={sgDiamondPath(cx+dx*r,canopyY-r*(.9+(i%2)*.17),r*.09,r*.16)} fill="#8CA5FF" stroke="#DDF7FF" strokeWidth={sw*.45} className={animated?"sg-storm-float":""} style={{animationDelay:`${-i*.8}s`}}/>)}
      <circle cx={cx} cy={baseY-r*.03} r={r*.7} fill="none" stroke="#8397ED" strokeWidth={sw*.6} strokeDasharray={`${r*.1} ${r*.09}`} opacity=".65"/>
    </>}
  </g>;
}

function ClassicTreeDetails({skinId,cx,baseY,canopyY,r,tier=0}){
  if(!["cherry","autumn","copperbeech"].includes(skinId))return null;
  if(skinId==="cherry")return <g pointerEvents="none">
    <ellipse cx={cx} cy={baseY+r*.01} rx={r*.72} ry={r*.16} fill="#F4CFD9" opacity=".3"/>
    {[-.7,-.36,.34,.7].map((dx,i)=><g key={i} transform={`translate(${cx+dx*r},${canopyY-r*(.25+(i%2)*.22)})`}><circle r={r*.075} fill="#FFF2F6"/><circle r={r*.025} fill="#D76D92"/></g>)}
    {tier>=2&&<path d={`M${cx-r*.9} ${baseY} Q${cx} ${baseY-r*.28} ${cx+r*.9} ${baseY}`} fill="none" stroke="#D7B9B1" strokeWidth={r*.08} strokeDasharray={`${r*.12} ${r*.08}`}/>}
  </g>;
  if(skinId==="autumn")return <g pointerEvents="none">
    <path d={`M${cx-r*.7} ${baseY} Q${cx} ${baseY-r*.25} ${cx+r*.7} ${baseY}`} fill="#C88643" opacity=".22"/>
    {[[-.62,-.35,"#F2B84B"],[.58,-.28,"#B94B31"],[-.08,-.78,"#E77A32"]].map(([dx,dy,fill],i)=><path key={i} d={`M${cx+dx*r} ${canopyY+dy*r} q${r*.1} -${r*.1} ${r*.2} 0 q-${r*.1} ${r*.16} -${r*.2} 0`} fill={fill}/>)}
    {tier>=2&&<g><ellipse cx={cx-r*.6} cy={baseY} rx={r*.2} ry={r*.06} fill="#D9913E"/><ellipse cx={cx+r*.52} cy={baseY} rx={r*.25} ry={r*.07} fill="#C76635"/></g>}
  </g>;
  return <g pointerEvents="none">
    <path d={`M${cx-r*.75} ${baseY} Q${cx} ${baseY-r*.3} ${cx+r*.75} ${baseY}`} fill="#8D5938" opacity=".2"/>
    {[-.55,-.18,.2,.57].map((dx,i)=><path key={i} d={sgDiamondPath(cx+dx*r,canopyY-r*(.32+(i%2)*.35),r*.07,r*.12)} fill={i%2?"#D89643":"#F0BC64"} opacity=".9"/>)}
    {tier>=2&&<path d={`M${cx-r*.55} ${baseY-r*.03} Q${cx-r*.2} ${baseY-r*.4} ${cx-r*.12} ${baseY-r*.72}`} stroke="#A86A39" strokeWidth={r*.055} fill="none"/>}
  </g>;
}

// A static finishing pass shared by previews and planted groves. It gives the
// full catalogue the same soft, layered collectible material language without
// adding animation timelines or per-tree filters.
function CollectibleTreeFinish({skinId,shape,cx,baseY,canopyY,r,canopyColor,trunkColor}){
  const food=["muffin","cupcake","cake"].includes(shape);
  const sparse=["palm","banana","bamboo"].includes(shape);
  const ground=skinId==="lightning"?"#6675A8":skinId==="frostedpine"?"#CFE8E3":shade(canopyColor,-.08);
  if(food)return <g pointerEvents="none">
    <ellipse cx={cx-r*.2} cy={canopyY-r*.58} rx={r*.13} ry={r*.07} fill="#fff" opacity=".28"/>
    <path d={`M${cx-r*.52} ${baseY-r*.08} Q${cx} ${baseY+r*.03} ${cx+r*.52} ${baseY-r*.08}`} stroke="#fff" strokeWidth={Math.max(.55,r*.035)} fill="none" opacity=".22"/>
  </g>;
  return <g pointerEvents="none">
    <ellipse cx={cx} cy={baseY+r*.025} rx={r*(sparse ? .7 : .88)} ry={r*.16} fill={ground} opacity=".2"/>
    {!sparse&&<>
      <ellipse cx={cx} cy={canopyY+r*.22} rx={r*.72} ry={r*.25} fill={shade(canopyColor,-.3)} opacity=".12"/>
      <ellipse cx={cx-r*.32} cy={canopyY-r*.48} rx={r*.25} ry={r*.13} fill="#fff" opacity=".16" transform={`rotate(-24 ${cx-r*.32} ${canopyY-r*.48})`}/>
      {[[-.62,-.2],[.58,-.36],[.12,-.77]].map(([dx,dy],i)=><path key={i}
        d={sgDiamondPath(cx+dx*r,canopyY+dy*r,r*.038,r*.075)} fill={i===1?shade(canopyColor,.32):shade(canopyColor,-.2)} opacity=".55" transform={`rotate(${i%2?28:-28} ${cx+dx*r} ${canopyY+dy*r})`}/>)}
    </>}
    {!food&&<path d={`M${cx-r*.08} ${baseY-r*.05} Q${cx-r*.03} ${baseY-r*.42} ${cx+r*.04} ${baseY-r*.72}`} stroke={shade(trunkColor,.35)} strokeWidth={Math.max(.5,r*.035)} fill="none" opacity=".36" strokeLinecap="round"/>}
  </g>;
}

// Small theme-specific finishing details shared by the hero/shop tree and every
// planted grove. These stay static at base level; tiers add only a few coherent
// props so small garden trees remain readable rather than becoming cluttered.
function TreeThemeDetails({skinId,shape,cx,baseY,canopyY,r,tier=0}){
  const sw=Math.max(.5,r*.035);
  if(["neon","galaxy","enchanted","moonlit","starlight","celestial","rainbow","lightning",
    "moontree","dragontree","kingsoak","diamondtree","liontree","cherry","autumn","copperbeech"].includes(skinId))return null;
  if(skinId==="default")return <g pointerEvents="none">
    {tier>=1&&[-.42,.46].map((dx,i)=><g key={dx} transform={`translate(${cx+dx*r},${baseY-r*(.04+i*.02)})`}>
      <ellipse cy={r*.045} rx={r*.075} ry={r*.095} fill="#8A5D33"/>
      <path d={`M${-r*.07} ${-r*.035} Q0 ${-r*.1} ${r*.07} ${-r*.035}`} fill="#5F7E3F"/>
    </g>)}
    {tier>=2&&<path d={`M${cx-r*.7} ${baseY-r*.02} Q${cx-r*.46} ${baseY-r*.18} ${cx-r*.2} ${baseY-r*.12}`} fill="none" stroke="#B18A59" strokeWidth={sw} opacity=".75"/>}
  </g>;
  if(skinId==="pine")return <g pointerEvents="none">
    {tier>=1&&[-.56,.52].map((dx,i)=><g key={dx} transform={`translate(${cx+dx*r},${baseY-r*.04}) rotate(${i?28:-24})`}>
      <ellipse rx={r*.075} ry={r*.12} fill="#76522F"/><path d={`M${-r*.045} ${-r*.08} l${r*.09} ${r*.04} M${-r*.05} 0 l${r*.1} ${r*.04}`} stroke="#A98253" strokeWidth={sw}/>
    </g>)}
  </g>;
  if(shape==="blossom")return <g pointerEvents="none">
    <path d={`M${cx-r*.72} ${canopyY-r*.05} Q${cx-r*.26} ${canopyY+r*.15} ${cx+r*.58} ${canopyY-r*.42}`} fill="none" stroke="#8D5448" strokeWidth={r*.075} opacity=".7" strokeLinecap="round"/>
    {tier>=1&&[[-.72,-.08],[.54,-.48],[.1,-.62]].map(([dx,dy],i)=><g key={i} transform={`translate(${cx+dx*r},${canopyY+dy*r})`}>
      {[0,72,144,216,288].map(angle=><ellipse key={angle} cx="0" cy={-r*.07} rx={r*.035} ry={r*.07} fill="#FFF0F6" transform={`rotate(${angle})`}/>)}
      <circle r={r*.025} fill="#E8A847"/>
    </g>)}
    {tier>=2&&<ellipse cx={cx+r*.55} cy={baseY} rx={r*.25} ry={r*.06} fill="#F6C9D8" opacity=".55"/>}
  </g>;
  if(shape==="pine")return <g pointerEvents="none">
    {[-.54,.5].map((dx,i)=><g key={dx} transform={`translate(${cx+dx*r},${baseY-r*.03}) rotate(${i?22:-24})`}>
      <ellipse rx={r*.065} ry={r*.11} fill={skinId==="frostedpine"?"#D8E9E5":"#76522F"}/>
      <path d={`M${-r*.04} ${-r*.07} l${r*.08} ${r*.035} M${-r*.045} 0 l${r*.09} ${r*.035}`} stroke={skinId==="frostedpine"?"#FFFFFF":"#A98253"} strokeWidth={sw}/>
    </g>)}
    {skinId==="frostedpine"&&tier>=2&&<path d={`M${cx-r*.7} ${baseY} Q${cx} ${baseY-r*.16} ${cx+r*.72} ${baseY}`} fill="#EDF8F6" opacity=".72"/>}
  </g>;
  if(shape==="maple")return <g pointerEvents="none">
    {[[-.62,"#C94E38"],[-.24,"#E68A3B"],[.38,skinId==="ginkgo"?"#F2C953":"#AF3F32"],[.66,"#E0A53C"]].map(([dx,fill],i)=>
      <path key={i} d={`M${cx+dx*r} ${baseY-r*.02} q${r*.08} -${r*.1} ${r*.16} 0 q-${r*.08} ${r*.14} -${r*.16} 0`} fill={fill} opacity={tier>=2?.95:.72}/>)}
    {tier>=2&&<path d={`M${cx-r*.72} ${baseY+r*.01} Q${cx} ${baseY-r*.18} ${cx+r*.74} ${baseY+r*.01}`} fill={skinId==="ginkgo"?"#E6BC42":"#BA5438"} opacity=".18"/>}
  </g>;
  if(shape==="willow"&&skinId==="wisteria")return <g pointerEvents="none">
    {tier>=1&&[-.68,.66].map(dx=><g key={dx} transform={`translate(${cx+dx*r},${baseY-r*.03})`}>
      {[0,1,2].map(i=><circle key={i} cx={(i-1)*r*.045} cy={-i*r*.035} r={r*.045} fill={i%2?"#C7ADEE":"#A98BDD"}/>)}
    </g>)}
  </g>;
  if(shape==="bamboo")return <g pointerEvents="none">
    {[-.58,.55].map((dx,i)=><ellipse key={dx} cx={cx+dx*r} cy={baseY} rx={r*(.18+i*.03)} ry={r*.07} fill={i?"#A7A99A":"#C3BCA8"}/>)}
    {tier>=2&&<path d={`M${cx-r*.72} ${baseY-r*.02} q${r*.18} -${r*.16} ${r*.34} 0`} stroke="#7FAE52" strokeWidth={sw*1.2} fill="none"/>}
  </g>;
  if(shape==="banana")return <g pointerEvents="none">
    {tier>=1&&<path d={`M${cx-r*.7} ${baseY} Q${cx-r*.5} ${baseY-r*.2} ${cx-r*.2} ${baseY-r*.08}`} fill="#78994E" opacity=".42"/>}
    {tier>=2&&<path d={`M${cx+r*.42} ${baseY-r*.02} q${r*.12} -${r*.1} ${r*.24} 0 q-${r*.12} ${r*.12} -${r*.24} 0`} fill="#E1B43C"/>}
  </g>;
  if(shape==="palm")return <g pointerEvents="none">
    {tier>=1&&[-.58,.62].map((dx,i)=><circle key={dx} cx={cx+dx*r} cy={baseY-r*(.02+i*.02)} r={r*.09} fill={i?"#80603D":"#94704A"}/>)}
    {tier>=2&&<path d={`M${cx-r*.82} ${baseY} Q${cx-r*.56} ${baseY-r*.17} ${cx-r*.28} ${baseY-r*.08}`} fill="#D8C389" opacity=".55"/>}
  </g>;
  if(["muffin","cupcake","cake"].includes(shape))return <g pointerEvents="none">
    <ellipse cx={cx} cy={baseY+r*.01} rx={r*.72} ry={r*.12} fill="#F7F1E8" stroke="#D8C9B7" strokeWidth={sw} opacity=".88"/>
    {tier>=2&&[-.62,.6].map((dx,i)=><circle key={dx} cx={cx+dx*r} cy={baseY-r*(.02+i*.02)} r={r*.035} fill={i?"#E7A9BA":"#9B80C7"}/>)}
    {tier>=3&&<path d={sgStarPath(cx+r*.72,canopyY-r*.46,r*.065)} fill="#F0C95D"/>}
  </g>;
  return null;
}

function WillowCrown({cx,baseY,canopyY,r,canopyColor,trunkColor,opacity=1,pond=true}){
  const deep=shade(canopyColor,-.28), light=shade(canopyColor,.25), sw=Math.max(.7,r*.045);
  const sprays=[-1,-.72,-.42,-.12,.18,.48,.78,1];
  return <g opacity={opacity} pointerEvents="none">
    {/* A broad arched frame and visible boughs keep the silhouette botanical. */}
    <path d={`M${cx-r*.1} ${baseY-r*.08} Q${cx-r*.38} ${canopyY+r*.32} ${cx-r*.08} ${canopyY-r*.35} Q${cx+r*.34} ${canopyY-r*.72} ${cx+r*.7} ${canopyY-r*.18}`}
      stroke={trunkColor} strokeWidth={r*.22} fill="none" strokeLinecap="round"/>
    <path d={`M${cx-r*.05} ${canopyY-r*.28} Q${cx-r*.5} ${canopyY-r*.58} ${cx-r*.82} ${canopyY-r*.18} M${cx+r*.04} ${canopyY-r*.42} Q${cx+r*.45} ${canopyY-r*.62} ${cx+r*.76} ${canopyY-r*.24}`}
      stroke={shade(trunkColor,-.12)} strokeWidth={r*.1} fill="none" strokeLinecap="round"/>
    <ellipse cx={cx} cy={canopyY-r*.48} rx={r*1.08} ry={r*.58} fill={canopyColor} opacity=".78"/>
    <ellipse cx={cx-r*.35} cy={canopyY-r*.68} rx={r*.58} ry={r*.36} fill={light} opacity=".48"/>
    <ellipse cx={cx+r*.42} cy={canopyY-r*.58} rx={r*.54} ry={r*.34} fill={deep} opacity=".28"/>
    {sprays.map((m,i)=>{
      const sx=cx+m*r*.82, sy=canopyY-r*(.4+(i%3)*.1), len=r*(.82+(i%4)*.12);
      return <g key={m}>
        <path d={`M${sx} ${sy} Q${sx+m*r*.08} ${sy+len*.48} ${sx-m*r*.035} ${sy+len}`} stroke={deep} strokeWidth={sw*.55} fill="none" strokeLinecap="round"/>
        {[.22,.42,.62,.82].map((p,j)=><g key={p}>
          <ellipse cx={sx+(j%2?1:-1)*r*.065} cy={sy+len*p} rx={r*.085} ry={r*.035} fill={j%2?light:canopyColor} transform={`rotate(${j%2?32:-32} ${sx} ${sy+len*p})`}/>
          <ellipse cx={sx+(j%2?-1:1)*r*.055} cy={sy+len*(p+.07)} rx={r*.075} ry={r*.03} fill={deep} opacity=".72" transform={`rotate(${j%2?-28:28} ${sx} ${sy+len*(p+.07)})`}/>
        </g>)}
      </g>;
    })}
    {pond&&<g>
      <ellipse cx={cx+r*.48} cy={baseY-r*.01} rx={r*.58} ry={r*.17} fill="#91C9C1" opacity=".9"/>
      <ellipse cx={cx+r*.5} cy={baseY-r*.035} rx={r*.43} ry={r*.1} fill="#BDE3D6" opacity=".82"/>
      {[.02,.38,.78].map((p,i)=><ellipse key={p} cx={cx+r*(.12+p)} cy={baseY+r*(.02-(i%2)*.035)} rx={r*.13} ry={r*.075} fill={i%2?"#C8C8B8":"#A9B3A7"}/>)}
      {[[-.62,"#DDEDAA"],[-.45,"#EEF6CE"]].map(([dx,fill])=><circle key={dx} cx={cx+dx*r} cy={baseY-r*.08} r={r*.055} fill={fill}/>)}
    </g>}
  </g>;
}

function FlagshipTreeDetails({ theme, cx, baseY, canopyY, r, trunkH, tier=0, paused=false, layer="front", seed=0 }) {
  if(!theme || r<=0) return null;
  const sw = Math.max(0.65, r*0.052);
  const animated = !paused;
  const t = Math.max(0, Math.min(3, tier||0));
  const pulse = (dur="4s", begin="0s") => animated
    ? <animate attributeName="opacity" values="0.35;0.95;0.35" dur={dur} begin={begin} repeatCount="indefinite"/>
    : null;
  const bob = (amount, dur="4s", begin="0s") => animated
    ? <animateTransform attributeName="transform" type="translate" values={`0 0; 0 ${-amount}; 0 0`} dur={dur} begin={begin} repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.5;1"/>
    : null;

  if(layer==="back") {
    if(theme==="moon") return (
      <g pointerEvents="none">
        <ellipse cx={cx} cy={canopyY+r*0.18} rx={r*1.34} ry={r*1.08} fill="#A9D8FF" opacity="0.16">
          {animated && <animate attributeName="opacity" values="0.10;0.22;0.10" dur="5s" repeatCount="indefinite"/>}
        </ellipse>
        {t>=3 && <>
          <g opacity="0.92">
            <circle cx={cx-r*0.12} cy={canopyY-r*0.12} r={r*1.02} fill="#EAF5FF"/>
            <circle cx={cx+r*0.25} cy={canopyY-r*0.22} r={r*0.92} fill="#A9D8FF" opacity="0.96"/>
            <circle cx={cx-r*0.12} cy={canopyY-r*0.12} r={r*1.18} fill="#DCEEFF" opacity="0.13">
              {animated && <animate attributeName="opacity" values="0.08;0.20;0.08" dur="5.5s" repeatCount="indefinite"/>}
            </circle>
          </g>
          {[-0.55,0,0.55].map((dx,i)=><path key={i} d={`M${cx+dx*r*0.7} ${canopyY-r*1.55} L${cx+dx*r*0.35+r*0.22} ${baseY-r*0.1}`} stroke="#D9ECFF" strokeWidth={r*0.18} opacity={0.09} strokeLinecap="round"/>)}
        </>}
      </g>
    );
    if(theme==="dragon") return (
      <g pointerEvents="none">
        <ellipse cx={cx} cy={canopyY+r*0.18} rx={r*1.34} ry={r*1.04} fill="#F4A340" opacity="0.13">
          {animated && <animate attributeName="opacity" values="0.08;0.18;0.08" dur="4.8s" repeatCount="indefinite"/>}
        </ellipse>
        {t>=3 && <ellipse cx={cx} cy={baseY+r*0.02} rx={r*1.18} ry={r*0.28} fill="#F4C45E" opacity="0.16"/>}
      </g>
    );
    if(theme==="lion") return (
      <g pointerEvents="none">
        {/* Warm festival glow and embroidered ground rug. */}
        <ellipse cx={cx} cy={canopyY+r*0.08} rx={r*1.38} ry={r*1.08} fill="#F29A38" opacity="0.14">
          {animated&&<animate attributeName="opacity" values="0.09;0.19;0.09" dur="4.6s" repeatCount="indefinite"/>}
        </ellipse>
        <ellipse cx={cx} cy={baseY+r*0.035} rx={r*1.25} ry={r*0.31} fill="#7F1F2A" opacity="0.9"/>
        <ellipse cx={cx} cy={baseY-r*0.015} rx={r*1.08} ry={r*0.235} fill="#C83A3F" stroke="#EBC75D" strokeWidth={sw*0.8}/>
        <path d={`M${cx-r*0.86} ${baseY-r*0.02} Q${cx} ${baseY-r*0.32} ${cx+r*0.86} ${baseY-r*0.02}`}
          stroke="#F2D477" strokeWidth={sw*0.55} fill="none" opacity="0.78"/>

        {t>=2 && [-1,1].map((side,i)=><g key={`lionpost${side}`}>
          <path d={`M${cx+side*r*1.02} ${baseY-r*0.02} V${canopyY-r*0.72}`} stroke="#7A4328" strokeWidth={sw*1.05}/>
          <circle cx={cx+side*r*1.02} cy={canopyY-r*0.78} r={r*0.07} fill="#E8B84B"/>
          <path d={`M${cx+side*r*1.02} ${canopyY-r*0.65} h${side*r*0.34} v${r*0.48} h${-side*r*0.34} Z`}
            fill="#A92735" stroke="#EBC75D" strokeWidth={sw*0.5}/>
          <circle cx={cx+side*r*1.18} cy={canopyY-r*0.4} r={r*0.055} fill="#F2D477" opacity="0.9"/>
        </g>)}

        {t>=3 && <g>
          {/* Radiant medallion: a compact festival sun behind the lion. */}
          <circle cx={cx} cy={canopyY-r*0.08} r={r*1.13} fill="#F6C857" opacity="0.12">
            {animated&&<animate attributeName="opacity" values="0.08;0.17;0.08" dur="4.2s" repeatCount="indefinite"/>}
          </circle>
          <circle cx={cx} cy={canopyY-r*0.08} r={r*1.03} fill="none" stroke="#F2CB63" strokeWidth={sw*0.8}
            strokeDasharray={`${r*0.16} ${r*0.12}`} opacity="0.52">
            {animated&&<animateTransform attributeName="transform" type="rotate" from={`0 ${cx} ${canopyY-r*0.08}`} to={`360 ${cx} ${canopyY-r*0.08}`} dur="28s" repeatCount="indefinite"/>}
          </circle>
          {Array.from({length:10}).map((_,i)=>{
            const a=i*Math.PI*2/10, x1=cx+Math.cos(a)*r*1.17, y1=canopyY-r*0.08+Math.sin(a)*r*1.02;
            const x2=cx+Math.cos(a)*r*1.34, y2=canopyY-r*0.08+Math.sin(a)*r*1.18;
            return <path key={`lionray${i}`} d={`M${x1} ${y1} L${x2} ${y2}`} stroke="#F2CB63" strokeWidth={sw*0.75} strokeLinecap="round" opacity="0.34"/>;
          })}
        </g>}
      </g>
    );
    if(theme==="king") return (
      <g pointerEvents="none">
        <ellipse cx={cx} cy={baseY+r*0.04} rx={r*1.2} ry={r*0.35} fill="#D8D4C7" opacity="0.95"/>
        <ellipse cx={cx} cy={baseY-r*0.02} rx={r*1.05} ry={r*0.26} fill="#F1EEE6" opacity="0.98"/>
        {t>=3 && <g stroke="#D4B24C" strokeWidth={sw} fill="none" opacity="0.72">
          <path d={`M${cx-r*1.34} ${baseY-r*0.05} v-${r*0.58} h${r*0.34} v${r*0.44} M${cx+r*1.34} ${baseY-r*0.05} v-${r*0.58} h-${r*0.34} v${r*0.44}`}/>
          <path d={`M${cx-r*1.34} ${baseY-r*0.49} H${cx-r*0.88} M${cx+r*1.34} ${baseY-r*0.49} H${cx+r*0.88}`}/>
        </g>}
      </g>
    );
    if(theme==="diamond") return (
      <g pointerEvents="none">
        <ellipse cx={cx} cy={canopyY+r*0.14} rx={r*1.35} ry={r*1.05} fill="#BFEAFF" opacity="0.16">
          {animated && <animate attributeName="opacity" values="0.10;0.24;0.10" dur="4.2s" repeatCount="indefinite"/>}
        </ellipse>
        {t>=3 && <>
          <path d={`M${cx-r*1.32} ${baseY} Q${cx-r*1.5} ${canopyY-r*0.15} ${cx-r*0.62} ${canopyY-r*1.15}`} stroke="#DDF7FF" strokeWidth={r*0.18} fill="none" opacity="0.62"/>
          <path d={`M${cx+r*1.32} ${baseY} Q${cx+r*1.5} ${canopyY-r*0.15} ${cx+r*0.62} ${canopyY-r*1.15}`} stroke="#DDF7FF" strokeWidth={r*0.18} fill="none" opacity="0.62"/>
          <path d={`M${cx-r*1.2} ${baseY+r*0.05} L${cx-r*0.8} ${baseY-r*0.36} H${cx+r*0.8} L${cx+r*1.2} ${baseY+r*0.05} Z`} fill="#BFEAFF" opacity="0.46" stroke="#F3FDFF" strokeWidth={sw}/>
        </>}
      </g>
    );
    return null;
  }

  if(theme==="moon") return (
    <g pointerEvents="none">
      {/* Layered moonlit foliage and a seated crescent make the silhouette
          recognizable even before the first enhancement tier. */}
      <g opacity="0.9">
        <circle cx={cx-r*0.58} cy={canopyY-r*0.24} r={r*0.24} fill="#B9DFFF" opacity="0.42"/>
        <circle cx={cx+r*0.54} cy={canopyY-r*0.3} r={r*0.22} fill="#CDEAFF" opacity="0.48"/>
        <circle cx={cx+r*0.03} cy={canopyY-r*0.65} r={r*0.25} fill="#FFFFFF" opacity="0.34"/>
      </g>
      <g transform={`translate(${cx-r*0.08},${canopyY-r*0.98})`}>
        <ellipse cy={r*0.27} rx={r*0.33} ry={r*0.085} fill="#79A9D7" opacity="0.22"/>
        <circle r={r*0.31} fill="#F7FCFF" stroke="#A9D8FF" strokeWidth={sw*0.75}/>
        <circle cx={r*0.13} cy={-r*0.06} r={r*0.275} fill="#8FC3ED"/>
        <path d={sgStarPath(r*0.25,-r*0.24,r*0.075)} fill="#FFF5B5">{t>=3&&pulse("2.7s")}</path>
        <circle cx={-r*0.12} cy={-r*0.14} r={r*0.045} fill="#FFFFFF" opacity="0.76"/>
      </g>

      {/* permanent silver shimmer and glowing root grass */}
      {[[-0.55,-0.42],[0.15,-0.72],[0.58,-0.18],[-0.12,-1.02]].map(([dx,dy],i)=><circle key={`ms${i}`} cx={cx+dx*r} cy={canopyY+dy*r} r={r*(0.065+(i%2)*0.018)} fill="#FFFFFF" opacity="0.7">{pulse(`${2.6+i*0.45}s`,`${i*0.3}s`)}</circle>)}
      {[-0.72,-0.38,0,0.36,0.7].map((dx,i)=><path key={`mg${i}`} d={`M${cx+dx*r} ${baseY} q${r*0.03} -${r*(0.28+(i%2)*0.08)} ${r*0.09} 0`} stroke="#B8EAFF" strokeWidth={sw} fill="none" strokeLinecap="round" opacity="0.82"/>)}
      {t>=1 && [[-0.72,-0.04],[0.72,-0.03],[-0.38,-0.16],[0.4,-0.17]].map(([dx,dy],i)=><g key={`mf${i}`} transform={`translate(${cx+dx*r},${baseY+dy*r})`}>
        {[0,90,180,270].map(a=><ellipse key={a} cx="0" cy="0" rx={r*0.09} ry={r*0.035} fill="#F8FDFF" transform={`rotate(${a})`}/>)}
        <circle r={r*0.035} fill="#83BDF5"/>
      </g>)}
      {t>=2 && <>
        {[[-0.58,-0.35],[0.1,-0.63],[0.55,-0.42]].map(([dx,dy],i)=>{
          const x=cx+dx*r, y=canopyY+dy*r;
          return <g key={`mc${i}`}>
            <path d={`M${x} ${y-r*0.5} V${y}`} stroke="#D7EEFF" strokeWidth={sw*0.75} opacity="0.85"/>
            {i===1 ? <g><circle cx={x} cy={y} r={r*0.12} fill="#F4FBFF"/><circle cx={x+r*0.05} cy={y-r*0.025} r={r*0.1} fill="#8FC7F3"/></g> : <path d={sgDiamondPath(x,y,r*0.09,r*0.16)} fill="#D8F6FF" stroke="#FFFFFF" strokeWidth={sw*0.5}/>}
          </g>;
        })}
        {[[-0.88,-0.02],[0.88,-0.03]].map(([dx,dy],i)=><g key={`mm${i}`} transform={`translate(${cx+dx*r},${baseY+dy*r})`}>
          <rect x={-r*0.035} y={-r*0.18} width={r*0.07} height={r*0.18} rx={r*0.025} fill="#E8EEF4"/>
          <path d={`M${-r*0.15} ${-r*0.18} Q0 ${-r*0.38} ${r*0.15} ${-r*0.18} Z`} fill={i?"#8CB8F4":"#D9F3FF"}/>
          <circle cy={-r*0.22} r={r*0.035} fill="#FFFFFF"/>
        </g>)}
        {[[-0.68,-0.22],[0.02,-0.92],[0.72,-0.42]].map(([dx,dy],i)=><circle key={`mp${i}`} cx={cx+dx*r} cy={canopyY+dy*r} r={r*0.035} fill="#C5E8FF" opacity="0.75">{bob(r*0.18,`${4+i*0.7}s`,`${i*0.5}s`)}</circle>)}
        {[[-0.55,-0.02],[0.55,-0.02]].map(([dx,dy],i)=><g key={`mb${i}`} transform={`translate(${cx+dx*r},${baseY+dy*r})`}>
          {[0,90,180,270].map(a=><ellipse key={a} rx={r*0.075} ry={r*0.028} fill="#65A9F3" transform={`rotate(${a})`}/>)}<circle r={r*0.025} fill="#EAF7FF"/>
        </g>)}
      </>}
      {t>=3 && <>
        <g>{animated && <animateTransform attributeName="transform" type="rotate" from={`0 ${cx} ${canopyY}`} to={`360 ${cx} ${canopyY}`} dur="16s" repeatCount="indefinite"/>}
          {[[0,-1.38],[1.18,-0.36],[-1.1,0.26]].map(([dx,dy],i)=><path key={`mo${i}`} d={sgStarPath(cx+dx*r,canopyY+dy*r,r*(0.11+i*0.015))} fill="#FFFFFF" opacity="0.9"/>)}
        </g>
        {[[-1.05,-0.48],[0.98,0.12]].map(([dx,dy],i)=><path key={`mr${i}`} d={sgDiamondPath(cx+dx*r,canopyY+dy*r,r*0.13,r*0.2)} fill="#BDE6FF" stroke="#FFFFFF" strokeWidth={sw*0.55}>{bob(r*0.18,`${4.4+i*0.8}s`,`${i*0.4}s`)}</path>)}
        {[[-1.0,0.2],[0.88,-0.1],[0.35,0.65]].map(([dx,dy],i)=><circle key={`ff${i}`} cx={cx+dx*r} cy={canopyY+dy*r} r={r*0.035} fill="#FFF3A6">{pulse(`${2.8+i*0.5}s`,`${i*0.45}s`)}</circle>)}
      </>}
    </g>
  );

  if(theme==="dragon") return (
    <g pointerEvents="none">
      {/* Deep scale-like foliage makes the canopy denser and more toy-like. */}
      <g opacity="0.82">
        <circle cx={cx-r*0.58} cy={canopyY-r*0.2} r={r*0.24} fill="#236D48" opacity="0.62"/>
        <circle cx={cx+r*0.55} cy={canopyY-r*0.28} r={r*0.23} fill="#3DA66B" opacity="0.54"/>
        {[[-0.62,-0.48],[-0.28,-0.72],[0.34,-0.75],[0.7,-0.44]].map(([dx,dy],i)=><path key={`dscale${i}`}
          d={sgDiamondPath(cx+dx*r,canopyY+dy*r,r*0.06,r*0.105)} fill={i%2?"#F0C85A":"#D9A83C"}
          transform={`rotate(${i%2?24:-24} ${cx+dx*r} ${canopyY+dy*r})`} opacity="0.88"/>)}
      </g>

      {/* A hatchling peeks over the highest canopy lobe. It shares the tree's
          motion instead of orbiting independently, so it always feels perched. */}
      <g transform={`translate(${cx},${canopyY-r*0.96})`}>
        {t>=3 && <g fill="#347D50" stroke="#235D3D" strokeWidth={sw*0.45}>
          <path d={`M${-r*0.12} ${r*0.02} Q${-r*0.5} ${-r*0.34} ${-r*0.62} ${r*0.02} Q${-r*0.36} ${-r*0.08} ${-r*0.14} ${r*0.16} Z`}>
            {animated&&<animateTransform attributeName="transform" type="rotate" values="-5 0 0;7 0 0;-5 0 0" dur="1.7s" repeatCount="indefinite"/>}
          </path>
          <path d={`M${r*0.12} ${r*0.02} Q${r*0.5} ${-r*0.34} ${r*0.62} ${r*0.02} Q${r*0.36} ${-r*0.08} ${r*0.14} ${r*0.16} Z`}>
            {animated&&<animateTransform attributeName="transform" type="rotate" values="5 0 0;-7 0 0;5 0 0" dur="1.7s" repeatCount="indefinite"/>}
          </path>
        </g>}
        <path d={`M${-r*0.17} ${-r*0.13} L${-r*0.08} ${-r*0.34} L0 ${-r*0.12} M${r*0.17} ${-r*0.13} L${r*0.08} ${-r*0.34} L0 ${-r*0.12}`}
          fill="#E7D39A" stroke="#8B6A36" strokeWidth={sw*0.7} strokeLinejoin="round"/>
        <ellipse cy={r*0.01} rx={r*0.25} ry={r*0.22} fill="#63AE73" stroke="#2E6D45" strokeWidth={sw*0.65}/>
        <ellipse cy={r*0.08} rx={r*0.14} ry={r*0.1} fill="#83C38B"/>
        {[-0.09,0.09].map((dx,i)=><g key={`deye${i}`}><circle cx={dx*r} cy={-r*0.035} r={r*0.042} fill="#FFF8D8"/><circle cx={dx*r} cy={-r*0.03} r={r*0.022} fill="#26382B"/></g>)}
        <circle cx={-r*0.05} cy={r*0.08} r={r*0.015} fill="#315E40"/><circle cx={r*0.05} cy={r*0.08} r={r*0.015} fill="#315E40"/>
        <circle cx={-r*0.19} cy={r*0.21} r={r*0.075} fill="#69B678"/><circle cx={r*0.19} cy={r*0.21} r={r*0.075} fill="#69B678"/>
        {t>=3 && <path d={sgStarPath(r*0.29,-r*0.25,r*0.065)} fill="#FFD867">{pulse("2.6s")}</path>}
      </g>

      {/* claw marks, golden vine and root gems */}
      {[-0.18,0,0.18].map((dx,i)=><path key={`cl${i}`} d={`M${cx+dx*r} ${baseY-trunkH*0.82} q${-r*0.12} ${trunkH*0.22} ${-r*0.05} ${trunkH*0.45}`} stroke="#3A2818" strokeWidth={sw} fill="none" opacity="0.72" strokeLinecap="round"/>)}
      <path d={`M${cx-r*0.18} ${baseY-r*0.08} Q${cx+r*0.2} ${baseY-trunkH*0.35} ${cx-r*0.12} ${baseY-trunkH*0.75}`} stroke="#DDB64D" strokeWidth={sw*1.25} fill="none" opacity="0.86"/>
      {[[-0.68,"#54E09B"],[0.62,"#F3C64E"],[0.16,"#5EC4FF"]].map(([dx,fill],i)=><path key={`dg${i}`} d={sgDiamondPath(cx+dx*r,baseY-r*(0.08+(i%2)*0.04),r*0.12,r*0.17)} fill={fill} stroke="#FFF6C7" strokeWidth={sw*0.45}>{pulse(`${2.7+i*0.4}s`,`${i*0.2}s`)}</path>)}
      {t>=2 && <>
        {[[-0.72,0],[0.48,-0.02]].map(([dx,dy],i)=><g key={`egg${i}`} transform={`translate(${cx+dx*r},${baseY+dy*r})`}>
          <ellipse cy={-r*0.16} rx={r*0.16} ry={r*0.23} fill={i?"#C7E4A4":"#91CDA5"} stroke="#6E9F67" strokeWidth={sw*0.6}/>
          <circle cx={-r*0.05} cy={-r*0.22} r={r*0.025} fill="#5D8A5D"/><circle cx={r*0.06} cy={-r*0.12} r={r*0.025} fill="#5D8A5D"/>
        </g>)}
        {[[-0.62,-0.5],[0.62,-0.42]].map(([dx,dy],i)=>{
          const x=cx+dx*r,y=canopyY+dy*r;
          return <g key={`lan${i}`}><path d={`M${x} ${y-r*0.38} V${y-r*0.08}`} stroke="#7B4D24" strokeWidth={sw}/><rect x={x-r*0.11} y={y-r*0.08} width={r*0.22} height={r*0.24} rx={r*0.04} fill="#FFB64A" stroke="#7B4D24" strokeWidth={sw*0.55}/><circle cx={x} cy={y+r*0.04} r={r*0.045} fill="#FFF0A6">{pulse(`${2.5+i*0.4}s`)}</circle></g>;
        })}
        {[-0.26,0,0.25].map((dx,i)=><ellipse key={`coin${i}`} cx={cx+dx*r} cy={baseY-r*(0.035+i*0.015)} rx={r*0.11} ry={r*0.035} fill="#F2C94C" stroke="#B88618" strokeWidth={sw*0.45}/>)}
        <path d={`M${cx-r*0.05} ${baseY-trunkH*0.7} H${cx+r*0.52} L${cx+r*0.42} ${baseY-trunkH*0.48} H${cx-r*0.05} Z`} fill="#B84235" stroke="#F2C94C" strokeWidth={sw*0.55}/>
        {[[-0.92,-0.1],[0.9,-0.08]].map(([dx,dy],i)=><path key={`horn${i}`} d={`M${cx+dx*r} ${baseY+dy*r} q${dx<0?-r*0.18:r*0.18} -${r*0.22} ${dx<0?-r*0.02:r*0.02} -${r*0.36}`} fill="#D9C39A" stroke="#8A7048" strokeWidth={sw*0.5}/>) }
        {[[-0.9,-0.4],[0.82,-0.8],[0.25,-1.1]].map(([dx,dy],i)=><circle key={`em${i}`} cx={cx+dx*r} cy={canopyY+dy*r} r={r*0.035} fill="#FF8A3D" opacity="0.9">{bob(r*0.35,`${3.2+i*0.55}s`,`${i*0.35}s`)}</circle>)}
      </>}
      {t>=3 && <>
        {/* sleeping baby dragon */}
        <g transform={`translate(${cx-r*0.86},${baseY-r*0.14})`}>
          {animated && <animateTransform attributeName="transform" type="translate" values={`${cx-r*0.86} ${baseY-r*0.14}; ${cx-r*0.86} ${baseY-r*0.17}; ${cx-r*0.86} ${baseY-r*0.14}`} dur="3.6s" repeatCount="indefinite"/>}
          <ellipse cx="0" cy="0" rx={r*0.32} ry={r*0.18} fill="#61A66C"/>
          <circle cx={r*0.25} cy={-r*0.13} r={r*0.16} fill="#69B675"/>
          <path d={`M${-r*0.1} ${-r*0.08} q${-r*0.2} -${r*0.25} ${-r*0.32} ${r*0.02} Z`} fill="#4F8F5A"/>
          <path d={`M${-r*0.28} ${r*0.02} q${-r*0.25} ${r*0.12} ${-r*0.4} -${r*0.02}`} stroke="#4F8F5A" strokeWidth={sw*1.1} fill="none" strokeLinecap="round"/>
          <path d={`M${r*0.28} ${-r*0.14} q${r*0.07} ${r*0.04} ${r*0.12} 0`} stroke="#263C2B" strokeWidth={sw*0.55} fill="none"/>
        </g>
        {/* treasure chest and runes */}
        <g transform={`translate(${cx+r*0.82},${baseY-r*0.05})`}><rect x={-r*0.3} y={-r*0.22} width={r*0.6} height={r*0.25} rx={r*0.03} fill="#8C4E25" stroke="#E2B84A" strokeWidth={sw}/><path d={`M${-r*0.3} ${-r*0.22} Q0 ${-r*0.48} ${r*0.3} ${-r*0.22}`} fill="#A9612E" stroke="#E2B84A" strokeWidth={sw}/>{[-0.18,0,0.18].map((dx,i)=><circle key={i} cx={dx*r} cy={-r*(0.26+i*0.04)} r={r*0.07} fill="#F2C94C">{pulse(`${2.5+i*0.3}s`)}</circle>)}</g>
        {[0.26,0.5,0.73].map((p,i)=><path key={`rune${i}`} d={i===0?`M${cx-r*0.08} ${baseY-trunkH*p} h${r*0.16}`:i===1?`M${cx-r*0.1} ${baseY-trunkH*p} l${r*0.1} -${r*0.08} l${r*0.1} ${r*0.08}`:`M${cx-r*0.08} ${baseY-trunkH*p} q${r*0.08} -${r*0.1} ${r*0.16} 0`} stroke="#FFD55E" strokeWidth={sw*0.8} fill="none" opacity="0.92">{pulse(`${2.6+i*0.4}s`)}</path>)}
      </>}
    </g>
  );

  if(theme==="lion") return (
    <g pointerEvents="none">
      {/* Southern lion head integrated into the red canopy. Bold shapes stay
          readable in the tiny garden renderer; fine brocade rewards preview. */}
      <g transform={`translate(${cx},${canopyY-r*0.12})`}>
        {/* scalloped mane */}
        {[-150,-105,-60,-15,30,75,120,165].map((deg,i)=>{
          const a=deg*Math.PI/180;
          return <circle key={`lmane${i}`} cx={Math.cos(a)*r*0.47} cy={Math.sin(a)*r*0.38}
            r={r*(0.18+(i%2)*0.025)} fill={i%2?"#D74745":"#8F2531"}
            stroke="#F0C85A" strokeWidth={sw*0.45} opacity="0.98"/>;
        })}
        {[[-0.48,-0.2],[0.48,-0.2]].map(([dx,dy],i)=><g key={`lear${i}`} transform={`translate(${dx*r},${dy*r})`}>
          <path d={`M0 ${r*0.15} Q${dx<0?-r*0.24:r*0.24} 0 0 -${r*0.22} Q${dx<0?r*0.15:-r*0.15} -${r*0.02} 0 ${r*0.15} Z`}
            fill="#F1D477" stroke="#8E2932" strokeWidth={sw*0.7}/>
          <path d={`M0 ${r*0.08} Q${dx<0?-r*0.12:r*0.12} 0 0 -${r*0.11}`} stroke="#C43A40" strokeWidth={sw*0.55} fill="none"/>
        </g>)}

        {/* face plate */}
        <ellipse cy={r*0.015} rx={r*0.47} ry={r*0.4} fill="#F4E1B5" stroke="#E7B94C" strokeWidth={sw*1.15}/>
        <path d={`M${-r*0.4} ${-r*0.19} Q${-r*0.2} ${-r*0.37} 0 ${-r*0.25} Q${r*0.2} ${-r*0.37} ${r*0.4} ${-r*0.19}`}
          fill="#C9343E" stroke="#8F2630" strokeWidth={sw*0.65}/>

        {/* central horn and forehead mirror — both attached to the head */}
        <path d={`M${-r*0.1} ${-r*0.34} Q${-r*0.04} ${-r*0.66} ${r*0.08} ${-r*0.78} Q${r*0.2} ${-r*0.54} ${r*0.11} ${-r*0.32} Z`}
          fill="#F0C85A" stroke="#8F2630" strokeWidth={sw*0.75}/>
        <path d={`M${-r*0.015} ${-r*0.4} Q${r*0.04} ${-r*0.58} ${r*0.085} ${-r*0.64}`} stroke="#FFF0A2" strokeWidth={sw*0.7} fill="none" strokeLinecap="round"/>
        <circle cy={-r*0.29} r={r*0.115} fill="#F5D96F" stroke="#9D2C35" strokeWidth={sw*0.7}/>
        <circle cy={-r*0.29} r={r*0.076} fill="#DFF7F3" stroke="#FFFFFF" strokeWidth={sw*0.45}>
          {t>=3&&pulse("2.5s")}
        </circle>
        <path d={sgStarPath(0,-r*0.29,r*0.038)} fill="#72BFC4" opacity="0.9"/>

        {/* curled brows */}
        <path d={`M${-r*0.38} ${-r*0.12} Q${-r*0.24} ${-r*0.26} ${-r*0.08} ${-r*0.14} Q${-r*0.18} ${-r*0.08} ${-r*0.31} ${-r*0.1}`}
          stroke="#B62936" strokeWidth={sw*1.25} fill="none" strokeLinecap="round"/>
        <path d={`M${r*0.38} ${-r*0.12} Q${r*0.24} ${-r*0.26} ${r*0.08} ${-r*0.14} Q${r*0.18} ${-r*0.08} ${r*0.31} ${-r*0.1}`}
          stroke="#B62936" strokeWidth={sw*1.25} fill="none" strokeLinecap="round"/>

        {/* expressive eyes blink independently but remain fixed to the lion */}
        {[-0.2,0.2].map((dx,i)=><g key={`lioneye${i}`} transform={`translate(${dx*r},${-r*0.075})`}>
          <g>
            {animated&&<animateTransform attributeName="transform" type="scale"
              values="1 1;1 1;1 0.12;1 1" keyTimes="0;0.82;0.87;1" dur={`${4.4+i*0.5}s`} begin={`${i*0.18}s`} repeatCount="indefinite"/>}
            <ellipse rx={r*0.13} ry={r*0.105} fill="#FFFFFF" stroke="#D9A83B" strokeWidth={sw*0.55}/>
            <circle cx={dx<0?r*0.025:-r*0.025} r={r*0.052} fill="#223B3C"/>
            <circle cx={dx<0?r*0.008:-r*0.042} cy={-r*0.018} r={r*0.014} fill="#FFFFFF"/>
          </g>
        </g>)}

        {/* green prosperity nose, muzzle and articulated jaw */}
        <ellipse cy={r*0.08} rx={r*0.13} ry={r*0.09} fill="#4E9A58" stroke="#2E6A3A" strokeWidth={sw*0.6}/>
        <circle cx={-r*0.045} cy={r*0.075} r={r*0.018} fill="#E8F6C3"/><circle cx={r*0.045} cy={r*0.075} r={r*0.018} fill="#E8F6C3"/>
        <ellipse cx={-r*0.12} cy={r*0.17} rx={r*0.15} ry={r*0.11} fill="#FFF1CF"/>
        <ellipse cx={r*0.12} cy={r*0.17} rx={r*0.15} ry={r*0.11} fill="#FFF1CF"/>
        <path d={`M${-r*0.22} ${r*0.21} Q0 ${r*0.31} ${r*0.22} ${r*0.21} Q0 ${r*0.42} ${-r*0.22} ${r*0.21} Z`} fill="#6F1F2B" stroke="#A82B35" strokeWidth={sw*0.6}/>
        <g>
          {t>=2&&animated&&<animateTransform attributeName="transform" type="translate" values={`0 0;0 ${r*0.045};0 0`} dur="2.8s" repeatCount="indefinite"/>}
          <path d={`M${-r*0.23} ${r*0.25} Q0 ${r*0.48} ${r*0.23} ${r*0.25} L${r*0.18} ${r*0.39} Q0 ${r*0.55} ${-r*0.18} ${r*0.39} Z`}
            fill="#C83A40" stroke="#7C202B" strokeWidth={sw*0.75}/>
          {[-0.12,-0.04,0.04,0.12].map((dx,i)=><path key={`ltooth${i}`} d={`M${dx*r-r*0.025} ${r*0.29} L${dx*r} ${r*0.36} L${dx*r+r*0.025} ${r*0.29} Z`} fill="#FFF8E5"/>)}
        </g>
        {[[-0.27,0.33],[-0.09,0.42],[0.1,0.42],[0.28,0.33]].map(([dx,dy],i)=><circle key={`lbeard${i}`} cx={dx*r} cy={dy*r} r={r*0.095} fill={i%2?"#F6E5C2":"#FFF2D8"} stroke="#D9A943" strokeWidth={sw*0.35}/>) }

        {/* permanent gold brocade curls */}
        {[[-0.48,0.04,1],[0.48,0.04,-1],[-0.34,0.31,1],[0.34,0.31,-1]].map(([dx,dy,side],i)=><path key={`lbc${i}`}
          d={`M${dx*r} ${dy*r} q${side*r*0.17} -${r*0.12} ${side*r*0.22} ${r*0.03} q${-side*r*0.05} ${r*0.1} ${-side*r*0.13} ${r*0.02}`}
          stroke="#F1CB5B" strokeWidth={sw*0.72} fill="none" strokeLinecap="round"/>) }
      </g>

      {t>=1 && <>
        {/* Knotted tassels and jade beads — compact, symmetrical, ceremonial. */}
        {[-0.58,0.58].map((dx,i)=><g key={`ltassel${i}`} transform={`translate(${cx+dx*r},${canopyY+r*0.02})`}>
          <path d={`M0 ${-r*0.2} Q${(i?1:-1)*r*0.09} ${-r*0.08} 0 0 Q${(i?-1:1)*r*0.09} ${r*0.08} 0 ${r*0.16}`}
            stroke="#F0C85A" strokeWidth={sw*0.75} fill="none"/>
          <path d={sgDiamondPath(0,r*0.01,r*0.07,r*0.085)} fill="#C92F3B" stroke="#F4D36D" strokeWidth={sw*0.4}/>
          <circle cy={r*0.16} r={r*0.045} fill="#4E9A68"/>
          {[-0.04,0,0.04].map((tx,j)=><path key={j} d={`M${tx*r} ${r*0.19} v${r*0.18}`} stroke="#DDAE32" strokeWidth={sw*0.45} strokeLinecap="round">{animated&&bob(r*0.025,`${3.8+i*0.4}s`,`${i*0.2}s`)}</path>)}
        </g>)}
        <path d={`M${cx-r*0.18} ${baseY-r*0.05} Q${cx-r*0.32} ${baseY-trunkH*0.38} ${cx-r*0.06} ${baseY-trunkH*0.7} Q${cx+r*0.22} ${baseY-trunkH*0.82} ${cx+r*0.04} ${baseY-trunkH*0.98}`}
          stroke="#E5B84B" strokeWidth={sw*1.05} fill="none" opacity="0.88"/>
      </>}

      {t>=2 && <>
        {/* Lantern pair */}
        {[-0.72,0.72].map((dx,i)=>{const x=cx+dx*r,y=canopyY-r*0.32;return <g key={`llan${i}`}>
          <path d={`M${x} ${y-r*0.28} V${y-r*0.08}`} stroke="#7A3D29" strokeWidth={sw*0.8}/>
          <ellipse cx={x} cy={y} rx={r*0.13} ry={r*0.17} fill="#D6373E" stroke="#F0C85A" strokeWidth={sw*0.55}/>
          <path d={`M${x-r*0.11} ${y-r*0.05} H${x+r*0.11} M${x-r*0.1} ${y+r*0.06} H${x+r*0.1}`} stroke="#F4D16A" strokeWidth={sw*0.35}/>
          <circle cx={x} cy={y} r={r*0.035} fill="#FFEAA0">{pulse(`${2.7+i*0.35}s`)}</circle>
          <path d={`M${x} ${y+r*0.17} v${r*0.14}`} stroke="#E5B84B" strokeWidth={sw*0.5}/>
        </g>})}

        {/* Stylised festival firecracker garland: decorative only, with a
            gentle tassel sway rather than a realistic ignition effect. */}
        <g transform={`translate(${cx-r*0.98},${canopyY-r*0.7}) rotate(-7)`}>
          <path d={`M0 ${-r*0.16} Q${r*0.08} ${r*0.08} 0 ${r*0.74}`} stroke="#E9BE4D" strokeWidth={sw*0.65} fill="none"/>
          {Array.from({length:6}).map((_,i)=>{
            const yy=r*(0.02+i*0.125), side=i%2?-1:1, xx=side*r*0.055;
            return <g key={`cracker${i}`} transform={`translate(${xx},${yy}) rotate(${side*13})`}>
              <rect x={-r*0.055} y={-r*0.095} width={r*0.11} height={r*0.19} rx={r*0.025} fill={i%2?"#C62936":"#E04443"} stroke="#8D2330" strokeWidth={sw*0.35}/>
              <path d={`M${-r*0.047} ${-r*0.068} H${r*0.047} M${-r*0.047} ${r*0.068} H${r*0.047}`} stroke="#F0CB61" strokeWidth={sw*0.35}/>
            </g>;
          })}
          <path d={sgDiamondPath(0,r*0.83,r*0.075,r*0.09)} fill="#C72D39" stroke="#F0CB61" strokeWidth={sw*0.4}/>
          {[-0.04,0,0.04].map((dx,i)=><path key={`crackertassel${i}`} d={`M${dx*r} ${r*0.9} v${r*0.16}`} stroke="#E2B748" strokeWidth={sw*0.4} strokeLinecap="round">{animated&&bob(r*0.02,`${4+i*0.25}s`,`${i*0.16}s`)}</path>)}
          {t>=3&&<path d={sgStarPath(r*0.13,r*0.79,r*0.055)} fill="#FFF0A2">{pulse("2.4s")}</path>}
        </g>

        {/* Ceremonial drum */}
        <g transform={`translate(${cx-r*0.78},${baseY-r*0.02})`}>
          <ellipse cy={-r*0.17} rx={r*0.29} ry={r*0.12} fill="#F1D183" stroke="#7C3528" strokeWidth={sw*0.75}/>
          <path d={`M${-r*0.29} ${-r*0.17} v${r*0.27} q${r*0.29} ${r*0.11} ${r*0.58} 0 v-${r*0.27}`}
            fill="#A92C35" stroke="#7C3528" strokeWidth={sw*0.7}/>
          <ellipse cy={r*0.1} rx={r*0.29} ry={r*0.11} fill="#85242D"/>
          {[-0.2,-0.07,0.07,0.2].map((dx,i)=><circle key={`drumstud${i}`} cx={dx*r} cy={-r*0.17} r={r*0.022} fill="#D8A83C"/>)}
          <path d={`M${-r*0.18} ${-r*0.36} L${r*0.05} ${-r*0.13} M${r*0.2} ${-r*0.37} L${-r*0.02} ${-r*0.13}`}
            stroke="#6B4028" strokeWidth={sw*0.7} strokeLinecap="round"/>
          {t>=3&&<circle cy={-r*0.17} r={r*0.17} fill="#F5D876" opacity="0.16">{pulse("1.8s")}</circle>}
        </g>

        {/* Choy Cheng prosperity greens, red-packet cluster and lucky oranges. */}
        <g transform={`translate(${cx+r*0.74},${baseY-r*0.02})`}>
          {[-0.12,0,0.12].map((dx,i)=><path key={`green${i}`} d={`M${dx*r} 0 Q${dx*r-r*0.13} -${r*(0.28+i*0.035)} ${dx*r} -${r*(0.38+i*0.025)} Q${dx*r+r*0.13} -${r*(0.28+i*0.035)} ${dx*r} 0 Z`}
            fill={i%2?"#4C9855":"#68AE5F"} stroke="#34733F" strokeWidth={sw*0.35}/>) }
          {[[-0.12,-0.13,-10],[0,-0.18,2],[0.13,-0.12,11]].map(([dx,dy,rot],i)=><g key={`packet${i}`} transform={`translate(${dx*r},${dy*r}) rotate(${rot})`}>
            <rect x={-r*0.13} y={-r*0.11} width={r*0.26} height={r*0.2} rx={r*0.025} fill={i===1?"#D9363F":"#BF2734"} stroke="#F0C85A" strokeWidth={sw*0.42}/>
            <path d={`M${-r*0.11} ${-r*0.085} L0 ${-r*0.01} L${r*0.11} ${-r*0.085}`} stroke="#F2C95C" strokeWidth={sw*0.35} fill="none"/>
            <circle cy={r*0.025} r={r*0.037} fill="#E7BE53"/>
          </g>)}
        </g>
        {[-0.22,0.08,0.3].map((dx,i)=><g key={`orange${i}`} transform={`translate(${cx+dx*r},${baseY-r*(0.08+(i%2)*0.04)})`}>
          <circle r={r*0.085} fill="#F19A35" stroke="#CE6F26" strokeWidth={sw*0.35}/><path d={`M0 -${r*0.08} q${r*0.06} -${r*0.08} ${r*0.11} -${r*0.01}`} stroke="#4F8C4A" strokeWidth={sw*0.45} fill="none"/>
        </g>)}
      </>}

      {t>=3 && <>
        {/* Fortune seal, dancing ribbons and gold motes complete the heavy hitter. */}
        <g transform={`translate(${cx+r*0.91},${canopyY-r*0.72})`}>
          <circle r={r*0.2} fill="#A92735" stroke="#F1CB5B" strokeWidth={sw*0.8}/>
          <circle r={r*0.155} fill="none" stroke="#F5DD86" strokeWidth={sw*0.35} opacity="0.85"/>
          <text x="0" y={r*0.07} textAnchor="middle" fontSize={r*0.22} fontWeight="800" fill="#F7D975">福</text>
        </g>
        {[-1,1].map((side,i)=><path key={`lribbon${i}`}
          d={`M${cx+side*r*0.58} ${canopyY-r*0.66} Q${cx+side*r*1.08} ${canopyY-r*0.95} ${cx+side*r*1.12} ${canopyY-r*0.4} Q${cx+side*r*0.98} ${canopyY-r*0.1} ${cx+side*r*1.22} ${canopyY+r*0.08}`}
          stroke={i?"#F1C95A":"#D84646"} strokeWidth={sw*0.8} fill="none" strokeLinecap="round" opacity="0.82">
          {animated&&<animate attributeName="d" values={`M${cx+side*r*0.58} ${canopyY-r*0.66} Q${cx+side*r*1.08} ${canopyY-r*0.95} ${cx+side*r*1.12} ${canopyY-r*0.4} Q${cx+side*r*0.98} ${canopyY-r*0.1} ${cx+side*r*1.22} ${canopyY+r*0.08};M${cx+side*r*0.58} ${canopyY-r*0.66} Q${cx+side*r*0.95} ${canopyY-r*0.82} ${cx+side*r*1.18} ${canopyY-r*0.34} Q${cx+side*r*1.03} ${canopyY-r*0.02} ${cx+side*r*1.15} ${canopyY+r*0.12};M${cx+side*r*0.58} ${canopyY-r*0.66} Q${cx+side*r*1.08} ${canopyY-r*0.95} ${cx+side*r*1.12} ${canopyY-r*0.4} Q${cx+side*r*0.98} ${canopyY-r*0.1} ${cx+side*r*1.22} ${canopyY+r*0.08}`} dur={`${4.2+i*0.45}s`} repeatCount="indefinite"/>}
        </path>)}
        {[[-1.02,-0.28],[-0.68,-0.94],[0.62,-1.02],[1.04,-0.18],[-0.35,0.58],[0.38,0.56]].map(([dx,dy],i)=><path key={`lionspark${i}`}
          d={sgStarPath(cx+dx*r,canopyY+dy*r,r*(0.05+(i%2)*0.015))} fill={i%2?"#FFF0A2":"#F1C754"}>{pulse(`${2.2+i*0.3}s`,`${i*0.18}s`)}</path>)}
      </>}
    </g>
  );

  if(theme==="king") return (
    <g pointerEvents="none">
      {/* Layered royal foliage gives the oak the compact, collectible-detail
          look of the reference skins without increasing the tree footprint. */}
      <g opacity="0.92">
        <circle cx={cx-r*0.62} cy={canopyY-r*0.2} r={r*0.25} fill="#285D3B" opacity="0.62"/>
        <circle cx={cx+r*0.57} cy={canopyY-r*0.28} r={r*0.23} fill="#2B6240" opacity="0.68"/>
        <circle cx={cx-r*0.1} cy={canopyY-r*0.62} r={r*0.26} fill="#477F50" opacity="0.52"/>
        {[[-0.7,-0.5],[-0.38,-0.84],[0.35,-0.82],[0.7,-0.48]].map(([dx,dy],i)=><path
          key={`kleaf${i}`} d={sgDiamondPath(cx+dx*r,canopyY+dy*r,r*0.055,r*0.1)}
          fill={i%2?"#F1D36A":"#D9B33A"} opacity="0.9" transform={`rotate(${i%2?28:-28} ${cx+dx*r} ${canopyY+dy*r})`}/>)}
      </g>
      <path d={`M${cx-r*0.78} ${canopyY-r*0.24} Q${cx} ${canopyY-r*0.72} ${cx+r*0.78} ${canopyY-r*0.24}`} stroke="#E3BE4D" strokeWidth={sw*1.05} fill="none" opacity="0.78"/>

      {/* The crown is the King's Oak signature, so it is present at every
          tier and seated directly on the highest canopy lobe. It deliberately
          has no independent bobbing transform: the whole tree can sway while
          the crown stays attached instead of hovering above it. */}
      <g transform={`translate(${cx},${canopyY-r*0.98})`}>
        <ellipse cx="0" cy={r*0.25} rx={r*0.43} ry={r*0.1} fill="#173F2A" opacity="0.22"/>
        <path d={`M${-r*0.5} ${r*0.12}
          L${-r*0.44} ${-r*0.23}
          L${-r*0.21} ${-r*0.02}
          L0 ${-r*0.39}
          L${r*0.21} ${-r*0.02}
          L${r*0.44} ${-r*0.23}
          L${r*0.5} ${r*0.12} Z`}
          fill="#F3CA4E" stroke="#A87313" strokeWidth={sw*0.9} strokeLinejoin="round"/>
        <path d={`M${-r*0.41} ${r*0.04} L${-r*0.37} ${-r*0.12} L${-r*0.2} ${r*0.035} L0 ${-r*0.27} L${r*0.2} ${r*0.035} L${r*0.37} ${-r*0.12} L${r*0.41} ${r*0.04}`}
          stroke="#FFF0A0" strokeWidth={sw*0.7} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.8"/>
        <rect x={-r*0.5} y={r*0.1} width={r} height={r*0.18} rx={r*0.045} fill="#DDAE2C" stroke="#A87313" strokeWidth={sw*0.65}/>
        <rect x={-r*0.43} y={r*0.125} width={r*0.86} height={r*0.045} rx={r*0.02} fill="#FFF0A0" opacity="0.56"/>
        {[-0.28,0,0.28].map((dx,i)=><g key={`kj${i}`}>
          <circle cx={dx*r} cy={r*0.19} r={r*0.055} fill={i===1?"#D94355":"#4E84E8"} stroke="#FFF2A8" strokeWidth={sw*0.35}/>
          <circle cx={dx*r-r*0.015} cy={r*0.175} r={r*0.014} fill="#FFFFFF" opacity="0.78"/>
        </g>)}
        {t>=3 && <path d={sgStarPath(r*0.43,-r*0.28,r*0.075)} fill="#FFF1A6">{pulse("2.8s")}</path>}
      </g>

      {/* trunk banner and royal seal */}
      <path d={`M${cx-r*0.08} ${baseY-trunkH*0.82} H${cx+r*0.48} L${cx+r*0.4} ${baseY-trunkH*0.56} H${cx-r*0.08} Z`} fill="#9E2E38" stroke="#E8C557" strokeWidth={sw*0.65}/>
      <circle cx={cx+r*0.19} cy={baseY-trunkH*0.68} r={r*0.055} fill="#F0CF63" stroke="#8E6416" strokeWidth={sw*0.4}/>
      <path d={sgStarPath(cx+r*0.19,baseY-trunkH*0.68,r*0.03)} fill="#A8333F"/>
      {t>=1 && [[-0.56,-0.27],[0.55,-0.3]].map(([dx,dy],i)=><g key={`kac1${i}`} transform={`translate(${cx+dx*r},${canopyY+dy*r})`}>
        <ellipse cy={r*0.035} rx={r*0.075} ry={r*0.1} fill="#DCAA2D"/>
        <path d={`M${-r*0.075} ${-r*0.005} Q0 ${-r*0.095} ${r*0.075} ${-r*0.005}`} fill="#765327"/>
      </g>)}
      {t>=2 && <>
        {[[-0.62,-0.46],[0.62,-0.44]].map(([dx,dy],i)=>{const x=cx+dx*r,y=canopyY+dy*r;return <g key={`kl${i}`}><path d={`M${x} ${y-r*0.32} V${y-r*0.06}`} stroke="#7B5A36" strokeWidth={sw}/><rect x={x-r*0.1} y={y-r*0.06} width={r*0.2} height={r*0.22} rx={r*0.025} fill="#F0C85A" stroke="#8D692F" strokeWidth={sw*0.55}/><circle cx={x} cy={y+r*0.05} r={r*0.035} fill="#FFF3B0">{pulse(`${2.8+i*0.4}s`)}</circle></g>})}
        <path d={`M${cx-r*1.08} ${baseY+r*0.02} Q${cx} ${baseY-r*0.56} ${cx+r*1.08} ${baseY+r*0.02}`} stroke="#D7D0C0" strokeWidth={r*0.34} fill="none" opacity="0.9"/>
        {[[-0.85,-0.02],[0.86,-0.02]].map(([dx,dy],i)=><g key={`stat${i}`} transform={`translate(${cx+dx*r},${baseY+dy*r})`}><rect x={-r*0.1} y={-r*0.35} width={r*0.2} height={r*0.3} fill="#E9E6DF"/><circle cy={-r*0.43} r={r*0.11} fill="#F2EFE9"/><rect x={-r*0.14} y={-r*0.06} width={r*0.28} height={r*0.07} fill="#D5D0C6"/></g>)}
        {[[-0.42,-0.55],[0.38,-0.7],[0.64,-0.28]].map(([dx,dy],i)=><g key={`ac${i}`} transform={`translate(${cx+dx*r},${canopyY+dy*r})`}><ellipse rx={r*0.08} ry={r*0.11} fill="#D9AA2B"/><path d={`M${-r*0.08} ${-r*0.07} Q0 ${-r*0.15} ${r*0.08} ${-r*0.07}`} fill="#8C6A2A"/></g>)}
        <path d={`M${cx-r*0.19} ${baseY-r*0.05} Q${cx-r*0.38} ${baseY-trunkH*0.35} ${cx-r*0.05} ${baseY-trunkH*0.62} Q${cx+r*0.24} ${baseY-trunkH*0.78} ${cx-r*0.08} ${baseY-trunkH*0.95}`} stroke="#4B8B50" strokeWidth={sw*1.15} fill="none"/>
        {[[-1.02,-0.4],[1.02,-0.42]].map(([dx,dy],i)=><g key={`flag${i}`}><path d={`M${cx+dx*r} ${baseY-r*0.02} V${canopyY+dy*r}`} stroke="#8A6A3A" strokeWidth={sw}/><path d={`M${cx+dx*r} ${canopyY+dy*r} h${(i? -1:1)*r*0.4} l${(i?-1:1)*-r*0.08} ${r*0.13} h${(i?1:-1)*r*0.32} Z`} fill="#A8333F" stroke="#E4BF54" strokeWidth={sw*0.45}/></g>)}
      </>}
      {t>=3 && <>
        {/* fountain and benches */}
        <g transform={`translate(${cx+r*0.76},${baseY-r*0.02})`}><ellipse cy="0" rx={r*0.35} ry={r*0.1} fill="#D7DCE2"/><ellipse cy={-r*0.08} rx={r*0.27} ry={r*0.09} fill="#8FD0EE"/><path d={`M0 ${-r*0.1} q${-r*0.12} -${r*0.38} 0 -${r*0.54} q${r*0.12} ${r*0.16} 0 ${r*0.54}`} stroke="#A9DFF4" strokeWidth={sw} fill="none">{animated&&<animate attributeName="d" values={`M0 ${-r*0.1} q${-r*0.12} -${r*0.32} 0 -${r*0.5} q${r*0.12} ${r*0.18} 0 ${r*0.5};M0 ${-r*0.1} q${-r*0.14} -${r*0.4} 0 -${r*0.58} q${r*0.14} ${r*0.18} 0 ${r*0.58};M0 ${-r*0.1} q${-r*0.12} -${r*0.32} 0 -${r*0.5} q${r*0.12} ${r*0.18} 0 ${r*0.5}`} dur="2.4s" repeatCount="indefinite"/>}</path></g>
        <g transform={`translate(${cx-r*0.82},${baseY-r*0.04})`}><rect x={-r*0.28} y={-r*0.18} width={r*0.56} height={r*0.09} rx={r*0.03} fill="#9A6A3A"/><path d={`M${-r*0.23} ${-r*0.08} v${r*0.16} M${r*0.23} ${-r*0.08} v${r*0.16}`} stroke="#6D4928" strokeWidth={sw}/></g>
        {[[-0.9,-0.95],[0.86,-0.76]].map(([dx,dy],i)=><g key={`dove${i}`} transform={`translate(${cx+dx*r},${canopyY+dy*r})`}><ellipse rx={r*0.11} ry={r*0.06} fill="#FFFFFF"/><circle cx={r*0.1} cy={-r*0.04} r={r*0.055} fill="#FFFFFF"/><path d={`M${-r*0.02} 0 q${-r*0.12} -${r*0.14} -${r*0.2} -${r*0.02}`} stroke="#F8F8F8" strokeWidth={sw*1.2} fill="none">{animated&&<animateTransform attributeName="transform" type="rotate" values="-8 0 0;16 0 0;-8 0 0" dur={`${1.4+i*0.2}s`} repeatCount="indefinite"/>}</path></g>)}
        {[[-1.05,-0.2],[0.95,-0.45],[-0.35,-1.2],[0.45,-1.1]].map(([dx,dy],i)=><path key={`ks${i}`} d={sgStarPath(cx+dx*r,canopyY+dy*r,r*0.06)} fill="#F3CE58">{pulse(`${2.5+i*0.35}s`,`${i*0.25}s`)}</path>)}
      </>}
    </g>
  );

  if(theme==="diamond") return (
    <g pointerEvents="none">
      {/* Faceted canopy layers make the pale tree readable on white cards. */}
      <g opacity="0.86">
        <circle cx={cx-r*0.58} cy={canopyY-r*0.2} r={r*0.23} fill="#A9DFF2" opacity="0.48"/>
        <circle cx={cx+r*0.54} cy={canopyY-r*0.3} r={r*0.22} fill="#BCEBFA" opacity="0.52"/>
        <path d={sgDiamondPath(cx-r*0.12,canopyY-r*0.64,r*0.24,r*0.31)} fill="#F7FEFF" opacity="0.46"/>
      </g>

      {/* The diamond is locked into a crystal collar on the highest lobe at
          every tier; only its glint intensifies at Radiant. */}
      <g transform={`translate(${cx},${canopyY-r*1.05})`}>
        <path d={`M${-r*0.34} ${r*0.38} L${-r*0.23} ${r*0.2} H${r*0.23} L${r*0.34} ${r*0.38} Z`}
          fill="#9DDDF4" stroke="#F5FEFF" strokeWidth={sw*0.7}/>
        <path d={sgDiamondPath(0,0,r*0.36,r*0.48)} fill="#DDF7FF" stroke="#FFFFFF" strokeWidth={sw*1.05}/>
        <path d={`M0 ${-r*0.48} L0 ${r*0.48} M${-r*0.36} 0 H${r*0.36} M${-r*0.36} 0 L0 ${-r*0.48} L${r*0.36} 0`}
          stroke="#79CBE9" strokeWidth={sw*0.52} fill="none" opacity="0.86"/>
        <path d={`M${-r*0.19} ${-r*0.18} L${-r*0.05} ${-r*0.36}`} stroke="#FFFFFF" strokeWidth={sw*0.75} strokeLinecap="round" opacity="0.82"/>
        {t>=3 && <path d={sgStarPath(r*0.34,-r*0.34,r*0.08)} fill="#FFFFFF">{pulse("2.25s")}</path>}
      </g>

      {/* crystal facets, roots and grass */}
      {[[-0.58,-0.42],[0.12,-0.72],[0.58,-0.18],[-0.18,-1.02]].map(([dx,dy],i)=><path key={`df${i}`} d={sgDiamondPath(cx+dx*r,canopyY+dy*r,r*(0.11+(i%2)*0.025),r*(0.17+(i%2)*0.03))} fill={i%2?"#F5FDFF":"#C9EFFF"} stroke="#FFFFFF" strokeWidth={sw*0.55} opacity="0.86">{pulse(`${2.4+i*0.35}s`,`${i*0.25}s`)}</path>)}
      {[[-0.7,-0.02],[-0.38,-0.05],[0.36,-0.04],[0.72,-0.02]].map(([dx,dy],i)=><path key={`grass${i}`} d={sgDiamondPath(cx+dx*r,baseY+dy*r,r*0.07,r*(0.2+(i%2)*0.06))} fill="#B7E8F7" opacity="0.82"/>)}
      <path d={`M${cx-r*0.08} ${baseY-trunkH*0.9} L${cx+r*0.05} ${baseY-trunkH*0.58} L${cx-r*0.05} ${baseY-trunkH*0.28} M${cx+r*0.13} ${baseY-trunkH*0.75} L${cx-r*0.02} ${baseY-trunkH*0.48}`} stroke="#F7FFFF" strokeWidth={sw*0.7} fill="none" opacity="0.8"/>
      {t>=2 && <>
        {[[-0.62,-0.5],[0.04,-0.72],[0.58,-0.38]].map(([dx,dy],i)=>{const x=cx+dx*r,y=canopyY+dy*r;return <g key={`sh${i}`}><path d={`M${x} ${y-r*0.42} V${y-r*0.04}`} stroke="#D8F4FF" strokeWidth={sw*0.75}/><path d={sgDiamondPath(x,y,r*0.09,r*0.17)} fill="#EAFBFF" stroke="#FFFFFF" strokeWidth={sw*0.45}/></g>})}
        {[[-0.86,-0.05],[0.82,-0.04]].map(([dx,dy],i)=><path key={`big${i}`} d={sgDiamondPath(cx+dx*r,baseY+dy*r-r*0.16,r*0.18,r*0.34)} fill={i?"#AEE4FF":"#D8F7FF"} stroke="#FFFFFF" strokeWidth={sw}/>) }
        {[[-0.52,-0.03],[0.52,-0.04]].map(([dx,dy],i)=><g key={`cf${i}`} transform={`translate(${cx+dx*r},${baseY+dy*r})`}>{[0,90,180,270].map(a=><path key={a} d={sgDiamondPath(0,-r*0.08,r*0.055,r*0.11)} fill="#EAFBFF" transform={`rotate(${a})`}/>)}<circle r={r*0.035} fill="#8DD5F4"/></g>)}
        {[[-1.02,-0.45],[0.92,-0.72],[0.2,-1.15]].map(([dx,dy],i)=><path key={`fg${i}`} d={sgDiamondPath(cx+dx*r,canopyY+dy*r,r*0.09,r*0.15)} fill="#C5EFFF" opacity="0.88">{bob(r*0.22,`${4+i*0.6}s`,`${i*0.35}s`)}</path>)}
        {[[-0.95,-0.04],[0.95,-0.05]].map(([dx,dy],i)=><g key={`bush${i}`} transform={`translate(${cx+dx*r},${baseY+dy*r})`}>{[-0.12,0,0.12].map((ox,j)=><path key={j} d={sgDiamondPath(ox*r,-r*(0.12+j*0.04),r*0.11,r*0.22)} fill={j%2?"#BDEBFA":"#D7F6FF"}/>)}</g>)}
        {[[-0.8,-0.25],[0.72,-0.48],[-0.22,-1.18]].map(([dx,dy],i)=><path key={`frost${i}`} d={sgStarPath(cx+dx*r,canopyY+dy*r,r*0.055)} fill="#FFFFFF">{pulse(`${2.3+i*0.4}s`,`${i*0.28}s`)}</path>)}
      </>}
      {t>=3 && <>
        <g>{animated&&<animateTransform attributeName="transform" type="rotate" from={`0 ${cx} ${canopyY}`} to={`360 ${cx} ${canopyY}`} dur="15s" repeatCount="indefinite"/>}
          {[[0,-1.16],[1.05,-0.12],[-1.0,0.2]].map(([dx,dy],i)=><path key={`orb${i}`} d={sgDiamondPath(cx+dx*r,canopyY+dy*r,r*0.1,r*0.16)} fill="#ECFCFF" stroke="#9DDDF4" strokeWidth={sw*0.45}/>)}
        </g>
        {[[-0.9,-1.0],[-0.35,-1.25],[0.25,-1.18],[0.85,-0.88]].map(([dx,dy],i)=><path key={`ray${i}`} d={`M${cx} ${canopyY-r*0.2} L${cx+dx*r} ${canopyY+dy*r}`} stroke={["#FF8FA3","#FFD36A","#82D8FF","#BFA4FF"][i]} strokeWidth={sw*0.75} opacity="0.28"/>)}
        {[[-1.08,-0.34],[0.98,-0.55],[-0.5,-1.38],[0.5,-1.3],[0.18,0.55]].map(([dx,dy],i)=><path key={`spark${i}`} d={sgStarPath(cx+dx*r,canopyY+dy*r,r*(0.055+(i%2)*0.018))} fill="#FFFFFF">{pulse(`${2.1+i*0.3}s`,`${i*0.2}s`)}</path>)}
      </>}
    </g>
  );

  return null;
}

// ── Mythical skin details ─────────────────────────────────────────────────────
// The mystical collection uses the same two-layer contract as the flagship
// skins. Keeping the renderer shared between previews and the permanent garden
// prevents tier art from drifting into a separate, out-of-sync implementation.
const MYTHICAL_DECOR = {
  neon:      { accent:"#58F0B4", pale:"#E4FFF4", glow:"#22E39A", motif:"orb",   arc:"halo" },
  galaxy:    { accent:"#B892FF", pale:"#F2E9FF", glow:"#7A4FB0", motif:"star",  arc:"orbit" },
  enchanted: { accent:"#E8D36A", pale:"#ECFFD9", glow:"#8FE0A0", motif:"leaf",  arc:"vine" },
  moonlit:   { accent:"#BBD9FF", pale:"#FFF2B8", glow:"#7FA8E8", motif:"moon",  arc:"orbit" },
  starlight: { accent:"#FFD66B", pale:"#FFF4C7", glow:"#8FB0E8", motif:"star",  arc:"orbit" },
  celestial: { accent:"#D7C4FF", pale:"#FFF0FF", glow:"#9BA8E8", motif:"petal", arc:"orbit" },
  rainbow:   { accent:"#FFB45B", pale:"#FFF4D6", glow:"#F8F5FF", motif:"prism", arc:"rainbow" },
  lightning: { accent:"#8FC3FF", pale:"#EDF6FF", glow:"#7FA8FF", motif:"bolt",  arc:"storm" },
};

function MythicalTreeDetails({ skinId, cx, baseY, canopyY, r, trunkH, tier=0, paused=false, layer="front", seed=0 }) {
  if(skinId==="lightning") return <LightningTreeDetails cx={cx} baseY={baseY} canopyY={canopyY} r={r} trunkH={trunkH} tier={tier} paused={paused} layer={layer} seed={seed}/>;
  const cfg = MYTHICAL_DECOR[skinId];
  const t = Math.max(0, Math.min(3, tier||0));
  if(!cfg || t<1 || r<=0) return null;

  const animated = !paused;
  const sw = Math.max(0.6, r*0.046);
  const phase = `${(seed%5)*0.18}s`;
  const pulse = (dur="4s", begin=phase) => animated
    ? <animate attributeName="opacity" values="0.35;0.95;0.35" dur={dur} begin={begin} repeatCount="indefinite"/>
    : null;
  const bob = (amount, dur="4s", begin=phase) => animated
    ? <animateTransform attributeName="transform" type="translate" values={`0 0;0 ${-amount};0 0`}
        dur={dur} begin={begin} repeatCount="indefinite" calcMode="spline"
        keySplines="0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.5;1"/>
    : null;

  const motif = (x,y,s,key,soft=false) => {
    const fill = soft ? cfg.pale : cfg.accent;
    if(cfg.motif==="star") return <path key={key} d={sgStarPath(x,y,s)} fill={fill}/>;
    if(cfg.motif==="prism") return <path key={key} d={sgDiamondPath(x,y,s*0.72,s)} fill={fill} stroke="#FFFFFF" strokeWidth={sw*0.5}/>;
    if(cfg.motif==="bolt") return <path key={key} d={`M${x+s*0.12} ${y-s} L${x-s*0.46} ${y+s*0.06} H${x-s*0.06} L${x-s*0.2} ${y+s} L${x+s*0.52} ${y-s*0.12} H${x+s*0.12} Z`} fill={fill}/>;
    if(cfg.motif==="leaf") return <path key={key} d={`M${x} ${y+s} Q${x-s*0.9} ${y} ${x} ${y-s} Q${x+s*0.9} ${y} ${x} ${y+s} Z`} fill={fill}/>;
    if(cfg.motif==="moon") return <path key={key} d={`M${x+s*0.45} ${y-s*0.78} C${x-s*0.62} ${y-s*0.55} ${x-s*0.62} ${y+s*0.55} ${x+s*0.45} ${y+s*0.78} C${x-s*0.08} ${y+s*0.34} ${x-s*0.08} ${y-s*0.34} ${x+s*0.45} ${y-s*0.78} Z`} fill={fill}/>;
    if(cfg.motif==="petal") return <g key={key} transform={`translate(${x},${y})`}>{[0,90,180,270].map(a=><ellipse key={a} cy={-s*0.45} rx={s*0.3} ry={s*0.56} fill={fill} transform={`rotate(${a})`}/>)}</g>;
    return <circle key={key} cx={x} cy={y} r={s*0.62} fill={fill}/>;
  };

  if(layer==="back") {
    return (
      <g pointerEvents="none">
        <ellipse cx={cx} cy={canopyY+r*0.08} rx={r*1.32} ry={r*1.02} fill={cfg.glow} opacity="0.11">
          {pulse("5.2s")}
        </ellipse>
        <ellipse cx={cx} cy={baseY+r*0.01} rx={r*1.02} ry={r*0.25} fill={cfg.glow} opacity="0.12"/>
        {t>=3 && cfg.arc==="rainbow" && ["#FF7A8A","#FFD66B","#72D7C5"].map((c,i)=>(
          <path key={c} d={`M${cx-r*(1.16-i*0.07)} ${canopyY+r*0.12} Q${cx} ${canopyY-r*(1.5-i*0.1)} ${cx+r*(1.16-i*0.07)} ${canopyY+r*0.12}`}
            stroke={c} strokeWidth={sw*0.9} fill="none" opacity="0.38"/>
        ))}
        {t>=3 && cfg.arc!=="rainbow" && (
          <ellipse cx={cx} cy={canopyY-r*0.08} rx={r*1.18} ry={r*1.02}
            fill="none" stroke={cfg.accent} strokeWidth={sw} strokeDasharray={`${r*0.18} ${r*0.16}`} opacity="0.34">
            {animated && <animateTransform attributeName="transform" type="rotate"
              from={`0 ${cx} ${canopyY-r*0.08}`} to={`360 ${cx} ${canopyY-r*0.08}`}
              dur={cfg.arc==="storm"?"13s":"20s"} repeatCount="indefinite"/>}
          </ellipse>
        )}
        {t>=3 && cfg.arc==="storm" && [-1,1].map((side,i)=>(
          <path key={side} d={`M${cx+side*r*1.02} ${canopyY-r*0.58} l${-side*r*0.18} ${r*0.3} h${side*r*0.12} l${-side*r*0.2} ${r*0.34}`}
            stroke={cfg.pale} strokeWidth={sw*0.9} fill="none" opacity="0.66">
            {pulse(`${2.2+i*0.35}s`,`${i*0.3}s`)}
          </path>
        ))}
      </g>
    );
  }

  return (
    <g pointerEvents="none">
      {/* Flourish: a restrained signature at the roots and three canopy marks. */}
      {[-0.62,-0.3,0,0.3,0.62].map((dx,i)=>(
        <path key={`root${i}`} d={`M${cx+dx*r} ${baseY} q${(i%2?-1:1)*r*0.05} -${r*(0.2+(i%2)*0.06)} ${(i%2?-1:1)*r*0.1} -${r*0.3}`}
          stroke={i%2?cfg.accent:cfg.pale} strokeWidth={sw} fill="none" strokeLinecap="round" opacity="0.78"/>
      ))}
      {[[-0.55,-0.38],[0.05,-0.78],[0.58,-0.24]].map(([dx,dy],i)=>(
        <g key={`mark${i}`} opacity={0.76}>
          {motif(cx+dx*r,canopyY+dy*r,r*(0.075+(i%2)*0.012),`m${i}`,i===1)}
          {pulse(`${2.8+i*0.45}s`,`${i*0.25}s`)}
        </g>
      ))}

      {/* Every upgraded mythical skin gets its own attached canopy crest.
          The emblem grows slightly by tier but stays seated on the tree; this
          replaces the old Radiant-only symbol that hovered far above it. */}
      <g transform={`translate(${cx},${canopyY-r*0.97})`}>
        <ellipse cy={r*0.2} rx={r*(0.2+t*0.025)} ry={r*0.065} fill={cfg.glow} opacity="0.24"/>
        <g>{motif(0,0,r*(0.13+t*0.027),"crest",false)}</g>
        {t>=2 && <path d={sgStarPath(r*0.2,-r*0.17,r*0.045)} fill={cfg.pale} opacity="0.92">{pulse("2.7s")}</path>}
      </g>

      {/* Living: paired hanging charms and small root crystals. */}
      {t>=2 && <>
        {[[-0.52,-0.42],[0.52,-0.36]].map(([dx,dy],i)=>{
          const x=cx+dx*r, y=canopyY+dy*r;
          return <g key={`charm${i}`}>
            <path d={`M${x} ${y-r*0.34} V${y-r*0.02}`} stroke={cfg.pale} strokeWidth={sw*0.75} opacity="0.78"/>
            <g>{bob(r*0.1,`${4.2+i*0.6}s`,`${i*0.35}s`)}{motif(x,y+r*0.08,r*0.115,`cm${i}`,i===1)}</g>
          </g>;
        })}
        {[[-0.82,0.01],[0.82,0.01]].map(([dx,dy],i)=>(
          <path key={`crystal${i}`} d={sgDiamondPath(cx+dx*r,baseY+dy*r-r*0.13,r*0.095,r*0.18)}
            fill={i?cfg.accent:cfg.pale} stroke="#FFFFFF" strokeWidth={sw*0.4} opacity="0.88"/>
        ))}
      </>}

      {/* Radiant: a slow, sparse orbit around the now-attached crest. */}
      {t>=3 && <>
        <g>
          {animated && <animateTransform attributeName="transform" type="rotate"
            from={`0 ${cx} ${canopyY}`} to={`360 ${cx} ${canopyY}`}
            dur={cfg.arc==="storm"?"12s":"17s"} repeatCount="indefinite"/>}
          {[[0,-1.13],[1.03,-0.04],[-0.98,0.16]].map(([dx,dy],i)=>
            motif(cx+dx*r,canopyY+dy*r,r*0.07,`orb${i}`,i===1))}
        </g>
        {[[-1.02,-0.28],[0.94,-0.54]].map(([dx,dy],i)=>(
          <circle key={`mote${i}`} cx={cx+dx*r} cy={canopyY+dy*r} r={r*0.032} fill={cfg.pale}>
            {pulse(`${2.6+i*0.5}s`,`${i*0.45}s`)}
          </circle>
        ))}
      </>}
    </g>
  );
}

// ── Tree SVG ──────────────────────────────────────────────────────────────────
function TreeSVG({ progress, color, paused, large, skin, enhance=0, thumbnail=false }) {
  const gradId = useId().replace(/:/g,"");
  const activeSkin = TREE_SKINS.find(s=>s.id===(skin||"default")) || TREE_SKINS[0];
  const visualTier=Math.max(0,Math.min(3,Number(enhance)||0));
  const visualProfile=getTreeVisualProfile(activeSkin,visualTier);
  const shape = activeSkin.shape || "round";
  const trunkColor  = activeSkin.trunk;
  const canopyColor = activeSkin.canopy || color;
  const size=large?240:160;
  const trunkH=(30+progress*55)*(visualProfile.trunkScale||1);
  const canopyR=(10+progress*68)*(visualProfile.canopyScale||1);
  const opacity=paused&&!thumbnail?0.5:(0.25+progress*0.75);
  const cx=large?120:80, cy=large?230:170;
  const baseProps = {
    viewBox:thumbnail?"-35 -90 230 280":`0 0 ${large?240:160} ${large?250:180}`,
    width:thumbnail?"100%":size,
    height:thumbnail?"100%":large?250:180,
    "aria-hidden":thumbnail?true:undefined,
    focusable:thumbnail?false:undefined,
    style:{overflow:"visible",filter:paused&&!thumbnail?"grayscale(60%)":"none",transition:"filter 0.4s"}
  };
  const shadow = <ellipse cx={cx} cy={cy} rx={(20+progress*38)*Math.min(1.22,visualProfile.width||1)} ry={7*Math.min(1.12,visualProfile.height||1)}
    fill={`rgba(25,43,31,${visualProfile.shadowOpacity||.14})`} opacity=".58"/>;
  const sparkle = progress>=1&&!paused&&(
    <>
      <path d={sgStarPath(cx-30,cy-trunkH-canopyR*1.8,large?6.5:4.7)} fill="#FFD34D"/>
      <path d={sgStarPath(cx+18,cy-trunkH-canopyR*2.1,large?5.4:3.9)} fill="#FFF0A0"/>
    </>
  );
  const pauseIcon = paused&&!thumbnail&&<g opacity={0.7} transform={`translate(${cx},${cy-trunkH-canopyR*1.5})`}><rect x={large?-8:-5} y={large?-19:-12} width={large?7:4.5} height={large?19:12} rx={large?2:1.2} fill="#666"/><rect x={large?1:0.5} y={large?-19:-12} width={large?7:4.5} height={large?19:12} rx={large?2:1.2} fill="#666"/></g>;

  // Each shape draws its "crown" once the sprout has grown a little, and
  // records exactly where a Radiant-tier companion should rest — a real
  // point ON that shape's own geometry, not a guessed offset from a generic
  // "canopy centre" (that mismatch is why visitors used to float off-model
  // on some silhouettes).
  let crown = null;
  let perchPoint = null;
  const grown = progress>0.04;
  if(shape==="pine"){
    // Layered triangular conifer
    const w = canopyR*1.5, topY = cy-trunkH;
    const frosted = !!activeSkin.frosted;
    perchPoint = { x: cx+w*0.39, y: topY-canopyR*0.55, face:1 }; // right corner of the 2nd tier — a real branch tip
    crown = grown && (
      <g opacity={opacity}>
        {[0,1,2].map(i=>{
          const ly = topY - i*canopyR*0.55;
          const lw = w*(1 - i*0.22);
          return <polygon key={i} points={`${cx},${ly-canopyR*0.9} ${cx-lw/2},${ly} ${cx+lw/2},${ly}`} fill={canopyColor}/>;
        })}
        <polygon points={`${cx},${topY-canopyR*2.0} ${cx-w*0.28},${topY-canopyR*1.2} ${cx+w*0.28},${topY-canopyR*1.2}`} fill={canopyColor}/>
        {/* Frosted Pine: a dusting of snow along each layer's upper edge */}
        {frosted && [0,1,2].map(i=>{
          const ly = topY - i*canopyR*0.55;
          const lw = w*(1 - i*0.22);
          return <polyline key={`f${i}`} points={`${cx-lw*0.32},${ly-canopyR*0.28} ${cx-lw*0.1},${ly-canopyR*0.5} ${cx},${ly-canopyR*0.62} ${cx+lw*0.12},${ly-canopyR*0.48} ${cx+lw*0.3},${ly-canopyR*0.26}`}
            stroke="#F2FAF6" strokeWidth={canopyR*0.09} fill="none" strokeLinecap="round" opacity={0.85}/>;
        })}
        {frosted && <polygon points={`${cx},${topY-canopyR*2.0} ${cx-w*0.14},${topY-canopyR*1.66} ${cx+w*0.14},${topY-canopyR*1.66}`} fill="#F2FAF6" opacity={0.9}/>}
      </g>
    );
  } else if(shape==="blossom"){
    // Cherry blossom — soft pink puffs + petal dots + falling petals
    perchPoint = { x: cx+canopyR*0.5, y: cy-trunkH-canopyR*1.25, face:1 }; // top of the right puff
    crown = grown && (
      <g>
        <circle cx={cx} cy={cy-trunkH-canopyR*0.45} r={canopyR} fill={canopyColor} opacity={opacity*0.6}/>
        <circle cx={cx-canopyR*0.5} cy={cy-trunkH-canopyR*0.6} r={canopyR*0.6} fill={canopyColor} opacity={opacity*0.7}/>
        <circle cx={cx+canopyR*0.5} cy={cy-trunkH-canopyR*0.65} r={canopyR*0.6} fill={canopyColor} opacity={opacity*0.7}/>
        <circle cx={cx} cy={cy-trunkH-canopyR*0.95} r={canopyR*0.7} fill={canopyColor} opacity={opacity*0.9}/>
        {/* darker petal speckles */}
        {progress>0.3 && [[-0.4,-0.5],[0.3,-0.7],[0,-1.0],[0.5,-0.4],[-0.6,-0.8]].map(([dx,dy],i)=>(
          <circle key={i} cx={cx+dx*canopyR} cy={cy-trunkH-canopyR-dy*canopyR*0.3} r={canopyR*0.13} fill="#F47CA8" opacity={opacity}/>
        ))}
        {progress>=1 && !paused && (
          <>
            <g transform={`translate(${cx-canopyR*1.3},${cy-trunkH-canopyR*0.2})`}><g transform="rotate(0)"><ellipse cx="0" cy="-5" rx="4.620000000000001" ry="2.604" fill="#F89CC8"/></g><g transform="rotate(72)"><ellipse cx="0" cy="-5" rx="4.620000000000001" ry="2.604" fill="#F89CC8"/></g><g transform="rotate(144)"><ellipse cx="0" cy="-5" rx="4.620000000000001" ry="2.604" fill="#F89CC8"/></g><g transform="rotate(216)"><ellipse cx="0" cy="-5" rx="4.620000000000001" ry="2.604" fill="#F89CC8"/></g><g transform="rotate(288)"><ellipse cx="0" cy="-5" rx="4.620000000000001" ry="2.604" fill="#F89CC8"/></g><circle r="2.52" fill="#FFD34D"/></g>
            <g transform={`translate(${cx+canopyR*0.9},${cy-trunkH+canopyR*0.4})`}><g transform="rotate(0)"><ellipse cx="0" cy="-5" rx="3.5200000000000005" ry="1.984" fill="#F89CC8"/></g><g transform="rotate(72)"><ellipse cx="0" cy="-5" rx="3.5200000000000005" ry="1.984" fill="#F89CC8"/></g><g transform="rotate(144)"><ellipse cx="0" cy="-5" rx="3.5200000000000005" ry="1.984" fill="#F89CC8"/></g><g transform="rotate(216)"><ellipse cx="0" cy="-5" rx="3.5200000000000005" ry="1.984" fill="#F89CC8"/></g><g transform="rotate(288)"><ellipse cx="0" cy="-5" rx="3.5200000000000005" ry="1.984" fill="#F89CC8"/></g><circle r="1.92" fill="#FFD34D"/></g>
          </>
        )}
      </g>
    );
  } else if(shape==="willow"){
    perchPoint = { x: cx-canopyR*.82, y: cy-trunkH-canopyR*1.05, face:-1 };
    crown = grown && <WillowCrown cx={cx} baseY={cy} canopyY={cy-trunkH-canopyR*.18} r={canopyR}
      canopyColor={canopyColor} trunkColor={trunkColor} opacity={opacity} pond={activeSkin.id==="willow"}/>;
  } else if(shape==="maple"){
    // Full rounded crown + leaf emojis when grown
    perchPoint = { x: cx+canopyR*0.45, y: cy-trunkH-canopyR*1.55, face:1 }; // top of the right lobe
    crown = grown && (
      <g>
        <circle cx={cx} cy={cy-trunkH-canopyR*0.5} r={canopyR*1.05} fill={canopyColor} opacity={opacity*0.65}/>
        <circle cx={cx-canopyR*0.45} cy={cy-trunkH-canopyR*0.8} r={canopyR*0.7} fill={canopyColor} opacity={opacity*0.8}/>
        <circle cx={cx+canopyR*0.45} cy={cy-trunkH-canopyR*0.85} r={canopyR*0.7} fill={canopyColor} opacity={opacity*0.85}/>
        <circle cx={cx} cy={cy-trunkH-canopyR*1.1} r={canopyR*0.6} fill={canopyColor} opacity={opacity}/>
        {progress>=1 && !paused && <g transform={`translate(${cx+canopyR*0.7},${cy-trunkH-canopyR*0.3})`}><path d={sgStarPath(0,0,large?9:6)} fill="#E0533A" opacity={0.95}/><path d={`M-1.6 0 Q0 3.6 0 8 Q0 3.6 1.6 0 Z`} fill="#C23B22"/></g>}
      </g>
    );
  } else if(shape==="muffin" || shape==="cupcake" || shape==="cake"){
    // Food items: wrapper/base (trunk replacement) + frosting dome (canopy) + topping
    crown = grown && (() => {
      const baseW = canopyR*1.5, baseTop = cy - trunkH*0.7;
      const wrapColor = activeSkin.trunk;
      const frostColor = canopyColor;
      const topping = shape==="muffin" ? "🫐" : shape==="cupcake" ? "🍓" : "🎂";
      if(shape==="cake"){
        // tiered layer cake — plate, drip icing, shine, cherry + candle topper
        const tier=(w,y0,hh,fill)=>(
          <g key={y0}>
            <rect x={cx-w/2} y={y0} width={w} height={hh} rx={4} fill={fill}/>
            <rect x={cx-w/2} y={y0} width={w} height={hh*0.3} rx={4} fill="#fff" opacity={0.22}/>
            {[0.22,0.5,0.78].map(t=>(
              <circle key={t} cx={cx-w/2+w*t} cy={y0+hh*0.32} r={hh*0.16} fill="#fff" opacity={0.6}/>
            ))}
          </g>
        );
        return (
          <g opacity={opacity}>
            <ellipse cx={cx} cy={cy-1} rx={baseW*0.85} ry={canopyR*0.18} fill="#E8E2D6"/>
            <ellipse cx={cx} cy={cy-2.5} rx={baseW*0.85} ry={canopyR*0.16} fill="#FBF7EF"/>
            {tier(baseW*1.4, baseTop-canopyR*0.2, canopyR*0.9, frostColor)}
            {tier(baseW*1.1, baseTop-canopyR*0.95, canopyR*0.8, "#FFE3EC")}
            {tier(baseW*0.8, baseTop-canopyR*1.6, canopyR*0.72, frostColor)}
            {/* candles */}
            {[-0.18,0.02,0.2].map((t,i)=>(
              <g key={i}>
                <rect x={cx+baseW*t-1.2} y={baseTop-canopyR*1.95} width={2.4} height={canopyR*0.34} rx={1.2} fill={i===1?"#F4A7B9":"#A7C4E8"}/>
                {progress>=1&&!paused&&<circle cx={cx+baseW*t} cy={baseTop-canopyR*2.02} r={2}
                  fill="#FFD34D"><animate attributeName="opacity" values="0.6;1;0.6" dur={`${1+i*0.3}s`} repeatCount="indefinite"/></circle>}
              </g>
            ))}
            <circle cx={cx-baseW*0.42} cy={baseTop-canopyR*1.62} r={3} fill="#E5484D"/>
          </g>
        );
      }
      const darker = shape==="muffin" ? "#5A3F8A" : "#D9426F";
      return (
        <g opacity={opacity}>
          {/* little plate grounding the treat */}
          <ellipse cx={cx} cy={cy-1} rx={baseW*0.74} ry={canopyR*0.15} fill="#E8E2D6"/>
          <ellipse cx={cx} cy={cy-2.4} rx={baseW*0.74} ry={canopyR*0.13} fill="#FBF7EF"/>
          {/* pleated wrapper with side shading */}
          <polygon points={`${cx-baseW*0.55},${baseTop} ${cx+baseW*0.55},${baseTop} ${cx+baseW*0.4},${cy-2} ${cx-baseW*0.4},${cy-2}`} fill={wrapColor}/>
          {[-0.36,-0.18,0,0.18,0.36].map((t,i)=>(
            <line key={i} x1={cx+baseW*t*0.9} y1={baseTop+1} x2={cx+baseW*t*0.68} y2={cy-3}
              stroke="rgba(0,0,0,0.10)" strokeWidth={1.4}/>
          ))}
          <polygon points={`${cx+baseW*0.28},${baseTop} ${cx+baseW*0.55},${baseTop} ${cx+baseW*0.4},${cy-2} ${cx+baseW*0.22},${cy-2}`} fill="#000" opacity={0.08}/>
          <rect x={cx-baseW*0.55} y={baseTop-1.5} width={baseW*1.1} height={3} rx={1.5} fill="#fff" opacity={0.3}/>
          {/* frosting dome with drip edge */}
          <ellipse cx={cx} cy={baseTop-canopyR*0.1} rx={baseW*0.62} ry={canopyR*0.52} fill={frostColor}/>
          {[-0.42,-0.14,0.14,0.42].map((t,i)=>(
            <circle key={i} cx={cx+baseW*t} cy={baseTop+canopyR*0.06} r={canopyR*0.16} fill={frostColor}/>
          ))}
          <circle cx={cx-canopyR*0.42} cy={baseTop-canopyR*0.45} r={canopyR*0.46} fill={frostColor}/>
          <circle cx={cx+canopyR*0.42} cy={baseTop-canopyR*0.5} r={canopyR*0.46} fill={frostColor}/>
          <circle cx={cx} cy={baseTop-canopyR*0.88} r={canopyR*0.52} fill={frostColor}/>
          {/* swirl shading + shine */}
          <path d={`M${cx-canopyR*0.5} ${baseTop-canopyR*0.3} Q${cx} ${baseTop-canopyR*0.05} ${cx+canopyR*0.5} ${baseTop-canopyR*0.35}`} stroke={darker} strokeWidth={1.6} fill="none" opacity={0.35} strokeLinecap="round"/>
          <circle cx={cx-canopyR*0.18} cy={baseTop-canopyR*1.02} r={canopyR*0.16} fill="#fff" opacity={0.35}/>
          <circle cx={cx+canopyR*0.34} cy={baseTop-canopyR*0.62} r={canopyR*0.1} fill="#fff" opacity={0.28}/>
          {/* berries (muffin) or sprinkles (cupcake) */}
          {shape==="muffin"
            ? [[-0.32,-0.55],[0.3,-0.62],[0.02,-0.28],[0.5,-0.2]].map(([tx,ty2],i)=>(
                <g key={i}>
                  <circle cx={cx+canopyR*tx} cy={baseTop+canopyR*ty2} r={canopyR*0.15} fill="#3E4E9E"/>
                  <circle cx={cx+canopyR*tx-1} cy={baseTop+canopyR*ty2-1} r={canopyR*0.05} fill="#fff" opacity={0.5}/>
                </g>
              ))
            : [[-0.35,-0.6,"#FFD34D",30],[0.28,-0.7,"#7FE0C3",-20],[0.02,-0.32,"#FF9CC0",60],[0.48,-0.25,"#A7C4E8",-45],[-0.5,-0.2,"#FFD34D",10]].map(([tx,ty2,c,rot],i)=>(
                <rect key={i} x={cx+canopyR*tx-2.2} y={baseTop+canopyR*ty2-0.9} width={4.4} height={1.8} rx={0.9}
                  fill={c} transform={`rotate(${rot} ${cx+canopyR*tx} ${baseTop+canopyR*ty2})`}/>
              ))}
          {/* topper */}
          {progress>=1 && !paused && <text x={cx} y={baseTop-canopyR*1.15} fontSize={large?16:11} textAnchor="middle">{topping}</text>}
        </g>
      );
    })();
  } else if(shape==="palm"){
    // Coconut Palm — a trunk that leans into the breeze, topped with a burst
    // of drooping fronds. The lean is handled once here and reused by the
    // trunk render below (palmLean/palmTop), so both stay in sync.
    const lean = trunkH*0.30;
    const topCx = cx+lean, topCy = cy-trunkH;
    perchPoint = { x: topCx, y: topCy-canopyR*0.1, face:1 }; // the hub where the fronds meet
    const frondAngles = [-165,-128,-92,-58,-22,10,42];
    crown = grown && (
      <g opacity={opacity}>
        {frondAngles.map((deg,i)=>{
          const rad = deg*Math.PI/180;
          const len = canopyR*(0.98+(i%2)*0.12);
          const dx = Math.cos(rad), dy = Math.sin(rad)*0.7;
          const droop = Math.abs(dx)*len*0.55; // fronds sag more the closer they point to horizontal
          const tipX = topCx+dx*len, tipY = topCy+dy*len+droop;
          const midX = topCx+dx*len*0.5, midY = topCy+dy*len*0.5-len*0.14;
          const w = len*0.15;
          const plen = Math.hypot(tipX-topCx, tipY-topCy)||1;
          const px = -(tipY-topCy)/plen, py = (tipX-topCx)/plen;
          return (
            <g key={i}>
              <path d={`M${topCx} ${topCy} Q${midX+px*w*0.5} ${midY+py*w*0.5} ${tipX} ${tipY} Q${midX-px*w*0.5} ${midY-py*w*0.5} ${topCx} ${topCy} Z`}
                fill={canopyColor} opacity={0.94-(i%2)*0.08}/>
              <path d={`M${topCx} ${topCy} Q${midX} ${midY} ${tipX} ${tipY}`} stroke={shade(canopyColor,-0.32)} strokeWidth={1} fill="none" opacity={0.4}/>
            </g>
          );
        })}
        {/* coconuts clustered where the fronds meet the trunk */}
        <circle cx={topCx-canopyR*0.08} cy={topCy+canopyR*0.07} r={canopyR*0.075} fill="#6B4423"/>
        <circle cx={topCx+canopyR*0.07} cy={topCy+canopyR*0.1} r={canopyR*0.07} fill="#5A3A1E"/>
        <circle cx={topCx-canopyR*0.005} cy={topCy+canopyR*0.13} r={canopyR*0.065} fill="#6B4423"/>
      </g>
    );
  } else if(shape==="banana"){
    // Banana Tree — a rosette of broad paddle leaves over a soft pseudostem,
    // with a bunch of bananas ripening beneath the crown.
    const topY = cy-trunkH;
    perchPoint = { x: cx-canopyR*0.3, y: topY-canopyR*0.08, face:-1 }; // among the leaves, away from the bunch
    const leafAngles = [-150,-105,-55,-15,35];
    crown = grown && (
      <g opacity={opacity}>
        {leafAngles.map((deg,i)=>{
          const rad = deg*Math.PI/180;
          const len = canopyR*(1.05+(i%2)*0.08);
          const tipX = cx+Math.cos(rad)*len;
          const tipY = topY+Math.sin(rad)*len*0.62-len*0.05;
          const perpX = -Math.sin(rad), perpY = Math.cos(rad)*0.62;
          const w = len*0.34;
          const cxr = cx+Math.cos(rad)*len*0.5, cyr = topY+Math.sin(rad)*len*0.5*0.62;
          return (
            <g key={i}>
              <path d={`M${cx} ${topY} Q${cxr+perpX*w} ${cyr+perpY*w} ${tipX} ${tipY} Q${cxr-perpX*w} ${cyr-perpY*w} ${cx} ${topY} Z`}
                fill={canopyColor} opacity={0.95-(i%2)*0.1}/>
              <path d={`M${cx} ${topY} Q${cxr} ${cyr} ${tipX} ${tipY}`} stroke={shade(canopyColor,-0.3)} strokeWidth={1} fill="none" opacity={0.35}/>
            </g>
          );
        })}
        {/* hanging bunch, tucked under the leaves on one side */}
        {(()=>{
          const bx=cx+canopyR*0.13, by=topY+canopyR*0.28;
          const offs=[[-canopyR*0.08,0],[0,canopyR*0.04],[canopyR*0.08,0],[-canopyR*0.04,canopyR*0.12],[canopyR*0.04,canopyR*0.12]];
          return (
            <g>
              <path d={`M${bx} ${by-canopyR*0.08} L${bx} ${by}`} stroke="#7A5A2E" strokeWidth={1.6}/>
              {offs.map(([dx,dy],i)=>(
                <path key={i} d={`M${bx+dx-canopyR*0.04} ${by+dy} Q${bx+dx} ${by+dy+canopyR*0.12} ${bx+dx+canopyR*0.04} ${by+dy} Q${bx+dx+canopyR*0.016} ${by+dy+canopyR*0.04} ${bx+dx-canopyR*0.016} ${by+dy+canopyR*0.04} Z`}
                  fill="#F2C744"/>
              ))}
            </g>
          );
        })()}
      </g>
    );
  } else if(shape==="bamboo"){
    // Golden Bamboo — three segmented stalks of differing height, each
    // carrying its own leaf tuft. Replaces the generic trunk entirely (see
    // the isBamboo check in the trunk section below).
    const stalkDefs = [
      { dx:-canopyR*0.35, hMul:0.62, w:canopyR*0.13 },
      { dx:0,              hMul:0.86, w:canopyR*0.16 },
      { dx:canopyR*0.33,   hMul:0.5,  w:canopyR*0.12 },
    ];
    { // tallest stalk's top — a real place for a companion to grip
      const tall = stalkDefs[1];
      const tallH = trunkH*0.9 + canopyR*1.35*tall.hMul;
      perchPoint = { x: cx+tall.dx, y: cy-tallH-canopyR*0.06, face:1 };
    }
    crown = grown && (
      <g opacity={opacity}>
        {stalkDefs.map((s,si)=>{
          const h = trunkH*0.9 + canopyR*1.35*s.hMul;
          const topY = cy-h;
          const w = s.w;
          const nodeCount = Math.max(2, Math.round(h/(canopyR*0.42||1)));
          const leafAngles = [-140,-90,-40,10];
          return (
            <g key={si}>
              <rect x={cx+s.dx-w/2} y={topY} width={w} height={h} rx={w*0.4} fill={trunkColor}/>
              <rect x={cx+s.dx-w/2} y={topY} width={w*0.35} height={h} fill="#fff" opacity={0.16}/>
              {Array.from({length:nodeCount-1}).map((_,n)=>{
                const ny = topY + (h/nodeCount)*(n+1);
                return <path key={n} d={`M${cx+s.dx-w/2-0.5} ${ny} Q${cx+s.dx} ${ny-w*0.3} ${cx+s.dx+w/2+0.5} ${ny}`}
                  stroke={shade(trunkColor,-0.35)} strokeWidth={1.2} fill="none" opacity={0.7}/>;
              })}
              {leafAngles.map((deg,i)=>{
                const rad = deg*Math.PI/180, len=canopyR*(0.3+(si%2)*0.06);
                const tipX = cx+s.dx+Math.cos(rad)*len, tipY = topY+Math.sin(rad)*len*0.7-canopyR*0.05;
                return <path key={i} d={`M${cx+s.dx} ${topY+w*0.2} Q${cx+s.dx+Math.cos(rad)*len*0.5} ${topY+Math.sin(rad)*len*0.35} ${tipX} ${tipY} Q${cx+s.dx+Math.cos(rad)*len*0.3} ${topY+Math.sin(rad)*len*0.2+canopyR*0.03} ${cx+s.dx} ${topY+w*0.2} Z`}
                  fill={canopyColor} opacity={0.9}/>;
              })}
            </g>
          );
        })}
      </g>
    );
  } else {
    // Default round canopy — Forest-style clustered lobes with soft highlights.
    // Rainbow Tree swaps the flat fill for a diagonal spectrum gradient so the
    // SAME lobed silhouette reads as an entirely different, sunnier skin.
    const isRainbow = !!activeSkin.magic?.rainbow;
    const rbId = `rb-${gradId}`;
    const fillC = isRainbow ? `url(#${rbId})` : canopyColor;
    perchPoint = { x: cx+canopyR*0.6, y: cy-trunkH-canopyR*1.06, face:1 }; // top of the right side-lobe
    crown = (
      <>
        {isRainbow && (
          <defs>
            <linearGradient id={rbId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor="#FF5C7A"/>
              <stop offset="20%"  stopColor="#FF9C4A"/>
              <stop offset="40%"  stopColor="#FFD34D"/>
              <stop offset="60%"  stopColor="#6FCF7A"/>
              <stop offset="80%"  stopColor="#4FA8E8"/>
              <stop offset="100%" stopColor="#A16FE8"/>
            </linearGradient>
          </defs>
        )}
        {/* broad under-canopy */}
        {progress>0.04&&<ellipse cx={cx} cy={cy-trunkH-canopyR*0.4} rx={canopyR*1.04} ry={canopyR*0.88} fill={fillC} opacity={opacity*0.6}/>}
        {/* side lobes */}
        {progress>0.09&&<>
          <circle cx={cx-canopyR*0.58} cy={cy-trunkH-canopyR*0.5} r={canopyR*0.56} fill={fillC} opacity={opacity*0.85}/>
          <circle cx={cx+canopyR*0.6} cy={cy-trunkH-canopyR*0.54} r={canopyR*0.52} fill={fillC} opacity={opacity*0.85}/>
        </>}
        {/* crown + top lobes */}
        {progress>0.14&&<>
          <circle cx={cx} cy={cy-trunkH-canopyR*0.82} r={canopyR*0.74} fill={fillC} opacity={opacity}/>
          <circle cx={cx-canopyR*0.32} cy={cy-trunkH-canopyR*1.08} r={canopyR*0.4} fill={fillC} opacity={opacity}/>
        </>}
        {/* light catching the upper lobes */}
        {grown&&<>
          <circle cx={cx+canopyR*0.26} cy={cy-trunkH-canopyR*1.04} r={canopyR*0.34} fill="#fff" opacity={0.18}/>
          <circle cx={cx-canopyR*0.52} cy={cy-trunkH-canopyR*0.74} r={canopyR*0.25} fill="#fff" opacity={0.13}/>
          <ellipse cx={cx} cy={cy-trunkH-canopyR*0.18} rx={canopyR*0.7} ry={canopyR*0.28} fill="#000" opacity={0.07}/>
        </>}
      </>
    );
  }

  const isFood = shape==="muffin"||shape==="cupcake"||shape==="cake";
  const isBamboo = shape==="bamboo"; // stalks double as the trunk — see trunk section below
  const isPalm = shape==="palm";
  const isTropicalStem = isPalm||isBamboo||shape==="banana";

  // ── Magical treatment (premium skins) ──
  // Glow behind the canopy + optional crescent moon, gold stars, and sparkles.
  const mg = activeSkin.magic;
  const canopyTopY = cy - trunkH - canopyR*0.7; // rough canopy centre
  const magicGlow = (mg && grown) ? (
    <ellipse cx={cx} cy={canopyTopY} rx={canopyR*Math.min(1.58,1.26+(visualProfile.effectBounds||1)*.2)}
      ry={canopyR*Math.min(1.38,1.08+(visualProfile.effectBounds||1)*.18)} fill={mg.glow} opacity={0.22}>
      <animate attributeName="opacity" values="0.14;0.30;0.14" dur="4s" repeatCount="indefinite"/>
    </ellipse>
  ) : null;
  const magicOverlay = (mg && progress>0.3 && !paused) ? (
    <g>
      {/* glowing crescent moon nestled in the canopy */}
      {mg.moon && (
        <g>
          <circle cx={cx} cy={canopyTopY-canopyR*0.15} r={canopyR*0.42} fill="#FFF3C4" opacity="0.95"/>
          <circle cx={cx+canopyR*0.16} cy={canopyTopY-canopyR*0.22} r={canopyR*0.38} fill={canopyColor}/>
          <circle cx={cx} cy={canopyTopY-canopyR*0.15} r={canopyR*0.6} fill="#FFF3C4" opacity="0.18">
            <animate attributeName="opacity" values="0.10;0.28;0.10" dur="3.5s" repeatCount="indefinite"/>
          </circle>
        </g>
      )}
      {/* gold stars dotted across the canopy */}
      {mg.stars && [[-0.55,-0.2],[0.5,-0.45],[-0.3,-0.7],[0.25,0.1],[0.6,-0.05],[-0.6,-0.55]].map(([dx,dy],i)=>{
        const sx=cx+dx*canopyR, sy=canopyTopY+dy*canopyR, sr=canopyR*(0.09+(i%2)*0.03);
        return (
          <g key={i}>
            <path d={`M${sx},${sy-sr} L${sx+sr*0.3},${sy-sr*0.3} L${sx+sr},${sy} L${sx+sr*0.3},${sy+sr*0.3} L${sx},${sy+sr} L${sx-sr*0.3},${sy+sr*0.3} L${sx-sr},${sy} L${sx-sr*0.3},${sy-sr*0.3} Z`}
              fill="#FFD34D">
              <animate attributeName="opacity" values="0.55;1;0.55" dur={`${2+(i%3)}s`} repeatCount="indefinite" begin={`${(i%4)*0.4}s`}/>
            </path>
          </g>
        );
      })}
      {/* fallen stars resting at the base */}
      {mg.stars && [[-15,-2,0.5],[16,-3,0.8]].map(([dx,dy,sc],i)=>{
        const fx=cx+dx, fy=cy+dy, fr=canopyR*0.12*sc+2;
        return <path key={`fs${i}`} d={`M${fx},${fy-fr} L${fx+fr*0.3},${fy-fr*0.3} L${fx+fr},${fy} L${fx+fr*0.3},${fy+fr*0.3} L${fx},${fy+fr} L${fx-fr*0.3},${fy+fr*0.3} L${fx-fr},${fy} L${fx-fr*0.3},${fy-fr*0.3} Z`} fill="#FFD34D" opacity="0.9">
          <animate attributeName="opacity" values="0.6;1;0.6" dur={`${2.5+i}s`} repeatCount="indefinite"/>
        </path>;
      })}
      {/* sparkles floating around */}
      {mg.sparkle && progress>=1 && [[-1.1,-0.4],[1.0,-0.7],[0.2,-1.2]].map(([dx,dy],i)=>(
        <text key={i} x={cx+dx*canopyR} y={canopyTopY+dy*canopyR} fontSize={large?15:11} opacity="0.9">
          ✨<animate attributeName="opacity" values="0.3;1;0.3" dur={`${2.5+i}s`} repeatCount="indefinite" begin={`${i*0.5}s`}/>
        </text>
      ))}
      {/* Enchanted Tree: soft pulsing fireflies (round glow dots, not diamonds —
          keeps it visually distinct from the star-family mystical skins) */}
      {mg.enchanted && [[-0.5,-0.15],[0.55,-0.4],[-0.15,-0.7],[0.35,0.05]].map(([dx,dy],i)=>{
        const fx=cx+dx*canopyR, fy=canopyTopY+dy*canopyR;
        return (
          <g key={`ff${i}`}>
            <circle cx={fx} cy={fy} r={canopyR*0.033} fill="#D8F5A2" opacity="0.9">
              <animate attributeName="opacity" values="0.35;0.95;0.35" dur={`${3+i*0.6}s`} repeatCount="indefinite" begin={`${i*0.5}s`}/>
            </circle>
            <circle cx={fx} cy={fy} r={canopyR*0.07} fill="#D8F5A2" opacity="0.2"/>
          </g>
        );
      })}
      {/* Lightning Tree: a crackling bolt flickers from the canopy to the ground */}
      {mg.storm && (()=>{
        const boltX = cx+canopyR*0.1;
        const d = `M${boltX-canopyR*0.08} ${canopyTopY-canopyR*0.5}
          L${boltX+canopyR*0.08} ${canopyTopY-canopyR*0.1}
          L${boltX-canopyR*0.04} ${canopyTopY+canopyR*0.3}
          L${boltX+canopyR*0.09} ${canopyTopY+canopyR*0.55}
          L${boltX-canopyR*0.03} ${cy-4}`;
        return (
          <g opacity="0">
            <animate attributeName="opacity" values="0;0;1;0.3;1;0;0;0" keyTimes="0;0.38;0.4;0.43;0.46;0.49;0.75;1" dur="5.5s" repeatCount="indefinite"/>
            <path d={d} stroke="#8FB8FF" strokeWidth={canopyR*0.1} fill="none" strokeLinejoin="round" strokeLinecap="round" opacity="0.4"/>
            <path d={d} stroke="#EAF2FF" strokeWidth={canopyR*0.038} fill="none" strokeLinejoin="round" strokeLinecap="round"/>
          </g>
        );
      })()}
    </g>
  ) : null;

  // ── Enhancement layers (tiers stack: 3 includes 2 includes 1) ──────────────
  // One engine for all skins: palette + particle come from the skin, the tier
  // decides which layers switch on. Sized off canopyR so it works at any growth.
  const tier = visualTier;
  const deep  = shade(canopyColor, -0.22);
  const light = shade(canopyColor,  0.30);
  const part  = enhanceParticle(activeSkin);
  const isFlagship = !!activeSkin.flagship;
  const isMythical = activeSkin.collection==="mystical";
  const hasSignatureDetails = isFlagship || isMythical;
  const signatureBack = isFlagship && grown ? <FlagshipTreeDetails
    theme={activeSkin.premiumTheme} cx={cx} baseY={cy} canopyY={canopyTopY}
    r={canopyR} trunkH={trunkH} tier={tier} paused={paused} layer="back"/> :
    isMythical && grown ? <MythicalTreeDetails skinId={activeSkin.id}
      cx={cx} baseY={cy} canopyY={canopyTopY} r={canopyR} trunkH={trunkH}
      tier={tier} paused={paused} layer="back"/> : null;
  const signatureFront = isFlagship && grown ? <FlagshipTreeDetails
    theme={activeSkin.premiumTheme} cx={cx} baseY={cy} canopyY={canopyTopY}
    r={canopyR} trunkH={trunkH} tier={tier} paused={paused} layer="front"/> :
    isMythical && grown ? <MythicalTreeDetails skinId={activeSkin.id}
      cx={cx} baseY={cy} canopyY={canopyTopY} r={canopyR} trunkH={trunkH}
      tier={tier} paused={paused} layer="front"/> : null;
  const classicFront=grown?<ClassicTreeDetails skinId={activeSkin.id} cx={cx} baseY={cy} canopyY={canopyTopY} r={canopyR} tier={tier}/>:null;

  // Tier 1 — Flourish: richer static tree. Shape-aware accents.
  // Flagship skins use their own themed tier layers instead of this generic one.
  const enhT1 = (!hasSignatureDetails && tier>=1 && grown) ? (
    <g opacity={opacity}>
      {shape==="pine" ? (
        <>{[0,1].map(i=>{
          const ly = cy-trunkH - i*canopyR*0.55, lw = canopyR*1.5*(1-i*0.22)*0.55;
          return <polygon key={i} points={`${cx},${ly-canopyR*0.55} ${cx-lw/2},${ly-canopyR*0.06} ${cx+lw/2},${ly-canopyR*0.06}`} fill={deep} opacity={0.5}/>;
        })}</>
      ) : isFood ? (
        <>
          <circle cx={cx-canopyR*0.3} cy={cy-trunkH*0.7-canopyR*0.55} r={canopyR*0.2} fill="#fff" opacity={0.4}/>
          <ellipse cx={cx} cy={cy-trunkH*0.7+canopyR*0.05} rx={canopyR*0.5} ry={canopyR*0.12} fill={deep} opacity={0.28}/>
        </>
      ) : isTropicalStem ? (
        // A soft density tint under the fronds/leaves — subtle, shape-agnostic
        <ellipse cx={isPalm?cx+trunkH*0.30:cx} cy={cy-trunkH-canopyR*0.5} rx={canopyR*0.5} ry={canopyR*0.3} fill={deep} opacity={0.2}/>
      ) : (
        <>
          {/* deep under-lobes = visual density, light top-lobes = catchlight */}
          <circle cx={cx-canopyR*0.42} cy={cy-trunkH-canopyR*0.28} r={canopyR*0.4} fill={deep} opacity={0.5}/>
          <circle cx={cx+canopyR*0.46} cy={cy-trunkH-canopyR*0.32} r={canopyR*0.36} fill={deep} opacity={0.45}/>
          <circle cx={cx+canopyR*0.1}  cy={cy-trunkH-canopyR*0.14} r={canopyR*0.32} fill={deep} opacity={0.4}/>
          <circle cx={cx-canopyR*0.16} cy={cy-trunkH-canopyR*1.16} r={canopyR*0.3}  fill={light} opacity={0.5}/>
          <circle cx={cx+canopyR*0.4}  cy={cy-trunkH-canopyR*0.95} r={canopyR*0.24} fill={light} opacity={0.45}/>
        </>
      )}
      {/* new side branches reaching out of the trunk (not for food, or for
          tropical stems where a sprouting side-branch wouldn't make sense) */}
      {!isFood && !isTropicalStem && trunkH>18 && (
        <g>
          <path d={`M${cx-3} ${cy-trunkH*0.72} q-${6+canopyR*0.12} -3 -${9+canopyR*0.16} -8`} stroke={trunkColor} strokeWidth={2.2} fill="none" strokeLinecap="round"/>
          <path d={`M${cx+3} ${cy-trunkH*0.6} q${5+canopyR*0.1} -2 ${8+canopyR*0.14} -6`} stroke={trunkColor} strokeWidth={2} fill="none" strokeLinecap="round"/>
          <circle cx={cx-(12+canopyR*0.16)} cy={cy-trunkH*0.72-9} r={canopyR*0.22} fill={canopyColor} opacity={opacity*0.85}/>
          <circle cx={cx+(11+canopyR*0.14)} cy={cy-trunkH*0.6-7} r={canopyR*0.18} fill={canopyColor} opacity={opacity*0.8}/>
        </g>
      )}
    </g>
  ) : null;

  // Tier 2 — Living: gentle shedding. (The crown sway is applied in the return.)
  const drawParticle = (k, key, px, py, sz) => {
    if (k==="petal") return <path key={key} d={`M${px} ${py} q${sz} -${sz*0.8} 0 -${sz*1.8} q-${sz} ${sz} 0 ${sz*1.8}`} fill={part.color}/>;
    if (k==="star")  return <path key={key} d={`M${px},${py-sz} L${px+sz*0.3},${py-sz*0.3} L${px+sz},${py} L${px+sz*0.3},${py+sz*0.3} L${px},${py+sz} L${px-sz*0.3},${py+sz*0.3} L${px-sz},${py} L${px-sz*0.3},${py-sz*0.3} Z`} fill={part.color}/>;
    if (k==="sparkle") return <circle key={key} cx={px} cy={py} r={sz*0.5} fill={part.color}/>;
    return <path key={key} d={`M${px} ${py} q${sz*0.9} -${sz*0.9} 0 -${sz*2} q-${sz*0.9} ${sz*1.1} 0 ${sz*2}`} fill={part.color}/>;
  };
  const enhT2 = (!hasSignatureDetails && tier>=2 && grown && !paused && progress>0.25) ? (
    <g>
      {Array.from({length:visualProfile.particleDensity||2}).map((_,i,all)=>{
        const offset=i-(all.length-1)/2;
        const px = cx + offset*canopyR*0.62, py = cy-trunkH-canopyR*0.5;
        const fall = trunkH + canopyR*0.5 + 4;
        const dur = 5.5 + i*1.6, delay = i*2.1;
        return (
          <g key={i} opacity="0">
            <animate attributeName="opacity" values="0;0.85;0.85;0" keyTimes="0;0.12;0.75;1" dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite"/>
            <animateTransform attributeName="transform" type="translate"
              values={`0 0; ${8+i*4} ${fall*0.5}; ${-4+i*3} ${fall}`} keyTimes="0;0.5;1"
              dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite"
              calcMode="spline" keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"/>
            <g>
              <animateTransform attributeName="transform" type="rotate" values={`0 ${px} ${py};160 ${px} ${py}`} dur={`${dur*0.6}s`} begin={`${delay}s`} repeatCount="indefinite"/>
              {drawParticle(part.kind, `p${i}`, px, py, large?3.4:2.6)}
            </g>
          </g>
        );
      })}
    </g>
  ) : null;

  // Tier 3 — Radiant: visitors, drifting motes, evening glow.
  const tod3 = tier>=3 ? getTimeOfDay() : null;
  const evening = tod3 && (tod3.name==="dusk" || tod3.name==="night");
  const enhGlow = (!hasSignatureDetails && tier>=3 && grown && evening) ? (
    <ellipse cx={cx} cy={canopyTopY} rx={canopyR*1.45} ry={canopyR*1.2} fill={mg?mg.glow:"#FFE9B8"} opacity={0.14}>
      <animate attributeName="opacity" values="0.08;0.18;0.08" dur="5s" repeatCount="indefinite"/>
    </ellipse>
  ) : null;
  const enhT3 = (!hasSignatureDetails && tier>=3 && grown && !paused && progress>0.3) ? (
    <g>
      {/* A companion suited to this skin rests where the shape can actually
          hold it — on the real anchor point that shape's crown computed
          above, not a guessed offset. Ground-dwelling companions (fox,
          panda, …) sit at the base instead. */}
      {(()=>{
        const perch = perchFor(shape);
        const companion = SKIN_COMPANIONS[activeSkin.id];
        const kind = companion ? companion.kind : perch.kind;
        const isGround = !!companion?.ground;
        const B = large ? 1 : 0.72;
        let px, py, f;
        if (isGround) {
          px = cx - canopyR*0.55; py = cy - 2; f = 1;
        } else if (kind === "garnish") {
          px = cx + perch.ax*canopyR; py = (cy - trunkH*0.7) + perch.ay*canopyR; f = perch.face;
        } else if (perchPoint) {
          px = perchPoint.x; py = perchPoint.y; f = perchPoint.face;
        } else {
          px = cx + perch.ax*canopyR; py = (cy - trunkH - canopyR*0.7) + perch.ay*canopyR; f = perch.face;
        }
        return renderCompanion(kind, px, py, f, B, opacity);
      })()}
      {/* drifting motes — fireflies at dusk, pollen by day */}
      {[[-1.15,0.15],[1.05,-0.3]].map(([dx,dy],i)=>(
        <circle key={i} cx={cx+dx*canopyR} cy={canopyTopY+dy*canopyR} r={large?2:1.5}
          fill={evening?"#FFE88A":part.color} opacity="0.7">
          <animate attributeName="cy" values={`${canopyTopY+dy*canopyR};${canopyTopY+dy*canopyR-10};${canopyTopY+dy*canopyR}`} dur={`${4.5+i*1.3}s`} repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.15;0.8;0.15" dur={`${4.5+i*1.3}s`} repeatCount="indefinite" begin={`${i*0.9}s`}/>
        </circle>
      ))}
      {/* a butterfly loops past on a slow figure-eight */}
      <g opacity="0.9">
        <animateTransform attributeName="transform" type="translate"
          values={`0 0; ${canopyR*0.8} -${canopyR*0.4}; 0 -${canopyR*0.7}; -${canopyR*0.8} -${canopyR*0.3}; 0 0`}
          dur="11s" repeatCount="indefinite" calcMode="spline"
          keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.25;0.5;0.75;1"/>
        <g transform={`translate(${cx-canopyR*1.1},${canopyTopY-canopyR*0.9})`}>
          <ellipse rx={large?2.6:2} ry={large?1.6:1.2} fill={part.kind==="petal"?"#F08BB0":"#E8B84B"} transform="rotate(-30)">
            <animate attributeName="rx" values={`${large?2.6:2};${large?1:0.8};${large?2.6:2}`} dur="0.5s" repeatCount="indefinite"/>
          </ellipse>
          <ellipse rx={large?2.6:2} ry={large?1.6:1.2} fill={part.kind==="petal"?"#F4A7C4":"#F0CA6E"} transform="rotate(30)">
            <animate attributeName="rx" values={`${large?1:0.8};${large?2.6:2};${large?1:0.8}`} dur="0.5s" repeatCount="indefinite"/>
          </ellipse>
        </g>
      </g>
    </g>
  ) : null;

  // Tier 2+ crown breathes — a slow sway pivoting where trunk meets crown
  const swayAmount=(visualProfile.motionIntensity||.65)*1.45;
  const swayCrown = (tier>=2 && !paused && grown) ? (
    <g>
      <animateTransform attributeName="transform" type="rotate"
        values={`${-swayAmount} ${cx} ${cy-trunkH*0.3}; ${swayAmount} ${cx} ${cy-trunkH*0.3}; ${-swayAmount} ${cx} ${cy-trunkH*0.3}`}
        dur={`${7.2-(visualProfile.motionIntensity||.65)}s`} repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.5;1"/>
      {crown}{enhT1}{magicOverlay}
    </g>
  ) : <g>{crown}{enhT1}{magicOverlay}</g>;

  return (
    <svg {...baseProps}>
      {shadow}
      {magicGlow}
      {signatureBack}
      {enhGlow}
      {/* Trunk — hidden for food items (the wrapper replaces it) and for
          bamboo (its stalks, drawn in the crown above, double as the trunk) */}
      {!isFood && !isBamboo && !isPalm && <g opacity={opacity}>
        <path d={`M${cx-3.6} ${cy-trunkH} Q${cx-4.6} ${cy-trunkH*0.45} ${cx-6} ${cy-3} L${cx-9.5} ${cy} L${cx+9.5} ${cy} L${cx+6} ${cy-3} Q${cx+4.6} ${cy-trunkH*0.45} ${cx+3.6} ${cy-trunkH} Z`} fill={trunkColor}/>
        <path d={`M${cx+1.5} ${cy-trunkH+2} Q${cx+2.8} ${cy-trunkH*0.45} ${cx+4.5} ${cy-2} L${cx+7.5} ${cy} L${cx+9.5} ${cy} L${cx+6} ${cy-3} Q${cx+4.6} ${cy-trunkH*0.45} ${cx+3.6} ${cy-trunkH} Z`} fill="#000" opacity={0.10}/>
        {/* Flourish: bark grain detail */}
        {tier>=1 && trunkH>20 && <path d={`M${cx-1.2} ${cy-trunkH*0.85} q-0.8 ${trunkH*0.3} -1.6 ${trunkH*0.55} M${cx+1.6} ${cy-trunkH*0.7} q0.6 ${trunkH*0.25} 1.2 ${trunkH*0.45}`} stroke={shade(trunkColor,-0.3)} strokeWidth={0.9} fill="none" opacity={0.5} strokeLinecap="round"/>}
      </g>}
      {/* Coconut Palm — a single trunk that leans into the breeze (lean must
          match the frond crown above, so both derive it the same way) */}
      {isPalm && <g opacity={opacity}>
        {(()=>{
          const lean = trunkH*0.30, bw=9, tw=4;
          const topX = cx+lean, topY = cy-trunkH;
          const ctrlX = cx+lean*0.32, ctrlY = cy-trunkH*0.58;
          return (
            <>
              <path d={`M${cx-bw/2} ${cy} Q${ctrlX-bw*0.3} ${ctrlY} ${topX-tw/2} ${topY} L${topX+tw/2} ${topY} Q${ctrlX+bw*0.3} ${ctrlY} ${cx+bw/2} ${cy} Z`} fill={trunkColor}/>
              <path d={`M${cx+bw*0.1} ${cy} Q${ctrlX+bw*0.15} ${ctrlY} ${topX+tw*0.1} ${topY} L${topX+tw/2} ${topY} Q${ctrlX+bw*0.3} ${ctrlY} ${cx+bw/2} ${cy} Z`} fill="#000" opacity={0.12}/>
              {tier>=1 && [0.25,0.45,0.65,0.82].map((t,i)=>{
                const rx = cx + lean*t*t, ry = cy - trunkH*t;
                const w = bw - (bw-tw)*t;
                return <path key={i} d={`M${rx-w*0.55} ${ry+1.5} Q${rx} ${ry-1.2} ${rx+w*0.55} ${ry+1.5}`} stroke={shade(trunkColor,-0.28)} strokeWidth={1.1} fill="none" opacity={0.5}/>;
              })}
            </>
          );
        })()}
      </g>}
      {/* Enchanted Tree: ivy climbing the trunk + a little ring of toadstools
          at the base — this skin's signature, independent of enhancement tier */}
      {mg?.enchanted && grown && <g opacity={opacity}>
        <path d={`M${cx-5} ${cy} Q${cx-8} ${cy-trunkH*0.3} ${cx-3} ${cy-trunkH*0.5} Q${cx+2} ${cy-trunkH*0.7} ${cx-4} ${cy-trunkH*0.92}`}
          stroke="#4F8F5A" strokeWidth={1.6} fill="none" opacity={0.75}/>
        <circle cx={cx-7} cy={cy-trunkH*0.28} r={2.2} fill="#5FAE6E"/>
        <circle cx={cx-1} cy={cy-trunkH*0.62} r={2} fill="#5FAE6E"/>
        <circle cx={cx-5} cy={cy-trunkH*0.85} r={1.8} fill="#5FAE6E"/>
        {[[-13,1.4],[11,1.1]].map(([dx,s],i)=>(
          <g key={i}>
            <path d={`M${cx+dx-4*s} ${cy} Q${cx+dx-4*s} ${cy-5*s} ${cx+dx} ${cy-5*s} Q${cx+dx+4*s} ${cy-5*s} ${cx+dx+4*s} ${cy} Z`} fill="#E8557A"/>
            <rect x={cx+dx-1.2*s} y={cy-2*s} width={2.4*s} height={2.4*s} fill="#F3E9D2"/>
          </g>
        ))}
      </g>}
      {isFood && <rect x={cx-3} y={cy-trunkH*0.5} width={6} height={trunkH*0.5} rx={3} fill="#C9A878" opacity={opacity*0.5}/>}
      {grown && !isFood && <g opacity={opacity*0.9}>
        <path d={`M${cx-14} ${cy} q-1 -5 -3 -7 M${cx-14} ${cy} q1 -6 2 -8`} stroke="#7FB86A" strokeWidth={1.6} fill="none" strokeLinecap="round"/>
        <path d={`M${cx+13} ${cy} q1 -5 3 -6 M${cx+13} ${cy} q-1 -6 -1 -8`} stroke="#8FC479" strokeWidth={1.6} fill="none" strokeLinecap="round"/>
        <ellipse cx={cx+18.5} cy={cy-1} rx={3.2} ry={2.1} fill="#B9C4B4"/>
        <ellipse cx={cx+22} cy={cy-0.5} rx={1.9} ry={1.3} fill="#CBD4C6"/>
      </g>}
      {swayCrown}
      {grown&&<CollectibleTreeFinish skinId={activeSkin.id} shape={shape} cx={cx} baseY={cy}
        canopyY={canopyTopY} r={canopyR} canopyColor={canopyColor} trunkColor={trunkColor}/>}
      {signatureFront}
      {classicFront}
      {grown&&<TreeThemeDetails skinId={activeSkin.id} shape={shape} cx={cx} baseY={cy} canopyY={canopyTopY} r={canopyR} tier={tier}/>}
      {enhT2}
      {enhT3}
      {pauseIcon}
      {!mg && !isFlagship && sparkle}
    </svg>
  );
}

// ── Focus Screen ──────────────────────────────────────────────────────────────
function SubjectSessionAmbience({ subject, paused=false }) {
  const family=getSubjectBackdropFamily(subject);
  const motionStyle=item=>({
    ...item.top&&{top:item.top},...item.right&&{right:item.right},
    ...item.bottom&&{bottom:item.bottom},...item.left&&{left:item.left},
    width:item.size,height:item.size,
    color:subject.color,
    background:`linear-gradient(145deg, rgba(255,255,255,.34), ${subject.color}13)`,
    "--sg-drift-x":item.dx,"--sg-drift-y":item.dy,
    "--sg-return-x":item.rx,"--sg-return-y":item.ry,
    "--sg-drift-rotate":item.rot||"2deg",
    "--sg-drift-duration":`${item.dur}s`,"--sg-drift-delay":`${item.delay}s`,
    "--sg-opacity-low":item.opacityLow,"--sg-opacity-mid":item.opacityMid,"--sg-opacity-high":item.opacityHigh,
  });
  return <div aria-hidden="true" className={`sg-session-atmosphere${paused?" sg-session-paused":""}`}>
    {family.visuals.slice(0,4).map((visual,index)=><span key={`${visual.value}-${index}`}
      className="sg-session-bubble sg-session-symbol" data-focus-symbol={family.id} style={motionStyle(SESSION_SYMBOL_LAYOUT[index])}>
      <span className="sg-session-symbol-core" style={{
        fontSize:visual.kind==="glyph"?18:15,
        fontWeight:visual.kind==="glyph"?750:500,
        fontFamily:visual.kind==="emoji"?'"Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif':"Inter,system-ui,sans-serif",
        "--sg-symbol-duration":`${8.5+index*1.1}s`,"--sg-symbol-delay":`${-index*2.3}s`,
      }}>{visual.kind==="dumbbell"?"🏋️":visual.value}</span>
    </span>)}
    {SESSION_GLOW_LAYOUT.map((item,index)=><span key={`glow-${index}`}
      className="sg-session-bubble sg-session-bubble--glow" style={motionStyle(item)}/>)}
  </div>;
}

function FocusScreen({ subject, mode, elapsed, duration, paused, onPause, onEnd, coins, skin, enhance=0,
  presence, currentUser, timerStyle="standard", pomodoro=null, task=null, onSkipBreak, onStartNext }) {
  const isPomodoro=timerStyle==="pomodoro"&&pomodoro;
  const isBreak=!!isPomodoro&&pomodoro.phase==="break";
  const phaseDuration=isPomodoro?pomodoroPhaseSeconds(pomodoro):duration;
  const isTimer   = isPomodoro||mode==="timer";
  const overtime  = !isPomodoro&&isTimer && elapsed > duration;       // studying past the target
  const overSecs  = overtime ? elapsed - duration : 0;
  const progress  = isTimer ? Math.min(elapsed/phaseDuration,1) : Math.min(elapsed/5400,1);
  const remaining = Math.max(phaseDuration-elapsed,0);
  const msgs = ["Stay focused 🌱","You're doing great 💪","Keep going! 🔥","Almost there ✨","In the zone 🎯"];
  const msgIdx = Math.floor((elapsed/60)%msgs.length);
  // What the big clock shows: countdown until 0, then counts UP as overtime
  const bigTime = isTimer ? (overtime ? `+${fmt(overSecs)}` : fmt(remaining)) : fmt(elapsed);
  const bigColor = paused ? "#8D9990" : isBreak ? "#4F7D68" : (overtime ? "#E08A2B" : subject.color);
  return (
    <div className={`sg-session-screen sg-focus-anim${isBreak?" sg-break-screen":""}`} style={{...fs.wrap,"--sg-focus-accent":`${subject.color}18`}}>
      {!isBreak&&<SubjectSessionAmbience subject={subject} paused={paused}/>}
      <div className="sg-session-top" style={fs.topBar}>
        <div style={fs.subjectChip}><span>{isBreak?"☕":subject.emoji}</span><span style={{marginLeft:6,fontWeight:600}}>{isBreak?"Break":subject.label}</span></div>
        <div style={fs.coinBadge}><AnimatedNumber value={coins} prefix="🪙 "/></div>
      </div>
      {!isBreak&&presence&&<StudyingNow presence={presence} currentUser={currentUser} compact/>}
      {isPomodoro&&<div style={fs.roundLabel} aria-live="polite">Round {pomodoro.round} of {pomodoro.plannedRounds} · {isBreak?"Rest":"Focus"}</div>}
      <div className="sg-session-tree" style={fs.treeArea}><TreeSVG progress={isBreak?1:progress} color={subject.color} paused={paused||isBreak} large skin={skin} enhance={enhance}/></div>
      {task&&<div className="sg-focus-task" title={task.title}>Task · {task.title}</div>}
      <div className="sg-session-time" style={{...fs.time,color:bigColor}} aria-live="off">{bigTime}</div>
      <div className="sg-session-mode" style={fs.modeLabel}>
        {isBreak&&pomodoro.awaitingNext ? "Break complete — begin when you’re ready"
          : isBreak&&paused ? "Break paused"
          : isBreak ? "Rest now — break time never earns coins"
          : paused ? "Paused — your learner is waiting"
          : overtime ? `🌟 Overtime! ${fmtMins(duration)} goal smashed — still counting`
          : isPomodoro ? `Focus interval · round ${pomodoro.round}`
          : isTimer ? msgs[msgIdx] : "⏱ Stopwatch running"}
      </div>
      <div style={fs.progressTrack}><div style={{...fs.progressFill,width:`${Math.min(progress,1)*100}%`,background:overtime?"#E0A04B":subject.color}}/></div>
      <div className="sg-session-progress-label" style={fs.progressLabel}>{isBreak
        ? `${Math.max(0,Math.ceil(remaining/60))} min break remaining · no rewards`
        : isTimer ? (overtime ? `${fmtMins(elapsed)} total` : `${Math.round(progress*100)}% complete`) : `${fmtMins(elapsed)} elapsed`}</div>
      {isBreak?<div className="sg-break-actions" style={fs.breakActions}>
        {!pomodoro.awaitingNext&&<button style={{...fs.pauseBtn,background:paused?subject.color:"#fff",color:paused?"#fff":subject.color,border:`2px solid ${subject.color}`}} onClick={onPause}>
          {paused?"▶ Resume break":"⏸ Pause break"}
        </button>}
        {pomodoro.awaitingNext
          ? <button style={{...fs.pauseBtn,background:subject.color,color:"#fff",border:`2px solid ${subject.color}`}} onClick={onStartNext}>Start next focus round</button>
          : <button style={{...fs.pauseBtn,background:"#fff",color:"#4F7D68",border:"2px solid #8EB9A5"}} onClick={onSkipBreak}>Skip break</button>}
        <button style={fs.endBtn} onClick={onEnd}>Finish session</button>
      </div>:<div style={fs.btnRow}>
          <button style={{...fs.pauseBtn,background:paused?subject.color:"#fff",color:paused?"#fff":subject.color,border:`2px solid ${subject.color}`}} onClick={onPause}>
            {paused?"▶ Resume":"⏸ Pause"}
          </button>
          <button style={fs.endBtn} onClick={onEnd}>{isPomodoro?"Finish now":"End session"}</button>
        </div>}
      <p className="sg-session-warning" style={fs.warning}>{isBreak?"Start the next round only when you’re ready.":"You can leave this screen safely, but your focused time matters."}</p>
    </div>
  );
}

const fs = {
  wrap:{position:"fixed",inset:0,zIndex:100,display:"flex",flexDirection:"column",alignItems:"center",padding:"0 max(24px,env(safe-area-inset-right)) max(32px,env(safe-area-inset-bottom)) max(24px,env(safe-area-inset-left))",overflow:"hidden",isolation:"isolate"},
  topBar:{position:"relative",zIndex:3,display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",maxWidth:400,paddingTop:"max(52px,calc(env(safe-area-inset-top) + 18px))"},
  subjectChip:{display:"flex",alignItems:"center",background:"rgba(255,255,255,0.85)",borderRadius:20,padding:"6px 14px",fontSize:14,fontWeight:500},
  coinBadge:{background:"rgba(255,255,255,0.85)",borderRadius:20,padding:"6px 14px",fontSize:14,fontWeight:700},
  treeArea:{position:"relative",zIndex:2,flex:1,display:"flex",alignItems:"center",justifyContent:"center",width:"100%"},
  time:{position:"relative",zIndex:3,fontSize:72,fontWeight:900,letterSpacing:"-3px",lineHeight:1,marginBottom:6,transition:"color 0.3s"},
  modeLabel:{position:"relative",zIndex:3,fontSize:15,color:"#666",marginBottom:20,fontWeight:500,textAlign:"center"},
  progressTrack:{position:"relative",zIndex:3,width:"100%",maxWidth:300,height:6,background:"rgba(0,0,0,0.08)",borderRadius:10,overflow:"hidden",marginBottom:6},
  progressFill:{height:"100%",borderRadius:10,transition:"width 1s linear"},
  progressLabel:{position:"relative",zIndex:3,fontSize:12,color:"#999",marginBottom:28},
  btnRow:{position:"relative",zIndex:3,display:"flex",gap:12,width:"100%",maxWidth:320},
  breakActions:{position:"relative",zIndex:3,display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:9,width:"100%",maxWidth:360},
  roundLabel:{position:"relative",zIndex:3,fontSize:11,fontWeight:750,color:"#627168",background:"rgba(255,255,255,.7)",border:"1px solid rgba(255,255,255,.9)",borderRadius:16,padding:"5px 10px",marginTop:10},
  pauseBtn:{flex:1,padding:"14px 0",borderRadius:16,fontSize:15,fontWeight:700,cursor:"pointer",transition:"all 0.2s"},
  endBtn:{flex:1,padding:"14px 0",background:"rgba(0,0,0,0.06)",border:"none",borderRadius:16,fontSize:15,fontWeight:600,color:"#888",cursor:"pointer"},
  warning:{position:"relative",zIndex:3,fontSize:11,color:"#bbb",marginTop:16,textAlign:"center"},
};

// ── Complete Screen ───────────────────────────────────────────────────────────
// ── Focus-tab ambience ────────────────────────────────────────────────────────
// A quiet little world around the hero tree: a squirrel that dashes behind the
// trunk, leaves drifting from the canopy, grass swaying in the wind, butterflies
// by day and fireflies at night. Two layers — "back" renders behind the tree so
// the squirrel passes behind the trunk; "front" renders over it. All SMIL.
function FocusAmbience({ layer }) {
  const tod = getTimeOfDay();
  const night = tod.name === "night";
  const W = 380, H = 216;
  const base = { position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none" };

  if (layer === "back") return (
    <svg viewBox={`0 0 ${W} ${H}`} style={base} preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      {/* Acorn the squirrel stops to inspect */}
      <g transform="translate(104,189)" opacity="0.9">
        <ellipse cx="0" cy="0" rx="2.6" ry="3.2" fill="#B08350"/>
        <path d="M-3 -2.2 Q0 -4.6 3 -2.2 L2.4 -1 Q0 -2.6 -2.4 -1 Z" fill="#7A5230"/>
        <line x1="0" y1="-4.4" x2="0.6" y2="-3" stroke="#7A5230" strokeWidth="0.9"/>
      </g>
      {/* Squirrel — dashes in, stops at the acorn, darts behind the trunk, exits */}
      <g opacity="0.94">
        <animateTransform attributeName="transform" type="translate"
          values="-50 0; 96 0; 96 0; 168 0; 168 0; 430 0; 430 0"
          keyTimes="0; 0.14; 0.30; 0.44; 0.60; 0.80; 1"
          dur="19s" repeatCount="indefinite" calcMode="linear"/>
        <g transform="translate(0,190)">
          <animateTransform attributeName="transform" type="translate" values="0 0; 0 -2; 0 0" dur="0.4s" repeatCount="indefinite" additive="sum"/>
          {/* bushy two-tone tail with a flick */}
          <g>
            <animateTransform attributeName="transform" type="rotate" values="-4 -9 -7; 7 -9 -7; -4 -9 -7" dur="1.1s" repeatCount="indefinite"/>
            <path d="M-9 -7 q-10 -9 -4 -18 q10 -7 12 3" fill={night?"#6E4A34":"#8A5A3B"}/>
            <path d="M-10 -10 q-6 -7 -2 -13 q6 -4 8 2" fill={night?"#87613F":"#A0714F"} opacity="0.75"/>
          </g>
          {/* haunch + body + chest */}
          <circle cx="-3" cy="-5" r="5.4" fill={night?"#87613F":"#A0714F"}/>
          <ellipse cx="2" cy="-6" rx="6.4" ry="5" fill={night?"#87613F":"#A0714F"}/>
          <ellipse cx="5" cy="-4.4" rx="2.6" ry="3" fill={night?"#A88A62":"#C9A87E"} opacity="0.85"/>
          {/* head, ear (with inner), eye, nose */}
          <circle cx="8" cy="-10" r="4.4" fill={night?"#87613F":"#A0714F"}/>
          <circle cx="9.6" cy="-13.9" r="1.7" fill={night?"#6E4A34":"#8A5A3B"}/>
          <circle cx="9.6" cy="-13.9" r="0.8" fill={night?"#A88A62":"#C9A87E"}/>
          <circle cx="9.6" cy="-10.4" r="0.85" fill="#2b2b20"/>
          <circle cx="9.85" cy="-10.65" r="0.3" fill="#fff"/>
          <circle cx="12.2" cy="-9.2" r="0.7" fill={night?"#4A3324":"#5E4327"}/>
          {/* legs + little front paw raised toward the acorn */}
          <ellipse cx="-4" cy="-0.8" rx="2.2" ry="1.3" fill={night?"#6E4A34":"#8A5A3B"}/>
          <ellipse cx="4" cy="-0.8" rx="2" ry="1.2" fill={night?"#6E4A34":"#8A5A3B"}/>
          <ellipse cx="9" cy="-6" rx="1.4" ry="0.9" fill={night?"#6E4A34":"#8A5A3B"} transform="rotate(-30 9 -6)"/>
        </g>
      </g>
      {/* back grass tufts, peeking out either side of the mound */}
      {[[64,198,0],[300,196,0.6],[122,203,1.1]].map(([gx,gy,d],i)=>(
        <g key={i} opacity="0.55">
          <animateTransform attributeName="transform" type="rotate"
            values={`-3 ${gx} ${gy}; 3 ${gx} ${gy}; -3 ${gx} ${gy}`} dur={`${3.4+i*0.7}s`} begin={`${d}s`} repeatCount="indefinite"/>
          <path d={`M${gx} ${gy} q-2 -8 -4 -10 M${gx} ${gy} q0 -9 1 -12 M${gx} ${gy} q3 -7 5 -9`}
            stroke={night?"#4A6A50":"#7FB86A"} strokeWidth="1.6" fill="none" strokeLinecap="round"/>
        </g>
      ))}
      {/* a tiny mushroom + pebbles by the mound's edge */}
      <g transform="translate(282,201)" opacity="0.85">
        <rect x="-1.4" y="-3.6" width="2.8" height="4" rx="1.2" fill="#EFE3CE"/>
        <path d="M-4.4 -3 Q0 -8.4 4.4 -3 Q0 -1.6 -4.4 -3 Z" fill={night?"#B05A50":"#D96C5A"}/>
        <circle cx="-1.6" cy="-4.6" r="0.7" fill="#fff" opacity="0.85"/>
        <circle cx="1.4" cy="-4" r="0.5" fill="#fff" opacity="0.85"/>
      </g>
      {[[74,205,2.2],[80,207,1.4],[296,206,1.8]].map(([px,py,pr],i)=>(
        <ellipse key={i} cx={px} cy={py} rx={pr} ry={pr*0.6} fill={night?"#5A6A60":"#B9C4B4"} opacity="0.7"/>
      ))}
    </svg>
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{...base,zIndex:2}} preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      {/* Dappled light pools breathing on the ground (day only) */}
      {!night && [[150,200,26,0],[248,196,20,3.5]].map(([dx,dy,dr,d],i)=>(
        <ellipse key={i} cx={dx} cy={dy} rx={dr} ry={dr*0.32} fill="#FFF6D8">
          <animate attributeName="opacity" values="0.05;0.22;0.05" dur="8s" begin={`${d}s`} repeatCount="indefinite"/>
        </ellipse>
      ))}

      {/* Bird visitor — glides down from the canopy, pecks about, flies off */}
      <g opacity="0.95">
        <animateTransform attributeName="transform" type="translate"
          values="110 -170; 0 0; 0 0; 110 -170; 110 -170"
          keyTimes="0; 0.10; 0.62; 0.74; 1" dur="27s" repeatCount="indefinite"
          calcMode="spline" keySplines="0.3 0 0.4 1;0 0 1 1;0.5 0 0.7 1;0 0 1 1"/>
        <g transform="translate(300,192)">
          {/* peck: quick tilt forward, twice, then look up */}
          <animateTransform attributeName="transform" type="rotate"
            values="0 0 2; 0 0 2; 24 0 2; 0 0 2; 24 0 2; 0 0 2; -8 0 2; 0 0 2"
            keyTimes="0;0.3;0.36;0.42;0.48;0.54;0.7;1" dur="6.5s" repeatCount="indefinite" additive="sum"/>
          <path d="M-5.5 0.3 L-3.4 -0.8 Q-1.6 -2.6 1.4 -2.4 Q4.6 -2 5.8 -0.4 Q4.8 1.8 1 2.1 Q-1.8 2.2 -3.4 1.3 Z" fill={night?"#5A6A78":"#6E8898"}/>
          <path d="M-5.5 0.3 L-3.6 1.1 L-3.6 -0.6 Z" fill={night?"#5A6A78":"#6E8898"}/>
          <path d="M-2 1.4 Q1 2 4 1 Q1.4 2.4 -1 2 Z" fill={night?"#7A8A98":"#A6BCC8"}/>
          <circle cx="5.4" cy="-1.6" r="1.9" fill={night?"#5A6A78":"#6E8898"}/>
          <path d="M7.1 -1.7 L8.8 -1.2 L7 -0.7 Z" fill="#E8A23A"/>
          <circle cx="5.8" cy="-2" r="0.42" fill="#fff" opacity="0.9"/>
          <path d="M0.4 -1.2 q-2.4 -3.6 -5.6 -4.4 q1.6 3.6 4 4.8 z" fill={night?"#4A5A66":"#5A7484"}/>
          <ellipse cx="-1" cy="2.4" rx="0.7" ry="1" fill="#B08350"/>
          <ellipse cx="2" cy="2.4" rx="0.7" ry="1" fill="#B08350"/>
        </g>
      </g>

      {/* Falling leaves — spawn near the canopy, sway down, fade at the ground */}
      {[[168,44,"#7FB86A",7,0],[222,58,"#F4C04B",9,2.4],[148,70,"#9BC46A",8,4.8],[238,40,"#E0955A",10,6.5],[196,36,"#C4906A",11,9]].map(([lx,ly,c,dur,d],i)=>(
        <g key={i}>
          <animateTransform attributeName="transform" type="translate"
            values={`0 0; ${i%2?14:-12} ${(190-ly)*0.5}; ${i%2?-6:10} ${190-ly}`}
            dur={`${dur}s`} begin={`${d}s`} repeatCount="indefinite" calcMode="spline"
            keySplines="0.4 0 0.6 1; 0.4 0 0.6 1" keyTimes="0;0.5;1"/>
          <g transform={`translate(${lx},${ly})`}>
            <path d="M0 0 q3.4 -3 0 -7.4 q-3.4 4.4 0 7.4" fill={c} opacity="0.85">
              <animateTransform attributeName="transform" type="rotate" values="0;150;330" dur={`${dur*0.6}s`} begin={`${d}s`} repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0;0.85;0.85;0" keyTimes="0;0.12;0.82;1" dur={`${dur}s`} begin={`${d}s`} repeatCount="indefinite"/>
            </path>
          </g>
        </g>
      ))}

      {/* Day/dusk: butterflies wandering · Night: fireflies pulsing */}
      {!night ? [[86,96,"#E8A7C4",13,0],[292,84,"#A7C4E8",16,3]].map(([bx,by,c,dur,d],i)=>(
        <g key={i} opacity="0.8">
          <animateTransform attributeName="transform" type="translate"
            values="0 0; 16 -14; 30 4; 12 14; 0 0" dur={`${dur}s`} begin={`${d}s`} repeatCount="indefinite"
            calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.25;0.5;0.75;1"/>
          <g transform={`translate(${bx},${by})`}>
            <ellipse cx="-2.4" cy="0" rx="2.6" ry="3.6" fill={c}>
              <animate attributeName="rx" values="2.6;0.7;2.6" dur="0.5s" repeatCount="indefinite"/>
            </ellipse>
            <ellipse cx="2.4" cy="0" rx="2.6" ry="3.6" fill={c}>
              <animate attributeName="rx" values="2.6;0.7;2.6" dur="0.5s" repeatCount="indefinite"/>
            </ellipse>
            <rect x="-0.7" y="-3" width="1.4" height="6" rx="0.7" fill="#5A4A3A"/>
          </g>
        </g>
      )) : [[96,110,0],[286,92,1.2],[210,132,2.1]].map(([fx,fy,d],i)=>(
        <circle key={i} cx={fx} cy={fy} r="1.6" fill="#ffe88a">
          <animate attributeName="opacity" values="0.15;0.95;0.15" dur={`${2.6+i*0.8}s`} begin={`${d}s`} repeatCount="indefinite"/>
          <animate attributeName="cy" values={`${fy};${fy-12};${fy}`} dur={`${6+i}s`} begin={`${d}s`} repeatCount="indefinite"/>
        </circle>
      ))}

      {/* Drifting pollen motes rising through the light (day only) */}
      {!night && [[120,150,0],[260,168,2],[176,120,4],[236,140,6]].map(([px,py,d],i)=>(
        <circle key={i} cx={px} cy={py} r="1.1" fill="#FFF3C4">
          <animate attributeName="cy" values={`${py};${py-34}`} dur={`${9+i*2}s`} begin={`${d}s`} repeatCount="indefinite"/>
          <animate attributeName="cx" values={`${px};${px+(i%2?8:-8)};${px}`} dur={`${5+i}s`} begin={`${d}s`} repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0;0.6;0" dur={`${9+i*2}s`} begin={`${d}s`} repeatCount="indefinite"/>
        </circle>
      ))}

      {/* Occasional wind streaks — two soft curves that breathe through */}
      {[[70,88,0],[210,128,4.5]].map(([wx,wy,d],i)=>(
        <path key={i} d={`M${wx} ${wy} q22 -7 44 0 q14 5 26 -2`} stroke={night?"#9fb4e8":"#B9CFC2"} strokeWidth="1.4"
          fill="none" strokeLinecap="round" opacity="0">
          <animate attributeName="opacity" values="0;0;0.4;0" keyTimes="0;0.55;0.72;1" dur="9s" begin={`${d}s`} repeatCount="indefinite"/>
          <animateTransform attributeName="transform" type="translate" values="0 0; 26 0" dur="9s" begin={`${d}s`} repeatCount="indefinite"/>
        </path>
      ))}

      {/* front grass + two tiny flowers at the mound's lip */}
      {[[128,207,0.3],[252,206,0.9],[196,210,1.5]].map(([gx,gy,d],i)=>(
        <g key={i} opacity="0.7">
          <animateTransform attributeName="transform" type="rotate"
            values={`-4 ${gx} ${gy}; 4 ${gx} ${gy}; -4 ${gx} ${gy}`} dur={`${3+i*0.6}s`} begin={`${d}s`} repeatCount="indefinite"/>
          <path d={`M${gx} ${gy} q-2 -8 -4 -11 M${gx} ${gy} q0 -10 1 -13 M${gx} ${gy} q3 -8 5 -10`}
            stroke={night?"#557A5C":"#8FC479"} strokeWidth="1.7" fill="none" strokeLinecap="round"/>
        </g>
      ))}
      {[[148,204,"#F4A7B9"],[236,203,"#F4C04B"]].map(([fx,fy,c],i)=>(
        <g key={i} opacity="0.85">
          <animateTransform attributeName="transform" type="rotate"
            values={`-3 ${fx} ${fy+6}; 3 ${fx} ${fy+6}; -3 ${fx} ${fy+6}`} dur={`${3.6+i}s`} repeatCount="indefinite"/>
          <line x1={fx} y1={fy+6} x2={fx} y2={fy} stroke={night?"#557A5C":"#8FC479"} strokeWidth="1.3"/>
          {[0,90,180,270].map(a=>(
            <circle key={a} cx={fx+Math.cos(a*Math.PI/180)*2.2} cy={fy+Math.sin(a*Math.PI/180)*2.2} r="1.7" fill={c}/>
          ))}
          <circle cx={fx} cy={fy} r="1.3" fill="#FFF3C4"/>
        </g>
      ))}
    </svg>
  );
}

function CompleteScreen({ subject, secs, coinsEarned, streak, streakExtended, timerMode, pomodoro, task, onCompleteTask, onDismiss }) {
  // Coin count-up: 0 → coinsEarned over ~0.9s with ease-out, starting after the pop-in
  const [shownCoins, setShownCoins] = useState(0);
  useEffect(()=>{
    if(coinsEarned<=0){ setShownCoins(0); return; }
    let raf, start=null;
    const D=900, DELAY=350;
    const tick = t => {
      if(start===null) start=t;
      const el = t-start-DELAY;
      if(el<0){ raf=requestAnimationFrame(tick); return; }
      const p = Math.min(el/D, 1);
      setShownCoins(Math.round(coinsEarned * (1-Math.pow(1-p,3)))); // ease-out cubic
      if(p<1) raf=requestAnimationFrame(tick);
    };
    raf=requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(raf);
  },[coinsEarned]);

  // One-shot confetti burst: subject colour + gold + leaf green
  const confetti = Array.from({length:14},(_,i)=>({
    left: 6+((i*61)%88),                       // % across the card
    delay: (i%7)*0.06,
    color: [subject.color,"#F4C04B","#7FB86A","#F4A7B9"][i%4],
    k:`cf${i}`,
  }));

  return (
    <div style={cs.wrap} className="sg-overlay-anim">
      <div style={{...cs.card,position:"relative",overflow:"hidden"}} className="sg-pop-anim">
        {confetti.map(c=>(
          <span key={c.k} className="sg-confetti"
            style={{left:`${c.left}%`,background:c.color,animationDelay:`${c.delay}s`}}/>
        ))}
        <div style={{fontSize:60,marginBottom:8}} className="sg-bounce-in">✨</div>
        <h2 style={cs.title}>Growth saved!</h2>
        <p style={cs.sub}>Your {subject.label} session helped your learner grow.</p>
        <div style={{...cs.stat,color:subject.color}}>{fmtMins(secs)}</div>
        {timerMode==="pomodoro"&&pomodoro&&<div style={cs.pomodoroSummary}>
          {pomodoro.completedRounds} of {pomodoro.plannedRounds} focus rounds completed
        </div>}
        <div style={cs.coinRow}><span style={cs.coin}>🪙 +{shownCoins} coins earned</span></div>
        {streak>0 && (
          <div className="sg-streak-pop"
            style={{...cs.streakPill,...(streakExtended?cs.streakPillHot:{})}}>
            🔥 {streak}-day streak{streakExtended?" — extended!":""}
          </div>
        )}
        {task&&<div style={cs.taskCard}>
          <div style={cs.taskCopy}>Task · {task.title}</div>
          <button style={cs.taskButton} onClick={onCompleteTask}>Mark complete</button>
        </div>}
        <button style={{...cs.btn,background:subject.color}} onClick={onDismiss}>Back to Classroom</button>
      </div>
    </div>
  );
}

const cs = {
  wrap:{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",padding:20},
  card:{background:"#fff",borderRadius:24,padding:"36px 28px",textAlign:"center",maxWidth:320,width:"100%",boxShadow:"0 16px 48px rgba(0,0,0,0.2)"},
  title:{fontSize:24,fontWeight:800,color:"#1a1a2e",margin:"0 0 8px"},
  sub:{fontSize:14,color:"#888",margin:"0 0 20px"},
  stat:{fontSize:48,fontWeight:900,letterSpacing:"-2px",marginBottom:8},
  pomodoroSummary:{fontSize:11.5,color:"#718078",margin:"-3px 0 10px"},
  coinRow:{marginBottom:14},
  coin:{display:"inline-block",background:"#FFF8E7",border:"1px solid #F0D060",borderRadius:20,padding:"6px 16px",fontSize:14,fontWeight:600,color:"#B8860B",minWidth:150},
  streakPill:{display:"inline-block",background:"#F5F7F2",border:"1.5px solid #E0E8DC",borderRadius:20,padding:"7px 16px",fontSize:13.5,fontWeight:700,color:"#666",marginBottom:22},
  streakPillHot:{background:"linear-gradient(180deg,#FFF4E0,#FFE9C4)",borderColor:"#F4C04B",color:"#B8741A",boxShadow:"0 2px 10px rgba(244,162,58,0.25)"},
  taskCard:{display:"flex",alignItems:"center",gap:8,background:"#F3F7F2",border:"1px solid #DFE8DC",borderRadius:12,padding:"8px 9px",margin:"0 0 11px",textAlign:"left"},
  taskCopy:{flex:1,minWidth:0,fontSize:11,color:"#64736A",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},
  taskButton:{minHeight:34,border:"1px solid #C7DCCB",borderRadius:10,background:"#fff",color:"#2D6A4F",fontSize:10.5,fontWeight:750,padding:"6px 9px",cursor:"pointer",whiteSpace:"nowrap"},
  btn:{display:"block",width:"100%",padding:"14px 0",border:"none",borderRadius:14,fontSize:16,fontWeight:700,color:"#fff",cursor:"pointer"},
};

// ── Add Subject Modal ─────────────────────────────────────────────────────────
function AddSubjectModal({ onAdd, onClose, existing }) {
  const [label,setLabel]=useState(""); const [emoji,setEmoji]=useState("📝");
  const [color,setColor]=useState("#56B68B"); const [err,setErr]=useState("");
  const handle=()=>{
    const t=label.trim();
    if(!t){setErr("Enter a name");return;}
    if(t.length>18){setErr("Max 18 chars");return;}
    if(existing.some(s=>s.label.toLowerCase()===t.toLowerCase())){setErr("Already exists");return;}
    onAdd({id:"custom_"+Date.now(),label:t,emoji,color});
  };
  return (
    <div style={am.overlay} className="sg-overlay-anim" onClick={onClose}>
      <div style={am.modal} className="sg-pop-anim" onClick={e=>e.stopPropagation()}>
        <h3 style={am.title}>Add Subject</h3>
        <input style={{...am.input,...(err?am.inputErr:{})}} placeholder="e.g. Chemistry"
          value={label} onChange={e=>{setLabel(e.target.value);setErr("");}}
          onKeyDown={e=>e.key==="Enter"&&handle()} autoFocus maxLength={19}/>
        {err&&<p style={am.err}>{err}</p>}
        <p style={am.lbl}>Emoji</p>
        <div style={am.emojiGrid}>{EMOJI_OPTIONS.map(em=>(
          <button key={em} style={{...am.emojiBtn,...(emoji===em?am.emojiOn:{})}} onClick={()=>setEmoji(em)}>{em}</button>
        ))}</div>
        <p style={am.lbl}>Colour</p>
        <div style={am.colorRow}>{COLOR_OPTIONS.map(c=>(
          <button key={c} style={{...am.swatch,background:c,...(color===c?am.swatchOn:{})}} onClick={()=>setColor(c)}/>
        ))}</div>
        <div style={{display:"flex",gap:8,marginTop:20}}>
          <button style={am.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={{...am.addBtn,background:color}} onClick={handle}>Add</button>
        </div>
      </div>
    </div>
  );
}

const am = {
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:20},
  modal:{background:"#fff",borderRadius:20,padding:"24px 20px",width:"100%",maxWidth:340,boxShadow:"0 8px 32px rgba(0,0,0,0.18)"},
  title:{fontSize:18,fontWeight:700,color:"#1a1a2e",margin:"0 0 14px"},
  lbl:{fontSize:12,fontWeight:600,color:"#888",margin:"12px 0 6px"},
  input:{display:"block",width:"100%",padding:"10px 12px",border:"1.5px solid #E0E8DC",borderRadius:10,fontSize:14,outline:"none",boxSizing:"border-box"},
  inputErr:{borderColor:"#E07B54"},
  err:{color:"#E07B54",fontSize:12,margin:"4px 0 0"},
  emojiGrid:{display:"grid",gridTemplateColumns:"repeat(10,1fr)",gap:4},
  emojiBtn:{background:"#f5f5f5",border:"1.5px solid transparent",borderRadius:8,padding:"4px 2px",fontSize:16,cursor:"pointer"},
  emojiOn:{border:"1.5px solid #2D6A4F",background:"#E8F5EE"},
  colorRow:{display:"flex",flexWrap:"wrap",gap:8},
  swatch:{width:28,height:28,borderRadius:"50%",border:"2px solid transparent",cursor:"pointer"},
  swatchOn:{border:"3px solid #1a1a2e",transform:"scale(1.2)"},
  cancelBtn:{flex:1,padding:"11px 0",background:"#f5f5f5",border:"none",borderRadius:12,fontSize:14,fontWeight:600,color:"#666",cursor:"pointer"},
  addBtn:{flex:2,padding:"11px 0",border:"none",borderRadius:12,fontSize:14,fontWeight:700,color:"#fff",cursor:"pointer"},
};

// ── Coin Shop ─────────────────────────────────────────────────────────────────
// Shop cards used to mount every animated SVG at once. That meant dozens of
// off-screen SMIL timelines were still repainting while the sheet scrolled.
// First-mount cards near the viewport, keep their SVG in the DOM afterward,
// and freeze off-screen/scrolling animation timelines. Keeping a stable SVG
// avoids mobile WebKit dropping a re-created skin while its sheet is scrolling.
function LazyShopTree({ skin, enhance=0, scrolling=false }) {
  const hostRef=useRef(null);
  const [nearViewport,setNearViewport]=useState(false);
  const [mounted,setMounted]=useState(false);
  useEffect(()=>{
    const host=hostRef.current;
    if(!host)return;
    if(typeof IntersectionObserver==="undefined"){setNearViewport(true);setMounted(true);return;}
    const observer=new IntersectionObserver(([entry])=>{
      const visible=!!entry?.isIntersecting;
      setNearViewport(visible);
      if(visible)setMounted(true);
    },{rootMargin:"180px 0px"});
    observer.observe(host);
    return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    const svg=hostRef.current?.querySelector("svg");
    if(!svg)return;
    const sync=()=>{
      try{
        if(scrolling||!nearViewport||document.hidden)svg.pauseAnimations?.();
        else svg.unpauseAnimations?.();
      }catch{}
    };
    sync();
    document.addEventListener("visibilitychange",sync);
    return()=>document.removeEventListener("visibilitychange",sync);
  },[nearViewport,scrolling,mounted]);
  return <div ref={hostRef} style={{height:108,width:"100%",position:"relative",overflow:"hidden"}}>
    {mounted
      ? <div style={{position:"absolute",left:"50%",bottom:0,width:160,height:180,transform:"translateX(-50%) scale(.48)",transformOrigin:"bottom center"}}>
          <TreeSVG progress={0.7} color={skin.canopy||"#56B68B"} paused={false} skin={skin.id} enhance={enhance}/>
        </div>
      : <div className="sg-skeleton" style={{width:66,height:58,borderRadius:"50% 50% 42% 42%",animation:"none",opacity:.55}}/>}
  </div>;
}

function CoinShop({ coins, ownedSkins, activeSkin, enhancements={}, onBuy, onEquip, onEnhance,
  onOpenDecorations, onOpenBackgrounds, onClose, onBack }) {
  const [toast, setToast] = useState(null);
  const [enhancing, setEnhancing] = useState(null); // skin id being enhanced
  const [query, setQuery] = useState("");
  const [activeCollection, setActiveCollection] = useState("all");
  const [scrolling,setScrolling]=useState(false);
  const scrollTimerRef=useRef(null);
  const [chipRowRef, chipEdge] = useHScroll();
  const showT = m => { setToast(m); setTimeout(()=>setToast(null),2000); };
  const enhSkin = enhancing ? TREE_SKINS.find(s=>s.id===enhancing) : null;

  const q = query.trim().toLowerCase();
  const filtered = TREE_SHOP_CATALOGUE.filter(skin => {
    if(activeCollection!=="all" && skin.collection!==activeCollection) return false;
    if(q && !skin.name.toLowerCase().includes(q) && !skin.desc.toLowerCase().includes(q)) return false;
    return true;
  });
  const onShopScroll=()=>{
    setScrolling(true);
    clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current=setTimeout(()=>setScrolling(false),140);
  };
  useEffect(()=>()=>clearTimeout(scrollTimerRef.current),[]);

  return (
    <div style={sh.overlay} className="sg-overlay-anim" onClick={onClose}>
      <div style={sh.modal} className="sg-sheet-anim sg-shop-sheet" onClick={e=>e.stopPropagation()} onScroll={onShopScroll}>
        <div style={sh.header}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {onBack && <button style={sh.backBtn} onClick={onBack} title="Back">←</button>}
            <div>
              <h3 style={sh.title}>🧑‍🎓 Skins</h3>
              <div style={sh.subtitle}>{ownedSkins.length} of {TREE_SKINS.length} unlocked</div>
            </div>
          </div>
          <span style={sh.coinBal}><AnimatedNumber value={coins} prefix="🪙 "/></span>
        </div>

        <ShopCategoryTabs
          active="trees"
          onTrees={()=>{}}
          onDecorations={onOpenDecorations}
          onBackgrounds={onOpenBackgrounds}
        />

        {/* Search */}
        <div style={sh.searchWrap}>
          <span style={sh.searchIcon}>🔍</span>
          <input style={sh.searchInput} className="sg-focus-ring" type="text" value={query} placeholder="Search skins…"
            onChange={e=>setQuery(e.target.value)}/>
          {query && <button style={sh.searchClear} onClick={()=>setQuery("")} title="Clear search">✕</button>}
        </div>

        {/* Collection filter chips — scroll with a plain mouse wheel now too */}
        <div style={sh.chipRowWrap}>
          <div style={sh.chipRow} ref={chipRowRef}>
            {SKIN_COLLECTIONS.map(col=>{
              const isActive = activeCollection===col.id;
              const count = col.id==="all" ? TREE_SKINS.length : TREE_SKINS.filter(s=>s.collection===col.id).length;
              return (
                <button key={col.id} onClick={()=>setActiveCollection(col.id)}
                  style={{...sh.chip, ...(isActive?sh.chipActive:{})}}>
                  <span>{col.icon}</span> {col.label} <span style={{...sh.chipCount,...(isActive?sh.chipCountActive:{})}}>{count}</span>
                </button>
              );
            })}
          </div>
          {!chipEdge.atStart && <div style={sh.chipFadeL}/>}
          {!chipEdge.atEnd && <div style={sh.chipFadeR}/>}
        </div>

        {toast && <div style={sh.toast}>{toast}</div>}

        {filtered.length===0 ? (
          <div style={sh.emptyState}>
            <div style={{fontSize:32,marginBottom:6}}>🌱</div>
            <div style={{fontWeight:700,color:"#1a1a2e",marginBottom:4}}>No skins match</div>
            <div style={{fontSize:12.5,color:"#8A9088",marginBottom:14}}>Try a different search or collection.</div>
            <button style={sh.clearFiltersBtn} onClick={()=>{setQuery("");setActiveCollection("all");}}>Clear filters</button>
          </div>
        ) : (
          <div style={sh.grid} className="sg-shop-grid">
            {filtered.map((skin,idx)=>{
              const owned   = ownedSkins.includes(skin.id);
              const active  = activeSkin === skin.id;
              const canBuy  = !owned && coins >= skin.cost;
              const tier    = enhancements[skin.id]||0;
              return (
                <div key={skin.id} className="sg-card-anim sg-lift-card sg-shop-card" style={{...sh.card,...(active?sh.cardActive:{}),animationDelay:`${Math.min(idx*0.03,0.3)}s`}}>
                  {skin.flagship
                    ? <div style={sh.flagshipBadge}>FLAGSHIP</div>
                    : skin.isNew && !owned && <div style={sh.newBadge}>NEW</div>}
                  {tier>0 && <div style={sh.tierBadge} title={`${(skin.enhanceTiers?.[tier-1]||ENHANCE_TIERS[tier-1]).name}`}>{"✦".repeat(tier)}</div>}
                  <div style={sh.preview}>
                    <LazyShopTree skin={skin} enhance={owned?tier:0} scrolling={scrolling}/>
                  </div>
                  <div style={sh.skinName}>{skin.name}</div>
                  <div style={sh.skinDesc}>{skin.desc}</div>
                  {skin.cost===0
                    ? <div style={sh.freeBadge}>Free</div>
                    : owned
                      ? null
                      : <div style={sh.costBadge}>🪙 {skin.cost}</div>
                  }
                  {active
                    ? <div style={sh.equippedBtn}>✓ Equipped</div>
                    : owned
                      ? <button style={sh.equipBtn} onClick={()=>{onEquip(skin.id);showT(`${skin.name} equipped!`);}}>Equip</button>
                      : <button style={{...sh.buyBtn,...(!canBuy?sh.buyBtnDisabled:{})}}
                          onClick={async()=>{ if(!canBuy){showT("Not enough coins");return;} const ok=await onBuy(skin.id,skin.cost); showT(ok?`${skin.name} unlocked! 🎉`:"Purchase couldn't be completed"); }}
                          disabled={!canBuy}>
                          {canBuy?"Buy":"Need more 🪙"}
                        </button>
                  }
                  {owned && (
                    <button style={{...sh.enhanceBtn,...(tier>=3?sh.enhanceBtnMax:{})}}
                      onClick={()=>setEnhancing(skin.id)}>
                      {tier>=3 ? "✨ Radiant" : `✦ Enhance${tier>0?` · ${tier}/3`:""}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <button style={sh.closeBtn} onClick={onClose}>Done</button>
      </div>
      {enhSkin && (
        <EnhanceModal skin={enhSkin} tier={enhancements[enhSkin.id]||0} coins={coins}
          onUpgrade={onEnhance} onClose={()=>setEnhancing(null)} onBack={()=>setEnhancing(null)}/>
      )}
    </div>
  );
}

const sh = {
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:300,padding:0,overflow:"hidden"},
  modal:{background:"#fff",borderRadius:"26px 26px 0 0",padding:"22px max(14px,env(safe-area-inset-right)) max(34px,calc(env(safe-area-inset-bottom) + 18px)) max(14px,env(safe-area-inset-left))",width:"100%",maxWidth:460,maxHeight:"min(88dvh,88vh)",overflowY:"auto",overflowX:"hidden",overscrollBehavior:"contain",WebkitOverflowScrolling:"touch"},
  header:{position:"sticky",top:-22,zIndex:12,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,margin:"-22px 0 10px",padding:"22px 0 10px",background:"linear-gradient(180deg,#fff 82%,rgba(255,255,255,.94))"},
  backBtn:{background:"#F0F2EE",border:"none",borderRadius:"50%",width:32,height:32,fontSize:17,color:"#666",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,lineHeight:1,marginTop:1},
  title:{fontSize:18,fontWeight:700,color:"#1a1a2e",margin:0},
  subtitle:{fontSize:11.5,color:"#9AA69C",fontWeight:600,marginTop:2},
  coinBal:{fontSize:14,fontWeight:700,color:"#B8860B",background:"#FFF8E7",border:"1px solid #F0D060",borderRadius:20,padding:"5px 10px",flexShrink:0,whiteSpace:"nowrap"},

  searchWrap:{position:"relative",display:"flex",alignItems:"center",marginBottom:10},
  searchIcon:{position:"absolute",left:13,fontSize:13,opacity:0.55,pointerEvents:"none"},
  searchInput:{width:"100%",boxSizing:"border-box",padding:"10px 34px 10px 34px",border:"1.5px solid #E8EDE4",background:"#F9FBF8",borderRadius:14,fontSize:13.5,color:"#1a1a2e",outline:"none",transition:"border-color .15s, box-shadow .15s"},
  searchClear:{position:"absolute",right:8,background:"#E8EDE4",border:"none",borderRadius:"50%",width:20,height:20,fontSize:10,color:"#666",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1},

  chipRowWrap:{position:"relative",width:"100%",minWidth:0,maxWidth:"100%",overflow:"hidden",marginBottom:8},
  chipRow:{display:"flex",width:"100%",maxWidth:"100%",gap:7,overflowX:"auto",overflowY:"hidden",paddingBottom:4,scrollbarWidth:"none",cursor:"grab",overscrollBehaviorX:"contain"},
  chipFadeL:{position:"absolute",left:0,top:0,bottom:4,width:26,background:"linear-gradient(to right,#fff,rgba(255,255,255,0))",pointerEvents:"none"},
  chipFadeR:{position:"absolute",right:0,top:0,bottom:4,width:26,background:"linear-gradient(to left,#fff,rgba(255,255,255,0))",pointerEvents:"none"},
  chip:{flexShrink:0,display:"flex",alignItems:"center",gap:5,fontSize:12.5,fontWeight:600,color:"#5A6A5C",background:"#F5F7F2",border:"1.5px solid transparent",borderRadius:20,padding:"7px 13px",cursor:"pointer",whiteSpace:"nowrap"},
  chipActive:{color:"#2D6A4F",background:"#E8F5EE",border:"1.5px solid #BFE3CE"},
  chipCount:{fontSize:10,fontWeight:700,color:"#9AA69C",background:"#fff",borderRadius:8,padding:"1px 5px",marginLeft:1},
  chipCountActive:{color:"#2D6A4F",background:"#D7EEDF"},

  toast:{background:"#1a1a2e",color:"#fff",borderRadius:10,padding:"8px 14px",fontSize:13,marginBottom:12,textAlign:"center"},

  emptyState:{textAlign:"center",padding:"30px 10px 10px"},
  clearFiltersBtn:{fontSize:12,fontWeight:600,color:"#2D6A4F",background:"#E8F5EE",border:"none",borderRadius:20,padding:"8px 18px",cursor:"pointer"},

  grid:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10,marginTop:4,width:"100%",minWidth:0},
  card:{minWidth:0,minHeight:278,background:"#F9FBF8",borderRadius:17,padding:"13px 10px 12px",display:"flex",flexDirection:"column",alignItems:"center",border:"1.5px solid #E8EDE4",boxShadow:"0 2px 8px rgba(26,42,32,0.05)",position:"relative"},
  cardActive:{border:"2px solid #2D6A4F",background:"#F0FBF6",boxShadow:"0 3px 12px rgba(45,106,79,0.12)"},
  newBadge:{position:"absolute",top:8,left:8,fontSize:9.5,fontWeight:800,color:"#fff",background:"linear-gradient(135deg,#FF8B6B,#FF6F61)",borderRadius:8,padding:"2px 7px",letterSpacing:0.6,boxShadow:"0 2px 5px rgba(255,111,97,0.35)"},
  flagshipBadge:{position:"absolute",top:8,left:8,fontSize:9,fontWeight:900,color:"#4B3B10",background:"linear-gradient(135deg,#FFF4A8,#E8C84E)",border:"1px solid #D8B83A",borderRadius:8,padding:"2px 7px",letterSpacing:0.8,boxShadow:"0 2px 7px rgba(190,145,25,0.24)",zIndex:2},
  tierBadge:{position:"absolute",top:8,right:9,fontSize:10,fontWeight:800,color:"#B8860B",background:"#FFF8E7",border:"1px solid #F0D060",borderRadius:10,padding:"2px 7px",letterSpacing:1},
  enhanceBtn:{fontSize:11,fontWeight:700,color:"#7A5AA0",background:"#F4EEFA",border:"none",borderRadius:20,padding:"5px 13px",cursor:"pointer",marginTop:6},
  enhanceBtnMax:{color:"#B8860B",background:"#FFF8E7"},
  preview:{height:110,width:"100%",borderRadius:12,background:"radial-gradient(ellipse 72% 58% at center 82%, rgba(45,106,79,0.08), transparent 74%)",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"},
  skinName:{width:"100%",minWidth:0,fontSize:12.5,fontWeight:700,color:"#1a1a2e",marginTop:5,marginBottom:2,textAlign:"center",lineHeight:1.25,overflowWrap:"anywhere"},
  skinDesc:{width:"100%",minHeight:27,fontSize:9.75,color:"#929A93",marginBottom:5,textAlign:"center",lineHeight:1.35,display:"-webkit-box",WebkitBoxOrient:"vertical",WebkitLineClamp:2,overflow:"hidden",overflowWrap:"anywhere"},
  freeBadge:{fontSize:10.5,color:"#56B68B",fontWeight:600,marginBottom:5,minHeight:14},
  costBadge:{fontSize:10.5,color:"#B8860B",fontWeight:600,marginBottom:5,minHeight:14},
  equippedBtn:{width:"100%",maxWidth:132,textAlign:"center",fontSize:11,color:"#2D6A4F",fontWeight:700,padding:"6px 10px",background:"#E8F5EE",borderRadius:20,marginTop:"auto"},
  equipBtn:{width:"100%",maxWidth:132,fontSize:11.5,fontWeight:600,color:"#2D6A4F",background:"#E8F5EE",border:"none",borderRadius:20,padding:"7px 10px",cursor:"pointer",marginTop:"auto"},
  buyBtn:{width:"100%",maxWidth:132,fontSize:11.5,fontWeight:600,color:"#fff",background:"#2D6A4F",border:"none",borderRadius:20,padding:"7px 10px",cursor:"pointer",marginTop:"auto",whiteSpace:"normal"},
  buyBtnDisabled:{background:"#ccc",cursor:"not-allowed"},
  closeBtn:{display:"block",width:"100%",marginTop:18,padding:"13px 0",background:"#F5F7F2",border:"none",borderRadius:14,fontSize:15,fontWeight:600,color:"#666",cursor:"pointer"},
};

// ── Tree Enhancement ──────────────────────────────────────────────────────────
// Per-skin permanent upgrades. The preview is the REAL renderer (TreeSVG with
// the enhance prop) so what you see is exactly what your forest gets — no
// separate preview art to drift out of sync.
function EnhanceModal({ skin, tier, coins, onUpgrade, onClose, onBack }) {
  const [previewTier, setPreviewTier] = useState(tier);
  const [bloom, setBloom] = useState(0);
  const [upgrading,setUpgrading]=useState(false);
  const [upgradeError,setUpgradeError]=useState("");
  const nextTier = tier < 3 ? tier + 1 : null;
  const cost = nextTier ? enhanceCost(skin, nextTier) : 0;
  const short = nextTier ? Math.max(0, cost - coins) : 0;
  const canAfford = nextTier && short === 0;
  const tierMeta = n => skin.enhanceTiers?.[n-1] || ENHANCE_TIERS[n-1];
  const pv = previewTier === 0
    ? { name:"Base", icon:"🌱", blurb:`${skin.name} as it grows today.` }
    : tierMeta(previewTier);
  const locked = previewTier > tier;

  const doUpgrade = async() => {
    if(!canAfford||upgrading) return;
    setUpgrading(true);setUpgradeError("");
    const ok=await onUpgrade(skin.id,cost);
    setUpgrading(false);
    if(!ok){setUpgradeError("Couldn't complete that enhancement. Your balance has been refreshed.");return;}
    setBloom(b=>b+1);setPreviewTier(nextTier);
  };

  return (
    <div style={em.overlay} className="sg-overlay-anim" onClick={onClose}>
      <div style={em.modal} className="sg-sheet-anim" onClick={e=>e.stopPropagation()}>
        <div style={em.header}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {onBack && <button style={em.back} onClick={onBack} title="Back">←</button>}
            <div>
              <div style={em.kicker}>ENHANCE</div>
              <h3 style={em.title}>{skin.name}</h3>
            </div>
          </div>
          <span style={em.coinBal}><AnimatedNumber value={coins} prefix="🪙 "/></span>
        </div>

        {/* Live preview — arrows step through tiers; future tiers show locked */}
        <div style={em.previewWrap}>
          <button style={{...em.arrow,opacity:previewTier<=0?0.25:1}} disabled={previewTier<=0}
            onClick={()=>setPreviewTier(t=>Math.max(0,t-1))}>‹</button>
          <div style={em.previewStage}>
            {bloom>0 && <div key={bloom} style={em.bloomRing} className="sg-bloom"/>}
            <div style={{...em.previewTree,...(locked?{filter:"grayscale(35%) opacity(0.75)"}:{})}} className="sg-preview-settle" key={`pv-${previewTier}`}>
              <TreeSVG progress={1} color={skin.canopy||"#56B68B"} paused={false} large skin={skin.id} enhance={previewTier}/>
            </div>
            {locked && <div style={em.lockBadge}>🔒 Tier {previewTier}</div>}
          </div>
          <button style={{...em.arrow,opacity:previewTier>=3?0.25:1}} disabled={previewTier>=3}
            onClick={()=>setPreviewTier(t=>Math.min(3,t+1))}>›</button>
        </div>

        {/* Progress pips — filled = owned */}
        <div style={em.pipsRow}>
          {[1,2,3].map(t=>(
            <div key={t} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,flex:1}}>
              <div style={{...em.pipBar,...(t<=tier?em.pipBarOn:{}),...(t===previewTier?{outline:"2px solid #2D6A4F55",outlineOffset:2}:{})}}/>
              <span style={{...em.pipLabel,...(t<=tier?{color:"#2D6A4F",fontWeight:700}:{})}}>{tierMeta(t).name}</span>
            </div>
          ))}
        </div>

        {/* Detail for the previewed tier */}
        <div style={em.detailCard} className="sg-view-anim" key={`d-${previewTier}`}>
          <div style={em.detailName}>{pv.icon} {pv.name}{previewTier>0 && previewTier<=tier && <span style={em.ownedTag}>✓ owned</span>}{locked && <span style={em.lockedTag}>locked</span>}</div>
          <div style={em.detailBlurb}>{pv.blurb}</div>
        </div>

        {/* Upgrade action */}
        {nextTier ? (
          <>
            <button style={{...em.upgradeBtn,...(!canAfford||upgrading?em.upgradeBtnDisabled:{})}}
              disabled={!canAfford||upgrading} onClick={doUpgrade}>
              {upgrading ? "Enhancing…" : canAfford
                ? `Enhance to ${tierMeta(nextTier).name} · 🪙 ${cost}`
                : `Enhance to ${tierMeta(nextTier).name} · 🪙 ${cost}`}
            </button>
            {!canAfford && <div style={em.shortNote}>You need {short} more coins.</div>}
            {upgradeError&&<div style={em.shortNote}>{upgradeError}</div>}
            <div style={em.applyNote}>Applies to every {skin.name} growth display in your classroom — past and future.</div>
          </>
        ) : (
          <div style={em.maxedCard}>✨ Fully enhanced — every {skin.name} you plant is Radiant.</div>
        )}

        <button style={em.doneBtn} onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
const em = {
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:320},
  modal:{background:"#fff",borderRadius:"24px 24px 0 0",padding:"24px 20px 36px",width:"100%",maxWidth:440,maxHeight:"88vh",overflowY:"auto"},
  header:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10},
  back:{background:"#F0F2EE",border:"none",borderRadius:"50%",width:32,height:32,fontSize:17,color:"#666",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,lineHeight:1},
  kicker:{fontSize:10,fontWeight:800,letterSpacing:1.5,color:"#2D6A4F"},
  title:{fontSize:19,fontWeight:700,color:"#1a1a2e",margin:0,letterSpacing:-0.2},
  coinBal:{fontSize:14,fontWeight:700,color:"#B8860B",background:"#FFF8E7",border:"1px solid #F0D060",borderRadius:20,padding:"4px 12px"},
  previewWrap:{display:"flex",alignItems:"center",gap:4,margin:"4px 0 6px"},
  previewStage:{flex:1,height:230,display:"flex",alignItems:"flex-end",justifyContent:"center",position:"relative",background:"linear-gradient(180deg,#F2F8F0 0%,#E9F3E5 100%)",borderRadius:18,overflow:"hidden",boxShadow:"inset 0 1px 3px rgba(26,42,32,0.06)"},
  previewTree:{transform:"scale(0.82)",transformOrigin:"bottom center",paddingBottom:6},
  arrow:{background:"#F0F2EE",border:"none",borderRadius:"50%",width:36,height:36,fontSize:20,color:"#4A5A50",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1},
  lockBadge:{position:"absolute",top:10,right:10,background:"rgba(26,26,46,0.82)",color:"#fff",fontSize:11,fontWeight:700,borderRadius:14,padding:"5px 11px",backdropFilter:"blur(3px)"},
  bloomRing:{position:"absolute",left:"50%",bottom:70,width:60,height:60,marginLeft:-30,borderRadius:"50%",background:"radial-gradient(circle,rgba(255,240,180,0.85) 0%,rgba(180,230,190,0.4) 45%,transparent 70%)",pointerEvents:"none"},
  pipsRow:{display:"flex",gap:8,margin:"12px 2px 4px"},
  pipBar:{height:6,width:"100%",borderRadius:4,background:"#E7ECE5",transition:"background 0.4s ease"},
  pipBarOn:{background:"linear-gradient(90deg,#56B68B,#2D6A4F)"},
  pipLabel:{fontSize:10.5,color:"#9AA69C",fontWeight:600},
  detailCard:{background:"#F9FBF8",border:"1px solid #EEF2EC",borderRadius:14,padding:"13px 15px",marginTop:12},
  detailName:{fontSize:14,fontWeight:700,color:"#1a1a2e",display:"flex",alignItems:"center",gap:7},
  ownedTag:{fontSize:10,fontWeight:700,color:"#2D6A4F",background:"#E8F5EE",borderRadius:10,padding:"2px 8px"},
  lockedTag:{fontSize:10,fontWeight:700,color:"#8A8FA0",background:"#EEF0F4",borderRadius:10,padding:"2px 8px"},
  detailBlurb:{fontSize:12.5,color:"#7A857C",lineHeight:1.55,marginTop:4},
  upgradeBtn:{display:"block",width:"100%",marginTop:14,padding:"14px 0",background:"linear-gradient(135deg,#2D6A4F,#3E8E68)",border:"none",borderRadius:14,fontSize:15,fontWeight:700,color:"#fff",cursor:"pointer",boxShadow:"0 4px 14px rgba(45,106,79,0.25)"},
  upgradeBtnDisabled:{background:"#D5DBD3",boxShadow:"none",cursor:"not-allowed",color:"#fff"},
  shortNote:{textAlign:"center",fontSize:12.5,color:"#C0392B",fontWeight:600,marginTop:8},
  applyNote:{textAlign:"center",fontSize:11.5,color:"#A9B2A9",marginTop:8,lineHeight:1.5},
  maxedCard:{textAlign:"center",fontSize:13.5,fontWeight:600,color:"#2D6A4F",background:"linear-gradient(135deg,#EAF6EE,#F3FAF0)",border:"1px solid #D7EBDC",borderRadius:14,padding:"15px 14px",marginTop:14,lineHeight:1.5},
  doneBtn:{display:"block",width:"100%",marginTop:12,padding:"13px 0",background:"#F5F7F2",border:"none",borderRadius:14,fontSize:15,fontWeight:600,color:"#666",cursor:"pointer"},
};

// ── Garden Decoration Shop ────────────────────────────────────────────────────
function GardenShop({ coins, owned, removed = [], onBuy, onRestore,
  onOpenTrees, onOpenBackgrounds, onClose, onBack }) {
  const [toast, setToast] = useState(null);
  const showT = m => { setToast(m); setTimeout(()=>setToast(null),2000); };
  return (
    <div style={gs.overlay} className="sg-overlay-anim" onClick={onClose}>
      <div style={gs.modal} className="sg-sheet-anim" onClick={e=>e.stopPropagation()}>
        <div style={gs.header}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {onBack && <button style={gs.backBtn} onClick={onBack} title="Back">←</button>}
            <h3 style={gs.title}>🏫 Classroom Decor</h3>
          </div>
          <span style={gs.coinBal}><AnimatedNumber value={coins} prefix="🪙 "/></span>
        </div>
        <ShopCategoryTabs
          active="decorations"
          onTrees={onOpenTrees}
          onDecorations={()=>{}}
          onBackgrounds={onOpenBackgrounds}
        />
        <p style={gs.sub}>Add decor to your classroom, then place it exactly where you want from the layout editor.</p>
        {toast && <div style={gs.toast}>{toast}</div>}
        <div style={gs.grid}>
          {DECORATIONS.map((d,idx)=>{
            const isOwned = owned.includes(d.id);
            const isRemoved = isOwned && removed.includes(d.id);
            const canBuy  = !isOwned && coins >= d.cost;
            return (
              <div key={d.id} className="sg-card-anim sg-lift-card" style={{...gs.card,...(isOwned?gs.cardOwned:{}),animationDelay:`${Math.min(idx*0.03,0.24)}s`}}>
                <div style={gs.preview}>
                  <svg viewBox="0 0 60 50" width="60" height="50" style={{overflow:"visible"}}>
                    {drawDecoration(d.kind, 30, 34, 1.25)}
                  </svg>
                </div>
                <div style={gs.dName}>{d.name}</div>
                <div style={gs.dDesc}>{d.desc}</div>
                {isOwned && !isRemoved
                  ? <div style={gs.ownedBadge}>✓ In your classroom</div>
                  : isRemoved
                    ? <button style={gs.restoreBtn} onClick={()=>{onRestore(d.id);showT(`${d.name} added back`);}}>Add to classroom</button>
                    : <button style={{...gs.buyBtn,...(!canBuy?gs.buyBtnDisabled:{})}}
                        onClick={async()=>{ if(!canBuy){showT("Not enough coins");return;} const ok=await onBuy(d.id,d.cost); showT(ok?`${d.name} added to your classroom`:"Purchase couldn't be completed"); }}
                        disabled={!canBuy}>
                        🪙 {d.cost}
                      </button>
                }
              </div>
            );
          })}
        </div>
        <button style={gs.closeBtn} onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
const gs = {
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:300},
  modal:{background:"#fff",borderRadius:"24px 24px 0 0",padding:"24px 20px 36px",width:"100%",maxWidth:440,maxHeight:"85vh",overflowY:"auto"},
  header:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4},
  backBtn:{background:"#F0F2EE",border:"none",borderRadius:"50%",width:32,height:32,fontSize:17,color:"#666",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,lineHeight:1},
  title:{fontSize:18,fontWeight:700,color:"#1a1a2e",margin:0},
  sub:{fontSize:12,color:"#aaa",margin:"4px 0 0",lineHeight:1.5},
  coinBal:{fontSize:14,fontWeight:700,color:"#B8860B",background:"#FFF8E7",border:"1px solid #F0D060",borderRadius:20,padding:"4px 12px"},
  toast:{background:"#1a1a2e",color:"#fff",borderRadius:10,padding:"8px 14px",fontSize:13,margin:"12px 0 0",textAlign:"center"},
  grid:{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginTop:14},
  card:{background:"#F9FBF8",borderRadius:16,padding:"14px 10px 12px",display:"flex",flexDirection:"column",alignItems:"center",border:"1.5px solid #E8EDE4"},
  cardOwned:{border:"2px solid #2D6A4F",background:"#F0FBF6"},
  preview:{height:56,display:"flex",alignItems:"center",justifyContent:"center"},
  dName:{fontSize:13,fontWeight:700,color:"#1a1a2e",marginTop:6,marginBottom:2},
  dDesc:{fontSize:10,color:"#aaa",marginBottom:8,textAlign:"center",lineHeight:1.3},
  ownedBadge:{fontSize:11,color:"#2D6A4F",fontWeight:700,padding:"5px 12px",background:"#E8F5EE",borderRadius:20},
  buyBtn:{fontSize:12,fontWeight:700,color:"#fff",background:"#2D6A4F",border:"none",borderRadius:20,padding:"6px 16px",cursor:"pointer"},
  restoreBtn:{fontSize:12,fontWeight:700,color:"#2D6A4F",background:"#F3F8F1",border:"1px solid #CFE0CF",borderRadius:20,padding:"6px 14px",cursor:"pointer"},
  buyBtnDisabled:{background:"#ccc",cursor:"not-allowed"},
  closeBtn:{display:"block",width:"100%",marginTop:18,padding:"13px 0",background:"#F5F7F2",border:"none",borderRadius:14,fontSize:15,fontWeight:600,color:"#666",cursor:"pointer"},
};

// ── Badges / Achievements Modal ───────────────────────────────────────────────
function BadgesModal({ unlocked, history, claimedRewards, onClaimReward, onClose, onBack }) {
  const earned = BADGES.filter(b=>unlocked.includes(b.id)).length;
  return (
    <div style={bg.overlay} className="sg-overlay-anim" onClick={onClose}>
      <div style={bg.modal} className="sg-sheet-anim" onClick={e=>e.stopPropagation()}>
        <div style={bg.header}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {onBack && <button style={bg.backBtn} onClick={onBack} title="Back">←</button>}
            <h3 style={bg.title}>🏅 Achievements</h3>
          </div>
          <span style={bg.count}>{earned}/{BADGES.length}</span>
        </div>
        <p style={bg.sub}>Earn coins as you build your study habit.</p>
        <div style={bg.milestonePath}>
          <MilestonePath history={history} claimedRewards={claimedRewards} onClaimReward={onClaimReward}/>
        </div>
        <div style={bg.grid}>
          {BADGES.map((b,idx)=>{
            const got = unlocked.includes(b.id);
            return (
              <div key={b.id} className="sg-card-anim" style={{...bg.card,...(got?bg.cardGot:bg.cardLocked),animationDelay:`${Math.min(idx*0.03,0.27)}s`}}>
                <div style={{...bg.emoji,filter:got?"none":"grayscale(100%)",opacity:got?1:0.4}}>{got?b.emoji:"🔒"}</div>
                <div style={{...bg.name,color:got?"#1a1a2e":"#aaa"}}>{b.name}</div>
                <div style={bg.desc}>{b.desc}</div>
                <div style={{...bg.reward,...(got?bg.rewardGot:{})}}>
                  {got ? "✓ Earned" : `🪙 ${BADGE_REWARDS[b.tier]}`}
                </div>
              </div>
            );
          })}
        </div>
        <button style={bg.closeBtn} onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
const bg = {
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:300},
  modal:{background:"#fff",borderRadius:"24px 24px 0 0",padding:"24px 20px 36px",width:"100%",maxWidth:440,maxHeight:"85vh",overflowY:"auto"},
  header:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4},
  backBtn:{background:"#F0F2EE",border:"none",borderRadius:"50%",width:32,height:32,fontSize:17,color:"#666",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,lineHeight:1},
  title:{fontSize:18,fontWeight:700,color:"#1a1a2e",margin:0},
  sub:{fontSize:12,color:"#aaa",margin:"4px 0 0"},
  milestonePath:{margin:"16px 0 20px"},
  count:{fontSize:14,fontWeight:700,color:"#2D6A4F",background:"#E8F5EE",borderRadius:20,padding:"4px 12px"},
  grid:{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginTop:14},
  card:{borderRadius:16,padding:"16px 10px 12px",display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center",border:"1.5px solid #E8EDE4"},
  cardGot:{background:"#F0FBF6",border:"2px solid #2D6A4F"},
  cardLocked:{background:"#F7F8F6"},
  emoji:{fontSize:32,marginBottom:6,transition:"filter 0.3s"},
  name:{fontSize:13,fontWeight:700,marginBottom:3},
  desc:{fontSize:10,color:"#aaa",lineHeight:1.35,marginBottom:8,minHeight:26},
  reward:{fontSize:11,fontWeight:700,color:"#B8860B",background:"#FFF8E7",borderRadius:14,padding:"4px 12px"},
  rewardGot:{color:"#2D6A4F",background:"#E8F5EE"},
  closeBtn:{display:"block",width:"100%",marginTop:18,padding:"13px 0",background:"#F5F7F2",border:"none",borderRadius:14,fontSize:15,fontWeight:600,color:"#666",cursor:"pointer"},
};

// ── Admin Console ─────────────────────────────────────────────────────────────
// Cross-user moderation tools plus self-only testing grants. Rendering requires
// both the console allowlist and a verified roles/{uid}.admin document.
function AdminPanel({ admin, selfTools, animationMode, onAnimationModeChange, onClose, onBack }) {
  const [target, setTarget]   = useState("");
  const [info, setInfo]       = useState(null);   // inspect result
  const [coinVal, setCoinVal] = useState("");
  const [mins, setMins]       = useState("");
  const [forDate, setForDate] = useState("");
  const [msg, setMsg]         = useState(null);    // {type,text}
  const [busy, setBusy]       = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [showSessionEditor, setShowSessionEditor] = useState(false);

  const flash = (type,text) => { setMsg({type,text}); setTimeout(()=>setMsg(null), 3000); };
  const needTarget = () => { if(!target.trim()){ flash("err","Enter a username first"); return true; } return false; };

  const [srcName, setSrcName]   = useState("");
  const [confirmMerge, setConfirmMerge] = useState(false);

  const doMerge = async () => {
    if(needTarget()) return;
    if(!confirmMerge){ setConfirmMerge(true); setTimeout(()=>setConfirmMerge(false), 4000); return; }
    setBusy(true);
    const r = await fbAdminMergeIdentity(admin.user, srcName, target);
    setBusy(false); setConfirmMerge(false);
    if(r.ok){ flash("ok",`Merged "${r.source}"${r.autoDetected?" (auto-detected)":""} into ${target} · ${r.sessions} sessions · +${r.coinsGained} 🪙`); setSrcName(""); doInspect(); }
    else flash("err", r.error);
  };

  const doInspect = async () => {
    if(needTarget()) return;
    setBusy(true); setInfo(null);
    const r = await fbAdminInspect(target);
    setBusy(false);
    if(r.ok){ setInfo(r); } else { flash("err", r.error); }
  };
  const doSetCoins = async () => {
    if(needTarget()) return;
    const v = Math.floor(Number(coinVal));
    if(!Number.isFinite(v) || v<0){ flash("err","Enter a valid coin amount"); return; }
    setBusy(true);
    const r = await fbAdminSetUserCoins(admin.user, target, v);
    setBusy(false);
    if(r.ok){ flash("ok",`Set ${target}'s coins to ${v}`); setCoinVal(""); doInspect(); } else flash("err", r.error);
  };
  const doAdjustTime = async () => {
    if(needTarget()) return;
    const m = Math.round(Number(mins));
    if(!Number.isFinite(m) || m===0){ flash("err","Enter minutes (+ to add, − to remove)"); return; }
    setBusy(true);
    const r = await fbAdminAdjustTime(admin.user, target, m, "admin", m>0?(forDate||null):null);
    setBusy(false);
    if(r.ok){
      const wks = r.weeks?.length || 0;
      const dateNote = (m>0 && forDate) ? ` on ${forDate}` : "";
      flash("ok",`${m>0?"Added":"Removed"} ${Math.abs(m)} min for ${target}${dateNote} · ${wks} board${wks!==1?"s":""} synced`);
      setMins(""); setForDate(""); doInspect();
    } else flash("err", r.error);
  };
  const doResync = async () => {
    if(needTarget()) return;
    setBusy(true);
    const r = await fbAdminResyncLeaderboard(admin.user, target);
    setBusy(false);
    if(r.ok){
      flash("ok",`Resynced ${target}: ${r.weeksFixed} week${r.weeksFixed!==1?"s":""} corrected${r.phantomRowsRemoved?`, ${r.phantomRowsRemoved} phantom row${r.phantomRowsRemoved!==1?"s":""} removed`:""} · true total ${fmtMins(r.trueTotalSecs)}`);
      doInspect();
    } else flash("err", r.error);
  };
  const doReset = async () => {
    if(needTarget()) return;
    if(!confirmReset){ setConfirmReset(true); setTimeout(()=>setConfirmReset(false), 4000); return; }
    setBusy(true);
    const r = await fbAdminResetHistory(admin.user, target);
    setBusy(false); setConfirmReset(false);
    if(r.ok){ flash("ok",`Wiped ${target}'s history`); doInspect(); } else flash("err", r.error);
  };

  return (
    <div style={ap.overlay} className="sg-overlay-anim" onClick={onClose}>
      <div style={ap.modal} className="sg-sheet-anim" onClick={e=>e.stopPropagation()}>
        <div style={ap.header}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {onBack && <button style={ap.back} onClick={onBack} title="Back">←</button>}
            <div>
              <div style={{...ap.kicker,color:"#8B5CB8"}}>ADMIN CONSOLE</div>
              <h3 style={ap.title}>Lumora controls 🛠</h3>
            </div>
          </div>
          <button style={ap.x} onClick={onClose}>✕</button>
        </div>

        <div style={{...ap.warn,background:"#F6F0FC",borderColor:"#D9C2F0",color:"#7A5AA0"}}>
          <span style={{fontSize:16}}>✓</span>
          <span>Firebase admin role verified. Cross-user actions are logged; test grants below only change your account.</span>
        </div>

        <div style={{...ap.section,border:"1.5px solid #D9C2F0"}}>
          <div style={{...ap.secTitle,color:"#7A5AA0"}}>Background testing kit</div>
          <div style={{fontSize:12,color:"#849087",lineHeight:1.45,marginBottom:10}}>
            Add test currency and unlock every current character style, classroom decoration, and background without removing existing progress.
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>
            <button style={{...ap.saveBtn,marginTop:0,background:"#A78BC9"}} onClick={()=>selfTools.setCoins(selfTools.coins+1000)}>+1,000 🪙</button>
            <button style={{...ap.saveBtn,marginTop:0,background:"#A78BC9"}} onClick={()=>selfTools.setCoins(selfTools.coins+10000)}>+10,000 🪙</button>
            <button style={{...ap.saveBtn,gridColumn:"1 / -1",marginTop:0,background:"#8B5CB8"}} onClick={selfTools.unlockAll}>Unlock all test cosmetics</button>
          </div>
          <div style={{...hm.motionCard,padding:"14px 0 0",marginTop:12,borderTop:"1px solid #EEE6F5"}}>
            <div>
              <div style={hm.motionTitle}>Animation level</div>
              <div style={hm.motionSub}>None pauses CSS and classroom SVG motion</div>
            </div>
            <div style={hm.motionOptions} role="group" aria-label="Admin animation level">
              {[["device","Device"],["full","Full"],["off","None"]].map(([id,label])=><button key={id} type="button"
                aria-pressed={animationMode===id} style={{...hm.motionOption,...(animationMode===id?hm.motionOptionOn:{})}}
                onClick={()=>onAnimationModeChange(id)}>{label}</button>)}
            </div>
          </div>
        </div>

        {/* Target user */}
        <div style={ap.section}>
          <div style={ap.secTitle}>Target user</div>
          <div style={{display:"flex",gap:8}}>
            <input style={{...ap.input,marginBottom:0,flex:1}} placeholder="username"
              value={target} onChange={e=>{setTarget(e.target.value);setInfo(null);}} autoCapitalize="none"/>
            <button style={{...ap.saveBtn,width:"auto",padding:"0 18px",marginTop:0,background:"#8B5CB8"}}
              disabled={busy} onClick={doInspect}>Look up</button>
          </div>
          {info && (
            <div style={{marginTop:12,padding:"12px 14px",background:"#FAFCF9",borderRadius:12,border:"1px solid #EEF2EC",fontSize:13,lineHeight:1.7}}>
              <b style={{color:"#1a1a2e"}}>{info.username}</b><br/>
              🪙 {info.coins} coins · ⏳ {fmtHrs(info.totalSecs)} · {info.sessions} sessions<br/>
              <span style={{color:"#999"}}>Recovery Q: {info.hasRecovery?"set":"none"}</span>
            </div>
          )}
        </div>

        {msg && <div style={{...ap.msg,textAlign:"center",color:msg.type==="ok"?"#2D6A4F":"#D9534F"}}>{msg.text}</div>}

        {/* Coins */}
        <div style={ap.section}>
          <div style={ap.secTitle}>Set coins</div>
          <div style={{display:"flex",gap:8}}>
            <input style={{...ap.input,marginBottom:0,flex:1}} type="number" min="0" placeholder="New balance"
              value={coinVal} onChange={e=>setCoinVal(e.target.value)}/>
            <button style={{...ap.saveBtn,width:"auto",padding:"0 18px",marginTop:0}} disabled={busy} onClick={doSetCoins}>Apply</button>
          </div>
        </div>

        {/* Study time */}
        <div style={ap.section}>
          <div style={ap.secTitle}>Adjust study time</div>
          <div style={{fontSize:11.5,color:"#999",marginBottom:9,lineHeight:1.4}}>
            Edits their session history AND syncs the weekly + all-time leaderboards.
            Negative numbers remove time from their newest sessions first — perfect for a stopwatch someone forgot to stop.
          </div>
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            <input style={{...ap.input,marginBottom:0,flex:1}} type="number" placeholder="Minutes (e.g. 60 or −30)"
              value={mins} onChange={e=>setMins(e.target.value)}/>
            <button style={{...ap.saveBtn,width:"auto",padding:"0 18px",marginTop:0,background:"#5B8DEF"}} disabled={busy} onClick={doAdjustTime}>Apply</button>
          </div>
          {Number(mins)>0 && (
            <div>
              <input style={{...ap.input,marginBottom:4}} type="date" value={forDate}
                max={new Date().toISOString().slice(0,10)} onChange={e=>setForDate(e.target.value)}/>
              <div style={{fontSize:10.5,color:"#aaa",lineHeight:1.4}}>
                Which day did they actually study? Defaults to today if left blank — but if you're
                backfilling missed time from an earlier day, set it here, or a real session they
                study today will double up with this correction on today's chart and streak.
              </div>
            </div>
          )}
        </div>

        {/* Edit individual sessions */}
        <div style={ap.section}>
          <div style={ap.secTitle}>Edit individual sessions</div>
          <div style={{fontSize:11.5,color:"#999",marginBottom:9,lineHeight:1.4}}>
            Browse and fix a specific session for this user — including one you
            previously added above, in either direction, any age. "Adjust study
            time" only ever adds a new net correction; this reaches back into
            an existing entry.
          </div>
          <button style={{...ap.saveBtn,marginTop:0,background:"#B8860B"}}
            disabled={busy} onClick={()=>{ if(needTarget())return; setShowSessionEditor(true); }}>
            📋 Edit sessions for "{target||"target above"}"
          </button>
        </div>

        {/* Resync leaderboard from history */}
        <div style={ap.section}>
          <div style={ap.secTitle}>Resync leaderboard</div>
          <div style={{fontSize:11.5,color:"#999",marginBottom:9,lineHeight:1.4}}>
            Rebuilds every week (and all-time) this user appears in directly from
            their session history, overwriting whatever's currently on the boards.
            Use this if history has a session a board is missing — a page left
            open across a week boundary could silently write to the wrong week.
          </div>
          <button style={{...ap.saveBtn,marginTop:0,background:"#3E7A8C"}}
            disabled={busy} onClick={doResync}>
            🔄 Resync "{target||"target above"}" from history
          </button>
        </div>

        {/* Merge duplicate identity */}
        <div style={{...ap.section,border:"1.5px solid #D9C2F0"}}>
          <div style={{...ap.secTitle,color:"#8B5CB8"}}>Merge duplicate identity</div>
          <div style={{fontSize:11.5,color:"#999",marginBottom:9,lineHeight:1.4}}>
            For accounts split by inconsistent capitalization OR by accented names stored with a different Unicode encoding (e.g. "Hoàng Tử Cô Đơn" vs "hoàng tử cô đơn") — both look the same but can be different data underneath. Combines sessions, coins, skins, enhancements and leaderboard time into the <b>Target user</b> above, then deletes the stray copy.
          </div>
          <input style={{...ap.input,marginBottom:8}} placeholder='Stray username (optional — leave blank to auto-detect)'
            value={srcName} onChange={e=>setSrcName(e.target.value)} autoCapitalize="none"/>
          <div style={{fontSize:10.5,color:"#aaa",marginTop:-4,marginBottom:8,lineHeight:1.4}}>
            Leave this blank and it'll find the stray copy automatically — safer than typing an
            accented name by hand, since even copy-pasting can carry a different encoding.
          </div>
          <button style={{...ap.saveBtn,marginTop:0,background:confirmMerge?"#6B3F94":"#8B5CB8"}} disabled={busy} onClick={doMerge}>
            {confirmMerge ? `Tap again to merge into "${target||"…"}"` : `Merge into "${target||"target above"}"`}
          </button>
        </div>

        {/* Danger zone */}
        <div style={{...ap.section,border:"1.5px solid #F0C9C9"}}>
          <div style={{...ap.secTitle,color:"#C0392B"}}>Danger zone</div>
          <div style={{fontSize:11.5,color:"#999",marginBottom:9,lineHeight:1.4}}>
            Wipes all sessions — resets their streak, classroom and stats. Cannot be undone.
          </div>
          <button style={{...ap.saveBtn,marginTop:0,background:confirmReset?"#C0392B":"#E08A7C"}} disabled={busy} onClick={doReset}>
            {confirmReset ? "Tap again to confirm wipe" : "Reset history"}
          </button>
        </div>

        <button style={ap.doneBtn} onClick={onClose}>Done</button>
      </div>
      {showSessionEditor && (
        <AdminSessionEditor admin={admin.user} username={target}
          onClose={()=>{setShowSessionEditor(false);doInspect();}}
          onBack={()=>setShowSessionEditor(false)}/>
      )}
    </div>
  );
}

// ── Account panel ─────────────────────────────────────────────────────────────
// Reachable from the menu sheet. Lets a logged-in user change their password
// (verifying the current one first) and set/update a recovery question. Uses the
// same simpleHash + Firestore helpers as the rest of auth.
// ── My Sessions ───────────────────────────────────────────────────────────────
// Self-service correction for an over-recorded session (stopwatch left running,
// etc). Reduce-only: the slider's own `max` is the current value, so there's
// no way to drag past it — the constraint is physically self-evident rather
// than something you find out via an error message. Scoped to the last
// SESSION_EDIT_WINDOW_DAYS and excludes admin-set sessions (shown read-only).
function MySessionsPanel({ user, history, subjects, onEdit, onClose, onBack }) {
  const [openTs, setOpenTs] = useState(null); // which session's editor is expanded
  const [draftMin, setDraftMin] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const showT = m => { setToast(m); setTimeout(()=>setToast(null), 2400); };

  const cutoff = Date.now() - SESSION_EDIT_WINDOW_DAYS*24*3600*1000;
  const recent = (history||[])
    .filter(s => s.ts >= cutoff)
    .sort((a,b) => b.ts - a.ts);

  const subjFor = id => subjects.find(x=>x.id===id) || { emoji:"📘", label:"Session", color:"#56B68B" };
  const dayLabel = ts => {
    const d = new Date(ts), today = startOfDay(new Date()).getTime(), day = startOfDay(d).getTime();
    const diff = Math.round((today-day)/86400000);
    if(diff===0) return "Today";
    if(diff===1) return "Yesterday";
    return d.toLocaleDateString(undefined,{weekday:"long", month:"short", day:"numeric"});
  };
  const timeLabel = ts => new Date(ts).toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"});

  const openEditor = (s) => {
    setOpenTs(s.ts);
    setDraftMin(Math.floor(s.secs/60));
  };

  const save = async (s) => {
    const newSecs = draftMin*60;
    if(newSecs >= s.secs) return; // slider ceiling already prevents this, defensive no-op
    setBusy(true);
    const r = await fbUserEditSession(user, s.ts, newSecs);
    setBusy(false);
    if(r.ok){ showT(`Updated · ${r.coinsDelta<0?`${r.coinsDelta} 🪙`:"no coin change"}`); setOpenTs(null); onEdit(r); }
    else showT(r.error);
  };

  const remove = async (s) => {
    setBusy(true);
    const r = await fbUserEditSession(user, s.ts, 0);
    setBusy(false);
    if(r.ok){ showT(`Session removed · ${r.coinsDelta} 🪙`); setOpenTs(null); onEdit(r); }
    else showT(r.error);
  };

  return (
    <div style={ms.overlay} className="sg-overlay-anim" onClick={onClose}>
      <div style={ms.sheet} className="sg-sheet-anim" onClick={e=>e.stopPropagation()}>
        <div style={ms.header}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {onBack && <button style={ms.back} onClick={onBack}>←</button>}
            <div>
              <h3 style={ms.title}>My Sessions</h3>
              <div style={ms.subtitle}>Fix a session that ran too long — last {SESSION_EDIT_WINDOW_DAYS} days only</div>
            </div>
          </div>
        </div>
        {toast && <div style={ms.toast}>{toast}</div>}

        {recent.length===0 ? (
          <div style={ms.empty}>No sessions in the last {SESSION_EDIT_WINDOW_DAYS} days yet.</div>
        ) : (
          <div style={ms.list}>
            {recent.map(s => {
              const subj = subjFor(s.subject);
              const isOpen = openTs === s.ts;
              const minMin = 1, maxMin = Math.floor(s.secs/60);
              return (
                <div key={s.ts} style={ms.card} className="sg-card-anim">
                  <button style={ms.row} onClick={()=> s.admin ? null : (isOpen ? setOpenTs(null) : openEditor(s))}
                    disabled={s.admin}>
                    <span style={{...ms.icon, background:(subj.color||"#56B68B")+"22"}}>{subj.emoji}</span>
                    <span style={{flex:1,textAlign:"left"}}>
                      <span style={ms.subjLabel}>{subj.label}{s.edited && <span style={ms.editedTag}>edited</span>}{s.admin && <span style={ms.adminTag}>🛠 admin</span>}</span>
                      <span style={ms.when}>{dayLabel(s.ts)} · {timeLabel(s.ts)}</span>
                    </span>
                    <span style={ms.dur}>{fmtMins(s.secs)}</span>
                    {!s.admin && <span style={ms.chev}>{isOpen?"︿":"›"}</span>}
                  </button>

                  {isOpen && (
                    <div style={ms.editor} className="sg-view-anim">
                      <div style={ms.editorRow}>
                        <span style={ms.editorNow}>{fmtMins(draftMin*60)}</span>
                        <span style={ms.editorWas}>was {fmtMins(s.secs)}</span>
                      </div>
                      <input type="range" min={minMin} max={maxMin} value={draftMin}
                        onChange={e=>setDraftMin(Number(e.target.value))}
                        style={ms.slider}/>
                      <div style={ms.editorPreview}>
                        {draftMin*60 < s.secs
                          ? <span>🪙 {draftMin-Math.floor(s.secs/60)} coins on save</span>
                          : <span style={{color:"#bbb"}}>Drag left to reduce</span>}
                      </div>
                      <button style={{...ms.saveBtn,...(draftMin*60>=s.secs?ms.saveBtnDisabled:{})}}
                        disabled={busy || draftMin*60>=s.secs} onClick={()=>save(s)}>
                        Save {fmtMins(draftMin*60)}
                      </button>
                      <button style={ms.removeBtn} disabled={busy} onClick={()=>remove(s)}>
                        Remove this session entirely
                      </button>
                      <div style={ms.removeNote}>Removing it also takes its growth marker out of your classroom.</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <button style={ms.closeBtn} onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
const ms = {
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:340},
  sheet:{background:"#fff",borderRadius:"24px 24px 0 0",padding:"20px 16px 28px",width:"100%",maxWidth:440,maxHeight:"85vh",overflowY:"auto"},
  header:{marginBottom:6},
  back:{background:"#F0F2EE",border:"none",borderRadius:"50%",width:32,height:32,fontSize:17,color:"#666",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:2},
  title:{fontSize:19,fontWeight:700,color:"#1a1a2e",margin:0,letterSpacing:-0.2},
  subtitle:{fontSize:12,color:"#999",marginTop:2,lineHeight:1.4,maxWidth:280},
  toast:{background:"#1a1a2e",color:"#fff",fontSize:12.5,fontWeight:600,borderRadius:10,padding:"8px 12px",margin:"8px 0",textAlign:"center"},
  empty:{textAlign:"center",color:"#aaa",fontSize:13.5,padding:"36px 12px"},
  list:{display:"flex",flexDirection:"column",gap:8,marginTop:12},
  card:{background:"#F9FBF8",border:"1px solid #EEF2EC",borderRadius:14,overflow:"hidden"},
  row:{display:"flex",alignItems:"center",gap:10,width:"100%",background:"transparent",border:"none",padding:"11px 12px",cursor:"pointer",textAlign:"left"},
  icon:{width:34,height:34,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0},
  subjLabel:{display:"block",fontSize:13.5,fontWeight:700,color:"#1a1a2e"},
  editedTag:{fontSize:9.5,fontWeight:700,color:"#8B5CB8",background:"#F4EEFA",borderRadius:8,padding:"1px 6px",marginLeft:6},
  adminTag:{fontSize:9.5,fontWeight:700,color:"#999",background:"#F0F2EE",borderRadius:8,padding:"1px 6px",marginLeft:6},
  when:{display:"block",fontSize:11,color:"#aaa",marginTop:1},
  dur:{fontSize:13.5,fontWeight:700,color:"#2D6A4F",flexShrink:0},
  chev:{fontSize:15,color:"#ccc",fontWeight:700,flexShrink:0,width:14,textAlign:"center"},
  editor:{padding:"2px 14px 14px",borderTop:"1px solid #EEF2EC",marginTop:2},
  editorRow:{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginTop:10,marginBottom:6},
  editorNow:{fontSize:20,fontWeight:800,color:"#1a1a2e"},
  editorWas:{fontSize:11.5,color:"#aaa"},
  slider:{width:"100%",accentColor:"#2D6A4F",cursor:"pointer"},
  editorPreview:{fontSize:12,fontWeight:600,color:"#C0392B",margin:"8px 0"},
  saveBtn:{display:"block",width:"100%",padding:"11px 0",background:"#2D6A4F",border:"none",borderRadius:12,fontSize:13.5,fontWeight:700,color:"#fff",cursor:"pointer"},
  saveBtnDisabled:{background:"#D5DBD3",cursor:"not-allowed"},
  removeBtn:{display:"block",width:"100%",padding:"9px 0",background:"transparent",border:"none",fontSize:12,fontWeight:600,color:"#C0392B",cursor:"pointer",marginTop:6},
  removeNote:{textAlign:"center",fontSize:10.5,color:"#bbb",marginTop:-2},
  closeBtn:{display:"block",width:"100%",marginTop:16,padding:"13px 0",background:"#F5F7F2",border:"none",borderRadius:14,fontSize:15,fontWeight:600,color:"#666",cursor:"pointer"},
};

// ── Admin Session Editor ──────────────────────────────────────────────────────
// Full-control counterpart to MySessionsPanel: any direction, any age, and can
// touch sessions the admin previously added (unlike the self-service tool,
// which locks those out for good reason). Reuses the same visual language
// (the `ms` styles above) so it doesn't feel like a bolted-on second product.
function AdminSessionEditor({ admin, username, onClose, onBack }) {
  const [sessions, setSessions] = useState(null); // null = loading
  const [openTs, setOpenTs] = useState(null);
  const [draftMin, setDraftMin] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [visibleCount, setVisibleCount] = useState(25);
  const showT = m => { setToast(m); setTimeout(()=>setToast(null), 2600); };

  const load = async () => {
    setSessions(null);
    const hist = await fbLoadHistory(username);
    setSessions([...hist].sort((a,b)=>b.ts-a.ts));
  };
  useEffect(() => { load(); }, [username]);

  const dayLabel = ts => {
    const d = new Date(ts), today = startOfDay(new Date()).getTime(), day = startOfDay(d).getTime();
    const diff = Math.round((today-day)/86400000);
    if(diff===0) return "Today";
    if(diff===1) return "Yesterday";
    if(diff<7) return d.toLocaleDateString(undefined,{weekday:"long"});
    return d.toLocaleDateString(undefined,{month:"short", day:"numeric", year: d.getFullYear()!==new Date().getFullYear()?"numeric":undefined});
  };
  const timeLabel = ts => new Date(ts).toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"});

  const openEditor = (s) => { setOpenTs(s.ts); setDraftMin(String(Math.floor(s.secs/60))); };

  const save = async (s) => {
    const newSecs = Math.round(Number(draftMin)*60);
    if(!Number.isFinite(newSecs) || newSecs<0){ showT("Enter a valid number of minutes"); return; }
    setBusy(true);
    const r = await fbAdminEditSession(admin, username, s.ts, newSecs);
    setBusy(false);
    if(r.ok){ showT(`Saved · ${r.coinsDelta!==0?`${r.coinsDelta>0?"+":""}${r.coinsDelta} 🪙`:"no coin change"}${r.wasAdminSession?" (admin entry, coins untouched)":""}`); setOpenTs(null); load(); }
    else showT(r.error);
  };
  const remove = async (s) => {
    setBusy(true);
    const r = await fbAdminEditSession(admin, username, s.ts, 0);
    setBusy(false);
    if(r.ok){ showT(`Session removed${r.coinsDelta?` · ${r.coinsDelta} 🪙`:""}`); setOpenTs(null); load(); }
    else showT(r.error);
  };

  const shown = sessions ? sessions.slice(0, visibleCount) : [];

  return (
    <div style={ms.overlay} className="sg-overlay-anim" onClick={onClose}>
      <div style={ms.sheet} className="sg-sheet-anim" onClick={e=>e.stopPropagation()}>
        <div style={ms.header}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {onBack && <button style={ms.back} onClick={onBack}>←</button>}
            <div>
              <h3 style={ms.title}>Sessions — {username}</h3>
              <div style={ms.subtitle}>Full control: any direction, any age, admin entries included</div>
            </div>
          </div>
        </div>
        {toast && <div style={ms.toast}>{toast}</div>}

        {sessions===null ? (
          <div style={ms.empty}>Loading…</div>
        ) : sessions.length===0 ? (
          <div style={ms.empty}>No sessions recorded.</div>
        ) : (
          <>
            <div style={ms.list}>
              {shown.map(s => {
                const isOpen = openTs === s.ts;
                const draftSecs = Math.round((Number(draftMin)||0)*60);
                return (
                  <div key={s.ts} style={ms.card} className="sg-card-anim">
                    <button style={ms.row} onClick={()=> isOpen ? setOpenTs(null) : openEditor(s)}>
                      <span style={{...ms.icon, background:"#B8860B22"}}>{s.admin?"🛠":"📘"}</span>
                      <span style={{flex:1,textAlign:"left"}}>
                        <span style={ms.subjLabel}>
                          {s.subject}
                          {s.edited && <span style={ms.editedTag}>edited</span>}
                          {s.admin && <span style={ms.adminTag}>admin entry</span>}
                        </span>
                        <span style={ms.when}>{dayLabel(s.ts)} · {timeLabel(s.ts)}</span>
                      </span>
                      <span style={ms.dur}>{fmtMins(s.secs)}</span>
                      <span style={ms.chev}>{isOpen?"︿":"›"}</span>
                    </button>

                    {isOpen && (
                      <div style={ms.editor} className="sg-view-anim">
                        <div style={{display:"flex",alignItems:"center",gap:8,marginTop:10,marginBottom:8}}>
                          <input type="number" min="0" step="1" value={draftMin}
                            onChange={e=>setDraftMin(e.target.value)}
                            style={ase.numInput} placeholder="minutes"/>
                          <span style={ms.editorWas}>was {fmtMins(s.secs)}</span>
                        </div>
                        {!s.admin && Number.isFinite(draftSecs) && draftSecs!==s.secs && (
                          <div style={ms.editorPreview}>
                            <span style={{color: draftSecs<s.secs ? "#C0392B" : "#2D6A4F"}}>
                              🪙 {(Math.floor(draftSecs/60)-Math.floor(s.secs/60))} coins on save
                            </span>
                          </div>
                        )}
                        {s.admin && <div style={{...ms.editorPreview,color:"#aaa"}}>Admin entry — coins untouched either way</div>}
                        <button style={{...ms.saveBtn,...(busy?ms.saveBtnDisabled:{})}} disabled={busy} onClick={()=>save(s)}>
                          Save {Number.isFinite(draftSecs)?fmtMins(draftSecs):""}
                        </button>
                        <button style={ms.removeBtn} disabled={busy} onClick={()=>remove(s)}>
                          Remove this session entirely
                        </button>
                        <div style={ms.removeNote}>Removing it also takes its growth marker out of their classroom.</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {sessions.length > visibleCount && (
              <button style={ase.showMoreBtn} onClick={()=>setVisibleCount(v=>v+25)}>
                Show {Math.min(25, sessions.length-visibleCount)} more ({sessions.length-visibleCount} left)
              </button>
            )}
          </>
        )}

        <button style={ms.closeBtn} onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
const ase = {
  numInput:{flex:1,padding:"10px 12px",border:"1.5px solid #E5E9E2",borderRadius:10,fontSize:15,fontWeight:700,color:"#1a1a2e"},
  showMoreBtn:{display:"block",width:"100%",padding:"10px 0",background:"transparent",border:"none",fontSize:12.5,fontWeight:600,color:"#8B5CB8",cursor:"pointer",marginTop:4},
};

function AccountPanel({ user, admin, onClose, onBack }) {
  const [adminCoins, setAdminCoins] = useState("");
  const [loading, setLoading]   = useState(true);
  const [recQ, setRecQ]         = useState(null);   // currently-set recovery question (or null)
  // change password
  const [curPw, setCurPw]       = useState("");
  const [newPw, setNewPw]       = useState("");
  const [confPw, setConfPw]     = useState("");
  const [pwMsg, setPwMsg]       = useState(null);   // {type:"ok"|"err", text}
  const [pwBusy, setPwBusy]     = useState(false);
  // recovery
  const [selQ, setSelQ]         = useState(RECOVERY_QUESTIONS[0]);
  const [ans, setAns]           = useState("");
  const [recMsg, setRecMsg]     = useState(null);
  const [recBusy, setRecBusy]   = useState(false);

  useEffect(()=>{ (async()=>{
    const info = await fbGetAccountInfo(user);
    if(info.ok){ setRecQ(info.recoveryQuestion); if(info.recoveryQuestion) setSelQ(info.recoveryQuestion); }
    setLoading(false);
  })(); },[user]);

  const changePassword = async () => {
    setPwMsg(null);
    if(!curPw){ setPwMsg({type:"err",text:"Enter your current password"}); return; }
    if(newPw.length<6){ setPwMsg({type:"err",text:"New password must be at least 6 characters"}); return; }
    if(newPw!==confPw){ setPwMsg({type:"err",text:"New passwords don't match"}); return; }
    if(newPw===curPw){ setPwMsg({type:"err",text:"New password must be different"}); return; }
    setPwBusy(true);
    const res = await fbChangePassword(user, curPw, newPw);
    setPwBusy(false);
    if(res.ok){
      setPwMsg({type:"ok",text:"Password updated ✓"});
      setCurPw(""); setNewPw(""); setConfPw("");
    } else setPwMsg({type:"err",text:res.error});
  };

  const saveRecovery = async () => {
    setRecMsg(null);
    if(!ans.trim()){ setRecMsg({type:"err",text:"Enter an answer"}); return; }
    setRecBusy(true);
    const res = await fbSetRecovery(user, selQ, ans);
    setRecBusy(false);
    if(res.ok){ setRecMsg({type:"ok",text:"Recovery question saved ✓"}); setRecQ(selQ); setAns(""); }
    else setRecMsg({type:"err",text:res.error});
  };

  return (
    <div style={ap.overlay} className="sg-overlay-anim" onClick={onClose}>
      <div style={ap.modal} className="sg-sheet-anim" onClick={e=>e.stopPropagation()}>
        <div style={ap.header}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {onBack && <button style={ap.back} onClick={onBack} title="Back">←</button>}
            <div>
              <div style={ap.kicker}>ACCOUNT</div>
              <h3 style={ap.title}>{user}</h3>
            </div>
          </div>
          <button style={ap.x} onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <p style={ap.loading}>Loading…</p>
        ) : (
          <>
            {/* No-recovery warning nudge */}
            {AUTH_FUNCTIONS_ENABLED && !recQ && (
              <div style={ap.warn}>
                <span style={{fontSize:16}}>⚠️</span>
                <span>No recovery question set — you won't be able to reset your password if you forget it.</span>
              </div>
            )}

            {/* Change password */}
            <div style={ap.section}>
              <div style={ap.secTitle}>Change password</div>
              <input style={ap.input} type="password" placeholder="Current password"
                value={curPw} onChange={e=>setCurPw(e.target.value)} autoComplete="current-password"/>
              <input style={ap.input} type="password" placeholder="New password"
                value={newPw} onChange={e=>setNewPw(e.target.value)} autoComplete="new-password"/>
              <input style={ap.input} type="password" placeholder="Confirm new password"
                value={confPw} onChange={e=>setConfPw(e.target.value)} autoComplete="new-password"/>
              {pwMsg && <div style={{...ap.msg,color:pwMsg.type==="ok"?"#2D6A4F":"#D9534F"}}>{pwMsg.text}</div>}
              <button style={{...ap.saveBtn,opacity:pwBusy?0.6:1}} disabled={pwBusy} onClick={changePassword}>
                {pwBusy?"Saving…":"Update password"}
              </button>
            </div>

            {/* Recovery question */}
            {AUTH_FUNCTIONS_ENABLED ? <div style={ap.section}>
              <div style={ap.secTitle}>Recovery question</div>
              {recQ && <div style={ap.current}>Current: <b>{recQ}</b></div>}
              <select style={ap.select} value={selQ} onChange={e=>setSelQ(e.target.value)}>
                {RECOVERY_QUESTIONS.map(q=><option key={q} value={q}>{q}</option>)}
              </select>
              <input style={ap.input} type="text" placeholder="Your answer"
                value={ans} onChange={e=>setAns(e.target.value)}/>
              {recMsg && <div style={{...ap.msg,color:recMsg.type==="ok"?"#2D6A4F":"#D9534F"}}>{recMsg.text}</div>}
              <button style={{...ap.saveBtn,opacity:recBusy?0.6:1}} disabled={recBusy} onClick={saveRecovery}>
                {recBusy?"Saving…":(recQ?"Update recovery question":"Set recovery question")}
              </button>
            </div> : <div style={ap.section}>
              <div style={ap.secTitle}>Recovery question</div>
              <div style={{fontSize:12.5,color:"#777",lineHeight:1.5}}>
                Recovery questions will be available after Lumora Cloud Functions are enabled.
              </div>
            </div>}
          </>
        )}

        {admin && (
          <div style={{...ap.section,border:"1.5px dashed #C9A0E8",background:"#FCFAFF"}}>
            <div style={{...ap.secTitle,color:"#8B5CB8"}}>🛠 Admin · your account</div>
            <div style={{fontSize:12.5,color:"#999",marginBottom:10}}>Balance: <b style={{color:"#B8860B"}}>🪙 {admin.coins}</b></div>
            <div style={{display:"flex",gap:8,marginBottom:9}}>
              <input style={{...ap.input,marginBottom:0,flex:1}} type="number" min="0" placeholder="Set my coins"
                value={adminCoins} onChange={e=>setAdminCoins(e.target.value)}/>
              <button style={{...ap.saveBtn,width:"auto",padding:"0 18px",marginTop:0,background:"#8B5CB8"}}
                onClick={()=>{ const n=parseInt(adminCoins,10); if(!isNaN(n)&&n>=0){ admin.setCoins(n); setAdminCoins(""); } }}>Set</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>
              <button style={{...ap.saveBtn,marginTop:0,background:"#A78BC9"}} onClick={()=>admin.setCoins(admin.coins+1000)}>+1,000 🪙</button>
              <button style={{...ap.saveBtn,marginTop:0,background:"#A78BC9"}} onClick={()=>admin.setCoins(admin.coins+10000)}>+10,000 🪙</button>
              <button style={{...ap.saveBtn,gridColumn:"1 / -1",marginTop:0,background:"#8B5CB8"}} onClick={admin.grantAllSkins}>Unlock all test cosmetics</button>
            </div>
            <p style={{fontSize:11,color:"#B79FD0",marginTop:10,marginBottom:0,lineHeight:1.4}}>User tools (edit others, moderate) live in the menu → Admin Console.</p>
          </div>
        )}
        <button style={ap.doneBtn} onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
const ap = {
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:340},
  modal:{background:"#F7FAF6",borderRadius:"24px 24px 0 0",padding:"22px 18px 30px",width:"100%",maxWidth:440,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 -8px 32px rgba(0,0,0,0.18)"},
  header:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16},
  back:{background:"#EAEFE7",border:"none",borderRadius:"50%",width:30,height:30,fontSize:16,color:"#666",cursor:"pointer",flexShrink:0,lineHeight:1,marginTop:4},
  kicker:{fontSize:10,fontWeight:700,color:"#7AA56B",letterSpacing:"1.5px",marginBottom:2},
  title:{fontSize:21,fontWeight:800,color:"#1a1a2e",margin:0,letterSpacing:"-0.5px"},
  x:{background:"#EAEFE7",border:"none",borderRadius:"50%",width:30,height:30,fontSize:13,color:"#888",cursor:"pointer",flexShrink:0},
  loading:{textAlign:"center",color:"#888",padding:"30px 0"},
  warn:{display:"flex",gap:9,alignItems:"flex-start",background:"#FFF6E5",border:"1.5px solid #F0D98C",borderRadius:14,padding:"12px 14px",fontSize:12.5,color:"#8A6D2F",lineHeight:1.45,marginBottom:16,fontWeight:600},
  section:{background:"#fff",borderRadius:16,padding:"16px 15px",marginBottom:14,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"},
  secTitle:{fontSize:14,fontWeight:800,color:"#1a1a2e",marginBottom:12},
  current:{fontSize:12,color:"#888",marginBottom:10,lineHeight:1.4},
  input:{display:"block",width:"100%",boxSizing:"border-box",padding:"11px 13px",border:"1.5px solid #E0E8DC",borderRadius:12,fontSize:14,marginBottom:9,background:"#FAFCF9",outline:"none"},
  select:{display:"block",width:"100%",boxSizing:"border-box",padding:"11px 13px",border:"1.5px solid #E0E8DC",borderRadius:12,fontSize:13.5,marginBottom:9,background:"#FAFCF9",outline:"none",cursor:"pointer"},
  msg:{fontSize:12.5,fontWeight:600,margin:"2px 2px 10px"},
  saveBtn:{display:"block",width:"100%",padding:"12px 0",background:"#2D6A4F",border:"none",borderRadius:12,fontSize:14,fontWeight:700,color:"#fff",cursor:"pointer",marginTop:3},
  doneBtn:{display:"block",width:"100%",marginTop:6,padding:"14px 0",background:"#F0F2EE",border:"none",borderRadius:14,fontSize:15,fontWeight:700,color:"#666",cursor:"pointer"},
};

const formatAnnouncementDate = ms => {
  if(!ms)return "Just now";
  try{return new Intl.DateTimeFormat(undefined,{day:"numeric",month:"short",year:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(ms));}
  catch{return new Date(ms).toLocaleString();}
};

function AnnouncementReactionBar({user,password,announcementId,replyId=null,counts={},onError}){
  const [active,setActive]=useState({});
  const [busy,setBusy]=useState("");
  useEffect(()=>{
    let alive=true;
    setActive({});
    fbLoadMyAnnouncementReactions(user,announcementId,replyId).then(value=>{if(alive)setActive(value);});
    return ()=>{alive=false;};
  },[user,announcementId,replyId]);
  const toggle=async emoji=>{
    if(busy)return;
    setBusy(emoji);
    try{
      const result=await fbToggleAnnouncementReaction(user,password,announcementId,replyId,emoji);
      setActive(result.reactions||{});
    }catch(e){onError?.(e.message||"Couldn't update that reaction.");}
    finally{setBusy("");}
  };
  return (
    <div style={announceStyles.reactions} aria-label="Emoji reactions">
      {ANNOUNCEMENT_REACTIONS.map(emoji=>{
        const count=Number(counts?.[emoji])||0,selected=!!active[emoji];
        return (
          <button key={emoji} type="button" onClick={()=>toggle(emoji)} disabled={!!busy}
            aria-pressed={selected} aria-label={`${selected?"Remove":"Add"} ${emoji} reaction`}
            style={{...announceStyles.reaction,...(selected?announceStyles.reactionActive:{}),opacity:busy===emoji?.65:1}}>
            <span>{emoji}</span>{count>0&&<span style={announceStyles.reactionCount}>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

function AnnouncementComposer({initial=null,busy,onCancel,onSubmit}){
  const [draft,setDraft]=useState(()=>({
    title:initial?.title||"",message:initial?.message||"",category:initial?.category||"",
  }));
  const [preview,setPreview]=useState(false);
  const setField=(key,value)=>setDraft(current=>({...current,[key]:value}));
  return (
    <section className="sg-announcement-composer" style={announceStyles.composer} aria-label={initial?"Edit announcement":"New announcement"}>
      <div style={announceStyles.sectionTop}>
        <strong style={announceStyles.sectionTitle}>{initial?"Edit announcement":"New announcement"}</strong>
        <button type="button" style={announceStyles.textBtn} onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
      {preview ? (
        <div style={announceStyles.preview}>
          <div style={announceStyles.official}>🌿 OFFICIAL STUDYGROVE ANNOUNCEMENT</div>
          {draft.category&&<span style={announceStyles.category}>{draft.category}</span>}
          <h3 className="sg-announcement-title" style={announceStyles.postTitle}>{draft.title||"Untitled announcement"}</h3>
          <div className="sg-announcement-copy" style={announceStyles.message}>{draft.message||"Your message preview will appear here."}</div>
        </div>
      ) : (
        <>
          <label style={announceStyles.label}>Title
            <input value={draft.title} maxLength={100} onChange={e=>setField("title",e.target.value)}
              style={announceStyles.input} placeholder="A short, clear title"/>
          </label>
          <label style={announceStyles.label}>Message
            <textarea value={draft.message} maxLength={5000} onChange={e=>setField("message",e.target.value)}
              style={announceStyles.textarea} placeholder="Write the full announcement…"/>
          </label>
          <label style={announceStyles.label}>Category <span style={announceStyles.optional}>optional</span>
            <select value={draft.category} onChange={e=>setField("category",e.target.value)} style={announceStyles.input}>
              <option value="">No category</option>
              <option value="Update">Update</option>
              <option value="Event">Event</option>
              <option value="Important">Important</option>
            </select>
          </label>
        </>
      )}
      <div style={announceStyles.composerActions}>
        <button type="button" style={announceStyles.secondaryBtn} onClick={()=>setPreview(value=>!value)} disabled={busy}>
          {preview?"Edit draft":"Preview"}
        </button>
        <button type="button" style={{...announceStyles.primaryBtn,...(busy?announceStyles.disabled:{})}}
          onClick={()=>onSubmit(draft)} disabled={busy||!draft.title.trim()||!draft.message.trim()}>
          {busy?"Saving…":initial?"Save changes":"Publish"}
        </button>
      </div>
    </section>
  );
}

function AnnouncementDiscussion({announcement,user,password,isAdmin,onFeedback}){
  const [replies,setReplies]=useState([]);
  const [replyLimit,setReplyLimit]=useState(30);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [submitting,setSubmitting]=useState(false);
  const [deleting,setDeleting]=useState("");
  const lastSubmitRef=useRef({message:"",at:0});
  useEffect(()=>{
    setReplies([]);setReplyLimit(30);setLoading(true);setError("");setMessage("");
  },[announcement?.id]);
  useEffect(()=>{
    if(!announcement?.id)return;
    setLoading(true);
    return fbWatchAnnouncementReplies(announcement.id,replyLimit,value=>{
      setReplies(value);setLoading(false);setError("");
    },()=>{setLoading(false);setError("Replies couldn't be loaded. Check your connection and try again.");});
  },[announcement?.id,replyLimit]);
  const liveReplies=replies.filter(reply=>!reply.deleted);
  const hasEarlier=(Number(announcement?.replyCount)||0)>liveReplies.length;
  const submit=async()=>{
    const clean=(message||"").trim();
    if(!clean||submitting)return;
    const now=Date.now();
    if(lastSubmitRef.current.message===clean&&now-lastSubmitRef.current.at<10000){
      setError("That reply was already sent.");return;
    }
    setSubmitting(true);setError("");
    try{
      const result=await fbAddAnnouncementReply(user,password,announcement.id,clean);
      lastSubmitRef.current={message:clean,at:now};
      setMessage("");
      onFeedback?.(result.duplicate?"That reply was already sent.":"Reply added.");
    }catch(e){setError(e.message||"Couldn't add your reply.");}
    finally{setSubmitting(false);}
  };
  const remove=async reply=>{
    if(deleting)return;
    setDeleting(reply.id);setError("");
    try{
      await fbDeleteAnnouncementReply(user,password,announcement.id,reply.id);
      onFeedback?.(canonUsername(reply.username)===canonUsername(user)?"Reply deleted.":"Reply removed.");
    }catch(e){setError(e.message||"Couldn't delete that reply.");}
    finally{setDeleting("");}
  };
  return (
    <section style={announceStyles.discussion} aria-labelledby="announcement-discussion-heading">
      <div style={announceStyles.discussionHead}>
        <h3 id="announcement-discussion-heading" style={announceStyles.discussionTitle}>Discussion</h3>
        <span style={announceStyles.replyTotal}>{Number(announcement?.replyCount)||0} repl{Number(announcement?.replyCount)===1?"y":"ies"}</span>
      </div>
      <div style={announceStyles.replyComposer}>
        <textarea value={message} maxLength={800} rows={3} style={announceStyles.replyInput}
          onChange={e=>setMessage(e.target.value)}
          onKeyDown={e=>{if((e.metaKey||e.ctrlKey)&&e.key==="Enter")submit();}}
          placeholder="Write a reply…" aria-label="Reply message"/>
        <div style={announceStyles.replyComposerFoot}>
          <span style={announceStyles.charCount}>{message.length}/800</span>
          <button type="button" style={{...announceStyles.replyBtn,...(submitting||!message.trim()?announceStyles.disabled:{})}}
            onClick={submit} disabled={submitting||!message.trim()}>
            {submitting?"Sending…":"Reply"}
          </button>
        </div>
      </div>
      {error&&<div style={announceStyles.error} role="alert">{error}</div>}
      {hasEarlier&&(
        <button type="button" style={announceStyles.loadMoreBtn} onClick={()=>setReplyLimit(value=>value+30)}>
          Show earlier replies
        </button>
      )}
      {loading ? (
        <div style={announceStyles.replyLoading} aria-live="polite">
          <div className="sg-skeleton" style={{height:58,marginBottom:8}}/>
          <div className="sg-skeleton" style={{height:58}}/>
        </div>
      ) : !replies.length ? (
        <div style={announceStyles.emptyReplies}>No replies yet. Start the conversation gently 🌱</div>
      ) : (
        <div style={announceStyles.replyList}>
          {replies.map(reply=>reply.deleted?(
            <div key={reply.id} style={announceStyles.deletedReply}>Reply removed</div>
          ):(
            <article key={reply.id} style={announceStyles.reply}>
              <div style={announceStyles.replyAvatar} aria-hidden="true">{(reply.username||"?").slice(0,1).toUpperCase()}</div>
              <div style={announceStyles.replyBody}>
                <div style={announceStyles.replyMeta}>
                  <strong className="sg-announcement-reply-user" style={announceStyles.replyUser}>{reply.username}</strong>
                  <time style={announceStyles.replyTime} dateTime={new Date(Number(reply.createdAtMs)||0).toISOString()}>
                    {formatAnnouncementDate(reply.createdAtMs)}
                  </time>
                </div>
                <div className="sg-announcement-copy" style={announceStyles.replyMessage}>{reply.message}</div>
                <div style={announceStyles.replyActions}>
                  <AnnouncementReactionBar user={user} password={password} announcementId={announcement.id}
                    replyId={reply.id} counts={reply.reactionCounts} onError={setError}/>
                  {(canonUsername(reply.username)===canonUsername(user)||isAdmin)&&(
                    <button type="button" style={announceStyles.deleteReplyBtn} onClick={()=>remove(reply)}
                      disabled={!!deleting} aria-label={`Delete reply by ${reply.username}`}>
                      {deleting===reply.id?"Removing…":canonUsername(reply.username)===canonUsername(user)?"Delete":"Remove"}
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Announcements({user,isAdmin,theme,lastReadAt,onRead}){
  const password="";
  const [open,setOpen]=useState(false);
  const [current,setCurrent]=useState(null);
  const [currentLoading,setCurrentLoading]=useState(true);
  const [currentError,setCurrentError]=useState("");
  const [selectedId,setSelectedId]=useState("");
  const [selected,setSelected]=useState(null);
  const [archiveOpen,setArchiveOpen]=useState(false);
  const [archive,setArchive]=useState([]);
  const [archiveCursor,setArchiveCursor]=useState(null);
  const [archiveMore,setArchiveMore]=useState(false);
  const [archiveLoading,setArchiveLoading]=useState(false);
  const [archiveError,setArchiveError]=useState("");
  const [composer,setComposer]=useState(null);
  const [adminBusy,setAdminBusy]=useState(false);
  const [feedback,setFeedback]=useState("");
  const [expanded,setExpanded]=useState(false);
  const closeButtonRef=useRef(null);
  const panelRef=useRef(null);

  useEffect(()=>fbWatchCurrentAnnouncement(value=>{
    setCurrent(value);setCurrentLoading(false);setCurrentError("");
  },()=>{setCurrentLoading(false);setCurrentError("Announcements couldn't be loaded.");}),[]);

  useEffect(()=>{
    if(!selectedId||selectedId===current?.id){setSelected(null);return;}
    return fbWatchAnnouncement(selectedId,value=>setSelected(value),()=>setCurrentError("That announcement couldn't be loaded."));
  },[selectedId,current?.id]);

  useEffect(()=>{
    if(!current?.id)return;
    if(!open)setSelectedId(current.id);
    setArchive([]);setArchiveCursor(null);setArchiveMore(false);setArchiveOpen(false);
  },[current?.id,open]);

  const markRead=useCallback(()=>{
    if(!current?.publishedAtMs||current.publishedAtMs<=Number(lastReadAt||0))return;
    onRead(current.publishedAtMs);
  },[current?.publishedAtMs,lastReadAt,onRead]);
  useEffect(()=>{if(open)markRead();},[open,markRead]);

  useEffect(()=>{
    if(!open)return;
    const marker=`announcements_${Date.now()}`;
    window.history.pushState({...window.history.state,sgAnnouncements:marker},"");
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const closeFromHistory=()=>setOpen(false);
    const onKey=e=>{
      if(e.key==="Escape"){
        e.preventDefault();
        if(window.history.state?.sgAnnouncements===marker)window.history.back();
        else setOpen(false);
      }else if(e.key==="Tab"&&panelRef.current){
        const focusable=[...panelRef.current.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        )].filter(node=>node.offsetParent!==null);
        if(!focusable.length)return;
        const first=focusable[0],last=focusable.at(-1);
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
    };
    window.addEventListener("popstate",closeFromHistory);
    document.addEventListener("keydown",onKey);
    requestAnimationFrame(()=>closeButtonRef.current?.focus());
    return ()=>{
      document.body.style.overflow=previousOverflow;
      window.removeEventListener("popstate",closeFromHistory);
      document.removeEventListener("keydown",onKey);
    };
  },[open]);

  const openPanel=()=>{
    setSelectedId(current?.id||"");setComposer(null);setFeedback("");setOpen(true);
  };
  const closePanel=()=>{
    if(window.history.state?.sgAnnouncements)window.history.back();
    else setOpen(false);
  };
  const loadArchive=async({append=false}={})=>{
    if(archiveLoading)return;
    setArchiveLoading(true);setArchiveError("");
    try{
      const result=await fbLoadAnnouncementArchive(append?archiveCursor:null,5);
      const filtered=result.items.filter(item=>item.id!==current?.id);
      setArchive(items=>append?[...items,...filtered]:filtered);
      setArchiveCursor(result.cursor);setArchiveMore(result.hasMore);
    }catch{setArchiveError("Previous announcements couldn't be loaded.");}
    finally{setArchiveLoading(false);}
  };
  const toggleArchive=()=>{
    const next=!archiveOpen;setArchiveOpen(next);
    if(next&&!archive.length)loadArchive();
  };
  const activePost=selectedId&&selectedId!==current?.id?selected:current;
  const handleAdminSubmit=async draft=>{
    if(adminBusy)return;
    setAdminBusy(true);setFeedback("");
    try{
      if(composer?.mode==="edit"){
        await fbEditAnnouncement(user,password,composer.id,draft);
        setFeedback("Announcement updated. Replies and reactions were preserved.");
      }else{
        const id=await fbPublishAnnouncement(user,password,draft);
        setSelectedId(id);
        setFeedback("Announcement published.");
      }
      setComposer(null);
    }catch(e){setFeedback(e.message||"The announcement couldn't be saved.");}
    finally{setAdminBusy(false);}
  };
  const archiveCurrent=async()=>{
    if(adminBusy||!activePost)return;
    setAdminBusy(true);setFeedback("");
    try{
      await fbArchiveAnnouncement(user,password,activePost.id);
      setFeedback("Announcement moved to the archive.");
    }catch(e){setFeedback(e.message||"The announcement couldn't be archived.");}
    finally{setAdminBusy(false);}
  };
  const deletePost=async()=>{
    if(adminBusy||!activePost)return;
    if(!window.confirm(`Delete “${activePost.title}”? Its discussion will no longer be visible.`))return;
    setAdminBusy(true);setFeedback("");
    try{
      await fbDeleteAnnouncement(user,password,activePost.id);
      setSelectedId(current?.id===activePost.id?"":current?.id||"");
      setFeedback("Announcement deleted.");
    }catch(e){setFeedback(e.message||"The announcement couldn't be deleted.");}
    finally{setAdminBusy(false);}
  };
  const unread=!!current?.publishedAtMs&&current.publishedAtMs>Number(lastReadAt||0);
  const longMessage=(activePost?.message||"").length>520;

  return createPortal((
    <div className={`sg-announcement-root ${theme==="dark"?"sg-announcement-root--dark":""}`}>
      <button type="button" className="sg-announcement-launcher" onClick={openPanel}
        aria-label={`Open announcements${unread?", unread announcement":""}`} aria-haspopup="dialog">
        <span aria-hidden="true">📣</span>
        <span className="sg-announcement-launcher-label">Announcements</span>
        {unread&&<span className="sg-announcement-unread" aria-hidden="true"/>}
      </button>
      {open&&(
        <>
          <div className="sg-announcement-backdrop" onClick={closePanel} aria-hidden="true"/>
          <aside ref={panelRef} className="sg-announcement-panel" role="dialog" aria-modal="true" aria-labelledby="announcement-panel-title">
            <div style={announceStyles.panelHeader}>
              <div style={{minWidth:0}}>
                <div style={announceStyles.panelKicker}>STUDYGROVE COMMUNITY</div>
                <h2 id="announcement-panel-title" style={announceStyles.panelTitle}>Announcements</h2>
              </div>
              <button ref={closeButtonRef} type="button" style={announceStyles.closeBtn} onClick={closePanel} aria-label="Close announcements">✕</button>
            </div>
            <div className="sg-announcement-scroll">
              {isAdmin&&!composer&&(
                <button type="button" style={announceStyles.newBtn} onClick={()=>setComposer({mode:"new"})}>
                  ＋ New announcement
                </button>
              )}
              {composer&&(
                <AnnouncementComposer key={`${composer.mode}_${composer.id||"new"}`}
                  initial={composer.mode==="edit"?activePost:null} busy={adminBusy}
                  onCancel={()=>setComposer(null)} onSubmit={handleAdminSubmit}/>
              )}
              {feedback&&<div style={feedback.toLowerCase().includes("couldn")||feedback.toLowerCase().includes("only")?announceStyles.error:announceStyles.success} role="status">{feedback}</div>}
              {currentLoading ? (
                <div style={announceStyles.loading} aria-live="polite">
                  <div className="sg-skeleton" style={{height:18,width:"50%",marginBottom:10}}/>
                  <div className="sg-skeleton" style={{height:120}}/>
                </div>
              ) : currentError ? (
                <div style={announceStyles.error} role="alert">{currentError}</div>
              ) : !current ? (
                <div style={announceStyles.empty}>
                  <div style={{fontSize:30,marginBottom:8}}>🌱</div>
                  <strong>No announcements yet</strong>
                  <span>{isAdmin?"Publish the first Lumora update when you're ready.":"Official Lumora updates will appear here."}</span>
                </div>
              ) : activePost ? (
                <>
                  {activePost.id!==current.id&&(
                    <button type="button" style={announceStyles.backCurrent} onClick={()=>{setSelectedId(current.id);setExpanded(false);}}>
                      ← Current announcement
                    </button>
                  )}
                  <article style={announceStyles.post}>
                    <div style={announceStyles.postTop}>
                      <div style={announceStyles.official}>🌿 OFFICIAL STUDYGROVE ANNOUNCEMENT</div>
                      {activePost.category&&<span style={announceStyles.category}>{activePost.category}</span>}
                    </div>
                    <h3 className="sg-announcement-title" style={announceStyles.postTitle}>{activePost.title}</h3>
                    <time style={announceStyles.postTime} dateTime={new Date(activePost.publishedAtMs||activePost.createdAtMs||0).toISOString()}>
                      {formatAnnouncementDate(activePost.publishedAtMs||activePost.createdAtMs)}
                      {activePost.editedAtMs?" · edited":""}
                    </time>
                    <div className={`sg-announcement-copy ${longMessage&&!expanded?"sg-announcement-clamp":""}`} style={announceStyles.message}>
                      {activePost.message}
                    </div>
                    {longMessage&&(
                      <button type="button" style={announceStyles.readMore} onClick={()=>setExpanded(value=>!value)}>
                        {expanded?"Show less":"Read more"}
                      </button>
                    )}
                    <AnnouncementReactionBar user={user} password={password} announcementId={activePost.id}
                      counts={activePost.reactionCounts} onError={setFeedback}/>
                    {isAdmin&&(
                      <div style={announceStyles.adminActions}>
                        <button type="button" style={announceStyles.adminAction} onClick={()=>setComposer({mode:"edit",id:activePost.id})} disabled={adminBusy}>Edit</button>
                        {activePost.status==="published"&&<button type="button" style={announceStyles.adminAction} onClick={archiveCurrent} disabled={adminBusy}>Archive</button>}
                        <button type="button" style={{...announceStyles.adminAction,color:"#B75D4A"}} onClick={deletePost} disabled={adminBusy}>Delete</button>
                      </div>
                    )}
                  </article>
                  <AnnouncementDiscussion announcement={activePost} user={user} password={password}
                    isAdmin={isAdmin} onFeedback={setFeedback}/>
                  <section style={announceStyles.archiveSection}>
                    <button type="button" style={announceStyles.archiveToggle} onClick={toggleArchive} aria-expanded={archiveOpen}>
                      <span>Previous announcements</span>
                      <span style={{transform:archiveOpen?"rotate(180deg)":"none",transition:"transform .2s ease"}}>⌄</span>
                    </button>
                    {archiveOpen&&(
                      <div style={announceStyles.archiveList}>
                        {archiveError&&<div style={announceStyles.error}>{archiveError}</div>}
                        {!archiveLoading&&!archive.length&&!archiveError&&<div style={announceStyles.archiveEmpty}>No previous announcements.</div>}
                        {archive.map(item=>(
                          <button type="button" key={item.id} className="sg-announcement-archive-row"
                            style={{...announceStyles.archiveRow,...(item.id===activePost.id?announceStyles.archiveRowActive:{})}}
                            onClick={()=>{setSelectedId(item.id);setExpanded(false);}}>
                            <span style={{minWidth:0,textAlign:"left"}}>
                              <span className="sg-announcement-title" style={announceStyles.archiveTitle}>{item.title}</span>
                              <span style={announceStyles.archiveMeta}>
                                {item.category&&<>{item.category} · </>}{formatAnnouncementDate(item.publishedAtMs)}
                              </span>
                            </span>
                            <span style={announceStyles.archiveCount}>💬 {Number(item.replyCount)||0}</span>
                          </button>
                        ))}
                        {archiveLoading&&<div className="sg-skeleton" style={{height:54}}/>}
                        {archiveMore&&!archiveLoading&&(
                          <button type="button" style={announceStyles.loadMoreBtn} onClick={()=>loadArchive({append:true})}>Load more</button>
                        )}
                      </div>
                    )}
                  </section>
                </>
              ) : (
                <div style={announceStyles.loading}>Loading announcement…</div>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  ),document.body);
}

const announceStyles = {
  panelHeader:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"calc(17px + env(safe-area-inset-top)) 16px 13px",borderBottom:"1px solid #E3EAE0",background:"rgba(255,255,255,.86)",backdropFilter:"blur(10px)"},
  panelKicker:{fontSize:9.5,fontWeight:800,letterSpacing:"1.3px",color:"#7AA56B"},
  panelTitle:{fontSize:20,fontWeight:800,letterSpacing:"-.4px",margin:"2px 0 0",color:"#213127"},
  closeBtn:{width:32,height:32,border:0,borderRadius:"50%",background:"#EDF2EB",color:"#6E7D71",fontSize:13,cursor:"pointer",flexShrink:0},
  newBtn:{display:"block",width:"100%",padding:"10px 12px",margin:"14px 0 10px",border:"1px solid #D7E4D3",borderRadius:12,background:"#fff",color:"#376048",fontSize:12.5,fontWeight:750,cursor:"pointer"},
  loading:{padding:"18px 0"},
  empty:{display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center",gap:5,color:"#718076",fontSize:12.5,lineHeight:1.45,padding:"46px 18px"},
  error:{background:"#FFF1ED",border:"1px solid #F0C7BB",borderRadius:11,padding:"9px 11px",fontSize:11.5,color:"#A65343",lineHeight:1.4,margin:"10px 0"},
  success:{background:"#EFF8ED",border:"1px solid #CFE4CA",borderRadius:11,padding:"9px 11px",fontSize:11.5,color:"#3C6A48",lineHeight:1.4,margin:"10px 0"},
  post:{background:"#fff",border:"1px solid #E1E9DE",borderRadius:16,padding:"14px",margin:"14px 0 12px",boxShadow:"0 2px 8px rgba(31,52,37,.045)"},
  postTop:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:8},
  official:{fontSize:8.5,fontWeight:800,letterSpacing:".75px",color:"#63806B",lineHeight:1.25},
  category:{display:"inline-flex",alignItems:"center",borderRadius:20,padding:"3px 7px",background:"#EEF5EB",color:"#55715D",fontSize:9.5,fontWeight:750,whiteSpace:"nowrap"},
  postTitle:{fontSize:18,fontWeight:800,letterSpacing:"-.35px",lineHeight:1.2,color:"#22332A",margin:"0 0 5px"},
  postTime:{display:"block",fontSize:10.5,color:"#98A099",marginBottom:11},
  message:{fontSize:13.5,lineHeight:1.62,color:"#46544A"},
  readMore:{border:0,background:"transparent",padding:"7px 0 2px",color:"#4E7A5D",fontSize:11.5,fontWeight:750,cursor:"pointer"},
  reactions:{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap",marginTop:10},
  reaction:{display:"inline-flex",alignItems:"center",gap:3,minHeight:27,padding:"3px 7px",border:"1px solid #E2E8DF",borderRadius:16,background:"#F9FBF8",fontSize:13,cursor:"pointer",color:"#637068"},
  reactionActive:{borderColor:"#A8CEAD",background:"#EEF8ED",boxShadow:"0 0 0 2px rgba(93,157,104,.08)"},
  reactionCount:{fontSize:9.5,fontWeight:750},
  adminActions:{display:"flex",alignItems:"center",gap:5,marginTop:11,paddingTop:9,borderTop:"1px solid #EEF2EC"},
  adminAction:{border:"1px solid #E0E7DD",borderRadius:9,background:"#FAFCF9",padding:"6px 9px",color:"#58705F",fontSize:10.5,fontWeight:700,cursor:"pointer"},
  backCurrent:{border:0,background:"transparent",color:"#4E795B",fontSize:11.5,fontWeight:750,padding:"13px 1px 0",cursor:"pointer"},
  discussion:{margin:"0 0 12px"},
  discussionHead:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:8},
  discussionTitle:{fontSize:13,fontWeight:800,color:"#33473A",margin:0},
  replyTotal:{fontSize:10.5,color:"#909B92"},
  replyComposer:{background:"#fff",border:"1px solid #E1E9DE",borderRadius:13,padding:9},
  replyInput:{display:"block",width:"100%",border:0,outline:0,resize:"vertical",minHeight:54,maxHeight:180,background:"transparent",fontFamily:"inherit",fontSize:12.5,lineHeight:1.45,color:"#36443A"},
  replyComposerFoot:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,borderTop:"1px solid #F0F3EF",paddingTop:7},
  charCount:{fontSize:9.5,color:"#A2AAA3"},
  replyBtn:{border:0,borderRadius:9,background:"#477458",color:"#fff",padding:"7px 12px",fontSize:11,fontWeight:750,cursor:"pointer"},
  disabled:{opacity:.5,cursor:"not-allowed"},
  replyLoading:{padding:"10px 0"},
  emptyReplies:{textAlign:"center",fontSize:11.5,color:"#8C978E",padding:"22px 10px"},
  replyList:{display:"flex",flexDirection:"column",gap:7,marginTop:9},
  reply:{display:"flex",alignItems:"flex-start",gap:8,background:"#fff",border:"1px solid #E5EBE3",borderRadius:12,padding:"9px 9px 8px"},
  replyAvatar:{width:27,height:27,borderRadius:"50%",display:"grid",placeItems:"center",flex:"0 0 27px",background:"#DDEBDD",color:"#3E684B",fontSize:11,fontWeight:800},
  replyBody:{minWidth:0,flex:1},
  replyMeta:{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:7},
  replyUser:{fontSize:11.5,color:"#34483A",lineHeight:1.25},
  replyTime:{fontSize:8.5,color:"#A0A7A1",whiteSpace:"nowrap"},
  replyMessage:{fontSize:11.5,lineHeight:1.48,color:"#536058",marginTop:3},
  replyActions:{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:7},
  deleteReplyBtn:{border:0,background:"transparent",color:"#9C766D",fontSize:9.5,fontWeight:650,padding:"5px 1px",cursor:"pointer"},
  deletedReply:{fontSize:10.5,fontStyle:"italic",color:"#A2AAA3",padding:"9px 11px",border:"1px dashed #E1E6DF",borderRadius:10},
  archiveSection:{borderTop:"1px solid #E1E8DF",paddingTop:4,marginTop:16},
  archiveToggle:{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",border:0,background:"transparent",padding:"12px 1px",color:"#53685A",fontSize:12,fontWeight:750,cursor:"pointer"},
  archiveList:{display:"flex",flexDirection:"column",gap:6,paddingBottom:8},
  archiveRow:{width:"100%",border:"1px solid #E3E9E1",borderRadius:11,background:"#fff",padding:"9px 10px",cursor:"pointer",color:"#405047"},
  archiveRowActive:{borderColor:"#A9CDAE",background:"#F1F8F0"},
  archiveTitle:{display:"block",fontSize:11.5,fontWeight:750,lineHeight:1.3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},
  archiveMeta:{display:"block",fontSize:9.5,color:"#969F97",marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},
  archiveCount:{fontSize:9.5,color:"#7F8B82",whiteSpace:"nowrap"},
  archiveEmpty:{textAlign:"center",fontSize:11,color:"#98A099",padding:"14px 8px"},
  loadMoreBtn:{display:"block",width:"100%",border:"1px solid #DFE7DD",borderRadius:9,background:"#F9FBF8",padding:"7px 10px",color:"#607265",fontSize:10.5,fontWeight:700,cursor:"pointer",margin:"7px 0"},
  composer:{background:"#fff",border:"1px solid #DDE8DA",borderRadius:15,padding:12,margin:"14px 0 10px"},
  sectionTop:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:10},
  sectionTitle:{fontSize:13,color:"#33483A"},
  sectionTitleSmall:{fontSize:11.5,color:"#506158"},
  textBtn:{border:0,background:"transparent",color:"#7C8A7F",fontSize:10.5,fontWeight:700,cursor:"pointer"},
  label:{display:"block",fontSize:10.5,fontWeight:700,color:"#68766C",marginBottom:8},
  optional:{fontWeight:500,color:"#A0A8A1"},
  input:{display:"block",width:"100%",marginTop:4,padding:"9px 10px",border:"1px solid #DCE5D9",borderRadius:10,outline:0,background:"#FBFCFA",fontFamily:"inherit",fontSize:12.5,color:"#334139"},
  textarea:{display:"block",width:"100%",marginTop:4,padding:"9px 10px",border:"1px solid #DCE5D9",borderRadius:10,outline:0,background:"#FBFCFA",fontFamily:"inherit",fontSize:12.5,lineHeight:1.45,color:"#334139"},
  composerActions:{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:7,marginTop:10},
  secondaryBtn:{border:"1px solid #DDE5DA",borderRadius:9,background:"#F8FAF7",padding:"8px 10px",color:"#617066",fontSize:10.5,fontWeight:700,cursor:"pointer"},
  primaryBtn:{border:0,borderRadius:9,background:"#3F6E50",padding:"8px 12px",color:"#fff",fontSize:10.5,fontWeight:750,cursor:"pointer"},
  preview:{border:"1px solid #E3E9E1",borderRadius:11,background:"#FAFCF9",padding:11},
};

const LEGAL_SECTIONS = {
  privacy:{label:"Privacy Policy",title:"Privacy Policy",intro:"This policy states exactly how Lumora will collect, use, disclose and protect personal information.",sections:[
    ["Information Lumora collects","Lumora will collect only the information required to operate and protect the service. This includes account details; study sessions, subjects, goals, assessments and checklist items; coins, rewards, characters, classroom layouts and preferences; friends, groups, invitations and leaderboard results; optional friend-only presence; announcement replies and reactions; and essential device, security and diagnostic information. Lumora does not provide private or direct messaging."],
    ["How information will be used","Lumora will use personal information only to secure accounts, save study progress, provide requested features, synchronise devices, respond to requests, prevent misuse, diagnose faults and meet legal obligations. Lumora will not sell personal information and will not use it for targeted advertising."],
    ["Who will see information","Leaderboard participants will see usernames, focused time, session totals and subject summaries. Accepted friends will see online or studying status and the active subject only when presence sharing is enabled. Group members will see information required for group rankings and rewards. Signed-in users will see announcement replies and reactions. Lumora will keep credentials, detailed session records, assessments and checklist items private unless disclosure is required by law."],
    ["Service providers and overseas processing","Lumora will use Google Firebase and trusted cloud hosting, security and delivery providers only where required to operate the service. These providers may process information in Australia or overseas under their own privacy and security obligations. Future payment providers will receive only the information required to process a transaction. Lumora will not store complete card details."],
    ["Storage and retention","Lumora will retain account and study data only while required to operate the account, maintain security, manage backups, resolve disputes or meet legal obligations. Deleted information may remain temporarily in protected backups until those backups are overwritten. Local storage will retain preferences and session-recovery information on the user's device."],
    ["Your rights and controls","Users may disable presence sharing and download the main account data currently loaded in Lumora. Users may request access, correction or deletion by contacting Lumora. Lumora must action valid requests within a reasonable period, subject only to identity verification and legal retention requirements."],
    ["Young users","Users under 16 must review these documents with a parent or guardian. Lumora will maintain privacy-protective defaults and will not use targeted advertising. Users must not place real names, contact details or sensitive information in usernames, group names or announcement replies."],
    ["Security and incidents","Lumora will use Firebase Authentication, encrypted connections and access rules to restrict account data. No online service can guarantee absolute security. Lumora will investigate suspected incidents and will notify affected users and regulators whenever the law requires notification."],
    ["Changes and complaints",`Lumora may update this policy only when the service or legal requirements change. Lumora will clearly identify material changes in the app. Users must send access, correction, deletion and privacy complaints to the contact listed below. Effective ${LEGAL_EFFECTIVE_DATE}.`],
  ]},
  terms:{label:"Terms of Use",title:"Terms of Use",intro:"These terms govern your use of Lumora.",sections:[
    ["Eligibility and accounts","Users must be legally able to accept these terms. Users under 16 must have a parent or guardian review them. Every user must protect their sign-in details, provide accurate account information and must never access another person's account."],
    ["Acceptable use","Users must not bully, harass or impersonate another person; publish personal or unlawful material; interfere with security; manipulate study time, rankings, rewards or purchases; distribute malicious code; infringe intellectual property; or use Lumora in any way that harms another user or the service."],
    ["Study information","Lumora is a productivity tool and is not educational, medical or professional advice. Users must not rely on timers, streaks, statistics or insights for high-stakes decisions because those features may contain errors."],
    ["Virtual items","Coins, characters, backgrounds, decorations, rewards and achievements are limited licences for use inside Lumora. They have no cash value, cannot be transferred or redeemed, and do not constitute property or an investment. Lumora may change free rewards and catalogues, but will not remove paid entitlements contrary to applicable consumer law."],
    ["Future purchases and subscriptions","Lumora does not currently process purchases. Before any paid feature launches, Lumora must display the full price, billing period, renewal terms, included features, cancellation method and trial conditions before confirmation. A minor must obtain permission from a parent or guardian before purchasing. Refunds and remedies will comply with Australian Consumer Law and applicable store rules."],
    ["Content and intellectual property","Lumora's original software, branding and artwork remain protected by intellectual-property law. Users retain ownership of submitted content but grant Lumora the limited right to host, display and process that content only as required to operate, secure and improve the service."],
    ["Moderation and termination","Lumora may remove content, restrict features or suspend accounts when required for safety, security, legal compliance or serious or repeated breaches. Lumora will provide notice and a review process when reasonably appropriate. Users may stop using Lumora and may request account deletion."],
    ["Availability and liability","Lumora cannot guarantee uninterrupted or error-free operation. Nothing in these terms will exclude rights or remedies that cannot legally be excluded, including Australian Consumer Law guarantees. To the extent permitted by law, Lumora will not be liable for indirect loss that was not reasonably foreseeable."],
    ["Changes and law",`Lumora will provide reasonable notice of material changes. Australian law will govern these terms where applicable. Effective ${LEGAL_EFFECTIVE_DATE}.`],
  ]},
  accessibility:{label:"Accessibility & AI",title:"Accessibility & AI",intro:"How Lumora uses AI during development and the accessibility checks completed so far.",sections:[
    ["AI-assisted development","Lumora was created with assistance from generative AI tools for planning, interface concepts, code drafting, debugging and written content. Lumora's human operator must review and select AI-assisted work and remains responsible for the service. AI development assistance does not give an AI system automatic access to user accounts, study sessions or private information."],
    ["Accessibility standard","Lumora will work toward the Web Content Accessibility Guidelines principles of perceivable, operable, understandable and robust content. Accessibility must remain an ongoing development requirement. Lumora does not claim formal WCAG certification."],
    ["Visual access","Lumora must maintain readable text, clear hierarchy, responsive layouts, visible control states and information that does not rely on colour alone. These requirements support users with low vision and colour-vision differences. Lumora must continue testing across devices, zoom levels and display settings."],
    ["Motor and keyboard access","Lumora must use native buttons, links and form controls where practical. Icon-only controls must have accessible labels and key interfaces must show visible keyboard focus. Complex classroom arrangement controls must be improved where they cannot yet be operated effectively without a pointer."],
    ["Motion and vestibular access","Lumora will provide Full animation, Reduced animation, Animation off and device-setting options. Reduced and disabled motion settings must limit non-essential movement for users with motion sensitivity or vestibular conditions."],
    ["Screen readers and cognitive access","Important dialogs, status messages and form controls must use semantic roles or accessible labels. Instructions and policies must use clear headings, consistent structure and plain language to support screen-reader users and users with attention, learning or cognitive access needs."],
    ["Testing and accountability",`Lumora must continue browser, responsive-layout, keyboard, labelled-control and motion-setting checks. Lumora has not completed an independent accessibility audit and must not claim that people with every listed disability performed the testing. Accessibility barriers must be reported to ${LEGAL_CONTACT_EMAIL}; Lumora will investigate and prioritise reasonable fixes.`],
  ]},
};

function PrivacyDataPanel({user,privacyPrefs,onPrivacyChange,exportData,onClose,onBack}){
  const [view,setView]=useState("overview");
  const [saved,setSaved]=useState("");
  const document=LEGAL_SECTIONS[view];
  const updatePresence=async enabled=>{
    const ok=await onPrivacyChange({sharePresence:enabled});
    setSaved(ok?"Privacy setting saved":"Could not sync that setting. Try again.");
    setTimeout(()=>setSaved(""),2400);
  };
  const contactHref=LEGAL_CONTACT_EMAIL?`mailto:${LEGAL_CONTACT_EMAIL}?subject=${encodeURIComponent(`Lumora privacy request — ${user}`)}`:"";
  return <div style={pd.overlay} className="sg-overlay-anim" onClick={onClose}>
    <div style={pd.sheet} className="sg-sheet-anim" onClick={event=>event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="privacy-data-title">
      <div style={pd.header}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button style={ap.back} onClick={view==="overview"?(onBack||onClose):()=>setView("overview")} aria-label="Back">←</button>
          <div><div style={ap.kicker}>PRIVACY & DATA</div><h3 id="privacy-data-title" style={ap.title}>{document?.title||"Your information"}</h3></div>
        </div>
        <button style={ap.x} onClick={onClose} aria-label="Close">✕</button>
      </div>
      {view==="overview"?<>
        <div style={pd.hero}>
          <b style={pd.heroTitle}>Privacy without the fine-print feel.</b>
          <span style={pd.summary}>Control visibility, manage your information and read every policy in one place.</span>
        </div>
        {saved&&<div style={pd.notice} role="status">{saved}</div>}
        <section style={pd.section}>
          <div style={pd.sectionHeading}><b style={pd.sectionTitle}>Friend visibility</b><small style={pd.sectionSub}>Control live activity sharing.</small></div>
          <label style={pd.toggleRow}>
            <span><b style={pd.toggleTitle}>Online and studying status</b><small style={pd.toggleSub}>Accepted friends can see when you are online and, during focus, your selected subject.</small></span>
            <input type="checkbox" checked={privacyPrefs.sharePresence!==false} onChange={event=>updatePresence(event.target.checked)} style={pd.checkbox}/>
          </label>
          <p style={pd.helper}>Your username and study totals can still appear in leaderboards and groups. Detailed sessions, assessments and checklist items stay private.</p>
        </section>
        <section style={pd.section}>
          <div style={pd.sectionHeading}><b style={pd.sectionTitle}>Your data</b><small style={pd.sectionSub}>Access, export or request changes.</small></div>
          <div style={pd.actionGrid}>
            <button style={pd.action} onClick={exportData}><span style={pd.actionCopy}><b style={pd.actionTitle}>Download data</b><small style={pd.actionSub}>Export account progress and settings as JSON.</small></span><span style={pd.arrow} aria-hidden="true">→</span></button>
            {contactHref?<a style={{...pd.action,textDecoration:"none"}} href={contactHref}><span style={pd.actionCopy}><b style={pd.actionTitle}>Submit a privacy request</b><small style={pd.actionSub}>Request access, correction or deletion.</small></span><span style={pd.arrow} aria-hidden="true">→</span></a>:
              <div style={{...pd.action,cursor:"default",opacity:.65}}><span style={pd.actionCopy}><b style={pd.actionTitle}>Submit a privacy request</b><small style={pd.actionSub}>The privacy contact is being configured.</small></span></div>}
          </div>
        </section>
        <section style={pd.section}>
          <div style={pd.sectionHeading}><b style={pd.sectionTitle}>Policies and transparency</b><small style={pd.sectionSub}>Direct, plain-language documents.</small></div>
          <div style={pd.documentList}>
            {Object.entries(LEGAL_SECTIONS).map(([id,item])=><button key={id} style={pd.documentRow} onClick={()=>setView(id)}><span style={pd.documentCopy}><b style={pd.documentTitle}>{item.label}</b><small style={pd.documentSub}>{id==="accessibility"?"AI disclosure and accessibility testing":`Effective ${LEGAL_EFFECTIVE_DATE}`}</small></span><span style={pd.arrow} aria-hidden="true">→</span></button>)}
          </div>
          <div style={pd.paymentNote}><b style={pd.paymentTitle}>Purchases and subscriptions</b><span style={pd.paymentCopy}>Paid features are not active. Lumora must display price, renewal, cancellation and refund terms before checkout.</span></div>
        </section>
      </>:<>
        <div style={pd.documentHero}><p style={pd.legalIntro}>{document.intro}</p><span style={pd.effective}>{view==="accessibility"?"Current statement":`Effective ${LEGAL_EFFECTIVE_DATE}`}</span></div>
        <div style={pd.legalList}>{document.sections.map(([heading,body],index)=><section key={heading} style={pd.legalSection}><span style={pd.sectionNumber}>{String(index+1).padStart(2,"0")}</span><div style={pd.legalCopy}><h4 style={pd.legalHeading}>{heading}</h4><p style={pd.legalBody}>{body}</p></div></section>)}</div>
        {LEGAL_CONTACT_EMAIL&&<a href={contactHref} style={pd.contact}>Contact: {LEGAL_CONTACT_EMAIL}</a>}
      </>}
    </div>
  </div>;
}
const pd={
  overlay:{...ap.overlay,zIndex:355},sheet:{...ap.modal,maxWidth:620,maxHeight:"94vh",padding:"22px clamp(18px,5vw,34px) 30px",background:"#FCFDFB"},header:{...ap.header,position:"sticky",top:-22,zIndex:2,background:"rgba(252,253,251,.97)",backdropFilter:"blur(14px)",paddingTop:22,paddingBottom:16,marginBottom:10,borderBottom:"1px solid #E9EDE8"},
  hero:{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:7,padding:"12px 0 8px",margin:"0 0 4px"},heroTitle:{display:"block",fontSize:18,color:"#203027",letterSpacing:"-.25px",lineHeight:1.25},summary:{display:"block",fontSize:12.5,color:"#68736C",lineHeight:1.55,maxWidth:470},trustRow:{display:"flex",flexWrap:"wrap",gap:7,margin:"6px 0 28px"},trustPill:{fontSize:9.5,fontWeight:750,letterSpacing:.2,color:"#59675E",background:"#F3F6F2",borderRadius:999,padding:"6px 9px"},notice:{background:"#EDF5EE",color:"#2D6A4F",borderRadius:9,padding:"9px 11px",fontSize:12,fontWeight:700,marginBottom:18},
  section:{padding:"0 0 25px",marginBottom:25,borderBottom:"1px solid #E7ECE7"},sectionHeading:{display:"block",marginBottom:16},sectionTitle:{display:"block",fontSize:14.5,color:"#25342B",lineHeight:1.3},sectionSub:{display:"block",fontSize:10.8,color:"#87918A",lineHeight:1.45,marginTop:4},
  toggleRow:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:22,cursor:"pointer",padding:"1px 0"},toggleTitle:{display:"block",fontSize:13,color:"#2A3930",lineHeight:1.35},toggleSub:{display:"block",fontSize:11.3,color:"#758078",lineHeight:1.55,marginTop:5,maxWidth:430},checkbox:{width:21,height:21,accentColor:"#2D6A4F",flexShrink:0},helper:{fontSize:10.5,color:"#8B958E",lineHeight:1.55,margin:"13px 0 0"},
  actionGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:0,borderTop:"1px solid #E7ECE7"},action:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,width:"100%",boxSizing:"border-box",border:0,borderBottom:"1px solid #E7ECE7",background:"transparent",padding:"15px 1px",cursor:"pointer",color:"#27332B",fontFamily:"inherit",textAlign:"left"},actionCopy:{display:"block",minWidth:0},actionTitle:{display:"block",fontSize:13.2,color:"#24332A",lineHeight:1.35},actionSub:{display:"block",fontSize:10.8,color:"#7D8780",lineHeight:1.5,marginTop:4},arrow:{fontSize:15,color:"#9AA29C",fontWeight:500,flexShrink:0},
  documentList:{borderTop:"1px solid #E7ECE7"},documentRow:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,width:"100%",border:0,borderBottom:"1px solid #E7ECE7",background:"transparent",padding:"15px 1px",cursor:"pointer",fontFamily:"inherit",textAlign:"left",color:"#27332B"},documentCopy:{display:"block",minWidth:0},documentTitle:{display:"block",fontSize:13.2,color:"#24332A",lineHeight:1.35},documentSub:{display:"block",fontSize:10.8,color:"#7D8780",lineHeight:1.45,marginTop:4},paymentNote:{marginTop:17,padding:"0 1px"},paymentTitle:{display:"block",fontSize:11.5,color:"#546159",lineHeight:1.4},paymentCopy:{display:"block",fontSize:10.7,color:"#879089",lineHeight:1.55,marginTop:4},
  documentHero:{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:9,padding:"10px 0 23px",borderBottom:"1px solid #E7ECE7"},legalIntro:{fontSize:13,color:"#4F5D54",lineHeight:1.6,margin:0,maxWidth:500},effective:{fontSize:9.5,color:"#8A948D",fontWeight:700,letterSpacing:.4,textTransform:"uppercase"},legalList:{display:"block"},legalSection:{display:"grid",gridTemplateColumns:"34px minmax(0,1fr)",gap:12,padding:"20px 0",borderBottom:"1px solid #E7ECE7"},sectionNumber:{fontSize:9.5,fontWeight:750,letterSpacing:1,color:"#9AA39D",paddingTop:3},legalCopy:{minWidth:0},legalHeading:{fontSize:13.5,color:"#26352C",margin:"0 0 7px",lineHeight:1.35},legalBody:{fontSize:11.8,color:"#626F67",lineHeight:1.68,margin:0},contact:{display:"inline-flex",color:"#2D6A4F",fontSize:11.5,fontWeight:750,margin:"20px 0 1px",padding:"9px 0",textDecoration:"none"},
};

function HeaderMenu({ user, coins, theme, streak, badgeCount, isAdmin, animationMode, onAnimationModeChange, onTreeShop, onGardenShop, onBadges, onRecap, onSessions, onAccount, onPrivacyData, onAdmin, onToggleTheme, onLogout, onClose }) {
  const items = [
    { icon:"🧑‍🎓", label:"Skins", sub:"Growth looks and unlocks", onClick:onTreeShop },
    { icon:"🏫", label:"Classroom Decor", sub:"Desks, details & more", onClick:onGardenShop },
    { icon:"🏅", label:"Achievements",  sub:`${badgeCount}/${BADGES.length} earned`, onClick:onBadges },
    { icon:"📊", label:"Smart Analytics", sub:"Insights & trends",     onClick:onRecap },
    { icon:"📝", label:"My Sessions",   sub:"Fix an over-recorded session", onClick:onSessions },
    { icon:"⚙️", label:"Account",        sub:"Password & recovery",   onClick:onAccount },
    { icon:"◇", label:"Privacy & Data", sub:"Controls, policy & terms", onClick:onPrivacyData },
    ...(isAdmin ? [{ icon:"🛠", label:"Admin Console", sub:"User & moderation tools", onClick:onAdmin }] : []),
  ];
  return (
    <div style={hm.overlay} className="sg-overlay-anim" onClick={onClose}>
      <div style={hm.sheet} className="sg-sheet-anim" onClick={e=>e.stopPropagation()}>
        <div style={hm.grabber}/>
        <button style={hm.profile} className="sg-tap-card" onClick={onAccount}>
          <span style={hm.avatar}>{user.slice(0,1).toUpperCase()}</span>
          <div style={{flex:1,textAlign:"left"}}>
            <div style={hm.name}>{user}</div>
            <div style={hm.meta}><AnimatedNumber value={coins} prefix="🪙 "/> · 🔥 {streak} day{streak!==1?"s":""}</div>
          </div>
          <span style={hm.chev}>›</span>
        </button>
        <div style={hm.list}>
          {items.map(it=>(
            <button key={it.label} className="sg-tap-card" style={hm.item} onClick={it.onClick}>
              <span style={hm.itemIcon}>{it.icon}</span>
              <span style={{flex:1,textAlign:"left"}}>
                <span style={hm.itemLabel}>{it.label}</span>
                <span style={hm.itemSub}>{it.sub}</span>
              </span>
              <span style={hm.chev}>›</span>
            </button>
          ))}
        </div>
        <div style={hm.divider}/>
        <div style={hm.motionCard}>
          <div>
            <div style={hm.motionTitle}>Animations</div>
            <div style={hm.motionSub}>Reduce motion and background effects</div>
          </div>
          <div style={hm.motionOptions} role="group" aria-label="Animation level">
            {[
              ["device","Device"],
              ["full","Full"],
              ["off","None"],
            ].map(([id,label])=><button key={id} type="button" aria-pressed={animationMode===id}
              style={{...hm.motionOption,...(animationMode===id?hm.motionOptionOn:{})}}
              onClick={()=>onAnimationModeChange(id)}>{label}</button>)}
          </div>
        </div>
        <button style={hm.row} onClick={onToggleTheme}>
          <span style={hm.itemIcon}>{theme==="dark"?"☀️":"🌙"}</span>
          <span style={{flex:1,textAlign:"left",fontSize:14,fontWeight:600,color:"#444"}}>
            {theme==="dark"?"Light mode":"Dark mode"}
          </span>
        </button>
        <button style={hm.row} onClick={onLogout}>
          <span style={hm.itemIcon}>↩</span>
          <span style={{flex:1,textAlign:"left",fontSize:14,fontWeight:600,color:"#E07B54"}}>Log out</span>
        </button>
        <button style={hm.closeBtn} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
const hm = {
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:350},
  sheet:{background:"#fff",borderRadius:"24px 24px 0 0",padding:"10px 16px 28px",width:"100%",maxWidth:440,maxHeight:"92vh",overflowY:"auto",boxShadow:"0 -4px 24px rgba(0,0,0,0.15)"},
  grabber:{width:36,height:4,borderRadius:4,background:"#E0E0E0",margin:"0 auto 14px"},
  profile:{display:"flex",alignItems:"center",gap:12,padding:"8px 8px",width:"100%",background:"#F9FBF8",border:"1px solid #EEF2EC",borderRadius:14,cursor:"pointer",marginBottom:10},
  avatar:{width:42,height:42,borderRadius:"50%",background:"#2D6A4F",color:"#fff",fontSize:18,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"},
  name:{fontSize:16,fontWeight:700,color:"#1a1a2e"},
  meta:{fontSize:12,color:"#999",marginTop:2},
  list:{display:"flex",flexDirection:"column",gap:4},
  item:{display:"flex",alignItems:"center",gap:12,width:"100%",background:"#F9FBF8",border:"1px solid #EEF2EC",borderRadius:14,padding:"12px 14px",cursor:"pointer",transition:"background 0.15s"},
  itemIcon:{fontSize:20,width:24,textAlign:"center",flexShrink:0},
  itemLabel:{display:"block",fontSize:14,fontWeight:700,color:"#1a1a2e"},
  itemSub:{display:"block",fontSize:11,color:"#aaa",marginTop:1},
  chev:{fontSize:18,color:"#ccc",fontWeight:700},
  divider:{height:1,background:"#EEF2EC",margin:"12px 0"},
  motionCard:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"7px 8px 10px"},
  motionTitle:{fontSize:13,fontWeight:750,color:"#33463A"},
  motionSub:{fontSize:9.5,color:"#98A099",marginTop:2},
  motionOptions:{display:"flex",gap:3,padding:3,borderRadius:11,background:"#EEF2EC",flexShrink:0},
  motionOption:{border:0,borderRadius:8,background:"transparent",padding:"6px 8px",fontSize:9.5,fontWeight:750,color:"#7A867D",cursor:"pointer"},
  motionOptionOn:{background:"#fff",color:"#2D6A4F",boxShadow:"0 1px 4px rgba(30,55,38,.12)"},
  row:{display:"flex",alignItems:"center",gap:12,width:"100%",background:"transparent",border:"none",borderRadius:12,padding:"11px 14px",cursor:"pointer"},
  closeBtn:{display:"block",width:"100%",marginTop:10,padding:"13px 0",background:"#F5F7F2",border:"none",borderRadius:14,fontSize:15,fontWeight:600,color:"#666",cursor:"pointer"},
};

// ── Smart Analytics Dashboard ─────────────────────────────────────────────────
// Replaces the old Weekly Recap. One rich scroll: hero stats, AI-style insight
// cards (only those with real data), a contribution heatmap, a focus trend, and
// subject rankings. Auto-shows once per week and is reachable from the menu.
function SmartDashboard({ history, subjects, streak, targets, coins, onClose, onBack }) {
  const hist = Array.isArray(history) ? history : [];
  const empty = hist.length === 0;

  // Lifetime + this-week stats
  const ws = startOfWeek(new Date());
  const week = hist.filter(s=>new Date(s.ts)>=ws);
  const weekSecs = week.reduce((a,s)=>a+s.secs,0);
  const lifeSecs = hist.reduce((a,s)=>a+s.secs,0);
  const avgSession = hist.length ? Math.round(lifeSecs/hist.length) : 0;

  // Insights from the engine
  const insights = buildInsights({ history:hist, subjects, targets, streak, coins });

  // ── Contribution heatmap (last ~13 weeks, GitHub-style) ──
  const DAYS = 7, WEEKS = 13;
  const today = startOfStudyDay(new Date());
  const dayMap = {};
  hist.forEach(s=>{ const k=startOfStudyDay(s.ts).getTime(); dayMap[k]=(dayMap[k]||0)+s.secs; });
  // Build complete Melbourne Sunday→Saturday columns. Future cells in the
  // current week stay transparent until that Melbourne calendar day arrives.
  const gridStart = shiftStudyWeek(today,-(WEEKS-1)).start;
  const heat = [];
  let maxDay = 0;
  for(let w=0; w<WEEKS; w++){
    const col=[];
    for(let d=0; d<DAYS; d++){
      const day=shiftStudyDay(gridStart,w*DAYS+d);
      const secs = day>today ? -1 : (dayMap[day.getTime()]||0);
      if(secs>maxDay) maxDay=secs;
      col.push({ t:day.getTime(), secs });
    }
    heat.push(col);
  }
  const heatColor = secs => {
    if(secs<0) return "transparent";
    if(secs===0) return "#EAF0E8";
    const r = maxDay>0 ? secs/maxDay : 0;
    return r>0.66 ? "#2D6A4F" : r>0.33 ? "#5BAE7E" : "#A9D9BE";
  };

  // ── Focus trend (last 8 weeks total hours) ──
  const trendWeeks = 8;
  const trend = [];
  for(let i=trendWeeks-1; i>=0; i--){
    const range=shiftStudyWeek(ws,-i);
    const s=range.start, e=range.endExclusive;
    const secs=hist.filter(x=>{const t=new Date(x.ts); return t>=s&&t<e;}).reduce((a,x)=>a+x.secs,0);
    trend.push({ secs, label:formatStudyDate(s,{month:"numeric",day:"numeric"}) });
  }
  const trendMax = Math.max(...trend.map(t=>t.secs), 1);
  const tW=300, tH=70, tPad=4;
  const trendPts = trend.map((t,i)=>{
    const x = tPad + (i/(trend.length-1))*(tW-tPad*2);
    const y = tH - tPad - (t.secs/trendMax)*(tH-tPad*2);
    return [x,y];
  });
  const trendPath = trendPts.map((p,i)=>`${i===0?"M":"L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const trendArea = `${trendPath} L${trendPts[trendPts.length-1][0].toFixed(1)},${tH-tPad} L${trendPts[0][0].toFixed(1)},${tH-tPad} Z`;

  // ── Subject rankings (lifetime) ──
  const subjTot={};
  hist.forEach(s=>{ subjTot[s.subject]=(subjTot[s.subject]||0)+s.secs; });
  const ranks=Object.entries(subjTot).map(([id,secs])=>{
    const subj=subjects.find(x=>x.id===id)||{emoji:"✏️",label:"(removed)",color:"#aaa"};
    return {...subj,secs};
  }).sort((a,b)=>b.secs-a.secs);
  const rankMax = ranks[0]?.secs||1;

  return (
    <div style={sd.overlay} className="sg-overlay-anim" onClick={onClose}>
      <div style={sd.modal} className="sg-sheet-anim" onClick={e=>e.stopPropagation()}>
        <div style={sd.header}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {onBack && <button style={sd.back} onClick={onBack} title="Back">←</button>}
            <div>
              <div style={sd.kicker}>SMART ANALYTICS</div>
              <h3 style={sd.title}>Your Insights 📊</h3>
            </div>
          </div>
          <button style={sd.x} onClick={onClose}>✕</button>
        </div>

        {empty ? (
          <p style={sd.empty}>No sessions yet — complete your first focus session and your classroom will grow here 🌱</p>
        ) : (
          <>
            {/* Hero stats */}
            <div style={sd.heroRow}>
              <div style={sd.hero}><div style={sd.heroVal}>{fmtHrs(weekSecs)}</div><div style={sd.heroLbl}>this week</div></div>
              <div style={sd.hero}><div style={sd.heroVal}>{fmtHrs(lifeSecs)}</div><div style={sd.heroLbl}>all time</div></div>
              <div style={sd.hero}><div style={sd.heroVal}>{fmtMins(avgSession)}</div><div style={sd.heroLbl}>avg session</div></div>
            </div>

            {/* Insight cards */}
            {insights.length>0 && (
              <div style={sd.section}>
                <div style={sd.secTitle}>What we noticed</div>
                <div style={sd.insightList}>
                  {insights.map((ins,i)=>(
                    <div key={i} className="sg-card-anim"
                      style={{...sd.insight,...(ins.tone==="soft"?sd.insightSoft:sd.insightGood),animationDelay:`${Math.min(i*0.05,0.4)}s`}}>
                      <span style={sd.insightIcon}>{ins.icon}</span>
                      <div style={{flex:1}}>
                        <div style={sd.insightTitle}>{ins.title}</div>
                        <div style={sd.insightBody}>{ins.body}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Heatmap */}
            <div style={sd.section}>
              <div style={sd.secTitle}>Focus heatmap · last 13 weeks</div>
              <div style={sd.heatWrap}>
                <div style={sd.heatDays}>
                  {["","M","","W","","F",""].map((d,i)=><div key={i} style={sd.heatDayLbl}>{d}</div>)}
                </div>
                <div style={sd.heatGrid}>
                  {heat.map((col,ci)=>(
                    <div key={ci} style={sd.heatCol}>
                      {col.map((cell,di)=>(
                        <div key={di} title={cell.secs>=0?`${fmtMins(cell.secs)} on ${formatStudyDate(cell.t,{day:"numeric",month:"short"})}`:""}
                          style={{...sd.heatCell,background:heatColor(cell.secs)}}/>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div style={sd.heatLegend}>
                <span style={sd.legendLbl}>Less</span>
                {["#EAF0E8","#A9D9BE","#5BAE7E","#2D6A4F"].map(c=><div key={c} style={{...sd.heatCell,background:c}}/>)}
                <span style={sd.legendLbl}>More</span>
              </div>
            </div>

            {/* Focus trend */}
            <div style={sd.section}>
              <div style={sd.secTitle}>Focus trend · last 8 weeks</div>
              <svg viewBox={`0 0 ${tW} ${tH}`} width="100%" height={tH} style={{display:"block"}}>
                <defs>
                  <linearGradient id="sd-trend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2D6A4F" stopOpacity="0.28"/>
                    <stop offset="100%" stopColor="#2D6A4F" stopOpacity="0"/>
                  </linearGradient>
                </defs>
                <path d={trendArea} fill="url(#sd-trend)"/>
                <path d={trendPath} fill="none" stroke="#2D6A4F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                {trendPts.map((p,i)=>(
                  <circle key={i} cx={p[0]} cy={p[1]} r={i===trendPts.length-1?3.5:2.2}
                    fill="#fff" stroke="#2D6A4F" strokeWidth="2"/>
                ))}
              </svg>
              <div style={sd.trendLbls}>
                <span>{trend[0].label}</span><span>now</span>
              </div>
            </div>

            {/* Subject rankings */}
            {ranks.length>0 && (
              <div style={sd.section}>
                <div style={sd.secTitle}>Subject rankings · all time</div>
                <div style={sd.rankList}>
                  {ranks.map((r,i)=>(
                    <div key={r.label} style={sd.rankRow}>
                      <span style={sd.rankNum}>{i+1}</span>
                      <span style={{fontSize:16,width:22}}>{r.emoji}</span>
                      <div style={{flex:1}}>
                        <div style={sd.rankName}>{r.label}</div>
                        <div style={sd.rankTrack}><div style={{...sd.rankFill,width:`${(r.secs/rankMax)*100}%`,background:r.color}}/></div>
                      </div>
                      <span style={{...sd.rankVal,color:r.color}}>{fmtHrs(r.secs)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <button style={sd.doneBtn} onClick={onClose}>Keep growing 🌱</button>
      </div>
    </div>
  );
}
const sd = {
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:340},
  modal:{background:"#F7FAF6",borderRadius:"24px 24px 0 0",padding:"22px 18px 30px",width:"100%",maxWidth:440,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 -8px 32px rgba(0,0,0,0.18)"},
  header:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16},
  back:{background:"#EAEFE7",border:"none",borderRadius:"50%",width:30,height:30,fontSize:16,color:"#666",cursor:"pointer",flexShrink:0,lineHeight:1,marginTop:4},
  kicker:{fontSize:10,fontWeight:700,color:"#7AA56B",letterSpacing:"1.5px",marginBottom:2},
  title:{fontSize:21,fontWeight:800,color:"#1a1a2e",margin:0,letterSpacing:"-0.5px"},
  x:{background:"#EAEFE7",border:"none",borderRadius:"50%",width:30,height:30,fontSize:13,color:"#888",cursor:"pointer",flexShrink:0},
  empty:{fontSize:14,color:"#888",textAlign:"center",lineHeight:1.6,padding:"30px 12px"},
  heroRow:{display:"flex",gap:9,marginBottom:8},
  hero:{flex:1,background:"#fff",borderRadius:14,padding:"13px 6px",textAlign:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"},
  heroVal:{fontSize:20,fontWeight:900,color:"#2D6A4F",letterSpacing:"-0.5px"},
  heroLbl:{fontSize:10,color:"#999",marginTop:2,fontWeight:600},
  section:{marginTop:20},
  secTitle:{fontSize:11,fontWeight:700,color:"#8A968A",textTransform:"uppercase",letterSpacing:"0.6px",marginBottom:10},
  insightList:{display:"flex",flexDirection:"column",gap:8},
  insight:{display:"flex",alignItems:"flex-start",gap:11,borderRadius:14,padding:"13px 14px",border:"1.5px solid"},
  insightGood:{background:"#fff",borderColor:"#D8EBDF"},
  insightSoft:{background:"#FFFBF4",borderColor:"#F0E2C8"},
  insightIcon:{fontSize:20,lineHeight:1.1,flexShrink:0},
  insightTitle:{fontSize:13.5,fontWeight:800,color:"#1a1a2e",marginBottom:2,lineHeight:1.25},
  insightBody:{fontSize:12,color:"#777",lineHeight:1.45},
  heatWrap:{display:"flex",gap:5,background:"#fff",borderRadius:14,padding:"12px 12px 10px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"},
  heatDays:{display:"flex",flexDirection:"column",gap:3,paddingTop:0},
  heatDayLbl:{fontSize:8,color:"#bbb",height:13,lineHeight:"13px",fontWeight:600},
  heatGrid:{display:"flex",gap:3,flex:1,justifyContent:"space-between"},
  heatCol:{display:"flex",flexDirection:"column",gap:3},
  heatCell:{width:13,height:13,borderRadius:3},
  heatLegend:{display:"flex",alignItems:"center",gap:4,justifyContent:"flex-end",marginTop:8},
  legendLbl:{fontSize:10,color:"#aaa",fontWeight:600},
  trendLbls:{display:"flex",justifyContent:"space-between",fontSize:10,color:"#aaa",fontWeight:600,marginTop:2,padding:"0 2px"},
  rankList:{display:"flex",flexDirection:"column",gap:9,background:"#fff",borderRadius:14,padding:"14px 14px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"},
  rankRow:{display:"flex",alignItems:"center",gap:9},
  rankNum:{fontSize:12,fontWeight:800,color:"#bbb",width:14,textAlign:"center"},
  rankName:{fontSize:12.5,fontWeight:600,color:"#444",marginBottom:4},
  rankTrack:{height:6,background:"#EEF2EC",borderRadius:6,overflow:"hidden"},
  rankFill:{height:"100%",borderRadius:6,transition:"width 0.6s ease"},
  rankVal:{fontSize:12,fontWeight:700,width:44,textAlign:"right"},
  doneBtn:{display:"block",width:"100%",marginTop:20,padding:"14px 0",background:"#2D6A4F",border:"none",borderRadius:14,fontSize:15,fontWeight:700,color:"#fff",cursor:"pointer"},
};


const ASSESSMENT_TYPES = ["SAC","Exam","Assignment","Test","Practical","Oral"];
const ASSESSMENT_FAMILY_META = {
  math:{label:"Mathematics",emoji:"📐",color:"#5B8DEF"},
  english:{label:"English",emoji:"📖",color:"#E07B54"},
  pe:{label:"Physical Education",emoji:"🏃",color:"#56B68B"},
  chemistry:{label:"Chemistry",emoji:"⚗️",color:"#7E71C9"},
  biology:{label:"Biology",emoji:"🧬",color:"#4E9A6B"},
  physics:{label:"Physics",emoji:"⚡",color:"#6786C8"},
  history:{label:"History",emoji:"📜",color:"#B47C52"},
  geography:{label:"Geography",emoji:"🌍",color:"#4D9BA6"},
  computing:{label:"Computing",emoji:"💻",color:"#687384"},
  art:{label:"Art",emoji:"🎨",color:"#C57BDB"},
  music:{label:"Music",emoji:"🎵",color:"#B56E9E"},
  languages:{label:"Languages",emoji:"💬",color:"#D18A58"},
  business:{label:"Business",emoji:"📊",color:"#B58A3D"},
  psychology:{label:"Psychology",emoji:"🧠",color:"#9272B4"},
  legal:{label:"Legal Studies",emoji:"⚖️",color:"#7586A0"},
  science:{label:"Science",emoji:"🔬",color:"#4B9B8C"},
  general:{label:"General Study",emoji:"📚",color:"#7AA56B"},
};
const newAssessmentId = () => {
  try { return crypto.randomUUID(); }
  catch { return `assessment-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; }
};
const assessmentDateParts = value => {
  const exact=String(value||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(exact)return {year:+exact[1],month:+exact[2],day:+exact[3]};
  const parsed=new Date(value);
  if(isNaN(parsed.getTime()))return null;
  return {year:parsed.getFullYear(),month:parsed.getMonth()+1,day:parsed.getDate()};
};
const assessmentDayNumber = value => {
  const p=assessmentDateParts(value);
  return p ? Math.floor(Date.UTC(p.year,p.month-1,p.day)/86400000) : Number.POSITIVE_INFINITY;
};
const assessmentDateKey = value => {
  const p=assessmentDateParts(value);
  return p ? `${p.year}-${String(p.month).padStart(2,"0")}-${String(p.day).padStart(2,"0")}` : "";
};
const assessmentDaysRemaining = (value,now=new Date()) => {
  const today=Math.floor(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())/86400000);
  return assessmentDayNumber(value)-today;
};
const assessmentLocalDate = value => {
  const p=assessmentDateParts(value);
  return p ? new Date(p.year,p.month-1,p.day,12,0,0,0) : null;
};
const formatAssessmentDate = (value,short=false) => {
  const d=assessmentLocalDate(value);
  if(!d)return "Date unavailable";
  return d.toLocaleDateString("en-AU",short
    ? {weekday:"short",day:"numeric",month:"short"}
    : {weekday:"short",day:"numeric",month:"short",year:"numeric"});
};
const assessmentDaysLabel = days => days===0 ? "Today" : days===1 ? "Tomorrow" : days>1 ? `${days} days` : `${Math.abs(days)}d ago`;
const assessmentUrgency = days => days<=3 ? "#D96F58" : days<=7 ? "#D6A53E" : "#56A77A";
const resolveAssessmentSubject = (assessment,subjects=[]) => {
  const raw=String(assessment?.subject||"").trim();
  const normalise=v=>String(v||"").trim().toLowerCase();
  const exact=subjects.find(s=>normalise(s.id)===normalise(raw)||normalise(s.label)===normalise(raw));
  if(exact)return exact;
  const haystack=raw||String(assessment?.name||"");
  const family=getSubjectBackdropFamily({id:haystack,label:haystack});
  const configured=subjects.find(s=>getSubjectBackdropFamily(s).id===family.id);
  if(configured)return configured;
  const fallback=ASSESSMENT_FAMILY_META[family.id]||ASSESSMENT_FAMILY_META.general;
  return {...fallback,label:raw||fallback.label,id:family.id};
};
const assessmentSort = (a,b) =>
  assessmentDayNumber(a.date)-assessmentDayNumber(b.date) ||
  String(a.time||"").localeCompare(String(b.time||"")) ||
  String(a.name||"").localeCompare(String(b.name||""));

function ExamCountdownModal({ exams, subjects, editIndex=null, onSave, onClose }) {
  const isNew=editIndex===null || editIndex<0 || !exams[editIndex];
  const original=isNew
    ? {id:newAssessmentId(),name:"",subject:"",date:"",type:"",time:"",location:"",notes:"",reminder:false}
    : {...exams[editIndex],id:exams[editIndex].id||newAssessmentId()};
  const [draft,setDraft]=useState(original);
  const [more,setMore]=useState(Boolean(original.type||original.time||original.location||original.notes||original.reminder));
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const titleId=useId();
  const subjectListId=useId();
  const update=(key,value)=>setDraft(d=>({...d,[key]:value,...(key==="reminder"&&value?{reminderDismissed:false}:{})}));

  useEffect(()=>{
    const onKey=e=>{if(e.key==="Escape")onClose();};
    document.addEventListener("keydown",onKey);
    return()=>document.removeEventListener("keydown",onKey);
  },[onClose]);

  const save=async e=>{
    e.preventDefault();
    const name=String(draft.name||"").trim();
    if(!name||!draft.date){setError("Add an assessment name and date.");return;}
    setSaving(true);setError("");
    const clean={...draft,name,subject:String(draft.subject||"").trim(),location:String(draft.location||"").trim(),notes:String(draft.notes||"").trim()};
    const next=isNew ? [...exams,clean] : exams.map((x,i)=>i===editIndex?clean:x);
    const ok=await onSave(next);
    setSaving(false);
    if(ok===false){setError("Couldn’t save this assessment. Check your connection and try again.");return;}
    onClose();
  };
  const remove=async()=>{
    if(isNew||!window.confirm(`Delete “${draft.name||"this assessment"}”?`))return;
    setSaving(true);setError("");
    const ok=await onSave(exams.filter((_,i)=>i!==editIndex));
    setSaving(false);
    if(ok===false){setError("Couldn’t delete this assessment. Try again.");return;}
    onClose();
  };

  return (
    <div style={ec.overlay} className="sg-overlay-anim" onClick={onClose}>
      <form style={ec.modal} className="sg-pop-anim sg-assessment-editor" onSubmit={save}
        onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div style={ec.header}>
          <div>
            <div style={ec.kicker}>UPCOMING ASSESSMENTS</div>
            <h3 id={titleId} style={ec.title}>{isNew?"Add assessment":"Edit assessment"}</h3>
          </div>
          <button type="button" style={ec.closeBtn} onClick={onClose} aria-label="Close assessment editor">×</button>
        </div>

        <label style={ec.label}>
          Assessment name
          <input autoFocus style={ec.input} placeholder="e.g. Chemistry SAC" value={draft.name||""}
            onChange={e=>update("name",e.target.value)} maxLength={80}/>
        </label>
        <div style={ec.essentialGrid} className="sg-assessment-essential">
          <label style={ec.label}>
            Subject
            <input style={ec.input} list={subjectListId} placeholder="e.g. Chemistry" value={draft.subject||""}
              onChange={e=>update("subject",e.target.value)} maxLength={40}/>
            <datalist id={subjectListId}>{subjects.map(s=><option key={s.id} value={s.label}/>)}</datalist>
          </label>
          <label style={ec.label}>
            Date
            <input style={ec.input} type="date" value={draft.date||""} onChange={e=>update("date",e.target.value)}/>
          </label>
        </div>

        <button type="button" style={ec.moreBtn} onClick={()=>setMore(v=>!v)} aria-expanded={more}>
          <span>{more?"Hide details":"More details"}</span>
          <span style={{...ec.moreChevron,transform:more?"rotate(180deg)":"none"}}>⌄</span>
        </button>
        {more&&(
          <div style={ec.details} className="sg-view-anim">
            <div style={ec.essentialGrid} className="sg-assessment-essential">
              <label style={ec.label}>
                Type
                <select style={ec.input} value={draft.type||""} onChange={e=>update("type",e.target.value)}>
                  <option value="">Not set</option>
                  {ASSESSMENT_TYPES.map(type=><option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              <label style={ec.label}>
                Start time
                <input style={ec.input} type="time" value={draft.time||""} onChange={e=>update("time",e.target.value)}/>
              </label>
            </div>
            <label style={ec.label}>
              Location
              <input style={ec.input} placeholder="Optional" value={draft.location||""}
                onChange={e=>update("location",e.target.value)} maxLength={60}/>
            </label>
            <label style={ec.label}>
              Notes
              <textarea style={{...ec.input,...ec.textarea}} placeholder="Short preparation note" value={draft.notes||""}
                onChange={e=>update("notes",e.target.value)} maxLength={180}/>
            </label>
            <label style={ec.reminderRow}>
              <input type="checkbox" checked={Boolean(draft.reminder)} onChange={e=>update("reminder",e.target.checked)}/>
              <span><b>Approaching reminder</b><small>Show once when this assessment is three days away.</small></span>
            </label>
          </div>
        )}

        {error&&<div style={ec.error} role="alert">{error}</div>}
        <div style={ec.actions}>
          {!isNew&&<button type="button" style={ec.deleteBtn} onClick={remove} disabled={saving}>Delete</button>}
          <span style={{flex:1}}/>
          <button type="button" style={ec.cancelBtn} onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" style={ec.saveBtn} disabled={saving}>{saving?"Saving…":"Save"}</button>
        </div>
      </form>
    </div>
  );
}

const ec = {
  overlay:{position:"fixed",inset:0,background:"rgba(18,32,23,.44)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:16},
  modal:{background:"#fff",borderRadius:20,padding:"20px 18px",width:"100%",maxWidth:390,boxShadow:"0 12px 36px rgba(25,45,32,.2)",maxHeight:"min(86vh,720px)",overflowY:"auto"},
  header:{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:16},
  kicker:{fontSize:9,fontWeight:800,color:"#7AA56B",letterSpacing:"1.1px",marginBottom:2},
  title:{fontSize:19,fontWeight:800,color:"#1A2E22",margin:0,letterSpacing:"-.35px"},
  closeBtn:{width:30,height:30,border:"none",borderRadius:"50%",background:"#EEF2EC",color:"#718077",fontSize:20,cursor:"pointer",lineHeight:1},
  label:{display:"flex",flexDirection:"column",gap:5,fontSize:11,fontWeight:700,color:"#69756D",marginBottom:11,minWidth:0},
  input:{display:"block",width:"100%",minWidth:0,padding:"10px 11px",border:"1.5px solid #DDE6DA",borderRadius:11,fontSize:13,color:"#26362C",background:"#fff",outline:"none",fontFamily:"inherit"},
  essentialGrid:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:9},
  moreBtn:{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",border:"none",background:"#F5F8F3",borderRadius:11,padding:"9px 11px",fontSize:11.5,fontWeight:700,color:"#627269",cursor:"pointer",marginTop:1},
  moreChevron:{fontSize:14,color:"#89968E",transition:"transform .2s ease"},
  details:{borderTop:"1px solid #EDF1EA",paddingTop:12,marginTop:12},
  textarea:{resize:"vertical",minHeight:66,lineHeight:1.4},
  reminderRow:{display:"flex",alignItems:"flex-start",gap:9,padding:"10px 11px",background:"#F4F8F2",borderRadius:11,fontSize:11.5,color:"#506057",cursor:"pointer"},
  error:{fontSize:11.5,color:"#A14F46",background:"#FBEDEA",border:"1px solid #F0D7D1",borderRadius:10,padding:"8px 10px",marginTop:10},
  actions:{display:"flex",alignItems:"center",gap:7,marginTop:17},
  deleteBtn:{padding:"9px 10px",background:"#FAECE9",border:"none",borderRadius:10,fontSize:11.5,fontWeight:700,color:"#A4574C",cursor:"pointer"},
  cancelBtn:{padding:"10px 12px",background:"#F1F4F0",border:"none",borderRadius:11,fontSize:12.5,fontWeight:700,color:"#657168",cursor:"pointer"},
  saveBtn:{padding:"10px 17px",background:"#2D6A4F",border:"none",borderRadius:11,fontSize:12.5,fontWeight:750,color:"#fff",cursor:"pointer"},
};

function ChecklistCard({tasks,loading,error,subjects,selectedTaskId,onSelect,onCreate,onUpdate,onDelete}){
  const [expanded,setExpanded]=useState(false);
  const [showCompleted,setShowCompleted]=useState(false);
  const [adding,setAdding]=useState(false);
  const [draft,setDraft]=useState({title:"",subject:"",dueDate:""});
  const [editing,setEditing]=useState(null);
  const [editDraft,setEditDraft]=useState({title:"",subject:"",dueDate:""});
  const [busy,setBusy]=useState("");
  const [localError,setLocalError]=useState("");
  const activeTasks=tasks.filter(task=>!task.completed);
  const visible=showCompleted?tasks:activeTasks;
  const selected=tasks.find(task=>task.id===selectedTaskId&&!task.completed);
  const run=async(key,action)=>{
    if(busy)return null;
    setBusy(key);setLocalError("");
    try{
      const result=await action();
      if(!result?.ok)setLocalError(result?.error||"That change couldn't be saved.");
      return result;
    }catch(e){
      setLocalError(e.message||"That change couldn't be saved.");
      return null;
    }finally{setBusy("");}
  };
  const add=async event=>{
    event.preventDefault();
    const result=await run("add",()=>onCreate(draft));
    if(result?.ok){setDraft({title:"",subject:"",dueDate:""});setAdding(false);setExpanded(true);}
  };
  const beginEdit=task=>{
    setEditing(task.id);
    setEditDraft({title:task.title,subject:task.subject||"",dueDate:task.dueDate||""});
  };
  const saveEdit=async task=>{
    const result=await run(task.id,()=>onUpdate(task.id,editDraft));
    if(result?.ok)setEditing(null);
  };
  return <section className="sg-task-card" style={taskStyles.card} aria-labelledby="study-task-heading">
    <button type="button" style={taskStyles.header} onClick={()=>setExpanded(value=>!value)}
      aria-expanded={expanded} aria-controls="study-task-list">
      <span style={taskStyles.headerTitle}>
        <span aria-hidden="true">✓</span>
        <span id="study-task-heading">Study tasks</span>
      </span>
      <span style={taskStyles.summary}>{loading?"Loading…":`${activeTasks.length} open`}</span>
      <span aria-hidden="true" style={{...taskStyles.chevron,transform:expanded?"rotate(180deg)":"none"}}>⌄</span>
    </button>
    {!expanded&&selected&&<div style={taskStyles.selectedSummary} title={selected.title}>Next · {selected.title}</div>}
    {expanded&&<div id="study-task-list" style={taskStyles.body}>
      {(error||localError)&&<div role="status" style={taskStyles.error}>{localError||error}</div>}
      <div style={taskStyles.toolbar}>
        <button type="button" style={taskStyles.addButton} onClick={()=>setAdding(value=>!value)} aria-expanded={adding}>＋ Add task</button>
        {!!tasks.some(task=>task.completed)&&<button type="button" style={taskStyles.showButton}
          onClick={()=>setShowCompleted(value=>!value)}>{showCompleted?"Hide completed":"Show completed"}</button>}
      </div>
      {adding&&<form onSubmit={add} style={taskStyles.form}>
        <div className="sg-task-edit">
          <input value={draft.title} maxLength={180} autoFocus placeholder="What do you need to study?"
            aria-label="Task title" onChange={event=>setDraft({...draft,title:event.target.value})}/>
          <select value={draft.subject} aria-label="Task subject" onChange={event=>setDraft({...draft,subject:event.target.value})}>
            <option value="">No subject</option>
            {subjects.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <input className="sg-task-due" type="date" value={draft.dueDate} aria-label="Task due date"
            onChange={event=>setDraft({...draft,dueDate:event.target.value})}/>
        </div>
        <div className="sg-task-actions">
          <button type="button" style={taskStyles.secondary} onClick={()=>setAdding(false)}>Cancel</button>
          <button type="submit" style={taskStyles.primary} disabled={busy==="add"||!cleanTaskTitle(draft.title)}>
            {busy==="add"?"Saving…":"Add"}
          </button>
        </div>
      </form>}
      {!loading&&!visible.length&&!adding&&<div style={taskStyles.empty}>
        {tasks.length?"Completed tasks are hidden.":"Add one small task for your next study block."}
      </div>}
      <div>
        {visible.map(task=>{
          const subject=subjects.find(item=>item.id===task.subject);
          const isSelected=task.id===selectedTaskId&&!task.completed;
          return <div key={task.id} className="sg-task-row">
            <button type="button" className="sg-task-check" data-checked={task.completed} aria-label={task.completed?`Mark ${task.title} incomplete`:`Mark ${task.title} complete`}
              disabled={busy===task.id} onClick={()=>run(task.id,()=>onUpdate(task.id,{completed:!task.completed}))}>
              {task.completed?"✓":""}
            </button>
            <div style={{minWidth:0}}>
              {editing===task.id?<div>
                <div className="sg-task-edit">
                  <input value={editDraft.title} maxLength={180} aria-label="Edit task title"
                    onChange={event=>setEditDraft({...editDraft,title:event.target.value})}/>
                  <select value={editDraft.subject} aria-label="Edit task subject"
                    onChange={event=>setEditDraft({...editDraft,subject:event.target.value})}>
                    <option value="">No subject</option>
                    {subjects.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                  <input className="sg-task-due" type="date" value={editDraft.dueDate} aria-label="Edit task due date"
                    onChange={event=>setEditDraft({...editDraft,dueDate:event.target.value})}/>
                </div>
                <div className="sg-task-actions">
                  <button type="button" style={taskStyles.secondary} onClick={()=>setEditing(null)}>Cancel</button>
                  <button type="button" style={taskStyles.primary} disabled={!cleanTaskTitle(editDraft.title)||busy===task.id}
                    onClick={()=>saveEdit(task)}>{busy===task.id?"Saving…":"Save"}</button>
                </div>
              </div>:<>
                <div className="sg-task-title" data-complete={task.completed}>{task.title}</div>
                {(subject||task.dueDate)&&<div style={taskStyles.meta}>
                  {subject&&<span><span style={{...taskStyles.dot,background:subject.color}}/>{subject.label}</span>}
                  {task.dueDate&&<span>Due {formatAssessmentDate(task.dueDate,true)}</span>}
                </div>}
              </>}
            </div>
            <button type="button" className="sg-task-icon" aria-pressed={isSelected}
              aria-label={isSelected?`Remove ${task.title} from the next focus session`:`Use ${task.title} in the next focus session`}
              title={isSelected?"Selected for focus":"Use in next focus"}
              disabled={task.completed||busy===task.id} onClick={()=>onSelect(isSelected?"":task.id)}>◎</button>
            <button type="button" className="sg-task-icon" aria-label={`Edit ${task.title}`}
              disabled={busy===task.id} onClick={()=>editing===task.id
                ? (window.confirm(`Delete “${task.title}”?`)&&run(task.id,()=>onDelete(task.id)))
                : beginEdit(task)}>{editing===task.id?"🗑":"✎"}</button>
          </div>;
        })}
      </div>
    </div>}
  </section>;
}

const taskStyles={
  card:{background:"rgba(255,255,255,.82)",border:"1px solid #E2E9DF",borderRadius:15,marginBottom:11,boxShadow:"0 2px 8px rgba(38,69,45,.04)",overflow:"hidden"},
  header:{width:"100%",minHeight:48,display:"grid",gridTemplateColumns:"minmax(0,1fr) auto 18px",alignItems:"center",gap:8,border:0,background:"transparent",padding:"9px 12px",cursor:"pointer",textAlign:"left"},
  headerTitle:{display:"flex",alignItems:"center",gap:8,color:"#365946",fontSize:12.5,fontWeight:750,minWidth:0},
  summary:{fontSize:10.5,color:"#8C968D",fontWeight:650,whiteSpace:"nowrap"},
  chevron:{color:"#859087",fontSize:15,transition:"transform .18s ease"},
  selectedSummary:{fontSize:10.5,color:"#708078",padding:"0 12px 10px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},
  body:{padding:"0 12px 11px"},
  toolbar:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,padding:"3px 0 7px"},
  addButton:{minHeight:36,border:"1px solid #CFE0CF",borderRadius:11,background:"#F2F8F2",color:"#2D6A4F",padding:"7px 11px",fontSize:11.5,fontWeight:750,cursor:"pointer"},
  showButton:{minHeight:36,border:0,borderRadius:10,background:"transparent",color:"#7F8980",padding:"7px 8px",fontSize:10.5,fontWeight:650,cursor:"pointer"},
  form:{padding:"2px 0 9px",borderBottom:"1px solid #EDF1EB"},
  primary:{background:"#2D6A4F",color:"#fff"},
  secondary:{background:"#EEF2ED",color:"#69756C"},
  meta:{display:"flex",flexWrap:"wrap",gap:"4px 9px",marginTop:3,fontSize:9.5,color:"#98A098"},
  dot:{display:"inline-block",width:6,height:6,borderRadius:"50%",marginRight:4},
  empty:{padding:"13px 4px 8px",textAlign:"center",fontSize:11.5,color:"#9AA29A",lineHeight:1.4},
  error:{fontSize:11,color:"#A34C42",background:"#FFF2EF",border:"1px solid #F3D4CE",borderRadius:9,padding:"7px 9px",marginBottom:7},
};

// ── Accepted-friend presence strip ────────────────────────────────────────────
function StudyingNow({ presence, currentUser, compact=false }) {
  const [chipRowRef, chipEdge] = useHScroll();
  const others = presence.filter(p=>p.username!==currentUser);
  if(!others.length) return null;
  const studyingCount=others.filter(p=>p.status==="studying").length;
  const summary=studyingCount
    ? `${others.length} friend${others.length===1?"":"s"} online · ${studyingCount} studying`
    : `${others.length} friend${others.length===1?"":"s"} online`;
  if(compact){
    return (
      <div style={sn.compactWrap}>
        <div style={sn.compactHeader}>
          <span style={sn.pulse}/>
          <span style={sn.compactLabel}>{summary}</span>
        </div>
        <div style={sn.compactRowWrap}>
          <div style={sn.compactRow} ref={chipRowRef}>
            {others.map(p=>(
              <span key={p.username} style={{...sn.compactChip,borderColor:p.status==="studying"?(p.subjColor||"#56B68B"):"#C8D0CA"}}
                title={p.status==="studying"?`Studying ${p.subjLabel}`:"Online"}>
                <span>{p.status==="studying"?(p.subjEmoji||"📚"):"●"}</span>
                <span style={sn.compactChipName}>{p.username}</span>
              </span>
            ))}
          </div>
          {!chipEdge.atStart && <div style={sn.compactFadeL}/>}
          {!chipEdge.atEnd && <div style={sn.compactFadeR}/>}
        </div>
      </div>
    );
  }
  return (
    <div style={sn.wrap}>
      <span style={sn.pulse}/>
      <span style={sn.label}>{summary}</span>
      <div style={sn.avatars}>
        {others.slice(0,6).map(p=>(
          <span key={p.username} style={{...sn.chip,borderColor:p.status==="studying"?(p.subjColor||"#56B68B"):"#C8D0CA"}}
            title={p.status==="studying"?`${p.username} · studying ${p.subjLabel}`:`${p.username} · online`}>
            <span style={{color:p.status==="studying"?"inherit":"#8FA098"}}>{p.status==="studying"?(p.subjEmoji||"📚"):"●"}</span>
            <span style={sn.chipName}>{p.username}</span>
          </span>
        ))}
        {others.length>6 && <span style={sn.more}>+{others.length-6}</span>}
      </div>
    </div>
  );
}
const sn = {
  wrap:{display:"flex",alignItems:"center",gap:8,background:"#fff",borderRadius:14,padding:"10px 12px",marginBottom:12,boxShadow:"0 1px 3px rgba(0,0,0,0.05)",flexWrap:"wrap"},
  pulse:{width:8,height:8,borderRadius:"50%",background:"#34C759",boxShadow:"0 0 0 0 rgba(52,199,89,0.5)",animation:"sgpulse 1.8s infinite",flexShrink:0},
  label:{fontSize:12,fontWeight:700,color:"#34A853"},
  avatars:{display:"flex",gap:5,flexWrap:"wrap",flex:1},
  chip:{display:"inline-flex",alignItems:"center",gap:4,border:"1.5px solid",borderRadius:14,padding:"3px 8px",fontSize:11,background:"#F8FBF8"},
  chipName:{fontWeight:600,color:"#555",maxWidth:70,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},
  more:{fontSize:11,color:"#888",alignSelf:"center"},
  // Presence card for the immersive focus screen — frosted glass to match the
  // subject/coin chips already floating on that gradient background. Full
  // named chips laid out with real spacing; the row scrolls (mouse wheel
  // included, via useHScroll) if there are more people than fit on screen.
  compactWrap:{width:"100%",maxWidth:380,boxSizing:"border-box",alignSelf:"center",background:"rgba(255,255,255,0.88)",backdropFilter:"blur(6px)",borderRadius:18,padding:"12px 14px",marginTop:12,boxShadow:"0 2px 10px rgba(0,0,0,0.06)"},
  compactHeader:{display:"flex",alignItems:"center",gap:7,marginBottom:9},
  compactLabel:{fontSize:12.5,fontWeight:700,color:"#34A853"},
  compactRowWrap:{position:"relative"},
  compactRow:{display:"flex",gap:8,overflowX:"auto",scrollbarWidth:"none",cursor:"grab"},
  compactChip:{display:"inline-flex",alignItems:"center",gap:6,flexShrink:0,border:"1.5px solid",borderRadius:16,padding:"6px 11px",fontSize:12.5,background:"#fff",whiteSpace:"nowrap"},
  compactChipName:{fontWeight:600,color:"#3A3A3A"},
  compactFadeL:{position:"absolute",left:0,top:0,bottom:0,width:20,background:"linear-gradient(to right,rgba(255,255,255,0.88),rgba(255,255,255,0))",pointerEvents:"none"},
  compactFadeR:{position:"absolute",right:0,top:0,bottom:0,width:20,background:"linear-gradient(to left,rgba(255,255,255,0.88),rgba(255,255,255,0))",pointerEvents:"none"},
};

// ── Weekly Targets Modal (hours per subject) ──────────────────────────────────
function WeeklyTargetsModal({ subjects, targets, onSave, onClose }) {
  const [vals, setVals] = useState(()=>{
    const o = {}; subjects.forEach(s=>{ o[s.id] = targets[s.id]>0 ? String(targets[s.id]) : ""; }); return o;
  });
  const set = (id,v) => { if(/^\d{0,2}(\.\d?)?$/.test(v)) setVals(p=>({...p,[id]:v})); };
  const save = () => {
    const out = {};
    subjects.forEach(s=>{ const n=parseFloat(vals[s.id]); if(n>0) out[s.id]=n; });
    onSave(out); onClose();
  };
  const totalH = subjects.reduce((a,s)=>a+(parseFloat(vals[s.id])||0),0);
  return (
    <div style={wt.overlay} className="sg-overlay-anim" onClick={onClose}>
      <div style={wt.modal} className="sg-pop-anim" onClick={e=>e.stopPropagation()}>
        <h3 style={wt.title}>🎯 Weekly Targets</h3>
        <p style={wt.sub}>Set focus hours per subject each week. Great for balancing a multi-subject VCE load.</p>
        {subjects.map(s=>(
          <div key={s.id} style={wt.row}>
            <span style={{...wt.dot,background:s.color}}/>
            <span style={wt.emoji}>{s.emoji}</span>
            <span style={wt.name}>{s.label}</span>
            <input style={wt.input} inputMode="decimal" placeholder="0" value={vals[s.id]}
              onChange={e=>set(s.id,e.target.value)}/>
            <span style={wt.unit}>h/wk</span>
          </div>
        ))}
        <div style={wt.totalRow}>Total: <b>{totalH ? totalH.toFixed(totalH%1?1:0) : 0}h</b> / week</div>
        <div style={{display:"flex",gap:8,marginTop:18}}>
          <button style={wt.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={wt.saveBtn} onClick={save}>Save targets</button>
        </div>
      </div>
    </div>
  );
}
const wt = {
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:20},
  modal:{background:"#fff",borderRadius:20,padding:"24px 20px",width:"100%",maxWidth:360,boxShadow:"0 8px 32px rgba(0,0,0,0.18)",maxHeight:"82vh",overflowY:"auto"},
  title:{fontSize:18,fontWeight:700,color:"#1a1a2e",margin:"0 0 4px"},
  sub:{fontSize:12,color:"#aaa",margin:"0 0 16px",lineHeight:1.5},
  row:{display:"flex",alignItems:"center",gap:8,marginBottom:10},
  dot:{width:9,height:9,borderRadius:"50%",flexShrink:0},
  emoji:{fontSize:16},
  name:{flex:1,fontSize:14,fontWeight:500,color:"#333"},
  input:{width:54,padding:"7px 8px",border:"1.5px solid #E0E8DC",borderRadius:10,fontSize:14,outline:"none",textAlign:"center"},
  unit:{fontSize:11,color:"#aaa",width:34},
  totalRow:{fontSize:13,color:"#666",marginTop:8,textAlign:"right"},
  cancelBtn:{flex:1,padding:"11px 0",background:"#f5f5f5",border:"none",borderRadius:12,fontSize:14,fontWeight:600,color:"#666",cursor:"pointer"},
  saveBtn:{flex:2,padding:"11px 0",background:"#2D6A4F",border:"none",borderRadius:12,fontSize:14,fontWeight:700,color:"#fff",cursor:"pointer"},
};

// ── Expandable upcoming assessments ──────────────────────────────────────────
function AssessmentRow({ item, dayCount, onEdit }) {
  const urgency=assessmentUrgency(item.days);
  return (
    <div style={eb.row}>
      <span style={{...eb.subjectMarker,background:item.subjectMeta.color}} aria-hidden="true"/>
      <div style={eb.rowMain}>
        <div className="sg-assessment-name" style={eb.rowName}>{item.name}</div>
        <div style={eb.rowSubject}>
          <span>{item.subjectMeta.emoji} {item.subjectMeta.label}</span>
          {item.type&&<><span aria-hidden="true">·</span><span>{item.type}</span></>}
          {dayCount>1&&<span style={eb.sameDayTag} title={`${dayCount} assessments on this day`}>{dayCount} same day</span>}
        </div>
        {(item.location||item.notes)&&(
          <div style={eb.rowExtra} title={[item.location,item.notes].filter(Boolean).join(" · ")}>
            {[item.location&&`⌖ ${item.location}`,item.notes].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>
      <div style={eb.rowWhen}>
        <span style={eb.rowDate}>{formatAssessmentDate(item.date)}{item.time?` · ${item.time}`:""}</span>
        <span style={{...eb.rowDays,color:item.days>=0?urgency:"#929C95"}}>{assessmentDaysLabel(item.days)}</span>
      </div>
      <button type="button" style={eb.rowEdit} onClick={()=>onEdit(item.sourceIndex)}
        aria-label={`Edit ${item.name}`} title="Edit assessment">✎</button>
    </div>
  );
}

function ExamBanner({ exams, subjects, loading=false, error="", onEdit, onAdd, onChange }) {
  const [open,setOpen]=useState(false);
  const [selectedDate,setSelectedDate]=useState("");
  const [viewAll,setViewAll]=useState(false);
  const [archiveOpen,setArchiveOpen]=useState(false);
  const rootRef=useRef(null);
  const panelId=useId();
  const now=new Date();
  const todayNumber=assessmentDayNumber(assessmentDateKey(now));

  const records=useMemo(()=>exams.map((exam,sourceIndex)=>{
    const dayNumber=assessmentDayNumber(exam.date);
    return {...exam,sourceIndex,dayNumber,days:dayNumber-todayNumber,
      key:exam.id||`legacy-${sourceIndex}-${exam.name||""}-${exam.date||""}`,
      subjectMeta:resolveAssessmentSubject(exam,subjects)};
  }),[exams,subjects,todayNumber]);
  const valid=records.filter(item=>Number.isFinite(item.dayNumber));
  const upcoming=valid.filter(item=>item.days>=0&&!item.completed).sort(assessmentSort);
  const completed=valid.filter(item=>item.days<0||item.completed).sort((a,b)=>assessmentSort(b,a));
  const invalid=records.filter(item=>!Number.isFinite(item.dayNumber));
  const nearest=upcoming[0]||null;
  const dateCounts=useMemo(()=>{
    const counts={};
    valid.forEach(item=>{const key=assessmentDateKey(item.date);counts[key]=(counts[key]||0)+1;});
    return counts;
  },[valid]);

  const weekDays=useMemo(()=>Array.from({length:7},(_,i)=>{
    const date=new Date(now.getFullYear(),now.getMonth(),now.getDate()+i,12);
    const key=assessmentDateKey(date);
    return {date,key,items:upcoming.filter(item=>assessmentDateKey(item.date)===key)};
  // The calendar strip intentionally rolls over only when the local day changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }),[todayNumber,exams,subjects]);

  useEffect(()=>{
    if(!open)return;
    const onOutside=e=>{if(rootRef.current&&!rootRef.current.contains(e.target))setOpen(false);};
    const onKey=e=>{if(e.key==="Escape")setOpen(false);};
    document.addEventListener("pointerdown",onOutside);
    document.addEventListener("keydown",onKey);
    return()=>{document.removeEventListener("pointerdown",onOutside);document.removeEventListener("keydown",onKey);};
  },[open]);

  const selectedItems=selectedDate ? upcoming.filter(item=>assessmentDateKey(item.date)===selectedDate) : upcoming;
  const visibleItems=selectedDate||viewAll ? selectedItems : selectedItems.slice(0,5);
  const nextSeven=visibleItems.filter(item=>item.days<=7);
  const later=visibleItems.filter(item=>item.days>7);
  const dueReminder=upcoming.find(item=>item.reminder&&!item.reminderDismissed&&item.days<=3);
  const duplicateDay=Object.entries(dateCounts).find(([,count])=>count>1);
  let clusterMessage="";
  if(duplicateDay){
    clusterMessage=`${duplicateDay[1]} assessments fall on ${formatAssessmentDate(duplicateDay[0],true)}.`;
  }else{
    for(let i=1;i<Math.min(upcoming.length,6);i++){
      const gap=upcoming[i].dayNumber-upcoming[i-1].dayNumber;
      if(gap<=2){clusterMessage="Busy stretch · two assessments are close together.";break;}
    }
  }
  const urgency=nearest?assessmentUrgency(nearest.days):"#7AA56B";

  const dismissReminder=async()=>{
    if(!dueReminder)return;
    await onChange(exams.map((exam,i)=>i===dueReminder.sourceIndex?{...exam,reminderDismissed:true}:exam));
  };
  const renderSection=(label,items)=>{
    if(!items.length)return null;
    return (
      <section style={eb.section} aria-label={label}>
        <div style={eb.sectionTitle}>{label}</div>
        <div style={eb.list}>
          {items.map(item=><AssessmentRow key={item.key} item={item}
            dayCount={dateCounts[assessmentDateKey(item.date)]||1} onEdit={onEdit}/>)}
        </div>
      </section>
    );
  };

  if(loading)return (
    <div style={eb.loadingCard} aria-label="Loading upcoming assessments" aria-busy="true">
      <span className="sg-skeleton" style={eb.loadingIcon}/>
      <span style={{flex:1}}>
        <span className="sg-skeleton" style={eb.loadingLine}/>
        <span className="sg-skeleton" style={{...eb.loadingLine,width:"48%",marginTop:6}}/>
      </span>
    </div>
  );

  return (
    <div ref={rootRef} className="sg-assessment-card" style={{...eb.card,borderColor:nearest?`${urgency}55`:"#DDE6DA"}}>
      <div style={eb.summaryWrap}>
        <button type="button" style={{...eb.summary,background:nearest?`${urgency}0C`:"#F9FBF8"}}
          onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-controls={panelId}>
          <span style={{...eb.calendarIcon,color:urgency}} aria-hidden="true">▦</span>
          <span style={eb.summaryText}>
            <span className="sg-assessment-name" style={eb.summaryName}>{nearest?nearest.name:"Upcoming assessments"}</span>
            <span style={eb.summaryMeta}>
              {nearest
                ? `${nearest.subjectMeta.label} · ${formatAssessmentDate(nearest.date,true)}${nearest.time?` · ${nearest.time}`:""}`
                : "Nothing scheduled"}
            </span>
          </span>
          {nearest&&<span style={{...eb.summaryDays,color:urgency}}>{assessmentDaysLabel(nearest.days)}</span>}
          {upcoming.length>1&&<span style={eb.more}>+{upcoming.length-1} more</span>}
          <span className={`sg-assessment-chevron${open?" sg-assessment-chevron--open":""}`}
            style={eb.chevron} aria-hidden="true">⌄</span>
        </button>
        {nearest&&(
          <button type="button" style={eb.summaryEdit} onClick={()=>onEdit(nearest.sourceIndex)}
            aria-label={`Edit ${nearest.name}`} title="Edit assessment">✎</button>
        )}
      </div>

      <div id={panelId} className={`sg-assessment-panel${open?" sg-assessment-panel--open":""}`}
        aria-hidden={!open}>
        <div className="sg-assessment-panel-inner">
          <div style={eb.panel}>
            <div style={eb.weekHeader}>
              <span style={eb.weekTitle}>Next seven days</span>
              {selectedDate&&<button type="button" style={eb.clearDay} onClick={()=>setSelectedDate("")}>Clear filter</button>}
            </div>
            <div className="sg-assessment-week" style={eb.week} aria-label="Seven-day assessment overview">
              {weekDays.map((day,index)=>{
                const active=selectedDate===day.key;
                return (
                  <button type="button" key={day.key} style={{...eb.day,...(active?eb.dayActive:{})}}
                    onClick={()=>setSelectedDate(active?"":day.key)} aria-pressed={active}
                    aria-label={`${formatAssessmentDate(day.key)}${day.items.length?`, ${day.items.length} assessment${day.items.length===1?"":"s"}`:", no assessments"}`}>
                    <span style={eb.dayName}>{index===0?"TODAY":day.date.toLocaleDateString("en-AU",{weekday:"narrow"})}</span>
                    <span style={eb.dayNumber}>{day.date.getDate()}</span>
                    <span style={eb.dayDots}>
                      {day.items.slice(0,3).map(item=><span key={item.key} style={{...eb.dayDot,background:item.subjectMeta.color}}/>)}
                    </span>
                  </button>
                );
              })}
            </div>

            {dueReminder&&(
              <div style={eb.reminder} role="status">
                <span aria-hidden="true">◷</span>
                <span style={eb.reminderText}><b>{dueReminder.name}</b> is {assessmentDaysLabel(dueReminder.days).toLowerCase()}.</span>
                <button type="button" style={eb.dismissReminder} onClick={dismissReminder} aria-label="Dismiss this reminder">×</button>
              </div>
            )}
            {clusterMessage&&<div style={eb.cluster} role="note"><span aria-hidden="true">◇</span>{clusterMessage}</div>}
            {error&&<div style={eb.error} role="alert">{error}</div>}
            {invalid.length>0&&(
              <div style={eb.error} role="alert">
                {invalid.length} assessment{invalid.length===1?" needs":"s need"} a valid date.
                <button type="button" style={eb.inlineEdit} onClick={()=>onEdit(invalid[0].sourceIndex)}>Edit</button>
              </div>
            )}

            {!selectedItems.length?(
              <div style={eb.emptyState}>
                <span style={eb.emptyIcon}>🌿</span>
                <b>{selectedDate?"No assessments on this day":"Your calendar is clear"}</b>
                <span>{selectedDate?"Choose another day or clear the filter.":"Add an assessment when you’re ready."}</span>
              </div>
            ):(
              <>
                {renderSection("Next 7 days",nextSeven)}
                {renderSection("Later",later)}
              </>
            )}

            {completed.length>0&&(
              <section style={eb.archive}>
                <button type="button" style={eb.archiveButton} onClick={()=>setArchiveOpen(v=>!v)}
                  aria-expanded={archiveOpen}>
                  <span>Completed <small>({completed.length})</small></span>
                  <span style={{...eb.archiveChevron,transform:archiveOpen?"rotate(180deg)":"none"}}>⌄</span>
                </button>
                {archiveOpen&&<div style={eb.archiveList} className="sg-view-anim">
                  {completed.map(item=><AssessmentRow key={item.key} item={item}
                    dayCount={dateCounts[assessmentDateKey(item.date)]||1} onEdit={onEdit}/>)}
                </div>}
              </section>
            )}

            <div style={eb.footer}>
              <button type="button" style={eb.footerBtn} onClick={()=>setViewAll(v=>!v)}
                disabled={upcoming.length<=5&&!viewAll}>
                {viewAll?"Show next 5":"View all"}
              </button>
              <button type="button" style={eb.addBtn} onClick={onAdd}>＋ Add assessment</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const eb = {
  card:{background:"#fff",border:"1px solid",borderRadius:15,marginBottom:10,overflow:"hidden",boxShadow:"0 1px 3px rgba(30,55,37,.045)",minWidth:0},
  summaryWrap:{position:"relative",minWidth:0},
  summary:{display:"grid",gridTemplateColumns:"30px minmax(0,1fr) auto auto 18px",alignItems:"center",gap:8,width:"100%",minWidth:0,padding:"10px 43px 10px 12px",border:"none",background:"#fff",cursor:"pointer",textAlign:"left",color:"#26362C"},
  calendarIcon:{width:28,height:28,display:"grid",placeItems:"center",borderRadius:9,background:"rgba(255,255,255,.72)",fontSize:17,fontWeight:800},
  summaryText:{display:"flex",flexDirection:"column",gap:2,minWidth:0},
  summaryName:{fontSize:12.8,fontWeight:750,color:"#1C3023",lineHeight:1.25},
  summaryMeta:{fontSize:9.8,fontWeight:600,color:"#8B968E",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},
  summaryDays:{fontSize:10.8,fontWeight:800,whiteSpace:"nowrap"},
  more:{fontSize:9.5,fontWeight:700,color:"#89948C",background:"rgba(255,255,255,.7)",borderRadius:10,padding:"3px 6px",whiteSpace:"nowrap"},
  chevron:{fontSize:17,color:"#8C978F",lineHeight:1,display:"inline-block"},
  summaryEdit:{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",width:28,height:28,display:"grid",placeItems:"center",border:"1px solid #E1E8DF",borderRadius:9,background:"#fff",color:"#718078",fontSize:12,cursor:"pointer",zIndex:2},
  panel:{borderTop:"1px solid #EDF1EA",padding:"12px 11px 10px",background:"#FCFDFC",minWidth:0},
  weekHeader:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:7},
  weekTitle:{fontSize:9.5,fontWeight:800,color:"#7D8981",textTransform:"uppercase",letterSpacing:".65px"},
  clearDay:{border:"none",background:"none",padding:2,fontSize:9.5,fontWeight:700,color:"#4F8669",cursor:"pointer"},
  week:{background:"#F3F7F1",border:"1px solid #E5ECE2",borderRadius:11,padding:4,overflow:"hidden"},
  day:{minWidth:0,height:48,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1,border:"1px solid transparent",borderRadius:8,background:"transparent",color:"#748078",cursor:"pointer",padding:"3px 1px"},
  dayActive:{background:"#fff",borderColor:"#BFDAC8",color:"#2D6A4F",boxShadow:"0 1px 3px rgba(35,65,43,.08)"},
  dayName:{fontSize:7.5,fontWeight:800,letterSpacing:".2px",maxWidth:"100%",overflow:"hidden"},
  dayNumber:{fontSize:11.5,fontWeight:750,lineHeight:1},
  dayDots:{height:5,display:"flex",alignItems:"center",justifyContent:"center",gap:2},
  dayDot:{width:4,height:4,borderRadius:"50%"},
  reminder:{display:"grid",gridTemplateColumns:"18px minmax(0,1fr) 24px",alignItems:"center",gap:6,background:"#EEF7F0",border:"1px solid #D4E8D9",borderRadius:10,padding:"7px 7px 7px 9px",marginTop:9,fontSize:10.5,color:"#4C6654"},
  reminderText:{minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},
  dismissReminder:{width:23,height:23,border:"none",borderRadius:8,background:"rgba(255,255,255,.72)",color:"#738179",fontSize:15,cursor:"pointer",lineHeight:1},
  cluster:{display:"flex",alignItems:"center",gap:6,background:"#FFF8E8",border:"1px solid #F1E0B5",borderRadius:10,padding:"7px 9px",marginTop:8,fontSize:9.8,fontWeight:650,color:"#8B7338"},
  error:{display:"flex",alignItems:"center",gap:7,background:"#FFF5F2",border:"1px solid #EFD7D1",borderRadius:10,padding:"7px 9px",marginTop:8,fontSize:10,color:"#985A50"},
  inlineEdit:{marginLeft:"auto",border:"none",background:"none",color:"#8D5148",fontWeight:800,fontSize:10,cursor:"pointer"},
  section:{marginTop:11},
  sectionTitle:{fontSize:9,fontWeight:800,color:"#95A098",textTransform:"uppercase",letterSpacing:".65px",margin:"0 2px 5px"},
  list:{display:"flex",flexDirection:"column",gap:5},
  row:{display:"grid",gridTemplateColumns:"4px minmax(0,1fr) auto 28px",alignItems:"center",gap:8,background:"#fff",border:"1px solid #E8EDE6",borderRadius:11,padding:"8px 7px 8px 6px",minWidth:0},
  subjectMarker:{width:4,height:31,borderRadius:4},
  rowMain:{minWidth:0},
  rowName:{fontSize:11.5,fontWeight:750,color:"#293C30",lineHeight:1.22},
  rowSubject:{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap",fontSize:8.8,fontWeight:650,color:"#8C978F",marginTop:2},
  sameDayTag:{fontSize:7.8,fontWeight:800,color:"#967837",background:"#FFF4D6",borderRadius:7,padding:"2px 4px"},
  rowExtra:{fontSize:8.5,color:"#A0A8A2",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",marginTop:2,maxWidth:"100%"},
  rowWhen:{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2,maxWidth:108,minWidth:0},
  rowDate:{fontSize:8.6,fontWeight:650,color:"#7D8880",textAlign:"right",lineHeight:1.25},
  rowDays:{fontSize:9.8,fontWeight:800,whiteSpace:"nowrap"},
  rowEdit:{width:28,height:28,display:"grid",placeItems:"center",border:"none",borderRadius:9,background:"#F1F5EF",color:"#728078",fontSize:11,cursor:"pointer"},
  emptyState:{display:"flex",flexDirection:"column",alignItems:"center",gap:3,textAlign:"center",padding:"18px 10px 13px",fontSize:11.5,color:"#53635A"},
  emptyIcon:{fontSize:18,marginBottom:2},
  archive:{borderTop:"1px solid #E8EDE6",marginTop:11,paddingTop:7},
  archiveButton:{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",border:"none",background:"transparent",padding:"5px 3px",fontSize:10.5,fontWeight:750,color:"#7C8880",cursor:"pointer"},
  archiveChevron:{fontSize:14,transition:"transform .2s ease"},
  archiveList:{display:"flex",flexDirection:"column",gap:5,paddingTop:5},
  footer:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,borderTop:"1px solid #E8EDE6",marginTop:10,paddingTop:9},
  footerBtn:{border:"none",background:"transparent",padding:"6px 5px",fontSize:10.5,fontWeight:750,color:"#6F7D74",cursor:"pointer"},
  addBtn:{border:"1px solid #D4E2D1",background:"#F2F8F1",borderRadius:10,padding:"7px 10px",fontSize:10.5,fontWeight:750,color:"#3F7658",cursor:"pointer"},
  loadingCard:{display:"flex",alignItems:"center",gap:10,background:"#fff",border:"1px solid #E1E8DF",borderRadius:15,padding:"11px 12px",marginBottom:10},
  loadingIcon:{display:"block",width:30,height:30,borderRadius:9,flexShrink:0},
  loadingLine:{display:"block",height:8,width:"72%",borderRadius:6},
};

// ── Login Screen ──────────────────────────────────────────────────────────────
const RECOVERY_QUESTIONS = [
  "What was the name of your first pet?",
  "What primary school did you go to?",
  "What's your favourite subject?",
  "What city were you born in?",
  "What's your mother's maiden name?",
];

function LoginScreen({ onLogin }) {
  const [name,setName]=useState("");
  const [pass,setPass]=useState("");
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false);
  // Optional recovery setup (used only when creating a new account)
  const [showRecovery,setShowRecovery]=useState(false);
  const [recQ,setRecQ]=useState(RECOVERY_QUESTIONS[0]);
  const [recA,setRecA]=useState("");
  // Forgot-password flow
  const [mode,setMode]=useState("login"); // "login" | "forgot"
  const [fpStep,setFpStep]=useState(1);   // 1=enter username, 2=answer+newpass
  const [fpQuestion,setFpQuestion]=useState("");
  const [fpAnswer,setFpAnswer]=useState("");
  const [fpNewPass,setFpNewPass]=useState("");

  const go=async()=>{
    const t=name.trim();
    const emailLogin=isEmailLogin(t);
    if(!t){setErr("Enter a username or email");return;}
    if(!emailLogin&&t.length>20){setErr("Username can be at most 20 characters");return;}
    if(emailLogin&&t.length>254){setErr("Email address is too long");return;}
    if(!pass){setErr("Enter a password");return;}
    if(pass.length<6){setErr("Password must be at least 6 characters");return;}
    if(showRecovery && recA.trim() && recA.trim().length<2){setErr("Recovery answer is too short");return;}
    setLoading(true); setErr("");
    const recovery = (showRecovery && recA.trim()) ? { question:recQ, answer:recA } : null;
    const result = await fbSavePassword(t, pass, recovery);
    setLoading(false);
    if(!result.ok){setErr(result.error);return;}
    onLogin(result.username||t, pass);
  };

  // Step 1 of forgot: look up the user's recovery question
  const fpLookup=async()=>{
    const t=name.trim();
    if(!t){setErr("Enter your username");return;}
    setLoading(true); setErr("");
    const res=await fbGetRecoveryQuestion(t);
    setLoading(false);
    if(!res.ok){setErr(res.error);return;}
    setFpQuestion(res.question); setFpStep(2);
  };

  // Step 2 of forgot: verify answer + set new password
  const fpReset=async()=>{
    if(!fpAnswer.trim()){setErr("Enter your answer");return;}
    if(!fpNewPass||fpNewPass.length<6){setErr("New password must be at least 6 characters");return;}
    setLoading(true); setErr("");
    const res=await fbResetPassword(name.trim(), fpAnswer, fpNewPass);
    setLoading(false);
    if(!res.ok){setErr(res.error);return;}
    // Success — log straight in with the new password
    onLogin(name.trim(), fpNewPass);
  };

  const backToLogin=()=>{ setMode("login");setFpStep(1);setErr("");setFpAnswer("");setFpNewPass("");setFpQuestion(""); };

  if(mode==="forgot"){
    return (
      <div style={S.loginWrap}>
        <div style={S.loginCard}>
          <div style={{fontSize:48,marginBottom:6}}>🔑</div>
          <h1 style={S.loginTitle}>Reset password</h1>
          {fpStep===1 ? (
            <>
              <p style={S.loginSub}>Enter your username to find your recovery question.</p>
              <input style={{...S.input,...(err?S.inputErr:{})}} placeholder="Username"
                value={name} onChange={e=>{setName(e.target.value);setErr("");}}
                onKeyDown={e=>e.key==="Enter"&&fpLookup()} maxLength={21} autoFocus/>
              {err&&<p style={S.errText}>{err}</p>}
              <button style={{...S.primaryBtn,opacity:loading?0.6:1}} onClick={fpLookup} disabled={loading}>
                {loading?"Looking up...":"Continue"}
              </button>
            </>
          ) : (
            <>
              <p style={S.loginSub}>{fpQuestion}</p>
              <input style={{...S.input,...(err&&!fpAnswer?S.inputErr:{})}} placeholder="Your answer"
                value={fpAnswer} onChange={e=>{setFpAnswer(e.target.value);setErr("");}} maxLength={60} autoFocus/>
              <input style={{...S.input,...(err&&fpAnswer?S.inputErr:{})}} placeholder="New password" type="password"
                value={fpNewPass} onChange={e=>{setFpNewPass(e.target.value);setErr("");}}
                onKeyDown={e=>e.key==="Enter"&&fpReset()} maxLength={50}/>
              {err&&<p style={S.errText}>{err}</p>}
              <button style={{...S.primaryBtn,opacity:loading?0.6:1}} onClick={fpReset} disabled={loading}>
                {loading?"Resetting...":"Reset & log in"}
              </button>
            </>
          )}
          <button style={S.linkBtn} onClick={backToLogin}>← Back to login</button>
        </div>
      </div>
    );
  }

  return (
    <div style={S.loginWrap}>
      <div style={S.loginCard}>
        <div style={{fontSize:60,marginBottom:8}}>🧑‍🎓</div>
        <h1 style={S.loginTitle}>Lumora</h1>
        <p style={S.loginSub}>Grow your focus. Build your future.</p>
        <input style={{...S.input,...(err&&!pass?S.inputErr:{})}}
          placeholder="Username or email"
          aria-label="Username or email"
          autoCapitalize="none" autoComplete="username"
          value={name} onChange={e=>{setName(e.target.value);setErr("");}}
          onKeyDown={e=>e.key==="Enter"&&go()} maxLength={254} autoFocus/>
        <input style={{...S.input,...(err&&pass?S.inputErr:{})}}
          placeholder="Password"
          type="password"
          autoComplete="current-password"
          value={pass} onChange={e=>{setPass(e.target.value);setErr("");}}
          onKeyDown={e=>e.key==="Enter"&&go()} maxLength={50}/>

        {/* Recovery questions require the optional callable-functions backend. */}
        {AUTH_FUNCTIONS_ENABLED && (showRecovery ? (
          <div style={S.recBox}>
            <p style={S.recHint}>If you're making a new account, set this so you can reset your password later:</p>
            <select style={S.recSelect} value={recQ} onChange={e=>setRecQ(e.target.value)}>
              {RECOVERY_QUESTIONS.map(q=><option key={q} value={q}>{q}</option>)}
            </select>
            <input style={S.input} placeholder="Your answer" value={recA}
              onChange={e=>{setRecA(e.target.value);setErr("");}} maxLength={60}/>
          </div>
        ) : (
          <button style={S.linkBtn} onClick={()=>setShowRecovery(true)}>＋ Set a recovery question (new accounts)</button>
        ))}

        {err&&<p style={S.errText}>{err}</p>}
        <p style={S.loginHint}>New user? Pick a username and password.<br/>Returning? Log in with your username or connected email.</p>
        <button style={{...S.primaryBtn,opacity:loading?0.6:1}} onClick={go} disabled={loading}>
          {loading?"Checking...":"Enter Classroom"}
        </button>
        {AUTH_FUNCTIONS_ENABLED && <button style={S.linkBtn} onClick={()=>{setMode("forgot");setErr("");}}>Forgot password?</button>}
      </div>
    </div>
  );
}

// ── Bar Chart — stacked by subject, with tooltip breakdown ────────────────────
function BarChart({ bars, maxVal, color }) {
  const max = Math.max(maxVal, 1);
  const [tooltip, setTooltip] = useState(null); // {index, x, y}
  const tipBar = tooltip !== null ? bars[tooltip.index] : null;

  return (
    <div style={bc.wrap} data-barchart="1">
      {tipBar && tipBar.value > 0 && (
        <div style={{
          ...bc.tooltip,
          left: Math.min(Math.max(tooltip.x - 42, 4), "calc(100% - 96px)"),
          top: Math.max(tooltip.y - 48 - (tipBar.segments?.length || 0) * 15, 4),
        }}>
          <span style={bc.tooltipLabel}>{tipBar.tip || tipBar.label}</span>
          <span style={bc.tooltipVal}>{fmtMins(tipBar.value)}</span>
          {tipBar.segments?.map(seg=>(
            <span key={seg.id} style={bc.tooltipSeg}>
              <span style={{...bc.segDot,background:seg.color}}/>
              {seg.emoji} {seg.label} · {fmtMins(seg.value)}
            </span>
          ))}
        </div>
      )}
      <div style={{...bc.bars, gap: bars.length > 15 ? 2 : 4}}>
        {bars.map((b,i)=>(
          <div key={i} style={bc.barCol}
            onMouseEnter={e=>{ const r=e.currentTarget.getBoundingClientRect(); const wr=e.currentTarget.closest("[data-barchart]").getBoundingClientRect(); setTooltip({index:i,x:r.left-wr.left+r.width/2,y:r.top-wr.top}); }}
            onMouseLeave={()=>setTooltip(null)}
            onTouchStart={e=>{ e.preventDefault(); const r=e.currentTarget.getBoundingClientRect(); const wr=e.currentTarget.closest("[data-barchart]").getBoundingClientRect(); setTooltip({index:i,x:r.left-wr.left+r.width/2,y:r.top-wr.top}); }}
            onTouchEnd={()=>setTimeout(()=>setTooltip(null),1500)}>
            <div style={bc.barTrack}>
              <div style={{
                ...bc.barStack,
                height:`${(b.value/max)*100}%`,
                minHeight:b.value>0?3:0,
                transform: tooltip?.index===i ? "scaleX(1.15)" : "scaleX(1)",
                opacity: tooltip!==null && tooltip.index!==i ? 0.5 : 1,
              }}>
                {(b.segments?.length ? b.segments : [{id:"_",color,value:b.value}]).map(seg=>(
                  <div key={seg.id} style={{flexGrow:seg.value,flexBasis:0,background:seg.color,minHeight:b.value>0?2:0}}/>
                ))}
              </div>
            </div>
            <span style={{...bc.barLabel, fontWeight: tooltip?.index===i ? 700 : 400, color: tooltip?.index===i ? "#555" : "#999"}}>{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const bc = {
  wrap:{background:"#fff",borderRadius:14,padding:"16px 12px 10px",boxShadow:"0 1px 3px rgba(0,0,0,0.05)",marginBottom:14,position:"relative"},
  bars:{display:"flex",alignItems:"flex-end",gap:4,height:120},
  barCol:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",height:"100%",cursor:"pointer",userSelect:"none"},
  barTrack:{flex:1,width:"100%",maxWidth:26,display:"flex",alignItems:"flex-end",justifyContent:"center"},
  barStack:{width:"100%",borderRadius:"4px 4px 0 0",overflow:"hidden",display:"flex",flexDirection:"column-reverse",transition:"height 0.4s ease, transform 0.15s ease, opacity 0.15s ease"},
  barLabel:{fontSize:9,color:"#999",marginTop:5,whiteSpace:"nowrap",transition:"color 0.15s"},
  tooltip:{position:"absolute",background:"#1a1a2e",color:"#fff",borderRadius:8,padding:"6px 10px",fontSize:12,pointerEvents:"none",zIndex:10,display:"flex",flexDirection:"column",alignItems:"flex-start",gap:2,whiteSpace:"nowrap",boxShadow:"0 2px 8px rgba(0,0,0,0.2)"},
  tooltipLabel:{fontSize:10,opacity:0.75},
  tooltipVal:{fontWeight:700,fontSize:13},
  tooltipSeg:{fontSize:10,opacity:0.9,display:"flex",alignItems:"center",gap:4},
  segDot:{display:"inline-block",width:7,height:7,borderRadius:"50%",flexShrink:0},
};

// ── Classroom growth room ────────────────────────────────────────────────────
// Draw a single decoration at iso anchor (x = ground centre, y = tile centre).
// s = tScale so decorations grow/shrink with the plot density. Returned as an
// SVG <g> so it slots into the back-to-front draw order alongside trees.
function drawDecoration(kind, x, y, s) {
  switch (kind) {
    case "bench": return (
      <g>
        <ellipse cx={x} cy={y+2*s} rx={13*s} ry={4*s} fill="rgba(0,0,0,0.10)"/>
        <rect x={x-12*s} y={y-7*s} width={24*s} height={3.5*s} rx={1.5*s} fill="#9A6B3F"/>
        <rect x={x-12*s} y={y-12*s} width={24*s} height={3*s} rx={1.5*s} fill="#B07C4A"/>
        <rect x={x-10*s} y={y-7*s} width={2.5*s} height={8*s} fill="#7A5230"/>
        <rect x={x+8*s}  y={y-7*s} width={2.5*s} height={8*s} fill="#7A5230"/>
      </g>
    );
    case "pond": return (
      <g>
        <ellipse cx={x} cy={y+3*s} rx={17*s} ry={5*s} fill="rgba(0,0,0,.12)"/>
        <path d={`M${x-15*s} ${y-9*s} H${x+15*s} V${y+2*s} Q${x} ${y+8*s} ${x-15*s} ${y+2*s} Z`} fill="#4D8FA8" opacity=".78" stroke="#D3EDF1" strokeWidth={1.2*s}/>
        <ellipse cx={x} cy={y-8.5*s} rx={15*s} ry={5.5*s} fill="#7CC0DD" stroke="#E7F6F7" strokeWidth={1*s}/>
        {/* shimmering surface highlight */}
        <ellipse cx={x-4*s} cy={y-9*s} rx={3*s} ry={1.4*s} fill="#fff" opacity={0.5}>
          <animate attributeName="opacity" values="0.3;0.7;0.3" dur="3s" repeatCount="indefinite"/>
          <animate attributeName="cx" values={`${x-4*s};${x+2*s};${x-4*s}`} dur="6s" repeatCount="indefinite"/>
        </ellipse>
        {/* expanding ripple ring */}
        <ellipse cx={x+2*s} cy={y-8*s} rx={2*s} ry={1*s} fill="none" stroke="#fff" strokeWidth={0.5} opacity="0.5">
          <animate attributeName="rx" values={`${1*s};${10*s}`} dur="4s" repeatCount="indefinite"/>
          <animate attributeName="ry" values={`${0.5*s};${5*s}`} dur="4s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.5;0" dur="4s" repeatCount="indefinite"/>
        </ellipse>
        {/* gentle koi swimming */}
        <g>
          <animateTransform attributeName="transform" type="translate" values={`-5,1; 5,-1; -5,1`} dur="5s" repeatCount="indefinite"/>
          <circle cx={x+5*s} cy={y-7*s} r={1.6*s} fill="#F4A23A"/>
        </g>
        <g>
          <animateTransform attributeName="transform" type="translate" values={`4,-1; -4,1; 4,-1`} dur="6s" repeatCount="indefinite"/>
          <circle cx={x-2*s} cy={y-6*s} r={1.3*s} fill="#E8743B"/>
        </g>
      </g>
    );
    case "path": return (
      <g opacity={0.92}>
        {[[-9,2],[-3,0],[3,-1],[9,-3]].map(([dx,dy],i)=>(
          <ellipse key={i} cx={x+dx*s} cy={y+dy*s} rx={4*s} ry={2.4*s} fill={i%2?"#C9BCA5":"#BBA98E"}/>
        ))}
      </g>
    );
    case "fence": return (
      <g>
        <ellipse cx={x} cy={y+2*s} rx={15*s} ry={4*s} fill="rgba(0,0,0,.11)"/>
        <rect x={x-14*s} y={y-14*s} width={28*s} height={15*s} rx={2*s} fill="#93633F" stroke="#6E492F" strokeWidth={1*s}/>
        <path d={`M${x-13*s} ${y-7*s} H${x+13*s}`} stroke="#68452E" strokeWidth={1.8*s}/>
        {[[-10,-12,"#C96F59"],[-5,-11,"#6B8D82"],[1,-12,"#D2A755"],[7,-11,"#7D6A9B"],[-8,-5,"#D7B36E"],[-1,-5,"#738BA5"],[6,-5,"#B86E6D"]].map(([dx,dy,fill],i)=><rect key={i} x={x+dx*s} y={y+dy*s} width={4*s} height={5*s} rx={.5*s} fill={fill}/>) }
      </g>
    );
    case "lamp": return (
      <g>
        <ellipse cx={x} cy={y+2*s} rx={5*s} ry={2*s} fill="rgba(0,0,0,0.10)"/>
        <rect x={x-1.3*s} y={y-18*s} width={2.6*s} height={20*s} rx={1.3*s} fill="#4A4A55"/>
        <circle cx={x} cy={y-20*s} r={3.6*s} fill="#FFE9A8"/>
        <circle cx={x} cy={y-20*s} r={5.4*s} fill="#FFE9A8" opacity={0.30}/>
        <rect x={x-2.4*s} y={y-23.5*s} width={4.8*s} height={2*s} rx={1*s} fill="#4A4A55"/>
      </g>
    );
    case "flowers": return (
      <g>
        {[[-7,1,"#F47CA8"],[0,-1,"#F4C04B"],[6,0,"#9B7BD6"],[-2,2,"#F47CA8"]].map(([dx,dy,col],i)=>(
          <g key={i}>
            <rect x={x+dx*s-0.5*s} y={y+dy*s-3*s} width={1*s} height={4*s} fill="#5C9A4B"/>
            <circle cx={x+dx*s} cy={y+dy*s-4*s} r={2.2*s} fill={col}/>
            <circle cx={x+dx*s} cy={y+dy*s-4*s} r={0.9*s} fill="#FFF4C8"/>
          </g>
        ))}
      </g>
    );
    case "mushroom": return (
      <g>
        {[[-7,1,1,"#D96B62"],[2,-1,1.15,"#638BA5"],[8,2,.8,"#D6A84B"]].map(([dx,dy,sc,fill],i)=>(
          <g key={i}>
            <path d={`M${x+dx*s-3*s*sc} ${y+dy*s-7*s*sc} L${x+dx*s-1*s*sc} ${y+dy*s+1*s*sc}`} stroke="#E2B74B" strokeWidth={1.2*s*sc}/>
            <path d={`M${x+dx*s+2*s*sc} ${y+dy*s-8*s*sc} L${x+dx*s+1*s*sc} ${y+dy*s+1*s*sc}`} stroke="#4B6E8A" strokeWidth={1.1*s*sc}/>
            <path d={`M${x+dx*s-4*s*sc} ${y+dy*s-3*s*sc} H${x+dx*s+4*s*sc} L${x+dx*s+3*s*sc} ${y+dy*s+3*s*sc} H${x+dx*s-3*s*sc} Z`} fill={fill}/>
            <ellipse cx={x+dx*s} cy={y+dy*s-3*s*sc} rx={4*s*sc} ry={1.3*s*sc} fill="#F6E7D4" opacity=".82"/>
          </g>
        ))}
      </g>
    );
    case "lantern": return (
      <g>
        <ellipse cx={x} cy={y+2*s} rx={6*s} ry={2.4*s} fill="rgba(0,0,0,0.10)"/>
        <rect x={x-5*s} y={y-1*s} width={10*s} height={3*s} rx={1*s} fill="#9E9486"/>
        <rect x={x-3.5*s} y={y-7*s} width={7*s} height={6*s} rx={1.5*s} fill="#B3A899"/>
        <rect x={x-2.2*s} y={y-5.5*s} width={4.4*s} height={3*s} rx={0.8*s} fill="#FFE9A8"/>
        <polygon points={`${x},${y-12*s} ${x-5*s},${y-7*s} ${x+5*s},${y-7*s}`} fill="#8C8174"/>
        <circle cx={x} cy={y-12.5*s} r={1.4*s} fill="#8C8174"/>
      </g>
    );
    case "festivaldrum": return (
      <g>
        <ellipse cx={x} cy={y+2*s} rx={11*s} ry={3*s} fill="rgba(0,0,0,.12)"/>
        <path d={`M${x-9*s} ${y-9*s} v${10*s} q${9*s} ${4*s} ${18*s} 0 v-${10*s}`} fill="#A92F38" stroke="#6F2D28" strokeWidth={1.1*s}/>
        <ellipse cx={x} cy={y-9*s} rx={9*s} ry={4*s} fill="#F1D28A" stroke="#7B382B" strokeWidth={1.1*s}/>
        {[-6,-2,2,6].map(dx=><circle key={dx} cx={x+dx*s} cy={y-9*s} r={.8*s} fill="#D7A638"/>)}
        <path d={`M${x-7*s} ${y-15*s} L${x+1*s} ${y-8*s} M${x+7*s} ${y-15*s} L${x-1*s} ${y-8*s}`} stroke="#755039" strokeWidth={1.2*s} strokeLinecap="round"/>
      </g>
    );
    case "cloudstone": return (
      <g>
        <ellipse cx={x} cy={y+2*s} rx={12*s} ry={3.2*s} fill="rgba(0,0,0,.1)"/>
        <path d={`M${x-12*s} ${y} C${x-13*s} ${y-6*s} ${x-7*s} ${y-8*s} ${x-3*s} ${y-5*s} C${x-1*s} ${y-12*s} ${x+9*s} ${y-10*s} ${x+9*s} ${y-4*s} C${x+15*s} ${y-3*s} ${x+13*s} ${y+2*s} ${x+7*s} ${y+2*s} H${x-7*s} C${x-10*s} ${y+2*s} ${x-12*s} ${y+1*s} ${x-12*s} ${y} Z`} fill="#D9D3C5" stroke="#AAA394" strokeWidth={.8*s}/>
        <path d={`M${x-6*s} ${y-2*s} q${4*s} -${4*s} ${8*s} 0 q${3*s} ${3*s} ${7*s} 0`} fill="none" stroke="#B7AD9D" strokeWidth={.9*s} strokeLinecap="round"/>
      </g>
    );
    case "runestone": return (
      <g>
        <ellipse cx={x} cy={y+2*s} rx={10*s} ry={3*s} fill="rgba(0,0,0,.14)"/>
        <path d={`M${x-7*s} ${y} L${x-5*s} ${y-16*s} L${x+3*s} ${y-20*s} L${x+8*s} ${y-3*s} L${x+4*s} ${y+1*s} Z`} fill="#4B4B64" stroke="#292B40" strokeWidth={1*s}/>
        <path d={`M${x+1*s} ${y-16*s} l${-4*s} ${7*s} h${3*s} l${-3*s} ${6*s} l${7*s} -${8*s} h${-3*s} Z`} fill="#9FD7FF" opacity=".86"/>
      </g>
    );
    default: return null;
  }
}

// Build one collision-free tile layout shared by the garden renderer and editor.
// Trees always take priority and can never be hidden or removed. Decorations
// use the remaining tiles and can be removed from the account in the editor.
function buildGardenPlacement({ sessions, decorations = [], layout = {}, range = "month", enhancements = {} }) {
  const treeOrder = Array.isArray(layout.treeOrder) ? layout.treeOrder.map(String) : [];
  const legacyOrder = new Map(treeOrder.map((id,i)=>[id,i]));
  const trees = [...sessions].sort((a,b)=>{
    const ai=legacyOrder.has(String(a.ts))?legacyOrder.get(String(a.ts)):Number.MAX_SAFE_INTEGER;
    const bi=legacyOrder.has(String(b.ts))?legacyOrder.get(String(b.ts)):Number.MAX_SAFE_INTEGER;
    return ai-bi || a.ts-b.ts;
  });
  // Session timestamps are normally unique, but imported/admin-repaired rows
  // can legitimately share one. A timestamp-only key caused every duplicate
  // after the first to be skipped by the placement map, so the footer counted
  // more trees than the island rendered. Preserve the legacy id for the first
  // row and suffix only duplicates, keeping all saved layouts compatible.
  const seenTreeIds = {};
  const treeIds = trees.map(tree=>{
    const base=String(tree.ts);
    const occurrence=seenTreeIds[base]||0;
    seenTreeIds[base]=occurrence+1;
    return occurrence===0 ? base : `${base}#${occurrence}`;
  });
  const removedDecor = new Set([
    ...(Array.isArray(layout.removedDecor)?layout.removedDecor:[]),
    ...(Array.isArray(layout.hiddenDecor)?layout.hiddenDecor:[]),
  ]);
  const ownedDecor = DECORATIONS.filter(d=>decorations.includes(d.id) && !removedDecor.has(d.id));
  const itemCount = Math.max(1, trees.length + ownedDecor.length);
  const minGrid = range === "week" ? 4 : range === "month" ? 6 : 9;
  // Extra deterministic capacity lets the greedy placer create clearings
  // instead of packing every collectible into adjacent tiles.
  const gridSize = Math.max(minGrid, Math.ceil(Math.sqrt(itemCount*1.45)));

  const slots=[];
  for(let r=0;r<gridSize;r++) for(let c=0;c<gridSize;c++) slots.push({r,c,key:`${r}-${c}`});
  slots.sort((a,b)=>(a.r+a.c)-(b.r+b.c));
  const scatter=[...slots].sort((a,b)=>
    ((a.r*73+a.c*151+13)%97)-((b.r*73+b.c*151+13)%97));
  const validKeys=new Set(slots.map(x=>x.key));
  const occupied=new Set();
  const slotTree=new Map();
  const slotDecor=new Map();
  const treePositions={};
  const decorPositions={};
  const placed=[];
  const savedTrees=layout.treePositions&&typeof layout.treePositions==="object"?layout.treePositions:{};
  const savedDecor=layout.decorPositions&&typeof layout.decorPositions==="object"?layout.decorPositions:{};
  const slotByKey=new Map(slots.map(slot=>[slot.key,slot]));
  const canPlace=(slot,footprint)=>placed.every(other=>{
    const dx=slot.c-other.slot.c,dy=slot.r-other.slot.r;
    const distance=Math.hypot(dx,dy);
    const clearance=Math.max(1.05,(footprint.width+other.footprint.width)*.62);
    return distance>=clearance;
  });
  const chooseOpenSlot=(footprint,reverse=false)=>{
    const candidates=scatter.filter(slot=>!occupied.has(slot.key)&&canPlace(slot,footprint));
    const pool=candidates.length?candidates:scatter.filter(slot=>!occupied.has(slot.key));
    if(!pool.length)return null;
    return [...pool].sort((a,b)=>{
      const score=slot=>placed.length?Math.min(...placed.map(other=>Math.hypot(slot.c-other.slot.c,slot.r-other.slot.r))):0;
      const delta=score(b)-score(a);
      return delta||((reverse?-1:1)*(a.r+a.c-b.r-b.c))||a.key.localeCompare(b.key);
    })[0];
  };

  trees.forEach((tree,index)=>{
    const id=treeIds[index], key=savedTrees[id];
    const footprint=getSkinFootprint(tree.skin,enhancements?.[tree.skin]||0);
    const slot=slotByKey.get(key);
    // A saved grid choice is authoritative. Wide visual footprints may
    // influence automatic placement, but must never undo a user's move.
    if(slot&&!occupied.has(key)){
      occupied.add(key); slotTree.set(key,index); treePositions[id]=key;placed.push({slot,footprint});
    }
  });
  trees.forEach((tree,index)=>{
    const id=treeIds[index];
    if(treePositions[id]) return;
    const footprint=getSkinFootprint(tree.skin,enhancements?.[tree.skin]||0);
    const tile=chooseOpenSlot(footprint);
    if(!tile) return;
    occupied.add(tile.key); slotTree.set(tile.key,index); treePositions[id]=tile.key;placed.push({slot:tile,footprint});
  });

  ownedDecor.forEach(decor=>{
    const key=savedDecor[decor.id];
    const slot=slotByKey.get(key),footprint={width:.72,height:.72};
    if(slot&&!occupied.has(key)){
      occupied.add(key); slotDecor.set(key,decor); decorPositions[decor.id]=key;placed.push({slot,footprint});
    }
  });
  ownedDecor.forEach(decor=>{
    if(decorPositions[decor.id]) return;
    const footprint={width:.72,height:.72};
    const tile=chooseOpenSlot(footprint,true);
    if(!tile) return;
    occupied.add(tile.key); slotDecor.set(tile.key,decor); decorPositions[decor.id]=tile.key;placed.push({slot:tile,footprint});
  });

  return { trees, treeIds, ownedDecor, gridSize, slots, scatter, slotTree, slotDecor, treePositions, decorPositions };
}

// Keep the garden's runtime work bounded as the forest grows. Every session
// still renders as its own rooted tree and shows every unlocked ornament.
// Signature motion, particles and repeated blur are sampled once the scene
// becomes dense, preventing yearly gardens from creating thousands of
// independent SVG animation timelines.
function getGardenRenderBudget(treeCount) {
  const count=Math.max(0,Number(treeCount)||0);
  const reduced=typeof document!=="undefined"&&document.documentElement.getAttribute("data-animation-disabled")==="true";
  const lowCpu=typeof navigator!=="undefined"&&Number(navigator.hardwareConcurrency)>0&&Number(navigator.hardwareConcurrency)<=4;
  const lowMemory=typeof navigator!=="undefined"&&Number(navigator.deviceMemory)>0&&Number(navigator.deviceMemory)<=4;
  const constrained=reduced||lowCpu||lowMemory;
  const dense=count>(constrained?24:40);
  const veryDense=count>(constrained?70:120);
  const detailTarget=reduced?0:veryDense?(constrained?6:10):dense?(constrained?10:16):Math.max(1,count);
  const particleTarget=reduced?0:veryDense?3:dense?5:10;
  // Every tree moves in an ordinary grove. Sampling starts only after the
  // device-specific dense threshold, where per-tree timelines become costly.
  // Every visible tree keeps one transform-only canopy motion. The expensive
  // particles/signature details are still sampled in dense gardens, but low
  // CPU or memory hints must never silently freeze most trees on desktop.
  const canopyTarget=reduced?0:Math.max(1,count);
  return {
    dense,veryDense,motionOff:reduced,constrained,
    detailStride:detailTarget?Math.max(1,Math.ceil(count/detailTarget)):count+1,
    particleStride:particleTarget?Math.max(1,Math.ceil(count/particleTarget)):count+1,
    canopyStride:canopyTarget?Math.max(1,Math.ceil(count/canopyTarget)):count+1,
    // Birds remain present and flap in every non-reduced grove. Crowded or
    // constrained scenes reduce flock size instead of freezing the birds.
    // Tree shimmer is grouped into at most two timelines for the entire grove.
    ambientFlock:true,
    ambientBirdsPerFlight:veryDense||constrained?2:3,
    treeShimmerPhases:reduced?0:(veryDense||constrained?1:2),
    ambientGust:!reduced&&!dense&&!constrained,
    ambientButterfly:!reduced&&!dense&&!constrained,
    ambientSweep:!reduced&&!veryDense,
    ambientNightTwinkle:!reduced&&!veryDense,
    ambientNightFireflies:!reduced&&!veryDense,
    ambientSkyPulse:!reduced&&!veryDense&&!constrained,
    ambientClouds:reduced?0:veryDense?1:dense?2:3,
  };
}

const GARDEN_BIRD_SPECS = [
  {x:-15,y:16,scale:.92,flap:.82,flapDelay:-.18,bob:2.1,bobDur:3.7,bobDelay:-1.2,tiltA:"-1.4deg",tiltB:"2.1deg"},
  {x:14,y:2,scale:1.06,flap:.94,flapDelay:-.61,bob:1.6,bobDur:4.3,bobDelay:-2.8,tiltA:".8deg",tiltB:"-1.8deg"},
  {x:45,y:19,scale:.78,flap:.76,flapDelay:-.37,bob:2.4,bobDur:3.9,bobDelay:-.5,tiltA:"-2deg",tiltB:"1.2deg"},
];

// Isometric SVG grid — each session plants a tree, coloured by subject
function ForestGarden({ sessions, subjects, range, decorations = [], enhancements = {}, layout = {} }) {
  const [hovered, setHovered] = useState(null);
  const svgRef=useRef(null);
  // Several groves can exist in the DOM at once (for example, the Stats grove
  // behind a leaderboard visit sheet). SVG paint-server ids are document-wide,
  // and duplicate ids can make Safari resolve a modal's gradients/filters to
  // the hidden grove behind it. Give each rendered scene its own stable prefix.
  const gardenSvgId=useId().replace(/:/g,"");

  // Exact tile positions are persisted in prefs so the same arrangement is
  // shown to leaderboard visitors. Old order/hidden layouts remain compatible.
  // Memoizing also stops a hover tooltip from rebuilding the entire placement.
  const placement = useMemo(
    ()=>buildGardenPlacement({ sessions, decorations, layout, range, enhancements }),
    [sessions,decorations,layout,range,enhancements]
  );
  const { trees, treeIds, treePositions, gridSize, slots, scatter, slotTree, slotDecor } = placement;
  const renderBudget=getGardenRenderBudget(trees.length);
  const subjectById=useMemo(()=>new Map(subjects.map(s=>[s.id,s])),[subjects]);
  const skinById=useMemo(()=>new Map(TREE_SKINS.map(s=>[s.id,s])),[]);

  // Stop SMIL timelines when the garden is off-screen or the tab is hidden.
  // This matters on the long Stats page, where the SVG can otherwise keep
  // spending CPU/GPU after the user has scrolled down to the charts.
  useEffect(()=>{
    const svg=svgRef.current;
    if(!svg)return;
    let inView=true;
    const sync=()=>{
      const shouldPause=document.hidden||!inView;
      svg.classList.toggle("sg-garden-paused",shouldPause);
      try{
        if(shouldPause&&typeof svg.pauseAnimations==="function")svg.pauseAnimations();
        else if(!shouldPause&&typeof svg.unpauseAnimations==="function")svg.unpauseAnimations();
      }catch{}
    };
    const observer=typeof IntersectionObserver!=="undefined"
      ? new IntersectionObserver(([entry])=>{inView=!!entry?.isIntersecting;sync();},{rootMargin:"120px"})
      : null;
    observer?.observe(svg);
    document.addEventListener("visibilitychange",sync);
    sync();
    return ()=>{svg.classList.remove("sg-garden-paused");observer?.disconnect();document.removeEventListener("visibilitychange",sync);};
  },[]);

  // Isometric projection helpers — cells sized to fill the card at any grid size
  const CELL  = Math.min(44, 340 / (1.2 * gridSize));
  const tScale = CELL / 36; // trees scale with the cells
  const W     = 390;
  const H     = 260;
  const originX = W / 2;
  const originY = Math.max(64, 158 - gridSize * (CELL * 0.28)); // keep plot vertically centred, leave room for tall skins

  const isoX = (col, row) => originX + (col - row) * (CELL * 0.6);
  const isoY = (col, row) => originY + (col + row) * (CELL * 0.28);

  const grassLight = "#EBCB96";
  const grassLight2= "#DDB47E";
  const grassDark  = "#9B6C46";
  const soilColor  = "#8B5D3C";
  const soilDark   = "#5E3D29";

  // ── Time-of-day ambiance ────────────────────────────────────────────────────
  // The garden subtly shifts with the real hour.
  const hour = new Date().getHours();
  const tod = getTimeOfDay();
  const sunX = W*0.78, sunY = 54;

  const compactAmbientCycle=renderBudget.dense||renderBudget.constrained;
  const ambientCycle=compactAmbientCycle?"20s":"30s"; // one event roughly every ten seconds
  const firstEventEnd=compactAmbientCycle?0.48:0.32;
  const secondEventStart=compactAmbientCycle?0.5:0.33;
  const secondEventEnd=compactAmbientCycle?0.98:0.65;
  const sweepEventStart=compactAmbientCycle?0.5:0.66;
  const flockSeconds=compactAmbientCycle?26:22;

  // One tiny highlight per crown makes every tree participate in the scene,
  // but the highlights fade as one or two shared groups. This avoids creating
  // an independent animation timeline for every session in a large grove.
  const treeEffectPoints=renderBudget.treeShimmerPhases?slots.flatMap(({r,c})=>{
    const tIdx=slotTree.get(`${r}-${c}`);
    if(tIdx===undefined)return [];
    const tree=trees[tIdx];
    const skinDef=skinById.get(tree.skin)||null;
    const shape=skinDef?.shape||"round";
    const x=isoX(c,r);
    const y=isoY(c,r)+CELL*0.28;
    const h=(18+Math.min(tree.secs/300,1)*12)*tScale;
    const cr=(8+Math.min(tree.secs/300,1)*6)*tScale;
    let fx=x+((tIdx%3)-1)*cr*0.28;
    let fy=y-h+h*0.08-cr*0.42;
    if(shape==="palm"){fx=x+h*0.3+cr*0.18;fy=y-h-cr*0.2;}
    else if(shape==="bamboo"){fx=x+((tIdx%2)?-1:1)*cr*0.2;fy=y-(h*0.9+cr*1.35*0.86);}
    else if(shape==="muffin"||shape==="cupcake"||shape==="cake")fy=y-h-cr*0.15;
    const size=Math.max(0.72,cr*0.09);
    return [{key:`tree-glint-${r}-${c}`,phase:(r+c)%renderBudget.treeShimmerPhases,x:fx,y:fy,size}];
  }):[];

  return (
    <div style={fg.wrap}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H+60}`} width="100%" style={{display:"block",overflow:"visible"}}>
        <defs>
          {/* Sky gradient */}
          <linearGradient id={`${gardenSvgId}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor={tod.sky1}/>
            <stop offset="100%" stopColor={tod.sky2}/>
          </linearGradient>
          {/* Sun radial glow */}
          <radialGradient id={`${gardenSvgId}-sun`} cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor={tod.sun} stopOpacity={tod.sunGlow}/>
            <stop offset="60%" stopColor={tod.sun} stopOpacity={tod.sunGlow*0.35}/>
            <stop offset="100%" stopColor={tod.sun} stopOpacity="0"/>
          </radialGradient>
          {/* Warm classroom floor tiles. The legacy paint-server ids stay
              stable because old captures and browser caches may reference them. */}
          <linearGradient id={`${gardenSvgId}-grass-a`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E9C993"/><stop offset="100%" stopColor="#C8955D"/>
          </linearGradient>
          <linearGradient id={`${gardenSvgId}-grass-b`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F1D6A7"/><stop offset="100%" stopColor="#D4A46E"/>
          </linearGradient>
          {/* Raised classroom display platform */}
          <linearGradient id={`${gardenSvgId}-soil-r`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#A46F45"/><stop offset="100%" stopColor="#68442D"/>
          </linearGradient>
          <linearGradient id={`${gardenSvgId}-soil-l`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8C5D3B"/><stop offset="100%" stopColor="#563823"/>
          </linearGradient>
          <linearGradient id={`${gardenSvgId}-wall`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tod.name==="night"?"#2A384B":tod.name==="dusk"?"#E7B79C":"#DDE9D7"}/>
            <stop offset="100%" stopColor={tod.name==="night"?"#182536":tod.name==="dusk"?"#C98579":"#BFD3BC"}/>
          </linearGradient>
          <linearGradient id={`${gardenSvgId}-room-floor`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tod.name==="night"?"#50606C":"#D7B685"}/>
            <stop offset="100%" stopColor={tod.name==="night"?"#263640":"#9B704C"}/>
          </linearGradient>
          <clipPath id={`${gardenSvgId}-window-clip`}><rect x="18" y="20" width="108" height="86" rx="4"/></clipPath>
          {/* Soft blur for shadows */}
          <filter id={`${gardenSvgId}-soft`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.2"/>
          </filter>
          {/* Vignette */}
          <radialGradient id={`${gardenSvgId}-vig`} cx="50%" cy="46%" r="62%">
            <stop offset="70%" stopColor="#000" stopOpacity="0"/>
            <stop offset="100%" stopColor="#000" stopOpacity="0.14"/>
          </radialGradient>
        </defs>

        {/* Detailed classroom shell: wall, window, board, shelving and floor.
            Only the outside view changes with time; the learning space stays
            readable and calm around the collectible growth markers. */}
        <rect x="-20" y="-20" width={W+40} height={H+100} fill={`url(#${gardenSvgId}-wall)`}/>
        <path d={`M-20 0 H${W+20} L${W-7} 18 H7 Z`} fill={tod.name==="night"?"#1C2938":"#F7EFD9"} opacity=".82"/>
        <rect x="-20" y="111" width={W+40} height={H+20} fill={`url(#${gardenSvgId}-room-floor)`}/>
        {[0,1,2,3,4,5].map(index=><path key={`floor-line-${index}`} d={`M${-35+index*86} ${H+70} L${88+index*48} 111`} stroke={tod.name==="night"?"#82909A":"#8C674B"} strokeWidth="1" opacity=".2"/>)}
        <g clipPath={`url(#${gardenSvgId}-window-clip)`}>
          <rect x="18" y="20" width="108" height="86" fill={`url(#${gardenSvgId}-sky)`}/>
          {tod.star && Array.from({length:9}).map((_,i)=><circle key={`star${i}`} cx={25+((i*37)%94)} cy={27+((i*29)%62)} r={(i%3===0)?1.1:.7} fill="#fff" opacity={.44+((i%4)*.1)}/>)}
          <circle cx="92" cy="47" r="38" fill={`url(#${gardenSvgId}-sun)`} opacity=".92">
            {renderBudget.ambientSkyPulse&&<animate attributeName="opacity" values=".76;.96;.76" dur="14s" repeatCount="indefinite"/>}
          </circle>
          <circle cx="92" cy="47" r={tod.name==="night"?7:10} fill={tod.sun} opacity=".92"/>
          {!tod.star&&renderBudget.ambientClouds>0&&<g opacity=".72">
            <animateTransform attributeName="transform" type="translate" values="-8 0;10 -1;-8 0" dur="36s" repeatCount="indefinite"/>
            {[{x:42,y:48,s:.62},{x:96,y:70,s:.5}].slice(0,renderBudget.ambientClouds).map((cl,i)=><g key={`cloud${i}`}>
              <ellipse cx={cl.x} cy={cl.y} rx={26*cl.s} ry={9*cl.s} fill="#fff"/><ellipse cx={cl.x+13*cl.s} cy={cl.y+1} rx={15*cl.s} ry={7*cl.s} fill="#fff"/>
            </g>)}
          </g>}
        </g>
        <rect x="15" y="17" width="114" height="92" rx="5" fill="none" stroke={tod.name==="night"?"#8496A7":"#F4E4C8"} strokeWidth="7"/>
        <path d="M72 19 V107 M17 62 H127" stroke={tod.name==="night"?"#8092A3":"#E8D4B5"} strokeWidth="3" opacity=".88"/>
        <path d="M10 14 Q26 34 16 110 M134 14 Q118 35 128 110" fill="none" stroke={tod.name==="night"?"#495B77":"#91A985"} strokeWidth="8" opacity=".8"/>
        <rect x="145" y="24" width="143" height="66" rx="4" fill={tod.name==="night"?"#183B39":"#315E4F"} stroke="#B88D57" strokeWidth="6"/>
        <path d="M160 45 H213 M185 57 H266 M153 72 H228" stroke="#EDE6C9" strokeWidth="2" strokeLinecap="round" opacity=".58"/>
        <rect x="139" y="91" width="155" height="5" rx="2" fill="#A8794E"/>
        <rect x="312" y="28" width="58" height="88" rx="5" fill={tod.name==="night"?"#4C3A31":"#9B6B47"} stroke={tod.name==="night"?"#2A2628":"#754B32"} strokeWidth="5"/>
        {[0,1,2].map(row=><g key={`shelf-${row}`}><path d={`M314 ${55+row*25} H368`} stroke="#4A3326" strokeWidth="4"/><rect x={319+row*3} y={35+row*25} width="8" height="17" rx="1" fill="#D89461"/><rect x={329+row*2} y={38+row*25} width="7" height="14" rx="1" fill="#6F8C7C"/><rect x={338+row*3} y={36+row*25} width="9" height="16" rx="1" fill="#D6B35F"/></g>)}
        <circle cx="306" cy="19" r="11" fill="#F5EEDB" stroke="#8D7B6B" strokeWidth="2"/><path d="M306 19 L306 12 M306 19 L312 22" stroke="#6D675F" strokeWidth="1.6" strokeLinecap="round"/>
        <rect x="155" y="7" width="78" height="7" rx="3.5" fill={tod.name==="night"?"#D5D7C9":"#FFF6D4"} opacity={tod.name==="night"?.44:.84}/>

        {/* Whole-platform contact shadow grounds the classroom display */}
        {(() => {
          const g = gridSize - 1;
          const cx = originX, cy = isoY(g, g) + CELL*0.28 + 30*Math.max(tScale,0.6);
          const rx = (g+1.2) * CELL * 0.58, ry = (g+1.2) * CELL * 0.15;
          return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#000" opacity={0.13} filter={`url(#${gardenSvgId}-soft)`}/>;
        })()}

        {/* Classroom display platform — alternating warm wood tiles preserve
            every legacy isometric saved position. */}
        {slots.map(({r,c}) => {
          const x = isoX(c, r);
          const y = isoY(c, r);
          const hw = CELL * 0.6;
          const hh = CELL * 0.28;
          const top    = `${x},${y}`;
          const right  = `${x+hw},${y+hh}`;
          const bottom = `${x},${y+hh*2}`;
          const left   = `${x-hw},${y+hh}`;
          return (
            <g key={`tile-${r}-${c}`}>
              <polygon points={`${top} ${right} ${bottom} ${left}`}
                fill={`url(#${gardenSvgId}-${(r+c)%2===0?"grass-a":"grass-b"})`}/>
              <polyline points={`${left} ${top} ${right}`} fill="none"
                stroke="#FFF0CF" strokeWidth={0.6} opacity={0.3}/>
            </g>
          );
        })}


        {/* Raised timber skirt — the old soil geometry is retained so saved
            layouts and hit areas do not move. */}
        {(() => {
          const hw = CELL * 0.6, hh = CELL * 0.28, D = 16 * Math.max(tScale, 0.6);
          const g = gridSize - 1;
          // Corner points of the plot
          const S  = { x: isoX(g, g),   y: isoY(g, g) + hh*2 };  // south (front)
          const E  = { x: isoX(g, 0)+hw, y: isoY(g, 0) + hh };   // east (right)
          const Wt = { x: isoX(0, g)-hw, y: isoY(0, g) + hh };   // west (left)
          const grassRim = 6 * Math.max(tScale, 0.6);
          const stones = [];
          for (let i = 0; i < gridSize; i++) {
            const t = (i + 0.5) / gridSize;
            // right face stones
            stones.push({ x: S.x + (E.x - S.x) * t, y: S.y + (E.y - S.y) * t + D*0.55, rx: 3.4*tScale, k:`r${i}` });
            // left face stones
            stones.push({ x: S.x + (Wt.x - S.x) * t, y: S.y + (Wt.y - S.y) * t + D*0.55, rx: 3.4*tScale, k:`l${i}` });
          }
          return (
            <g>
              {/* polished timber rim */}
              <polygon points={`${E.x},${E.y} ${S.x},${S.y} ${E.x},${E.y+grassRim} ${S.x},${S.y+grassRim}`} fill={grassDark}/>
              <polygon points={`${Wt.x},${Wt.y} ${S.x},${S.y} ${Wt.x},${Wt.y+grassRim} ${S.x},${S.y+grassRim}`} fill={grassDark}/>
              {/* timber faces */}
              <polygon points={`${E.x},${E.y+grassRim} ${S.x},${S.y+grassRim} ${S.x},${S.y+grassRim+D} ${E.x},${E.y+grassRim+D}`} fill={`url(#${gardenSvgId}-soil-r)`}/>
              <polygon points={`${Wt.x},${Wt.y+grassRim} ${S.x},${S.y+grassRim} ${S.x},${S.y+grassRim+D} ${Wt.x},${Wt.y+grassRim+D}`} fill={`url(#${gardenSvgId}-soil-l)`}/>
              {/* subtle brass joinery */}
              {stones.map(st=>(
                <ellipse key={st.k} cx={st.x} cy={st.y+grassRim} rx={st.rx} ry={st.rx*0.7}
                  fill="#D0A65C" opacity={0.38}/>
              ))}
            </g>
          );
        })()}

        {/* Books, notebooks and pencils add classroom detail to a few empty
            positions without changing their selectable placement keys. */}
        {slots.map(({r,c}) => {
          if (slotTree.has(`${r}-${c}`)) return null;
          if (slotDecor.has(`${r}-${c}`)) return null;
          if ((r*5 + c*11 + 3) % 3 !== 0) return null;
          const x = isoX(c, r), y = isoY(c, r) + CELL*0.28;
          const s = tScale;
          return (
            <g key={`study-detail-${r}-${c}`} opacity={0.62} transform={`rotate(${((r+c)%3-1)*7} ${x} ${y})`}>
              <rect x={x-6*s} y={y-3.4*s} width={10*s} height={5.5*s} rx={1*s} fill={(r+c)%2?"#6F8DA5":"#B76566"}/>
              <path d={`M${x-4.5*s} ${y-1.9*s} H${x+2.5*s}`} stroke="#F4EEDC" strokeWidth={.65*s} opacity=".7"/>
              <rect x={x+3*s} y={y-5*s} width={1.2*s} height={9*s} rx={.6*s} fill="#E2B84E" transform={`rotate(28 ${x+3*s} ${y-5*s})`}/>
            </g>
          );
        })}

        {/* Trees + decorations — placed at scattered slots, drawn back-to-front */}
        {slots.map(({r,c}) => {
          // A decoration may live on this tile instead of a tree
          const decor = slotDecor.get(`${r}-${c}`);
          if (decor) {
            const dx = isoX(c, r);
            const dy = isoY(c, r) + CELL * 0.28;
            return (
              <g key={`decor-${r}-${c}`}>
                {!renderBudget.veryDense&&<ellipse cx={dx} cy={dy+2} rx={12*tScale} ry={4*tScale} fill="#000" opacity={0.12}
                  filter={renderBudget.dense?undefined:`url(#${gardenSvgId}-soft)`}/>} 
                {drawDecoration(decor.kind, dx, dy, tScale)}
              </g>
            );
          }
          const tIdx = slotTree.get(`${r}-${c}`);
          if (tIdx === undefined) return null;
          const tree  = trees[tIdx];
          const x     = isoX(c, r);
          const y     = isoY(c, r) + CELL * 0.28; // sit in tile centre
          const subj  = subjectById.get(tree.subject) || { color:"#56B68B" };
          const skinDef = skinById.get(tree.skin) || null;
          const shape = skinDef?.shape || "round";
          const footprint=getSkinFootprint(tree.skin,enhancements[tree.skin||"default"]||0);
          // Colour: skins with their own canopy colour use it; plain skins use subject colour
          const color = skinDef?.canopy || subj.color;
          const trunkC = skinDef?.trunk || "#8B6340";
          const isHov = hovered === tIdx;
          const scale = (isHov ? 1.12 : 1)*(footprint.scale||1);
          const h     = (18 + Math.min(tree.secs / 300, 1) * 12) * tScale*(footprint.trunkScale||1);
          const cr    = (8  + Math.min(tree.secs / 300, 1) * 6) * tScale*(footprint.canopyScale||1);
          const ty    = y - h;

          // Build the crown for this tree's shape, and the exact point (on
          // that shape's own geometry) where a Radiant companion should sit.
          let crown;
          let perchPoint = null;
          if(shape==="pine"){
            const frostedG = !!skinDef?.frosted;
            perchPoint = { x: x+cr*0.858, y: ty+h*0.5-cr*0.9, face:1 }; // right corner of the 2nd tier
            crown = (
              <g>
                {[0,1,2].map(i=>{
                  const ly = ty + h*0.5 - i*cr*0.9;
                  const lw = cr*2.2*(1 - i*0.22);
                  return <polygon key={i} points={`${x},${ly-cr*1.4} ${x-lw/2},${ly} ${x+lw/2},${ly}`} fill={color} opacity={0.9}/>;
                })}
                <polygon points={`${x},${ty+h*0.5-2*cr*0.9-cr*1.4} ${x-cr*0.5},${ty+h*0.5-2*cr*0.9-cr*0.5} ${x+cr*0.1},${ty+h*0.5-2*cr*0.9-cr*0.5}`} fill="#fff" opacity={0.18}/>
                {frostedG && [0,1,2].map(i=>{
                  const ly = ty + h*0.5 - i*cr*0.9;
                  const lw = cr*2.2*(1 - i*0.22);
                  return <polyline key={`f${i}`} points={`${x-lw*0.3},${ly-cr*1.05} ${x-lw*0.08},${ly-cr*1.28} ${x},${ly-cr*1.36} ${x+lw*0.1},${ly-cr*1.26} ${x+lw*0.28},${ly-cr*1.02}`}
                    stroke="#F2FAF6" strokeWidth={cr*0.12} fill="none" strokeLinecap="round" opacity={0.85}/>;
                })}
              </g>
            );
          } else if(shape==="palm"){
            // Coconut Palm — leaning trunk (drawn in the trunk section below,
            // suppressing the default trunk) topped with a burst of fronds.
            const lean = h*0.30, topCx = x+lean, topCy = ty;
            perchPoint = { x: topCx, y: topCy-cr*0.1, face:1 };
            const frondAngles = [-165,-128,-92,-58,-22,10,42];
            crown = (
              <g>
                {frondAngles.map((deg,i)=>{
                  const rad = deg*Math.PI/180;
                  const len = cr*(0.98+(i%2)*0.12);
                  const dx = Math.cos(rad), dy = Math.sin(rad)*0.7;
                  const droop = Math.abs(dx)*len*0.55;
                  const tipX = topCx+dx*len, tipY = topCy+dy*len+droop;
                  const midX = topCx+dx*len*0.5, midY = topCy+dy*len*0.5-len*0.14;
                  const w = len*0.15;
                  const plen = Math.hypot(tipX-topCx, tipY-topCy)||1;
                  const px = -(tipY-topCy)/plen, py=(tipX-topCx)/plen;
                  return <path key={i} d={`M${topCx} ${topCy} Q${midX+px*w*0.5} ${midY+py*w*0.5} ${tipX} ${tipY} Q${midX-px*w*0.5} ${midY-py*w*0.5} ${topCx} ${topCy} Z`}
                    fill={color} opacity={0.94-(i%2)*0.08}/>;
                })}
                <circle cx={topCx-cr*0.08} cy={topCy+cr*0.07} r={cr*0.09} fill="#6B4423"/>
                <circle cx={topCx+cr*0.07} cy={topCy+cr*0.1} r={cr*0.085} fill="#5A3A1E"/>
                <circle cx={topCx-cr*0.005} cy={topCy+cr*0.13} r={cr*0.08} fill="#6B4423"/>
              </g>
            );
          } else if(shape==="banana"){
            const topY = ty;
            perchPoint = { x: x-cr*0.3, y: topY-cr*0.08, face:-1 };
            const leafAngles = [-150,-105,-55,-15,35];
            crown = (
              <g>
                {leafAngles.map((deg,i)=>{
                  const rad = deg*Math.PI/180;
                  const len = cr*(1.05+(i%2)*0.08);
                  const tipX = x+Math.cos(rad)*len;
                  const tipY = topY+Math.sin(rad)*len*0.62-len*0.05;
                  const perpX = -Math.sin(rad), perpY = Math.cos(rad)*0.62;
                  const w = len*0.34;
                  const cxr = x+Math.cos(rad)*len*0.5, cyr = topY+Math.sin(rad)*len*0.5*0.62;
                  return <path key={i} d={`M${x} ${topY} Q${cxr+perpX*w} ${cyr+perpY*w} ${tipX} ${tipY} Q${cxr-perpX*w} ${cyr-perpY*w} ${x} ${topY} Z`}
                    fill={color} opacity={0.95-(i%2)*0.1}/>;
                })}
                {(()=>{
                  const bx=x+cr*0.13, by=topY+cr*0.28;
                  const offs=[[-cr*0.08,0],[0,cr*0.04],[cr*0.08,0],[-cr*0.04,cr*0.12],[cr*0.04,cr*0.12]];
                  return <g>{offs.map(([dx,dy],i)=>(
                    <path key={i} d={`M${bx+dx-cr*0.04} ${by+dy} Q${bx+dx} ${by+dy+cr*0.12} ${bx+dx+cr*0.04} ${by+dy} Q${bx+dx+cr*0.016} ${by+dy+cr*0.04} ${bx+dx-cr*0.016} ${by+dy+cr*0.04} Z`} fill="#F2C744"/>
                  ))}</g>;
                })()}
              </g>
            );
          } else if(shape==="bamboo"){
            // Golden Bamboo — three stalks replace the trunk entirely.
            const stalkDefs = [
              { dx:-cr*0.35, hMul:0.62, w:cr*0.13 },
              { dx:0,         hMul:0.86, w:cr*0.16 },
              { dx:cr*0.33,   hMul:0.5,  w:cr*0.12 },
            ];
            { const tallH = h*0.9 + cr*1.35*0.86; perchPoint = { x, y: y-tallH-cr*0.06, face:1 }; }
            crown = (
              <g>
                {stalkDefs.map((s,si)=>{
                  const sh_ = h*0.9 + cr*1.35*s.hMul;
                  const topYs = y-sh_;
                  const w = s.w;
                  const nodeCount = Math.max(2, Math.round(sh_/(cr*0.42||1)));
                  const leafAngles = [-140,-90,-40,10];
                  return (
                    <g key={si}>
                      <rect x={x+s.dx-w/2} y={topYs} width={w} height={sh_} rx={w*0.4} fill={trunkC}/>
                      {Array.from({length:nodeCount-1}).map((_,n)=>{
                        const ny = topYs + (sh_/nodeCount)*(n+1);
                        return <path key={n} d={`M${x+s.dx-w/2-0.5} ${ny} Q${x+s.dx} ${ny-w*0.3} ${x+s.dx+w/2+0.5} ${ny}`}
                          stroke={shade(trunkC,-0.35)} strokeWidth={1} fill="none" opacity={0.7}/>;
                      })}
                      {leafAngles.map((deg,i)=>{
                        const rad=deg*Math.PI/180, len=cr*(0.3+(si%2)*0.06);
                        const tipX=x+s.dx+Math.cos(rad)*len, tipY=topYs+Math.sin(rad)*len*0.7-cr*0.05;
                        return <path key={i} d={`M${x+s.dx} ${topYs+w*0.2} Q${x+s.dx+Math.cos(rad)*len*0.5} ${topYs+Math.sin(rad)*len*0.35} ${tipX} ${tipY} Q${x+s.dx+Math.cos(rad)*len*0.3} ${topYs+Math.sin(rad)*len*0.2+cr*0.03} ${x+s.dx} ${topYs+w*0.2} Z`}
                          fill={color} opacity={0.9}/>;
                      })}
                    </g>
                  );
                })}
              </g>
            );
          } else if(shape==="blossom"){
            perchPoint = { x: x+cr*0.5, y: ty+h*0.18-cr*0.6, face:1 };
            crown = (
              <g>
                <circle cx={x} cy={ty+h*0.3} r={cr} fill={color} opacity={0.65}/>
                <circle cx={x-cr*0.5} cy={ty+h*0.18} r={cr*0.6} fill={color} opacity={0.8}/>
                <circle cx={x+cr*0.5} cy={ty+h*0.18} r={cr*0.6} fill={color} opacity={0.8}/>
                <circle cx={x} cy={ty} r={cr*0.7} fill={color} opacity={0.95}/>
                <circle cx={x-cr*0.3} cy={ty+h*0.1} r={cr*0.12} fill="#F47CA8"/>
                <circle cx={x+cr*0.35} cy={ty-cr*0.1} r={cr*0.12} fill="#F47CA8"/>
                <circle cx={x+cr*0.2} cy={ty-cr*0.15} r={cr*0.26} fill="#fff" opacity={0.22}/>
              </g>
            );
          } else if(shape==="willow"){
            perchPoint = { x:x-cr*.82, y:ty-cr*.72, face:-1 };
            crown = <WillowCrown cx={x} baseY={y} canopyY={ty+h*.05} r={cr}
              canopyColor={color} trunkColor={trunkC} opacity={.94} pond={skinDef?.id==="willow"}/>;
          } else if(shape==="maple"){
            perchPoint = { x: x+cr*0.45, y: ty+h*0.05-cr*0.7, face:1 };
            crown = (
              <g>
                <circle cx={x} cy={ty+h*0.3} r={cr*1.05} fill={color} opacity={0.65}/>
                <circle cx={x-cr*0.45} cy={ty+h*0.05} r={cr*0.7} fill={color} opacity={0.8}/>
                <circle cx={x+cr*0.45} cy={ty+h*0.05} r={cr*0.7} fill={color} opacity={0.85}/>
                <circle cx={x} cy={ty-cr*0.1} r={cr*0.6} fill={color} opacity={0.95}/>
                <circle cx={x+cr*0.2} cy={ty-cr*0.2} r={cr*0.28} fill="#fff" opacity={0.2}/>
              </g>
            );
          } else if(shape==="muffin"||shape==="cupcake"||shape==="cake"){
            const bw = cr*1.6;
            if(shape==="cake"){
              crown = (
                <g>
                  {[[bw*1.2,ty+h*0.35,color],[bw*0.9,ty+h*0.05,"#FFE3EC"],[bw*0.6,ty-cr*0.25,color]].map(([w,y0,f],i)=>(
                    <g key={i}>
                      <rect x={x-w/2} y={y0} width={w} height={cr*0.7} rx={2} fill={f}/>
                      <rect x={x-w/2} y={y0} width={w} height={cr*0.2} rx={2} fill="#fff" opacity={0.25}/>
                      {[0.25,0.75].map(t=><circle key={t} cx={x-w/2+w*t} cy={y0+cr*0.22} r={cr*0.09} fill="#fff" opacity={0.6}/>)}
                    </g>
                  ))}
                  <circle cx={x} cy={ty-cr*0.32} r={cr*0.14} fill="#E5484D"/>
                </g>
              );
            } else {
              const darkG = shape==="muffin" ? "#5A3F8A" : "#D9426F";
              crown = (
                <g>
                  {/* pleated wrapper with rim + side shade */}
                  <polygon points={`${x-bw*0.5},${ty+h*0.35} ${x+bw*0.5},${ty+h*0.35} ${x+bw*0.36},${y-1} ${x-bw*0.36},${y-1}`} fill={trunkC}/>
                  <polygon points={`${x+bw*0.26},${ty+h*0.35} ${x+bw*0.5},${ty+h*0.35} ${x+bw*0.36},${y-1} ${x+bw*0.2},${y-1}`} fill="#000" opacity={0.08}/>
                  <rect x={x-bw*0.5} y={ty+h*0.35-0.8} width={bw} height={1.6} rx={0.8} fill="#fff" opacity={0.3}/>
                  {/* frosting with drip edge */}
                  <ellipse cx={x} cy={ty+h*0.32} rx={bw*0.55} ry={cr*0.5} fill={color}/>
                  {[-0.34,0,0.34].map((t,i)=><circle key={i} cx={x+bw*t} cy={ty+h*0.42} r={cr*0.14} fill={color}/>)}
                  <circle cx={x-cr*0.4} cy={ty+h*0.12} r={cr*0.42} fill={color}/>
                  <circle cx={x+cr*0.4} cy={ty+h*0.12} r={cr*0.42} fill={color}/>
                  <circle cx={x} cy={ty-cr*0.1} r={cr*0.45} fill={color}/>
                  {/* shine + berries/sprinkles */}
                  <circle cx={x-cr*0.16} cy={ty-cr*0.22} r={cr*0.13} fill="#fff" opacity={0.35}/>
                  {shape==="muffin"
                    ? [[-0.3,-0.1],[0.28,-0.16],[0.04,0.14]].map(([tx,ty2],i)=>
                        <circle key={i} cx={x+cr*tx} cy={ty+cr*ty2} r={cr*0.12} fill={darkG}/>)
                    : [[-0.3,-0.1,"#FFD34D"],[0.26,-0.18,"#7FB86A"],[0.05,0.12,"#5B8DEF"],[-0.1,-0.3,"#fff"]].map(([tx,ty2,sc],i)=>
                        <rect key={i} x={x+cr*tx} y={ty+cr*ty2} width={cr*0.16} height={cr*0.06} rx={cr*0.03} fill={sc} transform={`rotate(${i*40} ${x+cr*tx} ${ty+cr*ty2})`}/>)}
                </g>
              );
            }
          } else {
            // round (oak + colour skins) — clustered lobes matching TreeSVG.
            // Rainbow Tree swaps the flat fill for a spectrum gradient.
            const isRainbowG = !!skinDef?.magic?.rainbow;
            const rbgId = `rbg-${r}-${c}`;
            const fillG = isRainbowG ? `url(#${rbgId})` : color;
            perchPoint = { x: x+cr*0.58, y: ty+h*0.2-cr*0.5, face:1 };
            crown = (
              <>
                {isRainbowG && (
                  <defs>
                    <linearGradient id={rbgId} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%"   stopColor="#FF5C7A"/>
                      <stop offset="20%"  stopColor="#FF9C4A"/>
                      <stop offset="40%"  stopColor="#FFD34D"/>
                      <stop offset="60%"  stopColor="#6FCF7A"/>
                      <stop offset="80%"  stopColor="#4FA8E8"/>
                      <stop offset="100%" stopColor="#A16FE8"/>
                    </linearGradient>
                  </defs>
                )}
                <ellipse cx={x} cy={ty+h*0.32} rx={cr*1.05} ry={cr*0.88} fill={fillG} opacity={0.6}/>
                <circle cx={x-cr*0.55} cy={ty+h*0.22} r={cr*0.55} fill={fillG} opacity={0.8}/>
                <circle cx={x+cr*0.58} cy={ty+h*0.2}  r={cr*0.5}  fill={fillG} opacity={0.8}/>
                <circle cx={x} cy={ty+h*0.06} r={cr*0.72} fill={fillG} opacity={0.95}/>
                <circle cx={x-cr*0.3} cy={ty-h*0.04} r={cr*0.38} fill={fillG} opacity={0.95}/>
                <circle cx={x+cr*0.24} cy={ty-h*0.02} r={cr*0.3} fill="#fff" opacity={0.22}/>
                <circle cx={x-cr*0.5} cy={ty+h*0.14} r={cr*0.2} fill="#fff" opacity={0.15}/>
                <ellipse cx={x} cy={ty+h*0.42} rx={cr*0.68} ry={cr*0.24} fill="#000" opacity={0.07}/>
              </>
            );
          }
          const isFood = shape==="muffin"||shape==="cupcake"||shape==="cake";
          const isBambooG = shape==="bamboo";
          const isPalmG = shape==="palm";
          // Enhancement tier is per-SKIN on the account, so it applies to every
          // existing tree of this type retroactively — the whole forest ripens.
          const eTier = Math.max(0, Math.min(3, enhancements[tree.skin||"default"]||0));
          const isFlagshipG = !!skinDef?.flagship;
          const isMythicalG = skinDef?.collection==="mystical";
          const hasSignatureG = isFlagshipG || isMythicalG;
          // Whole-tree sway was the largest grove animation multiplier, so the
          // planted trees stay rooted. Every crown moves in ordinary groves;
          // dense scenes sample them, and tapping any tree wakes its details.
          const animateDetails = isHov || (!renderBudget.motionOff&&(!renderBudget.dense||tIdx%renderBudget.detailStride===0));
          const animateCanopy = !renderBudget.motionOff&&(isHov||tIdx%renderBudget.canopyStride===0);
          const eDeep = eTier>=1 ? shade(color,-0.22) : null;
          const ePart = eTier>=2 ? enhanceParticle(skinDef||TREE_SKINS[0]) : null;
          const showFall = !hasSignatureG && eTier>=2 && (tIdx%renderBudget.particleStride===0);
          const eEvening = !hasSignatureG && eTier>=3 && (tod.name==="dusk"||tod.name==="night");

          return (
            <g key={`tree-${r}-${c}`} data-garden-tree="true"
              transform={`translate(${x},${y}) scale(${scale}) translate(${-x},${-y})`}
              style={{cursor:"pointer",transition:"transform 0.15s"}}
              onMouseEnter={()=>setHovered(tIdx)}
              onMouseLeave={()=>setHovered(null)}
              onTouchStart={()=>setHovered(tIdx)}
              onTouchEnd={()=>setTimeout(()=>setHovered(null),1400)}>
              {/* Per-tree blur is expensive when repeated hundreds of times;
                  the whole-plot shadow still grounds very dense forests. */}
              {!renderBudget.veryDense&&<ellipse cx={x} cy={y+1} rx={cr*1.25} ry={cr*0.42} fill="#000" opacity={0.16}
                filter={renderBudget.dense?undefined:`url(#${gardenSvgId}-soft)`}/>} 
              {/* Magical glow behind the canopy (premium skins) */}
              {skinDef?.magic && (
                <ellipse cx={x} cy={ty+h*0.15} rx={cr*Math.min(1.82,1.48+(footprint.effectBounds||1)*.24)}
                  ry={cr*Math.min(1.52,1.24+(footprint.effectBounds||1)*.2)} fill={skinDef.magic.glow} opacity={0.22}>
                  {animateDetails&&<animate attributeName="opacity" values="0.12;0.28;0.12" dur="4s" repeatCount="indefinite"/>}
                </ellipse>
              )}
              {/* Radiant tier: soft warm halo after dusk */}
              {eEvening && !skinDef?.magic && (
                <ellipse cx={x} cy={ty+h*0.12} rx={cr*1.7} ry={cr*1.4} fill="#FFE9B8" opacity={0.15}>
                  {animateDetails&&<animate attributeName="opacity" values="0.08;0.2;0.08" dur="5s" repeatCount="indefinite" begin={`${(tIdx%3)*0.8}s`}/>} 
                </ellipse>
              )}
              {/* Rooted tree group. Individual skin details can still animate,
                  but the whole grove no longer runs one sway timeline per tree. */}
              <g data-garden-tree-art="true" style={{transformOrigin:`${x}px ${y}px`}}>
                {/* Signature backdrops live inside the same base-pivot group as
                    the trunk and canopy, so every attached tier moves as one. */}
                {isFlagshipG && <FlagshipTreeDetails theme={skinDef.premiumTheme} cx={x} baseY={y}
                  canopyY={ty+h*0.15} r={cr} trunkH={h} tier={eTier} paused={!animateDetails} layer="back" seed={tIdx}/>} 
                {isMythicalG && <MythicalTreeDetails skinId={skinDef.id} cx={x} baseY={y}
                  canopyY={ty+h*0.15} r={cr} trunkH={h} tier={eTier} paused={!animateDetails} layer="back" seed={tIdx}/>} 
                {/* Trunk (hidden for food items; bamboo's stalks and palm's
                    leaning trunk are drawn as part of the crown/below instead) */}
                {!isFood && !isBambooG && !isPalmG && <path d={`M${x-1.5*tScale} ${ty+h*0.5} Q${x-2*tScale} ${ty+h*0.78} ${x-2.6*tScale} ${y-1.5} L${x-4*tScale} ${y} L${x+4*tScale} ${y} L${x+2.6*tScale} ${y-1.5} Q${x+2*tScale} ${ty+h*0.78} ${x+1.5*tScale} ${ty+h*0.5} Z`} fill={trunkC} opacity={0.95}/>}
                {isPalmG && (()=>{
                  const lean = h*0.30, bw=cr*0.24, tw=cr*0.1;
                  const topX = x+lean, topYp = ty;
                  const ctrlX = x+lean*0.32, ctrlY = ty+h*0.42;
                  return <path d={`M${x-bw/2} ${y} Q${ctrlX-bw*0.3} ${ctrlY} ${topX-tw/2} ${topYp} L${topX+tw/2} ${topYp} Q${ctrlX+bw*0.3} ${ctrlY} ${x+bw/2} ${y} Z`} fill={trunkC} opacity={0.95}/>;
                })()}
                <g data-garden-canopy="true">
                  {animateCanopy&&((isBambooG||isFood)
                    ? <animateTransform attributeName="transform" type="rotate"
                        values={`0 ${x} ${y};0 ${x} ${y};${0.9*(footprint.motionIntensity||.65)*((tIdx%2)?-1:1)} ${x} ${y};${-0.62*(footprint.motionIntensity||.65)*((tIdx%2)?-1:1)} ${x} ${y};0 ${x} ${y};0 ${x} ${y}`}
                        keyTimes="0;0.24;0.42;0.6;0.8;1" dur={`${7.5+(tIdx%4)}s`} begin={`${(tIdx%5)*-1.35}s`} repeatCount="indefinite"/>
                    : <animateTransform attributeName="transform" type="translate"
                        values={`0 0;0 0;${1.2*(footprint.motionIntensity||.65)*((tIdx%2)?-1:1)*tScale} ${-0.38*(footprint.motionIntensity||.65)*tScale};${-0.82*(footprint.motionIntensity||.65)*((tIdx%2)?-1:1)*tScale} ${-0.08*tScale};0 0;0 0`}
                        keyTimes="0;0.24;0.42;0.6;0.8;1" dur={`${7.5+(tIdx%4)}s`} begin={`${(tIdx%5)*-1.35}s`} repeatCount="indefinite"/>
                  )}
                  {crown}
                </g>
                {/* Enchanted Tree: ivy up the trunk + a toadstool ring at the base */}
                {skinDef?.magic?.enchanted && (
                  <g opacity={0.9}>
                    <path d={`M${x-cr*0.16} ${y} Q${x-cr*0.26} ${y-h*0.3} ${x-cr*0.1} ${y-h*0.5} Q${x+cr*0.06} ${y-h*0.7} ${x-cr*0.13} ${y-h*0.9}`}
                      stroke="#4F8F5A" strokeWidth={cr*0.05} fill="none" opacity={0.75}/>
                    {[[-cr*0.4,cr*0.12],[cr*0.34,cr*0.09]].map(([dx,s],i)=>(
                      <path key={i} d={`M${x+dx-4*s} ${y} Q${x+dx-4*s} ${y-5*s} ${x+dx} ${y-5*s} Q${x+dx+4*s} ${y-5*s} ${x+dx+4*s} ${y} Z`} fill="#E8557A"/>
                    ))}
                  </g>
                )}
                {/* Magical overlay: crescent moon + gold stars */}
                {skinDef?.magic && (()=>{
                  const m=skinDef.magic, my=ty+h*0.1;
                  return (
                    <g>
                      {m.moon && (
                        <g>
                          <circle cx={x} cy={my} r={cr*0.5} fill="#FFF3C4"/>
                          <circle cx={x+cr*0.18} cy={my-cr*0.08} r={cr*0.44} fill={color}/>
                        </g>
                      )}
                      {m.stars && [[-0.6,-0.1],[0.55,-0.35],[-0.2,-0.55],[0.3,0.15]].map(([dx,dy],i)=>{
                        const sx=x+dx*cr, sy=my+dy*cr, sr=cr*0.16;
                        return <path key={i} d={`M${sx},${sy-sr} L${sx+sr*0.3},${sy-sr*0.3} L${sx+sr},${sy} L${sx+sr*0.3},${sy+sr*0.3} L${sx},${sy+sr} L${sx-sr*0.3},${sy+sr*0.3} L${sx-sr},${sy} L${sx-sr*0.3},${sy-sr*0.3} Z`} fill="#FFD34D" opacity={animateDetails?undefined:0.72}>
                          {animateDetails&&<animate attributeName="opacity" values="0.5;1;0.5" dur={`${2+(i%3)}s`} repeatCount="indefinite" begin={`${(i%3)*0.4}s`}/>} 
                        </path>;
                      })}
                      {m.enchanted && [[-0.5,-0.1],[0.5,-0.4],[-0.1,-0.6]].map(([dx,dy],i)=>{
                        const fx=x+dx*cr, fy=my+dy*cr;
                        return <circle key={`ff${i}`} cx={fx} cy={fy} r={cr*0.05} fill="#D8F5A2" opacity={animateDetails?0.9:0.62}>
                          {animateDetails&&<animate attributeName="opacity" values="0.35;0.95;0.35" dur={`${3+i*0.6}s`} repeatCount="indefinite" begin={`${i*0.5}s`}/>} 
                        </circle>;
                      })}
                      {m.storm && (()=>{
                        const boltX = x+cr*0.1;
                        const d = `M${boltX-cr*0.08} ${my-cr*0.5} L${boltX+cr*0.08} ${my-cr*0.1} L${boltX-cr*0.04} ${my+cr*0.3} L${boltX+cr*0.09} ${my+cr*0.55} L${boltX-cr*0.03} ${y-2}`;
                        return (
                          <g opacity={animateDetails?0:0.18}>
                            {animateDetails&&<animate attributeName="opacity" values="0;0;1;0.3;1;0;0;0" keyTimes="0;0.38;0.4;0.43;0.46;0.49;0.75;1" dur={`${5.5+(tIdx%3)}s`} repeatCount="indefinite" begin={`${(tIdx%5)*0.4}s`}/>} 
                            <path d={d} stroke="#EAF2FF" strokeWidth={cr*0.05} fill="none" strokeLinejoin="round" strokeLinecap="round"/>
                          </g>
                        );
                      })()}
                    </g>
                  );
                })()}
                {/* Flourish: richer lobes so upgraded trees read at a glance */}
                {!hasSignatureG && eTier>=1 && !isFood && (
                  <g>
                    <circle cx={x-cr*0.38} cy={ty+h*0.24} r={cr*0.36} fill={eDeep} opacity={0.5}/>
                    <circle cx={x+cr*0.42} cy={ty+h*0.18} r={cr*0.32} fill={eDeep} opacity={0.45}/>
                    <circle cx={x-cr*0.12} cy={ty-cr*0.28} r={cr*0.26} fill="#fff" opacity={0.28}/>
                  </g>
                )}
                {/* Radiant: a companion suited to THIS skin (or the shape's
                    default bird/garnish), resting on the real anchor point
                    computed above — same logic as the large TreeSVG preview. */}
                {!hasSignatureG && eTier>=3 && (tIdx%2===0) && (()=>{
                  const perch = perchFor(shape);
                  const companion = SKIN_COMPANIONS[skinDef?.id];
                  const kind = companion ? companion.kind : perch.kind;
                  const isGround = !!companion?.ground;
                  let ax, ay, f;
                  if (isGround) {
                    ax = x - cr*0.55; ay = y - 1; f = 1;
                  } else if (kind === "garnish") {
                    ax = x + perch.ax*cr*1.6; ay = ty + h*0.1 + perch.ay*cr*0.9; f = perch.face;
                  } else if (perchPoint) {
                    ax = perchPoint.x; ay = perchPoint.y; f = perchPoint.face;
                  } else {
                    ax = x + perch.ax*cr*1.6; ay = ty + h*0.1 + perch.ay*cr*0.9; f = perch.face;
                  }
                  return renderCompanionSmall(kind, ax, ay, f, cr, animateDetails);
                })()}
                {/* Front ornaments share the exact same sway transform too. */}
                <CollectibleTreeFinish skinId={skinDef?.id||"default"} shape={shape} cx={x} baseY={y}
                  canopyY={ty+h*.15} r={cr} canopyColor={color} trunkColor={trunkC}/>
                {isFlagshipG && <FlagshipTreeDetails theme={skinDef.premiumTheme} cx={x} baseY={y}
                  canopyY={ty+h*0.15} r={cr} trunkH={h} tier={eTier} paused={!animateDetails} layer="front" seed={tIdx}/>} 
                {isMythicalG && <MythicalTreeDetails skinId={skinDef.id} cx={x} baseY={y}
                  canopyY={ty+h*0.15} r={cr} trunkH={h} tier={eTier} paused={!animateDetails} layer="front" seed={tIdx}/>} 
                <ClassicTreeDetails skinId={skinDef?.id} cx={x} baseY={y} canopyY={ty+h*0.15} r={cr} tier={eTier}/>
                <TreeThemeDetails skinId={skinDef?.id||"default"} shape={shape} cx={x} baseY={y}
                  canopyY={ty+h*0.15} r={cr} tier={eTier}/>
              </g>
              {/* Living: something gently falls from the crown */}
              {showFall && (()=>{
                const dur = 6 + (tIdx%3)*1.5, delay = (tIdx%5)*1.4;
                const px = x + ((tIdx%2)?-1:1)*cr*0.3, py = ty + h*0.15, sz = Math.max(1.6, cr*0.16);
                const shapeEl = ePart.kind==="petal"
                  ? <path d={`M${px} ${py} q${sz} -${sz*0.8} 0 -${sz*1.7} q-${sz} ${sz} 0 ${sz*1.7}`} fill={ePart.color}/>
                  : ePart.kind==="star"
                    ? <path d={`M${px},${py-sz} L${px+sz*0.35},${py-sz*0.35} L${px+sz},${py} L${px+sz*0.35},${py+sz*0.35} L${px},${py+sz} L${px-sz*0.35},${py+sz*0.35} L${px-sz},${py} L${px-sz*0.35},${py-sz*0.35} Z`} fill={ePart.color}/>
                    : ePart.kind==="sparkle"
                      ? <circle cx={px} cy={py} r={sz*0.55} fill={ePart.color}/>
                      : <path d={`M${px} ${py} q${sz*0.9} -${sz*0.9} 0 -${sz*1.9} q-${sz*0.9} ${sz} 0 ${sz*1.9}`} fill={ePart.color}/>;
                return (
                  <g opacity="0">
                    <animate attributeName="opacity" values="0;0.8;0.8;0" keyTimes="0;0.15;0.75;1" dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite"/>
                    <animateTransform attributeName="transform" type="translate"
                      values={`0 0; ${cr*0.4} ${(y-py)*0.55}; ${-cr*0.2} ${y-py}`} keyTimes="0;0.5;1"
                      dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite"
                      calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/>
                    {shapeEl}
                  </g>
                );
              })()}
            </g>
          );
        })}

        {/* Two small paper-plane routes replace the outdoor bird flock. They
            reuse the bounded transform-only flight paths, keeping the room
            lively without introducing another animation system. */}
        {renderBudget.ambientFlock&&[0,1].map(flight=>{
          const bodyColor=tod.name==="night"?"#D3E3F1":tod.name==="dusk"?"#FFF0D8":"#F7F2E2";
          const foldColor=tod.name==="night"?"#8FAFD3":tod.name==="dusk"?"#C9927F":"#92A99C";
          const flockScale=(renderBudget.veryDense ? .7 : renderBudget.dense ? .76 : .84)*(flight ? .9 : 1);
          const direction=flight?-1:1;
          return <g key={`flock-${flight}`} data-garden-flock="true"
            className={`sg-garden-flock sg-garden-flock--${flight?"b":"a"}`}
            style={{"--sg-flight-duration":`${flockSeconds+flight*5}s`,"--sg-flight-delay":`${flight?-flockSeconds*.56:-flockSeconds*.08}s`}}>
            <g opacity={tod.name==="night" ? .68 : tod.name==="dusk" ? .82 : .8}
              transform={`translate(0 ${31+flight*16}) scale(${direction*flockScale} ${flockScale})`}>
              {GARDEN_BIRD_SPECS.slice(0,renderBudget.ambientBirdsPerFlight).map((bird,index)=><g
                key={`bird-${flight}-${index}`} data-garden-bird="true" transform={`translate(${bird.x} ${bird.y}) scale(${bird.scale})`}>
                <g className="sg-garden-bird-motion" style={{
                  "--sg-bird-bob":`${-bird.bob}px`,"--sg-bob-duration":`${bird.bobDur+flight*.45}s`,
                  "--sg-bob-delay":`${bird.bobDelay-flight*.35}s`,"--sg-bird-tilt-a":bird.tiltA,"--sg-bird-tilt-b":bird.tiltB,
                }}>
                  <path d="M-10 -4 L10 0 L-10 4 L-5 .2 Z" fill={bodyColor} stroke={foldColor} strokeWidth=".6" strokeLinejoin="round"/>
                  <path d="M-5 .2 L10 0 L-1 2.3 Z" fill={foldColor} opacity=".72"/>
                  <path d="M-9 -3.2 L-2 -.1" stroke="#fff" strokeWidth=".7" opacity=".7"/>
                </g>
              </g>)}
            </g>
          </g>;
        })}

        {/* One shared daytime butterfly route adds life to uncrowded groves
            without multiplying an effect per tree. Premium/tree-specific
            particles remain handled by each skin's existing renderer. */}
        {tod.name!=="night"&&renderBudget.ambientButterfly&&<g data-garden-butterfly="true" opacity=".72" pointerEvents="none">
          <animateTransform attributeName="transform" type="translate"
            values="42 158;96 139;156 151;226 126;304 145;356 116"
            keyTimes="0;.18;.39;.62;.82;1" dur="21s" repeatCount="indefinite"
            calcMode="spline" keySplines=".35 0 .65 1;.35 0 .65 1;.35 0 .65 1;.35 0 .65 1;.35 0 .65 1"/>
          <g>
            <ellipse cx="-2.2" cy="-1" rx="3" ry="1.8" fill="#E7B85A" transform="rotate(-28)">
              <animateTransform attributeName="transform" type="rotate" values="-35 0 0;-8 0 0;-35 0 0" dur="1.15s" repeatCount="indefinite"/>
            </ellipse>
            <ellipse cx="2.2" cy="-1" rx="3" ry="1.8" fill="#F0CB77" transform="rotate(28)">
              <animateTransform attributeName="transform" type="rotate" values="35 0 0;8 0 0;35 0 0" dur="1.15s" begin="-.17s" repeatCount="indefinite"/>
            </ellipse>
            <ellipse rx=".7" ry="2.1" fill="#755A38"/>
          </g>
        </g>}

        {/* Every crown receives a very faint sparkle, but all sparkles share
            one or two opacity timelines. Alternating isometric rows creates a
            gentle wave without adding per-tree animation work. */}
        {Array.from({length:renderBudget.treeShimmerPhases}).map((_,phase)=><g key={`tree-glints-${phase}`}
          opacity="0" pointerEvents="none">
          <animate attributeName="opacity" values="0;0.08;0.32;0.1;0"
            keyTimes="0;0.24;0.43;0.66;1" dur="10s" begin={`${phase*4.6}s`} repeatCount="indefinite"/>
          {treeEffectPoints.filter(point=>point.phase===phase).map(point=>{
            const {x,y,size}=point;
            return <path key={point.key}
              d={`M${x} ${y-size*1.8} L${x+size*0.42} ${y-size*0.42} L${x+size*1.8} ${y} L${x+size*0.42} ${y+size*0.42} L${x} ${y+size*1.8} L${x-size*0.42} ${y+size*0.42} L${x-size*1.8} ${y} L${x-size*0.42} ${y-size*0.42} Z`}
              fill={tod.name==="night"?"#FFF0A8":tod.name==="dusk"?"#FFE2B8":"#FFFBEA"}/>
          })}
        </g>)}

        {/* Tooltip */}
        {hovered !== null && trees[hovered] && (() => {
          const tree  = trees[hovered];
          const subj  = subjectById.get(tree.subject)||{emoji:"🌱",label:"Session",color:"#56B68B"};
          const slotKey=treePositions[treeIds[hovered]];
          const [slotR,slotC]=(slotKey||"0-0").split("-").map(Number);
          const slot={r:slotR,c:slotC};
          const tx    = isoX(slot?.c??3, slot?.r??3);
          const ty    = isoY(slot?.c??3, slot?.r??3) - 40 * tScale;
          const date  = new Date(tree.ts).toLocaleDateString("en-AU",{day:"numeric",month:"short"});
          return (
            <g className="sg-tip-fade">
              <rect x={tx-50} y={ty-28} width={100} height={32} rx={8} fill="#1a1a2e" opacity={0.92}/>
              <text x={tx} y={ty-16} textAnchor="middle" fill="#fff" fontSize={10} fontWeight="600">
                {subj.emoji} {subj.label}
              </text>
              <text x={tx} y={ty-4} textAnchor="middle" fill="#aaa" fontSize={9}>
                {fmtMins(tree.secs)} · {date}
              </text>
            </g>
          );
        })()}

        {/* A shared sweep of sticky notes adds a brief classroom moment. */}
        {tod.name!=="night"&&renderBudget.ambientGust&&<g opacity="0.72">
          <animateTransform attributeName="transform" type="translate"
            values={`0 -90;0 -90;28 ${H+80};28 ${H+80}`}
            keyTimes={`0;${secondEventStart};${secondEventEnd};1`} dur={ambientCycle} repeatCount="indefinite"/>
          {[
            [45,0,-28,"#E9A987"],[132,-32,18,"#F1CF73"],[226,-7,42,"#C6A1C9"],[318,-44,-12,"#9EC7A7"]
          ].map(([x,y,rot,fill],i)=><g key={`gust${i}`} transform={`translate(${x} ${y}) rotate(${rot})`}>
            <rect x="-5" y="-8" width="10" height="13" rx="1.2" fill={fill}/><path d="M-3 -4 H3 M-3 -1 H2" stroke="#fff" strokeWidth=".7" opacity=".62"/>
          </g>) }
        </g>}

        {/* Night events share the same schedule: fireflies rise first, then a
            tiny sampled star group twinkles. Neither creates per-dot timers. */}
        {tod.name==="night"&&renderBudget.ambientNightFireflies&&<g opacity="0.86">
          <animateTransform attributeName="transform" type="translate"
            values={`0 42;8 -45;0 ${H+90};0 ${H+90}`}
            keyTimes={`0;${firstEventEnd};${firstEventEnd+0.001};1`} dur={ambientCycle} repeatCount="indefinite"/>
          {[[72,145,1.4],[115,173,1],[246,153,1.5],[292,188,1.1]].map(([x,y,r],i)=><circle key={`firefly${i}`} cx={x} cy={y} r={r} fill="#FFE98A" opacity={0.55+(i%2)*0.25}/>) }
        </g>}
        {tod.name==="night"&&renderBudget.ambientNightTwinkle&&<g opacity="0">
          <animate attributeName="opacity" values="0;0;0.95;0.28;0;0"
            keyTimes={`0;${firstEventEnd};${secondEventStart};${(secondEventStart+secondEventEnd)/2};${secondEventEnd};1`}
            dur={ambientCycle} repeatCount="indefinite"/>
          {[[58,34,1.7],[186,24,1.4],[327,49,1.6]].map(([x,y,r],i)=><path key={`twinkle${i}`}
            d={`M${x} ${y-r*2} L${x+r*0.45} ${y-r*0.45} L${x+r*2} ${y} L${x+r*0.45} ${y+r*0.45} L${x} ${y+r*2} L${x-r*0.45} ${y+r*0.45} L${x-r*2} ${y} L${x-r*0.45} ${y-r*0.45} Z`}
            fill="#FFF4C2"/>) }
        </g>}

        {/* Final event: one large, filter-free light/shadow band crosses the
            whole scene. Dawn/dusk warm it; day uses a quiet cloud shadow. */}
        {renderBudget.ambientSweep&&!(tod.name==="night"&&renderBudget.constrained)&&<g
          opacity={tod.name==="night"?0.07:tod.name==="day"?0.055:0.085}
          style={{mixBlendMode:tod.name==="day"?"multiply":"screen"}}>
          <animateTransform attributeName="transform" type="translate"
            values={`-190 0;-190 0;${W+210} 0;${W+210} 0`}
            keyTimes={`0;${sweepEventStart};0.995;1`} dur={ambientCycle} repeatCount="indefinite"/>
          <ellipse cx="0" cy={H*0.58} rx="105" ry="210"
            fill={tod.name==="night"?"#AFCBFF":tod.name==="day"?"#395C55":"#FFD38A"}/>
        </g>}

        {/* Ambient colour wash for dawn/dusk/night */}
        {tod.ambA>0 && <rect x="-20" y="-20" width={W+40} height={H+100} fill={tod.amb} opacity={tod.ambA} style={{mixBlendMode:"soft-light"}}/>}

        {/* Vignette for depth */}
        <rect x="-20" y="-20" width={W+40} height={H+100} fill={`url(#${gardenSvgId}-vig)`}/>
      </svg>

      <div style={fg.footer}>
        <span style={fg.stat}>✨ {trees.length} growth moment{trees.length!==1?"s":""} this {range}</span>
        <span style={fg.stat}>⏱ {fmtHrs(trees.reduce((a,t)=>a+t.secs,0))} total</span>
      </div>
    </div>
  );
}

const fg = {
  wrap:{background:"#0f1f1a",borderRadius:18,padding:0,marginBottom:16,overflow:"hidden",boxShadow:"inset 0 0 0 1px rgba(255,255,255,0.06), 0 8px 24px rgba(0,0,0,0.18)",position:"relative",contain:"layout paint style"},
  footer:{display:"flex",justifyContent:"center",gap:20,padding:"8px 0 12px",background:"rgba(0,0,0,0.18)",backdropFilter:"blur(4px)"},
  stat:{fontSize:12,color:"rgba(255,255,255,0.82)",fontWeight:600},
};

// ── Garden editor ──────────────────────────────────────────────────────────────
const GARDEN_LAYOUT_PRESETS = [
  {id:"natural",label:"Open Classroom",icon:"🏫"},
  {id:"paths",label:"Study Aisles",icon:"↔"},
  {id:"showcase",label:"Front Row",icon:"✦"},
  {id:"ring",label:"Study Circle",icon:"◯"},
  {id:"trail",label:"Learning Path",icon:"〰"},
  {id:"clusters",label:"Subject Groups",icon:"📚"},
  {id:"compact",label:"Compact Class",icon:"▦"},
];

function buildGardenPresetPositions(presetId,placement){
  const size=placement.gridSize;
  const center=(size-1)/2;
  const hash=slot=>(slot.r*73+slot.c*151+13)%997;
  const distance=slot=>Math.hypot(slot.r-center,slot.c-center);
  const manhattan=slot=>Math.abs(slot.r-center)+Math.abs(slot.c-center);
  const middleCells=new Set([Math.floor(center),Math.ceil(center)]);
  const trailDistance=slot=>{
    const trailColumn=center+Math.sin((slot.r/(Math.max(1,size-1)))*Math.PI*2.2)*Math.max(1,size*.2);
    return Math.abs(slot.c-trailColumn);
  };
  const order=[...placement.slots];

  order.sort((a,b)=>{
    if(presetId==="paths"){
      const aPath=middleCells.has(a.r)||middleCells.has(a.c);
      const bPath=middleCells.has(b.r)||middleCells.has(b.c);
      return Number(aPath)-Number(bPath)||hash(a)-hash(b)||a.key.localeCompare(b.key);
    }
    if(presetId==="showcase"){
      const score=slot=>Math.abs(slot.c-center)*1.35+Math.abs(slot.r-center)*.55;
      return score(a)-score(b)||distance(a)-distance(b)||hash(a)-hash(b);
    }
    if(presetId==="ring"){
      const radius=Math.max(1.35,size*.34);
      return Math.abs(distance(a)-radius)-Math.abs(distance(b)-radius)||hash(a)-hash(b);
    }
    if(presetId==="trail"){
      const aTrail=trailDistance(a)<.7;
      const bTrail=trailDistance(b)<.7;
      return Number(aTrail)-Number(bTrail)||hash(a)-hash(b)||a.key.localeCompare(b.key);
    }
    if(presetId==="clusters"){
      const quadrant=slot=>(slot.r<center?0:2)+(slot.c<center?0:1);
      return quadrant(a)-quadrant(b)||distance(a)-distance(b)||hash(a)-hash(b);
    }
    if(presetId==="compact"){
      return manhattan(a)-manhattan(b)||distance(a)-distance(b)||hash(a)-hash(b);
    }
    return hash(a)-hash(b)||a.key.localeCompare(b.key);
  });

  const treeEntries=placement.treeIds.map((id,index)=>({id,index,tree:placement.trees[index]}));
  if(presetId==="clusters"){
    treeEntries.sort((a,b)=>{
      const aGroup=`${a.tree?.skin||"default"}:${a.tree?.subject||""}`;
      const bGroup=`${b.tree?.skin||"default"}:${b.tree?.subject||""}`;
      return aGroup.localeCompare(bGroup)||a.index-b.index;
    });
  }
  const treePositions={};
  const decorPositions={};
  let cursor=0;
  treeEntries.forEach(({id})=>{
    const slot=order[cursor++];
    if(slot) treePositions[id]=slot.key;
  });
  placement.ownedDecor.forEach(decor=>{
    const slot=order[cursor++];
    if(slot) decorPositions[decor.id]=slot.key;
  });
  return {treePositions,decorPositions};
}

function GardenEditor({ sessions, subjects, decorations, layout, range, enhancements={}, onSave, onClose }) {
  const seed=buildGardenPlacement({sessions,decorations,layout,range,enhancements});
  const [draft,setDraft]=useState(()=>({
    ...layout,
    treePositions:{...(layout?.treePositions||{}),...seed.treePositions},
    decorPositions:{...(layout?.decorPositions||{}),...seed.decorPositions},
    removedDecor:[...new Set([...(layout?.removedDecor||[]),...(layout?.hiddenDecor||[])])],
  }));
  const [selected,setSelected]=useState(null);
  const [activePreset,setActivePreset]=useState("");
  const [presetRowRef,presetEdge]=useHScroll(String(GARDEN_LAYOUT_PRESETS.length));
  const placement=buildGardenPlacement({sessions,decorations,layout:draft,range,enhancements});

  const moveItem=(item,targetSlot)=>{
    if(!item||!targetSlot) return;
    const sourceMap=item.type==="tree"?placement.treePositions:placement.decorPositions;
    const sourceSlot=sourceMap[item.id];
    if(sourceSlot===targetSlot){setSelected(null);return;}
    const treeIndex=placement.slotTree.get(targetSlot);
    const decorDef=placement.slotDecor.get(targetSlot);
    const occupant=treeIndex!==undefined
      ? {type:"tree",id:placement.treeIds[treeIndex]}
      : decorDef ? {type:"decor",id:decorDef.id} : null;

    setDraft(prev=>{
      const treePositions={...(prev.treePositions||{}),...placement.treePositions};
      const decorPositions={...(prev.decorPositions||{}),...placement.decorPositions};
      const targetMap=item.type==="tree"?treePositions:decorPositions;
      targetMap[item.id]=targetSlot;
      if(occupant&&sourceSlot){
        const occupantMap=occupant.type==="tree"?treePositions:decorPositions;
        occupantMap[occupant.id]=sourceSlot;
      }
      return {...prev,treePositions,decorPositions,hiddenTrees:[]};
    });
    setActivePreset("");
    setSelected(null);
  };

  const removeDecor=id=>{
    setDraft(prev=>{
      const decorPositions={...(prev.decorPositions||{})};
      delete decorPositions[id];
      return {
        ...prev,
        decorPositions,
        removedDecor:[...new Set([...(prev.removedDecor||[]),id])],
      };
    });
    setActivePreset("");
    setSelected(cur=>cur?.type==="decor"&&cur.id===id?null:cur);
  };

  const applyPreset=presetId=>{
    const nextPositions=buildGardenPresetPositions(presetId,placement);
    setDraft(prev=>{
      const treePositions={...(prev.treePositions||{})};
      const decorPositions={...(prev.decorPositions||{})};
      placement.treeIds.forEach(id=>delete treePositions[id]);
      placement.ownedDecor.forEach(decor=>delete decorPositions[decor.id]);
      return {
        ...prev,
        treePositions:{...treePositions,...nextPositions.treePositions},
        decorPositions:{...decorPositions,...nextPositions.decorPositions},
        hiddenTrees:[],
      };
    });
    setSelected(null);
    setActivePreset(presetId);
  };

  const save=()=>{
    const finalPlacement=buildGardenPlacement({sessions,decorations,layout:draft,range,enhancements});
    const next={
      ...draft,
      treePositions:{...(draft.treePositions||{}),...finalPlacement.treePositions},
      decorPositions:{...(draft.decorPositions||{}),...finalPlacement.decorPositions},
      hiddenTrees:[],hiddenDecor:[],treeOrder:[],decorOrder:[],
    };
    onSave(next);
  };

  const chooseOrMove=(e,item,key)=>{
    e.stopPropagation();
    if(selected && (selected.type!==item.type || selected.id!==item.id)) moveItem(selected,key);
    else setSelected(item);
  };
  const dragStart=(e,item)=>{
    e.dataTransfer.effectAllowed="move";
    const payload=JSON.stringify(item);
    e.dataTransfer.setData("text/plain",payload);
    e.dataTransfer.setData("application/json",payload);
    setSelected(item);
  };
  const drop=(e,key)=>{
    e.preventDefault();
    let item=selected;
    try{item=JSON.parse(e.dataTransfer.getData("application/json")||e.dataTransfer.getData("text/plain"))||item;}catch{}
    moveItem(item,key);
  };
  const editorSlots=[...placement.slots].sort((a,b)=>a.r-b.r||a.c-b.c);

  return <div style={sd.overlay} className="sg-overlay-anim" onClick={onClose}>
    <div style={{...sd.modal,maxHeight:"92vh",overflowY:"auto"}} className="sg-sheet-anim" onClick={e=>e.stopPropagation()}>
      <div style={ge.header}>
        <div><div style={sd.kicker}>CLASSROOM LAYOUT</div><h3 style={ge.title}>Arrange your classroom</h3></div>
        <button style={ge.iconBtn} onClick={onClose} aria-label="Close">×</button>
      </div>
      <p style={ge.help}>Drag a growth marker or decor onto another grid tile. On mobile, tap an item and then tap its destination.</p>
      <div style={ge.legend}><span>Growth markers show each style</span><span>× removes decor from view</span></div>
      <div style={ge.presetSection}>
        <div style={ge.presetHeading}>
          <span>Quick layouts</span>
          <span style={ge.presetHint}>Choose, then fine-tune</span>
        </div>
        <div style={ge.presetScroller}>
          <div ref={presetRowRef} style={ge.presets} role="group" aria-label="Classroom layout presets">
            {GARDEN_LAYOUT_PRESETS.map(preset=><button type="button" key={preset.id}
              style={{...ge.presetBtn,...(activePreset===preset.id?ge.presetBtnActive:{})}}
              aria-pressed={activePreset===preset.id}
              onClick={()=>applyPreset(preset.id)}>
              <span aria-hidden="true" style={ge.presetIcon}>{preset.icon}</span>
              <span>{preset.label}</span>
            </button>)}
          </div>
          {!presetEdge.atStart&&<span style={ge.presetFadeLeft}/>}
          {!presetEdge.atEnd&&<span style={ge.presetFadeRight}/>}
        </div>
      </div>

      <div style={{...ge.grid,gridTemplateColumns:`repeat(${placement.gridSize},minmax(0,1fr))`}}>
        {editorSlots.map(({key})=>{
          const tIndex=placement.slotTree.get(key);
          const tree=tIndex!==undefined?placement.trees[tIndex]:null;
          const decor=placement.slotDecor.get(key);
          const item=tree?{type:"tree",id:placement.treeIds[tIndex]}:decor?{type:"decor",id:decor.id}:null;
          const isSelected=item&&selected?.type===item.type&&selected?.id===item.id;
          const subj=tree?(subjects.find(x=>x.id===tree.subject)||{emoji:"✏️",color:"#56B68B"}):null;
          const skinDef=tree?(TREE_SKINS.find(skin=>skin.id===(tree.skin||"default"))||TREE_SKINS[0]):null;
          const treeTier=tree?Math.max(0,Math.min(3,Number(enhancements?.[skinDef.id])||0)):0;
          return <div key={key} style={{...ge.tile,...(isSelected?ge.tileSelected:{})}}
            onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect="move";}}
            onDrop={e=>drop(e,key)}
            onClick={()=>selected&&moveItem(selected,key)}>
            {tree&&<div draggable style={ge.item} onDragStart={e=>dragStart(e,item)} onClick={e=>chooseOrMove(e,item,key)}
              title={`${skinDef.name} — drag or tap to move`} role="button" tabIndex={0}
              aria-label={`Move ${skinDef.name} growth marker`}
              onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();chooseOrMove(e,item,key);}}}>
              <span style={{...ge.treeThumb,background:`linear-gradient(160deg,${subj.color}20,#F7FBF5)`}}>
                <TreeSVG progress={1} color={subj.color} paused skin={skinDef.id} enhance={treeTier} thumbnail/>
              </span>
              <span style={ge.itemSub}>{subj.emoji}</span>
            </div>}
            {decor&&<div draggable style={ge.item} onDragStart={e=>dragStart(e,item)} onClick={e=>chooseOrMove(e,item,key)} title={`Drag ${decor.name}`}>
              <span style={ge.decorEmoji}>{decor.emoji||"🌿"}</span>
              <button style={ge.removeBtn} onClick={e=>{e.stopPropagation();removeDecor(decor.id);}} aria-label={`Remove ${decor.name}`}>×</button>
            </div>}
          </div>;
        })}
      </div>

      <p style={ge.removeNote}>Removed decor stays owned. Add it back from Classroom Decor whenever you like.</p>
      <div style={ge.actions}>
        <button style={ge.cancelBtn} onClick={onClose}>Cancel</button>
        <button style={ge.saveBtn} onClick={save}>Save layout</button>
      </div>
    </div>
  </div>;
}

const ge={
  header:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12},
  title:{fontSize:19,fontWeight:750,color:"#1a1a2e",margin:"3px 0 0",letterSpacing:"-0.3px"},
  iconBtn:{width:32,height:32,borderRadius:10,border:"1px solid #E7ECE5",background:"#F8FAF7",color:"#738078",fontSize:20,cursor:"pointer",lineHeight:1},
  help:{fontSize:12.5,color:"#758078",lineHeight:1.55,margin:"12px 0 10px"},
  legend:{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap",fontSize:10.5,color:"#8A958C",marginBottom:12},
  presetSection:{margin:"0 0 12px"},
  presetHeading:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,fontSize:11.5,fontWeight:750,color:"#526159",margin:"0 2px 7px"},
  presetHint:{fontSize:10,fontWeight:550,color:"#929B95"},
  presetScroller:{position:"relative",width:"100%",minWidth:0,overflow:"hidden"},
  presets:{display:"flex",width:"100%",gap:7,overflowX:"auto",overflowY:"hidden",scrollbarWidth:"none",overscrollBehaviorInline:"contain",padding:"1px 1px 6px",cursor:"grab",scrollSnapType:"x proximity",WebkitOverflowScrolling:"touch"},
  presetFadeLeft:{position:"absolute",left:0,top:0,bottom:6,width:28,background:"linear-gradient(90deg,#fff,rgba(255,255,255,0))",pointerEvents:"none"},
  presetFadeRight:{position:"absolute",right:0,top:0,bottom:6,width:28,background:"linear-gradient(270deg,#fff,rgba(255,255,255,0))",pointerEvents:"none"},
  presetBtn:{flex:"0 0 auto",minHeight:40,display:"inline-flex",alignItems:"center",gap:6,padding:"7px 11px",border:"1px solid #DDE7DA",borderRadius:18,background:"#fff",color:"#657169",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",scrollSnapAlign:"start"},
  presetBtnActive:{borderColor:"#77AA88",background:"#EAF5ED",color:"#2D6A4F",boxShadow:"0 0 0 2px rgba(45,106,79,.08)"},
  presetIcon:{fontSize:13,lineHeight:1},
  grid:{display:"grid",gap:5,padding:10,background:"linear-gradient(155deg,#F1DEC1,#DAB98E)",border:"1px solid #D4B78E",borderRadius:16,overflow:"hidden",width:"100%",maxWidth:404,margin:"0 auto",boxShadow:"inset 0 0 0 1px rgba(255,255,255,.42)"},
  tile:{aspectRatio:"1 / 1",minWidth:0,border:"1px solid rgba(132,89,50,.18)",borderRadius:8,background:"linear-gradient(145deg,#EACB98,#C99863)",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",transition:"transform .12s,border-color .12s,box-shadow .12s",cursor:"pointer"},
  tileSelected:{border:"2px solid #2D6A4F",boxShadow:"0 0 0 2px rgba(45,106,79,.14)",transform:"scale(.96)"},
  item:{width:"88%",height:"88%",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",cursor:"grab",userSelect:"none"},
  treeThumb:{width:"88%",height:"88%",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",boxShadow:"inset 0 0 0 1px rgba(255,255,255,.5),0 2px 5px rgba(0,0,0,.12)",pointerEvents:"none"},
  itemSub:{position:"absolute",right:0,bottom:-1,fontSize:10,background:"rgba(255,255,255,.88)",borderRadius:8,padding:"1px 3px"},
  decorEmoji:{fontSize:20,filter:"drop-shadow(0 2px 2px rgba(0,0,0,.14))"},
  removeBtn:{position:"absolute",top:-5,right:-5,width:18,height:18,borderRadius:"50%",border:"1px solid #E3E7E1",background:"#fff",color:"#8B5E58",fontSize:13,lineHeight:1,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0},
  removeNote:{fontSize:10.5,color:"#7C887F",lineHeight:1.45,margin:"10px 2px 0"},
  actions:{display:"flex",gap:8,marginTop:16},
  cancelBtn:{flex:1,padding:"12px 0",border:"1px solid #E3E8E1",background:"#F8FAF7",borderRadius:12,fontSize:13,fontWeight:650,color:"#6E7971",cursor:"pointer"},
  saveBtn:{flex:1,padding:"12px 0",border:"none",background:"#2D6A4F",borderRadius:12,fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer",boxShadow:"0 3px 10px rgba(45,106,79,.18)"},
};

// ── Analytics ─────────────────────────────────────────────────────────────────
function AnalyticsPanel({ user, subjects, decorations, targets, enhancements={}, gardenLayout={}, onSaveGardenLayout }) {
  const [range,setRange]=useState("week");
  const [history,setHistory]=useState(null);
  const [editingGarden,setEditingGarden]=useState(false);

  useEffect(()=>{
    fbLoadHistory(user).then(setHistory);
  },[user]);

  if(history===null) return <p style={S.empty}>Loading analytics...</p>;

  const now=new Date();
  let rangeStart, bars;

  // Each bucket tracks total + per-subject seconds, so bars stack by subject
  const mkBuckets = n => Array.from({length:n}, ()=>({ total:0, bySubj:{} }));
  const addTo = (b,s) => { b.total += s.secs; b.bySubj[s.subject] = (b.bySubj[s.subject]||0) + s.secs; };
  const toSegments = bySubj => Object.entries(bySubj)
    .map(([id,secs])=>{
      const subj = subjects.find(x=>x.id===id) || { color:"#aaa", emoji:"✏️", label:"(removed)" };
      return { id, color:subj.color, emoji:subj.emoji, label:subj.label, value:secs };
    })
    .sort((a,b)=>b.value-a.value);

  if(range==="week"){
    rangeStart=startOfWeek(now);
    const t=mkBuckets(7);
    history.forEach(s=>{const d=new Date(s.ts);if(d>=rangeStart)addTo(t[getStudyDayOfWeek(d)],s);});
    bars=t.map((b,i)=>({label:DAY_LABELS[i],value:b.total,segments:toSegments(b.bySubj)}));
  } else if(range==="month"){
    rangeStart=startOfMonth(now);
    const dim=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
    const buckets=mkBuckets(dim);  // one bucket per calendar day
    history.forEach(s=>{
      const d=new Date(s.ts);
      if(d>=rangeStart&&d.getMonth()===now.getMonth())
        addTo(buckets[d.getDate()-1],s);
    });
    // Label every 5th day (1, 5, 10, …) plus the last day, blank otherwise
    bars=buckets.map((b,i)=>{
      const day=i+1;
      const showLabel = day===1 || day%5===0 || day===dim;
      return {
        label:showLabel?String(day):"",
        tip:`${MONTH_LABELS[now.getMonth()]} ${day}`,
        value:b.total,
        segments:toSegments(b.bySubj),
      };
    });
  } else {
    rangeStart=startOfYear(now);
    const t=mkBuckets(12);
    history.forEach(s=>{const d=new Date(s.ts);if(d>=rangeStart)addTo(t[d.getMonth()],s);});
    bars=t.map((b,i)=>({label:MONTH_LABELS[i],value:b.total,segments:toSegments(b.bySubj)}));
  }

  const inRange=history.filter(s=>new Date(s.ts)>=rangeStart);
  const totalSecs=inRange.reduce((a,s)=>a+s.secs,0);
  const count=inRange.length;
  const avg=count>0?Math.round(totalSecs/count):0;
  const activeDays=new Set(inRange.map(s=>startOfDay(new Date(s.ts)).getTime())).size;

  const subjTotals={};
  inRange.forEach(s=>{subjTotals[s.subject]=(subjTotals[s.subject]||0)+s.secs;});
  const subjRows=Object.entries(subjTotals)
    .map(([id,secs])=>{
      const subj=subjects.find(x=>x.id===id)||{emoji:"✏️",label:"(removed)",color:"#aaa"};
      return {...subj,secs,pct:totalSecs>0?secs/totalSecs:0};
    })
    .sort((a,b)=>b.secs-a.secs);

  // ── Balance nudge ───────────────────────────────────────────────────────────
  // Builds a gentle suggestion toward the most-neglected ACTIVE subject. We look
  // at every current subject (not just ones studied), since a subject with zero
  // time is the strongest neglect signal. If weekly targets are set we measure
  // neglect as furthest-below-target; otherwise as lowest share of total time.
  const balanceNudge = (()=>{
    if(!subjects.length || totalSecs<600) return null;       // need a little data first
    const hasTargets = targets && Object.values(targets).some(v=>v>0);
    const rows = subjects.map(s=>{
      const secs = subjTotals[s.id]||0;
      const pct  = totalSecs>0 ? secs/totalSecs : 0;
      let deficit;
      if(hasTargets && targets[s.id]>0){
        // for week view compare to weekly target; month/year scale the target up
        const mult = range==="week"?1 : range==="month"?4.3 : 52;
        const goalSecs = targets[s.id]*3600*mult;
        deficit = goalSecs>0 ? (goalSecs-secs)/goalSecs : 0;   // 1 = nothing done
      } else {
        const fairShare = 1/subjects.length;
        deficit = (fairShare-pct)/fairShare;                   // >0 = below fair share
      }
      return { ...s, secs, pct, deficit };
    });
    const worst = rows.slice().sort((a,b)=>b.deficit-a.deficit)[0];
    const best  = rows.slice().sort((a,b)=>b.secs-a.secs)[0];
    // Only nudge if the gap is real and the two subjects differ
    if(!worst || worst.deficit < 0.34 || worst.id===best.id) return null;
    return { worst, best, hasTargets };
  })();

  return (
    <div>
      <div style={S.toggleRow}>
        {[["week","Week"],["month","Month"],["year","Year"]].map(([id,lbl])=>(
          <button key={id} style={{...S.toggleBtn,...(range===id?S.toggleBtnActive:{})}}
            onClick={()=>setRange(id)}>{lbl}</button>
        ))}
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",margin:"0 0 9px"}}><button style={S.arrangeGardenBtn} onClick={()=>setEditingGarden(true)}><span style={{fontSize:13}}>↔</span> Arrange</button></div>
      <ForestGarden sessions={inRange} subjects={subjects} range={range} decorations={decorations} enhancements={enhancements} layout={gardenLayout}/>
      {editingGarden&&<GardenEditor sessions={inRange} subjects={subjects} decorations={decorations} layout={gardenLayout} range={range} enhancements={enhancements} onClose={()=>setEditingGarden(false)} onSave={next=>{onSaveGardenLayout(next);setEditingGarden(false);}}/>}
      <div style={an.statRow}>
        <div style={an.statCard}><div style={an.statVal}>{fmtHrs(totalSecs)}</div><div style={an.statLbl}>Total focus</div></div>
        <div style={an.statCard}><div style={an.statVal}>{count}</div><div style={an.statLbl}>Sessions</div></div>
        <div style={an.statCard}><div style={an.statVal}>{activeDays}</div><div style={an.statLbl}>Active days</div></div>
        <div style={an.statCard}><div style={an.statVal}>{fmtMins(avg)}</div><div style={an.statLbl}>Avg session</div></div>
      </div>
      <h3 style={an.subTitle}>{range==="week"?"This week by day":range==="month"?"This month by day":"This year by month"} <span style={{fontSize:10,fontWeight:400,color:"#aaa"}}>· coloured by subject</span></h3>
      <BarChart bars={bars} maxVal={Math.max(...bars.map(b=>b.value),1)} color="#56B68B"/>
      <h3 style={an.subTitle}>By subject</h3>
      {balanceNudge && (
        <div style={{...an.nudge,borderColor:balanceNudge.worst.color+"55",background:balanceNudge.worst.color+"0D"}}>
          <span style={an.nudgeIcon}>🌱</span>
          <div style={{flex:1}}>
            <div style={an.nudgeTitle}>
              {balanceNudge.worst.emoji} {balanceNudge.worst.label} could use some love
            </div>
            <div style={an.nudgeBody}>
              {balanceNudge.worst.secs===0
                ? `No ${balanceNudge.worst.label} time yet this ${range}`
                : `Only ${fmtHrs(balanceNudge.worst.secs)} this ${range}`}
              {" "}— you've put {fmtHrs(balanceNudge.best.secs)} into {balanceNudge.best.label}.
              {balanceNudge.hasTargets ? " A short session would help you hit your target." : " A short session would even things out."}
            </div>
          </div>
        </div>
      )}
      {subjRows.length===0&&<p style={S.empty}>No sessions in this period yet.</p>}
      {subjRows.map(row=>(
        <div key={row.label} style={an.subjRow}>
          <span style={{fontSize:20}}>{row.emoji}</span>
          <div style={{flex:1,marginLeft:10}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{row.label}</span>
              <span style={{fontSize:13,fontWeight:700,color:row.color}}>{fmtHrs(row.secs)} <span style={{color:"#bbb",fontWeight:400}}>({Math.round(row.pct*100)}%)</span></span>
            </div>
            <div style={an.subjTrack}><div style={{...an.subjFill,width:`${row.pct*100}%`,background:row.color}}/></div>
          </div>
        </div>
      ))}
    </div>
  );
}

// A running clock lives at the App level, but analytics has no dependency on
// elapsed seconds. Keep this large chart + SVG subtree intact between ticks.
const MemoAnalyticsPanel=memo(AnalyticsPanel,(prev,next)=>
  prev.user===next.user&&
  prev.currentWeekKey===next.currentWeekKey&&
  prev.subjects===next.subjects&&
  prev.decorations===next.decorations&&
  prev.targets===next.targets&&
  prev.enhancements===next.enhancements&&
  prev.gardenLayout===next.gardenLayout
);

const an = {
  statRow:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:18},
  statCard:{background:"#fff",borderRadius:14,padding:"13px 6px 11px",textAlign:"center",boxShadow:"0 1px 3px rgba(0,0,0,0.05)",border:"1px solid #F0F3EE"},
  statVal:{fontSize:18,fontWeight:800,color:"#1a1a2e",letterSpacing:"-0.5px"},
  statLbl:{fontSize:9.5,color:"#9AA79A",marginTop:4,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.4px"},
  subTitle:{fontSize:14,fontWeight:700,color:"#1a1a2e",margin:"4px 0 10px"},
  subjRow:{display:"flex",alignItems:"center",background:"#fff",borderRadius:12,padding:"11px 14px",marginBottom:8,boxShadow:"0 1px 3px rgba(0,0,0,0.05)"},
  nudge:{display:"flex",alignItems:"flex-start",gap:10,border:"1.5px solid",borderRadius:14,padding:"12px 14px",marginBottom:10},
  nudgeIcon:{fontSize:18,lineHeight:1.2,flexShrink:0},
  nudgeTitle:{fontSize:13,fontWeight:700,color:"#1a1a2e",marginBottom:3},
  nudgeBody:{fontSize:12,color:"#777",lineHeight:1.45},
  subjTrack:{height:6,background:"#F0F2EE",borderRadius:10,overflow:"hidden"},
  subjFill:{height:"100%",borderRadius:10,transition:"width 0.4s ease"},
};

// ── Leaderboard ───────────────────────────────────────────────────────────────
// Build the {year-Wnn} key + a friendly label for a week N weeks ago
function weekKeyForOffset(offset, now=new Date()){
  const week = shiftStudyWeek(now,-offset);
  const ws = week.start;
  const we = new Date(week.endExclusive.getTime()-1);
  const fmt = x => formatStudyDate(x,{day:"numeric",month:"short"});
  return {
    key:week.key,
    label:offset===0?"This week":offset===1?"Last week":`${offset} weeks ago`,
    rangeLabel:`${fmt(ws)} – ${fmt(we)}`,
    weekStart:ws,
  };
}

// ── Visit a friend's garden ───────────────────────────────────────────────────
// Clash-of-Clans style: tap anyone on the leaderboard to walk through their
// grove. Loads their sessions + prefs (their subjects colour their trees, their
// skins render, their decorations show). Read-only, smooth sheet.
function VisitGarden({ username, viewerSubjects, onClose }) {
  const [load,setLoad]=useState({status:"loading",data:null,error:""});
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let off=false;
    let timer=null;
    const visitUser=canonUsername(username);
    setLoad({status:"loading",data:null,error:""});
    const timeout=new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(new Error("timeout")),12000);
    });
    Promise.race([
      Promise.all([fbLoadHistory(visitUser),fbLoadPrefs(visitUser)]),
      timeout,
    ]).then(([hist,prefs])=>{
      if(off)return;
      clearTimeout(timer);
      // A repaired/imported history row can contain malformed values. Do not
      // let one bad friend's row crash the whole mobile sheet.
      const history=(Array.isArray(hist)?hist:[])
        .filter(s=>s&&Number.isFinite(Number(s.ts))&&Number.isFinite(Number(s.secs)))
        .map(s=>({...s,ts:Number(s.ts),secs:Math.max(0,Number(s.secs))}));
      setLoad({status:"ready",error:"",data:{
        history,
        decorations:(prefs&&Array.isArray(prefs.decorations))?prefs.decorations:[],
        subjects:(prefs&&Array.isArray(prefs.subjects)&&prefs.subjects.length)?prefs.subjects:viewerSubjects,
        enhancements:(prefs&&prefs.enhancements&&typeof prefs.enhancements==="object"&&!Array.isArray(prefs.enhancements))?prefs.enhancements:{},
        gardenLayout:(prefs&&prefs.gardenLayout&&typeof prefs.gardenLayout==="object"&&!Array.isArray(prefs.gardenLayout))?prefs.gardenLayout:{},
      }});
    }).catch(err=>{
      if(off)return;
      clearTimeout(timer);
      console.error("Friend grove load error:",err);
      setLoad({status:"error",data:null,error:"Their classroom took too long to load. Check your connection and try again."});
    });
    return()=>{off=true;clearTimeout(timer);};
  },[username,attempt]);

  const data=load.data;
  const hist=data?.history||[];
  const lifeSecs=hist.reduce((a,s)=>a+s.secs,0);
  const monthStart=startOfMonth(new Date());
  const inMonth=hist.filter(s=>new Date(s.ts)>=monthStart);

  return (
    <div style={sd.overlay} className="sg-overlay-anim" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{...sd.modal,boxSizing:"border-box",maxHeight:"min(92dvh,760px)",WebkitOverflowScrolling:"touch",overscrollBehavior:"contain",paddingBottom:"calc(24px + env(safe-area-inset-bottom))"}}
        className="sg-sheet-anim" onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`${username}'s Classroom`}>
        <div style={sd.header}>
          <div>
            <div style={sd.kicker}>VISITING</div>
            <h3 style={sd.title}>🏫 {username}'s Classroom</h3>
          </div>
          <button style={sd.x} onClick={onClose} aria-label="Close friend's classroom">✕</button>
        </div>
        {load.status==="loading" ? (
          <div style={{textAlign:"center",padding:"30px 0"}} aria-live="polite">
            <div className="sg-skeleton" style={{height:180,width:"100%",borderRadius:18,marginBottom:12}}/>
            <p style={{color:"#888",margin:0}}>Joining the classroom… 🏫</p>
          </div>
        ) : load.status==="error" ? (
          <div style={{textAlign:"center",padding:"24px 8px"}} role="alert">
            <div style={{fontSize:30,marginBottom:8}}>🌧️</div>
            <p style={{color:"#667067",fontSize:13,lineHeight:1.55,margin:"0 0 14px"}}>{load.error}</p>
            <button style={{...sd.doneBtn,width:"auto",margin:"0 auto",padding:"11px 22px"}} onClick={()=>setAttempt(n=>n+1)}>Try again</button>
          </div>
        ) : hist.length===0 ? (
          <p style={{textAlign:"center",color:"#888",padding:"36px 0",lineHeight:1.6}}>Their classroom journey is just getting started ✨</p>
        ) : (
          <>
            <ForestGarden sessions={inMonth} subjects={data.subjects} range="month" decorations={data.decorations} enhancements={data.enhancements} layout={data.gardenLayout}/>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:14}}>
              <span style={{fontSize:12,fontWeight:700,color:"#2D6A4F",background:"#EAF3EC",borderRadius:16,padding:"7px 13px"}}>✨ {inMonth.length} growth moments this month</span>
              <span style={{fontSize:12,fontWeight:700,color:"#666",background:"#F0F2EE",borderRadius:16,padding:"7px 13px"}}>⏳ {fmtHrs(lifeSecs)} all time</span>
            </div>
          </>
        )}
        <button style={sd.doneBtn} onClick={onClose}>Back to my classroom 🏫</button>
      </div>
    </div>
  );
}

function LeaderboardRows({entries,currentUser,subjects,onVisit,loading=false,emptyTitle="No study time yet",emptyBody="Complete a session to appear here."}){
  const podiumStyles=[gl.rankGold,gl.rankSilver,gl.rankBronze];
  if(loading)return <div style={gl.loadingRows}>{[0,1,2,3].map(i=><div key={i} style={gl.loadingRow}>
    <div className="sg-skeleton" style={{width:30,height:30,borderRadius:10}}/>
    <div className="sg-skeleton" style={{width:34,height:34,borderRadius:"50%"}}/>
    <div className="sg-skeleton" style={{height:11,flex:1}}/>
    <div className="sg-skeleton" style={{width:46,height:12}}/>
  </div>)}</div>;
  if(!entries.length)return <div style={gl.boardEmpty}><div style={{fontSize:28}}>📚</div><strong>{emptyTitle}</strong><span>{emptyBody}</span></div>;
  return entries.map((entry,i)=>{
    const isMe=canonUsername(entry.username)===canonUsername(currentUser);
    const topId=Object.entries(entry.subjects||{}).sort((a,b)=>b[1]-a[1])[0]?.[0];
    const topSubj=subjects.find(subject=>subject.id===topId);
    return <div key={entry.username} style={{...gl.boardRow,...(i<3?podiumStyles[i]:{}),...(isMe?gl.boardRowMe:{}),cursor:"pointer"}}
      className="sg-tap-card" onClick={()=>onVisit?.(entry.username)} title={`Visit ${entry.username}'s classroom`}>
      <div style={{...gl.rankBadge,...(i<3?gl.rankBadgePodium:{})}}>{i<3?["🥇","🥈","🥉"][i]:i+1}</div>
      <div style={{...gl.avatar,background:isMe?"#4F9D73":"#E6EEE7",color:isMe?"#fff":"#506258"}}>{entry.username.slice(0,1).toUpperCase()}</div>
      <div style={gl.boardIdentity}>
        <div style={{...gl.boardUsername,color:isMe?"#2D6A4F":"#1A2E22"}}>{entry.username}{isMe&&<span style={gl.youTag}>you</span>}</div>
        <div style={gl.boardMeta}>{entry.sessions} session{entry.sessions!==1?"s":""}{topSubj&&<span> · {topSubj.emoji} {topSubj.label}</span>}</div>
      </div>
      <div style={gl.focusTime}><strong style={{fontSize:13,color:"#23372A"}}>{fmtMins(entry.totalSecs)}</strong><span style={{fontSize:8.5,color:"#9AA39C"}}>focused</span></div>
    </div>;
  });
}

function LeaderboardWeekNavigator({weekOffset,onChange}){
  const week=weekKeyForOffset(weekOffset);
  return <div style={S.weekNav} aria-label="Leaderboard week">
    <button style={S.weekNavBtn} onClick={()=>onChange(weekOffset+1)} aria-label="Show an older week" title="Older week">
      <span style={S.weekNavArrow} aria-hidden="true">‹</span><span>Older</span>
    </button>
    <div style={S.weekNavCenter}>
      <span style={S.weekNavLabel}>{week.label}</span>
      <span style={S.weekNavRange}>{week.rangeLabel}</span>
    </div>
    <button style={{...S.weekNavBtn,...(weekOffset<=1?S.weekNavBtnDisabled:{})}} disabled={weekOffset<=1}
      onClick={()=>onChange(Math.max(1,weekOffset-1))} aria-label="Show a newer week" title="Newer week">
      <span>Newer</span><span style={S.weekNavArrow} aria-hidden="true">›</span>
    </button>
  </div>;
}

function WeeklyGroupRewardCard({group,weeklyEntries,rewardDate=new Date(),historical=false}){
  const eligibility=groupRewardEligibility(group,weeklyEntries);
  const rewardMode=getWeeklyRewardMode(rewardDate);
  const rewardPlan=getWeeklyRewardPlan(rewardDate);
  const title=rewardMode==="skin"?"Mystery character week":rewardMode==="classroom"?"Classroom collection week":"Coin reward week";
  return <div style={{...S.rewardCard,marginBottom:10}}>
    <div style={S.rewardCardTop}><div style={S.rewardCardTitle}>{title}</div><div style={S.rewardCycleBadge}>3-week rotation</div></div>
    <div style={S.rewardPrizeRow}>{rewardPlan.map(prize=><div key={prize.place} style={{...S.rewardPrize,...(prize.type!=="coins"?S.rewardPrizeSkin:{})}}>
      <span style={S.rewardMedal}>{prize.medal}</span><span style={S.rewardPlace}>{prize.place}</span>
      <span style={prize.type!=="coins"?S.rewardSkin:S.rewardCoins}>{prize.type==="skin"?"🎁 Random style":prize.type==="background"?"🌙 Background":prize.type==="decoration"?"🏫 Classroom décor":`+${prize.coins} 🪙`}</span>
    </div>)}</div>
    <div style={{...gl.rewardEligibility,...(eligibility.eligible?gl.rewardEligible:{})}}>
      {eligibility.eligible?(historical?"✓ Eligibility reached":"✓ Reward eligible"):`${eligibility.participantCount}/${eligibility.minimum} participating members`}
      <span>{eligibility.eligible
        ? historical?" This group's podium qualified for that week's prizes.":" Prizes settle after the Sunday reset."
        : historical?" This group did not reach the five-participant minimum.":" Five members must study this week to unlock prizes."}</span>
    </div>
  </div>;
}

function FriendsLeaderboardPanel({ data, currentUser, loading, subjects, onVisit, network, currentWeekKey }) {
  const [view,setView]=useState("weekly");
  const [weekOffset,setWeekOffset]=useState(1);
  const [pastEntries,setPastEntries]=useState([]);
  const [pastLoading,setPastLoading]=useState(false);
  const [managing,setManaging]=useState(false);
  const [friendUsername,setFriendUsername]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{
    if(view!=="past")return;
    let live=true;
    setPastLoading(true);
    fbLoadWeekBoard(weekKeyForOffset(weekOffset).key).then(rows=>{
      if(live){setPastEntries(rows);setPastLoading(false);}
    });
    return()=>{live=false;};
  },[view,weekOffset,currentWeekKey]);
  const sourceEntries=view==="past"?pastEntries:(data[view]||[]);
  const entries=useMemo(()=>filterBoardForFriends(sourceEntries,currentUser,network.friends),[sourceEntries,currentUser,network.friends]);
  const showLoading=view==="past"?pastLoading:loading;
  const run=async action=>{
    if(busy)return false;
    setBusy(true);setError("");
    try{const result=await action();if(!result?.ok){setError(result?.error||"Something went wrong.");return false;}return true;}
    finally{setBusy(false);}
  };
  const send=async()=>{
    if(await run(()=>fbSendFriendRequest(currentUser,friendUsername)))setFriendUsername("");
  };
  const respond=async(request,accept)=>{await run(()=>fbRespondFriendRequest(currentUser,request.id,accept));};
  const cancel=async request=>{await run(()=>fbCancelFriendRequest(request.id));};
  const remove=async friend=>{
    if(!window.confirm(`Remove ${friend.username} from your friends?`))return;
    await run(()=>fbRemoveFriend(currentUser,friend));
  };
  return (
    <div>
      <div style={fr.hero}>
        <div><div style={fr.kicker}>YOUR STUDY CIRCLE</div><div style={fr.title}>Friends</div><div style={fr.subtitle}>Only accepted friends can see your status, subject and rankings.</div></div>
        <button style={gl.manageBtn} onClick={()=>setManaging(value=>!value)}>{managing?"Done":"Friend settings"}</button>
      </div>
      {managing&&<div style={gl.manageCard}><div style={fr.addRow}>
        <input style={gl.input} value={friendUsername} maxLength={20} onChange={event=>{setFriendUsername(event.target.value);setError("");}}
          onKeyDown={event=>event.key==="Enter"&&friendUsername.trim()&&send()} placeholder="Add by username" aria-label="Friend username"/>
        <button style={fr.addBtn} onClick={send} disabled={busy||!friendUsername.trim()}>{busy?"…":"Add"}</button>
      </div>
      {error&&<div style={/permission/i.test(error)?fr.notice:gl.error} role="status">
        {/permission/i.test(error)?"Friend requests are temporarily unavailable.":error}
      </div>}
      {network.error&&<div style={fr.notice} role="status">Friends are temporarily unavailable.</div>}

      {network.incoming.length>0&&<div style={fr.requestCard}>
        <div style={gl.sectionLabel}>FRIEND REQUESTS</div>
        {network.incoming.map(request=><div key={request.id} style={fr.requestRow}>
          <span style={fr.avatar}>{request.username.slice(0,1).toUpperCase()}</span><strong style={fr.requestName}>{request.username}</strong>
          <button style={gl.acceptBtn} disabled={busy} onClick={()=>respond(request,true)}>Accept</button>
          <button style={gl.declineBtn} disabled={busy} onClick={()=>respond(request,false)} aria-label={`Decline ${request.username}`}>×</button>
        </div>)}
      </div>}
      {network.outgoing.length>0&&<div style={fr.outgoing}>
        <span>Pending:</span>{network.outgoing.map(request=><span key={request.id} style={fr.pendingChip}>{request.username}<button onClick={()=>cancel(request)} disabled={busy} aria-label={`Cancel request to ${request.username}`}>×</button></span>)}
      </div>}
      {network.friends.length>0&&<div style={fr.friendList}>
        {network.friends.map(friend=><div key={friend.id} style={fr.friendChip}>
          <button style={fr.friendVisit} onClick={()=>onVisit?.(friend.username)} title={`Visit ${friend.username}'s classroom`}><span style={fr.friendDot}/>{friend.username}</button>
          <button style={fr.removeFriend} onClick={()=>remove(friend)} aria-label={`Remove ${friend.username}`}>×</button>
        </div>)}
      </div>}</div>}

      <div style={S.toggleRow}>
        {[["weekly","This Week"],["allTime","All Time"],["past","History"]].map(([id,lbl])=>(
          <button key={id} style={{...S.toggleBtn,...(view===id?S.toggleBtnActive:{})}}
            onClick={()=>setView(id)}>{lbl}</button>
        ))}
      </div>
      {view==="past"&&<LeaderboardWeekNavigator weekOffset={weekOffset} onChange={setWeekOffset}/>}
      <div style={fr.periodNote}>{view==="allTime"?"All-time rankings are private to your accepted friends.":weekKeyForOffset(view==="past"?weekOffset:0).rangeLabel}</div>
      <LeaderboardRows entries={entries} currentUser={currentUser} subjects={subjects} onVisit={onVisit} loading={showLoading}
        emptyTitle={network.friends.length?"No study time here yet":"Add a friend to build your leaderboard"}
        emptyBody={network.friends.length?(view==="past"?"No accepted friends recorded study time in this week.":"Complete a session to appear in this ranking."):"Open Friend settings to send a username request."}/>
    </div>
  );
}

const fr={
  hero:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,background:"linear-gradient(135deg,#EAF6EE,#F7F4FD)",border:"1px solid #D9E8DD",borderRadius:17,padding:"13px 14px",marginBottom:9},kicker:{fontSize:8.5,fontWeight:850,letterSpacing:1.1,color:"#6E9D7E"},title:{fontSize:18,fontWeight:850,color:"#20372A",marginTop:1},subtitle:{fontSize:10.5,color:"#7C8A81",lineHeight:1.4,marginTop:2},count:{width:48,height:48,borderRadius:15,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,.82)",color:"#2D6A4F",fontSize:17,fontWeight:850,boxShadow:"0 4px 12px rgba(45,106,79,.08)"},
  addRow:{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:7,marginBottom:9},addBtn:{border:0,borderRadius:11,background:"#2D6A4F",color:"#fff",padding:"0 15px",fontSize:11.5,fontWeight:750,cursor:"pointer"},requestCard:{background:"#fff",border:"1px solid #E0E8DE",borderRadius:13,padding:10,marginBottom:9},requestRow:{display:"grid",gridTemplateColumns:"32px minmax(0,1fr) auto 28px",gap:7,alignItems:"center",padding:"4px 0"},avatar:{width:32,height:32,borderRadius:10,display:"grid",placeItems:"center",background:"#EAF4EC",color:"#2D6A4F",fontWeight:800},requestName:{fontSize:12,color:"#2B3D31",overflow:"hidden",textOverflow:"ellipsis"},
  outgoing:{display:"flex",alignItems:"center",gap:5,overflowX:"auto",fontSize:9.5,color:"#8B958D",padding:"0 1px 9px"},pendingChip:{display:"inline-flex",alignItems:"center",gap:4,background:"#F1F4F0",borderRadius:12,padding:"4px 5px 4px 8px",fontWeight:700,color:"#647067",whiteSpace:"nowrap"},friendList:{display:"flex",gap:6,overflowX:"auto",padding:"0 1px 10px",scrollbarWidth:"thin"},friendChip:{display:"flex",alignItems:"center",flex:"0 0 auto",background:"#fff",border:"1px solid #E0E8DE",borderRadius:15,overflow:"hidden"},friendVisit:{display:"flex",alignItems:"center",gap:6,border:0,background:"transparent",padding:"7px 5px 7px 9px",fontSize:10.5,fontWeight:700,color:"#4E6255",cursor:"pointer"},friendDot:{width:7,height:7,borderRadius:"50%",background:"#34C759"},removeFriend:{border:0,background:"transparent",color:"#A0A8A2",fontSize:15,padding:"5px 8px 6px 4px",cursor:"pointer"},periodNote:{fontSize:9.5,color:"#89938C",padding:"1px 2px 7px",textAlign:"center"},empty:{display:"flex",flexDirection:"column",alignItems:"center",gap:4,textAlign:"center",background:"#fff",border:"1px dashed #CAD8C6",borderRadius:14,padding:"24px 16px",color:"#536158"},
  notice:{fontSize:10.5,color:"#718078",background:"#F2F5F1",border:"1px solid #E1E7DF",borderRadius:11,padding:"8px 10px",marginBottom:9,lineHeight:1.4},
};

function GroupLeaderboardPanel({ currentUser, subjects, onVisit, currentWeekKey }){
  const inviteFromUrl=()=>new URLSearchParams(window.location.search).get("group")?.toUpperCase()||"";
  const [groups,setGroups]=useState(null);
  const [groupsError,setGroupsError]=useState("");
  const [activeId,setActiveId]=useState(null);
  const [view,setView]=useState("weekly");
  const [weekOffset,setWeekOffset]=useState(1);
  const [boards,setBoards]=useState({weekly:[],allTime:[]});
  const [boardLoading,setBoardLoading]=useState(false);
  const [boardError,setBoardError]=useState("");
  const [pastBoard,setPastBoard]=useState([]);
  const [pastLoading,setPastLoading]=useState(false);
  const [pastError,setPastError]=useState("");
  const [pastAttempt,setPastAttempt]=useState(0);
  const [incomingInvites,setIncomingInvites]=useState([]);
  const [invitesLoading,setInvitesLoading]=useState(true);
  const [inviteLoadError,setInviteLoadError]=useState("");
  const [pendingInvites,setPendingInvites]=useState([]);
  const [form,setForm]=useState(inviteFromUrl()?"join":null);
  const [groupName,setGroupName]=useState("");
  const [inviteCode,setInviteCode]=useState(inviteFromUrl);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [copied,setCopied]=useState(false);
  const [managing,setManaging]=useState(false);
  const [transferTarget,setTransferTarget]=useState("");

  const reload=useCallback(async preferredId=>{
    const [groupResult,inbox]=await Promise.all([fbLoadGroups(currentUser),fbLoadGroupInvites(currentUser)]);
    const next=groupResult.groups||[];
    setGroups(next);
    setGroupsError(groupResult.ok?"":groupResult.error);
    setIncomingInvites(inbox.invites||[]);
    setInviteLoadError(inbox.ok?"":inbox.error);
    setInvitesLoading(false);
    setActiveId(current=>{
      const wanted=preferredId||current;
      return next.some(g=>g.id===wanted)?wanted:(next[0]?.id||null);
    });
  },[currentUser]);
  useEffect(()=>{reload();},[reload]);
  const active=groups?.find(g=>g.id===activeId)||null;
  useEffect(()=>{
    let live=true;
    if(!active){setBoards({weekly:[],allTime:[]});setBoardError("");setPendingInvites([]);return;}
    setBoardLoading(true);setBoardError("");
    Promise.all([fbLoadGroupBoard(active,"weekly"),fbLoadGroupBoard(active,"allTime"),fbLoadPendingGroupInvites(active)]).then(([weekly,allTime,pending])=>{
      if(live){
        setBoards({weekly:weekly.rows||[],allTime:allTime.rows||[]});
        setBoardError(weekly.ok&&allTime.ok?"":weekly.error||allTime.error);
        setPendingInvites(pending);setBoardLoading(false);
      }
    });
    return()=>{live=false;};
  },[active,currentWeekKey]);
  useEffect(()=>{
    let live=true;
    if(view!=="past"||!active){setPastBoard([]);setPastError("");return;}
    setPastLoading(true);setPastError("");
    const selectedWeek=weekKeyForOffset(weekOffset);
    fbLoadGroupBoard(active,"weekly",selectedWeek.key).then(result=>{
      if(live){setPastBoard(result.rows||[]);setPastError(result.ok?"":result.error);setPastLoading(false);}
    });
    return()=>{live=false;};
  },[active,view,weekOffset,currentWeekKey,pastAttempt]);

  const run=async action=>{
    if(busy)return null;
    setBusy(true);setError("");
    try{
      const result=await action();
      if(!result?.ok){setError(result?.error||"Something went wrong.");return null;}
      return result;
    }finally{setBusy(false);}
  };
  const create=async()=>{
    const result=await run(()=>fbCreateGroup(currentUser,groupName));
    if(!result)return;
    setGroupName("");setForm(null);await reload(result.group.id);
  };
  const join=async()=>{
    const result=await run(()=>fbJoinGroup(currentUser,inviteCode));
    if(!result)return;
    setInviteCode("");setForm(null);
    const url=new URL(window.location.href);url.searchParams.delete("group");window.history.replaceState({},"",url);
    await reload(result.group.id);
  };
  const acceptInvite=async invite=>{
    const result=await run(()=>fbAcceptGroupInvite(currentUser,invite.id));
    if(result)await reload(result.group.id);
  };
  const declineInvite=async invite=>{
    const result=await run(()=>fbDeclineGroupInvite(currentUser,invite.id));
    if(result)await reload(active?.id);
  };
  const cancelTargetedInvite=async invite=>{
    const result=await run(()=>fbCancelGroupInvite(currentUser,active.id,invite.id));
    if(result)await reload(active.id);
  };
  const shareInvite=async()=>{
    if(!active?.inviteCode)return;
    try{await navigator.clipboard.writeText(active.inviteCode);setCopied(true);setTimeout(()=>setCopied(false),1600);}
    catch{setError(`Copy this code: ${active.inviteCode}`);}
  };
  const refreshInvite=async()=>{
    const result=await run(()=>fbRefreshGroupInvite(currentUser,active));
    if(result)await reload(active.id);
  };
  const leave=async()=>{
    if(!window.confirm(`Leave ${active.name}?`))return;
    const result=await run(()=>fbLeaveGroup(currentUser,active.id));
    if(result)await reload();
  };
  const removeMember=async member=>{
    if(!window.confirm(`Remove ${member} from this group?`))return;
    const result=await run(()=>fbRemoveGroupMember(currentUser,active.id,member));
    if(result)await reload(active.id);
  };
  const transfer=async()=>{
    if(!transferTarget)return;
    if(!window.confirm(`Make ${transferTarget} the owner?`))return;
    const result=await run(()=>fbTransferGroup(currentUser,active.id,transferTarget));
    if(result){setTransferTarget("");setManaging(false);await reload(active.id);}
  };
  const removeGroup=async()=>{
    if(!window.confirm(`Delete ${active.name}? This removes the group for every member.`))return;
    const result=await run(()=>fbDeleteGroup(currentUser,active));
    if(result)await reload();
  };
  const owner=active&&canonUsername(active.owner)===canonUsername(currentUser);
  const board=view==="past"?pastBoard:(boards[view]||[]);
  const showBoardLoading=view==="past"?pastLoading:boardLoading;
  const showBoardError=view==="past"?pastError:boardError;
  const weeklyEligibility=groupRewardEligibility(active,boards.weekly);
  const displayedWeek=view==="past"?weekKeyForOffset(weekOffset):weekKeyForOffset(0);
  const displayedEligibility=groupRewardEligibility(active,view==="past"?pastBoard:boards.weekly);

  if(groups===null)return <div style={{padding:"24px 0"}}><div className="sg-skeleton" style={{height:120}}/></div>;
  return <div>
    {groupsError&&<div style={gl.errorState} role="alert"><strong>Couldn't load groups</strong><span>{groupsError}</span><button style={gl.retryBtn} onClick={()=>reload()}>Try again</button></div>}

    {!groupsError&&groups.length>1&&<div style={gl.groupTabs}>
      {groups.map(g=><button key={g.id} style={{...gl.groupTab,...(g.id===activeId?gl.groupTabOn:{})}} onClick={()=>{setActiveId(g.id);setManaging(false);setError("");}}>{g.name}</button>)}
    </div>}

    {active&&<>
      <div style={S.toggleRow}>
        {[["weekly","This Week"],["allTime","All Time"],["past","History"]].map(([id,label])=><button key={id}
          style={{...S.toggleBtn,...(view===id?S.toggleBtnActive:{})}} onClick={()=>setView(id)}>{label}</button>)}
      </div>
      {view==="past"&&<LeaderboardWeekNavigator weekOffset={weekOffset} onChange={setWeekOffset}/>}
      {view!=="allTime"&&(view!=="past"||!pastLoading)&&<WeeklyGroupRewardCard group={active} weeklyEntries={view==="past"?pastBoard:boards.weekly}
        rewardDate={displayedWeek.weekStart} historical={view==="past"}/>
      }
      <div style={gl.boardBar}>
        <span>{view==="allTime"?"All-time standings":view==="past"?"Past standings":"Weekly standings"}</span>
        <span>{view==="allTime"?"Since joining Lumora":displayedWeek.rangeLabel}</span>
      </div>
      {!showBoardLoading&&showBoardError&&<div style={gl.errorState} role="alert"><strong>Couldn't load standings</strong><span>{showBoardError}</span><button style={gl.retryBtn} onClick={()=>view==="past"?setPastAttempt(attempt=>attempt+1):reload(active.id)}>Try again</button></div>}
      {!showBoardError&&<LeaderboardRows entries={board} currentUser={currentUser} subjects={subjects} onVisit={onVisit} loading={showBoardLoading}
        emptyTitle={view==="weekly"?"No focus time this week":view==="past"?"No focus time that week":"No all-time focus time yet"}
        emptyBody={view==="weekly"?"Complete a session to enter this week's ranking.":view==="past"?"No group members recorded focus time during this week.":"Group members appear here after completing a session."}/>
      }
      {!showBoardLoading&&!showBoardError&&<div style={{...gl.badgeNote,...(view!=="allTime"&&displayedEligibility.eligible?gl.rewardEligibleNote:{})}}>
        {view!=="allTime"
          ? displayedEligibility.eligible
            ? view==="past"
              ? "🏆 This group reached reward eligibility for this week. The podium used that week's rotating prize plan."
              : "🏆 This group is reward eligible. The top three receive this week's rotating prizes after Sunday reset. Each user can receive one group prize, from their biggest eligible group."
            : `🔒 ${displayedEligibility.participantCount}/${displayedEligibility.minimum} members studied. Five participating members are required for rewards.`
          : "📚 All-time totals show this group's full study history and do not affect weekly rewards."}
      </div>}

      <div style={gl.detailsDivider}/>
      <div style={gl.headCard}>
        <div style={{minWidth:0}}>
          <div style={gl.kicker}>GROUP DETAILS</div>
          <div style={gl.name}>{active.name}</div>
          <div style={gl.memberCount}>{active.members?.length||0}/{GROUP_MAX_MEMBERS} members · {weeklyEligibility.participantCount} participating this week</div>
        </div>
        <button style={gl.manageBtn} onClick={()=>setManaging(v=>!v)}>{managing?"Done":"Group settings"}</button>
      </div>

      {managing&&<div style={gl.manageCard}>
        <div style={gl.inviteCard}>
          <div>
            <div style={gl.inviteLabel}>PERMANENT GROUP CODE</div>
            <div style={gl.inviteCode}>{active.inviteCode||"—"}</div>
            <div style={gl.inviteHint}>Share this code with people you want in this leaderboard.</div>
          </div>
          <button style={gl.copyBtn} onClick={shareInvite} disabled={!active.inviteCode}>{copied?"Copied ✓":"Copy code"}</button>
        </div>
        {pendingInvites.length>0&&<div style={gl.pendingList}>
          <div style={gl.sectionLabel}>EARLIER USERNAME INVITES</div>
          {pendingInvites.map(invite=><div key={invite.id} style={gl.pendingRow}>
            <span style={gl.pendingName}>{invite.invitedUser}</span>
            <span style={gl.pendingSender}>by {invite.createdBy}</span>
            {(owner||canonUsername(invite.createdBy)===canonUsername(currentUser))&&<button style={gl.cancelInviteBtn} onClick={()=>cancelTargetedInvite(invite)} disabled={busy}>Cancel</button>}
          </div>)}
        </div>}
        <div style={gl.manageTitle}>Members</div>
        {(active.members||[]).map(member=><div key={member} style={gl.memberRow}>
          <span>{member}{canonUsername(member)===canonUsername(active.owner)&&<span style={gl.ownerTag}>owner</span>}</span>
          {owner&&canonUsername(member)!==canonUsername(currentUser)&&<button style={gl.removeBtn} onClick={()=>removeMember(member)} disabled={busy}>Remove</button>}
        </div>)}
        {owner&&active.members?.length>1&&<div style={gl.transferRow}>
          <select style={gl.select} value={transferTarget} onChange={e=>setTransferTarget(e.target.value)}>
            <option value="">Transfer ownership…</option>
            {active.members.filter(m=>canonUsername(m)!==canonUsername(currentUser)).map(m=><option key={m} value={m}>{m}</option>)}
          </select>
          <button style={gl.smallBtn} disabled={!transferTarget||busy} onClick={transfer}>Transfer</button>
        </div>}
        <div style={gl.dangerRow}>
          {owner
            ? <><button style={gl.mutedBtn} onClick={refreshInvite} disabled={busy}>Replace invite</button><button style={gl.dangerBtn} onClick={removeGroup} disabled={busy}>Delete group</button></>
            : <button style={gl.dangerBtn} onClick={leave} disabled={busy}>Leave group</button>}
        </div>
      </div>}
    </>}

    <div style={gl.intro}>
      <div style={gl.introTitle}>Private Group Leaderboards</div>
      <div style={gl.introBody}>Create a named group and share its permanent code. Group standings reset every Sunday and never expose your friends list.</div>
    </div>

    {invitesLoading&&<div style={gl.inviteInbox}><div className="sg-skeleton" style={{height:54}}/></div>}
    {!invitesLoading&&incomingInvites.length>0&&<div style={gl.inviteInbox}>
      <div style={gl.sectionLabel}>PENDING INVITATIONS</div>
      {incomingInvites.map(invite=><div key={invite.id} style={gl.incomingRow}>
        <div style={gl.incomingIcon}>🏫</div>
        <div style={gl.incomingText}>
          <div style={gl.incomingName}>{invite.groupName||"Private group"}</div>
          <div style={gl.incomingMeta}>Invited by {invite.createdBy}</div>
        </div>
        <button style={gl.acceptBtn} onClick={()=>acceptInvite(invite)} disabled={busy}>Accept</button>
        <button style={gl.declineBtn} onClick={()=>declineInvite(invite)} disabled={busy} aria-label={`Decline invitation to ${invite.groupName||"group"}`}>×</button>
      </div>)}
    </div>}
    {inviteLoadError&&<div style={gl.error} role="alert">{inviteLoadError}</div>}

    {!groupsError&&!active&&<div style={gl.emptyCard}><div style={{fontSize:30}}>🌱</div><div style={gl.emptyTitle}>Start a private group</div><div style={gl.emptyBody}>Create one for classmates or enter an invite from someone you know.</div></div>}

    {error&&<div style={gl.error} role="alert">{error}</div>}
    {form==="create"&&<div style={gl.formCard}>
      <div style={gl.manageTitle}>Create a group leaderboard</div>
      <div style={gl.formHint}>Choose a name. Lumora will create the permanent eight-character code for you.</div>
      <input style={gl.input} value={groupName} maxLength={24} onChange={e=>setGroupName(e.target.value)} placeholder="Group name" autoFocus/>
      <div style={gl.formActions}><button style={gl.mutedBtn} onClick={()=>{setForm(null);setError("");}}>Cancel</button><button style={gl.primaryBtn} onClick={create} disabled={busy}>{busy?"Creating…":"Create"}</button></div>
    </div>}
    {form==="join"&&<div style={gl.formCard}>
      <div style={gl.manageTitle}>Join a group leaderboard</div>
      <div style={gl.formHint}>Enter the code shared by the group owner.</div>
      <input style={{...gl.input,textTransform:"uppercase",letterSpacing:2,fontWeight:800}} value={inviteCode} maxLength={8} onChange={e=>setInviteCode(e.target.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g,""))} placeholder="8-character code" autoFocus/>
      <div style={gl.formActions}><button style={gl.mutedBtn} onClick={()=>{setForm(null);setError("");}}>Cancel</button><button style={gl.primaryBtn} onClick={join} disabled={busy}>{busy?"Joining…":"Join"}</button></div>
    </div>}
    {!groupsError&&!form&&groups.length<GROUP_MAX_PER_USER&&<div style={gl.actionRow}>
      <button style={gl.secondaryBtn} onClick={()=>{setForm("create");setError("");}}>＋ Create group</button>
      <button style={gl.secondaryBtn} onClick={()=>{setForm("join");setError("");}}>⌁ Enter invite</button>
    </div>}
  </div>;
}

function LeaderboardHub({data,currentUser,loading,subjects,onVisit,currentWeekKey,network}){
  const [section,setSection]=useState("groups");
  return <div>
    <div style={{...S.toggleRow,marginBottom:12}}>
      <button style={{...S.toggleBtn,...(section==="groups"?S.toggleBtnActive:{})}} onClick={()=>setSection("groups")}>🔐 Groups</button>
      <button style={{...S.toggleBtn,...(section==="friends"?S.toggleBtnActive:{})}} onClick={()=>setSection("friends")}>👥 Friends</button>
    </div>
    {section==="groups"
      ? <GroupLeaderboardPanel currentUser={currentUser} subjects={subjects} onVisit={onVisit} currentWeekKey={currentWeekKey}/>
      : <FriendsLeaderboardPanel data={data} currentUser={currentUser} loading={loading} subjects={subjects} onVisit={onVisit} network={network} currentWeekKey={currentWeekKey}/>}
  </div>;
}

const MemoLeaderboardHub=memo(LeaderboardHub);

const gl={
  detailsDivider:{height:1,background:"#E3EAE2",margin:"18px 2px 12px"},
  intro:{background:"linear-gradient(135deg,#EDF7F0,#F8FBF6)",border:"1px solid #DCEBDD",borderRadius:14,padding:"11px 13px",marginBottom:10},
  introTitle:{fontSize:13.5,fontWeight:800,color:"#2D6A4F"},introBody:{fontSize:10.75,color:"#718076",lineHeight:1.45,marginTop:2},
  sectionLabel:{fontSize:9,fontWeight:800,letterSpacing:1,color:"#849188",marginBottom:6},
  inviteInbox:{background:"#fff",border:"1px solid #E1E9DE",borderRadius:13,padding:"10px",marginBottom:10},
  incomingRow:{display:"grid",gridTemplateColumns:"32px minmax(0,1fr) auto 28px",alignItems:"center",gap:8,padding:"5px 2px"},incomingIcon:{width:32,height:32,borderRadius:10,display:"grid",placeItems:"center",background:"#EAF4EC",fontSize:15},incomingText:{minWidth:0},incomingName:{fontSize:12.5,fontWeight:750,color:"#263D2D",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},incomingMeta:{fontSize:9.5,color:"#8A958D",marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},acceptBtn:{border:"none",background:"#2D6A4F",color:"#fff",borderRadius:10,padding:"7px 9px",fontSize:10.5,fontWeight:750,cursor:"pointer"},declineBtn:{width:28,height:28,border:"none",background:"#F2F4F1",color:"#849087",borderRadius:9,fontSize:17,cursor:"pointer",lineHeight:1},
  groupTabs:{display:"flex",gap:6,overflowX:"auto",maxWidth:"100%",padding:"0 1px 7px",scrollbarWidth:"thin"},groupTab:{maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flexShrink:0,border:"1px solid #DDE7D9",background:"#fff",borderRadius:18,padding:"7px 12px",fontSize:11.5,fontWeight:650,color:"#708076",cursor:"pointer"},groupTabOn:{background:"#E8F5EE",borderColor:"#BFE3CE",color:"#2D6A4F"},
  headCard:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,background:"#fff",border:"1px solid #E7ECE4",borderRadius:14,padding:"11px 13px",marginBottom:8},kicker:{fontSize:8.5,fontWeight:800,letterSpacing:1.1,color:"#7AA58B"},name:{fontSize:17,fontWeight:800,color:"#1A2E22",marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},memberCount:{fontSize:10,color:"#98A29A",marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},manageBtn:{border:"none",background:"#EEF4EC",borderRadius:15,padding:"7px 11px",fontSize:11,fontWeight:700,color:"#486351",cursor:"pointer",flexShrink:0},
  inviteCard:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,background:"#FFF9E9",border:"1px solid #F0E1B8",borderRadius:14,padding:"10px 12px",marginBottom:8,minWidth:0},inviteLabel:{fontSize:8.5,fontWeight:800,letterSpacing:.9,color:"#987E39"},inviteCode:{fontSize:17,fontWeight:900,letterSpacing:2.2,color:"#5C4A20",marginTop:1},inviteHint:{fontSize:9,color:"#A2946F",marginTop:2,lineHeight:1.3},copyBtn:{border:"none",background:"#fff",borderRadius:13,padding:"8px 10px",fontSize:10.25,fontWeight:750,color:"#796329",cursor:"pointer",boxShadow:"0 1px 3px rgba(90,70,20,.1)",flexShrink:0},
  rewardEligibility:{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap",fontSize:9.5,fontWeight:750,color:"#8B6D29",background:"#FFF8E6",border:"1px solid #F0DFAD",borderRadius:10,padding:"7px 9px",marginTop:8},rewardEligible:{color:"#2D6A4F",background:"#EAF6EE",borderColor:"#BFE2CC"},
  badgeNote:{fontSize:9.75,color:"#6E7D72",background:"#F4F8F2",borderRadius:10,padding:"8px 10px",lineHeight:1.4,marginTop:8},rewardEligibleNote:{color:"#2D6A4F",background:"#EAF6EE",border:"1px solid #CDE7D5"},manageCard:{background:"#F9FBF8",border:"1px solid #E7ECE4",borderRadius:13,padding:"11px",marginBottom:9},manageTitle:{fontSize:12.5,fontWeight:800,color:"#263D2D",marginBottom:7},inviteUserRow:{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:7,marginBottom:10},pendingList:{borderTop:"1px solid #E7ECE4",borderBottom:"1px solid #E7ECE4",padding:"9px 0 5px",marginBottom:10},pendingRow:{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto auto",alignItems:"center",gap:7,padding:"5px 1px",fontSize:11},pendingName:{fontWeight:700,color:"#405348",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},pendingSender:{color:"#9AA39C",fontSize:9.5},cancelInviteBtn:{border:"none",background:"#F5ECE9",color:"#9B5B51",borderRadius:9,padding:"4px 7px",fontSize:9.5,fontWeight:700,cursor:"pointer"},memberRow:{display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:12,color:"#536158",padding:"6px 2px",borderBottom:"1px solid #EDF1EA"},ownerTag:{fontSize:8.5,fontWeight:750,color:"#7A658F",background:"#F1EAF7",borderRadius:9,padding:"2px 6px",marginLeft:6},removeBtn:{border:"none",background:"#F8ECE9",color:"#A35B50",borderRadius:11,padding:"5px 8px",fontSize:9.5,cursor:"pointer"},transferRow:{display:"flex",gap:7,marginTop:9},select:{flex:1,minWidth:0,padding:"8px",border:"1px solid #DDE5DA",borderRadius:10,background:"#fff",fontSize:11},smallBtn:{border:"none",background:"#E8F5EE",color:"#2D6A4F",borderRadius:10,padding:"7px 10px",fontSize:10.5,fontWeight:700,cursor:"pointer"},dangerRow:{display:"flex",gap:7,justifyContent:"flex-end",marginTop:10},dangerBtn:{border:"none",background:"#F8EAE7",color:"#A14F46",borderRadius:11,padding:"7px 10px",fontSize:10,fontWeight:700,cursor:"pointer"},mutedBtn:{border:"none",background:"#EEF1EC",color:"#647066",borderRadius:11,padding:"8px 11px",fontSize:10.5,fontWeight:700,cursor:"pointer"},
  boardBar:{display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:10,color:"#859087",fontWeight:700,padding:"3px 3px 7px"},
  boardRow:{display:"grid",gridTemplateColumns:"30px 34px minmax(0,1fr) auto",alignItems:"center",gap:9,background:"#fff",border:"1px solid #E8EDE6",borderRadius:12,padding:"9px 10px",marginBottom:6,boxShadow:"0 1px 2px rgba(27,48,34,.035)",minWidth:0},boardRowMe:{background:"#F0F8F3",borderColor:"#B9DCC8",boxShadow:"inset 3px 0 0 #56A77A"},rankGold:{background:"#FFFCF2",borderColor:"#EAD8A1"},rankSilver:{background:"#FAFBFB",borderColor:"#D9DEDF"},rankBronze:{background:"#FFF9F5",borderColor:"#E4C7B2"},rankBadge:{width:28,height:28,display:"grid",placeItems:"center",borderRadius:9,background:"#F1F4F0",color:"#7D887F",fontSize:11,fontWeight:800},rankBadgePodium:{color:"#6C5C37",background:"rgba(255,255,255,.72)"},avatar:{width:34,height:34,borderRadius:"50%",display:"grid",placeItems:"center",fontSize:13,fontWeight:800},boardIdentity:{minWidth:0},boardUsername:{display:"flex",alignItems:"center",gap:5,minWidth:0,fontSize:12.5,fontWeight:750,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},youTag:{fontSize:8.5,fontWeight:800,color:"#2D6A4F",background:"#DCEFE3",borderRadius:8,padding:"2px 5px",flexShrink:0},boardMeta:{fontSize:9.5,color:"#98A19A",marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},focusTime:{display:"flex",flexDirection:"column",alignItems:"flex-end",minWidth:48},
  loadingRows:{paddingTop:2},loadingRow:{display:"grid",gridTemplateColumns:"30px 34px minmax(0,1fr) 46px",alignItems:"center",gap:9,padding:"10px",marginBottom:6},boardEmpty:{display:"flex",flexDirection:"column",alignItems:"center",gap:4,textAlign:"center",background:"#fff",border:"1px dashed #CAD8C6",borderRadius:14,padding:"24px 16px",color:"#536158"},errorState:{display:"flex",flexDirection:"column",alignItems:"center",gap:5,textAlign:"center",background:"#FFF7F5",border:"1px solid #F0D8D2",borderRadius:14,padding:"19px 15px",fontSize:11,color:"#8A5B53"},retryBtn:{border:"none",background:"#F3E4E0",color:"#8F5047",borderRadius:10,padding:"6px 10px",fontSize:10,fontWeight:700,cursor:"pointer"},
  emptyCard:{textAlign:"center",background:"#fff",border:"1px dashed #CAD8C6",borderRadius:15,padding:"24px 18px"},emptyTitle:{fontSize:15,fontWeight:800,color:"#263D2D",marginTop:6},emptyBody:{fontSize:11.5,color:"#8C978E",lineHeight:1.5,marginTop:4},error:{fontSize:11.5,color:"#A14F46",background:"#FBEDEA",borderRadius:11,padding:"9px 11px",marginTop:10},formCard:{background:"#fff",border:"1px solid #E4EAE1",borderRadius:14,padding:13,marginTop:10},formHint:{fontSize:10.5,color:"#849087",lineHeight:1.45,margin:"-2px 0 9px"},input:{display:"block",width:"100%",minWidth:0,padding:"9px 10px",border:"1.5px solid #DDE5DA",borderRadius:10,fontSize:12.5,outline:"none",background:"#fff"},formActions:{display:"flex",justifyContent:"flex-end",gap:7,marginTop:9},primaryBtn:{border:"none",background:"#2D6A4F",color:"#fff",borderRadius:11,padding:"8px 14px",fontSize:11.5,fontWeight:750,cursor:"pointer"},actionRow:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,marginTop:10},secondaryBtn:{minWidth:0,border:"1px solid #DCE6D9",background:"#fff",color:"#4F6757",borderRadius:12,padding:"10px 7px",fontSize:11,fontWeight:700,cursor:"pointer"},
};

// ── Progress level (lifetime-hours stages) ────────────────────────────────────
// Ten stages, each tied to a TOTAL lifetime study-hour threshold. A dot turns a
// light, gently glowing green once the user's lifetime hours pass that stage's
// upper bound — and every stage before it lights up with it. Connecting segments
// are green only when both neighbouring dots are green. Hovering a dot shows a
// small tab with the stage name and the hour range that unlocks it.
const MILESTONE_STAGES = [
  { name:"Infant",              min:0,    max:5, image:"/Images/Infant - No Backgorund.png", displayScale:1.62 },
  { name:"Primary School Student", min:5, max:15, image:"/Images/Primary school student - No Background.png", displayScale:1.74, displayOffsetX:4 },
  { name:"High School Student", min:15,   max:40, image:"/Images/High School Student - No Background.png", displayScale:2, displayOffsetY:-18 },
  { name:"University Student",  min:40,   max:100, image:"/Images/University student - No background.png", displayScale:2, displayOffsetY:-18 },
  { name:"School Teacher",      min:100,  max:200, image:"/Images/School Teacher - No background.png", displayScale:2, displayOffsetY:-18 },
  { name:"Researcher",          min:200,  max:500, image:"/Images/Researcher - No Background.png", displayScale:2, displayOffsetY:-18 },
  { name:"Professor",           min:500,  max:1000, image:"/Images/Professor - No Background.png", displayScale:2, displayOffsetY:-18 },
  { name:"Scholar",             min:1000, max:2500, image:"/Images/Scholar - No Background.png", displayScale:2, displayOffsetY:-18 },
  { name:"Philosopher",         min:2500, max:5000, image:"/Images/Philosopher - no background.png", displayScale:2, displayOffsetY:-18 },
  { name:"Sage",                min:5000, max:10000, image:"/Images/Sage - No Background.png", displayScale:2, displayOffsetY:-18 },
];
const getMilestoneReward = stage => Math.max(5,Math.round(stage.max));
const MILESTONE_GREEN = "#1FA34D"; // vivid saturated green
const MILESTONE_GREY  = "#C6CEC7"; // fully greyed-out locked stage
const MILESTONE_TIP_W = 40; // speech-bubble width as a percentage of the track
const mp = {
  cardOpen:{ position:"relative", background:"linear-gradient(155deg,#FFFFFF 0%,#FBFDFB 62%,#F5FAF6 100%)", border:"1px solid #DDE8DE", borderRadius:20, padding:"13px 14px 12px", marginTop:7, marginBottom:9, boxShadow:"0 8px 24px rgba(36,75,48,.075), inset 0 1px 0 rgba(255,255,255,.9)", overflow:"hidden" },
  cardClosed:{ position:"relative", background:"transparent", border:"none", borderRadius:15, padding:"0 2px 0", marginBottom:0 },
  header:{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:10 },
  title:{ fontSize:11, fontWeight:850, color:"#5B6B60", textTransform:"uppercase", letterSpacing:".7px" },
  hours:{ fontSize:11, fontWeight:850, color:"#245C43", background:"linear-gradient(135deg,#E4F4E9,#F4FAF5)", border:"1px solid #CFE7D6", borderRadius:12, padding:"6px 10px", marginTop:-3, marginRight:-4, whiteSpace:"nowrap", boxShadow:"0 2px 7px rgba(45,106,79,.09)" },
  track:{ position:"relative", display:"flex", alignItems:"center", padding:"12px 4px 13px" },
  dividerOpen:{ height:0, margin:"10px 0 0" },
  dividerClosed:{ height:0, margin:"5px 0 0" },
  seg:{ flex:"1 1 auto", minWidth:7, height:3, margin:"0 -8.5px", transition:"background .25s ease, box-shadow .25s ease" },
  dot:{ position:"relative", flex:"0 0 auto", width:17, height:17, borderRadius:"50%", cursor:"pointer", border:"none", padding:0, outline:"none", transition:"transform .15s ease, box-shadow .15s ease" },
  dotGreen:{ background:`radial-gradient(circle at 35% 30%, #63D68C, ${MILESTONE_GREEN} 62%)`, boxShadow:"0 0 8px rgba(55,165,91,.85), 0 0 16px rgba(55,165,91,.38)" },
  dotGrey:{ background:MILESTONE_GREY, opacity:.82 },
  dotSelected:{ boxShadow:"0 0 0 2px #fff, 0 0 0 4px rgba(45,106,79,.55)" },
  tipWrap:{ position:"absolute", top:"calc(100% + 9px)", width:`${MILESTONE_TIP_W}%`, zIndex:45, pointerEvents:"none" },
  tipBox:(unlocked)=>({ position:"relative", borderRadius:14, padding:"12px 14px", boxShadow:"0 10px 28px rgba(20,40,28,.18)", border:`1px solid ${unlocked?"#8AD0A0":"#BCC4BD"}`, background:unlocked?"#B4E7C4":"#DBE0DB", textAlign:"left" }),
  tipName:(unlocked)=>({ display:"block", fontSize:13, fontWeight:800, lineHeight:1.25, color:unlocked?"#163A25":"#39423B" }),
  tipRange:(unlocked)=>({ display:"block", fontSize:10.5, fontWeight:650, marginTop:3, color:unlocked?"#2E5A40":"#59625B" }),
  tipStatus:(unlocked)=>({ display:"block", fontSize:10.5, fontWeight:800, marginTop:4, color:unlocked?"#1F6B3A":"#A35D1F" }),
  tipArrow:(unlocked)=>({ position:"absolute", top:-9, width:0, height:0, borderLeft:"9px solid transparent", borderRight:"9px solid transparent", borderBottom:`9px solid ${unlocked?"#B4E7C4":"#DBE0DB"}` }),
  // Stages with artwork show it centred in the middle of the bubble:
  // title on top, hour range underneath, image in the middle, status below.
  tipBoxImage:(unlocked)=>({ ...mp.tipBox(unlocked), textAlign:"center" }),
    tipImageWrap:{ display:"block", width:"58%", maxWidth:132, margin:"10px auto 0" },
    tipImage:{ display:"block", width:"100%", height:"auto", borderRadius:12, boxShadow:"0 4px 10px rgba(20,40,28,.18)", border:"2px solid rgba(255,255,255,.75)" },
    carouselLayout:{ display:"grid", gridTemplateColumns:"repeat(3,minmax(0,1fr))", alignItems:"center", gap:10, padding:"2px 0 3px", minHeight:246, touchAction:"pan-y" },
    stageRail:{ display:"flex", flexDirection:"column", justifyContent:"center", width:"100%", minWidth:0, padding:"10px 4px", borderRadius:15, background:"rgba(239,247,241,.72)" },
    railStages:{ display:"flex", alignItems:"center", justifyContent:"center", gap:3, minWidth:0 },
    railStage:{ border:"none", background:"transparent", padding:3, cursor:"pointer", display:"grid", placeItems:"center", minWidth:0 },
    railCircle:{ width:20, height:20, borderRadius:"50%", border:"none", background:MILESTONE_GREY, opacity:.82, display:"grid", placeItems:"center", color:"#5D6860", fontSize:8.5, fontWeight:900, lineHeight:1, transition:"all .2s ease" },
    railCircleComplete:{ background:`radial-gradient(circle at 35% 30%, #63D68C, ${MILESTONE_GREEN} 62%)`, color:"#fff", opacity:1, textShadow:"0 1px 2px rgba(13,83,37,.42)", boxShadow:"0 0 7px rgba(55,165,91,.72), 0 0 13px rgba(55,165,91,.28)" },
    railCircleSelected:{ transform:"scale(1.18)", boxShadow:"0 0 0 2px #fff, 0 0 0 4px rgba(45,106,79,.42), 0 4px 10px rgba(45,106,79,.2)" },
    railCircleLocked:{ background:MILESTONE_GREY, opacity:.72 },
    railConnector:{ height:3, flex:"1 1 12px", minWidth:7, maxWidth:22, borderRadius:2, background:"#D5DDD4", transition:"background .2s ease, box-shadow .2s ease" },
    railConnectorComplete:{ background:MILESTONE_GREEN, boxShadow:"0 0 6px rgba(55,165,91,.35)" },
    railArrows:{ display:"flex", justifyContent:"center", gap:7, marginTop:13 },
    navBtn:{ border:"1px solid #D4E7D9", background:"#fff", color:"#2D6A4F", width:29, height:29, borderRadius:"50%", fontSize:16, fontWeight:800, cursor:"pointer", display:"grid", placeItems:"center", transition:"all .2s ease", boxShadow:"0 3px 8px rgba(45,106,79,.1)" },
    artColumn:{ display:"grid", gridTemplateRows:"198px auto", gap:8, width:"100%", minWidth:0, alignSelf:"center" },
    artPanel:{ position:"relative", display:"grid", justifyItems:"center", alignItems:"start", minWidth:0, borderRadius:18, background:"#fff", border:"1px solid #DDE7DE", overflow:"hidden", padding:"7px 5px 0", boxShadow:"0 8px 20px rgba(38,72,48,.09)" },
    // Preserve the entire source image. Anchoring the square artwork at the top
    // gives every stage identical 7px headroom without cropping any character.
    stageImage:{ display:"block", width:"100%", height:"auto", maxHeight:184, objectFit:"contain", objectPosition:"center top", transformOrigin:"center top", borderRadius:14, transition:"filter .25s ease, opacity .25s ease, transform .3s cubic-bezier(.22,1,.36,1)" },
    stageImageLocked:{ opacity:.68 },
    currentBadge:{ position:"absolute", left:9, top:9, background:"#2D6A4F", color:"#fff", fontSize:8, fontWeight:850, letterSpacing:".45px", textTransform:"uppercase", borderRadius:8, padding:"4px 7px" },
    detailPanel:{ display:"flex", flexDirection:"column", alignSelf:"center", width:"100%", minWidth:0, minHeight:170, borderRadius:16, background:"rgba(255,255,255,.86)", border:"1px solid #DEE8DF", padding:"14px 12px", boxShadow:"0 5px 14px rgba(38,72,48,.055)" },
    detailName:{ fontSize:16, fontWeight:850, lineHeight:1.16, color:"#213A29", marginTop:0 },
    detailRange:{ fontSize:10.5, fontWeight:650, color:"#7B887F", lineHeight:1.35, marginTop:5 },
    detailStatus:{ marginTop:"auto", fontSize:10.5, fontWeight:800, lineHeight:1.4, color:"#2D6A4F", background:"linear-gradient(135deg,#EAF6ED,#F4FAF5)", border:"1px solid #D9EBDE", borderRadius:11, padding:"8px 9px" },
    detailStatusLocked:{ color:"#895F35", background:"#F8F1E8" },
    rewardPanel:{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:7, minWidth:0, border:"1px solid #E9DDAE", background:"linear-gradient(135deg,#FFFDF5,#FFF8DF)", borderRadius:12, padding:"7px 8px", color:"#6F5D25", boxShadow:"0 3px 9px rgba(145,105,15,.07)" },
    rewardCopy:{ minWidth:0, fontSize:9, fontWeight:800, lineHeight:1.25 },
    rewardAmount:{ display:"block", color:"#A67812", fontSize:10.5, whiteSpace:"nowrap" },
    rewardBtn:{ border:"none", borderRadius:9, background:"#DFAE37", color:"#fff", padding:"6px 8px", fontSize:9, fontWeight:850, cursor:"pointer", whiteSpace:"nowrap", boxShadow:"0 2px 5px rgba(145,105,15,.18)" },
    rewardBtnDisabled:{ background:"#E4E1D7", color:"#98958B", boxShadow:"none", cursor:"default" },
    rewardLockedLabel:{ width:8, height:8, borderRadius:"50%", background:"#A9ADA8", display:"block" },
    allStageDots:{ display:"flex", gap:6, justifyContent:"center", alignItems:"center", marginTop:9, padding:"2px 4px" },
    allStageDot:{ width:7, height:7, borderRadius:"50%", border:"none", background:"#D0D8D1", cursor:"pointer", padding:0, transition:"all .2s ease" },
    allStageDotActive:{ width:20, borderRadius:4, background:"#2D6A4F" },
    allStageDotLocked:{ filter:"grayscale(1)", opacity:.5 },
  };

function MilestonePath({ history, claimedRewards=[], onClaimReward }) {
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [transitionDirection,setTransitionDirection] = useState("next");
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [claiming,setClaiming] = useState(false);
  const totalHours = Array.isArray(history)
    ? history.reduce((a,s)=>a+(Number(s.secs)||0),0)/3600
    : 0;
  const stageCount = MILESTONE_STAGES.length;
  const currentStageIndex = MILESTONE_STAGES.findIndex(stage => totalHours >= stage.min && totalHours < stage.max);
  const userCurrentStage = currentStageIndex === -1 ? stageCount - 1 : currentStageIndex;

  useEffect(() => {
    setCarouselIndex(userCurrentStage);
  }, [userCurrentStage]);

  // Always show three markers: selected in the middle where possible, and the
  // first/last three stages at the ends of the path.
  const railStart = Math.max(0, Math.min(carouselIndex - 1, stageCount - 3));
  const visibleStages = MILESTONE_STAGES.slice(railStart, railStart + 3)
    .map((stage, offset) => ({...stage, index:railStart + offset}));
  const selectedStage = MILESTONE_STAGES[carouselIndex];
  const selectedCompleted = totalHours >= selectedStage.max;
  const selectedLocked = totalHours < selectedStage.min;
  const rewardClaimed = claimedRewards.includes(carouselIndex);
  const rewardLocked = !selectedCompleted;
  const rewardAmount = getMilestoneReward(selectedStage);
  const stageSpan=Math.max(.001,selectedStage.max-selectedStage.min);
  const rawStageProgress=Math.max(0,Math.min(1,(totalHours-selectedStage.min)/stageSpan));
  // Colour arrives in deliberate 10% milestones; completed stages are fully vivid.
  const stageSaturation=selectedCompleted?1:Math.floor(rawStageProgress*10)/10;
  const stageColourFilter=`saturate(${stageSaturation})`;
  const selectStage=index=>{
    const nextIndex=Math.max(0,Math.min(stageCount-1,index));
    if(nextIndex===carouselIndex)return;
    setTransitionDirection(nextIndex>carouselIndex?"next":"prev");
    setCarouselIndex(nextIndex);
  };
  const goToPrev = () => selectStage(carouselIndex - 1);
  const goToNext = () => selectStage(carouselIndex + 1);
  const minSwipeDistance = 50;
  const onTouchStart = e => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX); };
  const onTouchMove = e => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => {
    if (touchStart === null || touchEnd === null) return;
    const distance = touchStart - touchEnd;
    if (distance > minSwipeDistance) goToNext();
    else if (distance < -minSwipeDistance) goToPrev();
  };

  const statusText = selectedCompleted
    ? "✓ Completed"
    : `${fmtRemaining(selectedStage.max - totalHours)} needed to complete`;
  const claimReward=async()=>{
    if(rewardLocked||rewardClaimed||claiming||!onClaimReward)return;
    setClaiming(true);
    try{await onClaimReward(carouselIndex);}finally{setClaiming(false);}
  };

  return (
    <section style={mp.cardOpen} aria-label="Progress level carousel">
      <div style={mp.header}>
        <span style={mp.title}>Progress level</span>
        <span style={mp.hours}>⏳ {fmtHrs(totalHours*3600)} lifetime</span>
      </div>
      <div className="sg-milestone-layout" style={mp.carouselLayout}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <div style={mp.stageRail}>
          <div style={mp.railStages}>
            {visibleStages.map((stage, index) => {
              const completed = totalHours >= stage.max;
              const locked = totalHours < stage.min;
              const selected = stage.index === carouselIndex;
              return <Fragment key={stage.index}>
                {index > 0 && <span style={{...mp.railConnector, ...(totalHours >= stage.min ? mp.railConnectorComplete : {})}} aria-hidden="true"/>}
                <button type="button" style={mp.railStage} onClick={() => selectStage(stage.index)}
                  aria-label={`View ${stage.name}`} aria-pressed={selected}>
                  <span style={{...mp.railCircle, ...(completed ? mp.railCircleComplete : {}), ...(locked ? mp.railCircleLocked : {}), ...(selected ? mp.railCircleSelected : {})}}>{stage.index+1}</span>
                </button>
              </Fragment>;
            })}
          </div>
          <div style={mp.railArrows}>
            <button type="button" style={{...mp.navBtn, opacity:carouselIndex===0?.3:1}} onClick={goToPrev}
              disabled={carouselIndex===0} aria-label="Previous stage">←</button>
            <button type="button" style={{...mp.navBtn, opacity:carouselIndex===stageCount-1?.3:1}} onClick={goToNext}
              disabled={carouselIndex===stageCount-1} aria-label="Next stage">→</button>
          </div>
        </div>

        <div key={`art-${carouselIndex}`} className={transitionDirection==="next"?"sg-milestone-art-next":"sg-milestone-art-prev"} style={mp.artColumn}>
          <div style={mp.artPanel}>
            <img className="sg-keepcolor" src={selectedStage.image} alt={selectedStage.name}
              style={{...mp.stageImage, transform:`translate(${selectedStage.displayOffsetX||0}px, ${selectedStage.displayOffsetY||0}px) scale(${selectedStage.displayScale||1})`, filter:`var(--sg-counter-filter) ${stageColourFilter}`, ...(!selectedCompleted ? mp.stageImageLocked : {})}} />
          </div>
          <div style={{...mp.rewardPanel, filter:stageColourFilter}}>
            <span style={mp.rewardCopy}>Stage reward <b style={mp.rewardAmount}>🪙 {rewardAmount.toLocaleString()}</b></span>
            <button type="button" onClick={claimReward} disabled={rewardLocked||rewardClaimed||claiming}
              style={{...mp.rewardBtn, ...((rewardLocked||rewardClaimed||claiming) ? mp.rewardBtnDisabled : {})}}>
              {rewardClaimed ? "Claimed" : rewardLocked ? <span style={mp.rewardLockedLabel} aria-label="Reward locked"/> : claiming ? "Claiming…" : "Claim"}
            </button>
          </div>
        </div>

        <div key={`details-${carouselIndex}`} className="sg-milestone-details" style={mp.detailPanel}>
          <strong style={mp.detailName}>{selectedStage.name}</strong>
          <span style={mp.detailRange}>({selectedStage.min}–{selectedStage.max} lifetime hours required)</span>
          <span style={{...mp.detailStatus, ...(selectedLocked ? mp.detailStatusLocked : {})}}>{statusText}</span>
        </div>
      </div>

      <div style={mp.allStageDots} aria-label="All milestone stages">
        {MILESTONE_STAGES.map((stage, index) => {
          const locked = totalHours < stage.min;
          return <button key={stage.name} type="button" onClick={() => selectStage(index)}
            aria-label={`View ${stage.name}`} aria-current={index===carouselIndex ? "step" : undefined}
            style={{...mp.allStageDot, ...(index===carouselIndex ? mp.allStageDotActive : {}), ...(locked ? mp.allStageDotLocked : {})}}/>;
        })}
      </div>
      <div aria-hidden="true" style={mp.dividerOpen}/>
    </section>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App({ weekRolloverToken = getStudyWeekKey() }) {
  const [user,setUser]=useState(null);
  const [authReady,setAuthReady]=useState(false);
  const [subjects,setSubjects]=useState(()=>lsGet(LS_SUBJECTS,DEFAULT_SUBJECTS));
  const [subject,setSubject]=useState(()=>lsRaw(LS_SUBJECT,"math"));
  const [mode,setMode]=useState(()=>lsRaw(LS_MODE,"timer"));
  const [duration,setDuration]=useState(25*60);
  const [timerStyle,setTimerStyle]=useState(()=>lsRaw(LS_TIMER_STYLE,"standard")==="pomodoro"?"pomodoro":"standard");
  const [pomodoro,setPomodoro]=useState(()=>createPomodoroState(lsGet(LS_POMODORO,{})));
  const [running,setRunning]=useState(false);
  const [paused,setPaused]=useState(false);
  const [elapsed,setElapsed]=useState(0);
  const [tab,setTab]=useState("timer");
  const studyWeekKey=weekRolloverToken;
  const [lb,setLb]=useState({weekly:[],allTime:[]});
  const [loading,setLoading]=useState(false);
  const [toast,setToast]=useState(null);
  const [showComplete,setShowComplete]=useState(null);
  const [showAddModal,setShowAddModal]=useState(false);
  const [editMode,setEditMode]=useState(false);
  const [modePickerOpen,setModePickerOpen]=useState(false); // timer/stopwatch chooser popover
  const [subjScrollRef, subjScrollEdge, scrollSubjects] = useHScroll(subjects.map(s=>`${s.id}:${s.label}`).join("|")); // wheel, drag and arrow access on desktop
  const [coins,setCoins]=useState(()=>lsGet(LS_COINS,0));
  const [claimedMilestoneRewards,setClaimedMilestoneRewards]=useState([]);
  const [showShop,setShowShop]=useState(false);
  const [showExamModal,setShowExamModal]=useState(false);
  const [editingAssessmentIndex,setEditingAssessmentIndex]=useState(null);
  const [assessmentError,setAssessmentError]=useState("");
  const [exams,setExams]=useState(()=>lsGet(LS_EXAMS,[]));
  const [activeSkin,setActiveSkin]=useState(()=>lsRaw(LS_SKIN,"default"));
  const [ownedSkins,setOwnedSkins]=useState(()=>lsGet("studygrove_owned_skins",["default"]));
  const [enhancements,setEnhancements]=useState(()=>lsGet("studygrove_enhancements",{})); // { skinId: tier 1-3 }
  const [theme,setTheme]=useState(()=>lsRaw(LS_THEME,"light"));
  const [animationMode,setAnimationMode]=useState(()=>normalizeAnimationMode(lsRaw(LS_ANIMATION_MODE,"device")));
  const [prefersReducedMotion,setPrefersReducedMotion]=useState(false);
  const [adminRoleVerified,setAdminRoleVerified]=useState(false);
  const [activeBackground,setActiveBackground]=useState(()=>{
    const cachedUser=lsRaw(LS_USER,"");
    return normalizeBackgroundId(lsRaw(backgroundCacheKey(cachedUser),DEFAULT_BACKGROUND_ID));
  });
  const [ownedBackgrounds,setOwnedBackgrounds]=useState(()=>{
    const cachedUser=lsRaw(LS_USER,"");
    return normalizeOwnedBackgrounds(lsGet(ownedBackgroundsCacheKey(cachedUser),[DEFAULT_BACKGROUND_ID]));
  });
  const [previewBackgroundId,setPreviewBackgroundId]=useState(null);
  const [targets,setTargets]=useState(()=>lsGet(LS_TARGETS,{}));   // { subjId: hoursPerWeek }
  const [presence,setPresence]=useState([]);                        // accepted friends online now
  const [friendNetwork,setFriendNetwork]=useState({friends:[],incoming:[],outgoing:[],loading:true,error:""});
  const [showTargets,setShowTargets]=useState(false);
  const [decorations,setDecorations]=useState(()=>lsGet(LS_DECOR,[]));   // owned decoration ids
  const [gardenLayout,setGardenLayout]=useState(()=>lsGet(LS_GARDEN_LAYOUT,{}));
  const [tasks,setTasks]=useState([]);
  const [tasksLoading,setTasksLoading]=useState(false);
  const [tasksError,setTasksError]=useState("");
  const [selectedTaskId,setSelectedTaskId]=useState(()=>lsRaw(LS_SELECTED_TASK,""));
  const [badges,setBadges]=useState(()=>lsGet(LS_BADGES,[]));            // unlocked badge ids
  const [showGardenShop,setShowGardenShop]=useState(false);
  const [showBackgroundShop,setShowBackgroundShop]=useState(false);
  const [showBadges,setShowBadges]=useState(false);
  const [showMenu,setShowMenu]=useState(false);       // header overflow menu
  const [showSessions,setShowSessions]=useState(false); // my-sessions self-edit panel
  const [showRecap,setShowRecap]=useState(false);     // weekly recap card
  const [showAccount,setShowAccount]=useState(false); // account panel
  const [showPrivacyData,setShowPrivacyData]=useState(false);
  const [privacyFromMenu,setPrivacyFromMenu]=useState(false);
  const [privacyPrefs,setPrivacyPrefs]=useState({sharePresence:true});
  const [visiting,setVisiting]=useState(null);        // username whose garden we're viewing
  const [accountFromMenu,setAccountFromMenu]=useState(false);
  const [sessionsFromMenu,setSessionsFromMenu]=useState(false);
  const [showAdmin,setShowAdmin]=useState(false);     // admin console
  const [adminFromMenu,setAdminFromMenu]=useState(false);
  const [cameFromMenu,setCameFromMenu]=useState(false); // did tree shop open via menu?
  const [recapFromMenu,setRecapFromMenu]=useState(false); // did recap open via menu?
  const prefsLoadedRef = useRef(false);
  const [prefsReady,setPrefsReady]=useState(false);
  const rewardCheckedWeekRef = useRef("");
  const rewardClaimBusyRef = useRef(false);
  const recoveredRef = useRef(false);
  const recapCheckedRef = useRef(false);
  const pomodoroRef=useRef(pomodoro);
  const pomodoroTransitionRef=useRef(false);
  const pomodoroBoundaryRef=useRef(()=>{});
  const activeTaskRef=useRef(null);
  const queuedToastRef=useRef("");
  const finishingSessionRef=useRef(false);
  const intervalAudioRef=useRef(null);
  useEffect(()=>{pomodoroRef.current=pomodoro;},[pomodoro]);
  useEffect(()=>{
    // Let the new Melbourne week independently run its recap and podium-claim
    // checks even when this tab stayed open across Sunday midnight.
    recapCheckedRef.current=false;
    rewardCheckedWeekRef.current="";
  },[studyWeekKey]);
  const renderedBackgroundId=normalizeBackgroundId(previewBackgroundId||activeBackground);
  const renderedBackgroundAppearance=useMemo(
    ()=>getBackgroundAppearance(renderedBackgroundId,theme),
    [renderedBackgroundId,theme],
  );
  const appBackgroundStyle={
    ...S.app,
    "--sg-shell-surface":renderedBackgroundAppearance.shellSurface,
    "--sg-focus-surface":renderedBackgroundAppearance.focusSurface,
    "--sg-theme-accent":renderedBackgroundAppearance.uiAccent,
    "--sg-theme-accent-soft":renderedBackgroundAppearance.uiAccentSoft,
    "--sg-shell-border":renderedBackgroundAppearance.uiAccentSoft,
    background:"var(--sg-shell-surface)",
  };

  // Firebase Auth is the identity source of truth. The cached username is only
  // a fast hint, and is accepted after its username document matches the uid.
  useEffect(()=>{
    let active=true;
    const unsubscribe=onAuthStateChanged(auth,async firebaseUser=>{
      if(!active)return;
      if(!firebaseUser){
        setUser(null);setAuthReady(true);return;
      }
      try{
        const cached=canonUsername(lsRaw(LS_USER,lsRaw("ascendu_username","")));
        let username=null;
        if(cached){
          const mapping=await getDoc(doc(db,"usernames",cached));
          if(mapping.exists()&&mapping.data().uid===firebaseUser.uid){
            username=mapping.data().displayName||cached;
          }
        }
        if(!username)username=await usernameForUid(firebaseUser.uid);
        if(!active)return;
        if(username){
          const canonical=canonUsername(username);
          lsSetR(LS_USER,canonical);setUser(canonical);
        }else{
          setUser(null);
        }
      }catch(error){
        console.error("Lumora account hydration error:",error);
        if(active)setUser(null);
      }finally{
        if(active)setAuthReady(true);
      }
    });
    return ()=>{active=false;unsubscribe();};
  },[]);

  // Apply theme to the document root so the injected dark CSS takes effect
  useEffect(()=>{
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.background=renderedBackgroundAppearance.baseColor;
    document.body.style.background=renderedBackgroundAppearance.baseColor;
    document.body.style.transition = "background 0.25s ease";
    const themeMeta=document.querySelector('meta[name="theme-color"]');
    if(themeMeta)themeMeta.setAttribute("content",renderedBackgroundAppearance.baseColor);
  },[theme,renderedBackgroundAppearance]);

  // Dark mode uses a shell-level colour inversion. Preserve emoji artwork by
  // wrapping only emoji glyphs in a counter-inverted span, including content
  // added later by toasts, menus, or async data.
  useEffect(()=>{
    if(theme!=="dark")return;
    const root=document.querySelector(".sg-shell");
    if(!root)return;
    const emojiPattern=/(?:\p{Extended_Pictographic}\uFE0F?(?:\u200D\p{Extended_Pictographic}\uFE0F?)*)/gu;
    const containsEmoji=/\p{Extended_Pictographic}/u;
    const wrapText=node=>{
      if(!node.parentElement||node.parentElement.closest("[data-sg-emoji], .sg-keepcolor")||!containsEmoji.test(node.nodeValue||""))return;
      const text=node.nodeValue||"";
      const fragment=document.createDocumentFragment();
      let cursor=0;
      for(const match of text.matchAll(emojiPattern)){
        if(match.index>cursor)fragment.append(text.slice(cursor,match.index));
        const emoji=document.createElement("span");
        emoji.dataset.sgEmoji="true";
        emoji.textContent=match[0];
        fragment.append(emoji);
        cursor=match.index+match[0].length;
      }
      if(cursor===0)return;
      if(cursor<text.length)fragment.append(text.slice(cursor));
      node.replaceWith(fragment);
    };
    const scan=node=>{
      if(node.nodeType===Node.ELEMENT_NODE&&node.matches("[data-sg-emoji]"))return;
      const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);
      const nodes=[];
      while(walker.nextNode())nodes.push(walker.currentNode);
      nodes.forEach(wrapText);
    };
    scan(root);
    const observer=new MutationObserver(records=>{
      records.forEach(record=>record.addedNodes.forEach(node=>{
        if(node.nodeType===Node.TEXT_NODE)wrapText(node);
        else if(node.nodeType===Node.ELEMENT_NODE)scan(node);
      }));
    });
    observer.observe(root,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[theme]);
  const toggleTheme=()=>{ const t=theme==="dark"?"light":"dark"; setTheme(t); lsSetR(LS_THEME,t); };

  useEffect(()=>{
    const media=window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if(!media)return;
    const sync=()=>setPrefersReducedMotion(media.matches);
    sync();
    media.addEventListener?.("change",sync);
    return()=>media.removeEventListener?.("change",sync);
  },[]);
  const animationsDisabled=shouldDisableAnimations(animationMode,prefersReducedMotion);
  useEffect(()=>{
    const root=document.documentElement;
    root.setAttribute("data-animation-mode",animationMode);
    root.setAttribute("data-animation-disabled",animationsDisabled?"true":"false");
    const syncSvg=scope=>{
      const svgs=[];
      if(scope?.matches?.(".sg-shell svg"))svgs.push(scope);
      scope?.querySelectorAll?.(".sg-shell svg").forEach(svg=>svgs.push(svg));
      svgs.forEach(svg=>{
        try{
          if(animationsDisabled)svg.pauseAnimations?.();
          else svg.unpauseAnimations?.();
        }catch{/* Older SVG implementations do not expose SMIL controls. */}
      });
    };
    syncSvg(document);
    const observer=new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(syncSvg)));
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[animationMode,animationsDisabled]);
  const changeAnimationMode=nextRaw=>{
    const next=normalizeAnimationMode(nextRaw);
    setAnimationMode(next);lsSetR(LS_ANIMATION_MODE,next);
    if(user)fbSavePrefs(user,{animationMode:next});
  };

  useEffect(()=>{
    let active=true;
    setAdminRoleVerified(false);
    if(!user||!isAdminConsoleUsername(user,ADMIN_USERS))return()=>{active=false;};
    const firebaseUser=auth.currentUser;
    if(!firebaseUser)return()=>{active=false;};
    getDoc(doc(db,"roles",firebaseUser.uid)).then(snapshot=>{
      if(active)setAdminRoleVerified(snapshot.exists()&&snapshot.data()?.admin===true);
    }).catch(error=>{
      console.warn("Lumora admin role check failed:",error?.code||error?.message||error);
      if(active)setAdminRoleVerified(false);
    });
    return()=>{active=false;};
  },[user]);

  // Equipping in another tab updates this tab immediately. Firestore remains
  // authoritative on login/reload; localStorage is only the fast same-device
  // cache and account-scoped keys prevent one account leaking into another.
  useEffect(()=>{
    if(!user)return;
    const activeKey=backgroundCacheKey(user);
    const ownedKey=ownedBackgroundsCacheKey(user);
    const sync=event=>{
      if(event.key===ownedKey){
        const nextOwned=normalizeOwnedBackgrounds(lsGet(ownedKey,[DEFAULT_BACKGROUND_ID]));
        setOwnedBackgrounds(nextOwned);
        setActiveBackground(current=>canEquipBackground(current,nextOwned)?current:DEFAULT_BACKGROUND_ID);
      }
      if(event.key===activeKey){
        const next=normalizeBackgroundId(event.newValue||DEFAULT_BACKGROUND_ID);
        const latestOwned=normalizeOwnedBackgrounds(lsGet(ownedKey,ownedBackgrounds));
        setActiveBackground(canEquipBackground(next,latestOwned)?next:DEFAULT_BACKGROUND_ID);
      }
    };
    window.addEventListener("storage",sync);
    return()=>window.removeEventListener("storage",sync);
  },[user,ownedBackgrounds]);

  // One filtered listener keeps accepted friends and requests current without
  // polling the entire user base. Firestore evaluates every returned document
  // against the signed-in Firebase UID.
  useEffect(()=>{
    const currentUid=auth.currentUser?.uid;
    if(!user||!prefsReady||!currentUid){setFriendNetwork({friends:[],incoming:[],outgoing:[],loading:!!user,error:""});return;}
    const connections=query(collection(db,"friend_connections"),where("userUids","array-contains",currentUid));
    return onSnapshot(connections,snapshot=>{
      const next=friendNetworkFromConnections(snapshot.docs.map(item=>({id:item.id,...item.data()})),currentUid);
      setFriendNetwork({...next,loading:false,error:""});
    },error=>{
      console.error("Friend network load error:",error);
      setFriendNetwork(current=>({...current,loading:false,error:"Friends couldn't be loaded. Try reopening this page."}));
    });
  },[user,prefsReady]);

  // ── Presence: publish online or studying while this signed-in tab is open ──
  useEffect(()=>{
    // Wait for the account's cloud preferences before publishing a subject.
    // Otherwise a fast login switch can briefly advertise the previous
    // account's cached subject under the newly logged-in username.
    if(!user || !prefsReady) return;
    if(privacyPrefs.sharePresence===false){fbClearPresence(user);return;}
    const earningFocus=timerStyle!=="pomodoro"||pomodoroRef.current.phase==="focus";
    const publish=()=>{
      const studying=running&&!paused&&earningFocus;
      const subj = subjects.find(s=>s.id===subject) || subjects[0];
      fbHeartbeat(user,studying?"studying":"online",subj?.label,subj?.emoji,subj?.color);
    };
    publish();
    const hb=setInterval(publish,45*1000);
    return()=>clearInterval(hb);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[running, paused, subject, user, prefsReady, timerStyle, pomodoro.phase, privacyPrefs.sharePresence]);

  // Clear presence if the tab/window closes mid-session
  useEffect(()=>{
    if(!user) return;
    const onUnload = ()=>{ try{ fbClearPresence(user); }catch(e){} };
    window.addEventListener("pagehide", onUnload);
    return ()=>window.removeEventListener("pagehide", onUnload);
  },[user]);

  // Poll only accepted friends' small presence documents. This remains a
  // bounded read even when Lumora grows to many users.
  useEffect(()=>{
    if(!user || !prefsReady) return;
    let active = true;
    const load = async ()=>{ const p = await fbLoadFriendPresence(friendNetwork.friends); if(active) setPresence(p); };
    load();
    const iv = setInterval(load, 30*1000);
    return ()=>{ active=false; clearInterval(iv); };
  },[user,prefsReady,tab,running,friendNetwork.friends]);
  const intervalRef  = useRef(null);
  const startTimeRef = useRef(null);
  const baseElapsed  = useRef(0);
  const goalChimedRef = useRef(false);  // has the timer-goal chime fired this session?
  const sessionStartRef = useRef(null); // wall-clock start of the current session (for analytics)
  const sessionIdRef = useRef(null);    // stable id makes completion/recovery retries exactly-once
  const pauseCountRef   = useRef(0);    // how many times paused this session (focus signal)
  const tabIdRef = useRef(genTabId());  // this browser tab's own identity — stable for the tab's lifetime
  const [otherTabActive, setOtherTabActive] = useState(false); // is a session genuinely running in ANOTHER tab right now?

  // Play a gentle chime + (if allowed) a system notification when the timer
  // hits its goal — then the session keeps counting into overtime.
  const notifyGoalReached = useCallback(() => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if(Ctx){
        const ac = new Ctx();
        [880, 1320].forEach((freq, i) => {
          const osc = ac.createOscillator(), gain = ac.createGain();
          osc.frequency.value = freq; osc.type = "sine";
          osc.connect(gain); gain.connect(ac.destination);
          const t = ac.currentTime + i*0.18;
          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.exponentialRampToValueAtTime(0.25, t+0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, t+0.4);
          osc.start(t); osc.stop(t+0.42);
        });
      }
    } catch(e) {}
    try {
      if("Notification" in window && Notification.permission === "granted"){
        new Notification("🌱 Goal reached!", { body: "Your timer's done — still counting your overtime. End the session whenever you're ready." });
      }
    } catch(e) {}
    showToast("🌟 Goal reached — now in overtime, keep going!");
  }, []);

  const subjectObj=subjects.find(s=>s.id===subject)||subjects[0];
  const selectedTask=tasks.find(task=>task.id===selectedTaskId&&!task.completed)||null;

  const cacheTasks=useCallback((next,userKey=user)=>{
    setTasks(next);
    if(userKey)lsSet(taskCacheKey(userKey),next);
  },[user]);

  useEffect(()=>{
    if(!user||!prefsReady)return;
    let cancelled=false;
    const cached=lsGet(taskCacheKey(user),[]);
    if(Array.isArray(cached))setTasks(cached.map(item=>normalizeTask(item.id,item)).filter(item=>item.title));
    setTasksLoading(true);setTasksError("");
    fbLoadTasks(user,"").then(result=>{
      if(cancelled)return;
      if(result.ok)cacheTasks(result.tasks,user);
      else setTasksError("Tasks are available from this device, but cloud sync could not connect.");
      setTasksLoading(false);
    });
    return()=>{cancelled=true;};
  },[user,prefsReady,cacheTasks]);

  useEffect(()=>{
    if(selectedTaskId&&!tasksLoading&&!tasks.some(task=>task.id===selectedTaskId&&!task.completed)){
      setSelectedTaskId("");lsSetR(LS_SELECTED_TASK,"");
    }
  },[tasks,tasksLoading,selectedTaskId]);

  const chooseTask=id=>{
    const next=String(id||"");
    setSelectedTaskId(next);lsSetR(LS_SELECTED_TASK,next);
    if(user)fbSavePrefs(user,{selectedTaskId:next});
  };
  const createTask=async input=>{
    const id=newTaskId(),now=Date.now();
    const optimistic=normalizeTask(id,{...input,completed:false,createdAtMs:now,updatedAtMs:now,order:now});
    if(!optimistic.title)return {ok:false,error:"Add a task title first."};
    const before=tasks;
    cacheTasks([...before,optimistic]);
    try{
      const result=await fbCreateTask(user,"",id,input);
      if(!result.ok)cacheTasks(before);
      return result;
    }catch(e){cacheTasks(before);return {ok:false,error:e.message};}
  };
  const updateTask=async(id,patch)=>{
    const before=tasks;
    const current=before.find(task=>task.id===id);
    if(!current)return {ok:false,error:"That task no longer exists."};
    const optimistic=normalizeTask(id,{...current,...patch,updatedAtMs:Date.now(),
      ...(Object.prototype.hasOwnProperty.call(patch||{},"completed")?{
        completed:patch.completed===true,completedAtMs:patch.completed?Date.now():0,
      }:{})});
    cacheTasks(before.map(task=>task.id===id?optimistic:task));
    if(optimistic.completed&&selectedTaskId===id)chooseTask("");
    try{
      const result=await fbUpdateTask(user,"",id,patch);
      if(!result.ok){cacheTasks(before);if(selectedTaskId===id&&!current.completed)chooseTask(id);}
      return result;
    }catch(e){cacheTasks(before);if(selectedTaskId===id&&!current.completed)chooseTask(id);return {ok:false,error:e.message};}
  };
  const deleteTask=async id=>{
    const before=tasks;
    cacheTasks(before.filter(task=>task.id!==id));
    if(selectedTaskId===id)chooseTask("");
    try{
      const result=await fbDeleteTask(user,"",id);
      if(!result.ok)cacheTasks(before);
      return result;
    }catch(e){cacheTasks(before);return {ok:false,error:e.message};}
  };

  const setPomodoroConfig=patch=>{
    const next=sanitizePomodoroState({...pomodoroRef.current,...patch,phase:"focus",round:1,completedRounds:0,completedFocusSeconds:0,awaitingNext:false});
    setPomodoro(next);pomodoroRef.current=next;lsSet(LS_POMODORO,sanitizePomodoroConfig(next));
    if(user)fbSavePrefs(user,{pomodoroSettings:sanitizePomodoroConfig(next)});
    setElapsed(0);baseElapsed.current=0;
  };
  const chooseTimerStyle=style=>{
    if(running||paused)return;
    const next=style==="pomodoro"?"pomodoro":"standard";
    setTimerStyle(next);lsSetR(LS_TIMER_STYLE,next);
    if(user)fbSavePrefs(user,{timerStyle:next});
    setElapsed(0);baseElapsed.current=0;
  };

  const loadLB=useCallback(async()=>{
    setLoading(true);
    const data = await fbLoadLeaderboard();
    setLb(data);
    setLoading(false);
  },[]);

  useEffect(()=>{
    if(user&&prefsReady&&tab==="leaderboard")loadLB();
  },[studyWeekKey,user,prefsReady,tab,loadLB]);

  // Wall-clock elapsed — immune to browser tab throttling
  const getTrueElapsed = useCallback(() => {
    if (!startTimeRef.current) return baseElapsed.current;
    return baseElapsed.current + Math.floor((Date.now() - startTimeRef.current) / 1000);
  }, []);

  const activeSnapshot=useCallback((patch={})=>{
    const task=activeTaskRef.current;
    return {
      subject,mode,duration,startTs:startTimeRef.current,sessionStartTs:sessionStartRef.current,
      base:baseElapsed.current,paused:!!paused,skin:activeSkin,
      sessionId:sessionIdRef.current,username:canonUsername(user),tabId:tabIdRef.current,hb:Date.now(),
      timerMode:timerStyle,
      ...(timerStyle==="pomodoro"?{pomodoro:sanitizePomodoroState(pomodoroRef.current)}:{}),
      ...(task?{taskId:task.id,taskTitle:task.title}:{}),
      ...patch,
    };
  },[subject,mode,duration,paused,activeSkin,user,timerStyle]);

  useEffect(()=>{
    if(running && !paused){
      startTimeRef.current = Date.now();
      // Persist so a closed tab doesn't lose the session — tagged with this
      // tab's id + a heartbeat so other tabs can tell it's genuinely live.
      localStorage.setItem(LS_ACTIVE,JSON.stringify(activeSnapshot({startTs:startTimeRef.current,paused:false})));
      let tickCount = 0;
      intervalRef.current = setInterval(()=>{
        const e = getTrueElapsed();
        if(timerStyle==="pomodoro"&&e>=pomodoroPhaseSeconds(pomodoroRef.current)&&!pomodoroTransitionRef.current){
          pomodoroTransitionRef.current=true;
          Promise.resolve(pomodoroBoundaryRef.current(e)).finally(()=>{pomodoroTransitionRef.current=false;});
        // Standard timer reached its goal: chime ONCE, then keeps overtime.
        }else if(timerStyle!=="pomodoro"&&mode==="timer" && e >= duration && !goalChimedRef.current){
          goalChimedRef.current = true;
          notifyGoalReached();
          setElapsed(e);
        }else{
          setElapsed(e);
        }
        // Refresh the heartbeat every ~4s (not every clock tick — cheap enough
        // that another tab's "is this still running?" check never goes stale
        // by more than TAB_STALE_MS, without hammering localStorage).
        tickCount++;
        if(tickCount % Math.max(1,Math.round(TAB_HEARTBEAT_MS/1000)) === 0){
          localStorage.setItem(LS_ACTIVE,JSON.stringify(activeSnapshot({startTs:startTimeRef.current,paused:false})));
        }
      // The UI only displays whole seconds. A 1s tick halves top-level React
      // work without changing timing accuracy because elapsed is wall-clock
      // based and is recomputed exactly when pausing or ending.
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
      if(paused && startTimeRef.current){
        // freeze base at current true elapsed when pausing
        baseElapsed.current = getTrueElapsed();
        startTimeRef.current = null;
        pauseCountRef.current += 1;   // track pause frequency (a focus signal)
        localStorage.setItem(LS_ACTIVE,JSON.stringify(activeSnapshot({startTs:null,base:baseElapsed.current,paused:true})));
      }
    }
    return () => clearInterval(intervalRef.current);
  },[running,paused,duration,mode,subject,activeSkin,user,timerStyle,pomodoro.phase,pomodoro.round,
    getTrueElapsed,notifyGoalReached,activeSnapshot]);

  // A paused timer or completed break still owns the cross-tab lock. Keep its
  // heartbeat fresh without updating elapsed time, so another tab cannot start
  // a second session merely because the first session is waiting or paused.
  useEffect(()=>{
    if(!running||!paused)return;
    const heartbeat=()=>localStorage.setItem(LS_ACTIVE,JSON.stringify(activeSnapshot({
      startTs:null,base:baseElapsed.current,paused:true,
    })));
    heartbeat();
    const id=setInterval(heartbeat,TAB_HEARTBEAT_MS);
    return()=>clearInterval(id);
  },[running,paused,activeSnapshot,pomodoro.phase,pomodoro.round]);

  // Cross-tab awareness: listen for OTHER tabs writing/clearing LS_ACTIVE, and
  // also poll for staleness (in case another tab crashed without cleaning up —
  // no 'storage' event fires for that, so we can't rely on events alone).
  useEffect(()=>{
    const check = () => {
      const active = parseActive(localStorage.getItem(LS_ACTIVE));
      setOtherTabActive(isLiveElsewhere(active, tabIdRef.current));
    };
    check();
    const onStorage = (e) => { if(e.key===LS_ACTIVE || e.key===null) check(); };
    window.addEventListener("storage", onStorage);
    const poll = setInterval(check, 3000);
    return () => { window.removeEventListener("storage", onStorage); clearInterval(poll); };
  },[]);

  // Catch up instantly when user returns to the tab
  useEffect(()=>{
    const onVisible = () => {
      if(!document.hidden && running && !paused && startTimeRef.current){
        const e = getTrueElapsed();
        if(timerStyle==="pomodoro"&&e>=pomodoroPhaseSeconds(pomodoroRef.current)&&!pomodoroTransitionRef.current){
          pomodoroTransitionRef.current=true;
          Promise.resolve(pomodoroBoundaryRef.current(e)).finally(()=>{pomodoroTransitionRef.current=false;});
        }else if(timerStyle!=="pomodoro"&&mode==="timer" && e >= duration && !goalChimedRef.current){
          goalChimedRef.current = true;
          notifyGoalReached();
        }
        setElapsed(e);
      }
    };
    // Locking a phone's screen usually does NOT flip document.visibilityState
    // (only switching tabs/apps does) — the OS just suspends timers while the
    // screen is dark. So visibilitychange alone misses the most common case:
    // lock the phone mid-session, study for real, unlock, and `elapsed` is
    // still whatever it read the instant the screen went dark. `focus` and
    // `pageshow` (bfcache restore) both fire on unlock in practice, so they
    // catch what visibilitychange doesn't.
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("pageshow", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  },[running, paused, duration, mode, timerStyle]);

  // Live countdown/stopwatch in the browser TAB TITLE — keeps ticking even
  // when you switch to another tab. Uses the wall clock + a self-correcting
  // timeout so it stays accurate despite background-tab throttling.
  useEffect(()=>{
    const BASE = "Lumora";
    if(!(running || paused)){ document.title = BASE; return; }
    let timeoutId;
    const tick = () => {
      const e = paused ? baseElapsed.current : getTrueElapsed();
      const pomo=timerStyle==="pomodoro";
      const phaseLimit=pomo?pomodoroPhaseSeconds(pomodoroRef.current):duration;
      const over = !pomo&&mode==="timer" && e > duration;
      const shown = pomo?Math.max(phaseLimit-e,0):(mode==="timer" ? (over ? e - duration : duration - e) : e);
      const icon = paused ? "⏸" : pomo?(pomodoroRef.current.phase==="break"?"☕":"🍅"):over ? "🌟" : (mode==="timer" ? "⏳" : "⏱");
      const sign = over ? "+" : "";
      const label=pomo&&pomodoroRef.current.phase==="break"?"Break":subjectObj?.label||"Focus";
      document.title = `${icon} ${sign}${fmt(shown)} · ${label}`;
      // align the next update to the next whole second to avoid drift
      const delay = paused ? 1000 : 1000 - ((Date.now() - (startTimeRef.current||Date.now())) % 1000);
      timeoutId = setTimeout(tick, delay);
    };
    tick();
    return () => { clearTimeout(timeoutId); document.title = BASE; };
  // subjectObj/elapsed intentionally excluded; tick reads fresh values via refs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[running, paused, mode, duration, subject, timerStyle,pomodoro.phase,pomodoro.round]);

  const finishSession=async(secs,finishMeta={})=>{
    if(finishingSessionRef.current)return;
    finishingSessionRef.current=true;
    try{
    const active = parseActive(localStorage.getItem(LS_ACTIVE));
    const completedPomo=sanitizePomodoroState(finishMeta.pomodoro||pomodoroRef.current);
    const completedTask=finishMeta.task||activeTaskRef.current;
    const completedTimerMode=finishMeta.timerMode||timerStyle;
    // Freeze the exact completed duration, but keep the snapshot until the
    // Firestore transaction succeeds. If the network drops, a reload can retry
    // the same session instead of silently losing it (or counting extra time).
    if(!active || active.tabId===tabIdRef.current){
      localStorage.setItem(LS_ACTIVE,JSON.stringify(activeSnapshot({
        startTs:null,base:completedTimerMode==="pomodoro"?0:secs,paused:true,
        timerMode:completedTimerMode,
        ...(completedTimerMode==="pomodoro"?{
          pomodoro:completedPomo,finalizing:true,finalFocusSeconds:secs,
        }:{}),
        hb:Date.now()-TAB_STALE_MS,
      })));
    }
    const coinsEarned=Math.floor(secs/60)*COINS_PER_MIN;
    const newCoins=coins+coinsEarned;
    setCoins(newCoins);lsSet(LS_COINS,newCoins);
    const subj=subjects.find(s=>s.id===subject)||subjects[0];
    const completedStartTs=sessionStartRef.current||(Date.now()-secs*1000);
    const startedToday=startOfDay(new Date(completedStartTs)).getTime()===startOfDay(new Date()).getTime();
    const firstToday = startedToday&&todaySecs===0; // don't call a pre-midnight session today's first
    setLoading(true);
    const saveResult=await fbSaveSession(user,subject,secs,activeSkin,{
      sessionId:sessionIdRef.current,
      startTs: completedStartTs,
      endTs: Date.now(),
      pauses: pauseCountRef.current,
      goalSecs: completedTimerMode==="pomodoro" ? completedPomo.focusLengthMinutes*60 : mode==="timer" ? duration : 0,
      mode:completedTimerMode==="pomodoro"?"timer":mode,
      timerMode:completedTimerMode,
      ...(completedTimerMode==="pomodoro"?{
        completedRounds:completedPomo.completedRounds,
        plannedRounds:completedPomo.plannedRounds,
        focusLengthMinutes:completedPomo.focusLengthMinutes,
        breakLengthMinutes:completedPomo.breakLengthMinutes,
      }:{}),
      ...(completedTask?{taskId:completedTask.id,taskTitle:completedTask.title}:{}),
    },coinsEarned);
    if(!saveResult?.ok){
      // A different tab/device may have changed the wallet while this save was
      // in flight. Restore from Firestore, not from an older render snapshot.
      const prefs=await fbLoadPrefs(user);
      const restoredCoins=typeof prefs?.coins==="number"?prefs.coins:coins;
      setCoins(restoredCoins);lsSet(LS_COINS,restoredCoins);setLoading(false);
      showToast("Couldn't save yet — your session is kept safely for recovery");
      return;
    }
    const pending=parseActive(localStorage.getItem(LS_ACTIVE));
    if(!pending||pending.tabId===tabIdRef.current)localStorage.removeItem(LS_ACTIVE);
    sessionIdRef.current=null;
    sessionStartRef.current=null;
    activeTaskRef.current=null;
    setCoins(saveResult.coinBalance);lsSet(LS_COINS,saveResult.coinBalance);
    await loadLB();
    const fresh = await loadTodaySecs();
    setLoading(false);
    setShowComplete({secs,coinsEarned,subjectObj:subj,streak:fresh.streak,streakExtended:firstToday&&fresh.streak>0,
      timerMode:completedTimerMode,pomodoro:completedTimerMode==="pomodoro"?completedPomo:null,task:completedTask||null});
    }catch(e){
      console.error("Session finalization failed:",e);
      const prefs=await fbLoadPrefs(user);
      const restoredCoins=typeof prefs?.coins==="number"?prefs.coins:coins;
      setCoins(restoredCoins);lsSet(LS_COINS,restoredCoins);
      showToast("Couldn't save yet — your session is kept safely for recovery");
    }finally{
      finishingSessionRef.current=false;
      setLoading(false);
    }
  };

  const cuePomodoroBoundary=useCallback((message)=>{
    if(pomodoroRef.current.intervalCues){
      try{
        const ac=intervalAudioRef.current;
        if(ac&&ac.state!=="closed"){
          ac.resume?.();
          const osc=ac.createOscillator(),gain=ac.createGain(),now=ac.currentTime;
          osc.type="sine";osc.frequency.value=740;osc.connect(gain);gain.connect(ac.destination);
          gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.12,now+.02);
          gain.gain.exponentialRampToValueAtTime(.0001,now+.32);osc.start(now);osc.stop(now+.34);
        }
      }catch{}
      try{navigator.vibrate?.(70);}catch{}
    }
    try{
      if("Notification" in window&&Notification.permission==="granted"){
        new Notification("Lumora",{body:message});
      }
    }catch{}
    showToast(message,true);
  },[]);

  const handlePomodoroBoundary=useCallback(async phaseElapsed=>{
    const result=advancePomodoroClock(pomodoroRef.current,phaseElapsed);
    const previous=pomodoroRef.current;
    pomodoroRef.current=result.state;setPomodoro(result.state);
    if(result.finished){
      cuePomodoroBoundary("All focus rounds complete — your classroom has grown.");
      clearInterval(intervalRef.current);
      startTimeRef.current=null;baseElapsed.current=0;setElapsed(0);setRunning(false);setPaused(false);
      await finishSession(result.state.completedFocusSeconds,{timerMode:"pomodoro",pomodoro:result.state});
      return;
    }
    const crossedFocus=previous.phase==="focus"||result.state.completedRounds>previous.completedRounds;
    if(result.state.awaitingNext){
      cuePomodoroBoundary("Break complete — start the next round when you’re ready.");
      startTimeRef.current=null;baseElapsed.current=result.elapsed;setElapsed(result.elapsed);setPaused(true);
      localStorage.setItem(LS_ACTIVE,JSON.stringify(activeSnapshot({
        startTs:null,base:result.elapsed,paused:true,timerMode:"pomodoro",pomodoro:result.state,
      })));
    }else{
      cuePomodoroBoundary(crossedFocus?"Focus complete — take a short break.":"Break complete — the next focus round has started.");
      baseElapsed.current=result.elapsed;
      startTimeRef.current=Date.now();
      setElapsed(result.elapsed);setPaused(false);setRunning(true);
      localStorage.setItem(LS_ACTIVE,JSON.stringify(activeSnapshot({
        startTs:startTimeRef.current,base:result.elapsed,paused:false,timerMode:"pomodoro",pomodoro:result.state,
      })));
    }
  },[cuePomodoroBoundary,activeSnapshot]);
  pomodoroBoundaryRef.current=handlePomodoroBoundary;

  // Recover a session that was lost when the tab was closed mid-focus.
  // Credits the time that actually elapsed (capped at 4h) and saves it like a
  // normal completed session.
  useEffect(()=>{
    if(!user || !prefsReady || recoveredRef.current) return;
    let cancelled=false;
    (async()=>{
      const raw = localStorage.getItem(LS_ACTIVE);
      if(!raw){ recoveredRef.current=true; return; }
      const a = parseActive(raw);
      if(!a){ recoveredRef.current=true; localStorage.removeItem(LS_ACTIVE); return; }
      // A snapshot belongs to the account that created it. This prevents a
      // stale session from account A being credited after account B logs in on
      // the same browser. Untagged legacy snapshots remain recoverable.
      if(!activeBelongsToUser(a,user)){
        recoveredRef.current=true;
        return;
      }
      // A fresh heartbeat means another tab still owns the session. Leave the
      // snapshot untouched and retry when the cross-tab state becomes stale.
      if(isLiveElsewhere(a, tabIdRef.current)) return;
      recoveredRef.current=true;
      try{
        if(a.timerMode==="pomodoro"||a.pomodoro){
          const restored=sanitizePomodoroState(a.pomodoro||{});
          const fullPlanSeconds=(restored.focusLengthMinutes*restored.plannedRounds+
            restored.breakLengthMinutes*Math.max(0,restored.plannedRounds-1))*60;
          const phaseElapsed=a.finalizing?0:getRecoverableSeconds(a,Date.now(),Math.min(48*3600,fullPlanSeconds+3600));
          const advanced=a.finalizing
            ? {state:restored,elapsed:0,finished:true}
            : advancePomodoroClock(restored,phaseElapsed);
          const recoveryOwner=a.tabId||`recovery_${Date.now()}`;
          const recoverySessionId=a.sessionId||`session_${genTabId()}`;
          const recoveredTask=a.taskId?{id:String(a.taskId),title:cleanTaskTitle(a.taskTitle)}:null;
          if(a.finalizing||advanced.finished){
            const secs=Math.max(0,Math.trunc(Number(a.finalFocusSeconds)||advanced.state.completedFocusSeconds));
            if(secs<60){localStorage.removeItem(LS_ACTIVE);return;}
            const coinsEarned=Math.floor(secs/60)*COINS_PER_MIN;
            localStorage.setItem(LS_ACTIVE,JSON.stringify({...a,
              username:canonUsername(user),startTs:null,base:0,paused:true,
              timerMode:"pomodoro",pomodoro:advanced.state,finalizing:true,finalFocusSeconds:secs,
              sessionId:recoverySessionId,tabId:recoveryOwner,hb:Date.now(),
            }));
            const saveResult=await fbSaveSession(user,a.subject,secs,a.skin,{
              sessionId:recoverySessionId,startTs:a.sessionStartTs||Date.now()-secs*1000,endTs:Date.now(),
              goalSecs:advanced.state.focusLengthMinutes*60,mode:"timer",timerMode:"pomodoro",
              completedRounds:advanced.state.completedRounds,plannedRounds:advanced.state.plannedRounds,
              focusLengthMinutes:advanced.state.focusLengthMinutes,breakLengthMinutes:advanced.state.breakLengthMinutes,
              ...(recoveredTask?{taskId:recoveredTask.id,taskTitle:recoveredTask.title}:{}),
            },coinsEarned);
            if(!saveResult?.ok){
              const prefs=await fbLoadPrefs(user),restoredCoins=typeof prefs?.coins==="number"?prefs.coins:coins;
              if(!cancelled){setCoins(restoredCoins);lsSet(LS_COINS,restoredCoins);showToast("Pomodoro recovery is saved — we’ll retry next time");}
              return;
            }
            const pending=parseActive(localStorage.getItem(LS_ACTIVE));
            if(pending?.tabId===recoveryOwner)localStorage.removeItem(LS_ACTIVE);
            if(cancelled)return;
            setCoins(saveResult.coinBalance);lsSet(LS_COINS,saveResult.coinBalance);
            await Promise.all([loadLB(),loadTodaySecs()]);
            showToast(`🌱 Recovered ${fmtMins(secs)} of Pomodoro focus (+${coinsEarned} 🪙)`);
            return;
          }
          const shouldPause=!!a.paused||advanced.state.awaitingNext;
          pomodoroRef.current=advanced.state;setPomodoro(advanced.state);
          setTimerStyle("pomodoro");lsSetR(LS_TIMER_STYLE,"pomodoro");
          if(subjects.some(item=>item.id===a.subject)){setSubject(a.subject);lsSetR(LS_SUBJECT,a.subject);}
          if(TREE_SKINS.some(item=>item.id===a.skin)){setActiveSkin(a.skin);lsSetR(LS_SKIN,a.skin);}
          sessionStartRef.current=a.sessionStartTs||Date.now();
          sessionIdRef.current=recoverySessionId;
          activeTaskRef.current=recoveredTask;
          baseElapsed.current=advanced.elapsed;startTimeRef.current=null;setElapsed(advanced.elapsed);
          localStorage.setItem(LS_ACTIVE,JSON.stringify({...a,
            username:canonUsername(user),startTs:shouldPause?null:Date.now(),base:advanced.elapsed,paused:shouldPause,
            timerMode:"pomodoro",pomodoro:advanced.state,sessionId:recoverySessionId,
            tabId:tabIdRef.current,hb:Date.now(),
          }));
          setPaused(shouldPause);setRunning(true);
          showToast(`Pomodoro restored · ${advanced.state.phase==="break"?"break":`round ${advanced.state.round}`}`);
          return;
        }
        // Timer sessions can run into overtime, so don't clamp to duration —
        // just cap everything at 4h to guard against a tab left open for days.
        const secs=getRecoverableSeconds(a);
        if(secs >= 60){
          const coinsEarned = Math.floor(secs/60) * COINS_PER_MIN;
          const newCoins = coins + coinsEarned;
          setCoins(newCoins); lsSet(LS_COINS, newCoins);
          const recoveryOwner=a.tabId||`recovery_${Date.now()}`;
          const recoverySessionId=a.sessionId||`session_${genTabId()}`;
          localStorage.setItem(LS_ACTIVE,JSON.stringify({...a,
            username:canonUsername(user),startTs:null,base:secs,paused:true,
            sessionStartTs:a.sessionStartTs,
            sessionId:recoverySessionId,tabId:recoveryOwner,hb:Date.now(),
          }));
          const saveResult=await fbSaveSession(user,a.subject,secs,a.skin,{
            sessionId:recoverySessionId,
            startTs:a.sessionStartTs||Date.now()-secs*1000,
            endTs:Date.now(),
            goalSecs:a.mode==="timer" ? a.duration||0 : 0,
            mode:a.mode||"timer",
          },coinsEarned);
          if(!saveResult?.ok){
            const prefs=await fbLoadPrefs(user);
            const restoredCoins=typeof prefs?.coins==="number"?prefs.coins:coins;
            if(!cancelled){setCoins(restoredCoins);lsSet(LS_COINS,restoredCoins);showToast("Recovery is still saved — we'll retry next time");}
            return;
          }
          const pending=parseActive(localStorage.getItem(LS_ACTIVE));
          if(pending?.tabId===recoveryOwner)localStorage.removeItem(LS_ACTIVE);
          if(cancelled) return;
          setCoins(saveResult.coinBalance);lsSet(LS_COINS,saveResult.coinBalance);
          await Promise.all([loadLB(),loadTodaySecs()]);
          if(!cancelled) showToast(`🌱 Recovered ${fmtMins(secs)} from your last session (+${coinsEarned} 🪙)`);
        } else localStorage.removeItem(LS_ACTIVE);
      }catch(e){ console.error("Session recovery failed:", e); }
    })();
    return ()=>{cancelled=true;};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[user,prefsReady,otherTabActive]);

  const startSession=()=>{
    // A shop preview is temporary and must never carry into an active session.
    setPreviewBackgroundId(null);
    setShowShop(false);setShowGardenShop(false);setShowBackgroundShop(false);
    // Re-check fresh at the moment of the click (not just the polled/eventual
    // `otherTabActive` state) — this is the one check that actually prevents
    // two tabs from ever crediting the same real hour of studying twice.
    const active = parseActive(localStorage.getItem(LS_ACTIVE));
    if(finishingSessionRef.current||(active?.finalizing&&activeBelongsToUser(active,user))){
      showToast("Your previous session is still syncing. Refresh to retry before starting another.");
      return;
    }
    if(isLiveElsewhere(active, tabIdRef.current)){
      setOtherTabActive(true);
      showToast("⏳ Already running in another tab — finish or close that one first");
      return;
    }
    baseElapsed.current=0;
    startTimeRef.current=null;
    goalChimedRef.current=false;
    sessionStartRef.current=Date.now();   // wall-clock start, for analytics
    sessionIdRef.current=`session_${genTabId()}`;
    pauseCountRef.current=0;
    activeTaskRef.current=selectedTask?{id:selectedTask.id,title:selectedTask.title}:null;
    if(timerStyle==="pomodoro"){
      const fresh=createPomodoroState(pomodoroRef.current);
      pomodoroRef.current=fresh;setPomodoro(fresh);
      if(fresh.intervalCues){
        try{
          const Ctx=window.AudioContext||window.webkitAudioContext;
          if(Ctx&&!intervalAudioRef.current){
            intervalAudioRef.current=new Ctx();
            intervalAudioRef.current.resume?.();
          }
        }catch{}
      }
    }
    setElapsed(0);
    setPaused(false);
    setRunning(true);
    // Ask once for notification permission so the goal alert can reach you in another tab
    try {
      if((mode==="timer"||timerStyle==="pomodoro") && "Notification" in window && Notification.permission === "default"){
        Notification.requestPermission();
      }
    } catch(e) {}
  };
  const pauseSession=()=>setPaused(p=>!p);
  const startNextPomodoro=()=>{
    if(timerStyle!=="pomodoro")return;
    const next=startNextPomodoroFocus(pomodoroRef.current);
    pomodoroRef.current=next;setPomodoro(next);
    baseElapsed.current=0;startTimeRef.current=null;setElapsed(0);setPaused(false);setRunning(true);
  };
  const skipPomodoroBreak=()=>{
    if(timerStyle!=="pomodoro"||pomodoroRef.current.phase!=="break")return;
    startNextPomodoro();
    showToast("Break skipped — next focus round started.",true);
  };
  const endSession=()=>{
    // Never trust `elapsed` state here — it's only refreshed by the interval
    // tick or a wake-up event, both of which can lag behind a real screen
    // lock/unlock. Recompute from the wall clock at the exact moment the
    // session ends, so a phone that slept through most of the session still
    // gets credited for the time that actually passed.
    const trueElapsed = paused ? baseElapsed.current : getTrueElapsed();
    let creditedElapsed=trueElapsed,completedPomo=null;
    if(timerStyle==="pomodoro"){
      const advanced=advancePomodoroClock(pomodoroRef.current,trueElapsed);
      completedPomo=advanced.state;
      creditedElapsed=validPomodoroFocusSeconds(advanced.state,advanced.elapsed);
      pomodoroRef.current=advanced.state;setPomodoro(advanced.state);
    }
    setElapsed(trueElapsed);
    setRunning(false);setPaused(false);
    if(creditedElapsed>=60)finishSession(creditedElapsed,{timerMode:timerStyle,pomodoro:completedPomo||pomodoroRef.current});
    else{const a=parseActive(localStorage.getItem(LS_ACTIVE));if(!a||a.tabId===tabIdRef.current)localStorage.removeItem(LS_ACTIVE);sessionIdRef.current=null;sessionStartRef.current=null;activeTaskRef.current=null;setElapsed(0);showToast("Session too short (min 1 min)");}
  };

  const showToast=(msg,allowDuringFocus=false)=>{
    if((running||paused)&&!allowDuringFocus){queuedToastRef.current=msg;return;}
    setToast(msg);setTimeout(()=>setToast(null),3000);
  };
  useEffect(()=>{
    if(!running&&!paused&&queuedToastRef.current){
      const next=queuedToastRef.current;queuedToastRef.current="";
      setToast(next);const id=setTimeout(()=>setToast(null),3000);return()=>clearTimeout(id);
    }
  },[running,paused]);
  // Identity is canonicalized to lowercase HERE — the one place a typed
  // username enters app state — so every downstream read/write (history,
  // prefs, leaderboards) keys off the same value regardless of how the
  // person capitalized it this particular time (autocapitalize on phone
  // keyboards is the classic trigger). Without this single choke point,
  // "Daisy" and "daisy" silently become two different people to Firestore.
  const handleLogin=(u,p)=>{
    const uname=canonUsername(u);
    prefsLoadedRef.current=false;
    recoveredRef.current=false;
    rewardCheckedWeekRef.current="";
    rewardClaimBusyRef.current=false;
    recapCheckedRef.current=false;
    setPreviewBackgroundId(null);
    const cachedOwned=normalizeOwnedBackgrounds(lsGet(ownedBackgroundsCacheKey(uname),[DEFAULT_BACKGROUND_ID]));
    const cachedActive=normalizeBackgroundId(lsRaw(backgroundCacheKey(uname),DEFAULT_BACKGROUND_ID));
    setOwnedBackgrounds(cachedOwned);
    setActiveBackground(canEquipBackground(cachedActive,cachedOwned)?cachedActive:DEFAULT_BACKGROUND_ID);
    setPrefsReady(false);
    lsSetR(LS_USER,uname);setUser(uname);
  };
  const handleLogout=()=>{
    const backgroundKey=backgroundCacheKey(user);
    const ownedBackgroundKey=ownedBackgroundsCacheKey(user);
    const active=parseActive(localStorage.getItem(LS_ACTIVE));
    if(!active || (activeBelongsToUser(active,user)&&!(running||paused))) lsRemove(LS_ACTIVE);
    fbClearPresence(user);
    firebaseSignOut(auth).catch(()=>{});
    [LS_USER,LS_PASSWORD,LS_SUBJECT,LS_SUBJECTS,LS_COINS,LS_EXAMS,LS_SKIN,
      LS_TARGETS,LS_DECOR,LS_BADGES,LS_GARDEN_LAYOUT,LS_RECAP,
      LS_TIMER_STYLE,LS_POMODORO,LS_SELECTED_TASK,LS_ANIMATION_MODE,
      "studygrove_owned_skins","studygrove_enhancements"].forEach(lsRemove);
    lsRemove(backgroundKey);lsRemove(ownedBackgroundKey);

    clearInterval(intervalRef.current);
    startTimeRef.current=null;baseElapsed.current=0;sessionStartRef.current=null;sessionIdRef.current=null;pauseCountRef.current=0;
    prefsLoadedRef.current=false;recoveredRef.current=false;recapCheckedRef.current=false;
    rewardCheckedWeekRef.current="";rewardClaimBusyRef.current=false;
    setPrefsReady(false);setUser(null);setRunning(false);setPaused(false);setElapsed(0);setDuration(25*60);
    setTimerStyle("standard");const freshPomo=createPomodoroState({});setPomodoro(freshPomo);pomodoroRef.current=freshPomo;
    setSubjects(DEFAULT_SUBJECTS);setSubject("math");setCoins(0);setClaimedMilestoneRewards([]);setExams([]);setTargets({});
    setOwnedSkins(["default"]);setActiveSkin("default");setEnhancements({});
    setAnimationMode("device");setAdminRoleVerified(false);
    setPrivacyPrefs({sharePresence:true});
    setOwnedBackgrounds([DEFAULT_BACKGROUND_ID]);setActiveBackground(DEFAULT_BACKGROUND_ID);setPreviewBackgroundId(null);
    setDecorations([]);setGardenLayout({});setTasks([]);setTasksError("");setTasksLoading(false);setSelectedTaskId("");
    setBadges([]);setHistory(null);setTodaySecs(0);setStreak(0);
    setLb({weekly:[],allTime:[]});setPresence([]);setFriendNetwork({friends:[],incoming:[],outgoing:[],loading:false,error:""});setOtherTabActive(false);setLoading(false);setTab("timer");
    setShowComplete(null);setShowShop(false);setShowGardenShop(false);setShowBackgroundShop(false);setShowBadges(false);setShowRecap(false);
    setShowSessions(false);setShowAccount(false);setShowPrivacyData(false);setPrivacyFromMenu(false);setShowAdmin(false);setVisiting(null);setShowMenu(false);
  };
  const changeSubject=id=>{if(running)return;setSubject(id);lsSetR(LS_SUBJECT,id);};
  const addSubject=s=>{
    const u=[...subjects,s];setSubjects(u);lsSet(LS_SUBJECTS,u);
    fbSavePrefs(user,{subjects:u});
    setShowAddModal(false);showToast(`✅ ${s.emoji} ${s.label} added`);
  };
  const removeSubject=id=>{
    if(subjects.length<=1){showToast("Need at least one subject");return;}
    const u=subjects.filter(s=>s.id!==id);setSubjects(u);lsSet(LS_SUBJECTS,u);
    fbSavePrefs(user,{subjects:u});
    if(subject===id){setSubject(u[0].id);lsSetR(LS_SUBJECT,u[0].id);}
  };
  const switchMode=m=>{if(running)return;setMode(m);setElapsed(0);lsSetR(LS_MODE,m);};

  const handleBuySkin=async(id)=>{
    const result=await fbPurchaseSkin(user,id);
    if(typeof result.coinBalance==="number"){setCoins(result.coinBalance);lsSet(LS_COINS,result.coinBalance);}
    if(Array.isArray(result.ownedSkins)){setOwnedSkins(result.ownedSkins);lsSet("studygrove_owned_skins",result.ownedSkins);}
    if(!result.ok)return false;
    setActiveSkin(result.activeSkin);lsSetR(LS_SKIN,result.activeSkin);
    return true;
  };
  const handleEquipSkin=id=>{ if(!ownedSkins.includes(id))return; setActiveSkin(id); lsSetR(LS_SKIN,id); fbSavePrefs(user,{activeSkin:id}); };
  // Permanently upgrade a skin's enhancement tier. Tier lives per-skin on the
  // account, so every existing + future tree of that type renders upgraded.
  const handleEnhanceSkin=async(id)=>{
    const currentTier=enhancements[id]||0;
    const result=await fbUpgradeSkin(user,id,currentTier);
    if(typeof result.coinBalance==="number"){setCoins(result.coinBalance);lsSet(LS_COINS,result.coinBalance);}
    if(result.enhancements){setEnhancements(result.enhancements);lsSet("studygrove_enhancements",result.enhancements);}
    if(!result.ok)return false;
    showToast(`✦ ${result.skin?.name||"Tree"} → ${ENHANCE_TIERS[result.tier-1].name}`);
    return true;
  };
  // Refresh history/streak (and coins, since a self-edit can claw coins back)
  // right after a My Sessions edit, so the rest of the app never shows a
  // number that's out of sync with what was just corrected.
  const handleSessionEdited = (r) => {
    loadHistory();
    if(r && typeof r.newCoinBalance === "number"){ setCoins(r.newCoinBalance); lsSet(LS_COINS, r.newCoinBalance); }
  };
  // Console access needs both a named Lumora admin and roles/{uid}.admin=true.
  // Test grants only merge into the signed-in admin's own account.
  const isAdmin = isAdminConsoleUsername(user,ADMIN_USERS)&&adminRoleVerified;
  const adminSetCoins = async v => {
    const safe=Math.max(0,Math.min(99_999_999,Math.floor(Number(v)||0)));
    const ok=await fbSavePrefs(user,{coins:safe});
    if(!ok){showToast("Couldn’t sync admin coin change");return false;}
    setCoins(safe);lsSet(LS_COINS,safe);showToast(`🛠 Coins set to ${safe}`);return true;
  };
  const adminUnlockAll = async () => {
    const nextSkins=[...new Set([...ownedSkins,...TREE_SKINS.map(s=>s.id)])];
    const nextBackgrounds=normalizeOwnedBackgrounds([...ownedBackgrounds,...BACKGROUND_CATALOGUE.map(item=>item.id)]);
    const nextDecorations=[...new Set([...decorations,...DECORATIONS.map(item=>item.id)])];
    const ok=await fbSavePrefs(user,{ownedSkins:nextSkins,ownedBackgrounds:nextBackgrounds,decorations:nextDecorations});
    if(!ok){showToast("Couldn’t sync admin unlocks");return false;}
    setOwnedSkins(nextSkins);lsSet("studygrove_owned_skins",nextSkins);
    setOwnedBackgrounds(nextBackgrounds);lsSet(ownedBackgroundsCacheKey(user),nextBackgrounds);
    setDecorations(nextDecorations);lsSet(LS_DECOR,nextDecorations);
    showToast("🛠 All test cosmetics unlocked");return true;
  };
  const handleBuyDecoration=async(id)=>{
    const result=await fbPurchaseDecoration(user,id);
    if(typeof result.coinBalance==="number"){setCoins(result.coinBalance);lsSet(LS_COINS,result.coinBalance);}
    if(Array.isArray(result.decorations)){setDecorations(result.decorations);lsSet(LS_DECOR,result.decorations);}
    return !!result.ok;
  };
  const handleBuyBackground=async id=>{
    const result=await fbPurchaseBackground(user,id);
    if(typeof result.coinBalance==="number"){
      setCoins(result.coinBalance);lsSet(LS_COINS,result.coinBalance);
    }
    if(Array.isArray(result.ownedBackgrounds)){
      const nextOwned=normalizeOwnedBackgrounds(result.ownedBackgrounds);
      setOwnedBackgrounds(nextOwned);
      lsSet(ownedBackgroundsCacheKey(user),nextOwned);
    }
    return result;
  };
  const handleEquipBackground=async id=>{
    const nextId=normalizeBackgroundId(id);
    const previous=activeBackground;
    if(!canEquipBackground(nextId,ownedBackgrounds))return {ok:false,reason:"locked"};
    const cacheKey=backgroundCacheKey(user);
    // Apply immediately, then roll back only if this exact optimistic value is
    // still current. That avoids overwriting a newer choice from another tab.
    setActiveBackground(nextId);lsSetR(cacheKey,nextId);
    const result=await fbEquipBackground(user,nextId);
    if(!result.ok){
      setActiveBackground(current=>current===nextId?previous:current);
      if(lsRaw(cacheKey,DEFAULT_BACKGROUND_ID)===nextId)lsSetR(cacheKey,previous);
      return result;
    }
    const nextOwned=normalizeOwnedBackgrounds(result.ownedBackgrounds);
    setOwnedBackgrounds(nextOwned);lsSet(ownedBackgroundsCacheKey(user),nextOwned);
    setActiveBackground(result.activeBackground);lsSetR(cacheKey,result.activeBackground);
    return result;
  };
  const handleRestoreDecoration=(id)=>{
    const nextLayout={...gardenLayout,removedDecor:(gardenLayout.removedDecor||[]).filter(x=>x!==id),hiddenDecor:(gardenLayout.hiddenDecor||[]).filter(x=>x!==id)};
    setGardenLayout(nextLayout); lsSet(LS_GARDEN_LAYOUT,nextLayout);
    fbSavePrefs(user,{gardenLayout:nextLayout});
  };
  const handleSaveGardenLayout=(next)=>{
    setGardenLayout(next); lsSet(LS_GARDEN_LAYOUT,next);
    fbSavePrefs(user,{gardenLayout:next});
    showToast("Classroom layout saved");
  };
  // Badge ownership + its coin reward settle in one transaction. This is safe
  // under React StrictMode and across tabs/devices: a repeated eligibility
  // check sees the stored badge and awards zero the second time.
  const awardBadges = useCallback(async(ctx) => {
    const eligible=BADGES.filter(b=>b.check(ctx)).map(b=>b.id);
    if(!eligible.length)return;
    const result=await fbAwardBadges(user,eligible);
    if(!result.ok)return;
    setBadges(result.badges);lsSet(LS_BADGES,result.badges);
    setCoins(result.coinBalance);lsSet(LS_COINS,result.coinBalance);
    if(!result.newlyEarned.length)return;
    const first=result.newlyEarned[0];
    showToast(result.newlyEarned.length===1
      ? `${first.emoji} Badge unlocked: ${first.name} (+${result.reward} 🪙)`
      : `🏅 ${result.newlyEarned.length} badges unlocked! (+${result.reward} 🪙)`);
  }, [user]);
  const handleSaveExams=async list=>{
    setExams(list);lsSet(LS_EXAMS,list);setAssessmentError("");
    const ok=await fbSavePrefs(user,{exams:list});
    if(!ok){
      setAssessmentError("Assessment changes are saved on this device but haven’t synced yet.");
      showToast("Couldn’t sync assessments — check your connection");
      return false;
    }
    return true;
  };
  const handleSaveTargets=obj=>{ setTargets(obj); lsSet(LS_TARGETS,obj); fbSavePrefs(user,{targets:obj}); };
  const handlePrivacyChange=async patch=>{
    const next={...privacyPrefs,...patch};
    setPrivacyPrefs(next);
    if(next.sharePresence===false)await fbClearPresence(user);
    return fbSavePrefs(user,{privacy:next});
  };
  const exportMyData=()=>{
    const payload={
      exportedAt:new Date().toISOString(),account:{username:user},privacy:privacyPrefs,
      study:{sessions:history||[],subjects,assessments:exams,weeklyTargets:targets,tasks},
      progress:{coins,ownedSkins,activeSkin,enhancements,badges,decorations,gardenLayout,ownedBackgrounds,activeBackground},
      social:{friends:friendNetwork.friends.map(friend=>friend.username)},
      preferences:{theme,animationMode,timerStyle,pomodoro:sanitizePomodoroConfig(pomodoroRef.current)},
      note:"Authentication secrets, internal security records and other users' information are excluded.",
    };
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;link.download=`lumora-${canonUsername(user)}-data-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
  };
  const handleClaimMilestoneReward=async stageIndex=>{
    const result=await fbClaimMilestoneReward(user,stageIndex);
    if(!result.ok){showToast(result.reason==="locked"?"Reach this stage to unlock its reward":"Couldn’t claim that reward yet");return false;}
    if(Array.isArray(result.claimed))setClaimedMilestoneRewards(result.claimed);
    if(typeof result.coinBalance==="number"){setCoins(result.coinBalance);lsSet(LS_COINS,result.coinBalance);}
    showToast(result.alreadyClaimed?"This stage reward was already claimed":`🪙 ${result.reward.toLocaleString()} stage reward claimed`);
    return true;
  };

  // Load subjects + exams from Firebase on login (cloud is source of truth).
  // Seeds the cloud from local data on first-ever login so nothing is lost.
  useEffect(()=>{
    if(!user || prefsLoadedRef.current) return;
    prefsLoadedRef.current = true;
    setPrefsReady(false);
    (async()=>{
      const prefs = await fbLoadPrefs(user);
      if(prefs){
        if(Array.isArray(prefs.subjects) && prefs.subjects.length){
          setSubjects(prefs.subjects); lsSet(LS_SUBJECTS, prefs.subjects);
          if(!prefs.subjects.find(s=>s.id===subject)){
            setSubject(prefs.subjects[0].id); lsSetR(LS_SUBJECT, prefs.subjects[0].id);
          }
        }
        if(Array.isArray(prefs.exams)){
          setExams(prefs.exams); lsSet(LS_EXAMS, prefs.exams);
        }
        if(prefs.targets && typeof prefs.targets==="object"){
          setTargets(prefs.targets); lsSet(LS_TARGETS, prefs.targets);
        }
        if(Array.isArray(prefs.decorations)){
          setDecorations(prefs.decorations); lsSet(LS_DECOR, prefs.decorations);
        }
        if(prefs.gardenLayout && typeof prefs.gardenLayout==="object"){
          setGardenLayout(prefs.gardenLayout); lsSet(LS_GARDEN_LAYOUT,prefs.gardenLayout);
        }
        if(Array.isArray(prefs.badges)){
          setBadges(prefs.badges); lsSet(LS_BADGES, prefs.badges);
        }
        // Wallet + skins follow the account across devices
        if(typeof prefs.coins==="number"){
          setCoins(prefs.coins); lsSet(LS_COINS, prefs.coins);
        }
        if(Array.isArray(prefs.claimedMilestoneRewards)){
          setClaimedMilestoneRewards(prefs.claimedMilestoneRewards.filter(index=>Number.isInteger(index)&&index>=0&&index<MILESTONE_STAGES.length));
        }
        if(Array.isArray(prefs.ownedSkins) && prefs.ownedSkins.length){
          setOwnedSkins(prefs.ownedSkins); lsSet("studygrove_owned_skins", prefs.ownedSkins);
        }
        if(typeof prefs.activeSkin==="string" && TREE_SKINS.find(s=>s.id===prefs.activeSkin)){
          setActiveSkin(prefs.activeSkin); lsSetR(LS_SKIN, prefs.activeSkin);
        }
        if(prefs.enhancements && typeof prefs.enhancements==="object" && !Array.isArray(prefs.enhancements)){
          setEnhancements(prefs.enhancements); lsSet("studygrove_enhancements", prefs.enhancements);
        }
        const cloudOwnedBackgrounds=normalizeOwnedBackgrounds(prefs.ownedBackgrounds);
        const cloudActiveBackground=normalizeBackgroundId(prefs.activeBackground);
        const safeActiveBackground=canEquipBackground(cloudActiveBackground,cloudOwnedBackgrounds)
          ? cloudActiveBackground:DEFAULT_BACKGROUND_ID;
        setOwnedBackgrounds(cloudOwnedBackgrounds);
        setActiveBackground(safeActiveBackground);
        lsSet(ownedBackgroundsCacheKey(user),cloudOwnedBackgrounds);
        lsSetR(backgroundCacheKey(user),safeActiveBackground);
        if(prefs.timerStyle==="standard"||prefs.timerStyle==="pomodoro"){
          setTimerStyle(prefs.timerStyle);lsSetR(LS_TIMER_STYLE,prefs.timerStyle);
        }
        if(prefs.pomodoroSettings&&typeof prefs.pomodoroSettings==="object"){
          const next=createPomodoroState(prefs.pomodoroSettings);
          setPomodoro(next);pomodoroRef.current=next;lsSet(LS_POMODORO,sanitizePomodoroConfig(next));
        }
        if(typeof prefs.selectedTaskId==="string"){
          setSelectedTaskId(prefs.selectedTaskId);lsSetR(LS_SELECTED_TASK,prefs.selectedTaskId);
        }
        if(typeof prefs.animationMode==="string"){
          const nextMode=normalizeAnimationMode(prefs.animationMode);
          setAnimationMode(nextMode);lsSetR(LS_ANIMATION_MODE,nextMode);
        }
        if(prefs.privacy&&typeof prefs.privacy==="object"){
          setPrivacyPrefs({sharePresence:prefs.privacy.sharePresence!==false});
        }
      } else {
        // No cloud prefs yet — seed from whatever this device has
        await fbSavePrefs(user, { subjects, exams, targets, decorations, gardenLayout, badges, coins, claimedMilestoneRewards, ownedSkins, activeSkin, enhancements,
          ownedBackgrounds:normalizeOwnedBackgrounds(ownedBackgrounds),
          activeBackground:canEquipBackground(activeBackground,ownedBackgrounds)?activeBackground:DEFAULT_BACKGROUND_ID,
          timerStyle,pomodoroSettings:sanitizePomodoroConfig(pomodoroRef.current),selectedTaskId,animationMode,
          privacy:{sharePresence:true} });
      }
      setPrefsReady(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[user]);

  useEffect(()=>{
    if(!user || !prefsReady) return;
    let disposed=false;
    const checkReward=async()=>{
      const checkTime=new Date();
      const previousWeekKey=getPreviousWeekKey(checkTime);
      if(rewardClaimBusyRef.current || rewardCheckedWeekRef.current===previousWeekKey) return;
      rewardClaimBusyRef.current=true;
      try{
        const r=await fbClaimPreviousWeekReward(user,checkTime);
        if(disposed || !r?.ok || r.pending) return;
        rewardCheckedWeekRef.current=previousWeekKey;

        // Always accept the transaction's account snapshot, even when another
        // device already claimed the reward. That closes the stale-wallet case
        // where Firestore was correct but this tab still displayed old coins.
        if(typeof r.coinBalance==="number"){
          setCoins(r.coinBalance);lsSet(LS_COINS,r.coinBalance);
        }
        if(Array.isArray(r.ownedSkins)){
          setOwnedSkins(r.ownedSkins);lsSet("studygrove_owned_skins",r.ownedSkins);
        }
        if(Array.isArray(r.ownedBackgrounds)){
          setOwnedBackgrounds(r.ownedBackgrounds);lsSet(ownedBackgroundsCacheKey(user),r.ownedBackgrounds);
        }
        if(Array.isArray(r.decorations)){
          setDecorations(r.decorations);lsSet(LS_DECOR,r.decorations);
        }
        if(!r.alreadyClaimed && (r.reward>0 || r.skinId || r.backgroundId || r.decorationId)){
          if(r.skinId){
            showToast(`🥇 Last week's #1 prize: ${r.skinName||"Mystery"} character style unlocked`);
          } else if(r.backgroundId){
            showToast(`🥇 Last week's #1 prize: ${r.backgroundName||"Mystery"} background unlocked`);
          } else if(r.decorationId){
            showToast(`🥈 Last week's #2 prize: ${r.decorationName||"Mystery"} classroom décor unlocked`);
          } else {
            const completedCollection=r.skinFallback||r.backgroundFallback||r.decorationFallback;
            showToast(`${r.rank===1?"🥇":r.rank===2?"🥈":"🥉"} Last week's #${r.rank}: +${r.reward} coins${completedCollection?" (collection complete)":""}`);
          }
        }
      } finally {
        rewardClaimBusyRef.current=false;
      }
    };
    const onResume=()=>{if(!document.hidden)checkReward();};
    checkReward();
    document.addEventListener("visibilitychange",onResume);
    window.addEventListener("focus",onResume);
    window.addEventListener("pageshow",onResume);
    const retry=setInterval(checkReward,5*60*1000);
    return ()=>{
      disposed=true;
      document.removeEventListener("visibilitychange",onResume);
      window.removeEventListener("focus",onResume);
      window.removeEventListener("pageshow",onResume);
      clearInterval(retry);
    };
  },[user,prefsReady,studyWeekKey]);

  const [todaySecs, setTodaySecs] = useState(0);
  const [history, setHistory] = useState(null);   // full session history (for targets + badges)
  const [streak, setStreak] = useState(0);        // current consecutive-day study streak

  // Compute the current daily streak from history (counts back from today/yesterday)
  const computeStreak = useCallback((hist) => {
    if(!Array.isArray(hist) || !hist.length) return 0;
    const days = new Set(hist.map(s=>startOfDay(new Date(s.ts)).getTime()));
    const DAY = 86400000;
    let cursor = startOfDay(new Date()).getTime();
    // Allow the streak to be "alive" if you studied today OR yesterday
    if(!days.has(cursor)) cursor -= DAY;
    let count = 0;
    while(days.has(cursor)){ count++; cursor -= DAY; }
    return count;
  }, []);

  // Load full history once on login, derive today + streak from it.
  // Returns the fresh values so callers (e.g. finishSession) can use them
  // immediately without waiting for state updates.
  const loadHistory = useCallback(async () => {
    const hist = await fbLoadHistory(user);
    setHistory(hist);
    const todayStart = startOfDay(new Date());
    const tSecs = hist.filter(s=>new Date(s.ts)>=todayStart).reduce((a,s)=>a+s.secs,0);
    setTodaySecs(tSecs);
    const stk = computeStreak(hist);
    setStreak(stk);
    return { streak: stk, todaySecs: tSecs };
  }, [user, computeStreak]);

  const loadTodaySecs = loadHistory; // keep old call-sites working

  useEffect(() => { if (user) loadHistory(); }, [user, loadHistory]);

  // This-week focus seconds per subject (for weekly targets)
  const weekSubjSecs = (()=>{
    const out = {};
    if(Array.isArray(history)){
      const ws = startOfWeek(new Date());
      history.forEach(s=>{ if(new Date(s.ts) >= ws) out[s.subject] = (out[s.subject]||0) + s.secs; });
    }
    return out;
  })();

  // Re-evaluate badges whenever the inputs that feed them change
  useEffect(()=>{
    // Wait for cloud prefs so an existing badge is never mistaken for a new
    // one while the account is still hydrating (which could re-award coins).
    if(!user || !prefsReady || history===null) return;
    const ctx = buildBadgeCtx({ history, streak, decorCount: decorations.length, subjects });
    awardBadges(ctx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[history, streak, decorations, subjects, user, prefsReady]);

  // Auto-show the weekly recap once per week (first visit from Sunday on), but
  // only if there's something to show — i.e. the user studied at least once.
  useEffect(()=>{
    if(!user || history===null || recapCheckedRef.current) return;
    recapCheckedRef.current = true;
    const thisWeek = getWeekKey();
    const lastShown = lsRaw(LS_RECAP, "");
    if(lastShown === thisWeek) return;            // already shown this week
    const ws = startOfWeek(new Date());
    const studiedThisWeek = history.some(s=>new Date(s.ts) >= ws);
    // We recap the current week's progress, so just require some activity.
    if(studiedThisWeek){
      setShowRecap(true);
      lsSetR(LS_RECAP, thisWeek);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[user, history, studyWeekKey]);

  if(!authReady)return (
    <div className="sg-shell" style={appBackgroundStyle}>
      <style>{DARK_CSS+APP_CSS+BACKGROUND_CSS}</style>
      <BackgroundLayer backgroundId={renderedBackgroundId} theme={theme}/>
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24,boxSizing:"border-box"}} aria-live="polite">
        <div style={{fontSize:18,fontWeight:800,color:"#2D6A4F"}}>🧑‍🎓 Lumora</div>
      </div>
    </div>
  );

  if(!user)return (
    <div className="sg-shell">
      <style>{DARK_CSS+APP_CSS+BACKGROUND_CSS}</style>
      <BackgroundLayer backgroundId={DEFAULT_BACKGROUND_ID} theme={theme} animationMode={animationMode}/>
      <LoginScreen onLogin={handleLogin}/>
    </div>
  );

  // Firestore is the account source of truth. Keep account-scoped controls
  // behind a short loading shell so a previous user's cached wallet, skins or
  // subjects can never flash or be acted on while the new account hydrates.
  if(!prefsReady)return (
    <div className="sg-shell" style={appBackgroundStyle}>
      <style>{DARK_CSS+APP_CSS+BACKGROUND_CSS}</style>
      <BackgroundLayer backgroundId={renderedBackgroundId} theme={theme} animationMode={animationMode}/>
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24,boxSizing:"border-box"}} aria-live="polite">
        <div style={{width:"100%",maxWidth:300,textAlign:"center"}}>
          <div style={{fontSize:18,fontWeight:800,color:"#2D6A4F",marginBottom:18}}>🧑‍🎓 Lumora</div>
          <div className="sg-skeleton" style={{height:14,width:"42%",margin:"0 auto 10px"}}/>
          <div className="sg-skeleton" style={{height:54,width:"100%",marginBottom:8}}/>
          <div className="sg-skeleton" style={{height:54,width:"100%"}}/>
        </div>
      </div>
    </div>
  );

  return (
    <div className="sg-shell" style={appBackgroundStyle} data-background={renderedBackgroundId} data-background-tone={renderedBackgroundAppearance.tone}>
      <style>{DARK_CSS+APP_CSS+BACKGROUND_CSS}</style>
      <BackgroundLayer backgroundId={renderedBackgroundId} theme={theme} focusMode={running||paused} animationMode={animationMode}/>
      {toast&&<div style={S.toast}>{toast}</div>}
      {showAddModal&&<AddSubjectModal onAdd={addSubject} onClose={()=>setShowAddModal(false)} existing={subjects}/>}
      {showShop&&<CoinShop coins={coins} ownedSkins={ownedSkins} activeSkin={activeSkin} enhancements={enhancements}
        onBuy={handleBuySkin} onEquip={handleEquipSkin} onEnhance={handleEnhanceSkin} onClose={()=>setShowShop(false)}
        onOpenDecorations={()=>{setShowShop(false);setShowGardenShop(true);}}
        onOpenBackgrounds={()=>{setShowShop(false);setShowBackgroundShop(true);}}
        onBack={cameFromMenu?()=>{setShowShop(false);setShowMenu(true);}:null}/>}
      {showGardenShop&&<GardenShop coins={coins} owned={decorations} removed={[...new Set([...(gardenLayout.removedDecor||[]),...(gardenLayout.hiddenDecor||[])])]}
        onBuy={handleBuyDecoration} onRestore={handleRestoreDecoration} onClose={()=>setShowGardenShop(false)}
        onOpenTrees={()=>{setShowGardenShop(false);setShowShop(true);}}
        onOpenBackgrounds={()=>{setShowGardenShop(false);setShowBackgroundShop(true);}}
        onBack={()=>{setShowGardenShop(false);setShowMenu(true);}}/>}
      {showBackgroundShop&&<BackgroundShop
        coins={coins}
        theme={theme}
        ownedBackgrounds={ownedBackgrounds}
        activeBackground={activeBackground}
        onBuy={handleBuyBackground}
        onEquip={handleEquipBackground}
        onPreview={setPreviewBackgroundId}
        onClose={()=>{setPreviewBackgroundId(null);setShowBackgroundShop(false);}}
        onOpenTrees={()=>{setPreviewBackgroundId(null);setShowBackgroundShop(false);setShowShop(true);}}
        onOpenDecorations={()=>{setPreviewBackgroundId(null);setShowBackgroundShop(false);setShowGardenShop(true);}}
        onBack={cameFromMenu?()=>{setPreviewBackgroundId(null);setShowBackgroundShop(false);setShowMenu(true);}:null}
      />}
      {showBadges&&<BadgesModal unlocked={badges} history={history} claimedRewards={claimedMilestoneRewards} onClaimReward={handleClaimMilestoneReward} onClose={()=>setShowBadges(false)}
        onBack={()=>{setShowBadges(false);setShowMenu(true);}}/>}
      {showRecap&&<SmartDashboard history={history} subjects={subjects} streak={streak} targets={targets} coins={coins}
        onClose={()=>{setShowRecap(false);setRecapFromMenu(false);}}
        onBack={recapFromMenu?()=>{setShowRecap(false);setRecapFromMenu(false);setShowMenu(true);}:null}/>}
      {visiting&&<VisitGarden username={visiting} viewerSubjects={subjects} onClose={()=>setVisiting(null)}/>}
      {showSessions&&<MySessionsPanel user={user} history={history} subjects={subjects} onEdit={handleSessionEdited}
        onClose={()=>{setShowSessions(false);setSessionsFromMenu(false);}}
        onBack={sessionsFromMenu?()=>{setShowSessions(false);setSessionsFromMenu(false);setShowMenu(true);}:null}/>}
      {showAccount&&<AccountPanel user={user}
        admin={isAdmin?{ user, coins, setCoins:adminSetCoins, grantAllSkins:adminUnlockAll }:null}
        onClose={()=>{setShowAccount(false);setAccountFromMenu(false);}}
        onBack={accountFromMenu?()=>{setShowAccount(false);setAccountFromMenu(false);setShowMenu(true);}:null}/>}
      {showPrivacyData&&<PrivacyDataPanel user={user} privacyPrefs={privacyPrefs}
        onPrivacyChange={handlePrivacyChange} exportData={exportMyData}
        onClose={()=>{setShowPrivacyData(false);setPrivacyFromMenu(false);}}
        onBack={privacyFromMenu?()=>{setShowPrivacyData(false);setPrivacyFromMenu(false);setShowMenu(true);}:null}/>}
      {showAdmin&&isAdmin&&<AdminPanel admin={{ user }}
        selfTools={{coins,setCoins:adminSetCoins,unlockAll:adminUnlockAll}}
        animationMode={animationMode} onAnimationModeChange={changeAnimationMode}
        onClose={()=>{setShowAdmin(false);setAdminFromMenu(false);}}
        onBack={adminFromMenu?()=>{setShowAdmin(false);setAdminFromMenu(false);setShowMenu(true);}:null}/>}
      {showExamModal&&<ExamCountdownModal exams={exams} subjects={subjects} editIndex={editingAssessmentIndex}
        onSave={handleSaveExams} onClose={()=>{setShowExamModal(false);setEditingAssessmentIndex(null);}}/>}
      {showTargets&&<WeeklyTargetsModal subjects={subjects} targets={targets} onSave={handleSaveTargets} onClose={()=>setShowTargets(false)}/>}

      {running||paused ? (
        <FocusScreen subject={subjectObj} mode={mode} elapsed={elapsed} duration={duration}
          paused={paused} onPause={pauseSession} onEnd={endSession} coins={coins} skin={activeSkin} enhance={enhancements[activeSkin]||0}
          presence={pomodoro.phase==="break"&&timerStyle==="pomodoro"?null:presence} currentUser={user}
          timerStyle={timerStyle} pomodoro={pomodoro} task={activeTaskRef.current}
          onSkipBreak={skipPomodoroBreak} onStartNext={startNextPomodoro}/>
      ) : (
        <>
          {showComplete&&(
            <CompleteScreen subject={showComplete.subjectObj} secs={showComplete.secs}
              coinsEarned={showComplete.coinsEarned}
              streak={showComplete.streak||0} streakExtended={!!showComplete.streakExtended}
              timerMode={showComplete.timerMode} pomodoro={showComplete.pomodoro} task={showComplete.task}
              onCompleteTask={async()=>{
                if(showComplete.task){
                  const result=await updateTask(showComplete.task.id,{completed:true});
                  if(result?.ok)setShowComplete(current=>current?{...current,task:null}:current);
                }
              }}
              onDismiss={()=>{setShowComplete(null);setElapsed(0);}}/>
          )}

          <header style={S.header}>
            <span className="sg-keepcolor" style={S.logo}>🧑‍🎓 Lumora</span>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <button onClick={()=>{setCameFromMenu(false);setShowShop(true);}} style={{...S.coinChip,cursor:"pointer"}} title="Open shop"><AnimatedNumber value={coins} prefix="🪙 "/></button>
              <button onClick={()=>setShowMenu(true)} style={S.menuBtn} title="Menu">
                <span style={S.menuAvatar}>{user.slice(0,1).toUpperCase()}</span>
                <span style={S.menuBars}>☰</span>
              </button>
            </div>
          </header>

          {showMenu&&(
            <HeaderMenu
              user={user} coins={coins} theme={theme} streak={streak}
              badgeCount={badges.length}
              animationMode={animationMode}
              onAnimationModeChange={changeAnimationMode}
              onTreeShop={()=>{setShowMenu(false);setCameFromMenu(true);setShowShop(true);}}
              onGardenShop={()=>{setShowMenu(false);setCameFromMenu(true);setShowGardenShop(true);}}
              onBadges={()=>{setShowMenu(false);setShowBadges(true);}}
              onRecap={()=>{setShowMenu(false);setRecapFromMenu(true);setShowRecap(true);}}
              onSessions={()=>{setShowMenu(false);setSessionsFromMenu(true);setShowSessions(true);}}
              onAccount={()=>{setShowMenu(false);setAccountFromMenu(true);setShowAccount(true);}}
              onPrivacyData={()=>{setShowMenu(false);setPrivacyFromMenu(true);setShowPrivacyData(true);}}
              isAdmin={isAdmin}
              onAdmin={()=>{setShowMenu(false);setAdminFromMenu(true);setShowAdmin(true);}}
              onToggleTheme={toggleTheme}
              onLogout={()=>{setShowMenu(false);handleLogout();}}
              onClose={()=>setShowMenu(false)}
            />
          )}

          <nav style={S.nav}>
            {[["timer","⏱ Focus"],["leaderboard","🏆 Board"],["stats","📊 Stats"]].map(([id,lbl])=>(
              <button key={id} style={{...S.navBtn,...(tab===id?S.navBtnActive:{})}}
                onClick={()=>{setTab(id);if(id==="leaderboard")loadLB();}}>{lbl}</button>
            ))}
          </nav>

          {tab==="timer"&&(
            <div style={S.timerView} className="sg-view-anim" key="view-timer">
              <ExamBanner exams={exams} subjects={subjects} loading={!prefsReady} error={assessmentError}
                onEdit={index=>{setEditingAssessmentIndex(index);setShowExamModal(true);}}
                onAdd={()=>{setEditingAssessmentIndex(null);setShowExamModal(true);}}
                onChange={handleSaveExams}/>

              <ChecklistCard tasks={tasks} loading={tasksLoading} error={tasksError}
                subjects={subjects} selectedTaskId={selectedTaskId}
                onSelect={chooseTask} onCreate={createTask} onUpdate={updateTask} onDelete={deleteTask}/>

              {/* Studying now — passive accountability */}
              <StudyingNow presence={presence} currentUser={user}/>

              <div className="sg-timer-style" role="group" aria-label="Focus timer style">
                <button type="button" aria-pressed={timerStyle==="standard"}
                  onClick={()=>chooseTimerStyle("standard")}>Standard Focus</button>
                <button type="button" aria-pressed={timerStyle==="pomodoro"}
                  onClick={()=>chooseTimerStyle("pomodoro")}>Pomodoro</button>
              </div>

              {/* Single mode button → opens Timer/Stopwatch chooser */}
              {timerStyle==="standard"&&<div style={{position:"relative",marginBottom:12}}>
                <button style={S.modePickBtn} onClick={()=>{ if(!running) setModePickerOpen(o=>!o); }}>
                  <span>{mode==="timer"?"⏳ Timer":"⏱ Stopwatch"}</span>
                  <span style={{...S.modeChev,transform:modePickerOpen?"rotate(180deg)":"none"}}>⌄</span>
                </button>
                {modePickerOpen && (
                  <>
                    <div style={S.modeBackdrop} onClick={()=>setModePickerOpen(false)}/>
                    <div style={S.modePop} className="sg-pop-anim">
                      {[["timer","⏳","Timer","Count down and plant when done"],
                        ["stopwatch","⏱","Stopwatch","Count up freely, plant anytime"]].map(([m,ic,lbl,desc])=>(
                        <button key={m}
                          style={{...S.modeOpt,...(mode===m?{background:subjectObj.color+"14"}:{})}}
                          onClick={()=>{switchMode(m);setModePickerOpen(false);}}>
                          <span style={{fontSize:20}}>{ic}</span>
                          <span style={{flex:1,textAlign:"left"}}>
                            <span style={{...S.modeOptLbl,color:mode===m?subjectObj.color:"#1a1a2e"}}>{lbl}</span>
                            <span style={S.modeOptDesc}>{desc}</span>
                          </span>
                          {mode===m && <span style={{color:subjectObj.color,fontWeight:800}}>✓</span>}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>}

              {timerStyle==="pomodoro"&&<section style={{...S.pomodoroSetup,"--sg-accent":subjectObj.color}} aria-label="Pomodoro settings">
                <div className="sg-pomodoro-presets" role="group" aria-label="Pomodoro preset">
                  {POMODORO_PRESETS.map(preset=><button type="button" key={preset.id}
                    aria-pressed={pomodoro.preset===preset.id}
                    onClick={()=>{
                      const values=preset.id==="custom"
                        ? {preset:"custom"}
                        : {preset:preset.id,focusLengthMinutes:preset.focusMinutes,breakLengthMinutes:preset.breakMinutes};
                      setPomodoroConfig(values);
                    }}>{preset.label}</button>)}
                </div>
                <div className="sg-pomo-grid">
                  <div className="sg-pomo-field">
                    <label htmlFor="sg-pomo-focus">Focus</label>
                    <input id="sg-pomo-focus" inputMode="numeric" type="number" min="5" max="180"
                      disabled={pomodoro.preset!=="custom"} value={pomodoro.focusLengthMinutes}
                      aria-label="Focus interval in minutes"
                      onChange={event=>setPomodoroConfig({preset:"custom",focusLengthMinutes:event.target.value})}/>
                  </div>
                  <div className="sg-pomo-field">
                    <label htmlFor="sg-pomo-break">Break</label>
                    <input id="sg-pomo-break" inputMode="numeric" type="number" min="1" max="60"
                      disabled={pomodoro.preset!=="custom"} value={pomodoro.breakLengthMinutes}
                      aria-label="Break interval in minutes"
                      onChange={event=>setPomodoroConfig({preset:"custom",breakLengthMinutes:event.target.value})}/>
                  </div>
                  <div className="sg-pomo-field">
                    <label htmlFor="sg-pomo-rounds">Rounds</label>
                    <select id="sg-pomo-rounds" value={pomodoro.plannedRounds}
                      aria-label="Number of focus rounds"
                      onChange={event=>setPomodoroConfig({plannedRounds:event.target.value})}>
                      {[1,2,3,4,5,6,7,8].map(round=><option key={round} value={round}>{round}</option>)}
                    </select>
                  </div>
                </div>
                <div style={S.pomodoroOptions}>
                  <label style={S.pomodoroOption}>
                    <input type="checkbox" checked={pomodoro.autoStartNext}
                      onChange={event=>setPomodoroConfig({autoStartNext:event.target.checked})}/>
                    Auto-start next focus
                  </label>
                  <label style={S.pomodoroOption}>
                    <input type="checkbox" checked={pomodoro.intervalCues}
                      onChange={event=>setPomodoroConfig({intervalCues:event.target.checked})}/>
                    Interval cues
                  </label>
                </div>
              </section>}

              {/* Subject pills — label moved into the row, actions shrunk to icons */}
              <div style={S.subjScrollWrap}>
                <div style={S.subjScroll} ref={subjScrollRef}>
                  {subjects.map(s=>{
                    const sel = subject===s.id;
                    return (
                      <div key={s.id} style={{position:"relative",flexShrink:0}}>
                        <button
                          style={{...S.subjPill,...(sel?{borderColor:s.color,background:s.color+"18",color:s.color,fontWeight:700}:{})}}
                          onClick={()=>changeSubject(s.id)}>
                          <span style={{...S.subjDot,background:s.color}}/>
                          <span style={{fontSize:14}}>{s.emoji}</span>
                          <span style={{fontSize:13}}>{s.label}</span>
                        </button>
                        {editMode&&subjects.length>1&&<button style={S.removeBadge} onClick={()=>removeSubject(s.id)}>✕</button>}
                      </div>
                    );
                  })}
                  <button style={S.subjAddPill} onClick={()=>setShowAddModal(true)} title="Add subject">＋</button>
                  <button style={S.subjIconBtn} onClick={()=>setShowTargets(true)} title="Weekly targets">🎯</button>
                  {subjects.length>1&&(
                    <button style={{...S.subjIconBtn,...(editMode?{color:"#E07B54",borderColor:"#E07B54"}:{})}}
                      onClick={()=>setEditMode(e=>!e)} title={editMode?"Done editing":"Edit subjects"}>{editMode?"✓":"✎"}</button>
                  )}
                </div>
                {!subjScrollEdge.atStart && <div style={S.subjFadeL}/>}
                {!subjScrollEdge.atEnd && <div style={S.subjFadeR}/>}
                {!subjScrollEdge.atStart && (
                  <button type="button" className="sg-subj-scroll-arrow" style={{...S.subjScrollArrow,left:-12}}
                    onClick={()=>scrollSubjects(-260)} aria-label="Show earlier subjects" title="Earlier subjects">‹</button>
                )}
                {!subjScrollEdge.atEnd && (
                  <button type="button" className="sg-subj-scroll-arrow" style={{...S.subjScrollArrow,right:-12}}
                    onClick={()=>scrollSubjects(260)} aria-label="Show more subjects" title="More subjects">›</button>
                )}
              </div>

              {/* ── Focus center: tree preview, today total, timer, duration, plant ── */}
              <div style={S.focusCore}>
                {/* Today total + streak flame — the two numbers that matter daily */}
                <div style={S.todayWrap}>
                  <div style={S.todayLabel}>TODAY</div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{...S.todayTime,color:todaySecs>0?subjectObj.color:"#ccc"}}>
                      {todaySecs>0?fmtMins(todaySecs):"—"}
                    </div>
                    {streak>0 && (
                      <span style={{...S.streakChip,...(todaySecs>0?S.streakChipLit:{})}} title={`${streak}-day streak`}>
                        🔥{streak}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bigger tree in a soft planting-spot circle, with a quiet living world around it */}
                <div style={S.plantStage} className="sg-focus-anim">
                  <div style={{...S.plantHalo,background:`radial-gradient(circle at 50% 42%, ${subjectObj.color}22, ${subjectObj.color}08 55%, transparent 72%)`}}/>
                  <FocusAmbience layer="back"/>
                  <div style={S.treeWrap}>
                    <TreeSVG progress={0.85} color={subjectObj.color} paused={false} large skin={activeSkin} enhance={enhancements[activeSkin]||0}/>
                  </div>
                  <div style={{...S.plantMound,background:`radial-gradient(ellipse at 50% 30%, ${subjectObj.color}26, ${subjectObj.color}12 60%, transparent 75%)`}}/>
                  <FocusAmbience layer="front"/>
                </div>

                <div style={{...S.timerDisplay,color:subjectObj.color}}>
                  {timerStyle==="pomodoro"?fmt(pomodoro.focusLengthMinutes*60):mode==="timer"?fmt(duration):"00:00"}
                </div>
                <div style={S.timerLabel}>
                  {timerStyle==="pomodoro"
                    ? `${pomodoro.plannedRounds} focus ${pomodoro.plannedRounds===1?"round":"rounds"} · ${pomodoro.breakLengthMinutes} min breaks`
                    : mode==="timer"?"Set a duration and grow your learner":"Tap start — stopwatch counts up"}
                </div>
                {timerStyle==="standard"&&mode==="timer"&&(
                  <div style={S.durationSliderWrap}>
                    <div style={S.durationScale}><span>5 min</span><strong style={{color:subjectObj.color}}>{Math.round(duration/60)} minutes</strong><span>3 hr</span></div>
                    <input className="sg-duration-slider" type="range" min="5" max="180" step="5"
                      value={Math.round(duration/60)} aria-label="Study duration in minutes"
                      aria-valuetext={`${Math.round(duration/60)} minutes`}
                      style={{"--sg-slider-color":subjectObj.color,"--sg-slider-progress":`${((duration/60-5)/175)*100}%`}}
                      onChange={event=>{setDuration(Number(event.target.value)*60);setElapsed(0);}}/>
                  </div>
                )}
                {otherTabActive && (
                  <div style={S.otherTabBanner}>⏳ A session is already running in another tab</div>
                )}
                <button className="sg-plant-btn" style={{...S.plantBtn,background:otherTabActive?"#B7BDB4":subjectObj.color,...(otherTabActive?{cursor:"not-allowed"}:{})}}
                  onClick={startSession} disabled={otherTabActive}>
                  {otherTabActive?"⏳ Running elsewhere":timerStyle==="pomodoro"?"🍅 Start Pomodoro":"Start Learning ✨"}
                </button>

                {/* Weekly target progress (only if set) */}
                {targets[subject]>0 && (()=> {
                  const goalSecs = targets[subject]*3600;
                  const doneSecs = weekSubjSecs[subject]||0;
                  const pct = Math.min(doneSecs/goalSecs, 1);
                  return (
                    <div style={S.focusMeta}>
                      <span style={S.focusMetaItem}>This week · {subjectObj.label}</span>
                      <span style={S.focusMetaItem}>
                        <span style={S.metaTrack}><span style={{...S.metaFill,width:`${pct*100}%`,background:subjectObj.color}}/></span>
                        <b style={{color:pct>=1?subjectObj.color:"#888"}}>{fmtHrs(doneSecs)}/{targets[subject]}h</b>
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {tab==="leaderboard"&&(
            <div style={S.boardView} className="sg-view-anim" key="view-board">
              <StudyingNow presence={presence} currentUser={user}/>
              <MemoLeaderboardHub data={lb} currentUser={user} loading={loading||friendNetwork.loading} subjects={subjects} onVisit={setVisiting} currentWeekKey={studyWeekKey} network={friendNetwork}/>
            </div>
          )}

          {tab==="stats"&&(
            <div style={S.boardView} className="sg-view-anim" key="view-stats">
              <MemoAnalyticsPanel user={user} subjects={subjects} decorations={decorations} targets={targets} enhancements={enhancements} gardenLayout={gardenLayout} onSaveGardenLayout={handleSaveGardenLayout} currentWeekKey={studyWeekKey}/>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  app:{minHeight:"100vh",background:"var(--sg-shell-surface,#F5F7F2)",fontFamily:"'Noto Color Emoji','Inter','Segoe UI',sans-serif",maxWidth:440,margin:"0 auto",position:"relative",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",borderLeft:"1px solid rgba(255,255,255,.32)",borderRight:"1px solid rgba(255,255,255,.32)",boxShadow:"0 0 34px rgba(24,45,31,.08)"},
  header:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 16px 0"},
  logo:{fontSize:17,fontWeight:700,color:"#2D6A4F",letterSpacing:"-0.3px"},
  userChip:{fontSize:11,color:"#555",background:"#fff",border:"1px solid #e0e0e0",borderRadius:20,padding:"4px 9px"},
  coinChip:{fontSize:11.5,color:"#B8860B",background:"linear-gradient(180deg,#FFFBEF,#FFF4D6)",border:"1px solid #F0D875",borderRadius:20,padding:"5px 11px",fontWeight:700,boxShadow:"0 1px 2px rgba(184,134,11,0.12)"},
  menuBtn:{display:"flex",alignItems:"center",gap:6,background:"#fff",border:"1px solid #E6EAE4",borderRadius:20,padding:"3px 9px 3px 3px",cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"},
  menuAvatar:{width:22,height:22,borderRadius:"50%",background:"#2D6A4F",color:"#fff",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  menuBars:{fontSize:13,color:"#888",lineHeight:1},
  logoutBtn:{background:"#fff",border:"1px solid #e0e0e0",borderRadius:20,padding:"4px 8px",fontSize:12,cursor:"pointer",color:"#888",lineHeight:1},
  nav:{display:"flex",gap:4,padding:"10px 12px 8px",borderBottom:"1px dotted #C6D4C3"},
  navBtn:{flex:1,padding:"8px 0",border:"none",background:"transparent",borderRadius:10,fontSize:12,fontWeight:500,color:"#888",cursor:"pointer"},
  navBtnActive:{background:"#fff",color:"#2D6A4F",fontWeight:700,boxShadow:"0 1px 4px rgba(0,0,0,0.08)"},
  timerView:{padding:"10px 16px 40px"},
  modeRow:{display:"flex",gap:8,marginBottom:12},
  modeBtn:{flex:1,padding:"8px 0",border:"1.5px solid #E0E8DC",background:"#fff",borderRadius:20,fontSize:13,fontWeight:500,color:"#888",cursor:"pointer"},
  modeBtnActive:{fontWeight:700},
  subjectGrid:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:10},
  subjLabelRow:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8},
  subjLabelTitle:{fontSize:12,fontWeight:700,color:"#888",textTransform:"uppercase",letterSpacing:"0.5px"},
  subjActionBtn:{fontSize:11,fontWeight:600,color:"#888",background:"#fff",border:"1px solid #E0E8DC",borderRadius:16,padding:"4px 10px",cursor:"pointer"},
  subjScrollWrap:{position:"relative"},
  subjScroll:{display:"flex",gap:8,overflowX:"auto",padding:"0 2px 8px",marginBottom:12,WebkitOverflowScrolling:"touch",scrollbarWidth:"thin",scrollBehavior:"smooth",cursor:"grab"},
  subjFadeL:{position:"absolute",left:0,top:0,bottom:6,width:24,background:"linear-gradient(to right,#F5F7F2,rgba(245,247,242,0))",pointerEvents:"none"},
  subjFadeR:{position:"absolute",right:0,top:0,bottom:6,width:24,background:"linear-gradient(to left,#F5F7F2,rgba(245,247,242,0))",pointerEvents:"none"},
  subjScrollArrow:{position:"absolute",top:18,zIndex:8,width:30,height:30,borderRadius:"50%",border:"1px solid #DCE5D9",background:"rgba(255,255,255,.96)",boxShadow:"0 3px 10px rgba(35,55,40,.14)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,lineHeight:1,color:"#4E6656",cursor:"pointer",padding:0},
  subjPill:{display:"flex",alignItems:"center",gap:6,padding:"9px 14px",border:"1.5px solid #E0E8DC",background:"#fff",borderRadius:22,cursor:"pointer",color:"#666",fontWeight:500,whiteSpace:"nowrap",transition:"all 0.15s"},
  subjDot:{width:8,height:8,borderRadius:"50%",flexShrink:0},
  subjAddPill:{display:"flex",alignItems:"center",padding:"9px 14px",border:"1.5px dashed #C8D8C4",background:"transparent",borderRadius:22,cursor:"pointer",color:"#7AA56B",fontWeight:600,whiteSpace:"nowrap",flexShrink:0},
  targetCard:{background:"#fff",borderRadius:14,padding:"12px 14px",marginBottom:12,boxShadow:"0 1px 3px rgba(0,0,0,0.05)"},
  targetTop:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8},
  targetLabel:{fontSize:12,fontWeight:600,color:"#888"},
  targetVal:{fontSize:13,fontWeight:700},
  targetTrack:{height:7,background:"#EEF2EC",borderRadius:8,overflow:"hidden"},
  targetFill:{height:"100%",borderRadius:8,transition:"width 0.5s ease"},
  subjectBtn:{display:"flex",flexDirection:"column",alignItems:"center",padding:"9px 4px",border:"1.5px solid #E0E8DC",background:"#fff",borderRadius:12,cursor:"pointer"},
  subjectBtnActive:{fontWeight:600},
  removeBadge:{position:"absolute",top:-5,right:-5,width:18,height:18,borderRadius:"50%",background:"#E07B54",color:"#fff",border:"none",fontSize:10,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1,padding:0},
  addSubjectBtn:{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"9px 4px",border:"1.5px dashed #C8D8C4",background:"#f9fbf8",borderRadius:12,cursor:"pointer",fontSize:20,color:"#888",minHeight:56},
  plantStage:{position:"relative",zIndex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",margin:"46px 0 2px",minHeight:216},
  plantHalo:{position:"absolute",top:-4,left:"50%",transform:"translateX(-50%)",width:232,height:232,borderRadius:"50%",pointerEvents:"none"},
  plantMound:{position:"absolute",bottom:2,left:"50%",transform:"translateX(-50%)",width:150,height:40,borderRadius:"50%",pointerEvents:"none"},
  treeWrap:{position:"relative",display:"flex",flexDirection:"column",alignItems:"center",transform:"scale(1.22)",transformOrigin:"bottom center"},
  todayWrap:{position:"relative",zIndex:3,display:"flex",flexDirection:"column",alignItems:"center",marginBottom:2},
  todayLabel:{fontSize:10,fontWeight:700,color:"#bbb",letterSpacing:"1.6px",textTransform:"uppercase"},
  todayTime:{fontSize:26,fontWeight:800,letterSpacing:"-0.5px",transition:"color 0.3s"},
  streakChip:{fontSize:12.5,fontWeight:800,color:"#B0B8B0",background:"#F5F7F2",border:"1.5px solid #E8ECE6",borderRadius:14,padding:"3px 9px",letterSpacing:"-0.2px",transition:"all 0.3s"},
  streakChipLit:{color:"#B8741A",background:"linear-gradient(180deg,#FFF4E0,#FFE9C4)",borderColor:"#F4C04B"},
  timerDisplay:{textAlign:"center",fontSize:48,fontWeight:800,letterSpacing:"-2px",margin:"0 0 4px"},
  timerLabel:{textAlign:"center",fontSize:13,color:"#888",marginBottom:12},
  durationSliderWrap:{width:"min(100%,330px)",margin:"0 auto 18px",padding:"4px 3px 6px"},
  durationScale:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,fontSize:10.5,color:"#A3AAA1",marginBottom:11},
  plantBtn:{display:"block",width:"100%",padding:"16px 0",border:"none",borderRadius:16,fontSize:17,fontWeight:800,color:"#fff",cursor:"pointer",boxShadow:"0 4px 20px rgba(0,0,0,0.15)",letterSpacing:"-0.3px"},
  otherTabBanner:{textAlign:"center",fontSize:12.5,fontWeight:600,color:"#8A6D2F",background:"#FFF6E0",border:"1px solid #F0DFA0",borderRadius:12,padding:"9px 12px",marginBottom:10},
  // ── Calm Focus layout ──
  segWrap:{display:"flex",gap:3,background:"#EAF0E8",borderRadius:22,padding:3,marginBottom:12},
  segBtn:{flex:1,padding:"8px 0",border:"none",background:"transparent",borderRadius:20,fontSize:13,fontWeight:700,color:"#8A968A",cursor:"pointer",transition:"all 0.2s"},
  modePickBtn:{display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"100%",padding:"11px 0",border:"1.5px solid #E0E8DC",background:"#fff",borderRadius:22,fontSize:14,fontWeight:700,color:"#444",cursor:"pointer"},
  modeChev:{fontSize:14,color:"#aaa",transition:"transform 0.2s",lineHeight:1,marginTop:-3},
  modeBackdrop:{position:"fixed",inset:0,zIndex:40},
  modePop:{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,background:"#fff",borderRadius:16,padding:6,boxShadow:"0 8px 28px rgba(0,0,0,0.16)",border:"1px solid #EEF2EC",zIndex:50},
  modeOpt:{display:"flex",alignItems:"center",gap:11,width:"100%",padding:"11px 12px",border:"none",background:"transparent",borderRadius:12,cursor:"pointer",textAlign:"left"},
  modeOptLbl:{display:"block",fontSize:14,fontWeight:700},
  modeOptDesc:{display:"block",fontSize:11,color:"#aaa",marginTop:1},
  pomodoroSetup:{background:"rgba(255,255,255,.72)",border:"1px solid #E1E9DE",borderRadius:14,padding:"9px 10px 10px",marginBottom:12},
  pomodoroOptions:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap",marginTop:9},
  pomodoroOption:{display:"inline-flex",alignItems:"center",gap:6,minHeight:32,fontSize:10.5,fontWeight:650,color:"#68736A",cursor:"pointer"},
  subjIconBtn:{display:"flex",alignItems:"center",justifyContent:"center",width:38,padding:"9px 0",border:"1.5px solid #E0E8DC",background:"#fff",borderRadius:22,cursor:"pointer",color:"#888",fontSize:15,flexShrink:0},
  focusCore:{marginTop:8},
  focusMeta:{display:"flex",alignItems:"center",justifyContent:"center",gap:16,marginTop:14,flexWrap:"wrap"},
  focusMetaItem:{display:"flex",alignItems:"center",gap:7,fontSize:12.5,color:"#999",fontWeight:600},
  metaTrack:{width:54,height:5,background:"#EEF2EC",borderRadius:6,overflow:"hidden"},
  metaFill:{height:"100%",borderRadius:6,transition:"width 0.5s ease"},
  boardView:{padding:"16px 16px 40px"},
  arrangeGardenBtn:{display:"inline-flex",alignItems:"center",gap:6,padding:"7px 11px",border:"1px solid #DDE6DA",background:"#fff",borderRadius:10,fontSize:12,fontWeight:650,color:"#56645A",cursor:"pointer",boxShadow:"0 1px 2px rgba(0,0,0,.035)"},
  rewardCard:{background:"linear-gradient(180deg,#FFFDF7,#FFF9E9)",border:"1px solid #F0E1B8",borderRadius:15,padding:"12px 12px 10px",margin:"10px 0 12px"},
  rewardCardTop:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:9},
  rewardCardTitle:{fontSize:11,fontWeight:750,color:"#786434",textTransform:"uppercase",letterSpacing:".6px"},
  rewardCycleBadge:{fontSize:9.5,fontWeight:700,color:"#84713B",background:"rgba(255,255,255,.72)",border:"1px solid rgba(205,174,94,.28)",borderRadius:20,padding:"3px 7px",whiteSpace:"nowrap"},
  rewardPrizeRow:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7},
  rewardPrize:{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,.78)",border:"1px solid rgba(205,174,94,.25)",borderRadius:11,padding:"8px 4px",minHeight:62},
  rewardPrizeSkin:{background:"linear-gradient(180deg,rgba(244,239,255,.92),rgba(255,255,255,.82))",border:"1px solid rgba(145,115,194,.28)"},
  rewardMedal:{fontSize:18,lineHeight:1},
  rewardPlace:{fontSize:10.5,fontWeight:700,color:"#7C704F",marginTop:4},
  rewardCoins:{fontSize:11,fontWeight:800,color:"#A77711",marginTop:2},
  rewardSkin:{fontSize:10.5,fontWeight:800,color:"#7356A8",marginTop:3,textAlign:"center",lineHeight:1.15},
  rewardHint:{fontSize:10,color:"#A2946F",textAlign:"center",marginTop:8},
  weekNav:{display:"grid",gridTemplateColumns:"64px minmax(0,1fr) 64px",alignItems:"center",gap:5,background:"#EEF4EC",border:"1px solid #DDE7D9",borderRadius:14,padding:5,margin:"0 0 10px"},
  weekNavBtn:{minWidth:0,height:38,display:"flex",alignItems:"center",justifyContent:"center",gap:3,padding:"0 6px",border:"1px solid #D8E3D5",borderRadius:10,background:"#fff",color:"#456451",fontSize:10.5,fontWeight:750,lineHeight:1,cursor:"pointer",boxShadow:"0 1px 2px rgba(31,57,39,.05)"},
  weekNavArrow:{fontSize:18,fontWeight:500,lineHeight:.8,marginTop:-1},
  weekNavBtnDisabled:{opacity:.3,cursor:"default",boxShadow:"none",background:"rgba(255,255,255,.55)"},
  weekNavCenter:{minWidth:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",lineHeight:1.1},
  weekNavLabel:{fontSize:13.5,fontWeight:750,color:"#263C2E",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%"},
  weekNavRange:{fontSize:9.5,fontWeight:600,color:"#879289",marginTop:3},
  toggleRow:{display:"flex",gap:3,marginBottom:14,background:"#EAF0E8",borderRadius:12,padding:3},
  toggleBtn:{flex:1,padding:"8px 0",border:"none",background:"transparent",borderRadius:9,fontSize:13,fontWeight:600,color:"#8A968A",cursor:"pointer",transition:"all 0.2s"},
  toggleBtnActive:{background:"#fff",color:"#2D6A4F",fontWeight:700,boxShadow:"0 1px 4px rgba(0,0,0,0.10)"},
  boardRow:{display:"flex",alignItems:"center",background:"#fff",borderRadius:12,padding:"12px 14px",marginBottom:8,boxShadow:"0 1px 3px rgba(0,0,0,0.05)"},
  boardRowMe:{border:"2px solid #56B68B",background:"#F0FBF6"},
  boardRank:{width:32,fontSize:18,textAlign:"center"},
  empty:{textAlign:"center",color:"#aaa",fontSize:14,marginTop:40},
  loginWrap:{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(160deg,#D8F0E0 0%,#F5F7F2 60%)",padding:20},
  loginCard:{background:"#fff",borderRadius:24,padding:"40px 32px",width:"100%",maxWidth:340,boxShadow:"0 8px 32px rgba(45,106,79,0.12)",textAlign:"center"},
  loginTitle:{fontSize:28,fontWeight:800,color:"#2D6A4F",margin:"0 0 6px",letterSpacing:"-0.5px"},
  loginSub:{fontSize:14,color:"#888",margin:"0 0 24px"},
  loginHint:{fontSize:11,color:"#bbb",margin:"6px 0 16px",lineHeight:1.6,textAlign:"center"},
  input:{display:"block",width:"100%",padding:"12px 14px",border:"1.5px solid #E0E8DC",borderRadius:12,fontSize:15,outline:"none",boxSizing:"border-box",marginBottom:8},
  inputErr:{borderColor:"#E07B54"},
  errText:{color:"#E07B54",fontSize:12,margin:"0 0 8px",textAlign:"left"},
  primaryBtn:{display:"block",width:"100%",padding:"14px 0",background:"#2D6A4F",color:"#fff",border:"none",borderRadius:14,fontSize:16,fontWeight:700,cursor:"pointer",marginTop:8},
  linkBtn:{display:"block",width:"100%",background:"none",border:"none",color:"#56B68B",fontSize:13,fontWeight:600,cursor:"pointer",marginTop:12,padding:"4px 0"},
  recBox:{background:"#F6FAF5",border:"1px solid #E0E8DC",borderRadius:12,padding:"12px",margin:"4px 0 8px",textAlign:"left"},
  recHint:{fontSize:11,color:"#888",margin:"0 0 8px",lineHeight:1.5},
  recSelect:{width:"100%",padding:"10px",border:"1.5px solid #E0E8DC",borderRadius:10,fontSize:13,marginBottom:8,outline:"none",background:"#fff",color:"#333"},
  toast:{position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",background:"#1a1a2e",color:"#fff",padding:"10px 20px",borderRadius:24,fontSize:13,fontWeight:500,boxShadow:"0 4px 16px rgba(0,0,0,0.2)",zIndex:400,whiteSpace:"nowrap"},
};
