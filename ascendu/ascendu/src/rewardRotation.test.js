import test from "node:test";
import assert from "node:assert/strict";

import {
  getWeeklyRewardMode,
  pickDeterministicUnowned,
  stableRewardHash,
} from "./rewardRotation.js";

test("weekly rewards rotate coins, character, classroom from Sunday midnight Melbourne", () => {
  assert.equal(getWeeklyRewardMode(new Date("2026-07-18T14:00:00.000Z")), "coins");
  assert.equal(getWeeklyRewardMode(new Date("2026-07-25T14:00:00.000Z")), "skin");
  assert.equal(getWeeklyRewardMode(new Date("2026-08-01T14:00:00.000Z")), "classroom");
  assert.equal(getWeeklyRewardMode(new Date("2026-08-08T14:00:00.000Z")), "coins");
  assert.equal(getWeeklyRewardMode(new Date("2026-07-11T14:00:00.000Z")), "coins");
});

test("deterministic prizes exclude owned and ineligible catalogue entries", () => {
  const items = [
    { id:"default", cost:0 },
    { id:"rain", cost:500 },
    { id:"moon", cost:800 },
  ];
  const options = {
    weekKey:"2026-08-02",
    username:"learner",
    prizeType:"background",
    items,
    ownedIds:["rain"],
    eligible:item => item.cost > 0,
  };
  assert.equal(pickDeterministicUnowned(options)?.id, "moon");
  assert.equal(pickDeterministicUnowned(options)?.id, "moon");
  assert.equal(pickDeterministicUnowned({...options, ownedIds:["rain", "moon"]}), null);
});

test("reward hash is stable", () => {
  assert.equal(stableRewardHash("2026-08-02|learner|background"), 968542874);
});
