// One global study-week contract for Lumora.
// Weekly surfaces reset Monday at 04:00 in the host account's Melbourne time.
export const STUDY_WEEK_TIME_ZONE = "Australia/Melbourne";
export const STUDY_WEEK_RESET_HOUR = 4;
const DAY_MS = 86400000;
const formatter = new Intl.DateTimeFormat("en-CA",{timeZone:STUDY_WEEK_TIME_ZONE,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});
const zonedParts=value=>{const date=value instanceof Date?value:new Date(value);if(Number.isNaN(date.getTime()))throw new TypeError("Invalid study-week date");const out={};formatter.formatToParts(date).forEach(part=>{if(part.type!=="literal")out[part.type]=Number(part.value);});return out;};
const addCalendarDays=(parts,days)=>{const date=new Date(Date.UTC(parts.year,parts.month-1,parts.day+days));return {year:date.getUTCFullYear(),month:date.getUTCMonth()+1,day:date.getUTCDate()};};
const zonedDateTimeToUtc=({year,month,day,hour=0,minute=0,second=0})=>{const wall=Date.UTC(year,month-1,day,hour,minute,second);let instant=wall;for(let pass=0;pass<2;pass++){const actual=zonedParts(instant);instant-=Date.UTC(actual.year,actual.month-1,actual.day,actual.hour,actual.minute,actual.second)-wall;}return new Date(instant);};
const mondayCalendarFor=value=>{const local=zonedParts(value);const effective=local.hour<STUDY_WEEK_RESET_HOUR?addCalendarDays(local,-1):local;const weekday=new Date(Date.UTC(effective.year,effective.month-1,effective.day)).getUTCDay();return addCalendarDays(effective,-((weekday+6)%7));};
const keyForMonday=monday=>{const mondayUtc=Date.UTC(monday.year,monday.month-1,monday.day);const thursday=new Date(mondayUtc+3*DAY_MS);const year=thursday.getUTCFullYear();const jan4=new Date(Date.UTC(year,0,4));const firstMonday=Date.UTC(year,0,4-((jan4.getUTCDay()+6)%7));const week=1+Math.floor((mondayUtc-firstMonday)/(7*DAY_MS));return `${year}-W${String(week).padStart(2,"0")}`;};

export function getStudyWeek(value=new Date()){const monday=mondayCalendarFor(value),next=addCalendarDays(monday,7);return {key:keyForMonday(monday),start:zonedDateTimeToUtc({...monday,hour:STUDY_WEEK_RESET_HOUR}),endExclusive:zonedDateTimeToUtc({...next,hour:STUDY_WEEK_RESET_HOUR}),startCalendar:monday};}
export const getStudyWeekKey=value=>getStudyWeek(value).key;
export const startOfStudyWeek=value=>getStudyWeek(value).start;
export const startOfStudyDay=value=>{const local=zonedParts(value);return zonedDateTimeToUtc({year:local.year,month:local.month,day:local.day});};
export const shiftStudyDay=(value,days)=>{const local=zonedParts(value);return zonedDateTimeToUtc(addCalendarDays(local,Number(days)));};
export function shiftStudyWeek(value=new Date(),weeks=0){const current=getStudyWeek(value),monday=addCalendarDays(current.startCalendar,Number(weeks)*7),next=addCalendarDays(monday,7);return {key:keyForMonday(monday),start:zonedDateTimeToUtc({...monday,hour:STUDY_WEEK_RESET_HOUR}),endExclusive:zonedDateTimeToUtc({...next,hour:STUDY_WEEK_RESET_HOUR}),startCalendar:monday};}
export const getPreviousStudyWeekKey=value=>shiftStudyWeek(value,-1).key;
export const getPreviousStudyWeekStart=value=>shiftStudyWeek(value,-1).start;
export function getStudyWeekDistance(from,to){const a=getStudyWeek(from).startCalendar,b=getStudyWeek(to).startCalendar;return Math.round((Date.UTC(b.year,b.month-1,b.day)-Date.UTC(a.year,a.month-1,a.day))/(7*DAY_MS));}
export function getStudyDayOfWeek(value=new Date()){const local=zonedParts(value);return new Date(Date.UTC(local.year,local.month-1,local.day)).getUTCDay();}

// A session remains one history item. Only its focused seconds are divided at
// a reset boundary; its single session count belongs to the week it started.
export function splitStudySessionByWeek(startValue,endValue,totalSecs){
  const start=new Date(startValue).getTime(),end=new Date(endValue).getTime(),total=Math.max(0,Math.round(Number(totalSecs)||0));
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||!total)return total?[{weekKey:getStudyWeekKey(startValue),secs:total,sessions:1}]:[];
  const spans=[];let cursor=start;
  while(cursor<end){const week=getStudyWeek(cursor),chunkEnd=Math.min(end,week.endExclusive.getTime());spans.push({weekKey:week.key,wallMs:chunkEnd-cursor});cursor=chunkEnd;}
  let assigned=0;
  return spans.map((span,index)=>{const secs=index===spans.length-1?total-assigned:Math.round(total*span.wallMs/(end-start));assigned+=secs;return {weekKey:span.weekKey,secs,sessions:index===0?1:0};}).filter(span=>span.secs>0||span.sessions>0);
}

export function formatStudyDate(value,options={}){return new Date(value).toLocaleDateString("en-AU",{timeZone:STUDY_WEEK_TIME_ZONE,...options});}
