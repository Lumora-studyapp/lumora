// Skin regions refer to the original 1024 x 1536 artwork, separately for each pose.
// Colour detection alone also selects parchment, gold and brown accessories.
const FACE = {man:[410,0,710,360],woman:[385,0,675,450]};
const FACIAL_DETAILS = {man:[470,110,665,310],woman:[440,145,635,335]};
export const SCHOLAR_SKIN_REGIONS = {
  man:[
    [[380,365,530,555],[665,745,800,885]],
    [[415,435,560,610],[700,535,815,685]],
    [[390,335,535,530],[735,535,895,680]],
    [[415,510,580,675],[865,270,965,445]],
    [[270,280,380,460],[720,280,855,480]],
  ],
  woman:[
    [[385,345,535,495],[605,440,755,610]],
    [[400,335,540,495],[700,500,815,650]],
    [[390,320,540,485],[705,520,835,675]],
    [[490,505,620,640],[785,390,885,560]],
    [[390,420,515,610],[[835,235],[870,185],[882,140],[905,140],[921,200],[855,302]],
      [[916,132],[934,130],[960,167],[949,179],[926,162]],
      [480,915,680,1430],[250,1040,405,1170]],
  ],
};

function contains(region,x,y){
  if(typeof region[0]==='number')return x>=region[0]&&y>=region[1]&&x<=region[2]&&y<=region[3];
  let inside=false;
  for(let i=0,j=region.length-1;i<region.length;j=i++){
    const [xi,yi]=region[i],[xj,yj]=region[j];
    if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
  }
  return inside;
}

export function isSourceSkin(r,g,b){
  const warmth=(r-g)/Math.max(1,g-b);
  return r>65&&g>30&&r>g*1.1&&g>b*1.08&&warmth>.6&&warmth<3;
}

const rgb=hex=>[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16));
const luminance=(r,g,b)=>.2126*r+.7152*g+.0722*b;

// Transfer relative lighting, with a highlight shoulder instead of channel clipping.
export function shadeSkin(target,light,reference){
  const shade=Math.max(.25,Math.min(1.65,light/Math.max(1,reference)));
  return target.map((channel,index)=>Math.round(shade<=1?channel*shade:
    channel+([255,248,240][index]-channel)*(shade-1)*.55));
}

export function recolourScholarPixels({data,width,height},{model,stage,skin,hairColor}){
  const regions=[FACE[model],...(SCHOLAR_SKIN_REGIONS[model]?.[stage]||[])];
  if(!regions[0])return;
  const mask=new Uint8Array(width*height);
  const histograms=regions.map(()=>new Uint32Array(256)),counts=regions.map(()=>0);
  for(let i=0;i<data.length;i+=4){
    if(!data[i+3]||!isSourceSkin(data[i],data[i+1],data[i+2]))continue;
    const pixel=i/4,x=(pixel%width)*1024/width,y=Math.floor(pixel/width)*1536/height;
    const region=regions.findIndex(area=>contains(area,x,y));
    if(region<0)continue;
    mask[pixel]=region+1;
    histograms[region][Math.round(luminance(data[i],data[i+1],data[i+2]))]++;
    counts[region]++;
  }
  // Each exposed area has different baked-in lighting; normalize its midtone.
  const references=histograms.map((histogram,index)=>{
    let count=0;
    for(let light=0;light<256;light++){count+=histogram[light];if(count>=Math.max(1,counts[index]/2))return light;}
    return 128;
  });
  const target=rgb(skin),hair=rgb(hairColor);
  for(let i=0;i<data.length;i+=4){
    if(!data[i+3])continue;
    const region=mask[i/4];
    const r=data[i],g=data[i+1],b=data[i+2];
    if(region){
      const colour=shadeSkin(target,luminance(r,g,b),references[region-1]);
      data[i]=colour[0];data[i+1]=colour[1];data[i+2]=colour[2];
    }else{
      // Hair recolouring must not treat dark eyes, brows or mouth detail as hair.
      const x=(i/4%width)*1024/width,y=Math.floor(i/4/width)*1536/height;
      const head=model==='woman'?[285,0,700,270]:[380,0,710,270];
      if(data[i+3]>=200&&contains(head,x,y)&&!contains(FACIAL_DETAILS[model],x,y)&&r<125&&g<105&&b<105&&r>b*.85&&g>b*.7){
        const shade=Math.max(.23,Math.min(1.3,(r+g+b)/180));
        data[i]=Math.min(255,hair[0]*shade);data[i+1]=Math.min(255,hair[1]*shade);data[i+2]=Math.min(255,hair[2]*shade);
      }
    }
  }
}
