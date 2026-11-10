const { chromium, webkit, devices } = require(process.env.PLAYWRIGHT_PATH);
const fs = require('fs/promises');
const sharp = require('../site/node_modules/sharp');
(async () => {
  const { createPreview } = await import('./preview-server.mjs');
  const server = createPreview({root:'site/out',base:'/tmu-course-guides/'});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}/tmu-course-guides/`;
  for (const [engine,options] of [['chromium',devices['iPhone 13 Pro Max']],['chromium',{viewport:{width:1440,height:900}}],['webkit',devices['iPhone 13 Pro Max']]]) {
    const browser=await ({chromium,webkit}[engine]).launch({args:engine==='chromium'?['--enable-unsafe-swiftshader']:[]});
    const context=await browser.newContext({...options,colorScheme:'light'});
    const page=await context.newPage();
    if(engine==='chromium') await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate',{rate:6});
    await page.addInitScript(()=>{
      window.samples=[];
      const tick=()=>{
        const main=document.querySelector('main'), loader=document.querySelector('#loader');
        if(main&&loader){
          const footer=document.querySelector('footer');
          window.samples.push({t:Math.round(performance.now()),path:location.pathname,h:innerHeight,main:main.getBoundingClientRect().toJSON(),layout:document.querySelector('#layout').getBoundingClientRect().toJSON(),content:document.querySelector('#mainContainer').getBoundingClientRect().toJSON(),footer:footer?.getBoundingClientRect().toJSON(),opacity:getComputedStyle(main).opacity,transform:getComputedStyle(main).transform,loader:getComputedStyle(loader).display,data:{...document.documentElement.dataset}});
        }
        requestAnimationFrame(tick);
      };requestAnimationFrame(tick);
    });
    async function capture(label,action){
      const shots=[];
      await action();
      for(let i=0;i<16;i++){
        shots.push(await sharp(await page.screenshot()).resize({width:240}).jpeg({quality:55}).toBuffer());
        await page.waitForTimeout(50);
      }
      const meta=await sharp(shots[0]).metadata();
      const sheet=await sharp({create:{width:240*4,height:meta.height*4,channels:3,background:'#ffffff'}}).composite(shots.map((input,i)=>({input,left:(i%4)*240,top:Math.floor(i/4)*meta.height}))).jpeg({quality:60}).toBuffer();
      const samples=await page.evaluate(()=>window.samples);
      console.log('PROBE '+JSON.stringify({label:engine+'-'+options.viewport.width+'-'+label,image:sheet.toString('base64'),samples:samples.filter((x,i)=>i===0||x.opacity!=='1'||x.content.bottom<x.h).slice(-120)}));
    }
    await capture('cold',()=>page.goto(url+'cen100/',{waitUntil:'domcontentloaded'}));
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('#loader')).display==='none');
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('#loader')).display==='none');
    const menu=page.getByRole('button',{name:/^menu$/i});
    await menu.click();
    await page.waitForTimeout(1200);
    await capture('menu-course',()=>page.locator('#menu a[href$="/cen100/"]').click());
    await context.close();await browser.close();
  }
  server.close();
})().catch(e=>{console.error(e);process.exit(1)});
