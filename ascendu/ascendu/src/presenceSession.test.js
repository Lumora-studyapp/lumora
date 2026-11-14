import test from 'node:test';
import assert from 'node:assert/strict';
import {formatPresenceDuration,sessionPresenceSnapshot,liveSessionSeconds} from './presenceSession.js';
import {createPomodoroState} from './pomodoro.js';

test('compact session time preserves hours without seconds or misleading empty totals',()=>{
  assert.equal(formatPresenceDuration(0),'<1m');
  assert.equal(formatPresenceDuration(59),'<1m');
  assert.equal(formatPresenceDuration(59*60),'59m');
  assert.equal(formatPresenceDuration(3600),'1h');
  assert.equal(formatPresenceDuration(4320),'1h 12m');
  assert.equal(formatPresenceDuration(10*3600+5*60),'10h 5m');
  assert.equal(formatPresenceDuration(null),'—');
  assert.equal(formatPresenceDuration(NaN),'—');
});

test('live focus advances from heartbeat and freezes when paused',()=>{
  const ts=100000;
  const session=sessionPresenceSnapshot({elapsed:600,now:ts});
  assert.equal(liveSessionSeconds({ts,session},ts+30000),630);
  assert.equal(liveSessionSeconds({ts,session:{...session,counting:false}},ts+30000),600);
  assert.equal(liveSessionSeconds({ts,session},ts+120000),null);
  assert.equal(liveSessionSeconds({ts},ts),null);
  assert.equal(liveSessionSeconds({ts,session:{focusSecs:NaN}},ts),null);
});

test('Pomodoro presence excludes breaks and caps interpolation at focus boundary',()=>{
  const now=100000,pomodoro=createPomodoroState({focusLengthMinutes:5,breakLengthMinutes:2,plannedRounds:2});
  const focus=sessionPresenceSnapshot({elapsed:290,timerStyle:'pomodoro',pomodoro,now});
  assert.equal(liveSessionSeconds({ts:now,session:focus},now+30000),300);
  const rest=sessionPresenceSnapshot({elapsed:330,timerStyle:'pomodoro',pomodoro,now});
  assert.equal(rest.phase,'break');
  assert.equal(liveSessionSeconds({ts:now,session:rest},now+30000),300);
  const next=sessionPresenceSnapshot({elapsed:450,timerStyle:'pomodoro',pomodoro:{...pomodoro,autoStartNext:true},now});
  assert.equal(next.focusSecs,330);
  const paused=sessionPresenceSnapshot({elapsed:150,paused:true,timerStyle:'pomodoro',pomodoro,now});
  assert.equal(liveSessionSeconds({ts:now,session:paused},now+30000),150);
});
