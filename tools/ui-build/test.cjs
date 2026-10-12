const {JSDOM}=require('jsdom');
const esbuild=require('esbuild');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const result=await esbuild.build({entryPoints:[path.join(root,'assets/guide-motion.mjs')],bundle:true,write:false,format:'iife',globalName:'motion',logLevel:'silent'});
 const dom=new JSDOM('<!doctype html><body><main id="panels" class="wrap"><section id="one"><h2>One</h2><button>Source</button></section><section id="two" hidden><h2>Two</h2><button>Destination</button></section><section id="three" hidden><h2>Three</h2></section></main><div id="search" hidden><input></div><details id="tools"><summary>Tools</summary><p>Content</p></details><dialog class="detail-sheet"><div class="sheet-toolbar"><h2>Details</h2></div><div class="sheet-content"><input value="preserve"></div></dialog><dialog class="lab-dialog"><h2>Lab</h2><div class="lab-content">Graph</div></dialog><ul id="assessment-list"><li id="a">A</li><li id="b">B</li></ul></body>',{url:'https://guide.test',runScripts:'dangerously',pretendToBeVisual:true});
 const w=dom.window,d=w.document;let mediaChange;
 // Advance the real GSAP ticker on a shared 60 Hz clock. Synchronous jsdom CSS
 // work must not consume playback time or trigger GSAP's wall-clock lag smoothing.
 let frame=0,frameId=0;const frames=new Map(),frameDuration=1000/60;
 w.Date.now=()=>frame*frameDuration;
 w.requestAnimationFrame=callback=>{const id=++frameId;frames.set(id,callback);return id};
 w.cancelAnimationFrame=id=>frames.delete(id);
 const wait=async ms=>{
  for(let n=0;n<Math.ceil(ms/frameDuration);n++){
   frame++;const pending=[...frames];
   for(const [id,callback]of pending)if(frames.delete(id))callback(w.Date.now());
   await Promise.resolve();
  }
 };
 const media={matches:false,addEventListener(name,fn){mediaChange=fn}};
 w.matchMedia=()=>media;w.ResizeObserver=class{observe(){}};w.IntersectionObserver=class{observe(){}unobserve(){}};
 w.HTMLElement.prototype.getBoundingClientRect=function(){const hidden=this.hidden||this.closest('[hidden]');const row=this.tagName==='LI';const top=row?[...this.parentElement.children].indexOf(this)*80:20;return {x:20,y:top,left:20,top,right:620,bottom:top+300,width:hidden?0:600,height:hidden?0:300};};
 w.HTMLElement.prototype.getClientRects=function(){return this.hidden||this.closest('[hidden]')?[]:[this.getBoundingClientRect()];};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.localStorage.setItem('guide-motion-paused','true');
 w.eval(result.outputFiles[0].text);
 const M=w.motion,$=id=>d.getElementById(id),dialog=d.querySelector('.detail-sheet');
 assert(M.motionAllowed(),'an existing saved header pause must not suppress page transitions');M.setScenePaused(true);assert(M.motionAllowed(),'pausing the header must preserve interface motion');assert(!M.sceneMotionAllowed());M.setScenePaused(false);assert(M.sceneMotionAllowed());
 // GSAP frame playback: the first frame is visibly displaced, an intermediate frame advances,
 // and completion removes inline opacity/transform so reading remains stationary.
 const reveal=M.reveal($('one'));
 assert.equal(reveal.duration(),.42);
 assert.match($('one').style.transform,/36px/);
 await wait(100);assert(reveal.progress()>0&&reveal.progress()<1);
 assert(Number($('one').style.opacity)>.35);
 await wait(450);assert.equal($('one').style.transform,'');assert.equal($('one').style.opacity,'');
 const page=M.enterPage($('panels'));assert.match($('panels').style.transform,/translate/,'the content rises in');assert.doesNotMatch($('panels').style.filter||'',/blur\([1-9]/,'content is never blurred on entry');assert(Number($('panels').style.opacity)>=.85,'content starts readable');await wait(110);assert(page.progress()>0&&page.progress()<1);await wait(400);assert.equal($('panels').style.transform,'');
 const section=M.transitionPanel($('one'),$('two'));
 assert.ok(section.duration()>=.7);assert(!$('two').hidden);assert($('one').inert);assert.equal($('one').style.pointerEvents,'none');
 await wait(80);M.transitionPanel($('two'),$('three'),-1);
 assert($('one').hidden);assert(!$('three').hidden);assert($('two').inert);
 await wait(850);assert($('two').hidden);assert.equal($('three').style.transform,'');assert.equal($('two').style.position,'');
 M.visibility($('search'),true);assert(!$('search').hidden);await wait(70);M.visibility($('search'),false);await wait(400);assert($('search').hidden);
 M.visibility($('search'),true);M.setPaused(true);assert(!$('search').hidden);assert.equal($('search').style.height,'');assert(!M.motionAllowed());M.setPaused(false);
 M.disclosure($('tools'),true);await wait(70);M.disclosure($('tools'),false);M.disclosure($('tools'),true);await wait(400);assert($('tools').open);assert.equal($('tools').style.height,'');
 dialog.showModal();const input=dialog.querySelector('input'),open=M.dialogOpen(dialog,{left:80,top:90,width:120,height:60});assert.ok(open.duration()>=.65);
 await wait(70);let closes=0;M.dialogClose(dialog,()=>{closes++;dialog.close()},{left:80,top:90,width:120,height:60});await wait(420);
 assert.equal(closes,1);assert(!dialog.open);assert.equal(dialog.querySelector('input'),input);assert.equal(input.value,'preserve');assert.equal(dialog.style.transform,'');
 dialog.showModal();M.dialogOpen(dialog);M.dialogClose(dialog,()=>{closes++;dialog.close()});media.matches=true;mediaChange();assert(!dialog.open);assert.equal(closes,2);assert.equal(dialog.style.opacity,'');media.matches=false;mediaChange();
 dialog.showModal();M.dialogOpen(dialog);M.dialogClose(dialog,()=>dialog.close());await wait(370);let navigated=0;const exit=M.leavePage($('panels'),()=>navigated++);await wait(90);assert.match($('panels').style.transform,/rotateY/);assert.match($('panels').style.transform,/perspective\(1500px\)/,'perspective stays constant throughout exit');await wait(520);assert.equal(navigated,1);assert.equal(exit.progress(),1);assert.equal($('panels').style.opacity,'0','the departing page must stay out until navigation commits');M.enterPage($('panels'));await wait(1050);assert.equal($('panels').style.transform,'');
 const lab=d.querySelector('.lab-dialog');lab.showModal();const expanded=M.dialogOpen(lab,{left:20,top:200,width:300,height:150});assert.equal(expanded.duration(),.52);M.cancel(lab);assert.equal(lab.style.transform,'');
 const before=M.capture();$('a').parentElement.append($('a'));M.reflow(before);await wait(100);assert($('a').style.transform||$('b').style.transform,'Flip produces an intermediate transform');M.setPaused(true);assert.equal($('a').style.transform,'');assert.equal($('b').style.transform,'');
 M.transitionPanel($('three'),$('one'));assert($('three').hidden);assert(!$('one').hidden);assert.equal($('one').style.transform,'');
 console.log('GSAP playback, section interruption, expanding surfaces, dialog reversal, Flip continuity and pause/reduced-motion settlement passed');
 dom.window.close();
})().catch(e=>{console.error(e);process.exitCode=1});
