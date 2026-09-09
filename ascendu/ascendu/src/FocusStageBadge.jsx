import React, {useEffect, useId, useLayoutEffect, useRef, useState} from 'react';
import {observeStage, STAGE_BURST_MS} from './focusStageTransition.js';
import './focusStageBadge.css';

export function useFocusStageAdvancement({sessionId, stage, active, enabled}) {
  const cursor=useRef(null);
  const [event,setEvent]=useState(null);
  useEffect(()=>{
    const result=observeStage(cursor.current,{sessionId,stage,active,enabled,visible:!document.hidden});
    cursor.current=result.cursor;
    if(result.advancement)setEvent(result.advancement);
  },[sessionId,stage,active,enabled]);
  return event;
}

export default function FocusStageBadge({stage,event,disabled=false,color='#2D6A4F',outgoingImage,incomingImage,imageScale=1,onPlaybackChange}) {
  const id=useId().replace(/:/g,'');
  // Keep the user's subject colour as a CSS/SVG colour token. This accepts hex,
  // rgb(), hsl(), named colours, and CSS custom properties without conversion.
  const stageColor=String(color||'#2D6A4F');
  const root=useRef(null);
  const seen=useRef(event?.id);
  const [burst,setBurst]=useState(null);
  useLayoutEffect(()=>{
    if(!event || seen.current===event.id)return;
    seen.current=event.id;
    if(!disabled&&!document.hidden)setBurst(event);
  },[event,disabled]);
  useEffect(()=>{
    if(disabled)setBurst(null);
  },[disabled]);
  useEffect(()=>{
    if(!burst)return;
    const clear=()=>setBurst(null);
    const hide=()=>{if(document.hidden)clear();};
    const timer=setTimeout(clear,STAGE_BURST_MS+50);
    document.addEventListener('visibilitychange',hide);
    return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',hide);};
  },[burst]);
  const playing=burst&&!disabled;
  useLayoutEffect(()=>{
    onPlaybackChange?.(!!playing);
    return()=>onPlaybackChange?.(false);
  },[playing,onPlaybackChange]);
  return <span ref={root} className="sg-stage-badge" style={{'--stage-color':stageColor}} data-stage-color={stageColor}>
    <span className="sg-stage-sr" role="status">Stage {stage+1}</span>
    {playing&&<span key={burst.id} className="sg-stage-burst" aria-hidden="true" data-stage-advancement={burst.id}
      onAnimationEnd={e=>{if(e.animationName==='sg-stage-lifetime')setBurst(null);}}>
      <svg className="sg-stage-rings" viewBox="0 0 320 320"><g fill="none" stroke={stageColor} strokeWidth=".8">
        {[0,1,2].map(n=><circle key={n} className={`sg-stage-ring sg-stage-ring-${n}`} cx="160" cy="160" r={51+n*12}/>)}</g></svg>
      {outgoingImage&&<span className="sg-stage-character sg-stage-character-old"><img src={outgoingImage} alt="" style={{transform:`scale(${imageScale})`}}/></span>}
      {incomingImage&&<span className="sg-stage-character sg-stage-character-new"><img src={incomingImage} alt="" style={{transform:`scale(${imageScale})`}}/></span>}
      <svg className="sg-stage-front" viewBox="0 0 320 320">
        <defs>
          <linearGradient id={`${id}-shade`} x2="0" y2="1"><stop stopColor="#17251D" stopOpacity="0"/><stop offset="1" stopColor="#17251D" stopOpacity=".38"/></linearGradient>
          <radialGradient id={`${id}-glow`}><stop stopColor={stageColor} stopOpacity=".48"/><stop offset="1" stopColor={stageColor} stopOpacity="0"/></radialGradient>
          <pattern id={`${id}-dots`} width="7" height="7" patternUnits="userSpaceOnUse"><rect width="2.3" height="2.3" fill={stageColor}/></pattern>
          <path id={`${id}-chevron`} d="M70 168 L160 107 L250 168 L250 198 L160 137 L70 198 Z M70 226 L160 165 L250 226 L250 256 L160 195 L70 256 Z"/>
        </defs>
        <ellipse className="sg-stage-light" cx="160" cy="143" rx="137" ry="114" fill={`url(#${id}-glow)`}/>
        {[0,1,2].map(n=><g key={n} className={`sg-stage-echo sg-stage-echo-${n}`}><use href={`#${id}-chevron`} fill="none" stroke={stageColor} strokeWidth=".8"/></g>)}
        <g className="sg-stage-arrows"><use href={`#${id}-chevron`} fill={stageColor}/>
          <use href={`#${id}-chevron`} fill={`url(#${id}-shade)`}/>
          <use className="sg-stage-white" href={`#${id}-chevron`} fill="#fff" fillOpacity=".24"/></g>
      </svg>
      <svg className="sg-stage-shimmer-front" viewBox="0 0 320 320"><path className="sg-stage-dots" d="M58 146 L160 78 L262 146 L262 251 L160 185 L58 251Z" fill={`url(#${id}-dots)`}/></svg>
    </span>}
  </span>;
}
