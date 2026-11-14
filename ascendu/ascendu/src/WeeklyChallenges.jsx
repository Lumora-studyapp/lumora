import {useCallback,useEffect,useRef,useState} from 'react';
import {loadChallenges,saveChallenge} from './challengeService.js';
import {challengeState,challengeProgress,CHALLENGE_GOALS} from './challengeModel.js';
import {shortTime} from './statsModel.js';

const defaultService={load:loadChallenges,save:saveChallenge};
export default function WeeklyChallenges({user,friends=[],weekKey,myWeekSecs,service=defaultService}) {
  const [data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[busy,setBusy]=useState('');
  const [mode,setMode]=useState('together'),[goal,setGoal]=useState(5);
  const generation=useRef(0);
  const refresh=useCallback(async()=>{
    const request=++generation.current;setLoading(true);setError('');
    try{const next=await service.load(user,friends);if(request===generation.current)setData(next);}
    catch{if(request===generation.current)setError('Challenges could not be loaded. Please retry.');}
    finally{if(request===generation.current)setLoading(false);}
  },[user,friends,weekKey,service]);
  useEffect(()=>{setData(null);refresh();return()=>{generation.current++;};},[refresh]);
  const act=async(friend,choice)=>{
    setBusy(friend.username);setError('');
    try{await service.save(user,friend,choice,weekKey);await refresh();}
    catch(err){setError(err.message||'Your choice could not be saved. Try again.');}
    finally{setBusy('');}
  };
  return <section className="sg-stats-card sg-challenges">
    <div className="sg-stats-heading"><div><span className="sg-stats-eyebrow">GROW TOGETHER</span><h2>Your weekly circle</h2></div><button className="sg-stats-text-button" disabled={loading||!!busy} onClick={refresh}>Refresh</button></div>
    <p>Choose a shared goal or a friendly comparison. Each friend joins separately, for this week only.</p>
    <div className="sg-stats-segments" role="group" aria-label="Challenge mode">
      <button aria-pressed={mode==='together'} onClick={()=>setMode('together')}>Shared goal</button>
      <button aria-pressed={mode==='friendly'} onClick={()=>setMode('friendly')}>Friendly challenge</button>
    </div>
    <label className="sg-challenge-goal">Weekly focus per person<select value={goal} onChange={e=>setGoal(Number(e.target.value))}>{CHALLENGE_GOALS.map(hours=><option key={hours} value={hours}>{hours} hours</option>)}</select></label>
    <p className="sg-stats-caption">{mode==='together'?`Combine your time toward ${goal*2} hours together.`:`Aim for ${goal} hours each and compare your progress.`} Saved sessions count from Monday 4 am Melbourne time. No automatic enrolment or coin rewards.</p>
    {error&&<div role="alert" className="sg-stats-error">{error}</div>}
    {loading&&!data&&<p role="status">Loading your circle…</p>}
    {!friends.length&&<div className="sg-stats-empty">Add a friend from the Board to start a weekly challenge together.</div>}
    {data?.weekKey===weekKey&&data.peers.map(friend=>{
      const mine=data.choices[friend.username],theirs=friend.choice,state=challengeState(mine,theirs);
      const choice=state==='incoming'?theirs:mine;
      const progress=state==='active'?challengeProgress(choice,myWeekSecs,friend.secs):null;
      return <article className="sg-challenge-person" key={friend.username}>
        <div className="sg-stats-heading"><strong>{friend.username}</strong><span className="sg-stats-caption">{state==='active'?(choice.mode==='together'?'Shared goal':'Friendly challenge'):state==='waiting'?'Invitation sent':state==='ended'?'Not participating':''}</span></div>
        {state==='active'?<>
          <div className="sg-challenge-scores"><div><span>You</span><strong>{shortTime(myWeekSecs)}</strong></div><div><span>{friend.username}</span><strong>{shortTime(friend.secs)}</strong></div></div>
          <progress max="100" value={progress.percent} aria-label={`${choice.mode==='together'?'Shared':'Your'} challenge progress`}/>
          <p>{progress.percent===100?'Goal reached. You made room for learning this week!':`${shortTime(progress.remaining)} to ${choice.mode==='together'?'your shared goal':'your goal'}. One focused block at a time.`}</p>
          {choice.mode==='friendly'&&<p className="sg-stats-caption">{myWeekSecs===friend.secs?'You’re level so far.':myWeekSecs>friend.secs?`You’re ${shortTime(myWeekSecs-friend.secs)} ahead.`:`${friend.username} is ${shortTime(friend.secs-myWeekSecs)} ahead.`} Your own progress matters too.</p>}
          <div className="sg-challenge-checkpoints" aria-label="Weekly milestones">{[25,50,75,100].map(n=><span key={n} data-complete={progress.percent>=n}>{progress.percent>=n?'✓ ':''}{n}%</span>)}</div>
          <button className="sg-stats-text-button" disabled={!!busy} onClick={()=>act(friend,{...mine,status:'declined'})}>Leave this week</button>
        </>:state==='incoming'?<>
          <p>{friend.username} invites you to {theirs.mode==='together'?`a ${theirs.goalHours*2}-hour shared goal`:`a ${theirs.goalHours}-hour friendly challenge`} this week.</p>
          <div className="sg-stats-actions"><button disabled={!!busy} onClick={()=>act(friend,{...theirs,status:'accepted'})}>Join this week</button><button className="sg-stats-secondary" disabled={!!busy} onClick={()=>act(friend,{...theirs,status:'declined'})}>Decline</button></div>
        </>:state==='waiting'?<>
          <p>Waiting for {friend.username} to join your {mine.mode==='together'?`${mine.goalHours*2}-hour shared goal`:`${mine.goalHours}-hour challenge`}.</p>
          <button className="sg-stats-text-button" disabled={!!busy} onClick={()=>act(friend,{...mine,status:'declined'})}>Cancel invitation</button>
        </>:<button disabled={!!busy||loading} onClick={()=>act(friend,{id:crypto.randomUUID(),mode,goalHours:goal,status:'invited'})}>Invite {friend.username}</button>}
        {busy===friend.username&&<span role="status" className="sg-stats-caption">Saving…</span>}
      </article>;
    })}
  </section>;
}
