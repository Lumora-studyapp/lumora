import test from 'node:test';
import assert from 'node:assert/strict';
import {recolourScholarPixels,shadeSkin,SCHOLAR_SKIN_REGIONS} from './scholarColour.js';

const colour=[185,119,82,255];
function imageWith(points,width=1024,height=1536){
  const image={width,height,data:new Uint8ClampedArray(width*height*4)};
  for(const [x,y,rgba=colour] of points)image.data.set(rgba,(y*width+x)*4);
  return image;
}
const sample=(image,x,y)=>Array.from(image.data.slice((y*image.width+x)*4,(y*image.width+x)*4+4));
const apply=(image,model='woman',stage=4,skin='#F4D4B9')=>recolourScholarPixels(image,{model,stage,skin,hairColor:'#242026'});

test('graduate face, neck, both arms, both legs and feet share the chosen skin',()=>{
  const locations=[[520,240],[540,380],[450,475],[875,225],[935,153],[600,1000],[550,1200],[550,1380],[290,1110]];
  for(const skin of ['#F4D4B9','#DCA884','#B97752','#865039','#523129']){
    const image=imageWith(locations);apply(image,'woman',4,skin);
    const expected=[1,3,5].map(i=>parseInt(skin.slice(i,i+2),16));
    for(const [x,y] of locations)assert.deepEqual(sample(image,x,y),[...expected,255],`${skin} at ${x},${y}`);
  }
});

test('skin-like prop pixels outside the pose masks and non-skin clothing remain unchanged',()=>{
  const points=[[845,60,colour],[900,115,[225,174,40,255]],[800,600,[105,20,140,255]],
    [510,220,[255,255,255,255]],[520,235,[20,12,10,255]],[100,700,colour]];
  const image=imageWith(points);apply(image);
  for(const [x,y,rgba] of points)assert.deepEqual(sample(image,x,y),rgba);
});

test('all ten poses include hand regions as well as the face',()=>{
  for(const model of ['man','woman'])for(let stage=0;stage<5;stage++){
    const [x1,y1,x2,y2]=SCHOLAR_SKIN_REGIONS[model][stage][0];
    const x=Math.floor((x1+x2)/2),y=Math.floor((y1+y2)/2);
    const image=imageWith([[520,200],[x,y]]);apply(image,model,stage);
    assert.deepEqual(sample(image,x,y),sample(image,520,200),`${model} stage ${stage+1}`);
  }
});

test('fair skin retains graded shadows and warm highlights without white clipping',()=>{
  const target=[244,212,185];
  const shadow=shadeSkin(target,60,128),mid=shadeSkin(target,128,128),highlight=shadeSkin(target,220,128);
  assert.deepEqual(mid,target);
  for(let i=0;i<3;i++){assert(shadow[i]<mid[i]);assert(highlight[i]>mid[i]);assert(highlight[i]<255);}
  assert(highlight[0]>highlight[1]&&highlight[1]>highlight[2]);
});

test('scaled artwork and partially transparent skin edges keep coverage and alpha',()=>{
  const image=imageWith([[137,300,[185,119,82,80]]],256,384);apply(image);
  assert.deepEqual(sample(image,137,300),[244,212,185,80]);
  assert.deepEqual(sample(image,0,0),[0,0,0,0]);
});
