const {chromium}=require('C:/Users/VSAN7/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:493,height:632},hasTouch:true});
    await page.goto('http://localhost:5173/scripts/stage-preview.html');
    await page.waitForSelector('.sg-stage-badge');
    await page.evaluate(async()=>{
      window.unmount();
      document.body.innerHTML='<div id="viewport" style="position:absolute;left:20px;top:40px;width:400px;height:380px;overflow:auto;touch-action:none"><svg id="scene" viewBox="0 0 390 380" style="display:block;width:125%;min-width:487.5px"><rect width="390" height="380" fill="tan"/></svg></div>';
      const {attachClassroomGestures}=await import('/src/classroomGestures.js');
      const viewport=document.getElementById('viewport'),scene=document.getElementById('scene');
      window.controller=attachClassroomGestures(viewport,scene);
      viewport.scrollLeft=50;viewport.scrollTop=45;
    });
    const cdp=await page.context().newCDPSession(page);
    const touch=async(type,points)=>{await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,x,y])=>({id,x,y}))});await page.waitForTimeout(35);};
    const world=()=>page.evaluate(()=>{const r=document.getElementById('scene').getBoundingClientRect();return {x:(220-r.left)/r.width,y:(230-r.top)/r.height};});
    const before=await world();
    await touch('touchStart',[[1,160,230],[2,280,230]]);
    for(let i=1;i<=6;i++)await touch('touchMove',[[1,160-i*5,230],[2,280+i*5,230]]);
    const after=await world();
    assert.ok(Math.abs(before.x-after.x)<.004&&Math.abs(before.y-after.y)<.004,'pinch midpoint must stay anchored');
    await touch('touchEnd',[[2,310,230]]);
    const left=await page.locator('#viewport').evaluate(el=>el.scrollLeft);
    await touch('touchMove',[[1,100,230]]);
    assert.ok(Math.abs(await page.locator('#viewport').evaluate(el=>el.scrollLeft)-left-30)<2,'remaining finger must pan without jumping');
    await touch('touchCancel',[]);
    await page.evaluate(()=>controller.zoomBy(20));
    assert.equal(await page.locator('#scene').evaluate(el=>el.style.width),'250%');
    await page.evaluate(()=>controller.zoomBy(-20));
    assert.equal(await page.locator('#scene').evaluate(el=>el.style.width),'100%');
    await touch('touchStart',[[3,180,200],[4,260,200]]);
    await touch('touchMove',[[3,160,200],[4,280,200]]);
    await touch('touchEnd',[]);
    assert.equal(await page.locator('#scene').evaluate(el=>el.style.width),'150%','new gesture after cancellation must work');
    await page.evaluate(()=>controller.destroy());
    await touch('touchStart',[[5,180,200],[6,260,200]]);
    await touch('touchMove',[[5,160,200],[6,280,200]]);
    await touch('touchEnd',[]);
    assert.equal(await page.locator('#scene').evaluate(el=>el.style.width),'150%','cleanup must detach gesture listeners');
    console.log('PASS: native touch pinch anchor, pinch-to-pan, cancellation recovery, zoom limits, and cleanup');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
