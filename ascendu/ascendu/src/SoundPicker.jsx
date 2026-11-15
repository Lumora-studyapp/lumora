import {useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {SOUND_STYLES} from './soundEffects.js';

export default function SoundPicker({label,value,disabled,onChange}) {
  const [position,setPosition]=useState(null);
  const trigger=useRef(null),menu=useRef(null),anchor=useRef(null),id=useId();
  const close=(restore=false)=>{setPosition(null);if(restore)trigger.current?.focus({preventScroll:true});};
  const open=()=>{
    const rect=trigger.current.getBoundingClientRect(),computed=getComputedStyle(trigger.current);
    anchor.current=rect;
    const theme={};
    for(const key of computed)if(key.startsWith('--sg-'))theme[key]=computed.getPropertyValue(key);
    const height=Math.min(208,window.innerHeight-24),width=Math.min(160,Math.max(rect.width,132),window.innerWidth-24);
    const below=window.innerHeight-rect.bottom-12;
    const top=below>=height?rect.bottom+5:Math.max(12,rect.top-height-5);
    setPosition({...theme,top,left:Math.max(12,Math.min(rect.right-width,window.innerWidth-width-12)),width,maxHeight:height});
  };
  useLayoutEffect(()=>{
    if(position)menu.current?.querySelector('[aria-selected="true"]')?.focus({preventScroll:true});
  },[position]);
  useEffect(()=>{
    if(!position)return;
    const outside=event=>{if(!menu.current?.contains(event.target)&&!trigger.current?.contains(event.target))close();};
    const escape=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);}};
    const scroll=event=>{if(menu.current?.contains(event.target))return;const rect=trigger.current?.getBoundingClientRect();if(event.type==='resize'||!rect||Math.abs(rect.top-anchor.current.top)>1||Math.abs(rect.left-anchor.current.left)>1)close();};
    window.addEventListener('pointerdown',outside,true);
    window.addEventListener('keydown',escape,true);
    window.addEventListener('scroll',scroll,true);
    window.addEventListener('resize',scroll);
    return()=>{window.removeEventListener('pointerdown',outside,true);window.removeEventListener('keydown',escape,true);window.removeEventListener('scroll',scroll,true);window.removeEventListener('resize',scroll);};
  },[position]);
  useEffect(()=>{if(disabled)setPosition(null);},[disabled]);
  return <>
    <button ref={trigger} className="lumora-sound-picker" type="button" disabled={disabled} aria-label={label+' sound style'} aria-haspopup="listbox" aria-expanded={!!position} aria-controls={position?id:undefined}
      onClick={()=>position?close():open()} onKeyDown={event=>{if(event.key==='ArrowDown'){event.preventDefault();open();}}}>
      {SOUND_STYLES.find(style=>style.id===value)?.label}<span aria-hidden="true" style={{transform:position?"rotate(180deg)":"none",transition:"transform .2s",fontSize:12}}>▾</span>
    </button>
    {position&&createPortal(<div ref={menu} id={id} className="lumora-sound-options" style={position} role="listbox" aria-label={label+' sound choices'}
      onKeyDown={event=>{
        const options=[...menu.current.querySelectorAll('[role="option"]')],index=options.indexOf(document.activeElement);
        const next=event.key==='ArrowDown'?Math.min(index+1,options.length-1):event.key==='ArrowUp'?Math.max(0,index-1):event.key==='Home'?0:event.key==='End'?options.length-1:null;
        if(next!==null){event.preventDefault();options[next]?.focus();}
        if(event.key==='Tab')close();
      }}>
      {SOUND_STYLES.map(style=><button type="button" role="option" tabIndex={value===style.id?0:-1} key={style.id} aria-selected={value===style.id} onClick={()=>{onChange(style.id);close(true);}}>{style.label}{value===style.id&&<span aria-hidden="true">✓</span>}</button>)}
    </div>,document.body)}
  </>;
}
