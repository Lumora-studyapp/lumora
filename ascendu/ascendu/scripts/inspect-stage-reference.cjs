const { chromium } = require('C:/Users/VSAN7/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const file = 'C:/Users/VSAN7/Downloads/Screen_Recording_20260906_172902_FC Mobile.mp4';
const out = path.resolve('artifacts/stage-transition');
fs.mkdirSync(out, {recursive:true});
const server = http.createServer((req,res) => {
  const size=fs.statSync(file).size;
  const match=req.headers.range?.match(/bytes=(\d+)-(\d*)/);
  const start=match?Number(match[1]):0, end=match&&match[2]?Number(match[2]):size-1;
  res.writeHead(match?206:200, {'Content-Type':'video/mp4','Content-Length':end-start+1,'Accept-Ranges':'bytes',...(match?{'Content-Range':`bytes ${start}-${end}/${size}`}:{})});
  fs.createReadStream(file,{start,end}).pipe(res);
});
(async()=>{
  await new Promise(r=>server.listen(5175,'127.0.0.1',r));
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:5173');
  await page.evaluate(async()=>{
    window.v=document.createElement('video'); v.muted=true; v.src='http://127.0.0.1:5175'; v.crossOrigin='anonymous';
  });
  // Same-origin media avoids CORS and preserves the source dimensions.
  await page.goto('http://127.0.0.1:5175');
  await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
  const meta=await page.evaluate(()=>{window.v=document.querySelector('video');v.pause();return {width:v.videoWidth,height:v.videoHeight,duration:v.duration};});
  console.log(meta);
  for(let i=0;i<=48;i++){
    const time=10.98+i/30;
    const data=await page.evaluate(async(time)=>{
      v.currentTime=time; await new Promise(r=>v.addEventListener('seeked',r,{once:true}));
      const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);return c.toDataURL().split(',')[1];
    },time);
    fs.writeFileSync(path.join(out,`reference-${time.toFixed(3)}.png`),Buffer.from(data,'base64'));
  }
  await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1)});
