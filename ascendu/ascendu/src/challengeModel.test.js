import test from 'node:test';
import assert from 'node:assert/strict';
import {challengeState,challengeProgress,weekChoices,validChoice} from './challengeModel.js';
import {createChallengeRepository} from './challengeRepository.js';
import {getStudyWeek} from './studyWeek.js';
const invited={id:'invite-1',mode:'together',goalHours:5,status:'invited'};
const accepted={...invited,status:'accepted'};
const declined={...invited,status:'declined'};
test('progress is shared only after both friends opt into the same invitation',()=>{
  assert.equal(challengeState(invited,null),'waiting');
  assert.equal(challengeState(null,invited),'incoming');
  assert.equal(challengeState(invited,accepted),'active');
  assert.equal(challengeState(accepted,invited),'active');
  assert.notEqual(challengeState(invited,{...accepted,id:'old'}),'active');
  assert.equal(challengeState(invited,declined),'ended');
  assert.equal(challengeState(declined,accepted),'ended');
  assert.equal(validChoice({...invited,goalHours:500}),false);
  assert.equal(challengeState(null,{...invited,goalHours:500}),'none');
});
test('shared goals combine time while friendly goals compare individual progress',()=>{
  assert.deepEqual(challengeProgress(invited,3600,7200),{goal:36000,total:10800,percent:30,remaining:25200});
  assert.deepEqual(challengeProgress({...invited,mode:'friendly'},3600,7200),{goal:18000,total:3600,percent:20,remaining:14400});
  assert.equal(challengeProgress(invited,36000,36000).percent,100);
});
test('a new week has no automatic enrolments',()=>{
  assert.deepEqual(weekChoices({studyChallengeWeek:{weekKey:'old',choices:{sam:accepted}}},'new'),{});
});
function fixture(){
  let clock=Date.parse('2026-11-14T12:00:00+11:00');
  const weekKey=getStudyWeek(clock).key,reads=[];
  const records=new Map([
    ['prefs/alex',{ownerUid:'a',coins:42,studyChallengeWeek:{weekKey:'old',choices:{oldfriend:accepted}}}],
    ['prefs/sam',{ownerUid:'b',studyChallengeWeek:{weekKey,choices:{alex:invited}}}],
    ['friend_connections/ab',{status:'accepted',userUids:['a','b']}],
    ['history/sam',{sessions:[{ts:clock-3600000,endTs:clock,secs:3600}]}],
  ]);
  const get=async ref=>{reads.push(ref);return {exists:()=>records.has(ref),data:()=>structuredClone(records.get(ref))};};
  const service=createChallengeRepository({auth:{currentUser:{uid:'a'}},db:{},clock:()=>clock,doc:(_,collection,id)=>`${collection}/${id}`,getDoc:get,runTransaction:async(_,fn)=>{
    const writes=[];
    await fn({get,update:(ref,patch)=>writes.push([ref,{...records.get(ref),...patch}]),set:(ref,data)=>writes.push([ref,data])});
    writes.forEach(([ref,data])=>records.set(ref,data));
  }});
  return {records,reads,service,weekKey,friend:{id:'ab',uid:'b',username:'sam'},advance:()=>{clock+=7*86400000;}};
}
test('challenge save replaces old weeks, preserves unrelated prefs, and never writes the friend',async()=>{
  const f=fixture();const before=structuredClone(f.records.get('prefs/sam'));
  await f.service.save('alex',f.friend,accepted,f.weekKey);
  const own=f.records.get('prefs/alex');assert.equal(own.coins,42);
  assert.deepEqual(Object.keys(own.studyChallengeWeek.choices),['sam']);
  assert.deepEqual(f.records.get('prefs/sam'),before);
  assert.equal((await f.service.load('alex',[f.friend])).peers[0].secs,3600);
});
test('unaccepted invitations do not load friend history and leaving stops comparison',async()=>{
  const f=fixture();await f.service.load('alex',[f.friend]);assert.equal(f.reads.includes('history/sam'),false);
  await f.service.save('alex',f.friend,declined,f.weekKey);
  await f.service.load('alex',[f.friend]);assert.equal(f.reads.includes('history/sam'),false);
});
test('stale invitations, removed friendships and old-week writes are rejected',async()=>{
  const f=fixture();await assert.rejects(f.service.save('alex',f.friend,{...accepted,id:'stale'},f.weekKey),/invitation changed/);
  f.records.set('friend_connections/ab',{status:'pending',userUids:['a','b']});
  await assert.rejects(f.service.save('alex',f.friend,invited,f.weekKey),/accepted friend/);
  f.advance();await assert.rejects(f.service.save('alex',f.friend,invited,f.weekKey),/new study week/);
  assert.equal(f.records.get('prefs/alex').coins,42);
});
