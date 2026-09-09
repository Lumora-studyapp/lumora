import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {STUDY_WEEK_TIME_ZONE,STUDY_WEEK_RESET_HOUR,getPreviousStudyWeekKey,getStudyDayOfWeek,getStudyWeek,getStudyWeekDistance,getStudyWeekKey,shiftStudyWeek,splitStudySessionByWeek} from "./studyWeek.js";
const require=createRequire(import.meta.url);
const serverWeek=require("../functions/studyWeek.js");

test("resets Monday at 4am in the host timezone",()=>{
  assert.equal(STUDY_WEEK_TIME_ZONE,"Australia/Melbourne");
  assert.equal(STUDY_WEEK_RESET_HOUR,4);
  assert.equal(getStudyWeekKey("2026-08-02T17:59:59.999Z"),"2026-W31");
  assert.equal(getStudyWeekKey("2026-08-02T18:00:00.000Z"),"2026-W32");
});

test("follows daylight saving at the Monday 4am boundary",()=>{
  const before=getStudyWeek("2026-12-06T16:59:59.999Z");
  const after=getStudyWeek("2026-12-06T17:00:00.000Z");
  assert.notEqual(before.key,after.key);
  assert.equal(after.start.toISOString(),"2026-12-06T17:00:00.000Z");
});

test("keeps a cross-year Monday week on one key",()=>{
  const week=getStudyWeekKey("2025-12-31T13:00:00.000Z");
  assert.equal(getStudyWeekKey("2026-01-01T13:00:00.000Z"),week);
  assert.equal(getPreviousStudyWeekKey("2026-01-05T00:00:00.000Z"),week);
});

test("shifts whole study weeks without daylight-saving drift",()=>{
  const anchor=new Date("2026-10-05T00:00:00.000Z"),previous=shiftStudyWeek(anchor,-1);
  assert.equal(getStudyWeekDistance(previous.start,anchor),1);
});

test("splits time but counts a boundary-spanning session once",()=>{
  assert.deepEqual(splitStudySessionByWeek("2026-08-02T17:59:00.000Z","2026-08-02T18:01:00.000Z",120),[
    {weekKey:"2026-W31",secs:60,sessions:1},
    {weekKey:"2026-W32",secs:60,sessions:0},
  ]);
});

test("day-of-week is evaluated in Melbourne",()=>assert.equal(getStudyDayOfWeek("2026-08-02T18:00:00.000Z"),1));
test("client and Cloud Functions use identical week keys and splits",()=>{
  ["2026-08-02T17:59:59.999Z","2026-08-02T18:00:00.000Z","2026-12-06T17:00:00.000Z","2026-01-01T13:00:00.000Z"].forEach(value=>assert.equal(serverWeek.getStudyWeekKey(value),getStudyWeekKey(value)));
  assert.deepEqual(serverWeek.splitStudySessionByWeek("2026-08-02T17:59:00.000Z","2026-08-02T18:01:00.000Z",120),splitStudySessionByWeek("2026-08-02T17:59:00.000Z","2026-08-02T18:01:00.000Z",120));
});
