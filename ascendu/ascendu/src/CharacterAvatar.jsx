import {useEffect,useRef,useState} from 'react';
import {TREE_SKINS,getCharacterProgressionImage} from './characterCatalog.js';
import {recolourScholarPixels} from './scholarColour.js';

// Seated poses and raised props need framing around the face, not the canvas centre.
export const PORTRAIT_BACKGROUND='#EDE2F3';
// Each anchor follows the head rather than the centre of the full-body artwork.
// Explicit frames also keep hats, hair and seated poses inside the circular crop.
const PORTRAIT_FRAMES={
  'lumora-scholar-man':{x:.54,y:-.015,scale:.28},
  'lumora-scholar-woman':{x:.55,y:-.015,scale:.28},
  einstein:{x:.475,y:.01,scale:.32},
  gallileo:{x:.34,y:.085,scale:.36},
  davinci:{x:.33,y:.015,scale:.34},
  edison:{x:.49,y:.12,scale:.29},
  'lebron-james':{x:.5,y:-.01,scale:.29},
  'lionel-messi':{x:.55,y:.13,scale:.30},
  'michael-jackson':{x:.48,y:-.015,scale:.29},
  'tiger-woods':{x:.52,y:-.015,scale:.29},
  'william-shakespeare':{x:.5,y:-.015,scale:.29},
  'marie-curie':{x:.55,y:-.01,scale:.29},
  pythagoras:{x:.5,y:-.015,scale:.29},
  'jk-rowling':{x:.48,y:-.015,scale:.29},
  'ludwig-van-beethoven':{x:.53,y:.005,scale:.33},
  'neil-armstrong':{x:.5,y:-.015,scale:.29},
  'henry-ford':{x:.5,y:-.015,scale:.29},
  michelangelo:{x:.5,y:-.015,scale:.29},
  'christopher-columbus':{x:.46,y:-.015,scale:.29},
  'elon-musk':{x:.46,y:-.015,scale:.29},
  'bill-gates':{x:.5,y:-.015,scale:.29},
  'cristiano-ronaldo':{x:.52,y:-.015,scale:.29},
};
function finishPortrait(context){
  // Keep the connected character silhouette; detached speech bubbles and
  // cropped prop fragments should not float in the portrait background.
  const pixels=context.getImageData(0,0,256,256),data=pixels.data;
  const labels=new Int32Array(256*256),queue=new Int32Array(labels.length);
  let label=0,largest=0,largestSize=0;
  for(let start=0;start<labels.length;start++){
    if(labels[start]||data[start*4+3]<32)continue;
    label++;let read=0,count=1;queue[0]=start;labels[start]=label;
    while(read<count){
      const index=queue[read++],x=index%256;
      for(const next of [x>0?index-1:-1,x<255?index+1:-1,index-256,index+256]){
        if(next<0||next>=labels.length||labels[next]||data[next*4+3]<32)continue;
        labels[next]=label;queue[count++]=next;
      }
    }
    if(count>largestSize){largestSize=count;largest=label;}
  }
  for(let index=0;index<labels.length;index++){
    const x=index%256;
    const keep=labels[index]===largest||[x>0?index-1:-1,x<255?index+1:-1,index-256,index+256].some(next=>next>=0&&next<labels.length&&labels[next]===largest);
    if(!keep)data[index*4+3]=0;
  }
  context.putImageData(pixels,0,0);
  context.globalCompositeOperation='destination-over';
  context.fillStyle=PORTRAIT_BACKGROUND;context.fillRect(0,0,256,256);
  context.globalCompositeOperation='source-over';
}

export const DEFAULT_CHARACTER={model:'man',hairStyle:'curls',hairColor:'#242026',skin:'#B97752',eyes:'#593D2B'};
export const CHARACTER_OPTIONS={
  model:[['man','Man'],['woman','Woman']],
  hairStyle:[['short','Short'],['curls','Curls'],['long','Long'],['braids','Braids']],
  hairColor:[['#242026','Black'],['#573626','Brown'],['#A06A40','Light brown'],['#CF9F62','Blonde'],['#743F68','Plum']],
  skin:[['#F4D4B9','Fair'],['#DCA884','Light'],['#B97752','Medium'],['#865039','Tan'],['#523129','Deep']],
  eyes:[['#593D2B','Brown'],['#291F22','Dark'],['#4E7457','Green'],['#50718F','Blue']],
};
export function normalizeCharacter(value){const raw=value&&typeof value==='object'?value:{};return Object.fromEntries(Object.entries(CHARACTER_OPTIONS).map(([key,choices])=>[key,choices.some(([id])=>id===raw[key])?raw[key]:DEFAULT_CHARACTER[key]]));}

// The current scholar art is flattened. Recolour only facial/hair pixels in
// bounded regions so the purple uniform and accessories keep their palette.
export function CharacterFullBody({value,stage=0,style={},skinId=null,portrait=false}){
  const c=normalizeCharacter({...value,...(skinId==='lumora-scholar-woman'?{model:'woman'}:skinId==='lumora-scholar-man'?{model:'man'}:{})}),canvasRef=useRef(null);
  const skin=TREE_SKINS.find(item=>item.characterImage&&item.id===(skinId||`lumora-scholar-${c.model}`))||TREE_SKINS.find(item=>item.id===`lumora-scholar-${c.model}`);
  const source=getCharacterProgressionImage(skin,stage);
  const scholar=skin.id.startsWith('lumora-scholar-');
  useEffect(()=>{
    let live=true;
    const image=new Image();
    image.onload=()=>{
      if(!live||!canvasRef.current)return;
      const canvas=canvasRef.current,ctx=canvas.getContext('2d',{willReadFrequently:true});
      canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;ctx.drawImage(image,0,0);
      const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),data=pixels.data;
      if(scholar)recolourScholarPixels(pixels,{model:c.model,stage,skin:c.skin,hairColor:c.hairColor});
      ctx.putImageData(pixels,0,0);
      if(portrait){
        const original=document.createElement('canvas');
        original.width=canvas.width;original.height=canvas.height;
        original.getContext('2d').drawImage(canvas,0,0);
        // Frame the head and shoulders from the same artwork used by the timer.
        const frame=PORTRAIT_FRAMES[skin.id]||{x:.5,y:0,scale:.26};
        const side=original.height*frame.scale;
        const left=original.width*frame.x-side/2;
        canvas.width=256;canvas.height=256;
        ctx.drawImage(original,left,original.height*frame.y,side,side,0,0,256,256);
        finishPortrait(ctx);
      }
    };
    image.src=source;
    return()=>{live=false;image.onload=null;};
  },[c.model,c.skin,c.hairColor,source,scholar,portrait,stage]);
  return <canvas ref={canvasRef} role="img" aria-label={portrait?`${skin.name} profile picture`:`${skin.name}, stage ${stage+1}`} style={{display:'block',width:'190px',height:'285px',maxWidth:'100%',maxHeight:'100%',objectFit:'contain',...style}}/>;
}

export function CharacterPortrait({skinId,value,size=72}){
  const model=skinId==='lumora-scholar-woman'?'woman':skinId==='lumora-scholar-man'?'man':normalizeCharacter(value).model;
  const id=TREE_SKINS.find(item=>item.id===skinId&&item.characterImage)?.id||`lumora-scholar-${model}`;
  return <CharacterFullBody skinId={id} value={{...value,model}} stage={id.startsWith('lumora-scholar-')?0:4} portrait style={{width:size,height:size,borderRadius:'50%'}}/>;
}

export function CharacterEditor({initialValue,initialSkinId,ownedSkins=[],onSave,onBack,title='Make your character'}){
  const [value,setValue]=useState(()=>normalizeCharacter({...initialValue,...(initialSkinId==='lumora-scholar-woman'?{model:'woman'}:initialSkinId==='lumora-scholar-man'?{model:'man'}:{})}));
  const choices=TREE_SKINS.filter(skin=>skin.characterImage&&(skin.id.startsWith('lumora-scholar-')||ownedSkins.includes(skin.id)));
  const [selectedId,setSelectedId]=useState(()=>choices.some(skin=>skin.id===initialSkinId)?initialSkinId:'lumora-scholar-'+normalizeCharacter(initialValue).model);
  const scholar=selectedId.startsWith('lumora-scholar-');
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const selectCharacter=id=>{
    setSelectedId(id);setError('');
    if(id.startsWith('lumora-scholar-'))setValue(current=>({...current,model:id.endsWith('woman')?'woman':'man'}));
  };
  const update=(key,id)=>{setValue(current=>({...current,[key]:id}));setError('');};
  const save=async()=>{
    if(saving)return;
    setSaving(true);setError('');
    try{await onSave(value,selectedId);}catch(e){setError(e.message||'Could not save your character. Please try again.');}
    finally{setSaving(false);}
  };
  return <main style={{minHeight:'100dvh',display:'grid',placeItems:'center',background:'linear-gradient(145deg,#F9F4FC,#EDE1F4)',padding:18,boxSizing:'border-box',color:'#34203D'}}>
    <section style={{boxSizing:'border-box',width:'min(100%,440px)',maxHeight:'calc(100dvh - 36px)',overflowY:'auto',background:'#FFFCFF',border:'1px solid #E9DDEA',borderRadius:24,padding:22,boxShadow:'0 18px 48px #50305A22'}}>
      <h1 style={{fontSize:25,margin:'0 0 5px'}}>{title}</h1>
      <p style={{fontSize:13,color:'#756B7B',margin:'0 0 12px'}}>Your character, your profile.</p>
      <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 100px',gap:6,alignItems:'center',height:'min(38dvh,300px)',padding:10,background:PORTRAIT_BACKGROUND,borderRadius:20,marginBottom:16}}>
        <div style={{height:'100%',minHeight:0,display:'flex',alignItems:'center',justifyContent:'center'}}><CharacterFullBody skinId={selectedId} value={value} stage={scholar?0:4} style={{height:'100%',width:'100%'}}/></div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:9}}><CharacterPortrait skinId={selectedId} value={value} size={100}/><span style={{fontSize:11,fontWeight:650,color:'#695471'}}>Profile picture</span></div>
      </div>
      <label style={{display:'block',fontSize:12,fontWeight:750,marginBottom:7}} htmlFor="character-choice">Character</label>
      <select id="character-choice" value={selectedId} onChange={event=>selectCharacter(event.target.value)} disabled={saving} style={{boxSizing:'border-box',width:'100%',font:'inherit',fontSize:13,color:'#4C3358',background:'white',border:'1px solid #D9C8E3',borderRadius:10,padding:10,marginBottom:16}}>{choices.map(skin=><option key={skin.id} value={skin.id}>{skin.name.replace('Lumora Scholar ','')}</option>)}</select>
      {scholar&&['hairColor','skin'].map(key=><fieldset key={key} disabled={saving} style={{border:0,padding:0,margin:'0 0 12px'}}><legend style={{fontSize:12,fontWeight:750,marginBottom:7}}>{key==='skin'?'Skin tone':'Hair colour'}</legend><div style={{display:'flex',flexWrap:'wrap',gap:7}}>{CHARACTER_OPTIONS[key].map(([id,label])=><button key={id} type="button" aria-pressed={value[key]===id} aria-label={label+' '+key} onClick={()=>update(key,id)} style={{minHeight:34,padding:'6px 10px',borderRadius:10,border:value[key]===id?'2px solid #63317D':'1px solid #E2D5E8',background:value[key]===id?'#F2E7F8':'white',color:'#4C3358',fontSize:12,cursor:'pointer'}}><span style={{display:'inline-block',verticalAlign:'middle',width:15,height:15,borderRadius:'50%',background:id,marginRight:5,border:'1px solid #0002'}}/>{label}</button>)}</div></fieldset>)}
      {error&&<p role="alert" style={{fontSize:12,color:'#A34D44'}}>{error}</p>}
      <div style={{display:'flex',gap:8,marginTop:18}}><button type="button" disabled={saving} onClick={onBack} style={{flex:1,minHeight:42,border:0,borderRadius:11,background:'#F0E7F4',color:'#63317D',fontWeight:700}}>Back</button><button type="button" disabled={saving} onClick={save} style={{flex:2,minHeight:42,border:0,borderRadius:11,background:'#63317D',color:'white',fontWeight:750}}>{saving?'Saving…':'Save character'}</button></div>
    </section>
  </main>;
}
