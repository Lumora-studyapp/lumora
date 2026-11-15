import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {canSaveSession} from './sessionDuration.js';
import {advancePomodoroClock,validPomodoroFocusSeconds,createPomodoroState} from './pomodoro.js';

// Exercise the actual finish button handler, including its save-in-progress
// guard and wall-clock path, without writing to a real user's Firestore data.
const app=readFileSync(new URL('./App.jsx',import.meta.url),'utf8');
const handler=app.slice(app.indexOf('  const endSession=()=>{'),app.indexOf('  const showToast=',app.indexOf('  const endSession=()=>{')));
function runEnd(overrides={}) {
  const saves=[],messages=[];
  const context={
    finishingSessionRef:{current:false},sessionIdRef:{current:'test-session'},goalChimedRef:{current:false},soundEffects:{play:()=>{},stop:()=>{}},
    sessionStartRef:{current:1},activeTaskRef:{current:null},intervalRef:{current:1},
    paused:false,baseElapsed:{current:0},startTimeRef:{current:1},
    elapsed:0,getTrueElapsed:()=>600,timerStyle:'standard',
    pomodoroRef:{current:createPomodoroState({focusLengthMinutes:5,breakLengthMinutes:2,plannedRounds:2})},
    canSaveSession,advancePomodoroClock,validPomodoroFocusSeconds,
    clearInterval:()=>{},setElapsed:()=>{},setRunning:()=>{},setPaused:()=>{},setPomodoro:()=>{},
    localStorage:{getItem:()=>null,removeItem:()=>{}},LS_ACTIVE:'active',parseActive:()=>null,tabIdRef:{current:'test'},
    finishSession:(secs)=>saves.push(secs),showToast:message=>messages.push(message),...overrides,
  };
  vm.runInNewContext(handler+'\nendSession();',context);
  return {saves,messages,context};
}

test('five-minute minimum accepts the exact boundary and rejects invalid durations',()=>{
  for(const seconds of [0,60,299,NaN,Infinity,-1])assert.equal(canSaveSession(seconds),false);
  assert.equal(canSaveSession(300),true);
  assert.equal(canSaveSession(301),true);
});
test('finish uses current wall time even when displayed elapsed is stale',()=>{
  assert.deepEqual(runEnd({elapsed:0,getTrueElapsed:()=>300}).saves,[300]);
  assert.deepEqual(runEnd({paused:true,baseElapsed:{current:600},getTrueElapsed:()=>0}).saves,[600]);
  assert.equal(runEnd({getTrueElapsed:()=>299}).messages.length,1);
});
test('ending during Pomodoro break retains completed focus time',()=>{
  const result=runEnd({timerStyle:'pomodoro',getTrueElapsed:()=>330});
  assert.deepEqual(result.saves,[300]);
  assert.deepEqual(result.messages,[]);
});
test('duplicate end after automatic completion produces no short-session message',()=>{
  const busy=runEnd({finishingSessionRef:{current:true},getTrueElapsed:()=>0});
  assert.deepEqual(busy.messages,[]);
  assert.deepEqual(busy.saves,[]);
  const finished=runEnd({sessionIdRef:{current:null},getTrueElapsed:()=>0});
  assert.deepEqual(finished.messages,[]);
});
