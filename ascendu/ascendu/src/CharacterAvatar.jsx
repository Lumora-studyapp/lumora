import {useEffect,useRef,useState} from 'react';

export const DEFAULT_CHARACTER={model:'man',hairStyle:'curls',hairColor:'#242026',skin:'#B97752',eyes:'#593D2B'};
export const CHARACTER_OPTIONS={
  model:[['man','Man'],['woman','Woman']],
  hairStyle:[['short','Short'],['curls','Curls'],['long','Long'],['braids','Braids']],
  hairColor:[['#242026','Black'],['#573626','Brown'],['#A06A40','Light brown'],['#CF9F62','Blonde'],['#743F68','Plum']],
  skin:[['#F4D4B9','Fair'],['#DCA884','Light'],['#B97752','Medium'],['#865039','Tan'],['#523129','Deep']],
  eyes:[['#593D2B','Brown'],['#291F22','Dark'],['#4E7457','Green'],['#50718F','Blue']],
};
export function normalizeCharacter(value){const raw=value&&typeof value==='object'?value:{};return Object.fromEntries(Object.entries(CHARACTER_OPTIONS).map(([key,choices])=>[key,choices.some(([id])=>id===raw[key])?raw[key]:DEFAULT_CHARACTER[key]]));}

export function CharacterAvatar({value,size=72}){
  const c=normalizeCharacter(value),braids=c.hairStyle==='braids',long=c.hairStyle==='long',curls=c.hairStyle==='curls';
  return <svg viewBox="0 0 160 160" width={size} height={size} role="img" aria-label={`Custom ${c.model} avatar`} style={{display:'block',flexShrink:0,borderRadius:'50%'}}>
    <circle cx="80" cy="80" r="80" fill="#E8D9F1"/>
    <path d="M9 160 Q15 124 48 119 L68 116 L93 116 L115 119 Q147 124 153 160Z" fill={c.model==='woman'?'#6C348A':'#603078'}/>
    {(long||braids)&&<path d="M40 54 Q30 84 40 133 L56 134 L59 70 M120 54 Q130 84 120 133 L104 134 L101 70" fill={c.hairColor}/>}
    {braids&&[43,49,111,117].map((x,i)=><path key={i} d={`M${x} 68 Q${x-4} 92 ${x} 128`} fill="none" stroke={c.hairColor} strokeWidth="6" strokeDasharray="8 3"/>)}
    <path d="M68 104h24v25q-12 12-24 0z" fill={c.skin}/>
    <ellipse cx="45" cy="78" rx="7" ry="11" fill={c.skin}/><ellipse cx="115" cy="78" rx="7" ry="11" fill={c.skin}/>
    <ellipse cx="80" cy="76" rx="38" ry="47" fill={c.skin}/>
    <path d="M43 72 Q37 27 67 22 Q95 11 115 38 Q125 51 117 73 L109 62 Q102 42 88 43 Q64 57 48 54Z" fill={c.hairColor}/>
    {curls&&[48,60,73,87,100,111].map((x,i)=><circle key={i} cx={x} cy={i%2?34:38} r="12" fill={c.hairColor}/>)}
    {c.hairStyle==='short'&&<path d="M45 53 Q70 40 113 44" stroke={c.hairColor} strokeWidth="12" fill="none"/>}
    <path d="M57 69q8-6 16 0M88 69q8-6 16 0" stroke={c.hairColor} strokeWidth="3" strokeLinecap="round" fill="none"/>
    <ellipse cx="66" cy="78" rx="8" ry="6" fill="white"/><ellipse cx="95" cy="78" rx="8" ry="6" fill="white"/>
    <circle cx="66" cy="78" r="4.5" fill={c.eyes}/><circle cx="95" cy="78" r="4.5" fill={c.eyes}/>
    <circle cx="67" cy="77" r="1.5" fill="white"/><circle cx="96" cy="77" r="1.5" fill="white"/>
    <path d="M79 79l-3 13q3 3 7 0" stroke="#805844" opacity=".5" strokeWidth="2" fill="none"/>
    <path d="M68 102q12 9 24 0" stroke="#783D49" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
    <path d="M65 125q15 12 30 0" stroke="#9D73B9" strokeWidth="3" fill="none"/>
  </svg>;
}

// The current scholar art is flattened. Recolour only facial/hair pixels in
// bounded regions so the purple uniform and accessories keep their palette.
export function CharacterFullBody({value,stage=0,style={}}){
  const c=normalizeCharacter(value),canvasRef=useRef(null);
  useEffect(()=>{
    let live=true;
    const image=new Image();
    image.src=`/Images/Lumora Scholar ${c.model==='woman'?'Woman':'Man'} (${Math.min(5,Math.max(1,stage+1))}) - ${['First Day','Finding Focus','Researcher','Thesis Complete','Lumora Graduate'][Math.min(4,Math.max(0,stage))]}.png`;
    image.onload=()=>{
      if(!live||!canvasRef.current)return;
      const canvas=canvasRef.current,ctx=canvas.getContext('2d',{willReadFrequently:true});
      canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;ctx.drawImage(image,0,0);
      const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),data=pixels.data;
      const rgb=hex=>[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16));
      const skin=rgb(c.skin),hair=rgb(c.hairColor),w=canvas.width;
      const head=c.model==='woman'?{x1:285,x2:700,y1:0,y2:360}:{x1:380,x2:710,y1:0,y2:360};
      for(let y=0;y<canvas.height;y++)for(let x=0;x<w;x++){
        const i=(y*w+x)*4,a=data[i+3];if(a<200)continue;
        const r=data[i],g=data[i+1],b=data[i+2];
        const inHead=x>head.x1&&x<head.x2&&y>head.y1&&y<head.y2;
        const inHands=y>250&&y<850&&x>160&&x<890;
        const isSkin=(inHead||inHands)&&r>85&&g>42&&r>g*1.17&&g>b*1.06&&b<r*.78;
        const isHair=inHead&&y<270&&r<125&&g<105&&b<105&&r>b*.85&&g>b*.7;
        if(isSkin){const shade=Math.max(.34,Math.min(1.28,(r+g+b)/390));data[i]=Math.min(255,skin[0]*shade);data[i+1]=Math.min(255,skin[1]*shade);data[i+2]=Math.min(255,skin[2]*shade);}
        else if(isHair){const shade=Math.max(.23,Math.min(1.3,(r+g+b)/180));data[i]=Math.min(255,hair[0]*shade);data[i+1]=Math.min(255,hair[1]*shade);data[i+2]=Math.min(255,hair[2]*shade);}
      }
      ctx.putImageData(pixels,0,0);
    };
    return()=>{live=false;image.onload=null;};
  },[c.model,c.skin,c.hairColor,stage]);
  return <canvas ref={canvasRef} role="img" aria-label={`${c.model==='woman'?'Woman':'Man'} scholar, stage ${stage+1}`} style={{display:'block',width:'190px',height:'285px',maxWidth:'100%',maxHeight:'100%',objectFit:'contain',...style}}/>;
}

export function CharacterEditor({initialValue,onSave,onBack,title='Make your character'}){
  const [value,setValue]=useState(()=>normalizeCharacter(initialValue));
  const update=(key,id)=>setValue(current=>({...current,[key]:id}));
  return <main style={{minHeight:'100dvh',display:'grid',placeItems:'center',background:'linear-gradient(145deg,#F9F4FC,#EDE1F4)',padding:18,boxSizing:'border-box',color:'#34203D'}}>
    <section style={{width:'min(100%,440px)',maxHeight:'calc(100dvh - 36px)',overflowY:'auto',background:'#FFFCFF',border:'1px solid #E9DDEA',borderRadius:24,padding:22,boxShadow:'0 18px 48px #50305A22'}}>
      <h1 style={{fontSize:25,margin:'0 0 5px'}}>{title}</h1><p style={{fontSize:13,color:'#756B7B',margin:'0 0 12px'}}>Choose a look for your Lumora scholar.</p>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'min(38dvh,300px)',position:'relative',overflow:'hidden',minHeight:0,padding:8,background:'#F5EDF8',borderRadius:20,marginBottom:7}}><CharacterFullBody value={value}/><div style={{position:"absolute",right:10,bottom:10,padding:3,borderRadius:"50%",background:"white",boxShadow:"0 2px 8px #24112C44"}} title="Face details"><CharacterAvatar value={value} size={62}/></div></div>
      <p style={{fontSize:11,lineHeight:1.35,color:'#756B7B',margin:'0 0 15px'}}>Hair style and eye colour appear in the portrait. The full-body scholar shows your character, hair colour and skin tone.</p>
      {Object.entries(CHARACTER_OPTIONS).map(([key,choices])=><fieldset key={key} style={{border:0,padding:0,margin:'0 0 12px'}}><legend style={{fontSize:12,fontWeight:750,marginBottom:7}}>{({model:'Character',hairStyle:'Hairstyle',hairColor:'Hair colour',skin:'Skin tone',eyes:'Eye colour'})[key]}</legend><div style={{display:'flex',flexWrap:'wrap',gap:7}}>{choices.map(([id,label])=><button key={id} type="button" aria-pressed={value[key]===id} aria-label={`${label} ${key}`} onClick={()=>update(key,id)} style={{minHeight:34,padding:'6px 10px',borderRadius:10,border:value[key]===id?'2px solid #63317D':'1px solid #E2D5E8',background:value[key]===id?'#F2E7F8':'white',color:'#4C3358',fontSize:12,cursor:'pointer'}}>{key==='skin'||key==='eyes'||key==='hairColor'?<span style={{display:'inline-block',verticalAlign:'middle',width:15,height:15,borderRadius:'50%',background:id,marginRight:5,border:'1px solid #0002'}}/>:null}{label}</button>)}</div></fieldset>)}
      <div style={{display:'flex',gap:8,marginTop:18}}><button type="button" onClick={onBack} style={{flex:1,minHeight:42,border:0,borderRadius:11,background:'#F0E7F4',color:'#63317D',fontWeight:700}}>Back</button><button type="button" onClick={()=>onSave(value)} style={{flex:2,minHeight:42,border:0,borderRadius:11,background:'#63317D',color:'white',fontWeight:750}}>Save character</button></div>
    </section>
  </main>;
}
