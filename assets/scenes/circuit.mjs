import {T,material,mesh,box,segments,disposeScene} from './primitives.mjs';
import {routePoint,ease} from './scene-math.mjs';
export function createCircuit(p){
 const root=new T.Group(),assembly=new T.Group();root.add(assembly);
 const board=material(p.surface,{roughness:.29,metalness:.24}),edge=material(p.accent,{metalness:.5}),copper=material(p.ink,{metalness:.65,roughness:.28}),chip=material('#292d31',{metalness:.48,roughness:.22});
 box(root,[5.9,4.1,.15],[0,0,-.24],edge,.1);box(root,[5.8,4,.12],[0,0,-.08],board,.12);
 const grid=[];for(let x=-2.65;x<2.7;x+=.35)grid.push([[x,-1.78,.0],[x,1.78,.0]]);for(let y=-1.75;y<1.8;y+=.35)grid.push([[-2.65,y,.0],[2.65,y,.0]]);
 segments(root,grid,material(p.ink,{transparent:true,opacity:.09}),.003);
 const routes=[
 [[-2.65,-1.25],[-1.75,-1.25],[-1.25,-.75],[-.65,-.75]], [[-2.65,-.65],[-1.7,-.65],[-1.15,-.1],[-.65,-.1]],
 [[-2.65,.5],[-1.65,.5],[-1.15,0],[-.65,0]], [[-2.35,1.7],[-2.35,1.25],[-1.6,.5],[-.65,.5]],
 [[-1.25,1.8],[-1.25,1.2],[-.4,.35]], [[.35,1.8],[.35,1.3],[.65,1],[.65,.55]],
 [[2.65,1.35],[1.7,1.35],[1.25,.9],[.65,.9],[.35,.55]], [[2.65,.55],[1.5,.55],[1,.05],[.65,.05]],
 [[2.65,-.3],[1.6,-.3],[1.15,-.75],[.65,-.75]], [[2,-1.8],[2,-1.3],[1.1,-.4],[.65,-.4]],
 [[.5,-1.8],[.5,-.6]],[[-.7,-1.8],[-.7,-1.25],[-.2,-.75]]
 ].map(r=>r.map(([x,y])=>[x,y,.015]));
 segments(root,routes.flatMap(r=>r.slice(1).map((v,i)=>[r[i],v])),copper,.015);
 const pulseTime=T.uniform(0),signalColor=T.uniform(new T.Color(p.signal));
 const signal=material(p.signal,{roughness:.22,metalness:.2});signal.emissiveNode=signalColor.mul(pulseTime.mul(.7).sin().mul(.25).add(.65));
 const pinParts=[];for(let i=-4;i<=4;i++)for(const side of [-1,1]){pinParts.push([[side*.67,i*.115,.09],[side*.93,i*.115,.09]]);pinParts.push([[i*.14,side*.57,.09],[i*.14,side*.81,.09]]);}segments(assembly,pinParts,edge,.027);
 const core=box(assembly,[1.5,1.25,.4],[0,0,.26],chip,.1);
 box(assembly,[1.16,.91,.055],[0,0,.49],material(p.accent,{roughness:.2,metalness:.65}),.055);
 box(assembly,[.96,.71,.03],[0,0,.53],chip,.03);
 const glyph=[];for(let i=0;i<3;i++)glyph.push([[-.24+i*.23,-.14,.56],[-.24+i*.23,.14,.56]]);segments(assembly,glyph,signal,.023);
 const pieces=[[[-1.9,-.25,.11],[.45,.2,.2]],[[1.9,.86,.12],[.44,.26,.24]],[[1.45,-1.2,.12],[.5,.22,.24]],[[-1.1,1.45,.12],[.38,.23,.24]]];
 pieces.forEach(([pos,size])=>box(assembly,size,pos,chip,.035));
 const caps=new T.InstancedMesh(new T.CylinderGeometry(.09,.09,.24,12),edge,6),matrix=new T.Matrix4(),q=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2);
 [[-2,-1.55],[-1.65,-1.55],[2.2,-.7],[2.2,-1.1],[-1.6,.85],[-1.9,.85]].forEach(([x,y],i)=>{matrix.compose(new T.Vector3(x,y,.13),q,new T.Vector3(1,1,1));caps.setMatrixAt(i,matrix);});assembly.add(caps);
 const rings=new T.InstancedMesh(new T.TorusGeometry(.07,.013,6,16),edge,routes.length),dots=new T.InstancedMesh(new T.SphereGeometry(.047,10,8),signal,routes.length);root.add(rings,dots);
 routes.forEach((r,i)=>rings.setMatrixAt(i,new T.Matrix4().makeTranslation(...r[0])));
 const pulse=new T.InstancedMesh(new T.SphereGeometry(.039,10,8),signal,routes.length);root.add(pulse);const out=[0,0,0];
 let speed=.095,boost=0;
 return{root,caption:'Signals follow your next deadline',bounds:[6.6,4.6],
  update(t,dt,{still=false}={}){pulseTime.value=t;assembly.position.z=still?0:.5*(1-ease(t/1.1));boost=Math.max(0,boost-dt);core.scale.setScalar(1+boost*.016);
   routes.forEach((r,i)=>{routePoint(r,still?.7:(t*speed+i*.087)%1,out);matrix.makeTranslation(out[0],out[1],out[2]+.015);pulse.setMatrixAt(i,matrix);matrix.makeTranslation(...r[0]);dots.setMatrixAt(i,matrix);});pulse.instanceMatrix.needsUpdate=true;dots.instanceMatrix.needsUpdate=true;},
  urgency(value){speed=value==='close'?.24:value==='soon'?.15:.095;signalColor.value.set(value==='calm'?p.ink:p.signal);},react(){boost=1;},dispose(){disposeScene(root);}};
}
