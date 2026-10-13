import {T,mesh,disposeScene} from './primitives.mjs?v=20261013-stage1';
import {planetaryState} from './scene-math.mjs?v=20261012-subject1';

// Involute tooth flanks, 20° pressure angle. Radii share a common module.
function toothOutline(teeth,module,internal=false){
 const pitch=teeth*module/2,base=pitch*Math.cos(Math.PI/9),tip=pitch+(internal?-1:1)*module,foot=pitch+(internal?1.25:-1.25)*module;
 const involute=r=>{const a=Math.acos(Math.min(1,base/r));return Math.tan(a)-a;};
 const atPitch=involute(pitch),points=[];
 for(let n=0;n<teeth;n++){
  const center=n*2*Math.PI/teeth;
  const flank=r=>Math.PI/(2*teeth)+(internal?1:-1)*(involute(Math.max(base,r))-atPitch);
  const radii=internal?[foot,(foot+tip)/2,tip]:[foot,Math.max(base,foot),(Math.max(base,foot)+tip)/2,tip];
  for(const r of radii)points.push([r*Math.cos(center-flank(r)),r*Math.sin(center-flank(r))]);
  for(const r of [...radii].reverse())points.push([r*Math.cos(center+flank(r)),r*Math.sin(center+flank(r))]);
 }
 return points;
}
function contour(points,hole=false){const p=hole?new T.Path():new T.Shape();points.forEach(([x,y],i)=>i?p.lineTo(x,y):p.moveTo(x,y));p.closePath();return p;}
function gear(teeth,module,depth,internal=false){
 let s;if(internal){s=new T.Shape();s.absarc(0,0,teeth*module/2+.26,0,Math.PI*2,false);s.holes.push(contour(toothOutline(teeth,module,true).reverse(),true));}
 else{s=contour(toothOutline(teeth,module));const hole=new T.Path();hole.absarc(0,0,.17,0,Math.PI*2,true);s.holes.push(hole);}
 const g=new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelThickness:.015,bevelSize:.012,bevelSegments:2,curveSegments:96,steps:1});g.translate(0,0,-depth/2);return g;
}
export function createCircuit(p){
 const root=new T.Group();root.name='planetary-gearbox';
 const housing=new T.MeshStandardMaterial({color:'#d8876c',metalness:.48,roughness:.36});
 const steel=new T.MeshStandardMaterial({color:'#7f979e',metalness:.7,roughness:.31});
 const brass=new T.MeshStandardMaterial({color:'#e7b79b',metalness:.68,roughness:.3});
 const dark=new T.MeshStandardMaterial({color:'#29383e',metalness:.5,roughness:.4});
 const light=new T.MeshBasicMaterial({color:p.accent});
 mesh(root,gear(60,.07,.32,true),housing,[0,0,-.02]);
 const sun=new T.Group();root.add(sun);mesh(sun,gear(24,.07,.34),brass,[0,0,.14]);
 const sunHub=mesh(sun,new T.CylinderGeometry(.3,.3,.48,48),dark,[0,0,.17]);sunHub.rotation.x=Math.PI/2;
 const carrier=new T.Group(),planets=[];root.add(carrier);
 const planetGeometry=gear(18,.07,.30),hubGeometry=new T.CylinderGeometry(.23,.23,.43,40);
 for(let i=0;i<3;i++){
  const a=i*Math.PI*2/3,g=new T.Group();g.position.set(1.47*Math.cos(a),1.47*Math.sin(a),.15);carrier.add(g);mesh(g,planetGeometry,steel);const cap=mesh(g,hubGeometry,dark,[0,0,.03]);cap.rotation.x=Math.PI/2;
  mesh(g,new T.TorusGeometry(.16,.018,6,40),brass,[0,0,.258]);mesh(g,new T.BoxGeometry(.20,.025,.014),brass,[0,0,.256]);planets.push(g);
 }
 // Recessed back plate and annular precision rim. The gear teeth remain exposed.
 const plate=new T.Shape();plate.absarc(0,0,2.34,0,Math.PI*2,false);const voidPath=new T.Path();voidPath.absarc(0,0,1.94,0,Math.PI*2,true);plate.holes.push(voidPath);
 const back=mesh(root,new T.ExtrudeGeometry(plate,{depth:.08,bevelEnabled:false,curveSegments:96}),dark,[0,0,-.30]);
 mesh(root,new T.TorusGeometry(2.32,.023,6,160),brass,[0,0,.16]);
 const bolts=new T.InstancedMesh(new T.CylinderGeometry(.049,.049,.065,6),steel,12),mat=new T.Matrix4(),q=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2);root.add(bolts);
 for(let i=0;i<12;i++){const a=i*Math.PI/6;mat.compose(new T.Vector3(2.22*Math.cos(a),2.22*Math.sin(a),.18),q,new T.Vector3(1,1,1));bolts.setMatrixAt(i,mat);}
 const indicator=mesh(root,new T.TorusGeometry(2.38,.014,6,144,Math.PI*.34),light,[0,0,.02]);indicator.name='signal-stream';
 let speed=1,clock=0,disposed=false;
 return{root,bounds:[5.2,5.2],caption:'Planetary motion',setQuality(){},urgency(state){speed=state==='close'?1.35:state==='soon'?1.15:1;light.color.set(state==='close'?p.signal:p.accent);},react(){},
 update(t,dt,{still=false}={}){if(!still)clock+=dt*speed;const s=planetaryState(clock);sun.rotation.z=s.sun;carrier.rotation.z=s.carrier;planets.forEach(g=>g.rotation.z=s.planet-s.carrier+Math.PI/18);indicator.rotation.z=-.6+clock*.18;},
 dispose(){if(!disposed){disposed=true;disposeScene(root);}}};
}
