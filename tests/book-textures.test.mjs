import test from 'node:test';
import assert from 'node:assert/strict';
import {COURSES} from '../assets/course-data.mjs';
import {timestamp} from '../assets/schedule.mjs';
import {semesterWeeks,recordsForCourse} from '../assets/book/weeks.mjs';
import {describeSpread} from '../assets/book/book-state.mjs';
import * as TX from '../assets/book/textures.mjs';
import {PAGE} from '../assets/book/popup.mjs';

/* Book textures (docs/book/semester-book-spec.md §5.4, §10.1) against a recording 2D context: masks only (black
   and pure R/G/B), repaint only on signature changes, honest wording, keep-out and sizes. */

const PURE=/^rgb\((?:(\d+),0,0|0,(\d+),0|0,0,(\d+))\)$/;
class MockContext{
  constructor(canvas,{spacing=true}={}){
    this.canvas=canvas;this.ops=[];this.font='10px sans-serif';this.fillStyle='#000';this.strokeStyle='#000';
    this.globalCompositeOperation='source-over';this.globalAlpha=1;this.lineWidth=1;this.fontStretch='normal';
    if(spacing)this.letterSpacing='0px';
  }
  size(){return Number(/([\d.]+)px/.exec(this.font)?.[1]||10);}
  condensed(){return /condensed/.test(this.font)||this.fontStretch==='condensed';}
  measureText(text){
    let w=0;for(const ch of String(text))w+=/[0-9]/.test(ch)?.56:/[A-Z]/.test(ch)?.66:ch===' '?.27:/[a-z]/.test(ch)?.52:.42;
    const spacing=parseFloat(this.letterSpacing||'0')||0;
    return {width:w*this.size()*(this.condensed()?.78:1)+spacing*String(text).length,actualBoundingBoxAscent:this.size()*.72};
  }
  record(kind,extra={}){this.ops.push({kind,fill:this.fillStyle,stroke:this.strokeStyle,mode:this.globalCompositeOperation,font:this.font,...extra});}
  fillText(text,x,y){this.record('text',{text:String(text),x,y});}
  fillRect(x,y,w,h){this.record('rect',{x,y,w,h});}
  clearRect(){this.record('clear');}
  fill(){this.record('fill');}
  stroke(){this.record('stroke');}
  beginPath(){}moveTo(){}lineTo(){}closePath(){}arc(){}ellipse(){}rect(){}
  save(){}restore(){}translate(){}rotate(){}scale(){}setTransform(){}
}
class MockCanvas{
  constructor(w,h,options){this.width=w;this.height=h;this.ctx=new MockContext(this,options);}
  getContext(){return this.ctx;}
}
const NOON=timestamp('2026-10-12','12:00');
function context({section=0,completed={},now=NOON,targetId='quiz-2'}={}){
  const weeks=semesterWeeks({records:recordsForCourse('mth140',{section,completed})});
  return {course:'mth140',data:COURSES.mth140,weeks,section,completed,now,targetId};
}
const view=(index,options)=>{const ctx=context(options);return describeSpread(ctx.weeks[index],ctx);};
const painted=(fn,v,options={})=>{const c=new MockCanvas(1024,1486);const rec=fn(c.ctx,v,{width:1024,height:1486,...options});return {rec,ops:c.ctx.ops};};
const texts=ops=>ops.filter(o=>o.kind==='text').map(o=>o.text);
const fontPx=o=>Number(/([\d.]+)px/.exec(o.font)[1]);

function masksOnly(ops,label){
  for(const op of ops){
    if(op.kind==='clear'||op.mode==='destination-out')continue;
    const style=op.kind==='stroke'?op.stroke:op.fill;
    assert.match(style,PURE,`${label}: ${op.kind} with ${style}`);
    const black=style==='rgb(0,0,0)';
    if(!black)assert.equal(op.mode,'lighter',`${label}: inked ${op.kind} must add, not cover`);
  }
}

test('faces are masks: only black and pure R, G or B fills, inked additively',()=>{
  for(const i of [0,5,6,15,16]){
    const v=view(i);
    for(const [name,fn] of [['verso',TX.paintVerso],['recto',TX.paintRecto]]){
      for(const options of [{},{compact:true},{poster:true}]){
        const {ops}=painted(fn,v,options);
        assert.ok(ops.length>3,`${name} ${i} paints something`);
        masksOnly(ops,`${name} ${i} ${JSON.stringify(options)}`);
      }
    }
  }
  const atlas=new MockCanvas(1280,960);
  TX.paintLabel(atlas.ctx,view(5).entries[0],{x:0,y:0,w:640,h:240},{aspect:2.34});
  masksOnly(atlas.ctx.ops,'label');
  const riffle=new MockCanvas(1024,1486);TX.paintRiffle(riffle.ctx);masksOnly(riffle.ctx.ops,'riffle');
});

test('channels: printed ink in G, accent in B, pencil in R',()=>{
  const {ops}=painted(TX.paintVerso,view(5));
  const byText=Object.fromEntries(ops.filter(o=>o.kind==='text').map(o=>[o.text,o.fill]));
  assert.match(byText['WEEK'],/^rgb\(0,0,\d+\)$/,'kicker in accent');
  assert.match(byText['06'],/^rgb\(0,255,0\)$/,'numeral in ink');
  assert.match(byText['Mon Oct 12 – Sun Oct 18'],/^rgb\(0,255,0\)$/);
  assert.ok(ops.some(o=>o.kind==='fill'&&/^rgb\(\d+,0,0\)$/.test(o.fill)),'pencil strokes in R');
  assert.equal(TX.channel('G',.45),'rgb(0,115,0)');
});

test('wording comes from the view verbatim: no 23:59, no countdown digits, honest pending and quiz weeks',()=>{
  const all=[];
  for(let i=0;i<17;i++){const v=view(i);for(const fn of [TX.paintVerso,TX.paintRecto])all.push(...texts(painted(fn,v).ops));}
  const joined=all.join('\n');
  assert.doesNotMatch(joined,/23:59/);
  assert.doesNotMatch(joined,/\b\d+d \d+h\b|\b\d+h \d{2}m\b/,'no countdowns on paper');
  // Quiz week without a section: the bracket, the CTA, and no clock time anywhere on the spread.
  const quiz=view(5),qt=[...texts(painted(TX.paintVerso,quiz).ops),...texts(painted(TX.paintRecto,quiz).ops)];
  assert.ok(qt.includes('Lab Quiz 2'));
  assert.ok(qt.join(' ').includes('Choose section for quiz date'));
  assert.doesNotMatch(qt.join(' '),/\d{1,2}:\d{2}/);
  // Pending: "Date pending", never a day row or a clock.
  const pending=view(16),pt=[...texts(painted(TX.paintVerso,pending).ops),...texts(painted(TX.paintRecto,pending).ops)];
  assert.ok(pt.some(t=>t.includes('Date pending')));
  assert.ok(pt.join(' ').includes('Awaiting the official schedule'));
  assert.doesNotMatch(pt.join(' '),/\d{1,2}:\d{2}|\bMON\b|\bTUE\b/);
  // With section 1 the quiz has its lab day and time, verbatim from the resolver.
  const s1=view(5,{section:1});
  assert.ok(texts(painted(TX.paintVerso,s1).ops).includes('4:00 PM · POD367'));
  // Partial weeks: outside rows say so; the last spread keeps its one day.
  const first=texts(painted(TX.paintVerso,view(0)).ops);
  assert.ok(first.includes('before term')&&first.includes('Partial first week'));
  const last=texts(painted(TX.paintVerso,view(15)).ops);
  assert.ok(last.includes('after term')&&last.includes('Final day of the semester'));
  // An empty week says so (interface copy).
  assert.ok(texts(painted(TX.paintRecto,view(1)).ops).includes('Nothing scheduled'));
});

test('a dated item without a time keeps "Time not posted"; completion and passed states print their words',()=>{
  const base=view(6),entry=base.entries[0];
  const day={...entry,precision:'day',rowWhen:'POD367',label:'Time not posted',chip:null};
  const synthetic={...base,entries:[day],popups:[day.id]};
  assert.ok(texts(painted(TX.paintVerso,synthetic).ops).includes('POD367 · Time not posted'));
  const done=view(6,{completed:{midterm:true}});
  const rt=texts(painted(TX.paintRecto,done).ops);
  assert.ok(rt.includes('COMPLETED'),'the copy deck word, in caps');
  const passed=view(6,{now:timestamp('2026-10-24','12:00')});
  assert.ok(texts(painted(TX.paintRecto,passed).ops).some(t=>t.includes('Due time passed')));
});

test('poster faces print no words and no digits (ink 0)',()=>{
  for(const fn of [TX.paintVerso,TX.paintRecto]){
    const {ops}=painted(fn,view(5),{poster:true});
    assert.equal(ops.filter(o=>o.kind==='text'&&/\d/.test(o.text)).length,0);
    assert.equal(ops.filter(o=>o.kind==='text').length,0);
    assert.ok(ops.every(o=>o.kind!=='fill'||!/^rgb\(0,(?!0,)/.test(o.fill)),'no G ink');
  }
});

test('keep-out: verso text ends and recto text starts clear of the pop-up feet',()=>{
  const midterm=view(6),pending=view(16);
  const finalSpread={...midterm,entries:[...midterm.entries,...pending.entries],popups:['final','midterm']};
  for(const v of [view(5),midterm,pending,finalSpread]){
    const k=TX.keepOut(v);
    assert.ok(k.aMax>=.24*PAGE.W-1e-12&&k.aMax<=.35*PAGE.W);
    for(const t of painted(TX.paintVerso,v).rec.texts)assert.ok(t.x1<=k.versoRight+1,`verso "${t.text}" ${t.x1} > ${k.versoRight}`);
    for(const t of painted(TX.paintRecto,v).rec.texts)if(t.role!=='folio')assert.ok(t.x0>=k.rectoLeft-1,`recto "${t.text}" ${t.x0} < ${k.rectoLeft}`);
  }
  assert.ok(TX.keepOut(finalSpread).aMax>TX.keepOut(view(5)).aMax,'a final pushes the text further out');
});

test('informational text is at least 28 px; only caps labels and folios go smaller',()=>{
  for(let i=0;i<17;i++){
    const v=view(i,{section:i%3});
    for(const fn of [TX.paintVerso,TX.paintRecto])for(const compact of [false,true]){
      for(const t of painted(fn,v,{compact}).rec.texts){
        if(t.role==='info')assert.ok(t.size>=TX.MIN_INFO_PX-1e-9,`"${t.text}" at ${t.size}px`);
        else assert.ok(t.size>=18,`${t.role} "${t.text}" at ${t.size}px`);
      }
    }
  }
  const c=new MockCanvas(1280,960),rec=TX.paintLabel(c.ctx,view(5).entries[0],{x:0,y:0,w:640,h:240},{aspect:2.34});
  for(const t of rec.texts)if(t.role==='info')assert.ok(t.size>=TX.MIN_INFO_PX);
  assert.ok(rec.texts.find(t=>t.text==='Lab Quiz 2').size>=44,'tag line 1 stays large');
});

test('manual tracking works when the context has no letterSpacing',()=>{
  const c=new MockCanvas(1024,1486,{spacing:false});
  TX.paintVerso(c.ctx,view(5),{width:1024,height:1486});
  const ops=c.ctx.ops.filter(o=>o.kind==='text');
  assert.ok(ops.some(o=>o.text==='W')&&ops.some(o=>o.text==='K'),'caps labels drawn letter by letter');
});

/* ---- manager ---- */
function manager(options={}){
  const ctx=context(options.context),views=new Map();
  const getView=i=>{if(!views.has(i))views.set(i,describeSpread(ctx.weeks[i],ctx));return views.get(i);};
  let idleQueue=[];
  const tx=TX.createBookTextures({getView,tier:'high',createCanvas:(w,h)=>new MockCanvas(w,h),
    idle:fn=>{idleQueue.push(fn);return()=>{idleQueue=idleQueue.filter(f=>f!==fn);};},fonts:options.fonts||null,...options.tx});
  return {tx,ctx,views,flushIdle(){let n=0;while(idleQueue.length&&n<50){const fn=idleQueue.shift();fn({timeRemaining:()=>10});n++;}return n;},
    setView(i,v){views.set(i,v);}};
}

test('repaints happen only when a signature changes; a theme change paints nothing',()=>{
  const m=manager();
  m.tx.paint('L5');m.tx.paint('R5');
  assert.equal(m.tx.stats().paints,2);
  m.tx.paint('L5');m.tx.want(['L5','R5']);while(m.tx.pump());
  assert.equal(m.tx.stats().paints,2,'same view, same signature');
  // Theme: masks have no colour; nothing in the manager reads the theme.
  globalThis.document={documentElement:{dataset:{theme:'light'}}};
  try{m.tx.refresh();while(m.tx.pump());m.flushIdle();}finally{delete globalThis.document;}
  assert.equal(m.tx.stats().paints,2,'theme change → 0 paints');
  assert.doesNotMatch(m.tx.signature('L5'),/dark|light/);
  // Completion changes the view's signature: only the faces of that spread repaint.
  m.tx.paint('L6');m.tx.paint('R6');
  const before=m.tx.stats().paints,ctx=context({completed:{midterm:true}});
  m.setView(6,describeSpread(ctx.weeks[6],ctx));
  m.tx.want(['L5','R5','L6','R6']);m.tx.refresh();
  let pumped=0;while(m.tx.pump())pumped++;
  assert.equal(pumped,2);assert.equal(m.tx.stats().paints,before+2);
  // Busy frames paint at most one face each.
  m.setView(5,describeSpread(context({section:2}).weeks[5],context({section:2})));
  m.tx.refresh();assert.equal(m.tx.pump(),true);assert.equal(m.tx.stats().queued,1);
  m.tx.dispose();
});

test('the bucket follows the on-screen page and the tier; compact below 260 css px; fonts bump the signature',()=>{
  assert.equal(TX.bucketFor(393,2,'high'),1024);
  assert.equal(TX.bucketFor(393,1,'high'),512);
  assert.equal(TX.bucketFor(393,2,'mid'),768);
  assert.equal(TX.bucketFor(180,2,'high'),512);
  let loadingdone=null;
  const fonts={load:async()=>[],addEventListener:(type,fn)=>{if(type==='loadingdone')loadingdone=fn;},removeEventListener(){}};
  const m=manager({fonts});
  m.tx.want(['L5','R5']);while(m.tx.pump());
  const sig=m.tx.signature('L5');
  assert.equal(m.tx.setScreen(180,2),true);
  assert.equal(m.tx.stats().compact,true);
  const old=m.tx.face('L5');
  while(m.tx.pump());
  assert.notEqual(m.tx.face('L5'),old,'a new size is a new texture');
  assert.equal(m.tx.face('L5').image.width,512);
  assert.notEqual(m.tx.signature('L5'),sig);
  const painted=m.tx.stats().paints;
  loadingdone();m.flushIdle();
  assert.equal(m.tx.stats().paints,painted+2,'a late font repaints the live faces in idle time');
  m.tx.dispose();
});

test('picking regions: items, outer corners and the page',()=>{
  const m=manager();
  m.tx.paint('L6');m.tx.paint('R6');
  const items=m.tx.regions('R6').filter(r=>r.kind==='item');
  assert.equal(items.length,1);
  const r=items[0],u=(r.x0+r.x1)/2,v=1-(r.y0+r.y1)/2;
  assert.deepEqual({...m.tx.hit('R6',u,v),corner:undefined},{kind:'item',id:'midterm',open:'assessment-midterm',corner:undefined});
  assert.equal(m.tx.hit('R6',.97,.03).kind,'corner','recto outer corner is on the right');
  assert.equal(m.tx.hit('L6',.03,.97).kind,'corner','verso outer corner is on the left');
  assert.equal(m.tx.hit('L6',.97,.97).kind,'page');
  // The midterm row on the verso (Friday) maps back from flat coordinates.
  const row=m.tx.regions('L6').find(x=>x.kind==='item');
  const flatX=(1-(row.x0+row.x1)/2)*PAGE.W,flatY=(1-(row.y0+row.y1)/2)*PAGE.H;
  assert.equal(m.tx.hitFlat('L6',flatX,flatY).id,'midterm');
  assert.deepEqual(TX.faceUV('L',0,0),{u:1,v:0});
  m.tx.dispose();
});

test('label slots keep the tag aspect, share one atlas and repaint only their own slot',()=>{
  const m=manager(),entry=view(5).entries[0];
  const a=m.tx.labelSlot(entry,{aspect:2.34}),b=m.tx.labelSlot(view(6).entries[0],{aspect:2.18});
  assert.equal(a.texture,b.texture);
  const [W,H]=TX.TIER.high.atlas,px=r=>[(r[2]-r[0])*W,(r[3]-r[1])*H];
  const [aw,ah]=px(a.rect);assert.ok(Math.abs(aw/ah-2.34)<.02,`aspect ${aw/ah}`);
  for(const v of [...a.rect,...b.rect])assert.ok(v>=0&&v<=1);
  assert.ok(a.rect[0]>=b.rect[2]||b.rect[0]>=a.rect[2]||a.rect[1]>=b.rect[3]||b.rect[1]>=a.rect[3],'slots do not overlap');
  const paints=m.tx.stats().labelPaints;
  m.tx.labelSlot(entry,{aspect:2.34});assert.equal(m.tx.stats().labelPaints,paints,'unchanged label: no paint');
  m.tx.labelSlot({...entry,chip:'SOON'},{aspect:2.34});assert.equal(m.tx.stats().labelPaints,paints+1);
  // Eight slots, least recently used recycled.
  for(let i=0;i<10;i++)m.tx.labelSlot({...entry,id:'x'+i},{aspect:2});
  assert.equal(m.tx.stats().labels,8);
  m.tx.dispose();
});

test('LRU, pool and dispose keep memory bounded',()=>{
  const m=manager();
  for(let i=0;i<10;i++){m.tx.want([`L${i}`,`R${i}`]);while(m.tx.pump());}
  assert.ok(m.tx.stats().faces<=TX.TIER.high.lru,`faces ${m.tx.stats().faces}`);
  assert.ok(m.tx.stats().pool<=TX.POOL);
  const stamp=m.tx.stamp(),paper=m.tx.paper(),linen=m.tx.linen();
  assert.equal(stamp.image.width,256);
  assert.equal(paper.normal.image.width,256);assert.equal(linen.normal.image.width,512);
  assert.equal(m.tx.cover(),null,'deboss maps need a real canvas');
  const face=m.tx.face('L9');
  m.tx.dispose();
  assert.equal(face.image.width,0,'canvases are released');
  assert.equal(m.tx.stats().faces,0);
});

test('normal maps are unit length and seeded',()=>{
  const a=TX.paperTooth(64,17),b=TX.paperTooth(64,17),c=TX.paperTooth(64,18);
  assert.deepEqual(a.normal,b.normal);assert.notDeepEqual(a.normal,c.normal);
  const l=TX.linenWeave(64,8,3);
  for(const map of [a.normal,l.normal])for(let i=0;i<map.length;i+=4){
    const v=[0,1,2].map(k=>map[i+k]/255*2-1);assert.ok(Math.abs(Math.hypot(...v)-1)<.02);assert.ok(v[2]>0);
  }
  // A ramp rising toward +x leans its normals toward −x.
  const ramp=new Float32Array(16).map((_,i)=>i%4),n=TX.heightToNormal(ramp,4,4,{strength:1,wrap:false});
  assert.ok(n[5*4]<128);
});
