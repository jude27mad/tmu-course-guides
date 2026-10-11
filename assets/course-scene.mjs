import * as T from './vendor/three-0.186.1.mjs';
import {createCircuit} from './scenes/circuit.mjs';
import {createCalculus} from './scenes/calculus.mjs';
import {createAlgebra} from './scenes/algebra.mjs';
import {motionAllowed} from './guide-motion.mjs';
const palettes={cen100:{surface:'#edc6b5',accent:'#edbba7',ink:'#954424',signal:'#e64d81',grid:'#954424'},mth140:{surface:'#d4ecdf',accent:'#b9dfc9',ink:'#096450',signal:'#cc577b',grid:'#096450'},mth141:{surface:'#e7ddf2',accent:'#d3c3ee',ink:'#694392',signal:'#dc618f',grid:'#694392'}};
export async function mountScene(art,course){
 const palette=palettes[course],scene=new T.Scene(),camera=new T.PerspectiveCamera(34,1,.1,60),root=new T.Group();scene.add(root);
 const model=(course==='cen100'?createCircuit:course==='mth140'?createCalculus:createAlgebra)(palette);root.add(model.root);
 const ambient=new T.HemisphereLight('#fff8f2','#637b8b',2.6),key=new T.DirectionalLight('#fff8ef',3.5),rim=new T.DirectionalLight('#d1e8ff',2.2);key.position.set(-3,5,8);rim.position.set(4,-2,5);scene.add(ambient,key,rim);
 // A soft procedural contact shadow avoids a blur pass and shadow-map redraws.
 const shadowMat=new T.MeshBasicNodeMaterial({transparent:true,depthWrite:false,color:palette.ink});shadowMat.opacityNode=T.float(1).sub(T.smoothstep(.08,.5,T.uv().sub(.5).length())).mul(.13);
 const shadow=new T.Mesh(new T.PlaneGeometry(7,5.4),shadowMat);shadow.position.set(0,-.2,-.53);root.add(shadow);
 const canvas=document.createElement('canvas');canvas.className='course-scene';canvas.setAttribute('aria-hidden','true');
 let renderer,ready=false,disposed=false,failed=false,raf=0,visible=true,time=0,last=0,frames=0,slow=0,quality=1,dirty=true;
 const small=matchMedia('(pointer: coarse)'),fine=matchMedia('(hover: hover) and (pointer: fine)');
 let width=1,height=1,px=0,py=0,tx=0,ty=0,scroll=0,section=0;
 function fallback(){if(failed)return;failed=true;cancelAnimationFrame(raf);raf=0;art.dataset.renderer='unavailable';art.dataset.sceneReady='false';canvas.remove();void renderer?.dispose().catch(()=>{});}
 try{renderer=new T.WebGPURenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;await renderer.init();}catch{fallback();model.dispose();shadow.geometry.dispose();shadowMat.dispose();return null;}
 if(!art.isConnected){renderer.dispose();model.dispose();return null;}
 const labels=document.createElement('div');labels.className='scene-labels';labels.setAttribute('aria-hidden','true');const labelNodes=(model.labels||[]).map(label=>{const node=document.createElement('span');node.textContent=label.text;labels.append(node);return{...label,node};});const projected=new T.Vector3();
 art.append(canvas,labels);art.dataset.renderer=renderer.backend.isWebGPUBackend?'webgpu':'webgl2';
 function size(){const rect=art.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio||1,small.matches?1.4:2)*quality);renderer.setSize(width,height,false);
 const [w,h]=model.bounds,vertical=Math.max(h,w/camera.aspect),distance=vertical/(2*Math.tan(camera.fov*Math.PI/360));camera.position.set(0,0,distance*.94);camera.lookAt(0,0,0);dirty=true;wake();}
 function theme(){const style=getComputedStyle(document.body),dark=style.colorScheme==='dark'||document.documentElement.dataset.theme==='dark';ambient.intensity=dark?2:2.6;renderer.toneMappingExposure=dark?1:1.08;dirty=true;wake();}
 function update(t,dt,still){const blend=1-Math.exp(-dt*5);px+=(tx-px)*blend;py+=(ty-py)*blend;root.rotation.set((course==='cen100'?-.56:-.23)+py*.07-scroll*.055,(course==='cen100'?-.3:-.2)+px*.09+section,-.07);root.position.y=still?0:Math.sin(t*.48)*.035;key.position.x=-3+px*2;model.update(t,dt,{still});}
 function frame(now){raf=0;if(disposed||failed||document.hidden||!visible)return;const allowed=motionAllowed(),elapsed=last?(now-last):16.7;if(allowed&&quality<1&&elapsed<32){raf=requestAnimationFrame(frame);return;}last=now;const dt=Math.min(.05,elapsed/1000);if(allowed)time+=dt;
 if(allowed||dirty){update(time,dt,!allowed);try{renderer.render(scene,camera);for(const label of labelNodes){projected.copy(label.position).applyMatrix4(label.parent.matrixWorld).project(camera);label.node.style.transform=`translate(${(projected.x*.5+.5)*width+5}px,${(-projected.y*.5+.5)*height-15}px)`;}}catch{fallback();return;}dirty=false;if(art.dataset.sceneReady!=='true'){art.dataset.sceneReady='true';art.dataset.motionState=allowed?'running':'still';}
 if(allowed&&frames++>90){slow+=elapsed>25?1:0;if(frames>210){if(slow>65&&quality===1){quality=.78;size();art.dataset.quality='balanced';}frames=90;slow=0;}}}
 if(allowed)raf=requestAnimationFrame(frame);}
 function wake(){if(ready&&!raf&&!failed&&!disposed&&!document.hidden&&visible){last=0;raf=requestAnimationFrame(frame);}}
 const resize=new ResizeObserver(size);resize.observe(art);
 const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible){dirty=true;wake();}else{cancelAnimationFrame(raf);raf=0;}},{threshold:0});observer.observe(art);
 const onVisibility=()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else{dirty=true;wake();}};
 const onMotion=()=>{cancelAnimationFrame(raf);raf=0;art.dataset.motionState=motionAllowed()?'running':'still';dirty=true;wake();};
 const onScroll=()=>{if(!visible||!motionAllowed())return;scroll=Math.max(0,Math.min(1,-art.getBoundingClientRect().top/height));};
 const onPointer=e=>{if(!fine.matches||!motionAllowed()||e.pointerType==='touch')return;const r=art.getBoundingClientRect();tx=(e.clientX-r.left)/r.width-.5;ty=(e.clientY-r.top)/r.height-.5;};
 const onLeave=()=>{tx=ty=0;};const onView=e=>{section=e.detail==='study'?.05:e.detail==='info'?-.035:0;dirty=true;wake();};
 const onComplete=()=>{model.react?.();dirty=true;wake();};
 const header=art.closest('header,.course-heading,.circuit-head');const urgency=()=>{model.urgency?.(header?.dataset.urgency||'calm');dirty=true;wake();};
 const status=new MutationObserver(urgency);if(header)status.observe(header,{attributes:true,attributeFilter:['data-urgency']});
 const themes=new MutationObserver(theme);themes.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});const colorScheme=matchMedia('(prefers-color-scheme:dark)');colorScheme.addEventListener('change',theme);
 canvas.addEventListener('webglcontextlost',fallback);renderer.backend.device?.lost.then(()=>{if(!disposed)fallback();});
 art.addEventListener('pointermove',onPointer);art.addEventListener('pointerleave',onLeave);document.addEventListener('visibilitychange',onVisibility);document.addEventListener('guide-motion-change',onMotion);document.addEventListener('workspace-changed',onView);document.addEventListener('guide-completion',onComplete);window.addEventListener('scroll',onScroll,{passive:true});
 function dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);resize.disconnect();observer.disconnect();status.disconnect();themes.disconnect();model.dispose();shadow.geometry.dispose();shadowMat.dispose();renderer.dispose();colorScheme.removeEventListener('change',theme);art.removeEventListener('pointermove',onPointer);art.removeEventListener('pointerleave',onLeave);document.removeEventListener('visibilitychange',onVisibility);document.removeEventListener('guide-motion-change',onMotion);document.removeEventListener('workspace-changed',onView);document.removeEventListener('guide-completion',onComplete);window.removeEventListener('scroll',onScroll);}
 window.addEventListener('pagehide',e=>{if(!e.persisted)dispose();else{cancelAnimationFrame(raf);raf=0;}});window.addEventListener('pageshow',e=>{if(e.persisted){dirty=true;wake();}});
 theme();urgency();size();update(0,0,!motionAllowed());
 try{await renderer.compileAsync(scene,camera);}catch{fallback();dispose();return null;}ready=true;wake();return{dispose};
}
