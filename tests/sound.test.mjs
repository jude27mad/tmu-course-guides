import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../tools/ui-build/package.json',import.meta.url));
const {JSDOM}=require('jsdom'),{build}=require('esbuild');
const names=['page-turn','cover-open','cover-close','book-set-down','popup-unfold'];
let code;
async function fixture({saved=false,activated=false,reduced=false,motion='',controller=true}={}){
 code??=(await build({stdin:{contents:"import * as sound from './assets/night/core.mjs'; window.sound=sound;",resolveDir:new URL('..',import.meta.url).pathname},bundle:true,format:'iife',write:false,logLevel:'silent',plugins:[{name:'module-url',setup(b){b.onLoad({filter:/core\.mjs$/},async a=>({contents:(await readFile(a.path,'utf8')).replaceAll('import.meta.url',JSON.stringify('https://guide.test/assets/night/core.mjs')),loader:'js'}));}}]})).outputFiles[0].text;
 const dom=new JSDOM('<!doctype html><body data-course="mth140"></body>',{url:'https://guide.test/mth140/?motion='+motion,runScripts:'outside-only'}),w=dom.window;
 const policy={motion:true,scene:true},activation={hasBeenActive:activated,isActive:activated},contexts=[];
 let now=1000;
 w.matchMedia=query=>({matches:query.includes('prefers-reduced-motion')&&reduced,addEventListener(){},removeEventListener(){}});
 if(controller)w.GuideMotion={motionAllowed:()=>policy.motion,sceneMotionAllowed:()=>policy.scene,preference:()=>({})};
 Object.defineProperty(w.navigator,'userActivation',{configurable:true,value:activation});
 w.performance.now=()=>now;
 if(saved)w.localStorage.setItem('tmu-guide-sound-v1','true');
 class Param{constructor(){this.value=0;this.values=[];}setValueAtTime(v,t){this.values.push([v,t]);}linearRampToValueAtTime(v,t){this.values.push([v,t]);}exponentialRampToValueAtTime(v,t){this.values.push([v,t]);}}
 class Node{constructor(type){this.type=type;this.gain=new Param();this.frequency=new Param();this.Q=new Param();this.connections=[];this.disconnected=false;}connect(node){this.connections.push(node);return node;}disconnect(){this.disconnected=true;}start(...args){this.started=args;}stop(...args){this.stopped=args;}}
 class AudioContext{
  constructor(){this.state='suspended';this.sampleRate=48000;this.destination={};this.nodes=[];this.buffers=[];this.resumes=0;contexts.push(this);}
  get currentTime(){return now/1000;}
  node(type){const node=new Node(type);this.nodes.push(node);return node;}
  createGain(){return this.node('gain');}createOscillator(){return this.node('oscillator');}createBufferSource(){return this.node('source');}createBiquadFilter(){return this.node('filter');}
  createBuffer(channels,length,sampleRate){const data=new Float32Array(length),buffer={length,sampleRate,getChannelData:()=>data};this.buffers.push(buffer);return buffer;}
  resume(){this.resumes++;this.state='running';return Promise.resolve();}
 }
 w.AudioContext=AudioContext;w.eval(code);
 return {w,dom,sound:w.sound,contexts,policy,activation,advance:ms=>now+=ms,close:()=>dom.window.close()};
}

test('sound stays off by default and enabling it persists silently until an allowed play',async()=>{
 const f=await fixture({activated:true});try{
  assert.equal(f.sound.soundEnabled(),false);assert.equal(f.sound.play('page-turn'),false);assert.equal(f.contexts.length,0);
  let detail;f.w.document.addEventListener('night-sound',e=>detail=e.detail);
  f.sound.setSound(true);assert.equal(detail,true);assert.equal(f.w.localStorage.getItem('tmu-guide-sound-v1'),'true');assert.equal(f.contexts.length,0);
  assert.equal(f.sound.play('page-turn'),true);assert.equal(f.contexts.length,1);assert.equal(f.contexts[0].resumes,1);
  f.sound.setSound(false);assert.equal(f.sound.play('cover-open'),false);assert.equal(f.contexts.length,1);
 }finally{f.close();}
});

test('saved opt-in still requires a user gesture before creating the shared context',async()=>{
 const f=await fixture({saved:true});try{
  assert.equal(f.sound.soundEnabled(),true);assert.equal(f.sound.play('cover-open'),false);assert.equal(f.contexts.length,0);
  delete f.w.navigator.userActivation;
  f.w.document.dispatchEvent(new f.w.Event('pointerdown',{bubbles:true}));
  assert.equal(f.sound.play('cover-open'),false,'synthetic gestures do not unlock audio');
  Object.defineProperty(f.w.navigator,'userActivation',{value:f.activation});f.activation.hasBeenActive=true;
  assert.equal(f.sound.play('cover-open'),true);assert.equal(f.contexts.length,1);
 }finally{f.close();}
});

for(const options of [{reduced:true},{motion:'off'},{controller:false,reduced:true}])test('paper sound obeys reduced/off policy '+JSON.stringify(options),async()=>{
 const f=await fixture({...options,saved:true,activated:true});try{for(const name of names)assert.equal(f.sound.play(name),false);assert.equal(f.contexts.length,0);}finally{f.close();}
});

test('motion controller and saved scene pause gate later plays without recreating audio',async()=>{
 const f=await fixture({saved:true,activated:true});try{
  f.policy.motion=false;assert.equal(f.sound.play('popup-unfold'),false);assert.equal(f.contexts.length,0);
  f.policy.motion=true;assert.equal(f.sound.play('popup-unfold'),true);
  const before=f.contexts[0].nodes.length;f.policy.scene=false;assert.equal(f.sound.play('cover-close'),false);
  assert.equal(f.contexts[0].nodes.length,before);assert.equal(f.contexts.length,1);
 }finally{f.close();}
});

test('five paper actions synthesize bounded sounds and reject retired or unknown names',async()=>{
 const f=await fixture({saved:true,activated:true});try{
  for(const name of ['tick','chime','whoosh','pop','unknown'])assert.equal(f.sound.play(name),false);
  assert.equal(f.contexts.length,0);
  for(const name of names){assert.equal(f.sound.play(name,{intensity:.6}),true,name);f.advance(150);}
  assert.equal(f.contexts.length,1);const ctx=f.contexts[0],sources=ctx.nodes.filter(node=>node.started);
  assert.equal(sources.filter(node=>node.buffer).length,5,'each paper action includes filtered noise');
  assert.ok(sources.some(node=>!node.buffer),'covers and book use resonant thumps');
  for(const node of sources){assert.ok(node.stopped[0]>node.started[0]);assert.ok(node.stopped[0]-node.started[0]<=.6);}
  for(const node of ctx.nodes)for(const param of [node.gain,node.frequency,node.Q])for(const [value,time] of param.values){assert.ok(Number.isFinite(value));assert.ok(Number.isFinite(time));}
  assert.equal(ctx.buffers.length,1,'one cached noise buffer serves every name');
  for(const node of sources)node.onended?.();
  assert.ok(ctx.nodes.every(node=>node.disconnected),'finished sources release their connected nodes');
 }finally{f.close();}
});

test('page turns allow at most one sound per 120 ms and per changed spread',async()=>{
 const f=await fixture({saved:true,activated:true});try{
  assert.equal(f.sound.play('page-turn',{spread:1}),true);
  f.advance(119);assert.equal(f.sound.play('page-turn',{spread:2}),false);
  f.advance(1);assert.equal(f.sound.play('page-turn',{spread:2}),true);
  f.advance(120);assert.equal(f.sound.play('page-turn',{spread:2}),false);
  assert.equal(f.sound.play('page-turn',{spread:3}),true);
  f.advance(120);assert.equal(f.sound.play('page-turn',{spread:1}),true,'returning to a prior spread is a new change');
  f.advance(120);f.sound.setRoute('cen100');assert.equal(f.sound.play('page-turn',{spread:1}),true,'the same week in another course is a new spread');
  f.advance(120);assert.equal(f.sound.play('page-turn'),true);assert.equal(f.sound.play('page-turn'),false,'callers without a spread still obey the time limit');
  const ctx=f.contexts[0];assert.equal(ctx.nodes.filter(node=>node.buffer&&node.started).length,6);assert.equal(ctx.buffers.length,1);
 }finally{f.close();}
});

test('intensity controls output volume, clamps excess and avoids allocation for silence',async()=>{
 const f=await fixture({saved:true,activated:true});try{
  for(const intensity of [0,-1])assert.equal(f.sound.play('cover-open',{intensity}),false);assert.equal(f.contexts.length,0);
  for(const intensity of [.25,1,10])assert.equal(f.sound.play('cover-open',{intensity}),true);
  const ctx=f.contexts[0],gains=ctx.nodes.filter(node=>node.connections.includes(ctx.destination)).map(node=>node.gain.value);
  assert.equal(gains.length,3);assert.ok(gains[0]>0);assert.equal(gains[0],gains[1]/4);assert.equal(gains[2],gains[1]);
 }finally{f.close();}
});

test('unsupported WebAudio leaves the opt-in service usable',async()=>{
 const f=await fixture({saved:true,activated:true});try{delete f.w.AudioContext;assert.equal(f.sound.play('book-set-down'),false);assert.equal(f.sound.soundEnabled(),true);}finally{f.close();}
});
