import {formatStudyDate,startOfStudyDay,shiftStudyDay,getStudyWeek,shiftStudyWeek} from './studyWeek.js';

export const shortTime=secs=>{
  const minutes=Math.floor(Math.max(0,Number(secs)||0)/60);
  return minutes>=60?`${Math.floor(minutes/60)}h${minutes%60?` ${minutes%60}m`:''}`:`${minutes}m`;
};
export const dateKey=value=>formatStudyDate(value,{year:'numeric',month:'2-digit',day:'2-digit'}).split('/').reverse().join('-');
export function cleanSessions(history,now=Date.now()) {
  return (Array.isArray(history)?history:[]).filter(s=>s?.ts!=null&&Number.isFinite(Number(s.ts))&&Number(s.ts)<=now&&Number.isFinite(Number(s.secs))&&Number(s.secs)>0)
    .map(s=>({...s,ts:Number(s.ts),secs:Number(s.secs)}));
}
export function subjectParts(session) {
  const parts=(Array.isArray(session.subjectSegments)?session.subjectSegments:[]).filter(p=>typeof p?.subject==='string'&&Number.isFinite(Number(p.secs))&&Number(p.secs)>0);
  const total=parts.reduce((n,p)=>n+Number(p.secs),0);
  let assigned=0,weight=0;
  return total?parts.map((part,index)=>{
    weight+=Number(part.secs);
    const secs=(index===parts.length-1?session.secs:Math.round(session.secs*weight/total))-assigned;
    assigned+=secs;return {subject:part.subject,secs};
  }):[{subject:session.subject||'unknown',secs:session.secs}];
}
// Distribute recorded focus over its wall-clock span, as the session writer does.
// Cumulative rounding preserves totals across adjacent days, including DST.
export function secondsInRange(session,start,end) {
  const a=Number(session.ts),b=Number(session.endTs)>a?Number(session.endTs):a;
  if(b===a)return a>=start&&a<end?session.secs:0;
  const at=t=>Math.round(session.secs*Math.max(0,Math.min(1,(t-a)/(b-a))));
  return Math.max(0,at(end)-at(start));
}
export function summarize(sessions,start,end) {
  const subjects={};let secs=0,count=0;
  sessions.forEach(s=>{
    const amount=secondsInRange(s,+start,+end);
    if(!amount)return;
    secs+=amount;count++;
    let assigned=0,weight=0;const parts=subjectParts(s);
    parts.forEach((p,index)=>{weight+=p.secs;const n=(index===parts.length-1?amount:Math.round(amount*weight/s.secs))-assigned;assigned+=n;subjects[p.subject]=(subjects[p.subject]||0)+n;});
  });
  return {secs,count,subjects,average:count?secs/count:0};
}
export function monthRange(now,offset=0) {
  const [year,month]=dateKey(now).split('-').map(Number);
  const start=startOfStudyDay(Date.UTC(year,month-1+offset,1));
  const end=startOfStudyDay(Date.UTC(year,month+offset,1));
  return {start,end};
}
export function periodRange(period,now) {
  if(period==='day'){const start=startOfStudyDay(now);return {start,end:shiftStudyDay(start,1),previousStart:shiftStudyDay(start,-1)};}
  if(period==='month'){const range=monthRange(now);return {...range,previousStart:monthRange(now,-1).start};}
  const week=getStudyWeek(now);return {start:week.start,end:week.endExclusive,previousStart:shiftStudyWeek(now,-1).start};
}
export function calendarDays(history,now,offset=0) {
  const sessions=cleanSessions(history,+now),range=monthRange(now,offset);
  const weekday=new Date(dateKey(range.start)+'T12:00:00Z').getUTCDay();
  const leading=(weekday+6)%7,days=[];
  for(let day=range.start;day<range.end;day=shiftStudyDay(day,1)){
    const end=shiftStudyDay(day,1),summary=summarize(sessions,day,end);
    days.push({key:dateKey(day),date:+day,day:Number(dateKey(day).slice(-2)),future:day>now,...summary});
  }
  return {...range,leading,days,max:Math.max(1,...days.map(d=>d.secs))};
}
export function personalBests(history,now=Date.now()) {
  const sessions=cleanSessions(history,now);const days=new Map();
  for(const s of sessions){
    let day=startOfStudyDay(s.ts);const end=Math.min(now,Number(s.endTs)>s.ts?Number(s.endTs):s.ts);
    for(let guard=0;day<=end&&guard<370;guard++,day=shiftStudyDay(day,1)){
      const amount=secondsInRange(s,+day,+shiftStudyDay(day,1));
      if(amount)days.set(dateKey(day),(days.get(dateKey(day))||0)+amount);
    }
  }
  const keys=[...days.keys()].sort();let longest=0,run=0;
  keys.forEach((key,index)=>{run=index&&Date.parse(key)-Date.parse(keys[index-1])===86400000?run+1:1;longest=Math.max(longest,run);});
  const best=[...days].sort((a,b)=>b[1]-a[1])[0];
  return {longestStreak:longest,bestDay:best?.[1]||0,bestDayKey:best?.[0],longestSession:Math.max(0,...sessions.map(s=>s.secs)),activeDays:days.size,total:sessions.reduce((n,s)=>n+s.secs,0)};
}
export function studySuggestions(history,subjects,targets={},now=Date.now()) {
  const sessions=cleanSessions(history,now),week=getStudyWeek(now);
  const summary=summarize(sessions,week.start,Math.min(+week.endExclusive,now+1));
  if(!sessions.length)return [{title:'Start with a small win',body:'Choose one subject and try a 15-minute focus session.',subjectId:subjects[0]?.id,minutes:15}];
  const ranked=subjects.map(s=>({...s,done:summary.subjects[s.id]||0,goal:Math.max(0,Number(targets[s.id])||0)*3600}));
  const gap=ranked.filter(s=>s.goal>s.done).sort((a,b)=>(b.goal-b.done)-(a.goal-a.done))[0];
  const least=[...ranked].sort((a,b)=>a.done-b.done)[0];
  const chosen=gap||least;const out=[];
  if(chosen)out.push({title:gap?`A little closer in ${chosen.label}`:`Make room for ${chosen.label}`,body:gap?`${shortTime(gap.goal-gap.done)} remains on your weekly subject goal. Try one 20-minute block.`:`You've logged ${shortTime(chosen.done)} in this subject this week. Try a 20-minute review if it fits your priorities.`,subjectId:chosen.id,minutes:20});
  const today=summarize(sessions,startOfStudyDay(now),now+1);
  out.push(today.secs?{title:'Turn today’s work into recall',body:'Try a 10-minute recap: close your notes and write three things you remember.',subjectId:chosen?.id,minutes:10}:{title:'Keep the next step manageable',body:'A 15-minute session is a useful start. Pick one task you can finish today.',subjectId:chosen?.id,minutes:15});
  return out;
}
