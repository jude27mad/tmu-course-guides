import * as T from '../vendor/three-0.186.1.mjs?v=20261012-future1';

// Original, tileable surface field. A single texture is shared by every material.
export function createFutureLook(palette){
 const size=128,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size*Math.PI*2,v=y/size*Math.PI*2;
  const n=.5+.2*Math.sin(u*3+Math.sin(v*2))+.1*Math.sin(v*7+Math.cos(u*5))+.06*Math.sin(u*19+v*13);
  const i=(y*size+x)*4;
  data[i]=Math.round(n*255);data[i+1]=Math.round(155+n*90);data[i+2]=Math.round(n*255);data[i+3]=255;
 }
 const field=new T.DataTexture(data,size,size,T.RGBAFormat,T.UnsignedByteType);
 field.wrapS=field.wrapT=T.RepeatWrapping;field.repeat.set(3,3);field.needsUpdate=true;
 const physical=(color,extra={})=>new T.MeshPhysicalMaterial({color,roughness:.23,metalness:.9,clearcoat:.65,clearcoatRoughness:.16,...extra});
 const materials={
  metal:physical('#b7c4ca',{roughnessMap:field,roughness:.3,iridescence:.13}),
  ceramic:physical('#3e515c',{metalness:.32,roughness:.28,clearcoat:.85}),
  glass:physical('#e9f2f4',{metalness:0,roughness:.045,transmission:.97,thickness:.45,ior:1.46,dispersion:.22,iridescence:.55,iridescenceThicknessRange:[200,550],attenuationColor:palette.accent,attenuationDistance:3.5,clearcoat:1,side:T.DoubleSide}),
  light:new T.MeshBasicMaterial({color:palette.accent}),
  flow:physical('#bad0ca',{roughnessMap:field,roughness:.24,iridescence:.65,iridescenceIOR:1.36,iridescenceThicknessRange:[180,540]})
 };
 const uniforms={uFutureTime:{value:0},uFutureImpulse:{value:0},uFutureAccent:{value:new T.Color(palette.accent)}};
 materials.flow.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  const common='\nuniform float uFutureTime;\nuniform float uFutureImpulse;\nuniform vec3 uFutureAccent;\nvarying vec3 vFuturePosition;\n';
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>'+common)
   .replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
    float futurePhase=position.x*2.1+position.y*1.7-uFutureTime*.55;
    float futureAmplitude=.07+uFutureImpulse*.085;
    float futureDerivative=cos(futurePhase)*futureAmplitude;
    objectNormal=normalize(vec3(objectNormal.x-objectNormal.z*futureDerivative*2.1,objectNormal.y-objectNormal.z*futureDerivative*1.7,objectNormal.z));`)
   .replace('#include <begin_vertex>',`#include <begin_vertex>
    transformed.z+=sin(futurePhase)*futureAmplitude;
    vFuturePosition=transformed;`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>'+common)
   .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
    float futureAngle=atan(vFuturePosition.y,vFuturePosition.x);
    float futureFlow=sin(futureAngle*11.0+length(vFuturePosition.xy)*14.0-uFutureTime*.65);
    roughnessFactor=mix(roughnessFactor,roughnessFactor*.6,smoothstep(.55,1.0,futureFlow));`)
   .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
    totalEmissiveRadiance+=uFutureAccent*.025*smoothstep(.94,1.0,futureFlow);`);
 };
 materials.flow.customProgramCacheKey=()=> 'future-flow-1';
 let disposed=false;
 return{materials,
  update(time,impulse){uniforms.uFutureTime.value=Number.isFinite(time)?time:0;uniforms.uFutureImpulse.value=Math.max(0,Math.min(1,impulse||0));},
  setQuality(mode){materials.glass.dispersion=mode==='full'?.22:0;materials.glass.transmission=mode==='software'?0:.97;},
  disposeTextures(){if(!disposed){disposed=true;field.dispose();}}
 };
}

export function createStudioEnvironment(palette){
 const scene=new T.Scene();scene.background=new T.Color('#0b1015');
 function panel(color,w,h,position){const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color,side:T.DoubleSide}));m.position.set(...position);m.lookAt(0,0,0);scene.add(m);}
 panel(new T.Color(4.5,4.7,5),3.4,7,[-4,3,5]);
 panel(new T.Color(2.3,2.4,2.5),.65,8,[3,2,4]);
 panel(new T.Color(palette.accent).multiplyScalar(2),4,1.5,[2,-4,2]);
 panel(new T.Color(1.6,1.8,2),6,2,[0,5,-3]);
 return scene;
}
