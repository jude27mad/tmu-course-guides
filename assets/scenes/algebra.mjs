import {T,mesh,tubes,disposeScene} from './primitives.mjs?v=20261012-future1';
import {triangularPanel,sketchMeshes} from './future-geometry.mjs?v=20261012-future1';
import {createFutureLook} from './future-look.mjs?v=20261012-future1';

export function createAlgebra(p){
 const root=new T.Group(),look=createFutureLook(p),mat=look.materials,faces=[];
 mat.metal.color.lerp(new T.Color(p.accent),.22);mat.metal.roughness=.17;mat.metal.iridescence=.4;
 const base=new T.IcosahedronGeometry(1.72,0),positions=base.attributes.position;
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),center=new T.Vector3(),normal=new T.Vector3(),x=new T.Vector3(),y=new T.Vector3(),basis=new T.Matrix4();
 let glassCount=0,metalCount=0,radius=0;
 for(let i=0;i<positions.count;i+=3){
  a.fromBufferAttribute(positions,i);b.fromBufferAttribute(positions,i+1);c.fromBufferAttribute(positions,i+2);center.copy(a).add(b).add(c).multiplyScalar(1/3);normal.copy(center).normalize();y.copy(a).sub(center).normalize();x.crossVectors(y,normal).normalize();basis.makeBasis(x,y,normal);radius=a.distanceTo(center)*.96;
  const glass=normal.z>.25;faces.push({center:center.clone(),normal:normal.clone(),q:new T.Quaternion().setFromRotationMatrix(basis),glass,index:glass?glassCount++:metalCount++});
 }
 base.dispose();
 const geometry=triangularPanel(radius,.17,.044),metal=new T.InstancedMesh(geometry,mat.metal,metalCount),glass=new T.InstancedMesh(geometry,mat.glass,glassCount);metal.frustumCulled=glass.frustumCulled=false;root.add(metal,glass);
 const core=mesh(root,new T.OctahedronGeometry(.66,1),mat.metal);core.name='optical-core';
 const planeMat=new T.MeshBasicMaterial({color:p.accent,transparent:true,opacity:.10,depthWrite:false,side:T.DoubleSide}),planes=[];
 for(let i=0;i<3;i++){const g=new T.PlaneGeometry(1.55,1.55);g.rotateX(i===1?Math.PI/2:0);g.rotateY(i===2?Math.PI/2:0);planes.push(g);}
 const planeGeometry=T.mergeGeometries(planes);planes.forEach(g=>g.dispose());mesh(root,planeGeometry,planeMat);
 const framePaths=[];for(let i=0;i<3;i++){
  const points=[[-.78,-.78,0],[.78,-.78,0],[.78,.78,0],[-.78,.78,0],[-.78,-.78,0]];
  framePaths.push(points.map(([x,y,z])=>i===1?[x,z,y]:i===2?[z,y,x]:[x,y,z]));
 }
 tubes(root,framePaths,mat.light,.014);
 const m=new T.Matrix4(),q=new T.Quaternion(),hinge=new T.Quaternion(),localX=new T.Vector3(1,0,0),pos=new T.Vector3(),scale=new T.Vector3(1,1,1);
 let burst=0,disposed=false;
 const model={root,bounds:[5.5,5.5],caption:'KINETIC / SPACE',setQuality:mode=>look.setQuality(mode),react(){burst=1;},
  update(t,dt,{still=false,impulse=0}={}){
   burst=Math.max(0,burst-dt*.65);const response=still?0:Math.max(burst,impulse);look.update(t,response,still);
   for(let i=0;i<faces.length;i++){
    const f=faces[i],wave=still?0:(.5+.5*Math.sin(t*.55+i*.38)),open=.12+wave*.18+response*.27;
    pos.copy(f.center).addScaledVector(f.normal,open);hinge.setFromAxisAngle(localX,(wave*.14+response*.30)*(i%2?1:-1));q.copy(f.q).multiply(hinge);m.compose(pos,q,scale);(f.glass?glass:metal).setMatrixAt(f.index,m);
   }
   metal.instanceMatrix.needsUpdate=glass.instanceMatrix.needsUpdate=true;core.rotation.set(.2,still?.3:t*.12,-.15);
  },
  sketch(){return sketchMeshes(root,'#c0b8d4');},dispose(){if(!disposed){disposed=true;disposeScene(root);look.disposeTextures();}}
 };model.update(0,0,{still:true});return model;
}
