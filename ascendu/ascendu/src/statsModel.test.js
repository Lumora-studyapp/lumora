import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarDays,cleanSessions,dateKey,personalBests,periodRange,secondsInRange,studySuggestions,subjectParts,summarize} from './statsModel.js';
import {getStudyWeek,shiftStudyDay,startOfStudyDay} from './studyWeek.js';

const at=value=>Date.parse(value);
const now=at('2026-11-14T12:00:00+11:00');
test('reducing a multi-subject session updates every derived total and record',()=>{
  const original={ts:now-3600000,endTs:now,secs:3600,subjectSegments:[{subject:'math',secs:2400},{subject:'english',secs:1200}]};
  const edited={...original,secs:1800};
  assert.equal(personalBests([edited],now).total,1800);
  assert.equal(personalBests([edited],now).bestDay,1800);
  assert.equal(personalBests([edited],now).longestSession,1800);
  assert.deepEqual(summarize([edited],getStudyWeek(now).start,now+1).subjects,{math:1200,english:600});
  assert.equal(calendarDays([edited],now).days.find(d=>d.key==='2026-11-14').secs,1800);
  assert.equal(personalBests([],now).total,0);
});
test('adjacent day and week allocations conserve focus across a Monday reset',()=>{
  const session={ts:at('2026-11-09T03:30:00+11:00'),endTs:at('2026-11-09T04:30:00+11:00'),secs:1801};
  const boundary=+getStudyWeek(session.endTs).start;
  const a=secondsInRange(session,session.ts,boundary),b=secondsInRange(session,boundary,session.endTs);
  assert.equal(a+b,1801);assert.equal(a,901);assert.equal(b,900);
});
test('calendar and streaks use Melbourne days across spring DST',()=>{
  const session={subject:'math',ts:at('2026-10-03T23:30:00+10:00'),endTs:at('2026-10-05T00:30:00+11:00'),secs:86400};
  const end=at('2026-10-06T12:00:00+11:00');
  const calendar=calendarDays([session],end);
  assert.equal(calendar.days.reduce((sum,day)=>sum+day.secs,0),86400);
  assert.equal(personalBests([session],end).longestStreak,3);
  const day=startOfStudyDay(at('2026-10-04T12:00:00+11:00'));
  assert.equal(+shiftStudyDay(day,1)-day,23*3600000);
});
test('November calendar pads to Monday and disables dates after today',()=>{
  const month=calendarDays([],now);assert.equal(month.leading,6);assert.equal(month.days.length,30);
  assert.equal(month.days[13].future,false);assert.equal(month.days[14].future,true);
  assert.equal(dateKey(calendarDays([],now,-1).start),'2026-10-01');
});
test('empty and malformed history does not produce invalid records',()=>{
  const sessions=cleanSessions([null,{ts:now,secs:Infinity},{ts:now+1000,secs:60},{ts:now,secs:-1},{ts:now,secs:'300'}],now);
  assert.equal(sessions.length,1);assert.equal(personalBests(sessions,now).total,300);
  assert.equal(personalBests([],now).longestStreak,0);
  assert.deepEqual(subjectParts({secs:300,subject:'math',subjectSegments:{}}),[{subject:'math',secs:300}]);
});
test('subject rounding never creates negative allocations and preserves edited duration',()=>{
  const session={ts:now-1000,secs:2,subjectSegments:Array.from({length:10},(_,i)=>({subject:String(i),secs:1}))};
  assert.equal(subjectParts(session).reduce((sum,p)=>sum+p.secs,0),2);
  assert.ok(subjectParts(session).every(p=>p.secs>=0));
  assert.equal(Object.values(summarize([session],now-2000,now).subjects).reduce((a,b)=>a+b,0),2);
});
test('suggestions respect weekly targets and prepare useful short sessions',()=>{
  const suggestions=studySuggestions([{ts:now-600000,secs:600,subject:'math'}],[{id:'math',label:'Math'},{id:'english',label:'English'}],{english:2},now);
  assert.equal(suggestions.length,2);assert.equal(suggestions[0].subjectId,'english');assert.equal(suggestions[0].minutes,20);
  assert.match(suggestions[0].body,/2h remains/);assert.equal(suggestions[1].minutes,10);
  assert.equal(studySuggestions([],[{id:'math'}],{},now)[0].minutes,15);
});
test('periods use the shared week boundary and elapsed comparison excludes the prior weekend',()=>{
  const wednesday=at('2026-11-11T12:00:00+11:00'),range=periodRange('week',wednesday);
  const priorEnd=+range.previousStart+(wednesday-+range.start);
  const history=[{ts:at('2026-11-04T10:00:00+11:00'),secs:3600},{ts:at('2026-11-08T10:00:00+11:00'),secs:7200}];
  assert.equal(summarize(history,range.previousStart,priorEnd).secs,3600);
  assert.equal(dateKey(periodRange('month',now).start),'2026-11-01');
});
