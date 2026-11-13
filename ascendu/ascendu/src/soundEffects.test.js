import test from 'node:test';
import assert from 'node:assert/strict';
import {createSoundEffects,normalizeSoundPreferences,SOUND_EVENTS} from './soundEffects.js';

function harness(){
  let started=0,stopped=0,created=0;
  const gain=()=>({gain:{value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){},setTargetAtTime(value){this.value=value;}},connect(){},disconnect(){}});
  const context={state:'running',currentTime:1,destination:{},createGain:gain,createOscillator(){return {frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){},start(){started++;},stop(){stopped++;}};}};
  const engine=createSoundEffects(()=>{created++;return context;});
  return {engine,context,get started(){return started;},get stopped(){return stopped;},get created(){return created;}};
}
test('normalizes malformed preferences and fills newly added events',()=>{
  const prefs=normalizeSoundPreferences({volume:12,events:{taskCompleted:{enabled:false,style:'unknown'}}});
  assert.equal(prefs.volume,1);assert.equal(prefs.events.taskCompleted.enabled,false);assert.equal(prefs.events.taskCompleted.style,'soft');
  assert.equal(Object.keys(prefs.events).length,SOUND_EVENTS.length);
  assert.equal(normalizeSoundPreferences(null).volume,.55);assert.equal(normalizeSoundPreferences({volume:NaN}).volume,.55);
});
test('master mute, zero volume, and individual toggles gate real events',()=>{
  const h=harness();h.engine.configure({enabled:false});assert.equal(h.engine.play('studyStarted'),false);assert.equal(h.created,0);
  h.engine.configure({volume:0});assert.equal(h.engine.play('studyStarted'),false);
  h.engine.configure({events:{taskCompleted:{enabled:false}}});assert.equal(h.engine.play('taskCompleted'),false);
  assert.equal(h.engine.play('taskCompleted',{preview:true}),true);assert.equal(h.started,1);
});
test('all six cues play once, avoid overlap, and stop when muted',()=>{
  for(const event of SOUND_EVENTS){const h=harness();assert.equal(h.engine.play(event.id),true);assert.equal(h.started,event.notes.length);assert.equal(h.engine.play(event.id),false);h.engine.configure({enabled:false});assert.ok(h.stopped>=event.notes.length);}
});
test('unsupported or blocked audio never interrupts an app action',()=>{
  const unsupported=createSoundEffects(()=>null);assert.equal(unsupported.play('breakEnded'),false);
  const blocked=createSoundEffects(()=>{throw Error('blocked');});assert.doesNotThrow(()=>blocked.play('studyStarted'));assert.equal(blocked.play('unknown'),false);
});
test('one effects context is reused and previews replace the previous cue',()=>{
  const h=harness();h.engine.play('studyStarted');h.engine.play('taskCompleted',{preview:true});assert.equal(h.created,1);assert.ok(h.stopped>=2);
});
