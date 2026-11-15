import test from 'node:test';
import assert from 'node:assert/strict';
import {studyChartBuckets,chartSubject} from './studyChartModel.js';
const now=Date.parse('2026-11-15T12:00:00+11:00');
test('daily bars conserve edited subject totals and include empty days',()=>{
  const bars=studyChartBuckets([{ts:now-3600000,secs:1800,subjectSegments:[{subject:'a',secs:3600},{subject:'b',secs:3600}]}],'day',0,now);
  assert.equal(bars.length,7);assert.equal(bars.at(-1).secs,1800);assert.deepEqual(bars.at(-1).subjects,{a:900,b:900});assert.equal(bars[0].secs,0);
});
test('week bars split focus at the Monday reset, including daylight saving',()=>{
  const ts=Date.parse('2026-10-05T03:30:00+11:00'),endTs=Date.parse('2026-10-05T04:30:00+11:00');
  const bars=studyChartBuckets([{ts,endTs,secs:3600,subject:'a'}],'week',0,now);
  assert.equal(bars.length,8);assert.equal(bars.filter(b=>b.secs).length,2);assert.equal(bars.reduce((sum,b)=>sum+b.secs,0),3600);
});
test('month bars split a boundary-spanning session without duplicating hours',()=>{
  const ts=Date.parse('2026-10-31T23:30:00+11:00'),endTs=Date.parse('2026-11-01T00:30:00+11:00');
  const bars=studyChartBuckets([{ts,endTs,secs:3601,subject:'a'}],'month',0,now);
  assert.equal(bars.length,12);assert.equal(bars.reduce((sum,b)=>sum+b.secs,0),3601);assert.equal(bars.at(-1).secs,1800);
});
test('previous ranges are contiguous with the current range and ignore future records',()=>{
  for(const unit of ['day','week','month']){const prior=studyChartBuckets([],unit,-1,now),current=studyChartBuckets([{ts:now+1000,secs:3600}],unit,0,now);assert.equal(prior.at(-1).end,current[0].start);assert.equal(current.reduce((sum,b)=>sum+b.secs,0),0);}
  assert.equal(chartSubject('a',[{id:'a',label:'Math',color:'#5599cc'}]).color,'#5599cc');assert.equal(chartSubject('old',[]).label,'Archived subject');
});
