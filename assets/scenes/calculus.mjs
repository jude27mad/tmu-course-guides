import {T,material,mesh,plane,tubes,rod,setRod,disposeScene} from './primitives.mjs';
import {calculusState} from './scene-math.mjs';
export function createCalculus(p){
 const root=new T.Group(),plot=new T.Group();plot.position.set(0,-1.65,0);root.add(plot);
 plane(plot,p,[-2.1,-.45,2.1,4.0]);
 const curve=Array.from({length:90},(_,i)=>{const x=-1.87+i*3.74/89;return[x,x*x,.08];});
 tubes(plot,[curve],material(p.ink,{metalness:.5,roughness:.24}),.033);
 const pointMat=material(p.signal,{emissive:p.signal,emissiveIntensity:.28,metalness:.2});
 const point=mesh(plot,new T.SphereGeometry(.105,20,14),pointMat),moving=mesh(plot,new T.SphereGeometry(.072,16,12),pointMat);
 const tangent=rod(plot,pointMat,.022),halo=mesh(plot,new T.TorusGeometry(.19,.008,6,48),pointMat);
 const guide=rod(plot,material(p.ink,{transparent:true,opacity:.2}),.006);
 return{root,caption:'y = x² · secant → tangent',bounds:[5.4,5.2],labels:[{text:'x',position:new T.Vector3(1.98,0,.1),parent:plot},{text:'y',position:new T.Vector3(0,3.85,.1),parent:plot},{text:'P',position:point.position,parent:plot}],
 update(t,dt,{still=false}={}){const s=calculusState(t,still);point.position.set(s.x,s.y,.1);halo.position.copy(point.position);halo.scale.setScalar(1+(still?0:Math.sin(t*.8)*.1));moving.visible=s.secant;moving.position.set(s.qx,s.qy,.1);
 const a=s.x-.7,b=Math.min(s.x+.7,s.x+(3.9-s.y)/s.slope);setRod(tangent,[a,s.y+s.slope*(a-s.x),.075],[b,s.y+s.slope*(b-s.x),.075]);setRod(guide,[s.x,0,.03],[s.x,s.y,.03]);},dispose(){disposeScene(root);}};
}
