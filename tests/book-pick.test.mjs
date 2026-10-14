/* Picking follows the bent paper (semester-book spec §5.10, §10.1; plan §5 "deformed-page hit targets").
   The scene camera comes from the engine's own fit; samples of bendPoint are projected through it and picked
   back with the engine's pickPaper (Sheet.hit = bendHit on the mesh's x segments). Pure Node. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/app/three.mjs?v=20261013-stage1';
import {fitCamera,bookToWorld,worldToBook,pickPaper,faceUV,isCorner,canDrag,blockHeights} from '../assets/book/book-geometry.mjs?v=20261013-book1';
import {createSheet,createPageUniforms,sheetRadius,LIFT} from '../assets/book/page-bend.mjs?v=20261013-book1';
import {createPopupSet,restPose} from '../assets/book/popup.mjs';

const W=.142,H=.206,o=.003;
const theme={paper:'#efe6d2',pencil:'#5a5f61',ink:'#1f2624',accent:'#096450',gutter:{ao:.78,width:.12}};
function scene(width=1440,height=640,viewport=width){
 const camera=new T.PerspectiveCamera(),pts=[];
 for(const x of [-W-o,W+o])for(const y of [-o,H+o])for(const z of [0,-.0024])pts.push([x,y,z]);
 fitCamera(camera,width,height,viewport,pts,{H});
 const raycaster=new T.Raycaster();
 const rayAt=(ndcX,ndcY)=>{raycaster.setFromCamera(new T.Vector2(ndcX,ndcY),camera);const {origin:a,direction:d}=raycaster.ray;
  return {origin:worldToBook([a.x,a.y,a.z],H),direction:[d.x,-d.z,d.y]};};
 const project=p=>{const v=new T.Vector3(...bookToWorld(p,H)).project(camera);return [v.x,v.y,v.z];};
 return {camera,raycaster,rayAt,project};
}
const along=(ray,t)=>ray.origin.map((v,k)=>v+ray.direction[k]*t);
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);

test('bendPoint samples projected through the scene camera pick back to the same face and (x, y) within half a segment',()=>{
 for(const [tier,segments] of [['high',96],['mid',48]])for(const [w,h] of [[1440,640],[390,300]]){
  const {rayAt,project}=scene(w,h),sheet=createSheet({W,H,shared:createPageUniforms(theme),tier});sheet.visible=true;
  const {zL,zR}=blockHeights(5,17);
  let exact=0,total=0;
  for(const t of [.08,.25,.4,.5,.62,.8,.93]){
   sheet.set({turn:t,radius:sheetRadius(t,0,W),stackZ:[zR,zL]});
   for(let i=1;i<20;i++)for(let j=1;j<10;j++){
    const x=W*i/20,y=H*j/10,{position:p,normal:n}=sheet.anchor(x,y),[nx,ny]=project(p);
    const ray=rayAt(nx,ny),hit=pickPaper(ray,{W,H,sheets:[{sheet,front:'R5',back:'L6'}]});
    total++;
    assert.ok(hit&&hit.kind==='sheet',`t=${t} sample (${x.toFixed(3)}, ${y.toFixed(3)}) missed`);
    const sampleDistance=dist(ray.origin,p),onRay=along(ray,hit.distance),bent=sheet.anchor(hit.x,hit.y).position;
    // Silhouettes (rays within ~6° of grazing the paper) are ambiguous for any picker: the chord the mesh
    // draws and the exact curve part there. Everywhere else the hit is the sample itself or something in
    // front of it, always on the paper (chords sit within a sagitta of the curve).
    const grazing=Math.abs(ray.direction[0]*n[0]+ray.direction[1]*n[1]+ray.direction[2]*n[2])/Math.hypot(...ray.direction)<.1;
    assert.ok(dist(onRay,bent)<.0012,'the hit is on the paper');
    if(!grazing)assert.ok(hit.distance<=sampleDistance+.0005,`never behind the sample (${(hit.distance-sampleDistance).toExponential(2)})`);
    if(hit.distance>sampleDistance-.002&&!grazing){
     exact++;
     assert.ok(Math.abs(hit.x-x)<=W/segments/2+1e-6,`${tier} t=${t}: x ${hit.x.toFixed(5)} vs ${x.toFixed(5)}`);
     assert.ok(Math.abs(hit.y-y)<=.0015,`y ${hit.y} vs ${y}`);
     const facing=ray.direction[0]*n[0]+ray.direction[1]*n[1]+ray.direction[2]*n[2]<0?'front':'back';
     assert.equal(hit.face,facing==='front'?'R5':'L6');assert.equal(hit.top,facing);
    }
   }
  }
  assert.ok(exact/total>.7,`most samples are visible and exact (${exact}/${total})`);
  sheet.dispose();
 }
});

test('a static page under a sheet never wins, and with no sheet the static pages pick analytically',()=>{
 const {rayAt,project}=scene(),sheet=createSheet({W,H,shared:createPageUniforms(theme),tier:'high'});sheet.visible=true;
 const {zL,zR}=blockHeights(5,17),statics={left:{z:zL,face:'L5'},right:{z:zR,face:'R6'}};
 for(const t of [.05,.15,.3]){
  sheet.set({turn:t,radius:sheetRadius(t,0,W),stackZ:[zR,zL]});
  const a=(1-t)*W-t*Math.PI*sheet.params.radius;
  for(let x=.01;x<Math.min(a,W)-.005;x+=.01)for(const y of [.03,.1,.18]){
   const [nx,ny]=project(sheet.anchor(x,y).position),hit=pickPaper(rayAt(nx,ny),{W,H,sheets:[{sheet,front:'R5',back:'L6'}],statics});
   assert.equal(hit.kind,'sheet',`t=${t} x=${x} y=${y}: the sheet lies over the static recto`);assert.equal(hit.face,'R5');
  }
 }
 // At rest: the plane at the stack height, mirrored u on the verso.
 for(const [x,y,side] of [[.05,.1,'right'],[-.08,.15,'left']]){
  const z=side==='right'?zR:zL,[nx,ny]=project([x,y,z]),hit=pickPaper(rayAt(nx,ny),{W,H,statics});
  assert.equal(hit.kind,'page');assert.equal(hit.side,side);assert.ok(Math.abs(hit.x-Math.abs(x))<1e-6&&Math.abs(hit.y-y)<1e-6);
  const uv=faceUV(hit,W,H);assert.ok(Math.abs(uv.u-(side==='right'?x/W:1-Math.abs(x)/W))<1e-6,'verso faces are painted mirrored');
 }
 assert.equal(pickPaper(rayAt(.99,.99),{W,H,statics}),null,'outside the paper');
 sheet.dispose();
});

test('corners and drag zones follow the flat page coordinates',()=>{
 assert.equal(isCorner({x:.95*W,y:.05*H},W,H),true);assert.equal(isCorner({x:.95*W,y:.5*H},W,H),false);
 assert.equal(canDrag({x:.65*W,y:.5*H},W,H),true);assert.equal(canDrag({x:.3*W,y:.5*H},W,H),false);assert.equal(canDrag(null,W,H),false);
});

test('hidden, folded or non-interactive pop-ups never win; a shown, settled pop-up does',()=>{
 const {camera,raycaster,project}=scene();
 const book=new T.Group();book.rotation.x=-Math.PI/2;book.position.z=H/2;
 const set=createPopupSet({tier:'high'});book.add(set.group);
 const entry={id:'quiz-2',open:'assessment-quiz-2',kind:'quiz',title:'Lab Quiz 2',when:'Oct 12–Oct 16',label:'Quiz week',chip:'NEXT',urgency:'none',completed:false,passed:false,rank:2};
 set.show({entries:[entry],popups:['quiz-2']});
 const {zL,zR}=blockHeights(5,17);
 set.pose(restPose(zL,zR));book.updateMatrixWorld(true);
 set.setCamera(new T.Vector3(...worldToBook(camera.position.toArray(),H)));
 const piece=set.pieces()[0],tag=piece.solution.tag;
 const centre=[0,1,2].map(k=>tag.G[k]+tag.c[k]*tag.h/2);
 const [nx,ny]=project(centre);
 const cast=()=>{raycaster.setFromCamera(new T.Vector2(nx,ny),camera);return raycaster.intersectObjects(set.meshes(),false);};
 set.setInteractive(false);set.update(0,{motion:false});assert.equal(cast().length,0,'not interactive: nothing to hit');
 set.setInteractive(true);set.update(0,{motion:false});
 const hits=cast();assert.ok(hits.length>0,'a shown, settled tag is hit');assert.equal(hits[0].object.userData.popup.open,'assessment-quiz-2');
 set.setVisible(false);assert.equal(cast().length,0,'hidden');set.setVisible(true);
 // Folded by the turn: the recto foot rides a sheet that has almost landed on the verso.
 set.pose({left:{z:zL},right:{sheet:{turn:.93,radius:sheetRadius(.93,0,W),stackZ:[zR,zL]}}});set.update(0,{motion:false});
 assert.equal(set.stats().pickable,0,'folded pop-ups are not pickable');
 assert.ok(LIFT>0);
 set.dispose();
});
