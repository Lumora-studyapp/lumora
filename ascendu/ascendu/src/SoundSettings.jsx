import {useEffect,useRef,useState} from 'react';
import {SOUND_EVENTS,SOUND_STYLES,normalizeSoundPreferences,soundEffects} from './soundEffects.js';
import './soundSettings.css';
import SoundPicker from './SoundPicker.jsx';

export default function SoundSettings({initialPreferences,onSave,onClose}) {
  const [preferences,setPreferences]=useState(()=>normalizeSoundPreferences(initialPreferences));
  const [status,setStatus]=useState(''),[saving,setSaving]=useState(false);
  const saved=useRef(initialPreferences);
  const closeButton=useRef(null);
  useEffect(()=>{const previous=document.activeElement;closeButton.current?.focus();return()=>previous?.focus?.();},[]);
  useEffect(()=>()=>{soundEffects.stop();soundEffects.configure(saved.current);},[]);
  const change=patch=>setPreferences(current=>{const next=normalizeSoundPreferences({...current,...patch});soundEffects.configure(next);setStatus('');return next;});
  const changeEvent=(id,patch)=>change({events:{...preferences.events,[id]:{...preferences.events[id],...patch}}});
  const save=async()=>{
    if(saving)return;
    setSaving(true);setStatus('Saving…');
    try{const result=await onSave(preferences);saved.current=preferences;setStatus(result?'Saved to your account.':'Saved on this device. Cloud sync failed; use Save again to retry.');}
    catch{setStatus('Could not sync. Your settings are saved on this device; use Save again to retry.');saved.current=preferences;}
    finally{setSaving(false);}
  };
  return <div className="lumora-sound-overlay" onKeyDown={event=>{if(event.key==='Escape'&&!saving)onClose();}} onClick={event=>{if(event.target===event.currentTarget&&!saving)onClose();}}>
    <section role="dialog" aria-modal="true" aria-labelledby="sound-settings-title" className="lumora-sound-panel">
      <header><div><h2 id="sound-settings-title">Sound &amp; Audio</h2><p>Gentle cues for your study routine.</p></div><button ref={closeButton} type="button" onClick={onClose} disabled={saving} aria-label="Close sound settings">×</button></header>
      <label className="lumora-sound-master"><span>Enable sound effects</span><input type="checkbox" checked={preferences.enabled} onChange={event=>change({enabled:event.target.checked})}/></label>
      <label className="lumora-sound-volume"><span>Sound effects volume <output>{Math.round(preferences.volume*100)}%</output></span><input type="range" min="0" max="100" step="1" value={Math.round(preferences.volume*100)} disabled={!preferences.enabled} onChange={event=>change({volume:Number(event.target.value)/100})}/></label>
      <p className="lumora-sound-note">Controls effects only. Your background study audio keeps its own volume.</p>
      <h3>Event sounds</h3>
      {SOUND_EVENTS.map(({id,label,description})=><div key={id} className="lumora-sound-row">
        <label><input aria-label={label+' sound'} type="checkbox" checked={preferences.events[id].enabled} disabled={!preferences.enabled} onChange={event=>changeEvent(id,{enabled:event.target.checked})}/><span><strong>{label}</strong><small>{SOUND_STYLES.find(style=>style.id===preferences.events[id].style)?.label || description}</small></span></label>
        <div><SoundPicker label={label} value={preferences.events[id].style} disabled={!preferences.enabled} onChange={style=>changeEvent(id,{style})}/><button type="button" aria-label={'Preview '+label.toLowerCase()} disabled={!preferences.enabled||preferences.volume===0} onClick={()=>{soundEffects.configure(preferences);if(!soundEffects.play(id,{preview:true}))setStatus('Sound is unavailable in this browser.');}}><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2.5v11L13 8z"/></svg></button></div>
      </div>)}
      <p className="lumora-sound-note">Previews play the selected style, even when that event is switched off. Browsers may silence reminders while the app is suspended.</p>
      <footer><p role="status">{status}</p><button className="lumora-sound-save" type="button" disabled={saving} onClick={save}>{saving?'Saving…':'Save sound settings'}</button></footer>
    </section>
  </div>;
}
