"use strict";

// Server mirror of src/studyWeek.js. Cloud Functions cannot import the Vite
// ESM module, so keep this small CommonJS helper covered by the same boundary
// tests. Board writes therefore use the identical Melbourne Sunday contract.
const STUDY_WEEK_TIME_ZONE = "Australia/Melbourne";
const DAY_MS = 24 * 60 * 60 * 1000;
const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: STUDY_WEEK_TIME_ZONE,
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
  hourCycle: "h23",
});

function zonedParts(value) {
  const date = value instanceof Date ? value : new Date(value);
  if(Number.isNaN(date.getTime())) throw new TypeError("Invalid study-week date");
  const values = {};
  formatter.formatToParts(date).forEach(part => {
    if(part.type !== "literal") values[part.type] = Number(part.value);
  });
  return values;
}

function addCalendarDays(parts, days) {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {year:shifted.getUTCFullYear(),month:shifted.getUTCMonth()+1,day:shifted.getUTCDate()};
}

function sundayCalendarFor(value) {
  const local = zonedParts(value);
  const weekday = new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay();
  return addCalendarDays(local,-weekday);
}

function getStudyWeekKey(value = new Date()) {
  const sunday = sundayCalendarFor(value);
  const start = Date.UTC(sunday.year, sunday.month - 1, sunday.day);
  const januaryFirst = Date.UTC(sunday.year, 0, 1);
  const januaryDay = new Date(januaryFirst).getUTCDay();
  const week = Math.ceil(((start - januaryFirst) / DAY_MS + januaryDay + 1) / 7);
  return `${sunday.year}-W${week}`;
}

module.exports = {STUDY_WEEK_TIME_ZONE,getStudyWeekKey};
