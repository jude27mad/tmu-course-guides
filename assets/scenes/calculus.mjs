import {T,material,mesh,segments,rod,setRod,disposeScene} from './primitives.mjs';
import {calculusState} from './scene-math.mjs';
export function createCalculus(p){
 const root=new T.Group(),plot=new T.Group();root.add(plot);plot.position.y=-1.65;
 const n=96,verts=[],indices=[],ribbon=[],grid=[];
 for(let i=0;i<=n;i++){const x=-1.95+3.9*i/n;verts.push(x,x*x,-.46,x,x*x,.46);if(i<n){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);ribbon.push([[x,x*x,-.46],[x+3.9/n,(x+3.9/n)**2,-.46],[x+3.9/n,(x+3.9/n)**2,.46],[x,x*x,.46]]);}}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setIndex(indices);geo.computeVertexNormals();mesh(plot,geo,material(p.accent,{side:T.DoubleSide,metalness:.7,roughness:.19,clearcoat:1}));
 const curve=Array.from({length:97},(_,i)=>{const x=-1.95+3.9*i/96;return[x,x*x,.46];});segments(plot,curve.slice(1).map((q,i)=>[curve[i],q]),material('#d6ffeb',{emissive:p.accent,emissiveIntensity:.4}),.016);
 for(let x=-3;x<=3;x+=.25)grid.push([[x,-.5,-.53],[x,4.5,-.53]]);for(let y=-.5;y<=4.5;y+=.25)grid.push([[-3,y,-.53],[3,y,-.53]]);
 segments(plot,grid,material('#44655b',{transparent:true,opacity:.3}),.003);
 const pink=material(p.signal,{emissive:p.signal,emissiveIntensity:.6}),point=mesh(plot,new T.SphereGeometry(.075,16,12),pink),moving=mesh(plot,new T.SphereGeometry(.05,12,8),pink),tangent=rod(plot,pink,.016);
 const axes=[[[-2.8,0,-.51],[2.8,0,-.51]],[[0,-.45,-.51],[0,4.35,-.51]]];segments(plot,axes,material(p.accent,{transparent:true,opacity:.5}),.007);
 let state=calculusState(0),line=[];
 return{root,bounds:[6.4,5.7],caption:'y = x² / SECANT → TANGENT',
 update(t,dt,{still=false}={}){state=calculusState(t,still);const s=state;point.position.set(s.x,s.y,.49);moving.visible=s.secant;moving.position.set(s.qx,s.qy,.49);line=[ [s.x-.86,s.y-.86*s.slope,.48],[s.x+.86,s.y+.86*s.slope,.48]];setRod(tangent,...line);},
 sketch(){const tr=a=>a.map(([x,y,z])=>[x,y-1.65,z]);return [...grid.map(points=>({kind:'line',points:tr(points),stroke:'#90c8ad',alpha:.12,width:.5})),...axes.map(points=>({kind:'line',points:tr(points),stroke:p.accent,alpha:.45,width:.6})),...ribbon.map((points,i)=>({kind:'poly',points:tr(points),fill:i>n*.55?'#9acdb5':'#476c60',stroke:'#8dd4b6',width:.3,alpha:.98})),{kind:'line',points:tr(curve),stroke:'#b6f4d3',width:2,glow:6},{kind:'line',points:tr(line),stroke:p.signal,width:1.5,glow:7},{kind:'dot',points:tr([[state.x,state.y,.49]]),stroke:p.signal,radius:4,glow:13},...(state.secant?[{kind:'dot',points:tr([[state.qx,state.qy,.49]]),stroke:p.signal,radius:3,glow:9}]:[])];},
 dispose(){disposeScene(root);}};
}
