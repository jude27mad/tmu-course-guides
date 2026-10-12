const settings={
 cen100:{width:5.4,height:5.4,rotation:[.48,-.22,-.18]},
 mth140:{width:6.3,height:4.4,rotation:[.55,-.16,-.23]},
 mth141:{width:4.8,height:4.8,rotation:[.28,-.36,-.16]}
};
export function framePose(course,width,height){
 const p=settings[course],aspect=Math.max(.25,width/Math.max(1,height));
 const vertical=Math.max(p.height,p.width/aspect);
 return{distance:vertical/(2*Math.tan(33*Math.PI/360)),position:[0,0,0],rotation:p.rotation,portrait:width<680};
}
export function posterPaths(course){return{wide:new URL(`./posters/${course}-wide.webp?v=20261012-subject1`,import.meta.url).href,tall:new URL(`./posters/${course}-tall.webp?v=20261012-subject1`,import.meta.url).href};}
// Conservative local bounds include every animated pose and basis arrow.
export function fitBounds(course){return course==='cen100'?[2.43,2.43,.48]:course==='mth140'?[2.76,1.32,1.22]:[2.68,1.82,1.82];}
export function rotationFitDistance(course,aspect,[rx,ry,rz]){
 const [bx,by,bz]=fitBounds(course),a=Math.cos(rx),b=Math.sin(rx),c=Math.cos(ry),d=Math.sin(ry),e=Math.cos(rz),f=Math.sin(rz),tan=Math.tan(33*Math.PI/360);let distance=0;
 for(const x of [-bx,bx])for(const y of [-by,by])for(const z of [-bz,bz]){
  const px=c*e*x-c*f*y+d*z,py=(a*f+b*e*d)*x+(a*e-b*f*d)*y-b*c*z,pz=(b*f-a*e*d)*x+(b*e+a*f*d)*y+a*c*z;
  distance=Math.max(distance,pz+Math.abs(py)*1.06/tan,pz+Math.abs(px)*1.06/(tan*aspect));
 }
 return distance;
}
