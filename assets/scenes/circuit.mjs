import {T,mesh,tubes,disposeScene} from './primitives.mjs?v=20261012-future1';
import {surface,sketchMeshes} from './future-geometry.mjs?v=20261012-future1';
import {createFutureLook} from './future-look.mjs?v=20261012-future1';
import {routePoint} from './scene-math.mjs';

export function createCircuit(p){
 const root=new T.Group(),look=createFutureLook(p),mat=look.materials,poses=[],routes=[];
 const shellSample=(u,v)=>{
  const a=-.91+u*1.82,t=v*Math.PI*2,taper=.7+.3*Math.sin(u*Math.PI),r=1.98+.11*Math.sin(u*Math.PI);
  const round=x=>Math.sign(x)*Math.pow(Math.abs(x),.55);
  const radial=r+.34*taper*round(Math.cos(t));return[radial*Math.cos(a),radial*Math.sin(a),.33*taper*round(Math.sin(t))+.06*Math.sin(a*2)];
 };
 const shell=new T.InstancedMesh(surface(56,20,shellSample,{caps:true}),mat.ceramic,3);root.add(shell);
 const trim=new T.InstancedMesh(surface(56,8,(u,v)=>{const a=-.91+u*1.82,t=v*Math.PI*2,r=2.01+.11*Math.sin(u*Math.PI)+.29+.024*Math.cos(t);return[r*Math.cos(a),r*Math.sin(a),.27+.024*Math.sin(t)];},{caps:true}),mat.metal,3);root.add(trim);
 const copper=mat.metal.clone();copper.color.set('#bd806c');copper.roughness=.25;
 const baseRoutes=[];for(let j=0;j<3;j++)baseRoutes.push(Array.from({length:30},(_,i)=>{const u=i/29,a=-.84+u*1.68,r=1.82+j*.072+.11*Math.sin(u*Math.PI);return[r*Math.cos(a),r*Math.sin(a),.34+.035*j];}));
 const temporary=new T.Group(),track=tubes(temporary,baseRoutes,copper,.012),channels=new T.InstancedMesh(track.geometry,copper,3);root.add(channels);
 const ribs=new T.InstancedMesh(new T.RoundedBoxGeometry(.055,.29,.08,2,.02),mat.metal,21);root.add(ribs);
 const core=mesh(root,new T.IcosahedronGeometry(.64,1),mat.metal);core.name='signal-core';
 const interior=Array.from({length:3},(_,j)=>Array.from({length:40},(_,i)=>{const t=i/39*Math.PI*2,a=t+j*Math.PI*2/3;return[.96*Math.cos(a),.96*Math.sin(a),.17*Math.sin(t*2+j)];}));
 tubes(root,interior,mat.light,.014);
 const lens=mesh(root,new T.SphereGeometry(1.25,40,22,.35,Math.PI*1.35,.25,Math.PI*.8),mat.glass);lens.rotation.set(.2,-.2,.6);
 const spark=new T.InstancedMesh(new T.SphereGeometry(.025,8,6),new T.MeshBasicMaterial({color:p.accent}),9*6);spark.name='signal-stream';root.add(spark);
 const m=new T.Matrix4(),q=new T.Quaternion(),e=new T.Vector3(),scale=new T.Vector3(1,1,1),position=new T.Vector3(),point=[0,0,0],ribMatrix=new T.Matrix4(),orientation=root.rotation.clone();
 let phase=0,speed=.095,burst=0,disposed=false;
 for(let i=0;i<3;i++){poses.push(new T.Matrix4());for(const path of baseRoutes)routes.push(path.map(p=>[...p]));}
 const model={root,bounds:[5.7,5.7],caption:'SIGNAL / LIVE',setQuality:mode=>look.setQuality(mode),
  urgency(level){speed=level==='close'?.29:level==='soon'?.17:.095;spark.material.color.set(level==='calm'?p.accent:p.signal);mat.light.color.copy(spark.material.color);},
  react(){burst=1;},
  update(t,dt,{still=false,impulse=0}={}){
   burst=Math.max(0,burst-dt*.65);const reaction=still?0:Math.max(burst,impulse),open=.045+(still?0:Math.sin(t*.55)*.035)+reaction*.32;
   look.update(t,reaction,still);
   for(let i=0;i<3;i++){
    const a=i*Math.PI*2/3,tilt=(i-1)*.28+reaction*.07;
    q.setFromEuler(orientation.set(tilt,-tilt*.65,a));position.set(Math.cos(a)*open,Math.sin(a)*open,(i-1)*.24);
    poses[i].compose(position,q,scale);shell.setMatrixAt(i,poses[i]);trim.setMatrixAt(i,poses[i]);channels.setMatrixAt(i,poses[i]);
    for(let j=0;j<baseRoutes.length;j++)for(let k=0;k<baseRoutes[j].length;k++){e.set(...baseRoutes[j][k]).applyMatrix4(poses[i]);const target=routes[i*3+j][k];target[0]=e.x;target[1]=e.y;target[2]=e.z;}
    for(let j=0;j<7;j++){const angle=-.7+j*.23,r=2.08;position.set(r*Math.cos(angle),r*Math.sin(angle),.375);q.setFromAxisAngle(e.set(0,0,1),angle-Math.PI/2);ribMatrix.compose(position,q,scale).premultiply(poses[i]);ribs.setMatrixAt(i*7+j,ribMatrix);}
   }
   for(const o of [shell,trim,channels,ribs])o.instanceMatrix.needsUpdate=true;
   phase=still?.3:(phase+dt*speed*(1+reaction*.5))%1;
   for(let i=0;i<routes.length;i++)for(let j=0;j<6;j++){routePoint(routes[i],(phase+i*.117-j*.012+1)%1,point);m.makeScale(1-j*.13,1-j*.13,1-j*.13);m.setPosition(...point);spark.setMatrixAt(i*6+j,m);}spark.instanceMatrix.needsUpdate=true;
   core.rotation.set(still?.2:t*.15,.3+(still?0:Math.sin(t*.23)*.2),.15);lens.rotation.z=.6+(still?0:Math.sin(t*.16)*.07);
  },
  sketch(){return sketchMeshes(root,'#9dafba');},
  dispose(){if(!disposed){disposed=true;disposeScene(root);look.disposeTextures();}}
 };
 model.update(0,0,{still:true});return model;
}
