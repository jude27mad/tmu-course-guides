import {T,material,mesh,plane,segments,arrow,rod,setRod,disposeScene} from './primitives.mjs';
import {algebraState} from './scene-math.mjs';
export function createAlgebra(p){
 const root=new T.Group(),plot=new T.Group();root.add(plot);plot.position.set(-.7,-.55,0);plot.scale.setScalar(1.7);
 plane(plot,p,[-.65,-.45,2.1,1.75]);
 const base=[[0,0,.02],[1,0,.02],[1,1,.02],[0,1,.02]];
 segments(plot,base.map((a,i)=>[a,base[(i+1)%4]]),material(p.ink,{transparent:true,opacity:.25}),.007);
 const ink=material(p.ink,{roughness:.26,metalness:.42}),pink=material(p.signal,{emissive:p.signal,emissiveIntensity:.12,roughness:.28});
 const u=arrow(plot,ink),v=arrow(plot,pink),edges=Array.from({length:4},()=>rod(plot,material(p.ink,{transparent:true,opacity:.7}),.009));
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(12),3));geo.setIndex([0,1,2,0,2,3]);
 const face=mesh(plot,geo,material(p.accent,{transparent:true,opacity:.44,side:T.DoubleSide,depthWrite:false,metalness:.12,roughness:.2}));
 const uLabel=new T.Vector3(),vLabel=new T.Vector3();
 const origin=mesh(plot,new T.SphereGeometry(.04,12,8),pink);
 return{root,caption:'Shear · rotate · area stays 1',bounds:[5.7,4.8],labels:[{text:'e₁',position:new T.Vector3(1,-.12,.1),parent:plot},{text:'e₂',position:new T.Vector3(-.12,1,.1),parent:plot},{text:'A e₁',position:uLabel,parent:plot},{text:'A e₂',position:vLabel,parent:plot}],
 update(t,dt,{still=false}={}){const s=algebraState(t,still);uLabel.set(s.u[0]+.08,s.u[1]+.1,.1);vLabel.set(s.v[0]+.08,s.v[1]+.1,.1);const points=s.square.map(([x,y])=>[x,y,.04]);u.set([0,0,.07],[...s.u,.07]);v.set([0,0,.07],[...s.v,.07]);for(let i=0;i<4;i++){geo.attributes.position.setXYZ(i,...points[i]);setRod(edges[i],points[i],points[(i+1)%4]);}geo.attributes.position.needsUpdate=true;geo.computeVertexNormals();geo.computeBoundingSphere();origin.position.z=.06;},dispose(){disposeScene(root);}};
}
