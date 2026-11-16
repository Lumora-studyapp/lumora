import {useEffect,useRef,useState} from 'react';
import {feedbackAdminApi,feedbackError,sendFeedback} from './feedbackClient.js';

const styles={
  overlay:{position:'fixed',inset:0,zIndex:400,background:'#0007',display:'grid',placeItems:'center',padding:16},
  panel:{boxSizing:'border-box',width:'100%',maxWidth:440,maxHeight:'90dvh',overflowY:'auto',padding:22,borderRadius:22,background:'var(--sg-theme-panel-solid,#FAF5FC)',color:'var(--sg-theme-text,#34203D)'},
  field:{boxSizing:'border-box',width:'100%',padding:12,border:'1px solid var(--sg-theme-border,#D9C8E3)',borderRadius:10,background:'var(--sg-theme-neutral,#fff)',color:'var(--sg-theme-text,#34203D)',font:'inherit',fontSize:14},
  button:{minHeight:44,padding:'10px 16px',border:0,borderRadius:11,background:'var(--sg-theme-accent,#63317D)',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer'},
};

export default function FeedbackPanel({onClose,enabled=false,submit=sendFeedback}){
  const [category,setCategory]=useState('improvement'),[message,setMessage]=useState('');
  const [busy,setBusy]=useState(false),[received,setReceived]=useState(false),[error,setError]=useState('');
  const request=useRef(null),alive=useRef(true),sending=useRef(false),close=useRef(null),first=useRef(null);
  useEffect(()=>{
    alive.current=true;const previous=document.activeElement;first.current?.focus();
    return()=>{alive.current=false;if(previous?.isConnected)previous.focus();};
  },[]);
  useEffect(()=>{if(received)close.current?.focus();},[received]);
  const valid=message.trim().length>=10&&message.trim().length<=2000;
  const send=async event=>{
    event.preventDefault();if(!enabled||!valid||sending.current)return;
    const content={category,message:message.trim()};
    if(!request.current||request.current.category!==content.category||request.current.message!==content.message){
      request.current={...content,submissionId:crypto.randomUUID()};
    }
    sending.current=true;setBusy(true);setError('');
    try{await submit(request.current);if(alive.current)setReceived(true);}
    catch(e){if(alive.current)setError(feedbackError(e));}
    finally{sending.current=false;if(alive.current)setBusy(false);}
  };
  const keyboard=event=>{
    if(event.key==='Escape'){event.stopPropagation();onClose();}
    if(event.key==='Tab'){
      const controls=[...event.currentTarget.querySelectorAll('button,select,textarea')].filter(el=>!el.disabled);
      const first=controls[0],last=controls.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
  };
  return <div style={styles.overlay} onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section role="dialog" aria-modal="true" aria-labelledby="feedback-title" style={styles.panel} onKeyDown={keyboard}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
        <h2 id="feedback-title" style={{fontSize:20,margin:'0 0 12px'}}>Suggest an improvement</h2>
        <button type="button" ref={close} onClick={onClose} aria-label="Close feedback" style={{...styles.button,background:'transparent',color:'inherit'}}>✕</button>
      </div>
      {received?<><p role="status">Thanks—your feedback has been received.</p><button style={styles.button} onClick={onClose}>Done</button></>:
        <form onSubmit={send}>
          <p style={{fontSize:13,lineHeight:1.5}}>Share an idea or report a problem. Only Lumora admins can read your feedback.</p>
          {!enabled&&<p id="feedback-availability" role="status" style={{fontSize:13,lineHeight:1.5,padding:12,borderRadius:10,background:'var(--sg-theme-accent-wash,#EEE4F4)'}}>Feedback submissions aren’t open yet. You can explore the form, but messages can’t be sent or saved yet.</p>}
          <label htmlFor="feedback-category">Category</label>
          <select ref={first} id="feedback-category" style={{...styles.field,margin:'6px 0 16px'}} value={category} disabled={busy} onChange={e=>setCategory(e.target.value)}>
            <option value="improvement">Improvement</option><option value="bug">Bug report</option>
          </select>
          <label htmlFor="feedback-message">Your feedback</label>
          <textarea id="feedback-message" rows={7} maxLength={2000} value={message} disabled={busy} onChange={e=>setMessage(e.target.value)} style={{...styles.field,resize:'vertical',marginTop:6}} aria-describedby="feedback-count feedback-minimum"/>
          <div id="feedback-count" style={{textAlign:'right',fontSize:12,marginTop:4}}>{message.length.toLocaleString()} / 2,000</div>
          <p id="feedback-minimum" style={{fontSize:12}}>Please enter at least 10 characters.</p>
          {error&&<p role="alert" style={{fontSize:13}}>{error}</p>}
          <button type="submit" disabled={!enabled||busy||!valid} aria-describedby={!enabled?'feedback-availability':undefined} style={{...styles.button,width:'100%',opacity:(!enabled||busy||!valid)?0.5:1,cursor:!enabled?'not-allowed':'pointer'}}>{busy?'Sending…':error?'Retry':'Send feedback'}</button>
        </form>}
    </section>
  </div>;
}

export function AdminFeedback({api=feedbackAdminApi}){
  const [category,setCategory]=useState('all'),[rows,setRows]=useState([]),[page,setPage]=useState({});
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  const generation=useRef(0);
  const load=async(cursor,revision)=>{
    setBusy(true);setError('');
    try{const result=await api.load(category,cursor);if(revision===generation.current){setRows(previous=>cursor?[...previous,...result.rows]:result.rows);setPage(result);}}
    catch(e){if(revision===generation.current)setError(feedbackError(e));}
    finally{if(revision===generation.current)setBusy(false);}
  };
  useEffect(()=>{const revision=++generation.current;setRows([]);setPage({});load(null,revision);return()=>{generation.current++;};},[category,attempt,api]);
  const update=async(id,status)=>{
    const revision=generation.current;setBusy(true);setError('');
    try{await api.update(id,status);if(revision===generation.current)setRows(previous=>previous.map(row=>row.id===id?{...row,status}:row));}
    catch(e){if(revision===generation.current)setError(feedbackError(e));}
    finally{if(revision===generation.current)setBusy(false);}
  };
  return <section aria-labelledby="admin-feedback-title" style={{padding:'16px 0'}}>
    <h3 id="admin-feedback-title">Feedback</h3>
    <label>Category <select value={category} disabled={busy} onChange={e=>setCategory(e.target.value)} style={styles.field}>
      <option value="all">All feedback</option><option value="improvement">Improvements</option><option value="bug">Bug reports</option>
    </select></label>
    {error&&<div role="alert"><p>{error}</p><button onClick={()=>setAttempt(n=>n+1)} style={styles.button}>Reload feedback</button></div>}
    {!busy&&!rows.length&&!error&&<p>No feedback yet.</p>}
    {rows.map(row=><article key={row.id} style={{padding:14,marginTop:10,border:'1px solid var(--sg-theme-border,#DDD)',borderRadius:12}}>
      <strong>{row.username}</strong><small style={{display:'block',marginTop:4}}>{row.category==='bug'?'Bug report':'Improvement'} · {row.createdAt?.toDate?.().toLocaleString()||'Date unavailable'}</small>
      <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{row.message}</p>
      <label>Status <select value={row.status} disabled={busy} onChange={e=>update(row.id,e.target.value)} style={styles.field}>
        <option value="new">New</option><option value="reviewed">Reviewed</option><option value="closed">Closed</option>
      </select></label>
    </article>)}
    {busy&&<p role="status">Loading feedback…</p>}
    {page.more&&<button disabled={busy} onClick={()=>load(page.cursor,generation.current)} style={{...styles.button,marginTop:12}}>Load more</button>}
  </section>;
}

export function AdminFeedbackSection({enabled=false}){
  const [open,setOpen]=useState(false);
  return <div style={{marginBottom:16}}>
    <button style={styles.button} aria-expanded={open} onClick={()=>setOpen(value=>!value)}>{open?'Hide feedback':'Review feedback'}</button>
    {open&&(enabled?<AdminFeedback/>:<p role="status">The feedback inbox will be available when submissions open.</p>)}
  </div>;
}
