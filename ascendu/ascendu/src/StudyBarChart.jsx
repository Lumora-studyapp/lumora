import {useMemo,useRef,useState,useEffect} from 'react';
import {formatStudyDate} from './studyWeek.js';
import {shortTime} from './statsModel.js';
import {studyChartBuckets,chartSubject} from './studyChartModel.js';
import './studyBarChart.css';

export default function StudyBarChart({history,subjects,now=Date.now()}) {
  const [unit,setUnit]=useState('day'),[offset,setOffset]=useState(0),[selected,setSelected]=useState(null);
  const rail=useRef(null),hold=useRef(null),origin=useRef(null);
  const buckets=useMemo(()=>studyChartBuckets(history,unit,offset,now),[history,unit,offset,now]);
  const current=buckets.find(b=>b.key===selected)||buckets.at(-1);
  const ceiling=Math.max(1800,Math.ceil(Math.max(...buckets.map(b=>b.secs))/1800)*1800);
  const cancelHold=()=>{clearTimeout(hold.current);hold.current=null;};
  useEffect(()=>()=>clearTimeout(hold.current),[]);
  useEffect(()=>{if(rail.current)rail.current.scrollLeft=rail.current.scrollWidth;},[unit,offset]);
  const changeUnit=next=>{cancelHold();setUnit(next);setOffset(0);setSelected(null);};
  const shift=direction=>{cancelHold();setOffset(n=>n+direction);setSelected(null);};
  const entries=Object.entries(current.subjects).filter(([,secs])=>secs>0).sort((a,b)=>b[1]-a[1]);
  return <section className="sg-stats-card sg-study-chart" aria-label="Study time by subject">
    <span className="sg-stats-eyebrow">YOUR STUDY RHYTHM</span>
    <div className="sg-stats-segments" role="group" aria-label="Chart grouping">{[['day','Days'],['week','Weeks'],['month','Months']].map(([id,label])=><button key={id} aria-pressed={unit===id} onClick={()=>changeUnit(id)}>{label}</button>)}</div>
    <div className="sg-study-chart-nav"><button aria-label="Previous chart period" onClick={()=>shift(-1)}>‹</button><span>{formatStudyDate(buckets[0].start,{month:'short',day:unit==='month'?undefined:'numeric',year:'numeric'})} – {formatStudyDate(Math.min(buckets.at(-1).end-1,now),{month:'short',day:unit==='month'?undefined:'numeric',year:'numeric'})}</span><button aria-label="Next chart period" disabled={offset===0} onClick={()=>shift(1)}>›</button></div>
    <div className="sg-study-chart-plot">
      <div className="sg-study-chart-axis" aria-hidden="true"><span>{ceiling/3600}h</span><span>{ceiling/7200}h</span><span>0h</span></div>
      <div className="sg-study-chart-rail" ref={rail} role="group" aria-label={`${unit==='day'?'Daily':unit==='week'?'Weekly':'Monthly'} study bars; swipe for more`}>
        <div className="sg-study-chart-bars" style={{"--study-bars":buckets.length,"--study-bar-min":unit==='week'?'36px':'28px'}}>{buckets.map((bucket,index)=><button key={bucket.key} className="sg-study-chart-bar" aria-pressed={bucket.key===current.key} aria-label={`${bucket.title}: ${shortTime(bucket.secs)}. Show subject breakdown`} onClick={()=>setSelected(bucket.key)}
          onPointerDown={event=>{cancelHold();origin.current={x:event.clientX,y:event.clientY};hold.current=setTimeout(()=>setSelected(bucket.key),300);}}
          onPointerMove={event=>{if(origin.current&&Math.hypot(event.clientX-origin.current.x,event.clientY-origin.current.y)>8)cancelHold();}} onPointerUp={cancelHold} onPointerCancel={cancelHold} onPointerLeave={cancelHold} onContextMenu={event=>event.preventDefault()}
          onKeyDown={event=>{const next=event.key==='ArrowRight'?index+1:event.key==='ArrowLeft'?index-1:null;if(next!==null){event.preventDefault();const target=buckets[Math.max(0,Math.min(buckets.length-1,next))];setSelected(target.key);event.currentTarget.parentElement.children[Math.max(0,Math.min(buckets.length-1,next))].focus();}}}>
          <span className="sg-study-chart-column" aria-hidden="true"><span className="sg-study-chart-value">{bucket.secs?`${Number((bucket.secs/3600).toFixed(1))}h`:''}</span><span className="sg-study-chart-stack" style={{height:bucket.secs?`${bucket.secs/ceiling*100}%`:'2px'}}>{Object.entries(bucket.subjects).sort(([a],[b])=>a.localeCompare(b)).filter(([,secs])=>secs>0).map(([id,secs])=><i key={id} style={{height:`${secs/bucket.secs*100}%`,background:chartSubject(id,subjects).color}}/>)}</span></span>
          <span className="sg-study-chart-label">{bucket.label}</span>
        </button>)}</div>
      </div>
    </div>
    <div className="sg-study-chart-detail" aria-live="polite" aria-atomic="true"><div className="sg-stats-heading"><strong>{current.title}</strong><strong>{shortTime(current.secs)}</strong></div>
      {entries.length?entries.map(([id,secs])=>{const subject=chartSubject(id,subjects);return <div className="sg-study-chart-subject" key={id}><i style={{background:subject.color}} aria-hidden="true"/><span>{subject.label}</span><strong>{shortTime(secs)}</strong></div>;}):<p>No recorded study time here. Choose another bar to explore.</p>}
    </div>
  </section>;
}
