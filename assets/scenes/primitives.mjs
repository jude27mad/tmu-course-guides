import * as T from '../vendor/three-0.186.1.mjs?v=20261013-shift2';
export {T};
export function material(color,extra={}){return new T.MeshPhysicalMaterial({color,roughness:.28,metalness:.55,clearcoat:.6,clearcoatRoughness:.2,...extra});}
export function mesh(group,geometry,mat,position=[0,0,0]){const m=new T.Mesh(geometry,mat);m.position.set(...position);group.add(m);return m;}
export function box(group,size,position,mat,radius=.04){return mesh(group,new T.RoundedBoxGeometry(...size,2,radius),mat,position);}
export function tubeGeometry(points,radius=.015){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)),false,'centripetal');return new T.TubeGeometry(curve,Math.max(8,points.length*5),radius,6,false);}
export function tubes(group,routes,mat,radius=.015){const parts=routes.map(p=>tubeGeometry(p,radius)),g=T.mergeGeometries(parts);parts.forEach(p=>p.dispose());return mesh(group,g,mat);}
export function segments(group,lines,mat,radius=.012){const parts=[];for(const [a,b]of lines){const start=new T.Vector3(...a),end=new T.Vector3(...b),delta=end.sub(start);const g=new T.CylinderGeometry(radius,radius,delta.length(),6);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));g.translate(...start.add(new T.Vector3(...b)).multiplyScalar(.5).toArray());parts.push(g);}const g=T.mergeGeometries(parts);parts.forEach(p=>p.dispose());return mesh(group,g,mat);}
export function rod(group,mat,radius=.025){return mesh(group,new T.CylinderGeometry(radius,radius,1,10),mat);}
const delta=new T.Vector3(),middle=new T.Vector3(),up=new T.Vector3(0,1,0);
export function setRod(m,a,b){delta.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]);m.scale.y=delta.length();m.position.copy(middle.set((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2));m.quaternion.setFromUnitVectors(up,delta.normalize());}
export function arrow(group,mat){const g=new T.Group();group.add(g);const shaft=rod(g,mat,.022),tip=mesh(g,new T.CylinderGeometry(0,.085,.24,14),mat);return {set(a,b){setRod(shaft,a,b);tip.position.set(...b).addScaledVector(delta,-.12);tip.quaternion.copy(shaft.quaternion);},group:g};}
export function plane(group,palette,bounds){
 const [x0,y0,x1,y1]=bounds,w=x1-x0,h=y1-y0;
 const mat=material(palette.surface,{transparent:true,opacity:.88,roughness:.3,metalness:.08});
 box(group,[w,h,.09],[(x0+x1)/2,(y0+y1)/2,-.08],mat,.06);
 const lines=[];for(let x=Math.ceil(x0*2)/2;x<x1;x+=.5)lines.push([[x,y0,0],[x,y1,0]]);for(let y=Math.ceil(y0*2)/2;y<y1;y+=.5)lines.push([[x0,y,0],[x1,y,0]]);
 segments(group,lines,material(palette.grid,{transparent:true,opacity:.26}),.005);
 const axes=material(palette.ink,{transparent:true,opacity:.65});segments(group,[[[x0,0,.015],[x1,0,.015]],[[0,y0,.015],[0,y1,.015]]],axes,.009);
 return mat;
}
export function disposeScene(scene){const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of [].concat(o.material||[]))materials.add(m);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
