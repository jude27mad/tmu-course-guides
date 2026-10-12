const settings={
 cen100:{width:5.6,height:5.8,rotation:[-.40,-.30,-.12]},
 mth140:{width:5.35,height:5.5,rotation:[.56,-.32,-.23]},
 mth141:{width:4.05,height:4.3,rotation:[.34,-.48,-.12]}
};
export function framePose(course,width,height){
 const p=settings[course],aspect=Math.max(.25,width/Math.max(1,height)),portrait=width<680;
 const vertical=portrait?Math.max(p.height*.9,p.width/aspect*1.04):p.height;
 return{distance:vertical/(2*Math.tan(33*Math.PI/360)),position:[portrait?0:vertical*aspect*.23,portrait?-vertical*(course==='cen100'?.21:.14):0,0],rotation:p.rotation,portrait};
}
export function posterPaths(course){return{wide:new URL(`./posters/${course}-wide.webp`,import.meta.url).href,tall:new URL(`./posters/${course}-tall.webp`,import.meta.url).href};}
