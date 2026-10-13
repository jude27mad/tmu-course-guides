import {T,mesh,arrow,disposeScene} from './primitives.mjs?v=20261013-stage1';
import {sphereTransform} from './scene-math.mjs?v=20261012-subject1';
export function createAlgebra(p){
 const root=new T.Group(),volume=new T.Group();root.add(volume);root.name='linear-transformation';volume.matrixAutoUpdate=false;
 const positions=[],count=4800,golden=Math.PI*(3-Math.sqrt(5));
 for(let i=0;i<count;i++){const y=1-2*(i+.5)/count,r=Math.sqrt(1-y*y),a=i*golden;positions.push(1.3*r*Math.cos(a),1.3*y,1.3*r*Math.sin(a));}
 const dots=new T.BufferGeometry();dots.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 const pointMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:{color:{value:new T.Color(p.accent)},pixelRatio:{value:1.5}},
 vertexShader:'uniform float pixelRatio; varying float depth; void main(){vec4 mv=modelViewMatrix*vec4(position,1.);depth=clamp((mv.z+12.)/10.,.2,1.);gl_PointSize=clamp(22.*pixelRatio/-mv.z,1.,5.);gl_Position=projectionMatrix*mv;}',
 fragmentShader:'uniform vec3 color; varying float depth; void main(){float r=length(gl_PointCoord-.5);float a=1.-smoothstep(.15,.5,r);gl_FragColor=vec4(color,a*depth*.85);}' });
 volume.add(new T.Points(dots,pointMaterial));
 const shell=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{color:{value:new T.Color('#9e78d1')}},vertexShader:'varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',fragmentShader:'uniform vec3 color;varying vec3 n;varying vec3 v;void main(){float f=pow(1.-abs(dot(normalize(n),normalize(v))),2.8);gl_FragColor=vec4(color,.025+f*.23);}'});
 const surface=mesh(volume,new T.SphereGeometry(1.30,64,40),shell);
 const tracks=[];for(let j=1;j<8;j++){const lat=-Math.PI/2+j*Math.PI/8;for(let i=0;i<128;i++){for(const a of [i*2*Math.PI/128,(i+1)*2*Math.PI/128])tracks.push(1.305*Math.cos(lat)*Math.cos(a),1.305*Math.sin(lat),1.305*Math.cos(lat)*Math.sin(a));}}
 for(let j=0;j<8;j++){const lon=j*Math.PI/8;for(let i=0;i<128;i++){for(const a of [i*2*Math.PI/128,(i+1)*2*Math.PI/128])tracks.push(1.305*Math.cos(a)*Math.cos(lon),1.305*Math.sin(a),1.305*Math.cos(a)*Math.sin(lon));}}
 const lines=new T.BufferGeometry();lines.setAttribute('position',new T.Float32BufferAttribute(tracks,3));volume.add(new T.LineSegments(lines,new T.LineBasicMaterial({color:'#c9b5ee',transparent:true,opacity:.22,depthWrite:false})));
 const axes=['#efc7fd','#a1c6ee','#fff1cf'].map(c=>arrow(root,new T.MeshBasicMaterial({color:c}))),basis=[[1.75,0,0],[0,1.75,0],[0,0,1.75]];
 let disposed=false;
 return{root,bounds:[4.5,4.5],caption:'Linear transformations',setQuality(){},react(){},
 update(t,dt,{still=false}={}){const m=sphereTransform(t);surface.visible=m[8]>.08;volume.matrix.set(m[0],m[1],m[2],0,m[3],m[4],m[5],0,m[6],m[7],m[8],0,0,0,0,1);volume.matrixWorldNeedsUpdate=true;for(let i=0;i<3;i++){const b=basis[i],v=[m[0]*b[0]+m[1]*b[1]+m[2]*b[2],m[3]*b[0]+m[4]*b[1]+m[5]*b[2],m[6]*b[0]+m[7]*b[1]+m[8]*b[2]];axes[i].group.visible=Math.hypot(...v)>.08;if(axes[i].group.visible)axes[i].set([0,0,0],v);}},
 dispose(){if(!disposed){disposed=true;disposeScene(root);}}};
}
