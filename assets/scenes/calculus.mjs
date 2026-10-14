import {T,mesh,disposeScene} from './primitives.mjs?v=20261014-book1';
// Many strands sample a moving family of smooth curves. Position and slope share one function.
const functionGLSL=`float wave(float x,float z,float t){return 1.55*sin(1.18*x+1.5*z+t*.23)+.18*sin(z*2.1+t*.28)+.08*x;}`;
export function createCalculus(p){
 const root=new T.Group();root.name='calculus-ribbons';
 const positions=[],uvs=[],indices=[],strands=80,steps=144;
 for(let j=0;j<strands;j++){const z=-1.4+2.8*j/(strands-1);for(let i=0;i<=steps;i++){const x=-2.15+4.3*i/steps;for(const side of [-1,1]){positions.push(x,side*.014,z);uvs.push(i/steps,j/(strands-1));}if(i<steps){const a=(j*(steps+1)+i)*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}}}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geo.setIndex(indices);
 const uniforms={time:{value:0},color:{value:new T.Color(p.accent)}};
 const mat=new T.ShaderMaterial({uniforms,side:T.DoubleSide,transparent:true,depthWrite:false,
 vertexShader:`uniform float time;varying vec2 vUv;${functionGLSL}void main(){vUv=uv;vec3 p=position;p.y+=wave(p.x,p.z,time);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
 fragmentShader:'uniform float time;uniform vec3 color;varying vec2 vUv;void main(){float edge=smoothstep(0.,.1,vUv.x)*(1.-smoothstep(.85,1.,vUv.x));float pulse=pow(.5+.5*sin(vUv.x*7.-time*.65+vUv.y*2.),6.);float band=.45+.55*sin(vUv.y*3.14159);gl_FragColor=vec4(mix(color,vec3(.9,1.,.95),pulse*.25),edge*band*(.82+pulse*.18));}'});
 mesh(root,geo,mat);
 const tracePoints=[];for(let i=0;i<=160;i++)tracePoints.push(-2.15+4.3*i/160,0,0);
 const trace=new T.BufferGeometry();trace.setAttribute('position',new T.Float32BufferAttribute(tracePoints,3));const traceMat=new T.ShaderMaterial({uniforms,transparent:true,vertexShader:`uniform float time;${functionGLSL}void main(){vec3 p=position;p.y=wave(p.x,0.,time)+.025;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:'void main(){gl_FragColor=vec4(.8,1.,.89,.85);}'});root.add(new T.Line(trace,traceMat));
 const dot=mesh(root,new T.SphereGeometry(.045,16,12),new T.MeshBasicMaterial({color:'#e5fff0'}));
 const tangent=mesh(root,new T.CylinderGeometry(.009,.009,1.1,6),new T.MeshBasicMaterial({color:'#f0ffe8',transparent:true,opacity:.65}));
 const up=new T.Vector3(0,1,0),direction=new T.Vector3();let disposed=false;
 return{root,bounds:[6.1,3.6],caption:'Continuous change',setQuality(){},react(){},update(t,dt,{still=false}={}){uniforms.time.value=t;const x=1.6*Math.sin(t*.27),y=1.55*Math.sin(1.18*x+t*.23)+.18*Math.sin(t*.28)+.08*x,slope=1.55*1.18*Math.cos(1.18*x+t*.23)+.08;dot.position.set(x,y+.045,0);tangent.position.copy(dot.position);tangent.quaternion.setFromUnitVectors(up,direction.set(1,slope,0).normalize());},dispose(){if(!disposed){disposed=true;disposeScene(root);}}};
}
