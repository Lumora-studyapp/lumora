import {advancePomodoroClock,pomodoroPhaseSeconds} from './pomodoro.js';

export function formatPresenceDuration(seconds) {
  if(!Number.isFinite(seconds)||seconds<0)return '—';
  const minutes=Math.floor(seconds/60);
  if(!minutes)return '<1m';
  if(minutes<60)return `${minutes}m`;
  const hours=Math.floor(minutes/60),remaining=minutes%60;
  return remaining?`${hours}h ${remaining}m`:`${hours}h`;
}

export function sessionPresenceSnapshot({elapsed=0,paused=false,timerStyle='standard',pomodoro,now=Date.now()}) {
  if(timerStyle!=='pomodoro')return {focusSecs:Math.max(0,Math.floor(elapsed)),counting:!paused,mode:'standard',phase:'focus',focusUntil:0};
  const result=advancePomodoroClock(pomodoro,elapsed);
  const state=result.state;
  const focus=state.phase==='focus'&&!result.finished;
  return {focusSecs:state.completedFocusSeconds+(focus?result.elapsed:0),counting:focus&&!paused,
    mode:'pomodoro',phase:focus?'focus':result.finished?'complete':'break',
    focusUntil:focus?now+Math.max(0,pomodoroPhaseSeconds(state)-result.elapsed)*1000:0};
}

export function normalizeSessionPresence(raw) {
  if(!raw||!Number.isFinite(raw.focusSecs)||raw.focusSecs<0)return null;
  return {focusSecs:Math.floor(raw.focusSecs),counting:raw.counting===true,
    mode:raw.mode==='pomodoro'?'pomodoro':'standard',
    phase:['focus','break','complete'].includes(raw.phase)?raw.phase:'focus',
    focusUntil:Number.isFinite(raw.focusUntil)?Math.max(0,raw.focusUntil):0};
}

export function liveSessionSeconds(record,now=Date.now()) {
  const session=normalizeSessionPresence(record?.session);
  if(!session||!Number.isFinite(record.ts)||now-record.ts>=120000)return null;
  const end=session.focusUntil?Math.min(now,session.focusUntil):now;
  return session.focusSecs+(session.counting?Math.max(0,Math.floor((end-record.ts)/1000)):0);
}
