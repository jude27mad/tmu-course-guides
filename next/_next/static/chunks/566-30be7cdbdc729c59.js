"use strict";(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[566],{7485:function(t,e,i){i.d(e,{Rt:function(){return o},r7:function(){return c}});var s=i(9477),r=Object.defineProperty,a=(t,e,i)=>e in t?r(t,e,{enumerable:!0,configurable:!0,writable:!0,value:i}):t[e]=i,n=(t,e,i)=>(a(t,"symbol"!=typeof e?e+"":e,i),i);function u(t,e,i,s,r){let a;if(t=t.subarray||t.slice?t:t.buffer,i=i.subarray||i.slice?i:i.buffer,t=e?t.subarray?t.subarray(e,r&&e+r):t.slice(e,r&&e+r):t,i.set)i.set(t,s);else for(a=0;a<t.length;a++)i[a+s]=t[a];return i}class o extends s.BufferGeometry{constructor(){super(),n(this,"type","MeshLine"),n(this,"isMeshLine",!0),n(this,"positions",[]),n(this,"previous",[]),n(this,"next",[]),n(this,"side",[]),n(this,"width",[]),n(this,"indices_array",[]),n(this,"uvs",[]),n(this,"counters",[]),n(this,"widthCallback",null),n(this,"_attributes"),n(this,"_points",[]),n(this,"points"),n(this,"matrixWorld",new s.Matrix4),Object.defineProperties(this,{points:{enumerable:!0,get(){return this._points},set(t){this.setPoints(t,this.widthCallback)}}})}setMatrixWorld(t){this.matrixWorld=t}setPoints(t,e){var i;if(t=(i=t)instanceof Float32Array?i:i instanceof s.BufferGeometry?i.getAttribute("position").array:i.map(t=>{let e=Array.isArray(t);return t instanceof s.Vector3?[t.x,t.y,t.z]:t instanceof s.Vector2?[t.x,t.y,0]:e&&3===t.length?[t[0],t[1],t[2]]:e&&2===t.length?[t[0],t[1],0]:t}).flat(),this._points=t,this.widthCallback=null!=e?e:null,this.positions=[],this.counters=[],t.length&&t[0]instanceof s.Vector3)for(let e=0;e<t.length;e++){let i=t[e],s=e/(t.length-1);this.positions.push(i.x,i.y,i.z),this.positions.push(i.x,i.y,i.z),this.counters.push(s),this.counters.push(s)}else for(let e=0;e<t.length;e+=3){let i=e/(t.length-1);this.positions.push(t[e],t[e+1],t[e+2]),this.positions.push(t[e],t[e+1],t[e+2]),this.counters.push(i),this.counters.push(i)}this.process()}compareV3(t,e){let i=6*t,s=6*e;return this.positions[i]===this.positions[s]&&this.positions[i+1]===this.positions[s+1]&&this.positions[i+2]===this.positions[s+2]}copyV3(t){let e=6*t;return[this.positions[e],this.positions[e+1],this.positions[e+2]]}process(){let t,e;let i=this.positions.length/6;this.previous=[],this.next=[],this.side=[],this.width=[],this.indices_array=[],this.uvs=[],e=this.compareV3(0,i-1)?this.copyV3(i-2):this.copyV3(0),this.previous.push(e[0],e[1],e[2]),this.previous.push(e[0],e[1],e[2]);for(let s=0;s<i;s++){if(this.side.push(1),this.side.push(-1),t=this.widthCallback?this.widthCallback(s/(i-1)):1,this.width.push(t),this.width.push(t),this.uvs.push(s/(i-1),0),this.uvs.push(s/(i-1),1),s<i-1){e=this.copyV3(s),this.previous.push(e[0],e[1],e[2]),this.previous.push(e[0],e[1],e[2]);let t=2*s;this.indices_array.push(t,t+1,t+2),this.indices_array.push(t+2,t+1,t+3)}s>0&&(e=this.copyV3(s),this.next.push(e[0],e[1],e[2]),this.next.push(e[0],e[1],e[2]))}e=this.compareV3(i-1,0)?this.copyV3(1):this.copyV3(i-1),this.next.push(e[0],e[1],e[2]),this.next.push(e[0],e[1],e[2]),this._attributes&&this._attributes.position.count===this.counters.length?(this._attributes.position.copyArray(new Float32Array(this.positions)),this._attributes.position.needsUpdate=!0,this._attributes.previous.copyArray(new Float32Array(this.previous)),this._attributes.previous.needsUpdate=!0,this._attributes.next.copyArray(new Float32Array(this.next)),this._attributes.next.needsUpdate=!0,this._attributes.side.copyArray(new Float32Array(this.side)),this._attributes.side.needsUpdate=!0,this._attributes.width.copyArray(new Float32Array(this.width)),this._attributes.width.needsUpdate=!0,this._attributes.uv.copyArray(new Float32Array(this.uvs)),this._attributes.uv.needsUpdate=!0,this._attributes.index.copyArray(new Uint16Array(this.indices_array)),this._attributes.index.needsUpdate=!0):this._attributes={position:new s.BufferAttribute(new Float32Array(this.positions),3),previous:new s.BufferAttribute(new Float32Array(this.previous),3),next:new s.BufferAttribute(new Float32Array(this.next),3),side:new s.BufferAttribute(new Float32Array(this.side),1),width:new s.BufferAttribute(new Float32Array(this.width),1),uv:new s.BufferAttribute(new Float32Array(this.uvs),2),index:new s.BufferAttribute(new Uint16Array(this.indices_array),1),counters:new s.BufferAttribute(new Float32Array(this.counters),1)},this.setAttribute("position",this._attributes.position),this.setAttribute("previous",this._attributes.previous),this.setAttribute("next",this._attributes.next),this.setAttribute("side",this._attributes.side),this.setAttribute("width",this._attributes.width),this.setAttribute("uv",this._attributes.uv),this.setAttribute("counters",this._attributes.counters),this.setAttribute("position",this._attributes.position),this.setAttribute("previous",this._attributes.previous),this.setAttribute("next",this._attributes.next),this.setAttribute("side",this._attributes.side),this.setAttribute("width",this._attributes.width),this.setAttribute("uv",this._attributes.uv),this.setAttribute("counters",this._attributes.counters),this.setIndex(this._attributes.index),this.computeBoundingSphere(),this.computeBoundingBox()}advance({x:t,y:e,z:i}){let s=this._attributes.position.array,r=this._attributes.previous.array,a=this._attributes.next.array,n=s.length;u(s,0,r,0,n),u(s,6,s,0,n-6),s[n-6]=t,s[n-5]=e,s[n-4]=i,s[n-3]=t,s[n-2]=e,s[n-1]=i,u(s,6,a,0,n-6),a[n-6]=t,a[n-5]=e,a[n-4]=i,a[n-3]=t,a[n-2]=e,a[n-1]=i,this._attributes.position.needsUpdate=!0,this._attributes.previous.needsUpdate=!0,this._attributes.next.needsUpdate=!0}}let h=`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  #include <fog_pars_vertex>
  #include <clipping_planes_pars_vertex>

  attribute vec3 previous;
  attribute vec3 next;
  attribute float side;
  attribute float width;
  attribute float counters;
  
  uniform vec2 resolution;
  uniform float lineWidth;
  uniform vec3 color;
  uniform float opacity;
  uniform float sizeAttenuation;
  
  varying vec2 vUV;
  varying vec4 vColor;
  varying float vCounters;
  
  vec2 fix(vec4 i, float aspect) {
    vec2 res = i.xy / i.w;
    res.x *= aspect;
    return res;
  }
  
  void main() {
    float aspect = resolution.x / resolution.y;
    vColor = vec4(color, opacity);
    vUV = uv;
    vCounters = counters;
  
    mat4 m = projectionMatrix * modelViewMatrix;
    vec4 finalPosition = m * vec4(position, 1.0) * aspect;
    vec4 prevPos = m * vec4(previous, 1.0);
    vec4 nextPos = m * vec4(next, 1.0);
  
    vec2 currentP = fix(finalPosition, aspect);
    vec2 prevP = fix(prevPos, aspect);
    vec2 nextP = fix(nextPos, aspect);
  
    float w = lineWidth * width;
  
    vec2 dir;
    if (nextP == currentP) dir = normalize(currentP - prevP);
    else if (prevP == currentP) dir = normalize(nextP - currentP);
    else {
      vec2 dir1 = normalize(currentP - prevP);
      vec2 dir2 = normalize(nextP - currentP);
      dir = normalize(dir1 + dir2);
  
      vec2 perp = vec2(-dir1.y, dir1.x);
      vec2 miter = vec2(-dir.y, dir.x);
      //w = clamp(w / dot(miter, perp), 0., 4. * lineWidth * width);
    }
  
    //vec2 normal = (cross(vec3(dir, 0.), vec3(0., 0., 1.))).xy;
    vec4 normal = vec4(-dir.y, dir.x, 0., 1.);
    normal.xy *= .5 * w;
    //normal *= projectionMatrix;
    if (sizeAttenuation == 0.) {
      normal.xy *= finalPosition.w;
      normal.xy /= (vec4(resolution, 0., 1.) * projectionMatrix).xy * aspect;
    }
  
    finalPosition.xy += normal.xy * side;
    gl_Position = finalPosition;
    #include <logdepthbuf_vertex>
    #include <fog_vertex>
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    #include <clipping_planes_vertex>
    #include <fog_vertex>
  }
`,l=parseInt(s.REVISION.replace(/\D+/g,"")),p=`
  #include <fog_pars_fragment>
  #include <logdepthbuf_pars_fragment>
  #include <clipping_planes_pars_fragment>
  
  uniform sampler2D map;
  uniform sampler2D alphaMap;
  uniform float useGradient;
  uniform float useMap;
  uniform float useAlphaMap;
  uniform float useDash;
  uniform float dashArray;
  uniform float dashOffset;
  uniform float dashRatio;
  uniform float visibility;
  uniform float alphaTest;
  uniform vec2 repeat;
  uniform vec3 gradient[2];
  
  varying vec2 vUV;
  varying vec4 vColor;
  varying float vCounters;
  
  void main() {
    #include <logdepthbuf_fragment>
    vec4 diffuseColor = vColor;
    if (useGradient == 1.) diffuseColor = vec4(mix(gradient[0], gradient[1], vCounters), 1.0);
    if (useMap == 1.) diffuseColor *= texture2D(map, vUV * repeat);
    if (useAlphaMap == 1.) diffuseColor.a *= texture2D(alphaMap, vUV * repeat).a;
    if (diffuseColor.a < alphaTest) discard;
    if (useDash == 1.) diffuseColor.a *= ceil(mod(vCounters + dashOffset, dashArray) - (dashArray * dashRatio));
    diffuseColor.a *= step(vCounters, visibility);
    #include <clipping_planes_fragment>
    gl_FragColor = diffuseColor;     
    #include <fog_fragment>
    #include <tonemapping_fragment>
    #include <${l>=154?"colorspace_fragment":"encodings_fragment"}>
  }
`;class c extends s.ShaderMaterial{constructor(t){super({uniforms:{...s.UniformsLib.fog,lineWidth:{value:1},map:{value:null},useMap:{value:0},alphaMap:{value:null},useAlphaMap:{value:0},color:{value:new s.Color(16777215)},gradient:{value:[new s.Color(16711680),new s.Color(65280)]},opacity:{value:1},resolution:{value:new s.Vector2(1,1)},sizeAttenuation:{value:1},dashArray:{value:0},dashOffset:{value:0},dashRatio:{value:.5},useDash:{value:0},useGradient:{value:0},visibility:{value:1},alphaTest:{value:0},repeat:{value:new s.Vector2(1,1)}},vertexShader:h,fragmentShader:p}),n(this,"lineWidth"),n(this,"map"),n(this,"useMap"),n(this,"alphaMap"),n(this,"useAlphaMap"),n(this,"color"),n(this,"gradient"),n(this,"resolution"),n(this,"sizeAttenuation"),n(this,"dashArray"),n(this,"dashOffset"),n(this,"dashRatio"),n(this,"useDash"),n(this,"useGradient"),n(this,"visibility"),n(this,"repeat"),this.type="MeshLineMaterial",Object.defineProperties(this,{lineWidth:{enumerable:!0,get(){return this.uniforms.lineWidth.value},set(t){this.uniforms.lineWidth.value=t}},map:{enumerable:!0,get(){return this.uniforms.map.value},set(t){this.uniforms.map.value=t}},useMap:{enumerable:!0,get(){return this.uniforms.useMap.value},set(t){this.uniforms.useMap.value=t}},alphaMap:{enumerable:!0,get(){return this.uniforms.alphaMap.value},set(t){this.uniforms.alphaMap.value=t}},useAlphaMap:{enumerable:!0,get(){return this.uniforms.useAlphaMap.value},set(t){this.uniforms.useAlphaMap.value=t}},color:{enumerable:!0,get(){return this.uniforms.color.value},set(t){this.uniforms.color.value=t}},gradient:{enumerable:!0,get(){return this.uniforms.gradient.value},set(t){this.uniforms.gradient.value=t}},opacity:{enumerable:!0,get(){return this.uniforms.opacity.value},set(t){this.uniforms.opacity.value=t}},resolution:{enumerable:!0,get(){return this.uniforms.resolution.value},set(t){this.uniforms.resolution.value.copy(t)}},sizeAttenuation:{enumerable:!0,get(){return this.uniforms.sizeAttenuation.value},set(t){this.uniforms.sizeAttenuation.value=t}},dashArray:{enumerable:!0,get(){return this.uniforms.dashArray.value},set(t){this.uniforms.dashArray.value=t,this.useDash=0!==t?1:0}},dashOffset:{enumerable:!0,get(){return this.uniforms.dashOffset.value},set(t){this.uniforms.dashOffset.value=t}},dashRatio:{enumerable:!0,get(){return this.uniforms.dashRatio.value},set(t){this.uniforms.dashRatio.value=t}},useDash:{enumerable:!0,get(){return this.uniforms.useDash.value},set(t){this.uniforms.useDash.value=t}},useGradient:{enumerable:!0,get(){return this.uniforms.useGradient.value},set(t){this.uniforms.useGradient.value=t}},visibility:{enumerable:!0,get(){return this.uniforms.visibility.value},set(t){this.uniforms.visibility.value=t}},alphaTest:{enumerable:!0,get(){return this.uniforms.alphaTest.value},set(t){this.uniforms.alphaTest.value=t}},repeat:{enumerable:!0,get(){return this.uniforms.repeat.value},set(t){this.uniforms.repeat.value.copy(t)}}}),this.setValues(t)}copy(t){return super.copy(t),this.lineWidth=t.lineWidth,this.map=t.map,this.useMap=t.useMap,this.alphaMap=t.alphaMap,this.useAlphaMap=t.useAlphaMap,this.color.copy(t.color),this.gradient=t.gradient,this.opacity=t.opacity,this.resolution.copy(t.resolution),this.sizeAttenuation=t.sizeAttenuation,this.dashArray=t.dashArray,this.dashOffset=t.dashOffset,this.dashRatio=t.dashRatio,this.useDash=t.useDash,this.useGradient=t.useGradient,this.visibility=t.visibility,this.alphaTest=t.alphaTest,this.repeat.copy(t.repeat),this}}},8175:function(t,e,i){i.d(e,{k:function(){return n}});var s=i(9477);let r=new s.Vector3;function a(t,e,i,s,a,n){let u=2*Math.PI*a/4,o=Math.max(n-2*a,0);r.copy(e),r[s]=0,r.normalize();let h=.5*u/(u+o),l=1-r.angleTo(t)/(Math.PI/4);return 1===Math.sign(r[i])?l*h:o/(u+o)+h+h*(1-l)}class n extends s.BoxGeometry{constructor(t=1,e=1,i=1,r=2,n=.1){if(r=2*r+1,n=Math.min(t/2,e/2,i/2,n),super(1,1,1,r,r,r),1===r)return;let u=this.toNonIndexed();this.index=null,this.attributes.position=u.attributes.position,this.attributes.normal=u.attributes.normal,this.attributes.uv=u.attributes.uv;let o=new s.Vector3,h=new s.Vector3,l=new s.Vector3(t,e,i).divideScalar(2).subScalar(n),p=this.attributes.position.array,c=this.attributes.normal.array,f=this.attributes.uv.array,d=p.length/6,v=new s.Vector3,m=.5/r;for(let s=0,r=0;s<p.length;s+=3,r+=2)switch(o.fromArray(p,s),h.copy(o),h.x-=Math.sign(h.x)*m,h.y-=Math.sign(h.y)*m,h.z-=Math.sign(h.z)*m,h.normalize(),p[s+0]=l.x*Math.sign(o.x)+h.x*n,p[s+1]=l.y*Math.sign(o.y)+h.y*n,p[s+2]=l.z*Math.sign(o.z)+h.z*n,c[s+0]=h.x,c[s+1]=h.y,c[s+2]=h.z,Math.floor(s/d)){case 0:v.set(1,0,0),f[r+0]=a(v,h,"z","y",n,i),f[r+1]=1-a(v,h,"y","z",n,e);break;case 1:v.set(-1,0,0),f[r+0]=1-a(v,h,"z","y",n,i),f[r+1]=1-a(v,h,"y","z",n,e);break;case 2:v.set(0,1,0),f[r+0]=1-a(v,h,"x","z",n,t),f[r+1]=a(v,h,"z","x",n,i);break;case 3:v.set(0,-1,0),f[r+0]=1-a(v,h,"x","z",n,t),f[r+1]=1-a(v,h,"z","x",n,i);break;case 4:v.set(0,0,1),f[r+0]=1-a(v,h,"x","y",n,t),f[r+1]=1-a(v,h,"y","x",n,e);break;case 5:v.set(0,0,-1),f[r+0]=a(v,h,"x","y",n,t),f[r+1]=1-a(v,h,"y","x",n,e)}}}}}]);