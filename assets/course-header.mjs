import {sceneMotionAllowed as motionAllowed,setScenePaused as setPaused,preference} from './guide-motion.mjs?v=20261011-cinema3';
import {posterPaths} from './scenes/framing.mjs?v=20261012-subject1';
function mount(){
 const header=document.querySelector('.course-heading,.circuit-head');
 if(!header||!document.body.classList.contains('workspace')||header.classList.contains('header-upgraded'))return;
 const course=document.body.dataset.course,art=document.createElement('div');art.className='header-art';art.dataset.artRevision='20261012-subject1';
 const info={cen100:['01 / ENGINEERING','Drag to explore'],mth140:['02 / CALCULUS','Drag to explore'],mth141:['03 / LINEAR ALGEBRA','Drag to explore']}[course];
 art.setAttribute('role','group');art.tabIndex=0;art.setAttribute('aria-roledescription','interactive 3D illustration');art.setAttribute('aria-label',course==='cen100'?'Working planetary gearbox. Drag to rotate, or use arrow keys. Home resets the view.':course==='mth140'?'Flowing curves with a moving tangent. Drag to rotate, or use arrow keys. Home resets the view.':'A sphere and three basis vectors transformed by matrices. Drag to rotate, or use arrow keys. Home resets the view.');
 art.innerHTML='<div class="scene-atmosphere"></div>';
 header.prepend(art);header.classList.add('header-upgraded');
 const poster=document.createElement('img');poster.className='scene-poster';poster.alt='';poster.decoding='async';poster.fetchPriority='high';Object.assign(poster.dataset,posterPaths(course));art.dataset.portrait=String(header.clientWidth<680);poster.src=header.clientWidth<680?poster.dataset.tall:poster.dataset.wide;art.append(poster);
 const copy=header.querySelector('.hero-copy');if(copy){const kicker=copy.querySelector('.team,.eyebrow');if(kicker)kicker.textContent=info[0];const h1=copy.querySelector('h1');if(course==='cen100'&&h1)h1.innerHTML='Intro to<br>Engineering';}
 const meta=document.createElement('div');meta.className='scene-meta';meta.innerHTML=`<span><i></i>${info[1]}</span><button class="scene-pause" type="button" aria-label="Pause animation" aria-pressed="false"></button>`;header.append(meta);
 const button=meta.querySelector('button');
 function sync(){const on=motionAllowed(),pref=preference();button.setAttribute('aria-pressed',String(!on));button.setAttribute('aria-label',on?'Pause animation':'Resume animation');button.title=on?'Pause animation':pref.reduced?'Motion follows your device setting':'Resume animation';button.disabled=pref.reduced||pref.forced;button.innerHTML=on?'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10M13 5v10"/></svg>':'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 8 6-8 6z"/></svg>';art.dataset.motionState=on?'ready':'still';}
 button.addEventListener('click',()=>setPaused(!preference().scenePaused));document.addEventListener('guide-motion-change',sync);sync();
 import('./course-scene.mjs?v=20261012-subject1').then(m=>m.mountScene(art,course)).catch(()=>{art.dataset.renderer='poster';art.dataset.sceneReady='true';art.dataset.awake='true';});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
