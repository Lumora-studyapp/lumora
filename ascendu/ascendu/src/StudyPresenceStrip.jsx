import {useEffect,useState} from 'react';
import {formatPresenceDuration,liveSessionSeconds} from './presenceSession.js';
import './studyPresenceStrip.css';
import './presenceStatus.css';

function scrollStudents(event) {
  if(event.target!==event.currentTarget)return;
  const rail=event.currentTarget;
  const step=rail.clientWidth*.8;
  const next={ArrowLeft:rail.scrollLeft-step,ArrowRight:rail.scrollLeft+step,Home:0,End:rail.scrollWidth}[event.key];
  if(next===undefined)return;
  event.preventDefault();
  rail.scrollTo({left:next,behavior:'instant'});
}

// Read-only activity stays visible on touchscreens. Nothing expands over the
// character or requires a hover/tap to reveal the subject and session time.
export default function StudyPresenceStrip({presence,currentUser,compact=false,scrollRef}) {
  const [now,setNow]=useState(Date.now);
  useEffect(()=>{
    const refresh=()=>setNow(Date.now());
    const timer=setInterval(refresh,15000);
    document.addEventListener('visibilitychange',refresh);
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
  },[]);
  const others=presence.filter(person=>person.username!==currentUser&&now-person.ts<120000)
    .sort((a,b)=>Number(b.status==='studying')-Number(a.status==='studying'));
  if(!others.length)return null;
  const active=others.some(person=>person.status==='studying'||person.status==='paused');
  return <section className={`sg-presence-strip${compact?' sg-presence-strip--focus':''}`} aria-label="Study company">
    <div className="sg-presence-strip__header">
      <span>{active?'Studying together':'Online now'}</span>
      <span className="sg-presence-strip__meta">{others.length} online{active?' · session time':''}</span>
    </div>
    <ul ref={scrollRef} className="sg-presence-strip__rail" tabIndex={0} onKeyDown={scrollStudents} aria-label="Online students; scroll horizontally for more">
      {others.map(person=>{
        const studying=person.status==='studying';
        const paused=person.status==='paused';
        const isBreak=person.session?.phase==='break';
        const seconds=studying||paused?liveSessionSeconds(person,now):null;
        const duration=formatPresenceDuration(seconds);
        const state=isBreak?'On a break':paused?'Paused':studying?'Studying':'Online';
        const subject=person.subjLabel||'Study';
        const label=`${person.username}: ${state}${studying||paused?` · ${subject} · ${seconds===null?'session time unavailable':duration+' of focus this session'}`:''}`;
        return <li key={person.username} className="sg-presence-strip__person" aria-label={label}>
          <span className="sg-presence-strip__copy">
          <span className="sg-presence-strip__identity">
            <span className={`sg-presence-strip__state sg-presence-strip__state--${isBreak?'break':paused?'paused':studying?'studying':'online'}`} aria-hidden="true">{isBreak?'☕':paused?'Ⅱ':''}</span>
            <span className="sg-presence-strip__name" title={person.username}>{person.username}</span>
          </span>
          <span className="sg-presence-strip__activity">
            <span className="sg-presence-strip__subject" title={studying||paused?subject:'Online'}>{studying||paused?subject:'Online'}</span>
            {(studying||paused)&&<>
              <span aria-hidden="true">·</span>
              <span className="sg-presence-strip__time">{duration}</span>
            </>}
          </span>
          </span>
        </li>;
      })}
    </ul>
  </section>;
}
