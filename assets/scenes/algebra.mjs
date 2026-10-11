import {T,material,mesh,box,disposeScene} from './primitives.mjs?v=20261011-cinema3';
// Abstract kinetic sculpture for the header; instructional maths stays in the studio.
export function createAlgebra(p){
 const root=new T.Group(),cells=[],faces=[[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[1,5,6,2],[0,3,7,4]],corners=[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1],[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1]];
 const glass=material('#aaa2d1',{metalness:.48,roughness:.14,clearcoat:1,iridescence:.28,iridescenceIOR:1.3}),dark=material('#4c4968',{metalness:.72,roughness:.22,clearcoat:1});
 for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
  if(x===0&&y===0&&z===0)continue;
  const m=box(root,[.71,.71,.71],[x*.82,y*.82,z*.82],(x+y+z)%3===0?dark:glass,.065);cells.push({m,xyz:[x,y,z]});
 }
 const core=box(root,[.57,.57,.57],[0,0,0],material(p.signal,{emissive:p.signal,emissiveIntensity:1.8,metalness:.5,roughness:.16}),.05);
 let burst=0,phase=0;
 return{root,bounds:[5.2,5.0],caption:'KINETIC / SPACE',react(){burst=1;},
 update(t,dt,{still=false,impulse=0}={}){phase=still?1.5:t;burst=Math.max(0,burst-dt*.65);const open=still?.12:.22+.33*(.5+.5*Math.sin(t*.8))+Math.max(burst,impulse)*.65;
  for(const {m,xyz:[x,y,z]}of cells){const wave=still?0:Math.sin(t*.65+y*.75)*.19;m.position.set(x*(.84+open)+wave*y,y*(.84+open),z*(.84+open));m.rotation.set(z*open*.4,x*open*.4,y*open*.25);m.updateMatrix();}
  core.rotation.set(phase*.3,phase*.42,phase*.13);},
 sketch(){const v=new T.Vector3(),objects=[];
  for(const {m,xyz}of [...cells,{m:core,xyz:[0,0,0]}]){const luminous=m===core,half=luminous?.285:.355;const pts=corners.map(c=>v.set(c[0]*half,c[1]*half,c[2]*half).applyMatrix4(m.matrix).toArray());for(let i=0;i<faces.length;i++)objects.push({kind:'poly',points:faces[i].map(j=>pts[j]),fill:luminous?'#ff8ab6':i===0?'#cfc4f0':i===4?'#6a648d':'#9185b4',stroke:luminous?'#ffe2ef':'#ddd3ff',alpha:1,width:.5,metal:true,glow:luminous?10:0});}
  return objects;},dispose(){disposeScene(root);}};
}
