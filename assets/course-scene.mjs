import * as T from './vendor/three-0.186.1.mjs?v=20261012-subject1';
import {createCircuit} from './scenes/circuit.mjs?v=20261012-subject1';
import {createCalculus} from './scenes/calculus.mjs?v=20261012-subject1';
import {createAlgebra} from './scenes/algebra.mjs?v=20261012-subject1';
import {sceneMotionAllowed as motionAllowed} from './guide-motion.mjs?v=20261012-night2';
import {createStudioEnvironment} from './scenes/future-look.mjs?v=20261012-subject1';
import {framePose,posterPaths,rotationFitDistance} from './scenes/framing.mjs?v=20261012-subject1';
import {disposeScene} from './scenes/primitives.mjs?v=20261012-subject1';
import {createDragState} from './scenes/drag.mjs?v=20261012-subject1';
const palettes={cen100:{accent:'#edbba7',signal:'#ff7198'},mth140:{accent:'#b9dfc9',signal:'#ff8aa9'},mth141:{accent:'#d3c3ee',signal:'#ff8ab0'}};
export async function mountScene(art,course){
 const p=palettes[course],scene=new T.Scene(),camera=new T.PerspectiveCamera(33,1,.1,80),root=new T.Group();scene.add(root);
 const model=(course==='cen100'?createCircuit:course==='mth140'?createCalculus:createAlgebra)(p);root.add(model.root);
 const hemi=new T.HemisphereLight('#eff4ed','#1a1824',1.8),key=new T.DirectionalLight('#fff0e1',2.4),rim=new T.DirectionalLight(p.accent,1.4);key.position.set(-3,5,7);rim.position.set(4,-2,4);scene.add(hemi,key,rim);
 let poster=art.querySelector('.scene-poster');if(!poster){poster=document.createElement('img');poster.className='scene-poster';poster.alt='';Object.assign(poster.dataset,posterPaths(course));art.append(poster);}
 let canvas,renderer,environment,disposed=false,raf=0,visible=true,time=0,last=0,width=1,height=1,dirty=true,quality=1,frames=0,slow=0,ready=false,shaderFailure=false;
 let tx=0,ty=0,px=0,py=0,scroll=0,section=0,sectionGoal=0,impulse=0,impulseGoal=0,entrance=motionAllowed()?0:1;
 const drag=createDragState();let pointerId=null;
 const fine=matchMedia('(hover:hover) and (pointer:fine)'),coarse=matchMedia('(pointer:coarse)');
 function resetDrag(){const id=pointerId;pointerId=null;drag.cancel();art.dataset.dragging='false';if(id!==null&&art.hasPointerCapture?.(id))art.releasePointerCapture(id);}
 function software(){resetDrag();art.removeAttribute('tabindex');art.setAttribute('role','img');canvas?.remove();canvas=null;renderer?.dispose();environment?.dispose();renderer=environment=null;model.setQuality('software');art.dataset.renderer='poster';}
 canvas=document.createElement('canvas');canvas.className='course-scene';canvas.setAttribute('aria-hidden','true');
 try{
  const gl=canvas.getContext('webgl2',{alpha:true,antialias:true,powerPreference:'high-performance'});if(!gl)throw Error('No WebGL2');
  renderer=new T.WebGLRenderer({canvas,context:gl,alpha:true,antialias:true,powerPreference:'high-performance'});renderer.debug.checkShaderErrors=true;renderer.debug.onShaderError=()=>{shaderFailure=true;art.dataset.sceneFailure='shader';};renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.info.autoReset=false;
  const pmrem=new T.PMREMGenerator(renderer),room=createStudioEnvironment(p);
  try{environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;scene.environmentIntensity=.48;}finally{disposeScene(room);pmrem.dispose();}
  if(shaderFailure)throw Error('Shader failure');model.setQuality('full');art.append(canvas);art.dataset.renderer='webgl2';
 }catch{software();}
 function size(){
  const r=art.getBoundingClientRect();width=Math.max(1,art.clientWidth||r.width);height=Math.max(1,art.clientHeight||r.height);camera.aspect=width/height;camera.updateProjectionMatrix();
  art.dataset.portrait=String(width<680);const src=width<680?poster.dataset.tall:poster.dataset.wide;if(src&&poster.getAttribute('src')!==src)poster.src=src;
  const dpr=Math.min(devicePixelRatio||1,coarse.matches?1.5:1.8)*quality;if(renderer){renderer.setPixelRatio(dpr);renderer.setSize(width,height,false);}dirty=true;wake();
 }
 function update(dt,still){
  if(!still)drag.step(dt);const blend=still?1:1-Math.exp(-dt*5);impulseGoal=Math.max(0,impulseGoal-dt*.65);impulse+=(impulseGoal-impulse)*blend;px+=(tx-px)*blend;py+=(ty-py)*blend;section+=(sectionGoal-section)*blend;entrance=still?1:Math.min(1,entrance+dt*.65);
  const entry=1-(1-entrance)**3,pose=framePose(course,width,height);camera.position.set(0,0,pose.distance*(1+(1-entry)*.2));camera.lookAt(0,0,0);camera.updateMatrixWorld();root.position.set(...pose.position);
  root.rotation.set(pose.rotation[0]+drag.pitch+py*.06,pose.rotation[1]+drag.yaw+px*.08+section*.3+Math.sin(time*.24)*.14,pose.rotation[2]+(1-entry)*.18);
  camera.position.z=Math.max(camera.position.z,rotationFitDistance(course,width/height,[root.rotation.x,root.rotation.y,root.rotation.z],time));camera.updateMatrixWorld();model.update(time,still?0:dt,{still,impulse});art.dataset.rotation=`${drag.yaw.toFixed(3)},${drag.pitch.toFixed(3)}`;root.updateMatrixWorld(true);key.position.x=-3+px*4;
 }
 function frame(now){
  raf=0;if(disposed||document.hidden||!visible)return;const allowed=motionAllowed(),elapsed=last?now-last:16.7;
  if(renderer&&allowed&&quality<1&&last&&elapsed<30){raf=requestAnimationFrame(frame);return;}last=now;const dt=Math.min(.05,elapsed/1000);if(allowed&&renderer)time+=dt;
  if((renderer&&allowed)||dirty){
   if(renderer){update(dt,!allowed);try{renderer.info.reset();renderer.render(scene,camera);if(shaderFailure)software();}catch{software();}}
   dirty=false;art.dataset.sceneReady='true';art.dataset.motionState=allowed?'running':'still';art.dataset.sceneFrame=String(++frames);
   if(renderer&&frames%60===0){art.dataset.sceneTime=time.toFixed(2);art.dataset.drawCalls=String(renderer.info.render.calls);art.dataset.triangles=String(renderer.info.render.triangles);}
   if(renderer&&allowed&&frames>60){slow+=elapsed>27?1:0;if(frames%180===0){if(slow>70&&quality===1){quality=.72;model.setQuality('balanced');art.dataset.quality='balanced';size();}slow=0;}}
  }
  if(renderer&&allowed&&!raf)raf=requestAnimationFrame(frame);
 }
 function wake(){art.dataset.awake=String(visible&&!document.hidden&&!disposed);if(ready&&!raf&&!disposed&&visible&&!document.hidden){last=0;raf=requestAnimationFrame(frame);}}
 const resize=new ResizeObserver(size);resize.observe(art);
 const intersection=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;art.dataset.awake=String(visible&&!document.hidden);if(visible){dirty=true;wake();}else{resetDrag();cancelAnimationFrame(raf);raf=0;}},{threshold:0});intersection.observe(art);
 const onVisibility=()=>{art.dataset.awake=String(visible&&!document.hidden);if(document.hidden){resetDrag();cancelAnimationFrame(raf);raf=0;}else{dirty=true;wake();}};
 const onMotion=()=>{resetDrag();cancelAnimationFrame(raf);raf=0;dirty=true;wake();};
 const onScroll=()=>{if(visible)scroll=Math.max(0,Math.min(1,-art.getBoundingClientRect().top/height));};
 const onDown=e=>{if(!renderer||!motionAllowed()||(e.button!==undefined&&e.button!==0)||pointerId!==null)return;pointerId=e.pointerId;drag.begin(e.clientX,e.clientY,e.timeStamp);art.setPointerCapture?.(pointerId);art.dataset.dragging='true';};
 const onPointer=e=>{if(pointerId===e.pointerId&&drag.active){drag.move(e.clientX,e.clientY,e.timeStamp,width);dirty=true;wake();return;}if(!fine.matches||!motionAllowed()||e.pointerType==='touch')return;const r=art.getBoundingClientRect();tx=(e.clientX-r.left)/r.width-.5;ty=(e.clientY-r.top)/r.height-.5;};
 const onUp=e=>{if(e.pointerId!==pointerId)return;drag.end(e.timeStamp);pointerId=null;art.dataset.dragging='false';dirty=true;wake();};
 const onCancel=()=>{if(pointerId===null)return;drag.cancel();pointerId=null;art.dataset.dragging='false';};
 const onKey=e=>{if(!renderer||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;e.preventDefault();if(e.key==='Home'){drag.yaw=drag.pitch=0;}else{drag.yaw+=(e.key==='ArrowRight'?.18:e.key==='ArrowLeft'?-.18:0);drag.pitch=Math.max(-.9,Math.min(.9,drag.pitch+(e.key==='ArrowDown'?.12:e.key==='ArrowUp'?-.12:0)));}drag.cancel();dirty=true;wake();};
 const onLeave=()=>{tx=ty=0;};const onView=e=>{sectionGoal=e.detail==='study'?.45:e.detail==='info'?-.45:0;impulseGoal=1;dirty=true;wake();};const onComplete=()=>{model.react();impulseGoal=1;dirty=true;wake();};const onImpulse=()=>{if(motionAllowed()){impulseGoal=1;model.react();dirty=true;wake();}};
 const header=art.parentElement;const urgency=()=>{model.urgency?.(header.dataset.urgency||'calm');dirty=true;wake();};const status=new MutationObserver(urgency);status.observe(header,{attributes:true,attributeFilter:['data-urgency']});
 const lost=e=>{e.preventDefault();software();dirty=true;wake();};canvas?.addEventListener('webglcontextlost',lost,{once:true});
 art.addEventListener('pointerdown',onDown);art.addEventListener('pointermove',onPointer);art.addEventListener('pointerup',onUp);art.addEventListener('pointercancel',onCancel);art.addEventListener('lostpointercapture',onCancel);art.addEventListener('keydown',onKey);art.addEventListener('pointerleave',onLeave);document.addEventListener('visibilitychange',onVisibility);document.addEventListener('guide-motion-change',onMotion);document.addEventListener('workspace-changed',onView);document.addEventListener('guide-completion',onComplete);document.addEventListener('guide-scene-impulse',onImpulse);window.addEventListener('scroll',onScroll,{passive:true});
 function pagehide(e){if(e.persisted){resetDrag();cancelAnimationFrame(raf);raf=0;art.dataset.awake='false';}else dispose();}function pageshow(e){if(e.persisted){dirty=true;wake();}}
 function dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);raf=0;art.dataset.awake='false';resize.disconnect();intersection.disconnect();status.disconnect();model.dispose();renderer?.dispose();environment?.dispose();canvas?.removeEventListener('webglcontextlost',lost);art.removeEventListener('pointerdown',onDown);art.removeEventListener('pointermove',onPointer);art.removeEventListener('pointerup',onUp);art.removeEventListener('pointercancel',onCancel);art.removeEventListener('lostpointercapture',onCancel);art.removeEventListener('keydown',onKey);art.removeEventListener('pointerleave',onLeave);document.removeEventListener('visibilitychange',onVisibility);document.removeEventListener('guide-motion-change',onMotion);document.removeEventListener('workspace-changed',onView);document.removeEventListener('guide-completion',onComplete);document.removeEventListener('guide-scene-impulse',onImpulse);window.removeEventListener('scroll',onScroll);window.removeEventListener('pagehide',pagehide);window.removeEventListener('pageshow',pageshow);}
 window.addEventListener('pagehide',pagehide);window.addEventListener('pageshow',pageshow);
 urgency();size();if(renderer)update(0,!motionAllowed());
 if(renderer){try{await renderer.compileAsync(scene,camera);if(shaderFailure&&!disposed)software();}catch{if(!disposed)software();}}
 if(disposed)return{dispose};ready=true;wake();return{dispose};
}
