import React, {useState} from 'react';

function toHsv(hex) {
  const [r,g,b]=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255);
  const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  const h=!d?0:max===r?((g-b)/d+6)%6:max===g?(b-r)/d+2:(r-g)/d+4;
  return [h*60,max?d/max:0,max];
}
function toHex(h,s,v) {
  const f=n=>{const k=(n+h/60)%6;return Math.round(255*(v-v*s*Math.max(0,Math.min(k,4-k,1)))).toString(16).padStart(2,'0');};
  return `#${f(5)}${f(3)}${f(1)}`;
}

export default function SubjectColourPicker({color,onChange}) {
  const [hsv,setHsv]=useState(()=>toHsv(color));
  const [hex,setHex]=useState(color);
  const [h,s,v]=hsv;
  const update=next=>{setHsv(next);const value=toHex(...next);setHex(value);onChange(value);};
  const pick=e=>{
    const rect=e.currentTarget.getBoundingClientRect();
    const x=(e.clientX-rect.left-rect.width/2)/(rect.width/2),y=(e.clientY-rect.top-rect.height/2)/(rect.height/2);
    update([(Math.atan2(x,-y)*180/Math.PI+360)%360,Math.min(1,Math.hypot(x,y)),v]);
  };
  return <div style={{marginTop:14,padding:12,border:'1px solid #DDE5DA',borderRadius:12}}>
    <div aria-label="Colour wheel; use the sliders below for keyboard control" role="group"
      onPointerDown={e=>{if(e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);pick(e);}}
      onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))pick(e);}}
      onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
      style={{position:'relative',width:160,height:160,margin:'0 auto 12px',borderRadius:'50%',touchAction:'none',cursor:'crosshair',background:'radial-gradient(circle,white 0%,transparent 70.71%),conic-gradient(red,yellow,lime,cyan,blue,magenta,red)'}}>
      <span style={{position:'absolute',inset:0,borderRadius:'50%',background:'#000',opacity:1-v,pointerEvents:'none'}}/>
      <span style={{position:'absolute',left:`${50+Math.sin(h*Math.PI/180)*s*50}%`,top:`${50-Math.cos(h*Math.PI/180)*s*50}%`,width:12,height:12,border:'2px solid white',borderRadius:'50%',boxShadow:'0 0 0 1px #333',transform:'translate(-50%,-50%)',pointerEvents:'none'}}/>
    </div>
    {[['Hue',h,360,0],['Saturation',s*100,100,1],['Brightness',v*100,100,2]].map(([label,value,max,index])=><label key={label} style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'#405348',marginTop:6}}>
      <span style={{width:68}}>{label}</span><input aria-label={label} type="range" min="0" max={max} value={value} onChange={e=>{const next=[...hsv];next[index]=Number(e.target.value)/(index?100:1);update(next);}} style={{minWidth:0,flex:1,accentColor:color}}/>
    </label>)}
    <label style={{display:'flex',gap:8,alignItems:'center',marginTop:10,fontSize:12,color:'#405348'}}>Hex
      <input aria-label="Custom colour hex code" value={hex} maxLength={7} spellCheck={false} onChange={e=>{const value=e.target.value;setHex(value);if(/^#[\da-f]{6}$/i.test(value)){setHsv(toHsv(value));onChange(value);}}} onBlur={()=>setHex(color)} style={{minWidth:0,width:100,padding:6,border:'1px solid #CAD8C6',borderRadius:6}}/>
      <span aria-label={`Selected colour ${color}`} style={{width:28,height:28,border:'1px solid #aaa',borderRadius:6,background:color}}/>
    </label>
  </div>;
}
