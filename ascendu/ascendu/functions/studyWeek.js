"use strict";

// CommonJS mirror of src/studyWeek.js for callable Cloud Functions.
const STUDY_WEEK_TIME_ZONE="Australia/Melbourne";
const STUDY_WEEK_RESET_HOUR=4;
const DAY_MS=86400000;
const formatter=new Intl.DateTimeFormat("en-CA",{timeZone:STUDY_WEEK_TIME_ZONE,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});
function zonedParts(value){const date=value instanceof Date?value:new Date(value);if(Number.isNaN(date.getTime()))throw new TypeError("Invalid study-week date");const out={};formatter.formatToParts(date).forEach(part=>{if(part.type!=="literal")out[part.type]=Number(part.value);});return out;}
function addCalendarDays(parts,days){const date=new Date(Date.UTC(parts.year,parts.month-1,parts.day+days));return {year:date.getUTCFullYear(),month:date.getUTCMonth()+1,day:date.getUTCDate()};}
function zonedDateTimeToUtc({year,month,day,hour=0,minute=0,second=0}){const wall=Date.UTC(year,month-1,day,hour,minute,second);let instant=wall;for(let pass=0;pass<2;pass++){const actual=zonedParts(instant);instant-=Date.UTC(actual.year,actual.month-1,actual.day,actual.hour,actual.minute,actual.second)-wall;}return new Date(instant);}
function mondayCalendarFor(value){const local=zonedParts(value);const effective=local.hour<STUDY_WEEK_RESET_HOUR?addCalendarDays(local,-1):local;const weekday=new Date(Date.UTC(effective.year,effective.month-1,effective.day)).getUTCDay();return addCalendarDays(effective,-((weekday+6)%7));}
function keyForMonday(monday){const mondayUtc=Date.UTC(monday.year,monday.month-1,monday.day),thursday=new Date(mondayUtc+3*DAY_MS),year=thursday.getUTCFullYear(),jan4=new Date(Date.UTC(year,0,4)),firstMonday=Date.UTC(year,0,4-((jan4.getUTCDay()+6)%7));return `${year}-W${String(1+Math.floor((mondayUtc-firstMonday)/(7*DAY_MS))).padStart(2,"0")}`;}
function getStudyWeek(value=new Date()){const monday=mondayCalendarFor(value),next=addCalendarDays(monday,7);return {key:keyForMonday(monday),start:zonedDateTimeToUtc({...monday,hour:STUDY_WEEK_RESET_HOUR}),endExclusive:zonedDateTimeToUtc({...next,hour:STUDY_WEEK_RESET_HOUR})};}
function getStudyWeekKey(value=new Date()){return getStudyWeek(value).key;}
function splitStudySessionByWeek(startValue,endValue,totalSecs){const start=new Date(startValue).getTime(),end=new Date(endValue).getTime(),total=Math.max(0,Math.round(Number(totalSecs)||0));if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||!total)return total?[{weekKey:getStudyWeekKey(startValue),secs:total,sessions:1}]:[];const spans=[];let cursor=start;while(cursor<end){const week=getStudyWeek(cursor),chunkEnd=Math.min(end,week.endExclusive.getTime());spans.push({weekKey:week.key,wallMs:chunkEnd-cursor});cursor=chunkEnd;}let assigned=0;return spans.map((span,index)=>{const secs=index===spans.length-1?total-assigned:Math.round(total*span.wallMs/(end-start));assigned+=secs;return {weekKey:span.weekKey,secs,sessions:index===0?1:0};}).filter(span=>span.secs>0||span.sessions>0);}

module.exports={STUDY_WEEK_TIME_ZONE,STUDY_WEEK_RESET_HOUR,getStudyWeekKey,splitStudySessionByWeek};
