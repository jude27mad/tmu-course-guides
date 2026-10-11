import {T,material,mesh,disposeScene} from './primitives.mjs?v=20261011-cinema3';
export function createCalculus(p){
 const root=new T.Group(),n=150,across=6,geometry=new T.BufferGeometry(),positions=new Float32Array((n+1)*(across+1)*3),indices=[];
 for(let i=0;i<n;i++)for(let j=0;j<across;j++){const a=i*(across+1)+j,b=a+across+1;indices.push(a,b,a+1,a+1,b,b+1);}
 geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);
 mesh(root,geometry,material('#b9dfc9',{side:T.DoubleSide,metalness:.83,roughness:.17,clearcoat:1,iridescence:.22}));
 let phase=0,burst=0,quads=[];
 function point(u,v){const twist=u*1.5+Math.sin(phase*.6)*.35,r=1.52+v*Math.cos(twist);return[r*Math.cos(u),r*Math.sin(u)*1.08,v*Math.sin(twist)+.36*Math.sin(2*u+phase*.45)];}
 return{root,bounds:[5.3,5.1],caption:'CONTINUOUS / CHANGE',react(){burst=1;},
 update(t,dt,{still=false,impulse=0}={}){phase=still?1:t;burst=Math.max(0,burst-dt*.5);const amplitude=1+Math.max(burst,impulse)*.12;quads=[];for(let i=0;i<=n;i++)for(let j=0;j<=across;j++){const pnt=point(i/n*Math.PI*2,(j/across-.5)*.95);geometry.attributes.position.setXYZ(i*(across+1)+j,pnt[0]*amplitude,pnt[1]*amplitude,pnt[2]);}geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
  for(let i=0;i<n;i++){const a=i*(across+1),b=(i+1)*(across+1),pos=geometry.attributes.position;const read=k=>[pos.getX(k),pos.getY(k),pos.getZ(k)];quads.push([read(a),read(b),read(b+across),read(a+across)]);}},
 sketch(){return quads.map((points,i)=>({kind:'poly',points,fill:i<65?'#c5f8d9':i<115?'#559985':'#afd8ca',stroke:'#ceffe5',alpha:1,width:.2,metal:true}));},dispose(){disposeScene(root);}};
}
