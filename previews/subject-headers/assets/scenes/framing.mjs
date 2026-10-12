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
