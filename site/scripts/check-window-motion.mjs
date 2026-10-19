// Supplemental browser checks against the built export, including actual scrolling.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = resolve(process.env.QA_SITE_ROOT || join(dirname(fileURLToPath(import.meta.url)), '../out'));
const reports = process.env.QA_REPORT_DIR || '/tmp/mth140-window-qa';
const base = '/tmu-course-guides/next';
const types = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp' };
const server = createServer(async(req,res)=>{
 try {
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(!pathname.startsWith(`${base}/`)) return res.writeHead(404).end();
  let path=resolve(root,`.${pathname.slice(base.length)}`);
  if(path!==root&&!path.startsWith(`${root}${sep}`)) return res.writeHead(403).end();
  if((await stat(path)).isDirectory()) path=join(path,'index.html');
  res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream'});res.end(await readFile(path));
 } catch {res.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin=`http://127.0.0.1:${server.address().port}${base}`;
await mkdir(reports,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const checks=[], errors=[];let active;
const check=(name,value)=>{assert.ok(value,name);checks.push(name);};
async function open({width=1440,height=900,pause=false,nojs=false,date='2026-10-16T09:17:00-04:00',section=31}={}){
 const context=await browser.newContext({viewport:{width,height},hasTouch:width<1200,reducedMotion:'no-preference',javaScriptEnabled:!nojs});
 await context.addInitScript(({pause,section})=>{if(section)localStorage.setItem('mth140-section-v1',String(section));if(pause)localStorage.setItem('guide-motion-paused','true');},{pause,section});
 const page=await context.newPage();active=page;page.on('pageerror',e=>errors.push(e.message));
 if(!nojs)await page.clock.setFixedTime(new Date(date));
 await page.goto(`${origin}/mth140/`,{waitUntil:'networkidle'});await page.waitForTimeout(nojs?100:2200);
 return {page,context};
}
async function moveTo(page,locator,offset=300){
 const delta=await locator.evaluate((el,off)=>el.getBoundingClientRect().top-off,offset);
 await page.mouse.move(Math.round((await page.viewportSize()).width*0.55),Math.round((await page.viewportSize()).height*0.72));
 await page.mouse.wheel(0,delta);await page.waitForTimeout(1900);
}
const screenshot=async(page,name)=>page.screenshot({path:join(reports,`${name}.png`)});
try{
 const desktop=await open();
 check('normal motion enabled',await desktop.page.locator('html').getAttribute('data-motion')==='on');
 check('visible timing retains the quiz second-hour qualification',(await desktop.page.locator('[data-selected-assessment="quiz-2"]').innerText()).includes('second hour'));
 const headings=desktop.page.locator('#assignments h3');
 const expected=['quiz-2','midterm','quiz-3'];
 for(let i=0;i<3;i++){
  await moveTo(desktop.page,headings.nth(i),300);
  const win=desktop.page.locator(`[data-window-kind="deadline"][data-selected-assessment="${expected[i]}"]`);
  // These mirrored panels are decorative, not hit targets. Inspect intersection with
  // the actual window clip, not elementFromPoint (which can hit the pointer layer).
  const geometry=await win.evaluate(el=>{
   const r=el.getBoundingClientRect(),c=el.parentElement.parentElement.getBoundingClientRect();
   const width=Math.max(0,Math.min(r.right,c.right,innerWidth)-Math.max(r.left,c.left,0));
   const height=Math.max(0,Math.min(r.bottom,c.bottom,innerHeight)-Math.max(r.top,c.top,0));
   return {visibleFraction:width*height/(r.width*r.height),rect:r.toJSON(),clip:c.toJSON()};
  });
  await writeFile(join(reports,`motion-group-${i+1}-geometry.json`),JSON.stringify(geometry,null,2));
  check(`normal desktop scroll reveals ${expected[i]} in pinned window`,geometry.visibleFraction>0.95);
  await screenshot(desktop.page,`motion-desktop-group-${i+1}`);
 }
 const laterFinal=desktop.page.locator('[data-assessment-id="final"]');await laterFinal.focus();
 check('keyboard selection updates the pinned summary',await desktop.page.locator('[data-window-kind="deadline"][data-selected-assessment="final"]').count()===1);
 await desktop.page.keyboard.press('Enter');check('keyboard opens full deadline actions',await laterFinal.getAttribute('aria-expanded')==='true');
 await desktop.context.close();
 const phone=await open({width:390,height:844});
 await moveTo(phone.page,phone.page.locator('#assignments'),100);
 const before=await phone.page.locator('main').evaluate(el=>el.scrollTop);
 const cdp=await phone.context.newCDPSession(phone.page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:195,y:640}]});
 for(const y of [600,550,500,440,380]){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:195,y}]});await phone.page.waitForTimeout(40);}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await phone.page.waitForTimeout(1000);
 check('native touch gesture scrolls through phone windows',await phone.page.locator('main').evaluate(el=>el.scrollTop)>before+100);
 await screenshot(phone.page,'motion-phone-touch');await phone.context.close();
 const tablet=await open({width:820,height:1180});
 await moveTo(tablet.page,tablet.page.locator('#assignments h3').nth(1),620);
 check('portrait tablet uses a full-width readable window',await tablet.page.locator('[data-selected-assessment="midterm"]').evaluate(el=>el.getBoundingClientRect().width)>600);
 await tablet.page.setViewportSize({width:1180,height:820});await tablet.page.waitForTimeout(1200);
 await moveTo(tablet.page,tablet.page.locator('#assignments h3').nth(1),280);
 check('tablet rotation switches to a split window without overflow',await tablet.page.locator('[data-selected-assessment="midterm"]').evaluate(el=>{const r=el.getBoundingClientRect();return r.width>300&&r.width<600&&el.scrollWidth<=el.clientWidth+2;}));
 await screenshot(tablet.page,'motion-tablet-landscape');
 await tablet.page.setViewportSize({width:600,height:1024});await tablet.page.waitForTimeout(1200);
 check('tablet Split View returns to full-width windows',await tablet.page.locator('[data-selected-assessment="midterm"]').evaluate(el=>el.getBoundingClientRect().width)>450);
 check('rotation and Split View keep coursework reachable',await tablet.page.locator('[data-assessment-id="midterm"]').count()===1);
 await tablet.context.close();
 const paused=await open({pause:true});
 check('saved Pause motion is respected',await paused.page.locator('html').getAttribute('data-motion')==='off');
 await moveTo(paused.page,paused.page.locator('#assignments h3').nth(1),300);
 check('paused scrolling still exposes the correct summary',await paused.page.locator('[data-selected-assessment="midterm"]').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+2;}));
 check('progress animation stops when paused',await paused.page.locator('[data-window-kind="preparation"] svg circle').last().evaluate(el=>getComputedStyle(el).transitionDuration==='0s'));
 await screenshot(paused.page,'paused-desktop-midterm');await paused.context.close();
 const unknown=await open({width:390,height:844,section:null,pause:true});
 const week=unknown.page.locator('[data-selected-assessment="quiz-2"]');
 check('without a section quiz timing remains week-only', (await week.innerText()).includes('Choose your section'));
 await unknown.context.close();
 const empty=await open({width:390,height:844,date:'2026-10-30T12:00:00-04:00',pause:true});
 check('empty week window has an honest empty state',(await empty.page.locator('[data-window-kind="deadline"]').first().innerText()).includes('Nothing scheduled'));
 check('future checklist is not mislabeled as this week',await empty.page.getByRole('heading',{name:'Upcoming preparation',exact:true}).count()===1);
 await empty.context.close();
 const nojs=await open({width:390,height:844,nojs:true});
 check('without JavaScript the course hero and assessment titles remain available',await nojs.page.locator('[data-course-artwork="mth140"]').count()===1&&(await nojs.page.locator('#panel-assessments').innerText()).includes('Midterm Test'));
 check('without JavaScript no countdown or preparation completion is invented',await nojs.page.locator('[data-window-kind="deadline"][data-selected-assessment=""]').count()===3);
 await nojs.context.close();
 check('supplemental checks had no runtime errors',errors.length===0);
}catch(e){await screenshot(active,'motion-failure').catch(()=>{});await writeFile(join(reports,'motion-failure.txt'),String(e.stack));console.error(e);process.exitCode=1;}
finally{await writeFile(join(reports,'motion-results.json'),JSON.stringify({browser:browser.version(),date:new Date().toISOString(),passed:checks.length,checks,errors,scope:'Chromium, browser-emulated layouts and touch input. No physical iPhone/iPad, Safari or GPU-performance claim.'},null,2));await browser.close();await new Promise(done=>server.close(done));}
