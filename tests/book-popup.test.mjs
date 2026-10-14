import test from 'node:test';
import assert from 'node:assert/strict';
import {bendPoint,MIN_RADIUS_RATIO} from '../assets/book/page-bend-math.mjs';
import * as P from '../assets/book/popup.mjs';

/* MTH140 pop-up arcs (docs/book/semester-book-spec.md §5.3, §10.1). Lengths in metres, the Codex page frame:
   x across from the spine, y from the tail, z up. A rigid hinge sweep closes the verso over the recto:
   θ = π − angle. */
const {W,H}=P.PAGE;
const KINDS=['final','midterm','quiz','minor'];
const RANK={final:6,midterm:4,quiz:2,minor:0};
const piece=(kind,extra={})=>P.layoutSpread([{id:kind,kind,rank:RANK[kind],...extra}]).pieces[0];
const hingePose=theta=>({left:{z:0,angle:Math.PI-theta},right:{z:0}});
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const finite=v=>v.every(Number.isFinite);
const sweep=[...Array.from({length:1001},(_,i)=>Math.PI*i/1000),1e-6,-1e-6,Math.PI-1e-6,Math.PI+1e-6];

test('the arc table keeps the spec sizes and the wave meets its flat-fold condition',()=>{
  const midterm=P.popupSpec({kind:'midterm',rank:4}),quiz=P.popupSpec({kind:'quiz',rank:2}),final=P.popupSpec({kind:'final',rank:6});
  assert.equal(midterm.mechanism,'arch');assert.equal(final.mechanism,'double');assert.equal(quiz.mechanism,'wave');
  assert.equal(final.strips.length,2);assert.equal(final.strips[1].offset,-.012);
  assert.ok(Math.abs(quiz.strips[0].aR-.24*W)<1e-15);
  const s=quiz.strips[0];
  assert.ok(Math.abs((s.aL+s.cL)-(s.aR+s.cR))<1e-12,'a_L + c_L = a_R + c_R');
  assert.ok(s.aL>=.5*s.aR&&s.aL<=1.5*s.aR);
  assert.ok(Math.abs(s.xc-.15*s.aR)<1e-15,'crest offset toward the recto');
  assert.equal(P.arcKind('lab'),'quiz');assert.equal(P.arcKind('reading'),'minor');
  for(const kind of KINDS)for(const strip of P.popupSpec({kind,rank:RANK[kind]}).strips)assert.ok(Math.max(strip.aL,strip.aR)<=.35*W+1e-12,'feet inside the rigid zone');
});

test('heights follow final > midterm > quiz > minor, with weight only a bounded cue inside a category',()=>{
  const weights=[null,1,5,40,45,100,1e6];
  const bands=Object.fromEntries(KINDS.map(kind=>{
    const heights=weights.map(w=>P.popupSpec({kind,rank:RANK[kind]+(w?w/(w+100):0)}).height);
    return [kind,[Math.min(...heights),Math.max(...heights)]];
  }));
  assert.ok(bands.final[0]>bands.midterm[1]);assert.ok(bands.midterm[0]>bands.quiz[1]);assert.ok(bands.quiz[0]>bands.minor[1]);
  assert.equal(P.heightScale({rank:2}),1,'no weight keeps the design height');
  assert.ok(Math.abs(P.heightScale({rank:4+40/140})-(.9+.4*40/140))<1e-12);
});

test('a hinge sweep stays finite over θ in [0, π] (1/1000 steps and ±1e−6 at both ends)',()=>{
  for(const kind of KINDS){
    const p=piece(kind);
    for(const theta of sweep)for(const flat of [0,.5,1]){
      const sol=P.solvePiece(p,hingePose(theta),{flat});
      assert.ok(Number.isFinite(sol.theta)&&Number.isFinite(sol.raise),`${kind} θ=${theta}`);
      for(const v of P.pieceVertices(sol))assert.ok(finite(v),`${kind} θ=${theta} flat=${flat}`);
    }
  }
});

test('everything is coplanar when the book is closed (θ = 0)',()=>{
  for(const kind of KINDS){
    const sol=P.solvePiece(piece(kind),hingePose(0));
    for(const v of P.pieceVertices(sol))assert.ok(Math.abs(v[2])<1e-9,`${kind} z=${v[2]}`);
    assert.equal(sol.raise,0);
  }
});

test('design heights hold within 1% when the book lies open (θ = π)',()=>{
  for(const kind of KINDS){
    const p=piece(kind),sol=P.solvePiece(p,P.restPose(.004,.004));
    p.spec.strips.forEach((strip,i)=>{
      const apex=sol.strips[i].M[1]-.004;
      assert.ok(Math.abs(apex-strip.h)/strip.h<.01,`${kind} strip ${i}: ${apex} vs ${strip.h}`);
    });
    assert.equal(sol.raise,1);
  }
});

test('chords stay exact while flat = 0: |LM| and |RM| constant to 1e−9 over the sweep',()=>{
  for(const kind of KINDS){
    const p=piece(kind);
    for(const theta of sweep){
      const sol=P.solvePiece(p,hingePose(Math.min(Math.PI,Math.max(0,theta))));
      p.spec.strips.forEach((strip,i)=>{
        const M=sol.strips[i].M,pts=sol.strips[i].points,L=pts[0],R=pts[pts.length-1];
        assert.ok(Math.abs(dist(L,M)-strip.cL)<1e-9,`${kind} |LM| θ=${theta}`);
        assert.ok(Math.abs(dist(R,M)-strip.cR)<1e-9,`${kind} |RM| θ=${theta}`);
      });
    }
  }
});

test('completed pieces lie flat: flat = 1 keeps every strip point within 0.5 mm of its pages at any θ',()=>{
  for(const kind of KINDS){
    const p=piece(kind);
    for(let i=0;i<=200;i++){
      const theta=Math.PI*i/200,a=Math.PI-theta,sol=P.solvePiece(p,hingePose(theta),{flat:1});
      // Distance to the recto (z = 0, x ≥ 0) or the verso (the ray from the spine at angle a).
      const lx=-Math.cos(a),lz=Math.sin(a);
      for(const s of sol.strips)for(const [x,z] of s.points){
        const along=Math.max(0,x*lx+z*lz),toVerso=Math.hypot(x-along*lx,z-along*lz),toRecto=x>=0?Math.abs(z):Math.hypot(x,z);
        assert.ok(Math.min(toVerso,toRecto)<=.0005,`${kind} θ=${theta}: ${Math.min(toVerso,toRecto)}`);
      }
      assert.ok(Math.hypot(...sol.apex)<=.0005,'apex at the spine');
    }
  }
});

test('a spread holds at most three pieces, highest rank toward the head, footprints never overlapping',()=>{
  const entries=[
    {id:'quiz-3',kind:'quiz',rank:2},{id:'final',kind:'final',rank:6+45/145},{id:'note',kind:'minor',rank:0},{id:'midterm',kind:'midterm',rank:4+40/140}
  ];
  const layout=P.layoutSpread(entries);
  assert.equal(layout.pieces.length,3);assert.equal(layout.more,1);
  assert.deepEqual(layout.pieces.map(p=>p.id),['final','midterm','quiz-3']);
  for(let i=1;i<layout.pieces.length;i++)assert.ok(layout.pieces[i].y<layout.pieces[i-1].y,'descending toward the tail');
  for(const p of layout.pieces){
    assert.ok(p.lo>=0&&p.hi<=H,`${p.id} inside the page`);
    // The completed tag's back-fold lies on its own arch.
    assert.ok(p.tagY+p.spec.tag.h<=p.hi+1e-12);
  }
  for(let i=1;i<layout.pieces.length;i++)assert.ok(layout.pieces[i].hi<layout.pieces[i-1].lo,'footprints including tags do not overlap');
  // describeSpread views name their pop-ups by id.
  const view={popups:['midterm','quiz-3'],entries};
  assert.deepEqual(P.layoutSpread(view).pieces.map(p=>p.id),['midterm','quiz-3']);
  assert.equal(P.layoutSpread(view).more,2);
  // Spec slots when nothing collides.
  assert.ok(Math.abs(P.layoutSpread([{id:'m',kind:'midterm',rank:4}]).pieces[0].y-.5*H)<1e-12);
  assert.ok(Math.abs(P.layoutSpread([{id:'q',kind:'quiz',rank:2},{id:'n',kind:'minor',rank:0}]).pieces[1].y-.32*H)<1e-12);
});

/* Hood clearance (§10.1). The sheet is sampled independently with Codex bendPoint (240 chords; sagitta < 0.01 mm) and every
   outgoing (left page ↔ sheet front) and incoming (sheet back ↔ right page) vertex must stay on its side within
   0.5 mm, for t in 0..1 step 0.01, for every kind, at rest and fast-gesture radii, with equal and stepped block
   heights. The stack offset passed as sheet.z follows the recommended engine model: the sheet stays at the
   right block's height while it rests on it and changes height only while airborne (or while lifting off a
   lower stack), so its flat run never sinks into a page. */
const radius=(t,v=0)=>Math.min(W/Math.PI,Math.max(W*MIN_RADIUS_RATIO,(.14*W+(W/Math.PI-.14*W)*Math.sin(Math.PI*t)**.8)*(1-Math.min(.3,.12*Math.abs(v)))));
const stackZ=(t,zL,zR)=>zR+(zL-zR)*(zL>zR?P.smoothstep(0,.5,t):P.smoothstep(.5,1,t));
function sheetSamples(t,r,z){
  return Array.from({length:241},(_,i)=>{const b=bendPoint(W*i/240,0,{turn:t,radius:r,width:W});return {x:b.position[0],z:b.position[2]+z+P.SHEET_LIFT,nx:b.normal[0],nz:b.normal[2]};});
}
function side(samples,x,z){
  let best=null;
  for(let i=0;i<samples.length-1;i++){
    const a=samples[i],b=samples[i+1],dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz;
    const raw=l2?((x-a.x)*dx+(z-a.z)*dz)/l2:0,u=Math.min(1,Math.max(0,raw)),px=a.x+dx*u,pz=a.z+dz*u,d=Math.hypot(x-px,z-pz);
    if(!best||d<best.d)best={d,s:(x-px)*(a.nx+(b.nx-a.nx)*u)+(z-pz)*(a.nz+(b.nz-a.nz)*u),end:(i===0&&raw<=1e-9)||(i===samples.length-2&&raw>1)};
  }
  return best;
}
test('hood clearance: outgoing and incoming pieces stay on their side of the turning sheet (≤ 0.5 mm)',()=>{
  const layouts=[...KINDS.map(kind=>P.layoutSpread([{id:kind,kind,rank:RANK[kind]}])),
    P.layoutSpread([{id:'f',kind:'final',rank:6.3},{id:'m',kind:'midterm',rank:4.3},{id:'q',kind:'quiz',rank:2}])];
  let worst=0,where='';
  for(const [zL,zR] of [[.0055,.0055],[.0012,.0098],[.0098,.0012]])for(const v of [0,2.5]){
    for(let k=0;k<=100;k++){
      const t=k/100,r=radius(t,v),z=stackZ(t,zL,zR),samples=sheetSamples(t,r,z),sheet={sheet:{turn:t,radius:r,z}};
      for(const [role,pose,sign] of [['out',{left:{z:zL},right:sheet},1],['in',{left:sheet,right:{z:zR}},-1]]){
        for(const layout of layouts)for(const p of layout.pieces){
          const sol=P.solvePiece(p,pose);
          for(const vtx of P.pieceVertices(sol)){
            assert.ok(finite(vtx));
            const s=side(samples,vtx[0],vtx[2]);if(s.end)continue;
            const bad=-sign*s.s;if(bad>worst){worst=bad;where=`${role} ${p.id} t=${t} zL=${zL} zR=${zR} v=${v}`;}
          }
        }
      }
    }
  }
  assert.ok(worst<=.0005,`deepest ${worst*1000} mm at ${where}`);
});

test('the analytic sheet side test agrees with sampled bendPoint geometry',()=>{
  let checked=0;
  for(const t of [.05,.2,.35,.5,.62,.8,.95])for(const v of [0,2.5]){
    const r=radius(t,v),samples=sheetSamples(t,r,.003);
    for(let i=0;i<400;i++){
      const x=-W+2*W*((i*37)%400)/400,z=.002+.1*((i*91)%400)/400;
      const a=P.sheetSide({turn:t,radius:r,z:.003},x,z),b=side(samples,x,z);
      if(a.end||b.end||a.d<1e-4)continue;
      assert.ok(Math.abs(a.s-b.s)<2e-5,`t=${t} (${x},${z}) ${a.s} vs ${b.s}`);checked++;
    }
  }
  assert.ok(checked>1000);
});

test('without a sheet the linkage is never pressed, and pressing reports how much',()=>{
  const p=piece('final');
  assert.equal(P.solvePiece(p,P.restPose(.004,.006)).squash,0);
  const t=.72,r=radius(t),z=.0055,sol=P.solvePiece(p,{left:{z},right:{sheet:{turn:t,radius:r,z}}});
  assert.ok(sol.squash>0&&sol.squash<=1,'the curl presses the outgoing final late in the turn');
});

test('stamp angles are deterministic and within −10° to −4°',()=>{
  for(const id of ['quiz-1','quiz-2','midterm','final','x']){
    const a=P.stampAngle(id)*180/Math.PI;assert.ok(a>=-10&&a<=-4);assert.equal(P.stampAngle(id),P.stampAngle(id));
  }
});

/* ---- meshes (Three, no GPU needed) ---- */
const entry=(id,kind,more={})=>({id,kind,rank:RANK[kind],open:'assessment-'+id,title:id,when:'Date pending',...more});

test('a popup set shows ≤ 3 pieces whose pickable meshes are the visible geometry',()=>{
  const set=P.createPopupSet({tier:'high'});
  set.show({popups:['final','midterm','quiz-2'],entries:[entry('final','final'),entry('midterm','midterm',{chip:'NEXT'}),entry('quiz-2','quiz'),entry('x','minor')]});
  set.pose(P.restPose(.004,.006));
  assert.equal(set.stats().pieces,3);
  assert.equal(set.meshes().length,3+4,'tag + strips (the final has two)');
  for(const m of set.meshes()){
    assert.ok(m.userData.popup.id&&m.userData.popup.open);
    assert.ok(m.geometry.boundingSphere&&Number.isFinite(m.geometry.boundingSphere.radius));
  }
  assert.equal(set.stats().pickable,0,'not interactive until the engine says so');
  set.setInteractive(true);
  assert.equal(set.stats().pickable,7);
  set.setVisible(false);assert.equal(set.stats().pickable,0);set.setVisible(true);
  // Tags facing away from the camera are not pickable; a camera at the tail and above sees them.
  set.setCamera({x:0,y:-.4,z:.5});assert.equal(set.stats().pickable,7);
  set.setCamera({x:0,y:.6,z:-.3});assert.ok(set.stats().pickable<7);
  set.setCamera(null);
  // A turned-away sheet (folded closed) hides nothing it should not: folded pieces are not pickable.
  set.pose(hingePose(.3));assert.equal(set.stats().pickable,0,'r(θ) < 0.2 disables picking');
  set.dispose();
});

test('completion animates flat → desaturate → stamp with motion, and cuts without it',()=>{
  const set=P.createPopupSet();
  const view=done=>({popups:['midterm'],entries:[entry('midterm','midterm',{completed:done})]});
  set.show(view(false));set.pose(P.restPose(.004,.004));
  set.show(view(true),{animate:true});
  let frames=0,busy=true;
  while(busy&&frames<200){busy=set.update(1/60,{motion:true});frames++;}
  assert.ok(frames>=50&&frames<=60,`~920 ms of choreography, got ${frames} frames`);
  const [p]=set.pieces();assert.equal(p.flat,1);
  const sol=p.solution;assert.ok(Math.max(...sol.strips[0].points.map(q=>q[1]))-.004<=.0005,'lies flat');
  assert.equal(set.footShadows().k[0],0,'no contact shadow when flat');
  set.show(view(false),{animate:true});
  assert.equal(set.update(1/60,{motion:false}),false,'cut mode jumps to the end state');
  assert.equal(set.pieces()[0].flat,0);
  set.dispose();
});

test('arrival rises largest first; urgency glows only in the dark theme at high tier',()=>{
  const set=P.createPopupSet({tier:'high'});
  set.show({popups:['final','quiz-2'],entries:[entry('final','final'),entry('quiz-2','quiz',{chip:'SOON',urgency:'soon'})]});
  set.pose(P.restPose(.004,.004));
  set.arrive({delay:.25});
  assert.ok(set.pieces().every(p=>p.rise===0));
  set.update(.3,{motion:true});
  const [f,q]=set.pieces();assert.ok(f.rise>0&&q.rise===0,'final first, quiz staggered');
  while(set.update(1/60,{motion:true}));
  assert.ok(set.pieces().every(p=>p.rise===1));
  assert.equal(set.emitting(),true);
  set.setPalette(P.PALETTES.light);assert.equal(set.emitting(),false,'light theme never blooms');
  set.setPalette(P.PALETTES.dark);set.setTier('mid');assert.equal(set.emitting(),false,'mid tier uses halo quads');
  set.dispose();
});

test('a new pose re-solves when block heights or the sheet change, even at the same θ',()=>{
  const set=P.createPopupSet();
  set.show({popups:['midterm'],entries:[entry('midterm','midterm')]});
  set.pose(P.restPose(0,0));
  const z0=set.pieces()[0].solution.tag.G[2];
  set.pose(P.restPose(.0034,.0076));
  const sol=set.pieces()[0].solution;
  assert.ok(Math.abs(sol.tag.G[2]-.0076)<1e-9,'tag crease on the higher page');
  assert.ok(Math.abs(sol.strips[0].points[0][1]-.0034)<1e-9,'verso foot on the verso');
  assert.notEqual(z0,sol.tag.G[2]);
  const pos=set.meshes().find(m=>m.name==='popup-tag').geometry.attributes.position.array;
  assert.ok(Math.abs(pos[2]-.0034)<1e-4,'the mesh holds the new pose (the plate corner rests on the verso)');
  set.dispose();
});
