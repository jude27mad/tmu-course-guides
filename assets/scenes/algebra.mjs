import {T,material,mesh,segments,arrow,disposeScene} from './primitives.mjs?v=20261011-overhaul2';
import {algebraState} from './scene-math.mjs';
export function createAlgebra(p){
 const root=new T.Group(),lattice=new T.Group();root.add(lattice);lattice.matrixAutoUpdate=false;
 const lines=[],size=1.7;
 for(let z=-.75;z<=.75;z+=.375)for(let d=-size;d<=size+.01;d+=.34){lines.push([[-size,d,z],[size,d,z]],[[d,-size,z],[d,size,z]]);}
 for(let x=-size;x<=size+.01;x+=.34)for(let y=-size;y<=size+.01;y+=.34)lines.push([[x,y,-.75],[x,y,.75]]);
 segments(lattice,lines,material(p.accent,{transparent:true,opacity:.28,roughness:.15,metalness:.65}),.005);
 const square=[[0,0,.79],[1,0,.79],[1,1,.79],[0,1,.79]],shape=new T.BufferGeometry();shape.setAttribute('position',new T.Float32BufferAttribute(square.flat(),3));shape.setIndex([0,1,2,0,2,3]);shape.computeVertexNormals();
 mesh(lattice,shape,material(p.accent,{side:T.DoubleSide,transparent:true,opacity:.27,depthWrite:false}));segments(lattice,square.map((a,i)=>[a,square[(i+1)%4]]),material(p.accent,{emissive:p.accent,emissiveIntensity:.25}),.016);
 const a=arrow(root,material('#ede4ff',{emissive:p.accent,emissiveIntensity:.3})),b=arrow(root,material(p.signal,{emissive:p.signal,emissiveIntensity:.35}));let s=algebraState(0);
 function apply([x,y,z]){return[s.u[0]*x+s.v[0]*y,s.u[1]*x+s.v[1]*y,z];}
 return{root,bounds:[6.6,5.6],caption:'2D TRANSFORM / det A = 1',
 update(t,dt,{still=false}={}){s=algebraState(t,still);lattice.matrix.set(s.u[0],s.v[0],0,0,s.u[1],s.v[1],0,0,0,0,1,0,0,0,0,1);lattice.matrixWorldNeedsUpdate=true;a.set([0,0,.81],[...s.u,.81]);b.set([0,0,.81],[...s.v,.81]);},
 sketch(){return [...lines.map(points=>({kind:'line',points:points.map(apply),stroke:p.accent,alpha:.24,width:.65})),{kind:'poly',points:square.map(apply),fill:p.accent,stroke:p.accent,alpha:.28,width:1.5},...square.map((q,i)=>({kind:'line',points:[apply(q),apply(square[(i+1)%4])],stroke:p.accent,width:1.5,glow:3})),{kind:'line',points:[[0,0,.81],[...s.u,.81]],stroke:'#eee4ff',width:3,glow:8},{kind:'line',points:[[0,0,.81],[...s.v,.81]],stroke:p.signal,width:3,glow:8}];},
 dispose(){disposeScene(root);}};
}
