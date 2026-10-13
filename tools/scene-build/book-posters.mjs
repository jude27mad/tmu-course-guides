/* Semester book posters from the real renderer (semester-book spec §5.11, plan §6).

   Loads tests/book-capture.html in Chromium for each theme × view in poster mode — the live engine with ink 0,
   no pop-ups, a 0.5 block split, the hero motif and the ribbon in the gutter — and saves the stage canvas as a
   transparent WebP (q 0.86) over which the CSS desk shows. Nothing is mocked: the file is the frame the
   engine draws, so geometry, pose, camera, materials and light match the live scene.

     node tools/scene-build/book-posters.mjs [--course mth140] [--out assets/book/posters] [--port 4546]
                                             [--only dark-wide,light-tall] [--dry-run]

   Wide: a 1440 × 600 stage at DPR 1.5 (the ≥ 1001 px framing). Tall: 390 × 300 at DPR 2 (the ≤ 760 px phone
   framing). SwiftShader output is acceptable for the file; review on real hardware is still pending.
   Playwright comes from PLAYWRIGHT_MODULE, then /opt/node-tools/node_modules/playwright, then `playwright`. */
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPreview} from '../preview-server.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const args=process.argv.slice(2),option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const course=option('--course','mth140'),out=path.resolve(ROOT,option('--out','assets/book/posters'));
const port=Number(option('--port',4546)),only=option('--only','')?.split(',').filter(Boolean),dry=args.includes('--dry-run');
export const VIEWS=Object.freeze({
 wide:{viewport:{width:1440,height:900},dpr:1.5,stage:[1440,600]},
 tall:{viewport:{width:390,height:844},dpr:2,stage:[390,300]}
});
const BROWSER_ARGS=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];

function loadPlaywright(){
 const require=createRequire(import.meta.url);
 for(const id of [process.env.PLAYWRIGHT_MODULE,'/opt/node-tools/node_modules/playwright','playwright'].filter(Boolean)){
  try{return require(id);}catch{}
 }
 throw new Error('Playwright not found: set PLAYWRIGHT_MODULE to its path');
}

async function capture(browser,{theme,view}){
 const spec=VIEWS[view],page=await browser.newPage({viewport:spec.viewport,deviceScaleFactor:spec.dpr});
 const problems=[];
 page.on('pageerror',error=>problems.push(error.message));
 page.on('console',message=>{if(message.type()==='error')problems.push(message.text());});
 const query=new URLSearchParams({course,theme,view,poster:'1',tier:'high',bare:'1'});
 await page.goto(`http://127.0.0.1:${port}/tests/book-capture.html?${query}`);
 await page.waitForFunction(()=>window.__bookCapture&&window.__bookCapture.status!=='loading',null,{timeout:120000});
 const report=await page.evaluate(()=>({...window.__bookCapture,stats:undefined}));
 if(report.status!=='ready'||report.renderer!=='webgl2')throw new Error(`${theme}-${view}: ${report.status} (${report.renderer||'no renderer'}: ${report.reason||'unknown'})`);
 const url=await page.evaluate(()=>window.__bookCaptureExport('image/webp',.86));
 if(!url?.startsWith('data:image/webp'))throw new Error(`${theme}-${view}: the canvas did not export WebP`);
 const bytes=Buffer.from(url.slice(url.indexOf(',')+1),'base64');
 // Sanity: the frame is transparent at the stage corners and opaque on the book.
 const alpha=await page.evaluate(async url=>{
  const img=new Image();img.src=url;await img.decode();
  const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);
  const at=(u,v)=>x.getImageData(Math.floor(u*(img.width-1)),Math.floor(v*(img.height-1)),1,1).data[3];
  return {width:img.width,height:img.height,corner:at(0,0),centre:at(.64,.46)};
 },url);
 await page.close();
 return {bytes,alpha,problems,frame:report.frame};
}

async function main(){
 const {chromium}=loadPlaywright();
 const server=createPreview({root:ROOT});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 const browser=await chromium.launch({args:BROWSER_ARGS});
 const results=[];
 try{
  mkdirSync(out,{recursive:true});
  for(const theme of ['dark','light'])for(const view of Object.keys(VIEWS)){
   const name=`${course}-${theme}-${view}`;
   if(only?.length&&!only.includes(`${theme}-${view}`))continue;
   const {bytes,alpha,problems,frame}=await capture(browser,{theme,view});
   const file=path.join(out,`${name}.webp`),before=existsSync(file)?readFileSync(file).length:null;
   if(!dry)writeFileSync(file,bytes);
   results.push({name,file:path.relative(ROOT,file),bytes:bytes.length,before,size:`${alpha.width}×${alpha.height}`,
    corner:alpha.corner,centre:alpha.centre,frame,sha256:createHash('sha256').update(bytes).digest('hex').slice(0,16),problems:problems.length});
   if(alpha.centre<250)console.warn(`${name}: the book centre is not opaque (alpha ${alpha.centre})`);
   for(const problem of problems)console.warn(`${name}: ${problem}`);
  }
 }finally{await browser.close();server.close();}
 console.table(results);
 if(dry)console.log('Dry run: nothing written.');
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(error=>{console.error(error.message||error);process.exitCode=1;});
}
