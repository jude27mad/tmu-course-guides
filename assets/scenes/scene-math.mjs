/* Actual mathematical coordinates; presentation transforms never alter the maths. */
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const ease=t=>{t=clamp(t);return t*t*(3-2*t);};
export function calculusState(time,still=false){
 if(still)return {x:1,y:1,qx:1,qy:1,slope:2,secant:false};
 if(time<5){const h=.85*(1-ease((time-.6)/3.4));return{x:1,y:1,qx:1+h,qy:(1+h)**2,slope:2+h,secant:h>.002};}
 const x=1+.48*Math.sin((time-5)*.28);
 return{x,y:x*x,qx:x,qy:x*x,slope:2*x,secant:false};
}
export function algebraState(time,still=false){
 const phase=still?4:time%22;
 const shear=phase<5?.65*ease(phase/4):phase<9?.65:phase<13?.65*(1-ease((phase-9)/4)):0;
 const angle=phase<13?0:Math.PI/3*ease((phase-13)/4)*(1-ease((phase-18)/4));
 const c=Math.cos(angle),s=Math.sin(angle),apply=([x,y])=>[c*(x+shear*y)-s*y,s*(x+shear*y)+c*y];
 return{shear,angle,u:apply([1,0]),v:apply([0,1]),square:[[0,0],[1,0],[1,1],[0,1]].map(apply)};
}
const routeMetrics=new WeakMap();
export function routePoint(points,t,out=[0,0,0]){
 let metric=routeMetrics.get(points);if(!metric){const lengths=points.slice(1).map((p,i)=>Math.hypot(...p.map((v,j)=>v-points[i][j])));metric={lengths,total:lengths.reduce((a,b)=>a+b,0)};routeMetrics.set(points,metric);}const {lengths,total}=metric;let d=clamp(t)*total;
 for(let i=0;i<lengths.length;i++){if(d<=lengths[i]||i===lengths.length-1){const q=lengths[i]?d/lengths[i]:0;for(let j=0;j<3;j++)out[j]=points[i][j]+(points[i+1][j]-points[i][j])*q;break;}d-=lengths[i];}return out;
}

// Fixed annulus: Ns(ws-wc) + Np(wp-wc) = 0, Np(wp-wc) = -Nr*wc.
export function planetaryState(t){const sun=t*.55,carrier=sun*24/84;return{sun,carrier,planet:carrier*(1-60/18)};}
export function sphereTransform(time){
 const states=[[1,0,0,0,1,0,0,0,1],[1.5,0,0,0,.8,0,0,0,.8],[1,.7,0,0,1,0,0,0,1],[1.25,.35,0,0,1,0,0,0,0],[1,0,0,0,1,0,0,0,1]];
 const phase=((time%24)+24)%24/6,i=Math.floor(phase),u=phase-i,s=u*u*(3-2*u);return states[i].map((v,j)=>v+(states[i+1][j]-v)*s);
}
