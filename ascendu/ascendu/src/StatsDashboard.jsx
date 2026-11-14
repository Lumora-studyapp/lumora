import {useEffect,useMemo,useState} from 'react';
import {doc,onSnapshot} from 'firebase/firestore';
import {db} from './firebase.js';
import {formatStudyDate,getStudyWeek,shiftStudyWeek} from './studyWeek.js';
import {calendarDays,cleanSessions,dateKey,personalBests,periodRange,shortTime,studySuggestions,summarize} from './statsModel.js';
import WeeklyChallenges from './WeeklyChallenges.jsx';
import './statsDashboard.css';
import './statsNavigation.css';

export default function StatsPage({user,initialHistory,destination="analytics",children,...props}) {
  const [history,setHistory]=useState(initialHistory),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{
    setError('');
    return onSnapshot(doc(db,'history',user),snap=>{setHistory(snap.data()?.sessions||[]);setError('');},()=>setError('Your latest study history could not be loaded. Retry to refresh these totals.'));
  },[user,retry]);
  return <>{error&&<div role="alert" className="sg-stats-error">{error}<button onClick={()=>setRetry(n=>n+1)}>Retry</button></div>}
    {history===null||history===undefined?<p role="status">Loading your progress…</p>:destination==='garden'?<div className="sg-stats-dashboard"><header className="sg-stats-page-heading"><span className="sg-stats-eyebrow">YOUR STUDY SPACE</span><h1>Garden</h1><p>Your classroom grows with your study.</p></header>{typeof children==='function'?children(cleanSessions(history)):children}</div>:<StatsDashboard {...props} user={user} history={history}/>}</>;
}

export function StatsDashboard({user,history=[],subjects=[],targets={},milestones=[],friends=[],onPlan,children,challengeService,now=Date.now()}) {
  const [view,setView]=useState('overview'),[period,setPeriod]=useState('week');
  const [monthOffset,setMonthOffset]=useState(0),[selected,setSelected]=useState(null);
  const sessions=useMemo(()=>cleanSessions(history,now),[history,now]);
  const range=periodRange(period,now),summary=summarize(sessions,range.start,now+1);
  const previousEnd=Math.min(+range.start,+range.previousStart+(now-+range.start));
  const previous=summarize(sessions,range.previousStart,previousEnd);
  const change=previous.secs?Math.round((summary.secs/previous.secs-1)*100):null;
  const records=useMemo(()=>personalBests(sessions,now),[sessions,now]);
  const week=getStudyWeek(now),weekSummary=summarize(sessions,week.start,now+1);
  const calendar=useMemo(()=>calendarDays(sessions,now,monthOffset),[sessions,now,monthOffset]);
  const day=calendar.days.find(d=>d.key===selected)||calendar.days.find(d=>d.key===dateKey(now))||calendar.days.filter(d=>!d.future).at(-1);
  const next=milestones.find(stage=>records.total<stage.max*3600);
  const completed=milestones.filter(stage=>Number.isFinite(stage.max)&&records.total>=stage.max*3600);
  const progress=next?Math.max(0,Math.min(100,(records.total/3600-next.min)/(next.max-next.min)*100)):100;
  const suggestions=studySuggestions(sessions,subjects,targets,now);
  const subjectName=id=>subjects.find(s=>s.id===id)?.label||'Archived subject';
  const subjectRows=Object.entries(summary.subjects).sort((a,b)=>b[1]-a[1]);
  const trend=Array.from({length:8},(_,i)=>{const w=shiftStudyWeek(now,i-7);return {...w,...summarize(sessions,w.start,Math.min(+w.endExclusive,now+1))};});
  const trendMax=Math.max(1,...trend.map(w=>w.secs));
  return <div className="sg-stats-dashboard">
    <header className="sg-stats-page-heading"><span className="sg-stats-eyebrow">YOUR LEARNING JOURNEY</span><h1>A little further, every day.</h1><p>See what’s working. Choose your next small step.</p></header>
    <div className="sg-stats-segments sg-stats-tabs" role="group" aria-label="Stats section">
      <button aria-pressed={view==='overview'} onClick={()=>setView('overview')}>My progress</button><button aria-pressed={view==='together'} onClick={()=>setView('together')}>Together</button>
    </div>
    {view==='together'?<WeeklyChallenges user={user} friends={friends} weekKey={week.key} myWeekSecs={weekSummary.secs} service={challengeService}/>:<>
      <section className="sg-stats-card sg-stats-hero">
        <div className="sg-stats-segments" role="group" aria-label="Study period">{['day','week','month'].map(p=><button key={p} aria-pressed={period===p} onClick={()=>setPeriod(p)}>{p==='day'?'Today':p==='week'?'This week':'This month'}</button>)}</div>
        <div className="sg-stats-total">{shortTime(summary.secs)}</div><div className="sg-stats-caption">Focused time · {period==='week'?'Monday 4 am reset':period==='day'?'Melbourne calendar day':'Melbourne calendar month'}</div>
        <p>{change===null?(sessions.length?'Your time is adding up. Keep finding a rhythm that suits you.':'Your first session starts the story. Even 15 minutes is a useful step.'):`${Math.abs(change)}% ${change>=0?'more':'less'} focus than the same elapsed time last ${period}. ${change>=0?'Your consistency is showing.':'A fresh start is always available.'}`}</p>
        <div className="sg-stats-mini-grid"><div><strong>{summary.count}</strong><span>Sessions</span></div><div><strong>{shortTime(summary.average)}</strong><span>Average session</span></div><div><strong>{shortTime(records.total)}</strong><span>Recorded total</span></div></div>
        {history.length>=2000&&<p className="sg-stats-caption">These records and milestones reflect your latest 2,000 saved sessions, the current history limit.</p>}
      </section>
      <section className="sg-stats-card sg-stats-next">
        <span className="sg-stats-eyebrow">YOUR NEXT MILESTONE</span>
        <h2>{next?`${shortTime(Math.ceil((next.max*3600-records.total)/60)*60)} to your ${next.max}-hour milestone`:'Every milestone completed'}</h2>
        <p>{next?`${next.name} · ${Math.round(progress)}% through this stage. Every focused session brings it closer.`:'Look at how far you’ve come. Keep learning at your own pace.'}</p>
        <progress value={progress} max="100" aria-label="Progress through your current milestone stage"/>
        <details><summary>{completed.length} milestones completed</summary><div className="sg-stats-milestones">{completed.length?completed.map((stage,index)=><div key={stage.max}><strong>✓ {stage.max} hours · {stage.name}</strong><p>{['You built the habit, one session at a time.','Those small efforts have become something lasting.','Your curiosity keeps taking you further.'][index%3]}</p></div>):<p>Your first milestone is ahead. Small beginnings count.</p>}</div></details>
      </section>
      <section className="sg-stats-card"><div className="sg-stats-heading"><div><span className="sg-stats-eyebrow">SMART ANALYTICS</span><h2>A useful next step</h2></div><span aria-hidden="true">✦</span></div>
        {suggestions.map(suggestion=><article className="sg-stats-suggestion" key={suggestion.title}><h3>{suggestion.title}</h3><p>{suggestion.body}</p><button disabled={!onPlan||!suggestion.subjectId} onClick={()=>onPlan(suggestion)}>Set up {suggestion.minutes} min →</button></article>)}
      </section>
      <section className="sg-stats-card"><div className="sg-stats-heading"><h2>Your focus calendar</h2><span className="sg-stats-caption">Tap a day</span></div>
        <div className="sg-stats-calendar-nav"><button aria-label="Previous month" onClick={()=>{setMonthOffset(n=>n-1);setSelected(null);}}>‹</button><strong>{formatStudyDate(calendar.start,{month:'long',year:'numeric'})}</strong><button aria-label="Next month" disabled={monthOffset===0} onClick={()=>{setMonthOffset(n=>n+1);setSelected(null);}}>›</button></div>
        <div className="sg-stats-calendar"><div className="sg-stats-weekdays" aria-hidden="true">{['M','T','W','T','F','S','S'].map((label,index)=><span key={index}>{label}</span>)}</div>
          <div className="sg-stats-days">{Array.from({length:calendar.leading},(_,i)=><span key={`blank${i}`}/>)}{calendar.days.map(cell=><button key={cell.key} disabled={cell.future} data-level={cell.secs?Math.min(4,Math.ceil(cell.secs/calendar.max*4)):0} aria-pressed={day?.key===cell.key} aria-label={`${formatStudyDate(cell.date,{day:'numeric',month:'long'})}: ${shortTime(cell.secs)}${cell.future?', future date':''}`} onClick={()=>setSelected(cell.key)}>{cell.day}</button>)}</div>
        </div>
        <div className="sg-stats-legend"><span>Less focus</span>{[0,1,2,3,4].map(level=><i key={level} data-level={level}/>)}<span>More</span></div>
        {day&&<div className="sg-stats-day-detail" aria-live="polite"><div className="sg-stats-heading"><strong>{formatStudyDate(day.date,{weekday:'short',day:'numeric',month:'short'})}</strong><strong>{shortTime(day.secs)}</strong></div><p>{day.count?`${day.count} session${day.count===1?'':'s'} · You made time for learning.`:'No recorded sessions. Rest days belong here too.'}</p>{Object.entries(day.subjects).map(([id,secs])=><div className="sg-stats-split" key={id}><span>{subjectName(id)}</span><span>{shortTime(secs)}</span></div>)}</div>}
      </section>
      <section className="sg-stats-card"><h2>Your personal bests</h2><p>A record of your own journey.</p><div className="sg-stats-records"><div><span>Best focus day</span><strong>{shortTime(records.bestDay)}</strong><small>{records.bestDayKey?formatStudyDate(Date.parse(records.bestDayKey+'T00:00:00Z'),{day:'numeric',month:'short'}):'Your first is ahead'}</small></div><div><span>Longest session</span><strong>{shortTime(records.longestSession)}</strong><small>Quality matters too</small></div><div><span>Longest streak</span><strong>{records.longestStreak} days</strong><small>Built one day at a time</small></div><div><span>Days you showed up</span><strong>{records.activeDays}</strong><small>Every one counts</small></div></div></section>
      <section className="sg-stats-card"><h2>Where your time went</h2>{subjectRows.length?subjectRows.map(([id,secs])=><div className="sg-stats-subject" key={id}><div className="sg-stats-split"><span>{subjectName(id)}</span><strong>{shortTime(secs)}</strong></div><progress value={secs} max={Math.max(1,summary.secs)} aria-label={`${subjectName(id)} share of ${period} focus`}/></div>):<p>Your subjects will appear after a session in this period.</p>}
        <details><summary>Your eight-week trend</summary><div className="sg-stats-trend">{trend.map((w,index)=><div key={w.key}><span>{shortTime(w.secs)}</span><i style={{height:Math.max(2,w.secs/trendMax*74)}}/><small>{index===7?'Now':formatStudyDate(w.start,{day:'numeric',month:'numeric'})}</small></div>)}</div><p className="sg-stats-caption">The current week is still in progress.</p></details>
      </section>
    </>}
  </div>;
}
