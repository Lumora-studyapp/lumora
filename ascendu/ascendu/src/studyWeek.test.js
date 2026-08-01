import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  STUDY_WEEK_TIME_ZONE,
  getPreviousStudyWeekKey,
  getStudyDayOfWeek,
  getStudyWeek,
  getStudyWeekDistance,
  getStudyWeekKey,
  shiftStudyWeek,
} from "./studyWeek.js";

const require = createRequire(import.meta.url);
const serverWeek = require("../functions/studyWeek.js");

test("uses the Melbourne Sunday-midnight boundary", () => {
  assert.equal(STUDY_WEEK_TIME_ZONE, "Australia/Melbourne");
  assert.equal(getStudyWeekKey("2026-08-01T13:59:59.999Z"), "2026-W31");
  assert.equal(getStudyWeekKey("2026-08-01T14:00:00.000Z"), "2026-W32");
});

test("uses the daylight-saving Melbourne boundary", () => {
  const before = getStudyWeek("2026-12-05T12:59:59.999Z");
  const after = getStudyWeek("2026-12-05T13:00:00.000Z");
  assert.notEqual(before.key, after.key);
  assert.equal(after.start.toISOString(), "2026-12-05T13:00:00.000Z");
});

test("keeps a cross-year Sunday week on one key", () => {
  const sundayWeek = getStudyWeekKey("2025-12-31T13:00:00.000Z");
  assert.equal(getStudyWeekKey("2026-01-01T13:00:00.000Z"), sundayWeek);
  assert.equal(getPreviousStudyWeekKey("2026-01-04T00:00:00.000Z"), sundayWeek);
});

test("shifts whole study weeks without daylight-saving drift", () => {
  const anchor = new Date("2026-10-03T14:30:00.000Z");
  const previous = shiftStudyWeek(anchor, -1);
  assert.equal(getStudyWeekDistance(previous.start, anchor), 1);
  assert.equal(previous.start.getUTCHours(), 14);
});

test("day-of-week is evaluated in Melbourne", () => {
  assert.equal(getStudyDayOfWeek("2026-08-01T14:00:00.000Z"), 0);
});

test("client and Cloud Functions use identical week keys", () => {
  [
    "2026-08-01T13:59:59.999Z",
    "2026-08-01T14:00:00.000Z",
    "2026-12-05T13:00:00.000Z",
    "2026-01-01T13:00:00.000Z",
  ].forEach(value=>assert.equal(serverWeek.getStudyWeekKey(value),getStudyWeekKey(value)));
});
