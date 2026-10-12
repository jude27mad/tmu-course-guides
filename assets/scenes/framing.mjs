import {sphereTransform} from './scene-math.mjs?v=20261012-subject1';
const settings={
 cen100:{width:5.4,height:5.4,rotation:[.48,-.22,-.18]},
 mth140:{width:6.3,height:4.4,rotation:[.22,-.16,-.23]},
 mth141:{width:4.8,height:4.8,rotation:[.28,-.36,-.16]}
};
export function framePose(course,width,height){
 return{distance:3,position:[0,0,0],rotation:settings[course].rotation,portrait:width<680};
}
export function posterPaths(course){return{wide:new URL(`./posters/${course}-wide.webp?v=20261012-subject1`,import.meta.url).href,tall:new URL(`./posters/${course}-tall.webp?v=20261012-subject1`,import.meta.url).href};}
// Support functions fit the actual circular/ellipsoidal volume, not an empty box.
export function fitBounds(course){return course==='cen100'?[2.43,2.43,.48]:course==='mth140'?[2.16,1.96,1.42]:[2.68,1.82,1.82];}
export function rotationFitDistance(course,aspect,[rx,ry,rz],time=0){
 const a=Math.cos(rx),b=Math.sin(rx),c=Math.cos(ry),d=Math.sin(ry),e=Math.cos(rz),f=Math.sin(rz),tan=Math.tan(33*Math.PI/360);
 const rows=[[c*e,-c*f,d],[a*f+b*e*d,a*e-b*f*d,-b*c],[b*f-a*e*d,b*e+a*f*d,a*c]];
 const constraints=[];for(const axis of [0,1])for(const sign of [-1,1])constraints.push(rows[2].map((v,i)=>v+sign*rows[axis][i]/(tan*(axis===0?aspect:1))));
 let distance=0;const matrix=course==='mth141'?sphereTransform(time):null;
 for(const v of constraints){let support;
  if(course==='cen100')support=2.43*Math.hypot(v[0],v[1])+.48*Math.abs(v[2]);
  else if(matrix){const u=[0,1,2].map(j=>v[0]*matrix[j]+v[1]*matrix[j+3]+v[2]*matrix[j+6]);support=Math.max(1.32*Math.hypot(...u),...u.map(n=>1.78*n+.09*Math.hypot(...v)));}
  else{
   const radius=Math.hypot(...v);support=0;
   for(let i=0;i<=32;i++)for(let j=0;j<=16;j++){const x=-2.15+4.3*i/32,z=-1.4+2.8*j/16,y=1.55*Math.sin(1.18*x+1.5*z+time*.23)+.18*Math.sin(z*2.1+time*.28)+.08*x;support=Math.max(support,v[0]*x+v[1]*y+v[2]*z);}
   support+=.10*radius;
   const x=1.6*Math.sin(time*.27),y=1.55*Math.sin(1.18*x+time*.23)+.18*Math.sin(time*.28)+.08*x+.045;
   const slope=1.55*1.18*Math.cos(1.18*x+time*.23)+.08,half=.55/Math.hypot(1,slope);
   support=Math.max(support,v[0]*x+v[1]*y+.045*radius);
   for(const sign of [-1,1])support=Math.max(support,v[0]*(x+sign*half)+v[1]*(y+sign*half*slope)+.01*radius);
  }
  distance=Math.max(distance,support);
 }
 return Math.max(3,distance*1.07);
}
