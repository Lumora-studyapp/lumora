import test from "node:test";
import assert from "node:assert/strict";
import {studyRecords} from "./studyProfileRecords.js";

test("study records keep Melbourne calendar streaks across daylight saving",()=>{
  const records=studyRecords([
    {ts:Date.parse("2026-10-03T15:30:00Z"),secs:3600},
    {ts:Date.parse("2026-10-04T14:30:00Z"),secs:7200},
    {ts:null,secs:9000},
  ]);
  assert.equal(records[0].value,"2 days");
  assert.equal(records[1].value,"120 min");
  assert.equal(records[2].value,"3 h");
  assert.equal(records[3].value,"2");
});
