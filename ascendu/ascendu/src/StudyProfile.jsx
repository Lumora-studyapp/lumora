import {useEffect,useMemo,useRef,useState} from "react";
import {auth,db,storage} from "./firebase.js";
import {doc,getDoc,getDocFromServer,setDoc} from "firebase/firestore";
import {ref,uploadBytesResumable,deleteObject,getBlob} from "firebase/storage";
import {studyRecords} from "./studyProfileRecords.js";
import {CharacterPortrait,PORTRAIT_BACKGROUND} from "./CharacterAvatar.jsx";

const SECTIONS=["highlights","records","badges"];
const DEFAULT_PROFILE={bio:"",accent:"#63317D",background:"#F8F3FC",text:"#271535",title:"",pinned:[],sections:SECTIONS,photo:false,banner:false};
const PROFILE_PALETTES=[
  {name:"Lumora",accent:"#63317D",background:"#F8F3FC",text:"#271535"},
  {name:"Ocean",accent:"#1D5F78",background:"#F0FAFC",text:"#153442"},
  {name:"Evergreen",accent:"#246A4B",background:"#F4FBF6",text:"#173527"},
  {name:"Sunset",accent:"#9B3E50",background:"#FFF6F2",text:"#48212A"},
  {name:"Midnight",accent:"#374B98",background:"#F4F6FF",text:"#1D274A"},
  {name:"Amber",accent:"#855400",background:"#FFF9EC",text:"#3E2A11"},
];
const SECTION_INFO={highlights:{label:"Highlights",icon:"✦"},records:{label:"Personal records",icon:"▦"},badges:{label:"Achievements",icon:"🏅"}};
const imagePath=(username,kind)=>"study_profiles/"+username+"/"+kind+".webp";
const safeUser=username=>String(username||"").trim().normalize("NFC").toLowerCase();
const validHex=value=>/^#[0-9a-fA-F]{6}$/.test(value);
const profileRef=username=>doc(db,"study_profiles",safeUser(username));
const boundedRequest=(request,label)=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error(label+" is taking too long. Check your connection and try again.")),15000);
  Promise.resolve(request).then(resolve,reject).finally(()=>clearTimeout(timer));
});
const profileError=error=>error.code==="permission-denied"
  ? "Firebase denied access to this profile. Lumora's profile rules or account permissions need updating. Your changes have not been confirmed saved."
  : error.message||"Could not save profile. Please try again.";
async function persistProfile(username,data){
  await boundedRequest(setDoc(profileRef(username),data),"Saving your profile");
  const saved=await boundedRequest(getDocFromServer(profileRef(username)),"Confirming your profile");
  if(!saved.exists()||saved.data().updatedAt!==data.updatedAt)throw new Error("Could not confirm your profile was saved. Please try again.");
}
function uploadProfileImage(username,kind,blob){
  return new Promise((resolve,reject)=>{
    const task=uploadBytesResumable(ref(storage,imagePath(safeUser(username),kind)),blob,{contentType:"image/webp"});
    const timer=setTimeout(()=>{task.cancel();reject(new Error("Your profile settings were saved, but the image upload could not finish. Lumora's image storage is unavailable. Please try again once storage is configured."));},15000);
    task.then(result=>{clearTimeout(timer);resolve(result);},error=>{clearTimeout(timer);reject(new Error("Your profile settings were saved, but the image could not be uploaded ("+error.code+"). Please check Lumora's image storage."));});
  });
}

export async function loadStudyProfile(username){
  const snap=await boundedRequest(getDoc(profileRef(username)),"Loading your profile");
  return snap.exists()?{...DEFAULT_PROFILE,...snap.data()}:DEFAULT_PROFILE;
}

async function imageObjectUrl(username,kind){
  const blob=await boundedRequest(getBlob(ref(storage,imagePath(safeUser(username),kind))),"Loading profile image");
  const url=URL.createObjectURL(blob);
  try{const image=new Image();image.src=url;await boundedRequest(image.decode(),"Preparing profile image");return url;}
  catch(error){URL.revokeObjectURL(url);throw error;}
}

export function ProfileAvatar({username,allow=false,size=38,style={},avatar=null,skinId=null}){
  const identity=safeUser(username);
  const [appearance,setAppearance]=useState(null);
  useEffect(()=>{
    if(!allow||!identity)return;
    let alive=true,objectUrl="",revision=0;
    const refresh=async()=>{
      const request=++revision;
      let nextUrl="";
      try{
        const profile=await loadStudyProfile(identity);
        let character=null;
        if(profile.photo)nextUrl=await imageObjectUrl(identity,"photo");
        else if(!skinId&&!avatar){
          const snap=await boundedRequest(getDoc(doc(db,"prefs",identity)),"Loading character");
          character=snap.exists()?snap.data():{};
        }
        if(!alive||request!==revision){if(nextUrl)URL.revokeObjectURL(nextUrl);return;}
        if(objectUrl)URL.revokeObjectURL(objectUrl);
        objectUrl=nextUrl;
        setAppearance({identity,url:nextUrl,character});
      }catch{
        if(nextUrl)URL.revokeObjectURL(nextUrl);
        // An unavailable custom image must not become a default portrait.
        if(alive&&request===revision)setAppearance(null);
      }
    };
    const onUpdate=event=>{if(safeUser(event.detail)===identity)refresh();};
    refresh();window.addEventListener("lumora-profile-updated",onUpdate);window.addEventListener("lumora-character-updated",onUpdate);
    return()=>{alive=false;window.removeEventListener("lumora-profile-updated",onUpdate);window.removeEventListener("lumora-character-updated",onUpdate);if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[identity,allow,skinId,avatar]);
  const ready=allow&&appearance?.identity===identity;
  return <span aria-busy={!ready} style={{width:size,height:size,borderRadius:"50%",display:"inline-grid",placeItems:"center",overflow:"hidden",flexShrink:0,background:"var(--sg-theme-control-track,#EAE5ED)",color:"var(--sg-theme-muted,#817287)",fontWeight:800,...style}}>
    {ready?(appearance.url?<img src={appearance.url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<CharacterPortrait key={identity} skinId={skinId||appearance.character?.activeSkin} value={avatar||appearance.character?.characterAvatar} size={size}/>):<span aria-hidden="true" style={{width:"42%",height:"42%",borderRadius:"50%",background:"currentColor",opacity:.15}}/>}
  </span>;
}

function contrastRatio(hexA,hexB){
  const luminance=hex=>{
    const rgb=[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)/255)
      .map(value=>value<=.04045?value/12.92:Math.pow((value+.055)/1.055,2.4));
    return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
  };
  const values=[luminance(hexA),luminance(hexB)].sort((a,b)=>b-a);
  return (values[0]+.05)/(values[1]+.05);
}

async function croppedWebp(file,kind,zoom,x,y){
  if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("Choose a JPG, PNG, or WebP image.");
  if(file.size>8*1024*1024)throw new Error("Choose an image smaller than 8 MB.");
  const bitmap=await createImageBitmap(file);
  const width=kind==="photo"?512:1200,height=kind==="photo"?512:400;
  const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
  const context=canvas.getContext("2d");
  const scale=Math.max(width/bitmap.width,height/bitmap.height)*zoom;
  const drawnWidth=bitmap.width*scale,drawnHeight=bitmap.height*scale;
  const left=(width-drawnWidth)*(x/100),top=(height-drawnHeight)*(y/100);
  context.drawImage(bitmap,left,top,drawnWidth,drawnHeight);
  bitmap.close();
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Could not prepare image.")),"image/webp",.88));
}

const baseButton={border:0,borderRadius:10,padding:"9px 13px",fontWeight:750,cursor:"pointer"};
const inputStyle={width:"100%",boxSizing:"border-box",padding:"9px 10px",border:"1px solid #DCCCE9",borderRadius:10,font:"inherit"};
const sectionTitle={margin:"0 0 9px",fontSize:12,letterSpacing:".02em",color:"#493D50"};
const softCard={background:"rgba(255,255,255,.78)",border:"1px solid rgba(88,55,104,.1)",borderRadius:16};

function ImagePicker({kind,file,onPick}){
  const photo=kind==="photo";
  const id="study-profile-"+kind;
  const title=photo?"Profile photo":"Profile banner";
  const helper=photo?"A square photo works best.":"A wide image works best.";
  return <div style={{...softCard,padding:"13px 14px",display:"flex",alignItems:"center",gap:12}}>
    <div aria-hidden="true" style={{width:38,height:38,borderRadius:12,display:"grid",placeItems:"center",background:"#F0E5F7",fontSize:18}}>{photo?"◉":"▧"}</div>
    <div style={{minWidth:0,flex:1}}>
      <strong style={{display:"block",fontSize:13,color:"#34203D"}}>{title}</strong>
      <span style={{display:"block",marginTop:2,fontSize:11,color:"#706477"}}>{file?file.name:helper} JPG, PNG or WebP · 8 MB max</span>
    </div>
    <input id={id} type="file" accept="image/png,image/jpeg,image/webp" onChange={event=>onPick(event.target.files?.[0]||null)} style={{position:"absolute",width:1,height:1,opacity:0,pointerEvents:"none"}}/>
    <label htmlFor={id} style={{...baseButton,display:"inline-flex",alignItems:"center",minHeight:38,boxSizing:"border-box",background:"#F2E9F7",border:"1px solid #D5B8E6",color:"#603177",fontSize:12,whiteSpace:"nowrap"}}>{file?"Change":"Upload"}</label>
  </div>;
}

function CropEditor({kind,file,crop,onChange,onClose}){
  const photo=kind==="photo";
  const frameRef=useRef(null),pointersRef=useRef(new Map()),gestureRef=useRef(null);
  const [image,setImage]=useState({src:"",width:0,height:0});
  const [frame,setFrame]=useState({width:0,height:0});
  useEffect(()=>{
    const src=URL.createObjectURL(file);setImage({src,width:0,height:0});
    return()=>URL.revokeObjectURL(src);
  },[file]);
  useEffect(()=>{
    const node=frameRef.current;if(!node)return undefined;
    const update=()=>setFrame({width:node.clientWidth,height:node.clientHeight});
    update();const observer=new ResizeObserver(update);observer.observe(node);
    return()=>observer.disconnect();
  },[]);
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  const size=image.width&&frame.width?(()=>{
    const scale=Math.max(frame.width/image.width,frame.height/image.height)*crop.zoom;
    return {width:image.width*scale,height:image.height*scale};
  })():null;
  const setZoom=next=>onChange(current=>({...current,zoom:clamp(next,1,2.5)}));
  const distance=points=>Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);
  const startDrag=event=>{
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
    const points=[...pointersRef.current.values()];
    gestureRef.current=points.length===1?{type:"drag",x:event.clientX,y:event.clientY,crop}:{type:"pinch",distance:distance(points),zoom:crop.zoom};
  };
  const moveImage=event=>{
    if(!pointersRef.current.has(event.pointerId))return;
    pointersRef.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
    const points=[...pointersRef.current.values()],gesture=gestureRef.current;
    if(points.length>1&&gesture?.type==="pinch"){setZoom(gesture.zoom*(distance(points)/gesture.distance));return;}
    if(!size||gesture?.type!=="drag")return;
    const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
    const x=size.width>frame.width?clamp(gesture.crop.x+(dx/(frame.width-size.width))*100,0,100):50;
    const y=size.height>frame.height?clamp(gesture.crop.y+(dy/(frame.height-size.height))*100,0,100):50;
    onChange({...gesture.crop,x,y});
  };
  const endGesture=event=>{
    pointersRef.current.delete(event.pointerId);
    const points=[...pointersRef.current.values()];
    gestureRef.current=points.length===1?{type:"drag",x:points[0].x,y:points[0].y,crop}:null;
  };
  return <div role="presentation" className="sg-overlay-anim" style={{position:"fixed",inset:0,zIndex:430,background:"rgba(19,9,31,.72)",display:"grid",placeItems:"center",padding:14}}>
    <div role="dialog" aria-modal="true" aria-label={photo?"Crop profile photo":"Crop profile banner"} className="sg-pop-anim" style={{width:"min(100%,410px)",maxHeight:"calc(100dvh - 28px)",overflowY:"auto",borderRadius:22,background:"#FCFAFD",boxShadow:"0 26px 80px rgba(18,7,31,.44)",padding:18}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}><div><div style={{fontSize:10,fontWeight:850,letterSpacing:".1em",color:"#63317D"}}>IMAGE POSITION</div><h3 style={{margin:"4px 0 0",fontSize:19,color:"#34203D"}}>{photo?"Profile photo":"Profile banner"}</h3><p style={{margin:"5px 0 0",fontSize:11.5,lineHeight:1.45,color:"#706477"}}>Drag to align. Pinch with two fingers or use the controls to zoom.</p></div><button onClick={onClose} aria-label="Close crop editor" style={{...baseButton,width:34,height:34,padding:0,background:"#F0E5F7",color:"#63317D",fontSize:16}}>×</button></div>
      <div ref={frameRef} onPointerDown={startDrag} onPointerMove={moveImage} onPointerUp={endGesture} onPointerCancel={endGesture} onWheel={event=>{event.preventDefault();setZoom(crop.zoom+(event.deltaY<0 ? .08 : -.08));}} style={{position:"relative",width:"100%",aspectRatio:photo?"1 / 1":"3 / 1",marginTop:18,borderRadius:photo?"50%":14,overflow:"hidden",background:"#EAE1EF",touchAction:"none",userSelect:"none",cursor:"grab",boxShadow:"inset 0 0 0 2px rgba(255,255,255,.7),0 8px 22px rgba(42,22,52,.14)"}}>
        {image.src&&<img src={image.src} alt="" draggable="false" onLoad={event=>{const {naturalWidth:width,naturalHeight:height}=event.currentTarget;setImage(current=>({...current,width,height}));}} style={size?{position:"absolute",width:size.width,height:size.height,left:(frame.width-size.width)*(crop.x/100),top:(frame.height-size.height)*(crop.y/100),maxWidth:"none",pointerEvents:"none"}:{position:"absolute",width:"100%",height:"100%",objectFit:"cover",pointerEvents:"none"}}/>}
        {!photo&&<><div aria-hidden="true" style={{position:"absolute",inset:0,border:"2px solid rgba(255,255,255,.86)",borderRadius:14,pointerEvents:"none"}}/><span style={{position:"absolute",left:12,bottom:10,padding:"5px 8px",borderRadius:8,background:"rgba(24,10,35,.62)",color:"#fff",fontSize:10,fontWeight:750,pointerEvents:"none"}}>Profile banner preview</span></>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"40px 1fr 40px",alignItems:"center",gap:10,marginTop:16}}><button onClick={()=>setZoom(crop.zoom-.1)} aria-label="Zoom out" style={{...baseButton,width:40,height:40,padding:0,background:"#F0E5F7",color:"#63317D",fontSize:19}}>−</button><input aria-label="Crop zoom" type="range" min="1" max="2.5" step=".01" value={crop.zoom} onChange={event=>setZoom(Number(event.target.value))} style={{width:"100%",accentColor:"#63317D"}}/><button onClick={()=>setZoom(crop.zoom+.1)} aria-label="Zoom in" style={{...baseButton,width:40,height:40,padding:0,background:"#63317D",color:"#fff",fontSize:19}}>＋</button></div>
      <div style={{display:"flex",gap:9,marginTop:18}}><button onClick={()=>onChange({zoom:1,x:50,y:50})} style={{...baseButton,flex:1,background:"#F0E5F7",color:"#63317D"}}>Reset</button><button onClick={onClose} style={{...baseButton,flex:1,background:"#63317D",color:"#fff"}}>Use this crop</button></div>
    </div>
  </div>;
}

export default function StudyProfile({username,currentUser,avatar=null,skinId=null,badges=[],badgeCatalog=[],history=[],openAchievementGallery=false,onClose}){
  const owner=safeUser(username)===safeUser(currentUser);
  const [profile,setProfile]=useState(DEFAULT_PROFILE);
  const [character,setCharacter]=useState(null);
  const [earned,setEarned]=useState(badges);
  const [sessions,setSessions]=useState(history);
  const [photoUrl,setPhotoUrl]=useState("");
  const [bannerUrl,setBannerUrl]=useState("");
  const [pendingPhoto,setPendingPhoto]=useState(null);
  const [pendingBanner,setPendingBanner]=useState(null);
  const [photoPreview,setPhotoPreview]=useState("");
  const [bannerPreview,setBannerPreview]=useState("");
  const [photoCrop,setPhotoCrop]=useState({zoom:1,x:50,y:50});
  const [bannerCrop,setBannerCrop]=useState({zoom:1,x:50,y:50});
  const [croppingKind,setCroppingKind]=useState(null);
  const [editing,setEditing]=useState(false);
  const [editorClosing,setEditorClosing]=useState(false);
  const [loading,setLoading]=useState(true);
  const [loadedUser,setLoadedUser]=useState("");
  const [loadAttempt,setLoadAttempt]=useState(0);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [showAchievementGallery,setShowAchievementGallery]=useState(false);
  const [showCustomColours,setShowCustomColours]=useState(false);
  const records=useMemo(()=>studyRecords(sessions),[sessions]);
  const earnedBadges=badgeCatalog.filter(badge=>earned.includes(badge.id));
  useEffect(()=>{
    if(!pendingPhoto){setPhotoPreview("");return;}
    const url=URL.createObjectURL(pendingPhoto);setPhotoPreview(url);
    return()=>URL.revokeObjectURL(url);
  },[pendingPhoto]);
  useEffect(()=>{
    if(!pendingBanner){setBannerPreview("");return;}
    const url=URL.createObjectURL(pendingBanner);setBannerPreview(url);
    return()=>URL.revokeObjectURL(url);
  },[pendingBanner]);
  useEffect(()=>{
    let live=true,urls=[];
    setLoading(true);setError("");setLoadedUser("");
    (async()=>{
      try{
        const next=await loadStudyProfile(username);
        const rememberImage=async kind=>{
          const url=await imageObjectUrl(username,kind);
          if(!live){URL.revokeObjectURL(url);return "";}
          urls.push(url);return url;
        };
        const [prefsSnap,histSnap,photo,banner]=await Promise.all([
          owner?null:boundedRequest(getDoc(doc(db,"prefs",safeUser(username))),"Loading character"),
          owner?null:boundedRequest(getDoc(doc(db,"history",safeUser(username))),"Loading study history"),
          next.photo?rememberImage("photo"):"",
          next.banner?rememberImage("banner"):"",
        ]);
        if(!live)return;
        setProfile(next);setPhotoUrl(photo);setBannerUrl(banner);
        setCharacter(prefsSnap?.exists()?prefsSnap.data():null);
        setEarned(owner?badges:(prefsSnap?.data()?.badges||[]));
        setSessions(owner?history:(histSnap?.data()?.sessions||[]));
        setLoadedUser(safeUser(username));
      }catch(e){
        // Keep failed loads separate from a confirmed, uncustomised profile.
        if(live)setError(profileError(e));
      }
      finally{if(live)setLoading(false);}
    })();
    return()=>{live=false;urls.forEach(URL.revokeObjectURL);};
  },[username,owner,loadAttempt]);
  useEffect(()=>{
    if(openAchievementGallery&&owner){setEditing(true);setShowAchievementGallery(true);}
  },[openAchievementGallery,owner]);
  const update=(key,value)=>setProfile(current=>({...current,[key]:value}));
  const applyPalette=palette=>{
    setError("");
    setProfile(current=>({...current,accent:palette.accent,background:palette.background,text:palette.text}));
  };
  const chooseImage=(kind,file)=>{
    setError("");
    if(!file)return;
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)){setError("Choose a JPG, PNG, or WebP image.");return;}
    if(file.size>8*1024*1024){setError("Choose an image smaller than 8 MB.");return;}
    if(kind==="photo"){setPendingPhoto(file);setPhotoCrop({zoom:1,x:50,y:50});}
    else{setPendingBanner(file);setBannerCrop({zoom:1,x:50,y:50});}
    setCroppingKind(kind);
  };
  const togglePin=id=>{
    if(profile.pinned.includes(id)){update("pinned",profile.pinned.filter(item=>item!==id));return;}
    if(profile.pinned.length>=5){setError("Choose up to five achievements for your showcase.");return;}
    update("pinned",[...profile.pinned,id]);
  };
  const moveSection=(id,direction)=>{
    const sections=[...profile.sections],index=sections.indexOf(id),target=index+direction;
    if(target<0||target>=sections.length)return;
    [sections[index],sections[target]]=[sections[target],sections[index]];
    update("sections",sections);
  };
  const save=async()=>{
    if(busy)return;
    setError("");setMessage("");
    if(!validHex(profile.accent)||!validHex(profile.background)||!validHex(profile.text)
      ||contrastRatio(profile.background,profile.text)<4.5
      ||contrastRatio(profile.accent,"#FFFFFF")<4.5
      ||contrastRatio(profile.accent,profile.background)<3){
      setError("Choose profile colors with readable text contrast.");return;
    }
    setBusy(true);
    try{
      if(!owner||!auth.currentUser)throw new Error("Please sign in again before saving your profile.");
      const clean={ownerUid:auth.currentUser.uid,bio:profile.bio.trim().slice(0,160),accent:profile.accent,background:profile.background,text:profile.text,
        title:earned.includes(profile.title)?profile.title:"",pinned:profile.pinned.filter(id=>earned.includes(id)).slice(0,5),
        sections:profile.sections.filter(id=>SECTIONS.includes(id)),photo:!!profile.photo,banner:!!profile.banner,updatedAt:Date.now()};
      await persistProfile(username,clean);
      const photo=pendingPhoto?await croppedWebp(pendingPhoto,"photo",photoCrop.zoom,photoCrop.x,photoCrop.y):null;
      const banner=pendingBanner?await croppedWebp(pendingBanner,"banner",bannerCrop.zoom,bannerCrop.x,bannerCrop.y):null;
      if(photo)await uploadProfileImage(username,"photo",photo);
      if(banner)await uploadProfileImage(username,"banner",banner);
      if(photo||banner){clean.photo=clean.photo||!!photo;clean.banner=clean.banner||!!banner;clean.updatedAt=Date.now();await persistProfile(username,clean);}
      setProfile(clean);setEditorClosing(true);setShowAchievementGallery(false);setPendingPhoto(null);setPendingBanner(null);setMessage("Profile saved.");
      window.setTimeout(()=>{setEditing(false);setEditorClosing(false);},240);
      if(photo){if(photoUrl)URL.revokeObjectURL(photoUrl);setPhotoUrl(URL.createObjectURL(photo));}
      if(banner){if(bannerUrl)URL.revokeObjectURL(bannerUrl);setBannerUrl(URL.createObjectURL(banner));}
      window.dispatchEvent(new CustomEvent("lumora-profile-updated",{detail:username}));
    }catch(e){setError(profileError(e));}
    finally{setBusy(false);}
  };
  const removeImage=async kind=>{
    setBusy(true);setError("");
    try{
      const next={...profile,[kind]:false,ownerUid:auth.currentUser.uid};
      await deleteObject(ref(storage,imagePath(username,kind))).catch(error=>{
        if(error.code!=="storage/object-not-found")throw error;
      });
      await setDoc(profileRef(username),next);
      setProfile(next);
      if(kind==="photo"){if(photoUrl)URL.revokeObjectURL(photoUrl);setPhotoUrl("");setPendingPhoto(null);}
      else{if(bannerUrl)URL.revokeObjectURL(bannerUrl);setBannerUrl("");setPendingBanner(null);}
      window.dispatchEvent(new CustomEvent("lumora-profile-updated",{detail:username}));
    }catch(e){setError("Could not remove image.");}finally{setBusy(false);}
  };
  const section=id=>{
    if(id==="highlights")return <section><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:9}}><h3 style={{...sectionTitle,margin:0}}>Highlights</h3>{owner&&<button onClick={()=>{setEditing(true);setShowAchievementGallery(true);}} style={{...baseButton,padding:"7px 10px",background:"#F2E9F7",border:"1px solid #D5B8E6",color:profile.accent,fontSize:11}}>＋ Add achievements</button>}</div><div style={{...softCard,padding:profile.pinned.length?"10px":"15px",display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>{profile.pinned.map(badgeId=>{
      const badge=earnedBadges.find(item=>item.id===badgeId);
      return badge?<span key={badge.id} style={{padding:"8px 10px",borderRadius:10,background:"#EFE2F7",fontSize:12,fontWeight:750}}>{badge.emoji} {badge.name}</span>:null;
    })}{!profile.pinned.length&&<><span style={{fontSize:20}}>✦</span><span style={{fontSize:12,color:"#675B6C"}}>Choose achievements to add to your profile showcase.</span></>}</div></section>;
    if(id==="records")return <section><h3 style={sectionTitle}>Personal records</h3><div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:9}}>{records.map(record=><div key={record.label} style={{...softCard,padding:"11px 12px"}}><div style={{fontSize:15,fontWeight:800,color:"#2D2034"}}>{record.icon} {record.value}</div><small style={{display:"block",marginTop:3,color:"#766C7B",fontSize:10}}>{record.label}</small></div>)}</div></section>;
    return <section><h3 style={sectionTitle}>Earned achievements</h3><div style={{...softCard,padding:earnedBadges.length?"10px":"15px",display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>{earnedBadges.map(badge=><span key={badge.id} title={badge.desc} style={{padding:"8px 10px",borderRadius:10,background:"#fff",fontSize:12,fontWeight:700}}>{badge.emoji} {badge.name}</span>)}{!earnedBadges.length&&<><span style={{fontSize:20}}>🏅</span><span style={{fontSize:12,color:"#675B6C"}}>Your achievements will collect here as you study.</span></>}</div></section>;
  };
  if(loading||loadedUser!==safeUser(username))return <div role="presentation" className="sg-overlay-anim sg-profile-overlay" onClick={event=>{if(event.target===event.currentTarget)onClose();}} style={{position:"fixed",inset:0,zIndex:390,background:"rgba(19,9,31,.65)",display:"grid",placeItems:"center",padding:12}}>
    <div role="dialog" aria-modal="true" aria-label={username+"'s Study Profile"} aria-busy={loading} style={{position:"relative",width:"min(100%,560px)",borderRadius:24,overflow:"hidden",background:"var(--sg-theme-panel-solid,var(--sg-theme-neutral,#F5F2F6))",color:"var(--sg-theme-text,#493D50)"}}>
      <button onClick={onClose} aria-label="Close profile" style={{...baseButton,position:"absolute",right:14,top:14,zIndex:1}}>✕</button>
      <div aria-hidden="true" style={{height:168,background:"var(--sg-theme-control-track,#EAE5ED)"}}/>
      <div style={{padding:"0 22px 28px"}}><div aria-hidden="true" style={{position:"relative",marginTop:-42,width:82,height:82,borderRadius:"50%",background:"var(--sg-theme-border,#DCD5E0)"}}/>
        <h2 style={{fontSize:23,margin:"13px 0"}}>{username}</h2>
        <p role={error?"alert":"status"} style={{fontSize:13}}>{error?"This study profile could not be loaded. Please try again.":"Loading profile…"}</p>
        {error&&<button onClick={()=>setLoadAttempt(value=>value+1)} style={{...baseButton,marginTop:12}}>Retry</button>}
      </div>
    </div>
  </div>;
  return <div role="presentation" className="sg-overlay-anim sg-profile-overlay" onClick={event=>{if(event.target===event.currentTarget)onClose();}} style={{position:"fixed",inset:0,zIndex:390,background:"rgba(19,9,31,.65)",display:"grid",placeItems:"center",padding:12}}>
    <div role="dialog" className="sg-pop-anim sg-profile-dialog" aria-modal="true" aria-label={username+"'s Study Profile"} style={{width:"min(100%,560px)",maxHeight:"92dvh",overflowY:"auto",borderRadius:24,background:profile.background,color:profile.text,boxShadow:"0 24px 72px #16072666"}}>
      <div style={{height:168,background:bannerUrl?"url("+bannerUrl+") center/cover": "linear-gradient(125deg,"+profile.accent+",#B98BD3)",position:"relative",overflow:"hidden"}}>
        {bannerPreview&&<img src={bannerPreview} alt="" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:bannerCrop.x+"% "+bannerCrop.y+"%",transform:"scale("+bannerCrop.zoom+")"}}/>}
        <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(18,9,32,.06),rgba(18,9,32,.18))",pointerEvents:"none"}}/>
        <button onClick={onClose} aria-label="Close profile" style={{...baseButton,position:"absolute",right:14,top:14,background:"rgba(255,255,255,.94)",width:34,height:34,padding:0,fontSize:16}}>✕</button>
      </div>
      <div style={{padding:"0 22px 28px"}}>
        <div style={{marginTop:-42,position:"relative",width:82,height:82,border:0,borderRadius:"50%",overflow:"hidden",background:PORTRAIT_BACKGROUND,color:"#fff",display:"grid",placeItems:"center",fontSize:30,fontWeight:800}}>
          {(photoPreview||photoUrl)?<img src={photoPreview||photoUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:photoCrop.x+"% "+photoCrop.y+"%",transform:photoPreview?"scale("+photoCrop.zoom+")":undefined}}/>:<CharacterPortrait skinId={skinId||character?.activeSkin} value={avatar||character?.characterAvatar} size={82}/>}
        </div>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:14,marginTop:13}}>
          <div style={{minWidth:0}}>
            <div style={{fontSize:10,fontWeight:850,letterSpacing:".11em",color:profile.accent,textTransform:"uppercase"}}>Study profile</div>
            <h2 style={{margin:"3px 0 0",fontSize:23,lineHeight:1.12,overflowWrap:"anywhere"}}>{username}</h2>
            {profile.title&&<div style={{marginTop:6,color:profile.accent,fontSize:12,fontWeight:800}}>{earnedBadges.find(badge=>badge.id===profile.title)?.emoji} {earnedBadges.find(badge=>badge.id===profile.title)?.name}</div>}
          </div>
          {owner&&<button style={{...baseButton,background:profile.accent,color:"#fff",minHeight:40,padding:"10px 15px",whiteSpace:"nowrap",marginTop:5}} onClick={()=>{if(editing)setShowAchievementGallery(false);setEditing(open=>!open);}}>{editing?"Done":"Edit profile"}</button>}
        </div>
        {profile.bio&&<p style={{whiteSpace:"pre-wrap",margin:"12px 0 0",fontSize:13,lineHeight:1.5,color:"#584E5D"}}>{profile.bio}</p>}
        {loading?<p style={{padding:"24px 0",color:"#6D6273"}}>Loading profile…</p>:error&&!owner?<div role="alert" style={{...softCard,padding:16,textAlign:"center",marginTop:18}}><div style={{fontSize:22}}>◌</div><strong style={{display:"block",marginTop:5}}>Profile unavailable</strong><span style={{display:"block",fontSize:12,color:"#6B606F",marginTop:4}}>This study profile cannot be shown right now.</span></div>:<>
          {editing&&<div style={{display:"grid",gap:14,background:"linear-gradient(180deg,#FFFFFF,#FCFAFD)",border:"1px solid rgba(88,55,104,.12)",padding:18,borderRadius:18,margin:"18px 0 4px",opacity:editorClosing?0:1,transform:editorClosing?"translateY(-8px) scale(.98)":"none",transition:"opacity 240ms ease, transform 240ms ease",pointerEvents:editorClosing?"none":"auto"}}>
            <div><strong style={{fontSize:14,color:"#34203D"}}>Personalise your profile</strong><span style={{display:"block",marginTop:3,fontSize:11.5,color:"#72667A"}}>Add a short introduction, then choose the achievements you want to show.</span></div>
            <label style={{fontSize:12,fontWeight:750,color:"#493D50"}}>Study bio<textarea aria-label="Study bio" maxLength={160} value={profile.bio} onChange={e=>update("bio",e.target.value)} style={{...inputStyle,display:"block",marginTop:6,minHeight:70,resize:"vertical"}}/></label>
            <ImagePicker kind="photo" file={pendingPhoto} onPick={file=>chooseImage("photo",file)}/>
            {pendingPhoto&&<button onClick={()=>setCroppingKind("photo")} style={{...baseButton,justifySelf:"start",padding:"7px 10px",background:"#F2E9F7",border:"1px solid #D5B8E6",color:profile.accent,fontSize:11}}>Adjust profile photo crop</button>}
            {profile.photo&&<button onClick={()=>removeImage("photo")} disabled={busy} style={baseButton}>Remove photo</button>}
            <ImagePicker kind="banner" file={pendingBanner} onPick={file=>chooseImage("banner",file)}/>
            {pendingBanner&&<button onClick={()=>setCroppingKind("banner")} style={{...baseButton,justifySelf:"start",padding:"7px 10px",background:"#F2E9F7",border:"1px solid #D5B8E6",color:profile.accent,fontSize:11}}>Adjust profile banner crop</button>}
            {profile.banner&&<button onClick={()=>removeImage("banner")} disabled={busy} style={baseButton}>Remove banner</button>}
            <div style={{...softCard,padding:14}}><div><strong style={{fontSize:13,color:"#34203D"}}>Colour scheme</strong><span style={{display:"block",marginTop:3,fontSize:11,color:"#706477"}}>Pick a ready-made theme with readable contrast.</span></div><div role="radiogroup" aria-label="Profile colour scheme" style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,marginTop:12}}>{PROFILE_PALETTES.map(palette=>{const selected=["accent","background","text"].every(key=>profile[key].toLowerCase()===palette[key]);return <button key={palette.name} role="radio" aria-checked={selected} onClick={()=>applyPalette(palette)} style={{...baseButton,minHeight:62,padding:"9px 10px",display:"grid",gridTemplateColumns:"28px 1fr auto",gap:8,alignItems:"center",textAlign:"left",background:palette.background,color:palette.text,border:"2px solid "+(selected?palette.accent:"transparent"),boxShadow:selected?"0 0 0 2px rgba(99,49,125,.13)":"inset 0 0 0 1px rgba(57,38,66,.11)"}}><span aria-hidden="true" style={{width:28,height:28,borderRadius:9,display:"grid",placeItems:"center",background:palette.accent,color:"#fff",fontSize:12,fontWeight:850}}>Aa</span><span style={{fontSize:12,fontWeight:800}}>{palette.name}</span>{selected&&<span aria-hidden="true" style={{color:palette.accent,fontSize:15}}>✓</span>}</button>;})}</div><button onClick={()=>setShowCustomColours(open=>!open)} aria-expanded={showCustomColours} style={{...baseButton,padding:"8px 0 0",background:"transparent",color:profile.accent,fontSize:11}}>{showCustomColours?"Hide custom colours":"Fine tune colours"}</button>{showCustomColours&&<div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8,marginTop:10}}>{[["Accent","accent"],["Background","background"],["Text","text"]].map(([label,key])=><label key={key} style={{...softCard,padding:"8px",display:"grid",gap:5,textAlign:"center",fontSize:10,fontWeight:750,color:"#584B60"}}>{label}<input aria-label={label+" colour"} type="color" value={profile[key]} onChange={e=>update(key,e.target.value)} style={{width:"100%",height:34,padding:2,border:0,borderRadius:8,background:"transparent",cursor:"pointer"}}/></label>)}</div>}</div>
            <label style={{fontSize:12,fontWeight:750,color:"#493D50"}}>Earned title<select value={profile.title} onChange={e=>update("title",e.target.value)} style={{...inputStyle,display:"block",marginTop:6}}><option value="">None</option>{earnedBadges.map(badge=><option key={badge.id} value={badge.id}>{badge.name}</option>)}</select></label>
            <div style={{...softCard,padding:14}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}><div><strong style={{fontSize:13,color:"#34203D"}}>Achievement showcase</strong><span style={{display:"block",marginTop:3,fontSize:11,color:"#706477"}}>Choose up to five earned achievements for your profile.</span></div><button onClick={()=>setShowAchievementGallery(open=>!open)} aria-expanded={showAchievementGallery} style={{...baseButton,padding:"8px 11px",background:profile.accent,color:"#fff",fontSize:11,whiteSpace:"nowrap"}}>{showAchievementGallery?"Hide achievements":"＋ Add achievements"}</button></div>{showAchievementGallery&&<div style={{marginTop:13}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:9}}><strong style={{fontSize:11,color:"#493D50"}}>All achievements</strong><span style={{fontSize:10.5,color:"#706477"}}>{profile.pinned.length}/5 displayed</span></div><div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>{badgeCatalog.map(achievement=>{const unlocked=earned.includes(achievement.id),added=profile.pinned.includes(achievement.id);return <div key={achievement.id} style={{minHeight:116,padding:"10px",borderRadius:12,background:unlocked?"#fff":"#F4F1F5",border:"1px solid "+(added?profile.accent:"#E5DCE9"),opacity:unlocked?1:.72}}><div style={{display:"flex",gap:7,alignItems:"flex-start"}}><span aria-hidden="true" style={{fontSize:20,filter:unlocked?"none":"grayscale(1)"}}>{unlocked?achievement.emoji:"🔒"}</span><div style={{minWidth:0}}><strong style={{display:"block",fontSize:11.5,lineHeight:1.2,color:unlocked?"#3B2A44":"#7F7485"}}>{achievement.name}</strong><span style={{display:"block",marginTop:3,fontSize:9.5,lineHeight:1.3,color:"#786D7E"}}>{achievement.desc}</span></div></div>{unlocked?<button onClick={()=>togglePin(achievement.id)} aria-pressed={added} style={{...baseButton,width:"100%",marginTop:9,padding:"7px 8px",background:added?"#E8D5F3":"#F2E9F7",border:"1px solid "+(added?profile.accent:"#D5B8E6"),color:profile.accent,fontSize:10.5}}>{added?"✓ Added to profile":"＋ Add to profile"}</button>:<div style={{marginTop:9,fontSize:10,fontWeight:750,color:"#8A7D90"}}>🔒 Locked</div>}</div>;})}</div></div>}</div>
            <div style={{...softCard,padding:14}}><strong style={{fontSize:13,color:"#34203D"}}>Profile layout</strong><span style={{display:"block",marginTop:3,fontSize:11,color:"#706477"}}>Arrange what visitors see first.</span><div style={{display:"grid",gap:8,marginTop:12}}>{profile.sections.map((id,index)=>{const info=SECTION_INFO[id]||{label:id,icon:"•"};const moveStyle=disabled=>({...baseButton,width:34,height:34,padding:0,display:"grid",placeItems:"center",background:disabled?"#F5F1F7":"#F0E5F7",color:disabled?"#B8ADBF":profile.accent,opacity:disabled?0.7:1,cursor:disabled?"not-allowed":"pointer"});return <div key={id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 8px 8px 10px",borderRadius:12,background:"#fff",border:"1px solid #E6DCEB"}}><span aria-hidden="true" style={{width:24,height:24,borderRadius:"50%",display:"grid",placeItems:"center",background:"#F0E5F7",color:profile.accent,fontSize:11,fontWeight:850}}>{index+1}</span><span aria-hidden="true" style={{fontSize:15}}>{info.icon}</span><span style={{flex:1,minWidth:0,fontSize:12,fontWeight:750,color:"#3C2B45"}}>{info.label}</span><div role="group" aria-label={"Move "+info.label} style={{display:"flex",gap:5}}><button aria-label={"Move "+info.label+" up"} onClick={()=>moveSection(id,-1)} disabled={index===0} style={moveStyle(index===0)}>↑</button><button aria-label={"Move "+info.label+" down"} onClick={()=>moveSection(id,1)} disabled={index===profile.sections.length-1} style={moveStyle(index===profile.sections.length-1)}>↓</button></div></div>;})}</div></div>
            <button onClick={save} disabled={busy} style={{...baseButton,background:profile.accent,color:"#fff"}}>{busy?"Saving…":"Save profile"}</button>
          </div>}
          <div style={{height:1,background:"rgba(88,55,104,.1)",margin:"22px 0 18px"}}/>
          <div style={{display:"grid",gap:20}}>{profile.sections.map(id=><div key={id}>{section(id)}</div>)}</div>
        </>}
        {error&&<p role="alert" style={{margin:"10px 0 0",fontSize:12,color:"#A13A47"}}>{error}</p>}
        {message&&<p role="status" style={{margin:"12px 0 0",fontSize:12,color:"#356444"}}>{message}</p>}
      </div>
    </div>
    {croppingKind&&(
      <CropEditor
        kind={croppingKind}
        file={croppingKind==="photo"?pendingPhoto:pendingBanner}
        crop={croppingKind==="photo"?photoCrop:bannerCrop}
        onChange={croppingKind==="photo"?setPhotoCrop:setBannerCrop}
        onClose={()=>setCroppingKind(null)}
      />
    )}
  </div>;
}
