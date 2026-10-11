import {T,material,mesh,box,segments,disposeScene} from './primitives.mjs?v=20261011-cinema3';
import {routePoint} from './scene-math.mjs';
// The routes, pulses and fallback share these physical coordinates.
export function createCircuit(p){
 const root=new T.Group(),routes=[],outlines=[],plates=[],plateMeshes=[];
 const surface=material('#202a2b',{roughness:.24,metalness:.8,clearcoat:1}),glass=material('#384443',{transparent:true,opacity:.42,depthWrite:false,roughness:.15,metalness:.55});
 const copper=material('#b27666',{metalness:.9,roughness:.23}),edge=material(p.accent,{emissive:p.accent,emissiveIntensity:.15,metalness:.8});
 function plate(w,h,z,mat,fill){plateMeshes.push(box(root,[w,h,.14],[0,0,z],mat,.06));plates.push({kind:'poly',points:[[-w/2,-h/2,z+.05],[w/2,-h/2,z+.05],[w/2,h/2,z+.05],[-w/2,h/2,z+.05]],fill,stroke:'#8c9a95',alpha:.9});outlines.push([[-w/2,-h/2,z+.05],[w/2,-h/2,z+.05]],[[w/2,-h/2,z+.05],[w/2,h/2,z+.05]],[[w/2,h/2,z+.05],[-w/2,h/2,z+.05]]);}
 plate(6.7,5.7,-.9,surface,'#26363b');plate(6.25,5.25,-.4,glass,'#34494e');plate(5.9,4.9,.08,surface,'#293b41');
 // Four banks of finely spaced traces, with 45-degree fan-out.
 for(let side=0;side<4;side++)for(let i=0;i<13;i++){
  const d=(i-6)*.139,spread=d*1.9,angle=side*Math.PI/2,c=Math.cos(angle),s=Math.sin(angle);
  const base=[[.77,d,.15],[1.18+Math.abs(d)*.12,d,.15],[1.7+Math.abs(d)*.15,spread,.15],[side%2?2.4:2.87,spread,.15]];
  routes.push(base.map(([x,y,z])=>[c*x-s*y,s*x+c*y,z]));
 }
 const routeLines=routes.flatMap(r=>r.slice(1).map((b,i)=>[r[i],b]));segments(root,routeLines,copper,.012);segments(root,outlines,edge,.008);
 plate(1.57,1.57,.19,material('#182324',{roughness:.17,metalness:.75}),'#263536');
 plate(1.39,1.39,.55,glass,'#567277');plate(1.14,1.14,.75,material(p.signal,{emissive:p.signal,emissiveIntensity:.5,metalness:.7}),'#ba7284');
 const coreLines=[];for(const d of [.51,.59])coreLines.push([[-d,-d,.33],[d,-d,.33]],[[d,-d,.33],[d,d,.33]],[[d,d,.33],[-d,d,.33]],[[-d,d,.33],[-d,-d,.33]]);
 segments(root,coreLines,edge,.009);
 const ticks=[];for(let i=0;i<24;i++){let x=-2.7+i*.23;ticks.push([[x,-2.36,.15],[x,-2.28,.15]]);}segments(root,ticks,copper,.006);
 const glowMat=new T.MeshBasicMaterial({color:p.accent}),pulses=new T.InstancedMesh(new T.SphereGeometry(.026,8,6),glowMat,26*7);root.add(pulses);
 const m=new T.Matrix4(),v=new T.Vector3(),point=[0,0,0],signals=[];let speed=.095,signal=p.accent,phase=0,boost=0;
 return{root,bounds:[7.4,6.3],caption:'SIGNAL / LIVE',
 urgency(level){speed=level==='close'?.29:level==='soon'?.17:.095;signal=level==='calm'?p.accent:'#ff6492';glowMat.color.set(signal);},react(){boost=1;},
 update(t,dt,{still=false,impulse=0}={}){for(let i=0;i<plateMeshes.length;i++){const extra=still?0:(Math.sin(t*.7)*.08+impulse*.5)*(i<3?i-2:i-2);plateMeshes[i].position.z=plates[i].points[0][2]-.05+extra;}phase=still?.43:phase+dt*speed*(1+boost);boost=Math.max(0,boost-dt*.7);signals.length=0;
  for(let i=0;i<26;i++){const r=routes[i*2],progress=(phase+i*.137)%1;for(let k=0;k<7;k++){let pos=(progress-k*.009+1)%1;routePoint(r,pos,point);m.makeScale(1-k*.105,1-k*.105,1-k*.105);m.setPosition(v.set(...point).setZ(.185));pulses.setMatrixAt(i*7+k,m);}signals.push({route:r,t:progress});}pulses.instanceMatrix.needsUpdate=true;},
 sketch(){return [...plates.map((shape,i)=>({...shape,metal:true,points:shape.points.map(([x,y,z])=>[x,y,z+(plateMeshes[i].position.z-(shape.points[0][2]-.05))])})),...outlines.map(points=>({kind:'line',points,stroke:'#a29185',alpha:.55,width:.6})),...routes.map(points=>({kind:'line',points,stroke:'#bd8a77',alpha:.6,width:1})),...coreLines.map(points=>({kind:'line',points,stroke:p.accent,alpha:.65,width:.7})),...signals.map(({route,t})=>({kind:'line',points:Array.from({length:9},(_,i)=>routePoint(route,Math.max(0,t-i*.007),[0,0,.18])),stroke:signal,width:2,glow:9,alpha:1}))];},
 dispose(){disposeScene(root);}};
}
