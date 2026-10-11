// Pure calculations shared by the visual labs and their numerical checks.
export const bases={square:x=>x*x,absolute:Math.abs,sqrt:x=>x<0?NaN:Math.sqrt(x),sine:Math.sin};
export function transformed(base,a,h,k,x){return a*bases[base](x-h)+k;}
export function multiply(x,y,u,v){return [x*u-y*v,x*v+y*u];}
export function determinant(a,b,c,d){return a*d-b*c;}
export function matrixAt(a,b,c,d,t){return [1+(a-1)*t,b*t,c*t,1+(d-1)*t].map(v=>v===0?0:v);}
export function transformPoint(matrix,x,y){return [matrix[0]*x+matrix[1]*y,matrix[2]*x+matrix[3]*y];}
export function intersection(m1,b1,m2,b2){if(Math.abs(m1-m2)<1e-10)return {kind:Math.abs(b1-b2)<1e-10?'infinite':'none'};const x=(b2-b1)/(m1-m2);return {kind:'one',x,y:m1*x+b1};}
export function secant(x,h){return Math.abs(h)<1e-10?null:2*x+h;}
export function limitValue(kind,x){if(kind==='hole')return Math.abs(x-1)<1e-10?3:x+1;if(kind==='jump')return x<1?1:3;if(kind==='pole')return Math.abs(x-1)<1e-10?NaN:1/(x-1);return x*x;}
export const limitFacts={smooth:{left:'1',right:'1',value:'1',limit:'1'},hole:{left:'2',right:'2',value:'3',limit:'2'},jump:{left:'1',right:'3',value:'3',limit:'Does not exist'},pole:{left:'−∞',right:'+∞',value:'Undefined',limit:'Does not exist'}};
