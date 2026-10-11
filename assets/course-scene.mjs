import * as T from './vendor/three-0.186.1.mjs?v=20261011-cinema3';
import {createCircuit} from './scenes/circuit.mjs?v=20261011-cinema3';
import {createCalculus} from './scenes/calculus.mjs?v=20261011-cinema3';
import {createAlgebra} from './scenes/algebra.mjs?v=20261011-cinema3';
import {sceneMotionAllowed as motionAllowed} from './guide-motion.mjs?v=20261011-cinema3';
const palettes={cen100:{accent:'#edbba7',signal:'#ff7198'},mth140:{accent:'#b9dfc9',signal:'#ff8aa9'},mth141:{accent:'#d3c3ee',signal:'#ff8ab0'}};
// A single lifecycle owns GPU and software rendering. Both draw the same models.
export async function mountScene(art,course){
 const p=palettes[course],scene=new T.Scene(),camera=new T.PerspectiveCamera(33,1,.1,80),root=new T.Group();scene.add(root);
 const model=(course==='cen100'?createCircuit:course==='mth140'?createCalculus:createAlgebra)(p);root.add(model.root);
 const hemi=new T.HemisphereLight('#eff4ed','#1a1824',2.2),key=new T.DirectionalLight('#fff0e1',4.5),rim=new T.DirectionalLight(p.accent,4);key.position.set(-3,5,7);rim.position.set(4,-2,4);scene.add(hemi,key,rim);
 let canvas,renderer,context,environment;let disposed=false,raf=0,visible=true,time=0,last=0,width=1,height=1,dirty=true,quality=1,frames=0,slow=0,ready=false;
 let tx=0,ty=0,px=0,py=0,scroll=0,section=0,sectionGoal=0,impulse=0,impulseGoal=0,entrance=motionAllowed()?0:1;
 const fine=matchMedia('(hover:hover) and (pointer:fine)'),coarse=matchMedia('(pointer:coarse)');
 function makeCanvas(){const el=document.createElement('canvas');el.className='course-scene';el.setAttribute('aria-hidden','true');return el;}
 function software(){canvas?.remove();renderer?.dispose();environment?.dispose();renderer=null;canvas=makeCanvas();context=canvas.getContext('2d',{alpha:true});art.append(canvas);art.dataset.renderer='canvas2d';}
 canvas=makeCanvas();
 try{const gl=canvas.getContext('webgl2',{alpha:true,antialias:true,powerPreference:'high-performance'});if(!gl)throw Error('No WebGL2');renderer=new T.WebGLRenderer({canvas,context:gl,alpha:true,antialias:true,powerPreference:'high-performance'});renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  const pmrem=new T.PMREMGenerator(renderer),room=new T.RoomEnvironment();environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;scene.environmentIntensity=.75;room.dispose();pmrem.dispose();art.append(canvas);art.dataset.renderer='webgl2';
 }catch{software();}
 const projected=new T.Vector3();
 function project(point){projected.set(...point).applyMatrix4(root.matrixWorld).project(camera);return[(projected.x*.5+.5)*width,(-projected.y*.5+.5)*height,projected.z];}
 function drawSoftware(){
  if(!context)return;const ctx=context,dpr=canvas.width/width;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  const primitives=model.sketch().map(shape=>({...shape,projected:shape.points.map(project)})).sort((a,b)=>{if(course==='cen100'&&(a.kind==='poly')!==(b.kind==='poly'))return a.kind==='poly'?-1:1;return b.projected.reduce((v,p)=>v+p[2],0)/b.projected.length-a.projected.reduce((v,p)=>v+p[2],0)/a.projected.length;});
  for(const shape of primitives){if(!shape.points.length)continue;const points=shape.projected;ctx.beginPath();ctx.globalAlpha=shape.alpha??1;ctx.lineWidth=shape.width??1;ctx.lineJoin='round';ctx.lineCap='round';ctx.strokeStyle=shape.stroke||'transparent';ctx.shadowBlur=shape.glow||0;ctx.shadowColor=shape.stroke||'transparent';
   if(shape.kind==='dot'){ctx.arc(points[0][0],points[0][1],shape.radius||3,0,Math.PI*2);ctx.fillStyle=shape.stroke;ctx.fill();}
   else{ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);if(shape.kind==='poly'){ctx.closePath();const gradient=ctx.createLinearGradient(points[0][0],points[0][1],points[2][0]+1,points[2][1]+1);if(shape.metal){gradient.addColorStop(0,'#e8e9ec');gradient.addColorStop(.18,shape.fill);gradient.addColorStop(.43,shape.fill);gradient.addColorStop(.5,'#f4eee9');gradient.addColorStop(.58,shape.fill);gradient.addColorStop(1,course==='cen100'?'#1b2b35':'#4a5a66');}else{gradient.addColorStop(0,shape.fill);gradient.addColorStop(1,shape.fill);}ctx.fillStyle=gradient;ctx.fill();}ctx.stroke();}
  }ctx.globalAlpha=1;ctx.shadowBlur=0;
 }
 function size(){const r=art.getBoundingClientRect();width=Math.max(1,art.clientWidth||r.width);height=Math.max(1,art.clientHeight||r.height);camera.aspect=width/height;camera.updateProjectionMatrix();const dpr=Math.min(devicePixelRatio||1,coarse.matches?1.5:1.8)*quality;if(renderer){renderer.setPixelRatio(dpr);renderer.setSize(width,height,false);}else{canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}dirty=true;wake();}
 function update(dt,still){const blend=still?1:1-Math.exp(-dt*5);impulseGoal=Math.max(0,impulseGoal-dt*.65);impulse+=(impulseGoal-impulse)*blend;px+=(tx-px)*blend;py+=(ty-py)*blend;section+=(sectionGoal-section)*blend;entrance=still?1:Math.min(1,entrance+dt*.65);const entry=1-(1-entrance)**3,mobile=width<650;
  // Macro composition: intentionally cropped, with the subject occupying the hero.
  const vertical=mobile?model.bounds[1]*1.45:model.bounds[1]*1.03;
  const distance=vertical/(2*Math.tan(camera.fov*Math.PI/360));camera.position.set(0,0,distance*(1+(1-entry)*.55-impulse*.14));camera.lookAt(0,0,0);camera.updateMatrixWorld();
  root.position.set(mobile?0:vertical*camera.aspect*.17,mobile?-vertical*.14:0,0);
  root.rotation.set((course==='cen100'?-.62:.42)+py*.24+scroll*.32+impulse*.24,(course==='cen100'?-.3:-.48)+px*.38+section+(still?0:Math.sin(time*.3)*.32)+impulse*.38,(course==='cen100'?-.18:-.18)+(1-entry)*.35);
  model.update(time,dt,{still,impulse});root.updateMatrixWorld(true);key.position.x=-3+px*4;
 }
 function frame(now){raf=0;if(disposed||document.hidden||!visible)return;const allowed=motionAllowed(),elapsed=last?now-last:16.7;if(allowed&&quality<1&&last&&elapsed<30){raf=requestAnimationFrame(frame);return;}last=now;const dt=Math.min(.05,elapsed/1000);if(allowed)time+=dt;
  if(allowed||dirty){update(dt,!allowed);try{if(renderer)renderer.render(scene,camera);else drawSoftware();}catch{software();size();drawSoftware();}dirty=false;art.dataset.sceneReady='true';art.dataset.motionState=allowed?'running':'still';art.dataset.sceneFrame=String(++frames);if(frames%60===0){art.dataset.sceneTime=time.toFixed(2);art.dataset.drawCalls=String(renderer?.info.render.calls??model.sketch().length);}
   if(allowed&&frames>60){slow+=elapsed>27?1:0;if(frames%180===0){if(slow>70&&quality===1){quality=.72;art.dataset.quality='balanced';size();}slow=0;}}
  }if(allowed&&!raf)raf=requestAnimationFrame(frame);
 }
 function wake(){if(ready&&!raf&&!disposed&&visible&&!document.hidden){last=0;raf=requestAnimationFrame(frame);}}
 const resize=new ResizeObserver(size);resize.observe(art);
 const intersection=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible){dirty=true;wake();}else{cancelAnimationFrame(raf);raf=0;}},{threshold:0});intersection.observe(art);
 const onVisibility=()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else{dirty=true;wake();}};
 const onMotion=()=>{cancelAnimationFrame(raf);raf=0;dirty=true;wake();};
 const onScroll=()=>{if(visible)scroll=Math.max(0,Math.min(1,-art.getBoundingClientRect().top/height));};
 const onPointer=e=>{if(!fine.matches||!motionAllowed()||e.pointerType==='touch')return;const r=art.getBoundingClientRect();tx=(e.clientX-r.left)/r.width-.5;ty=(e.clientY-r.top)/r.height-.5;};
 const onLeave=()=>{tx=ty=0;};const onView=e=>{sectionGoal=e.detail==='study'?.45:e.detail==='info'?-.45:0;impulseGoal=1;dirty=true;wake();};const onComplete=()=>{model.react?.();impulseGoal=1;dirty=true;wake();};const onImpulse=()=>{if(motionAllowed()){impulseGoal=1;model.react?.();dirty=true;wake();}};
 const header=art.parentElement;const urgency=()=>{model.urgency?.(header.dataset.urgency||'calm');dirty=true;wake();};const status=new MutationObserver(urgency);status.observe(header,{attributes:true,attributeFilter:['data-urgency']});
 const lost=e=>{e.preventDefault();software();size();dirty=true;wake();};canvas.addEventListener('webglcontextlost',lost,{once:true});
 art.addEventListener('pointermove',onPointer);art.addEventListener('pointerleave',onLeave);document.addEventListener('visibilitychange',onVisibility);document.addEventListener('guide-motion-change',onMotion);document.addEventListener('workspace-changed',onView);document.addEventListener('guide-completion',onComplete);document.addEventListener('guide-scene-impulse',onImpulse);window.addEventListener('scroll',onScroll,{passive:true});
 function pagehide(e){if(e.persisted){cancelAnimationFrame(raf);raf=0;}else dispose();}function pageshow(e){if(e.persisted){dirty=true;wake();}}
 function dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);resize.disconnect();intersection.disconnect();status.disconnect();model.dispose();renderer?.dispose();environment?.dispose();art.removeEventListener('pointermove',onPointer);art.removeEventListener('pointerleave',onLeave);document.removeEventListener('visibilitychange',onVisibility);document.removeEventListener('guide-motion-change',onMotion);document.removeEventListener('workspace-changed',onView);document.removeEventListener('guide-completion',onComplete);document.removeEventListener('guide-scene-impulse',onImpulse);window.removeEventListener('scroll',onScroll);window.removeEventListener('pagehide',pagehide);window.removeEventListener('pageshow',pageshow);}
 window.addEventListener('pagehide',pagehide);window.addEventListener('pageshow',pageshow);
 urgency();size();update(0,!motionAllowed());
 if(renderer){try{await renderer.compileAsync(scene,camera);}catch{if(!disposed){software();size();}}}
 if(disposed)return{dispose};ready=true;wake();return{dispose};
}
