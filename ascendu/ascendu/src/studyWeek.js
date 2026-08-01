// One global study-week contract for Lumora.
//
// Every weekly surface uses Australia/Melbourne Sunday 00:00 through the next
// Sunday 00:00. Using an explicit IANA timezone keeps users in other regions,
// mobile background tabs and daylight-saving changes on the same boundary.
export const STUDY_WEEK_TIME_ZONE = "Australia/Melbourne";

const DAY_MS = 24 * 60 * 60 * 1000;
const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: STUDY_WEEK_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const zonedParts = value => {
  const date = value instanceof Date ? value : new Date(value);
  if(Number.isNaN(date.getTime())) throw new TypeError("Invalid study-week date");
  const values = {};
  partsFormatter.formatToParts(date).forEach(part => {
    if(part.type !== "literal") values[part.type] = Number(part.value);
  });
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
};

const addCalendarDays = (parts, days) => {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
};

// Convert a Melbourne wall-clock time to its UTC instant. Two passes account
// for offset changes around daylight-saving transitions. The weekly boundary
// itself is midnight, which is never an ambiguous Melbourne transition time.
const zonedDateTimeToUtc = ({ year, month, day, hour=0, minute=0, second=0 }) => {
  const wallClockUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let instant = wallClockUtc;
  for(let pass=0;pass<2;pass++){
    const actual = zonedParts(new Date(instant));
    const representedAsUtc = Date.UTC(
      actual.year, actual.month - 1, actual.day,
      actual.hour, actual.minute, actual.second,
    );
    instant -= representedAsUtc - wallClockUtc;
  }
  return new Date(instant);
};

const sundayCalendarFor = value => {
  const local = zonedParts(value);
  const localDate = new Date(Date.UTC(local.year, local.month - 1, local.day));
  return addCalendarDays(local, -localDate.getUTCDay());
};

const legacyCompatibleKeyForSunday = sunday => {
  const start = Date.UTC(sunday.year, sunday.month - 1, sunday.day);
  const januaryFirst = Date.UTC(sunday.year, 0, 1);
  const januaryDay = new Date(januaryFirst).getUTCDay();
  const week = Math.ceil(((start - januaryFirst) / DAY_MS + januaryDay + 1) / 7);
  return `${sunday.year}-W${week}`;
};

export function getStudyWeek(value = new Date()) {
  const sunday = sundayCalendarFor(value);
  const nextSunday = addCalendarDays(sunday, 7);
  return {
    key: legacyCompatibleKeyForSunday(sunday),
    start: zonedDateTimeToUtc(sunday),
    endExclusive: zonedDateTimeToUtc(nextSunday),
    startCalendar: sunday,
  };
}

export const getStudyWeekKey = value => getStudyWeek(value).key;
export const startOfStudyWeek = value => getStudyWeek(value).start;
export const startOfStudyDay = value => {
  const local = zonedParts(value);
  return zonedDateTimeToUtc({year:local.year,month:local.month,day:local.day});
};

export const shiftStudyDay = (value, days) => {
  const local = zonedParts(value);
  return zonedDateTimeToUtc(addCalendarDays(local, Number(days)));
};

export function shiftStudyWeek(value = new Date(), weeks = 0) {
  const current = getStudyWeek(value);
  const targetSunday = addCalendarDays(current.startCalendar, Number(weeks) * 7);
  const nextSunday = addCalendarDays(targetSunday, 7);
  return {
    key: legacyCompatibleKeyForSunday(targetSunday),
    start: zonedDateTimeToUtc(targetSunday),
    endExclusive: zonedDateTimeToUtc(nextSunday),
    startCalendar: targetSunday,
  };
}

export const getPreviousStudyWeekKey = value => shiftStudyWeek(value, -1).key;
export const getPreviousStudyWeekStart = value => shiftStudyWeek(value, -1).start;

export function getStudyWeekDistance(from, to) {
  const a = getStudyWeek(from).startCalendar;
  const b = getStudyWeek(to).startCalendar;
  const aDay = Date.UTC(a.year, a.month - 1, a.day);
  const bDay = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((bDay - aDay) / (7 * DAY_MS));
}

export function getStudyDayOfWeek(value = new Date()) {
  const local = zonedParts(value);
  return new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay();
}

export function formatStudyDate(value, options={}) {
  return new Date(value).toLocaleDateString("en-AU", {
    timeZone: STUDY_WEEK_TIME_ZONE,
    ...options,
  });
}
