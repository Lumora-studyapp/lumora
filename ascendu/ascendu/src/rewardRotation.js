import { getStudyWeekDistance } from "./studyWeek.js";

// Sunday 19 July 2026, 00:00 Australia/Melbourne. Keeping this launch anchor
// stable preserves every completed reward week while extending the cycle from
// two modes to three: coins -> character -> classroom -> repeat.
export const REWARD_ROTATION_START = new Date("2026-07-18T14:00:00.000Z");
export const WEEKLY_REWARD_MODES = Object.freeze(["coins", "skin", "classroom"]);

export function getWeeklyRewardMode(date = new Date()) {
  const target = date instanceof Date ? date : new Date(date);
  const weeksSinceLaunch = getStudyWeekDistance(REWARD_ROTATION_START, target);
  if (weeksSinceLaunch < 0) return "coins";
  return WEEKLY_REWARD_MODES[weeksSinceLaunch % WEEKLY_REWARD_MODES.length];
}

export function stableRewardHash(value) {
  const text = String(value || "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}

export function pickDeterministicUnowned({
  weekKey,
  username,
  prizeType,
  items = [],
  ownedIds = [],
  eligible = () => true,
}) {
  const owned = new Set(Array.isArray(ownedIds) ? ownedIds.map(String) : []);
  const available = items.filter(item => item?.id && eligible(item) && !owned.has(String(item.id)));
  if (!available.length) return null;
  const seed = `${weekKey}|${username}|${prizeType}`;
  return available[stableRewardHash(seed) % available.length];
}
