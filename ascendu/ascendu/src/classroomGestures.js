// Keep high-frequency gestures outside React's expensive classroom render.
export function attachClassroomGestures(viewport, scene, {initialZoom=1.25, baseWidth=390}={}) {
  let zoom=initialZoom, frame=0, gesture=null, moved=false;
  const pointers=new Map();
  const clamp=value=>Math.max(1,Math.min(2.5,value));
  const midpoint=points=>({x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2});
  const distance=points=>Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y);
  const anchor=point=>{const r=scene.getBoundingClientRect();return {x:(point.x-r.left)/r.width,y:(point.y-r.top)/r.height};};
  const resize=(value,point,world)=>{
    zoom=clamp(value);
    scene.style.width=`${zoom*100}%`;
    scene.style.minWidth=`${baseWidth*zoom}px`;
    const r=scene.getBoundingClientRect();
    viewport.scrollLeft+=r.left+world.x*r.width-point.x;
    viewport.scrollTop+=r.top+world.y*r.height-point.y;
  };
  const rebase=()=>{
    const points=[...pointers.values()];
    if(points.length>=2){
      const point=midpoint(points);
      gesture={kind:'pinch',distance:Math.max(1,distance(points)),zoom,world:anchor(point)};
    }else if(points.length===1){
      gesture={kind:'pan',point:points[0],left:viewport.scrollLeft,top:viewport.scrollTop};
    }else gesture=null;
  };
  const render=()=>{
    frame=0;
    const points=[...pointers.values()];
    if(gesture?.kind==='pinch'&&points.length>=2){
      resize(gesture.zoom*distance(points)/gesture.distance,midpoint(points),gesture.world);
    }else if(gesture?.kind==='pan'&&points.length===1){
      viewport.scrollLeft=gesture.left+gesture.point.x-points[0].x;
      viewport.scrollTop=gesture.top+gesture.point.y-points[0].y;
    }
  };
  const flush=()=>{if(frame){cancelAnimationFrame(frame);render();}};
  const down=e=>{
    if(e.button!==0||e.target.closest('button'))return;
    flush();
    if(!pointers.size)moved=false;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    viewport.setPointerCapture(e.pointerId);
    if(pointers.size>1)moved=true;
    rebase();
  };
  const move=e=>{
    if(!pointers.has(e.pointerId))return;
    const point={x:e.clientX,y:e.clientY};
    if(gesture?.kind==='pan'&&Math.hypot(point.x-gesture.point.x,point.y-gesture.point.y)>4)moved=true;
    pointers.set(e.pointerId,point);
    if(!frame)frame=requestAnimationFrame(render);
    e.preventDefault();
  };
  const up=e=>{
    if(!pointers.has(e.pointerId))return;
    flush();
    pointers.delete(e.pointerId);
    if(viewport.hasPointerCapture(e.pointerId))viewport.releasePointerCapture(e.pointerId);
    rebase();
  };
  const click=e=>{if(moved&&!e.target.closest('button')){e.preventDefault();e.stopImmediatePropagation();moved=false;}};
  const reset=()=>{if(frame)cancelAnimationFrame(frame);frame=0;const ids=[...pointers.keys()];pointers.clear();gesture=null;ids.forEach(id=>{if(viewport.hasPointerCapture(id))viewport.releasePointerCapture(id);});};
  viewport.addEventListener('pointerdown',down);
  viewport.addEventListener('pointermove',move,{passive:false});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(type,up);
  viewport.addEventListener('click',click,true);
  window.addEventListener('blur',reset);
  return {
    zoomBy(amount){flush();const r=viewport.getBoundingClientRect();const point={x:r.left+viewport.clientWidth/2,y:r.top+viewport.clientHeight/2};resize(zoom+amount,point,anchor(point));rebase();},
    destroy(){reset();viewport.removeEventListener('pointerdown',down);viewport.removeEventListener('pointermove',move);for(const type of ['pointerup','pointercancel','lostpointercapture'])viewport.removeEventListener(type,up);viewport.removeEventListener('click',click,true);window.removeEventListener('blur',reset);},
  };
}
