export const SOUND_EVENTS = [
  {id:'studyStarted',label:'Study started',description:'Soft rising tone',notes:[392,523.25],spacing:.2,duration:.55},
  {id:'studyCompleted',label:'Study completed',description:'Gentle three-note chime',notes:[523.25,659.25,783.99],spacing:.27,duration:.8},
  {id:'breakStarted',label:'Break started',description:'Calm descending tone',notes:[523.25,392],spacing:.24,duration:.65},
  {id:'breakEnded',label:'Break ended',description:'Gentle rising reminder',notes:[440,554.37,659.25],spacing:.22,duration:.65},
  {id:'taskCompleted',label:'Task completed',description:'Subtle confirmation',notes:[659.25],spacing:0,duration:.22},
  {id:'milestone',label:'Milestone reached',description:'Warm celebratory chime',notes:[523.25,659.25,783.99,1046.5],spacing:.2,duration:.8},
];
export const SOUND_STYLES = [{id:'soft',label:'Soft'},{id:'warm',label:'Warm'},{id:'glass',label:'Glass'}];
export function normalizeSoundPreferences(value={}) {
  const raw=value&&typeof value==='object'?value:{};
  return {enabled:raw.enabled!==false,volume:typeof raw.volume==='number'&&Number.isFinite(raw.volume)?Math.min(1,Math.max(0,raw.volume)):.55,
    events:Object.fromEntries(SOUND_EVENTS.map(({id})=>[id,{enabled:raw.events?.[id]?.enabled!==false,
      style:SOUND_STYLES.some(style=>style.id===raw.events?.[id]?.style)?raw.events[id].style:'soft'}]))};
}

// One effects-only context; never touch media elements or the study audio player.
export function createSoundEffects(getContext=()=>{
  const Context=globalThis.AudioContext||globalThis.webkitAudioContext;
  return Context?new Context():null;
}) {
  let context=null,master=null,preferences=normalizeSoundPreferences(),activeUntil=0;
  const nodes=new Set(),timers=new Set(),lastPlayed=new Map();
  const stop=()=>{timers.forEach(clearTimeout);timers.clear();nodes.forEach(node=>{try{node.stop();}catch{}});nodes.clear();activeUntil=0;};
  const unlock=()=>{
    try {
      if(!context||context.state==='closed'){context=getContext();if(!context)return;master=context.createGain();master.gain.value=preferences.enabled?preferences.volume:0;master.connect(context.destination);}
      if(context.state==='suspended')context.resume()?.catch(()=>{});
    }catch{/* Audio support is optional and cannot interrupt app actions. */}
  };
  const configure=value=>{
    preferences=normalizeSoundPreferences(value);
    if(!preferences.enabled||!preferences.volume)stop();
    if(context&&master){master.gain.cancelScheduledValues(context.currentTime);master.gain.setTargetAtTime(preferences.enabled?preferences.volume:0,context.currentTime,.015);}
  };
  const play=(id,{preview=false}={})=>{
    const event=SOUND_EVENTS.find(item=>item.id===id),setting=preferences.events[id];
    if(!event||!preferences.enabled||!preferences.volume||(!preview&&!setting.enabled))return false;
    unlock();
    if(!context||context.state!=='running'||!master)return false;
    const now=context.currentTime;
    if(!preview&&now-(lastPlayed.get(id)??-Infinity)<.75)return false;
    if(preview)stop();
    // Keep one cue at a time; only a milestone may follow a busy cue.
    if(!preview&&activeUntil>now){
      if(id==='milestone'&&!timers.size){const timer=setTimeout(()=>{timers.delete(timer);play(id);},Math.ceil((activeUntil-now)*1000)+30);timers.add(timer);}
      return false;
    }
    lastPlayed.set(id,now);
    const style=setting.style,shift=style==='warm'?.75:style==='glass'?1.25:1;
    try{
      event.notes.forEach((frequency,index)=>{
        const start=now+index*event.spacing,osc=context.createOscillator(),gain=context.createGain();
        osc.type='sine';osc.frequency.setValueAtTime(frequency*shift,start);
        if(event.notes.length===1)osc.frequency.exponentialRampToValueAtTime(frequency*shift*1.04,start+.08);
        gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(style==='glass'?.10:.13,start+.025);
        gain.gain.exponentialRampToValueAtTime(.0001,start+event.duration);gain.gain.linearRampToValueAtTime(0,start+event.duration+.03);
        osc.connect(gain);gain.connect(master);nodes.add(osc);
        osc.onended=()=>{nodes.delete(osc);osc.disconnect();gain.disconnect();};
        osc.start(start);osc.stop(start+event.duration+.04);
      });
      activeUntil=now+(event.notes.length-1)*event.spacing+event.duration+.04;
      return true;
    }catch{stop();return false;}
  };
  return {configure,unlock,play,stop};
}
export const soundEffects=createSoundEffects();
