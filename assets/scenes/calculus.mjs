import {T,mesh,tubes,disposeScene} from './primitives.mjs?v=20261012-future1';
import {surface,sketchMeshes} from './future-geometry.mjs?v=20261012-future1';
import {createFutureLook} from './future-look.mjs?v=20261012-future1';

export function vortexPoint(u,v){
 const a=u*Math.PI*2,b=v*Math.PI*2+a*2,major=1.48+.19*Math.sin(a*3)-.08*Math.cos(a*5);
 const tube=.51+.13*Math.cos(a*3)+.07*Math.cos(b*2-a*5),r=major+tube*Math.cos(b);
 return[r*Math.cos(a),r*Math.sin(a),tube*.82*Math.sin(b)+.32*Math.sin(a*3+Math.sin(b)*.7)];
}
export function createCalculus(p){
 const root=new T.Group(),look=createFutureLook(p),mat=look.materials;
 const liquid=mesh(root,surface(180,32,vortexPoint),mat.flow);liquid.frustumCulled=false;liquid.name='liquid-surface';
 const paths=Array.from({length:2},(_,j)=>Array.from({length:100},(_,i)=>{const a=i/99*Math.PI*2,r=.87+.10*Math.sin(a*3+j);return[r*Math.cos(a),r*Math.sin(a),.14*Math.sin(a*3+j)];}));
 const inner=tubes(root,paths,mat.light,.013);
 const lens=mesh(root,new T.SphereGeometry(2.34,48,26,.13,Math.PI*.88,.45,Math.PI*.68),mat.glass);lens.rotation.set(.62,.3,-.3);
 const rimPaths=Array.from({length:2},(_,j)=>Array.from({length:70},(_,i)=>{const a=.13+i/69*Math.PI*.88,b=j?.45+Math.PI*.68:.45;return[2.34*Math.sin(b)*Math.cos(a),2.34*Math.cos(b),-2.34*Math.sin(b)*Math.sin(a)];}));
 const rim=tubes(root,rimPaths,mat.metal,.009);rim.rotation.copy(lens.rotation);
 let burst=0,disposed=false;
 const model={root,bounds:[5.8,5.8],caption:'CONTINUOUS / CHANGE',setQuality:mode=>look.setQuality(mode),react(){burst=1;},
  update(t,dt,{still=false,impulse=0}={}){
   burst=Math.max(0,burst-dt*.65);look.update(still?1.4:t,still?0:Math.max(burst,impulse),still);
   inner.rotation.z=still?.2:t*.085;liquid.rotation.z=still?-.2:Math.sin(t*.18)*.12-.2;
   lens.rotation.z=-.3+(still?0:Math.sin(t*.12)*.035);rim.rotation.copy(lens.rotation);
  },
  sketch(){return sketchMeshes(root,'#b9d4ca');},dispose(){if(!disposed){disposed=true;disposeScene(root);look.disposeTextures();}}
 };model.update(0,0,{still:true});return model;
}
