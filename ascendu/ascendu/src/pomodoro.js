export const POMODORO_PRESETS = Object.freeze([
  { id:"25-5", label:"25 / 5", focusMinutes:25, breakMinutes:5 },
  { id:"50-10", label:"50 / 10", focusMinutes:50, breakMinutes:10 },
  { id:"custom", label:"Custom", focusMinutes:null, breakMinutes:null },
]);

const clampInt = (value,min,max,fallback) => {
  const parsed=Math.round(Number(value));
  return Number.isFinite(parsed)?Math.max(min,Math.min(max,parsed)):fallback;
};

export function sanitizePomodoroConfig(raw={}) {
  return {
    preset:POMODORO_PRESETS.some(item=>item.id===raw.preset)?raw.preset:"25-5",
    focusLengthMinutes:clampInt(raw.focusLengthMinutes,5,180,25),
    breakLengthMinutes:clampInt(raw.breakLengthMinutes,1,60,5),
    plannedRounds:clampInt(raw.plannedRounds,1,8,4),
    autoStartNext:raw.autoStartNext===true,
    intervalCues:raw.intervalCues!==false,
  };
}

export function createPomodoroState(config) {
  const clean=sanitizePomodoroConfig(config);
  return {
    phase:"focus",
    round:1,
    completedRounds:0,
    completedFocusSeconds:0,
    awaitingNext:false,
    ...clean,
  };
}

export function sanitizePomodoroState(raw={},fallbackConfig={}) {
  const config=sanitizePomodoroConfig({...fallbackConfig,...raw});
  const completedRounds=clampInt(raw.completedRounds,0,config.plannedRounds,0);
  const round=clampInt(raw.round,1,config.plannedRounds,Math.min(config.plannedRounds,completedRounds+1));
  return {
    ...config,
    phase:raw.phase==="break"?"break":"focus",
    round,
    completedRounds,
    completedFocusSeconds:Math.max(0,Math.trunc(Number(raw.completedFocusSeconds)||0)),
    awaitingNext:raw.awaitingNext===true,
  };
}

export const pomodoroPhaseSeconds = state =>
  Math.max(1,(state?.phase==="break"?state.breakLengthMinutes:state.focusLengthMinutes)*60);

// Advances a wall-clock interval, including delayed mobile/background ticks.
// Focus is credited only up to each focus boundary. If auto-start is disabled,
// the clock stops at the end of the break and waits for an explicit action.
export function advancePomodoroClock(rawState,rawElapsed) {
  let state=sanitizePomodoroState(rawState);
  let elapsed=Math.max(0,Math.trunc(Number(rawElapsed)||0));
  let guard=0;
  while(guard++<24){
    const phaseSeconds=pomodoroPhaseSeconds(state);
    if(elapsed<phaseSeconds || state.awaitingNext) break;
    elapsed-=phaseSeconds;
    if(state.phase==="focus"){
      const completedRounds=Math.min(state.plannedRounds,state.completedRounds+1);
      state={
        ...state,
        completedRounds,
        completedFocusSeconds:state.completedFocusSeconds+phaseSeconds,
      };
      if(completedRounds>=state.plannedRounds){
        return {state:{...state,awaitingNext:false},elapsed:0,finished:true,boundary:"focus"};
      }
      state={...state,phase:"break",awaitingNext:false};
    }else if(!state.autoStartNext){
      return {
        state:{...state,awaitingNext:true},
        elapsed:phaseSeconds,
        finished:false,
        boundary:"break",
      };
    }else{
      state={...state,phase:"focus",round:Math.min(state.plannedRounds,state.completedRounds+1),awaitingNext:false};
    }
  }
  return {state,elapsed,finished:false,boundary:null};
}

export function startNextPomodoroFocus(rawState) {
  const state=sanitizePomodoroState(rawState);
  return {
    ...state,
    phase:"focus",
    round:Math.min(state.plannedRounds,state.completedRounds+1),
    awaitingNext:false,
  };
}

export function validPomodoroFocusSeconds(rawState,currentPhaseElapsed=0) {
  const state=sanitizePomodoroState(rawState);
  const current=state.phase==="focus"
    ? Math.min(Math.max(0,Math.trunc(Number(currentPhaseElapsed)||0)),state.focusLengthMinutes*60)
    : 0;
  return state.completedFocusSeconds+current;
}

