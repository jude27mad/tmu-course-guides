"use strict";(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[946],{3435:function(t,e,i){i.d(e,{z:function(){return c}});var r=i(7462),a=i(9477),n=i(7294),s=i(9034),o=i(1501);let u=function(t,e,i,r){let n=class extends a.ShaderMaterial{constructor(r={}){let n=Object.entries(t);super({uniforms:n.reduce((t,[e,i])=>{let r=a.UniformsUtils.clone({[e]:{value:i}});return{...t,...r}},{}),vertexShader:e,fragmentShader:i}),this.key="",n.forEach(([t])=>Object.defineProperty(this,t,{get:()=>this.uniforms[t].value,set:e=>this.uniforms[t].value=e})),Object.assign(this,r)}};return n.key=a.MathUtils.generateUUID(),n}({},"void main() { }","void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0); discard;  }");class l extends a.MeshPhysicalMaterial{constructor(t=6,e=!1){super(),this.uniforms={chromaticAberration:{value:.05},transmission:{value:0},_transmission:{value:1},transmissionMap:{value:null},roughness:{value:0},thickness:{value:0},thicknessMap:{value:null},attenuationDistance:{value:1/0},attenuationColor:{value:new a.Color("white")},anisotropicBlur:{value:.1},time:{value:0},distortion:{value:0},distortionScale:{value:.5},temporalDistortion:{value:0},buffer:{value:null}},this.onBeforeCompile=i=>{i.uniforms={...i.uniforms,...this.uniforms},this.anisotropy>0&&(i.defines.USE_ANISOTROPY=""),e?i.defines.USE_SAMPLER="":i.defines.USE_TRANSMISSION="",i.fragmentShader=`
      uniform float chromaticAberration;         
      uniform float anisotropicBlur;      
      uniform float time;
      uniform float distortion;
      uniform float distortionScale;
      uniform float temporalDistortion;
      uniform sampler2D buffer;

      vec3 random3(vec3 c) {
        float j = 4096.0*sin(dot(c,vec3(17.0, 59.4, 15.0)));
        vec3 r;
        r.z = fract(512.0*j);
        j *= .125;
        r.x = fract(512.0*j);
        j *= .125;
        r.y = fract(512.0*j);
        return r-0.5;
      }

      uint hash( uint x ) {
        x += ( x << 10u );
        x ^= ( x >>  6u );
        x += ( x <<  3u );
        x ^= ( x >> 11u );
        x += ( x << 15u );
        return x;
      }

      // Compound versions of the hashing algorithm I whipped together.
      uint hash( uvec2 v ) { return hash( v.x ^ hash(v.y)                         ); }
      uint hash( uvec3 v ) { return hash( v.x ^ hash(v.y) ^ hash(v.z)             ); }
      uint hash( uvec4 v ) { return hash( v.x ^ hash(v.y) ^ hash(v.z) ^ hash(v.w) ); }

      // Construct a float with half-open range [0:1] using low 23 bits.
      // All zeroes yields 0.0, all ones yields the next smallest representable value below 1.0.
      float floatConstruct( uint m ) {
        const uint ieeeMantissa = 0x007FFFFFu; // binary32 mantissa bitmask
        const uint ieeeOne      = 0x3F800000u; // 1.0 in IEEE binary32
        m &= ieeeMantissa;                     // Keep only mantissa bits (fractional part)
        m |= ieeeOne;                          // Add fractional part to 1.0
        float  f = uintBitsToFloat( m );       // Range [1:2]
        return f - 1.0;                        // Range [0:1]
      }

      // Pseudo-random value in half-open range [0:1].
      float randomBase( float x ) { return floatConstruct(hash(floatBitsToUint(x))); }
      float randomBase( vec2  v ) { return floatConstruct(hash(floatBitsToUint(v))); }
      float randomBase( vec3  v ) { return floatConstruct(hash(floatBitsToUint(v))); }
      float randomBase( vec4  v ) { return floatConstruct(hash(floatBitsToUint(v))); }
      float rand(float seed) {
        float result = randomBase(vec3(gl_FragCoord.xy, seed));
        return result;
      }

      const float F3 =  0.3333333;
      const float G3 =  0.1666667;

      float snoise(vec3 p) {
        vec3 s = floor(p + dot(p, vec3(F3)));
        vec3 x = p - s + dot(s, vec3(G3));
        vec3 e = step(vec3(0.0), x - x.yzx);
        vec3 i1 = e*(1.0 - e.zxy);
        vec3 i2 = 1.0 - e.zxy*(1.0 - e);
        vec3 x1 = x - i1 + G3;
        vec3 x2 = x - i2 + 2.0*G3;
        vec3 x3 = x - 1.0 + 3.0*G3;
        vec4 w, d;
        w.x = dot(x, x);
        w.y = dot(x1, x1);
        w.z = dot(x2, x2);
        w.w = dot(x3, x3);
        w = max(0.6 - w, 0.0);
        d.x = dot(random3(s), x);
        d.y = dot(random3(s + i1), x1);
        d.z = dot(random3(s + i2), x2);
        d.w = dot(random3(s + 1.0), x3);
        w *= w;
        w *= w;
        d *= w;
        return dot(d, vec4(52.0));
      }

      float snoiseFractal(vec3 m) {
        return 0.5333333* snoise(m)
              +0.2666667* snoise(2.0*m)
              +0.1333333* snoise(4.0*m)
              +0.0666667* snoise(8.0*m);
      }
`+i.fragmentShader,i.fragmentShader=i.fragmentShader.replace("#include <transmission_pars_fragment>",`
        #ifdef USE_TRANSMISSION
          // Transmission code is based on glTF-Sampler-Viewer
          // https://github.com/KhronosGroup/glTF-Sample-Viewer
          uniform float _transmission;
          uniform float thickness;
          uniform float attenuationDistance;
          uniform vec3 attenuationColor;
          #ifdef USE_TRANSMISSIONMAP
            uniform sampler2D transmissionMap;
          #endif
          #ifdef USE_THICKNESSMAP
            uniform sampler2D thicknessMap;
          #endif
          uniform vec2 transmissionSamplerSize;
          uniform sampler2D transmissionSamplerMap;
          uniform mat4 modelMatrix;
          uniform mat4 projectionMatrix;
          varying vec3 vWorldPosition;
          vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
            // Direction of refracted light.
            vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
            // Compute rotation-independant scaling of the model matrix.
            vec3 modelScale;
            modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
            modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
            modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
            // The thickness is specified in local space.
            return normalize( refractionVector ) * thickness * modelScale;
          }
          float applyIorToRoughness( const in float roughness, const in float ior ) {
            // Scale roughness with IOR so that an IOR of 1.0 results in no microfacet refraction and
            // an IOR of 1.5 results in the default amount of microfacet refraction.
            return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
          }
          vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
            float framebufferLod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );            
            #ifdef USE_SAMPLER
              #ifdef texture2DLodEXT
                return texture2DLodEXT(transmissionSamplerMap, fragCoord.xy, framebufferLod);
              #else
                return texture2D(transmissionSamplerMap, fragCoord.xy, framebufferLod);
              #endif
            #else
              return texture2D(buffer, fragCoord.xy);
            #endif
          }
          vec3 applyVolumeAttenuation( const in vec3 radiance, const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
            if ( isinf( attenuationDistance ) ) {
              // Attenuation distance is +∞, i.e. the transmitted color is not attenuated at all.
              return radiance;
            } else {
              // Compute light attenuation using Beer's law.
              vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
              vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance ); // Beer's law
              return transmittance * radiance;
            }
          }
          vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
            const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
            const in mat4 viewMatrix, const in mat4 projMatrix, const in float ior, const in float thickness,
            const in vec3 attenuationColor, const in float attenuationDistance ) {
            vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
            vec3 refractedRayExit = position + transmissionRay;
            // Project refracted vector on the framebuffer, while mapping to normalized device coordinates.
            vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
            vec2 refractionCoords = ndcPos.xy / ndcPos.w;
            refractionCoords += 1.0;
            refractionCoords /= 2.0;
            // Sample framebuffer to get pixel the refracted ray hits.
            vec4 transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
            vec3 attenuatedColor = applyVolumeAttenuation( transmittedLight.rgb, length( transmissionRay ), attenuationColor, attenuationDistance );
            // Get the specular component.
            vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
            return vec4( ( 1.0 - F ) * attenuatedColor * diffuseColor, transmittedLight.a );
          }
        #endif
`),i.fragmentShader=i.fragmentShader.replace("#include <transmission_fragment>",`  
        // Improve the refraction to use the world pos
        material.transmission = _transmission;
        material.transmissionAlpha = 1.0;
        material.thickness = thickness;
        material.attenuationDistance = attenuationDistance;
        material.attenuationColor = attenuationColor;
        #ifdef USE_TRANSMISSIONMAP
          material.transmission *= texture2D( transmissionMap, vUv ).r;
        #endif
        #ifdef USE_THICKNESSMAP
          material.thickness *= texture2D( thicknessMap, vUv ).g;
        #endif
        
        vec3 pos = vWorldPosition;
        float runningSeed = 0.0;
        vec3 v = normalize( cameraPosition - pos );
        vec3 n = inverseTransformDirection( normal, viewMatrix );
        vec3 transmission = vec3(0.0);
        float transmissionR, transmissionB, transmissionG;
        float randomCoords = rand(runningSeed++);
        float thickness_smear = thickness * max(pow(roughnessFactor, 0.33), anisotropicBlur);
        vec3 distortionNormal = vec3(0.0);
        vec3 temporalOffset = vec3(time, -time, -time) * temporalDistortion;
        if (distortion > 0.0) {
          distortionNormal = distortion * vec3(snoiseFractal(vec3((pos * distortionScale + temporalOffset))), snoiseFractal(vec3(pos.zxy * distortionScale - temporalOffset)), snoiseFractal(vec3(pos.yxz * distortionScale + temporalOffset)));
        }
        for (float i = 0.0; i < ${t}.0; i ++) {
          vec3 sampleNorm = normalize(n + roughnessFactor * roughnessFactor * 2.0 * normalize(vec3(rand(runningSeed++) - 0.5, rand(runningSeed++) - 0.5, rand(runningSeed++) - 0.5)) * pow(rand(runningSeed++), 0.33) + distortionNormal);
          transmissionR = getIBLVolumeRefraction(
            sampleNorm, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
            pos, modelMatrix, viewMatrix, projectionMatrix, material.ior, material.thickness  + thickness_smear * (i + randomCoords) / float(${t}),
            material.attenuationColor, material.attenuationDistance
          ).r;
          transmissionG = getIBLVolumeRefraction(
            sampleNorm, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
            pos, modelMatrix, viewMatrix, projectionMatrix, material.ior  * (1.0 + chromaticAberration * (i + randomCoords) / float(${t})) , material.thickness + thickness_smear * (i + randomCoords) / float(${t}),
            material.attenuationColor, material.attenuationDistance
          ).g;
          transmissionB = getIBLVolumeRefraction(
            sampleNorm, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
            pos, modelMatrix, viewMatrix, projectionMatrix, material.ior * (1.0 + 2.0 * chromaticAberration * (i + randomCoords) / float(${t})), material.thickness + thickness_smear * (i + randomCoords) / float(${t}),
            material.attenuationColor, material.attenuationDistance
          ).b;
          transmission.r += transmissionR;
          transmission.g += transmissionG;
          transmission.b += transmissionB;
        }
        transmission /= ${t}.0;
        totalDiffuse = mix( totalDiffuse, transmission.rgb, material.transmission );
`)},Object.keys(this.uniforms).forEach(t=>Object.defineProperty(this,t,{get:()=>this.uniforms[t].value,set:e=>this.uniforms[t].value=e}))}}let c=n.forwardRef(({buffer:t,transmissionSampler:e=!1,backside:i=!1,side:c=a.FrontSide,transmission:h=1,thickness:f=0,backsideThickness:p=0,backsideEnvMapIntensity:m=1,samples:d=10,resolution:v,backsideResolution:y,background:x,anisotropy:g,anisotropicBlur:b,..._},w)=>{let M,A,C,S;(0,s.e)({MeshTransmissionMaterial:l});let P=n.useRef(null),[z]=n.useState(()=>new u),R=(0,o.R)(y||v),V=(0,o.R)(v);return(0,s.F)(t=>{P.current.time=t.clock.elapsedTime,P.current.buffer===V.texture&&!e&&(S=P.current.__r3f.parent)&&(C=t.gl.toneMapping,M=t.scene.background,A=P.current.envMapIntensity,t.gl.toneMapping=a.NoToneMapping,x&&(t.scene.background=x),S.material=z,i&&(t.gl.setRenderTarget(R),t.gl.render(t.scene,t.camera),S.material=P.current,S.material.buffer=R.texture,S.material.thickness=p,S.material.side=a.BackSide,S.material.envMapIntensity=m),t.gl.setRenderTarget(V),t.gl.render(t.scene,t.camera),S.material=P.current,S.material.thickness=f,S.material.side=c,S.material.buffer=V.texture,S.material.envMapIntensity=A,t.scene.background=M,t.gl.setRenderTarget(null),t.gl.toneMapping=C)}),n.useImperativeHandle(w,()=>P.current,[]),n.createElement("meshTransmissionMaterial",(0,r.Z)({args:[d,e],ref:P},_,{buffer:t||V.texture,_transmission:h,anisotropicBlur:null!=b?b:g,transmission:e?h:0,thickness:f,side:c}))})},4745:function(t,e,i){function r(t,e,i){return e in t?Object.defineProperty(t,e,{value:i,enumerable:!0,configurable:!0,writable:!0}):t[e]=i,t}function a(t,e){return(a=Object.setPrototypeOf||function(t,e){return t.__proto__=e,t})(t,e)}i.d(e,{Ui:function(){return th}});var n,s,o,u,l,c,h,f,p,m,d,v,y,x,g,b,_,w,M,A,C,S,P,z,R,V=i(9477);function D(t,e){(null==e||e>t.length)&&(e=t.length);for(var i=0,r=Array(e);i<e;i++)r[i]=t[i];return r}function F(t,e){if(t){if("string"==typeof t)return D(t,e);var i=Object.prototype.toString.call(t).slice(8,-1);if("Object"===i&&t.constructor&&(i=t.constructor.name),"Map"===i||"Set"===i)return Array.from(t);if("Arguments"===i||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(i))return D(t,e)}}function k(t,e){return function(t){if(Array.isArray(t))return t}(t)||function(t,e){var i,r,a=null==t?null:"undefined"!=typeof Symbol&&t[Symbol.iterator]||t["@@iterator"];if(null!=a){var n=[],s=!0,o=!1;try{for(a=a.call(t);!(s=(i=a.next()).done)&&(n.push(i.value),!e||n.length!==e);s=!0);}catch(t){o=!0,r=t}finally{try{s||null==a.return||a.return()}finally{if(o)throw r}}return n}}(t,e)||F(t,e)||function(){throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function I(t,e){if(!(t instanceof e))throw TypeError("Cannot call a class as a function")}new V.Vector2,new V.Vector2;var O=function t(e,i,a){var n=this;I(this,t),r(this,"dot2",function(t,e){return n.x*t+n.y*e}),r(this,"dot3",function(t,e,i){return n.x*t+n.y*e+n.z*i}),this.x=e,this.y=i,this.z=a},T=[new O(1,1,0),new O(-1,1,0),new O(1,-1,0),new O(-1,-1,0),new O(1,0,1),new O(-1,0,1),new O(1,0,-1),new O(-1,0,-1),new O(0,1,1),new O(0,-1,1),new O(0,1,-1),new O(0,-1,-1)],B=[151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180],U=Array(512),E=Array(512);function j(t){var e=function(t){if("number"==typeof t)t=Math.abs(t);else if("string"==typeof t){var e=t;t=0;for(var i=0;i<e.length;i++)t=(t+e.charCodeAt(i)%96*(i+1))%2147483647}return 0===t&&(t=311),t}(t);return function(){var t=48271*e%2147483647;return e=t,t/2147483647}}!function(t){t>0&&t<1&&(t*=65536),(t=Math.floor(t))<256&&(t|=t<<8);for(var e,i=0;i<256;i++)e=1&i?B[i]^255&t:B[i]^t>>8&255,U[i]=U[i+256]=e,E[i]=E[i+256]=T[e%12]}(0),new function t(e){var i=this;I(this,t),r(this,"seed",0),r(this,"init",function(t){i.seed=t,i.value=j(t)}),r(this,"value",j(this.seed)),this.init(e)}(Math.random());var G=function(t){return 1/(1+t+.48*t*t+.235*t*t*t)};function N(t,e,i){var r=arguments.length>3&&void 0!==arguments[3]?arguments[3]:.25,a=arguments.length>4&&void 0!==arguments[4]?arguments[4]:.01,n=arguments.length>5&&void 0!==arguments[5]?arguments[5]:1/0,s=arguments.length>6&&void 0!==arguments[6]?arguments[6]:G,o=arguments.length>7&&void 0!==arguments[7]?arguments[7]:.001,u="velocity_"+e;if(void 0===t.__damp&&(t.__damp={}),void 0===t.__damp[u]&&(t.__damp[u]=0),Math.abs(t[e]-i)<=o)return t[e]=i,!1;var l=2/(r=Math.max(1e-4,r)),c=s(l*a),h=t[e]-i,f=i,p=n*r;h=Math.min(Math.max(h,-p),p),i=t[e]-h;var m=(t.__damp[u]+l*h)*a;t.__damp[u]=(t.__damp[u]-l*m)*c;var d=i+(h+m)*c;return f-t[e]>0==d>f&&(d=f,t.__damp[u]=(d-f)/a),t[e]=d,!0}var L=new V.Vector3,W=new V.Quaternion,q=new V.Quaternion,$=new V.Matrix4,Q=new V.Vector3;function K(t,e,i,r,a,n,s,o){var u,l,c,h;return N(t,e,t[e]+(c=(u=i-t[e])-Math.floor(u/(l=2*Math.PI))*l,(h=Math.max(0,Math.min(l,c)))>Math.PI&&(h-=2*Math.PI),h),r,a,n,s,o)}var H=new V.Vector2,X=new V.Vector3;function Y(t,e,i,r,a,n,s){return"number"==typeof e?X.setScalar(e):Array.isArray(e)?X.set(e[0],e[1],e[2]):X.copy(e),o=N(t,"x",X.x,i,r,a,n,s),u=N(t,"y",X.y,i,r,a,n,s),l=N(t,"z",X.z,i,r,a,n,s),o||u||l}var Z=new V.Vector4,J=new V.Euler,tt=new V.Color,te=new V.Quaternion,ti=new V.Vector4,tr=new V.Vector4,ta=new V.Vector4;function tn(t,e,i,r,a,n,s){Array.isArray(e)?te.set(e[0],e[1],e[2],e[3]):te.copy(e);var o=t.dot(te)>0?1:-1;return te.x*=o,te.y*=o,te.z*=o,te.w*=o,b=N(t,"x",te.x,i,r,a,n,s),_=N(t,"y",te.y,i,r,a,n,s),w=N(t,"z",te.z,i,r,a,n,s),M=N(t,"w",te.w,i,r,a,n,s),ti.set(t.x,t.y,t.z,t.w).normalize(),tr.set(t.__damp.velocity_x,t.__damp.velocity_y,t.__damp.velocity_z,t.__damp.velocity_w),ta.copy(ti).multiplyScalar(tr.dot(ti)/ti.dot(ti)),t.__damp.velocity_x-=ta.x,t.__damp.velocity_y-=ta.y,t.__damp.velocity_z-=ta.z,t.__damp.velocity_w-=ta.w,t.set(ti.x,ti.y,ti.z,ti.w),b||_||w||M}var ts=new V.Spherical,to=new V.Matrix4,tu=new V.Vector3,tl=new V.Quaternion,tc=new V.Vector3,th=Object.freeze({__proto__:null,rsqw:function(t){var e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:.01,i=arguments.length>2&&void 0!==arguments[2]?arguments[2]:1,r=arguments.length>3&&void 0!==arguments[3]?arguments[3]:1/(2*Math.PI);return i/Math.atan(1/e)*Math.atan(Math.sin(2*Math.PI*t*r)/e)},exp:G,linear:function(t){return t},sine:{in:function(t){return 1-Math.cos(t*Math.PI/2)},out:function(t){return Math.sin(t*Math.PI/2)},inOut:function(t){return-(Math.cos(Math.PI*t)-1)/2}},cubic:{in:function(t){return t*t*t},out:function(t){return 1-Math.pow(1-t,3)},inOut:function(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2}},quint:{in:function(t){return t*t*t*t*t},out:function(t){return 1-Math.pow(1-t,5)},inOut:function(t){return t<.5?16*t*t*t*t*t:1-Math.pow(-2*t+2,5)/2}},circ:{in:function(t){return 1-Math.sqrt(1-Math.pow(t,2))},out:function(t){return Math.sqrt(1-Math.pow(t-1,2))},inOut:function(t){return t<.5?(1-Math.sqrt(1-Math.pow(2*t,2)))/2:(Math.sqrt(1-Math.pow(-2*t+2,2))+1)/2}},quart:{in:function(t){return t*t*t*t},out:function(t){return 1- --t*t*t*t},inOut:function(t){return t<.5?8*t*t*t*t:1-8*--t*t*t*t}},expo:{in:function(t){return 0===t?0:Math.pow(2,10*t-10)},out:function(t){return 1===t?1:1-Math.pow(2,-10*t)},inOut:function(t){return 0===t?0:1===t?1:t<.5?Math.pow(2,20*t-10)/2:(2-Math.pow(2,-20*t+10))/2}},damp:N,dampLookAt:function(t,e,i,r,a,n,s){"number"==typeof e?L.setScalar(e):Array.isArray(e)?L.set(e[0],e[1],e[2]):L.copy(e);var o=t.parent;(t.updateWorldMatrix(!0,!1),Q.setFromMatrixPosition(t.matrixWorld),t&&t.isCamera||t&&t.isLight)?$.lookAt(Q,L,t.up):$.lookAt(L,Q,t.up),tn(t.quaternion,q.setFromRotationMatrix($),i,r,a,n,s),o&&($.extractRotation(o.matrixWorld),W.setFromRotationMatrix($),tn(t.quaternion,q.copy(t.quaternion).premultiply(W.invert()),i,r,a,n,s))},dampAngle:K,damp2:function(t,e,i,r,a,o,u){return"number"==typeof e?H.setScalar(e):Array.isArray(e)?H.set(e[0],e[1]):H.copy(e),n=N(t,"x",H.x,i,r,a,o,u),s=N(t,"y",H.y,i,r,a,o,u),n||s},damp3:Y,damp4:function(t,e,i,r,a,n,s){return"number"==typeof e?Z.setScalar(e):Array.isArray(e)?Z.set(e[0],e[1],e[2],e[3]):Z.copy(e),c=N(t,"x",Z.x,i,r,a,n,s),h=N(t,"y",Z.y,i,r,a,n,s),f=N(t,"z",Z.z,i,r,a,n,s),p=N(t,"w",Z.w,i,r,a,n,s),c||h||f||p},dampE:function(t,e,i,r,a,n,s){return Array.isArray(e)?J.set(e[0],e[1],e[2],e[3]):J.copy(e),m=K(t,"x",J.x,i,r,a,n,s),d=K(t,"y",J.y,i,r,a,n,s),v=K(t,"z",J.z,i,r,a,n,s),m||d||v},dampC:function(t,e,i,r,a,n,s){return e instanceof V.Color?tt.copy(e):Array.isArray(e)?tt.setRGB(e[0],e[1],e[2]):tt.set(e),y=N(t,"r",tt.r,i,r,a,n,s),x=N(t,"g",tt.g,i,r,a,n,s),g=N(t,"b",tt.b,i,r,a,n,s),y||x||g},dampQ:tn,dampS:function(t,e,i,r,a,n,s){return Array.isArray(e)?ts.set(e[0],e[1],e[2]):ts.copy(e),A=N(t,"radius",ts.radius,i,r,a,n,s),C=K(t,"phi",ts.phi,i,r,a,n,s),S=K(t,"theta",ts.theta,i,r,a,n,s),A||C||S},dampM:function(t,e,i,r,a,n,s){var o;return void 0===t.__damp&&(t.__damp={position:new V.Vector3,rotation:new V.Quaternion,scale:new V.Vector3},t.decompose(t.__damp.position,t.__damp.rotation,t.__damp.scale)),Array.isArray(e)?to.set.apply(to,function(t){if(Array.isArray(t))return D(t)}(o=e)||function(t){if("undefined"!=typeof Symbol&&null!=t[Symbol.iterator]||null!=t["@@iterator"])return Array.from(t)}(o)||F(o)||function(){throw TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()):to.copy(e),to.decompose(tu,tl,tc),P=Y(t.__damp.position,tu,i,r,a,n,s),z=tn(t.__damp.rotation,tl,i,r,a,n,s),R=Y(t.__damp.scale,tc,i,r,a,n,s),t.compose(t.__damp.position,t.__damp.rotation,t.__damp.scale),P||z||R}});V.BufferGeometry},7485:function(t,e,i){i.d(e,{Rt:function(){return u},r7:function(){return f}});var r=i(9477),a=Object.defineProperty,n=(t,e,i)=>e in t?a(t,e,{enumerable:!0,configurable:!0,writable:!0,value:i}):t[e]=i,s=(t,e,i)=>(n(t,"symbol"!=typeof e?e+"":e,i),i);function o(t,e,i,r,a){let n;if(t=t.subarray||t.slice?t:t.buffer,i=i.subarray||i.slice?i:i.buffer,t=e?t.subarray?t.subarray(e,a&&e+a):t.slice(e,a&&e+a):t,i.set)i.set(t,r);else for(n=0;n<t.length;n++)i[n+r]=t[n];return i}class u extends r.BufferGeometry{constructor(){super(),s(this,"type","MeshLine"),s(this,"isMeshLine",!0),s(this,"positions",[]),s(this,"previous",[]),s(this,"next",[]),s(this,"side",[]),s(this,"width",[]),s(this,"indices_array",[]),s(this,"uvs",[]),s(this,"counters",[]),s(this,"widthCallback",null),s(this,"_attributes"),s(this,"_points",[]),s(this,"points"),s(this,"matrixWorld",new r.Matrix4),Object.defineProperties(this,{points:{enumerable:!0,get(){return this._points},set(t){this.setPoints(t,this.widthCallback)}}})}setMatrixWorld(t){this.matrixWorld=t}setPoints(t,e){var i;if(t=(i=t)instanceof Float32Array?i:i instanceof r.BufferGeometry?i.getAttribute("position").array:i.map(t=>{let e=Array.isArray(t);return t instanceof r.Vector3?[t.x,t.y,t.z]:t instanceof r.Vector2?[t.x,t.y,0]:e&&3===t.length?[t[0],t[1],t[2]]:e&&2===t.length?[t[0],t[1],0]:t}).flat(),this._points=t,this.widthCallback=null!=e?e:null,this.positions=[],this.counters=[],t.length&&t[0]instanceof r.Vector3)for(let e=0;e<t.length;e++){let i=t[e],r=e/(t.length-1);this.positions.push(i.x,i.y,i.z),this.positions.push(i.x,i.y,i.z),this.counters.push(r),this.counters.push(r)}else for(let e=0;e<t.length;e+=3){let i=e/(t.length-1);this.positions.push(t[e],t[e+1],t[e+2]),this.positions.push(t[e],t[e+1],t[e+2]),this.counters.push(i),this.counters.push(i)}this.process()}compareV3(t,e){let i=6*t,r=6*e;return this.positions[i]===this.positions[r]&&this.positions[i+1]===this.positions[r+1]&&this.positions[i+2]===this.positions[r+2]}copyV3(t){let e=6*t;return[this.positions[e],this.positions[e+1],this.positions[e+2]]}process(){let t,e;let i=this.positions.length/6;this.previous=[],this.next=[],this.side=[],this.width=[],this.indices_array=[],this.uvs=[],e=this.compareV3(0,i-1)?this.copyV3(i-2):this.copyV3(0),this.previous.push(e[0],e[1],e[2]),this.previous.push(e[0],e[1],e[2]);for(let r=0;r<i;r++){if(this.side.push(1),this.side.push(-1),t=this.widthCallback?this.widthCallback(r/(i-1)):1,this.width.push(t),this.width.push(t),this.uvs.push(r/(i-1),0),this.uvs.push(r/(i-1),1),r<i-1){e=this.copyV3(r),this.previous.push(e[0],e[1],e[2]),this.previous.push(e[0],e[1],e[2]);let t=2*r;this.indices_array.push(t,t+1,t+2),this.indices_array.push(t+2,t+1,t+3)}r>0&&(e=this.copyV3(r),this.next.push(e[0],e[1],e[2]),this.next.push(e[0],e[1],e[2]))}e=this.compareV3(i-1,0)?this.copyV3(1):this.copyV3(i-1),this.next.push(e[0],e[1],e[2]),this.next.push(e[0],e[1],e[2]),this._attributes&&this._attributes.position.count===this.counters.length?(this._attributes.position.copyArray(new Float32Array(this.positions)),this._attributes.position.needsUpdate=!0,this._attributes.previous.copyArray(new Float32Array(this.previous)),this._attributes.previous.needsUpdate=!0,this._attributes.next.copyArray(new Float32Array(this.next)),this._attributes.next.needsUpdate=!0,this._attributes.side.copyArray(new Float32Array(this.side)),this._attributes.side.needsUpdate=!0,this._attributes.width.copyArray(new Float32Array(this.width)),this._attributes.width.needsUpdate=!0,this._attributes.uv.copyArray(new Float32Array(this.uvs)),this._attributes.uv.needsUpdate=!0,this._attributes.index.copyArray(new Uint16Array(this.indices_array)),this._attributes.index.needsUpdate=!0):this._attributes={position:new r.BufferAttribute(new Float32Array(this.positions),3),previous:new r.BufferAttribute(new Float32Array(this.previous),3),next:new r.BufferAttribute(new Float32Array(this.next),3),side:new r.BufferAttribute(new Float32Array(this.side),1),width:new r.BufferAttribute(new Float32Array(this.width),1),uv:new r.BufferAttribute(new Float32Array(this.uvs),2),index:new r.BufferAttribute(new Uint16Array(this.indices_array),1),counters:new r.BufferAttribute(new Float32Array(this.counters),1)},this.setAttribute("position",this._attributes.position),this.setAttribute("previous",this._attributes.previous),this.setAttribute("next",this._attributes.next),this.setAttribute("side",this._attributes.side),this.setAttribute("width",this._attributes.width),this.setAttribute("uv",this._attributes.uv),this.setAttribute("counters",this._attributes.counters),this.setAttribute("position",this._attributes.position),this.setAttribute("previous",this._attributes.previous),this.setAttribute("next",this._attributes.next),this.setAttribute("side",this._attributes.side),this.setAttribute("width",this._attributes.width),this.setAttribute("uv",this._attributes.uv),this.setAttribute("counters",this._attributes.counters),this.setIndex(this._attributes.index),this.computeBoundingSphere(),this.computeBoundingBox()}advance({x:t,y:e,z:i}){let r=this._attributes.position.array,a=this._attributes.previous.array,n=this._attributes.next.array,s=r.length;o(r,0,a,0,s),o(r,6,r,0,s-6),r[s-6]=t,r[s-5]=e,r[s-4]=i,r[s-3]=t,r[s-2]=e,r[s-1]=i,o(r,6,n,0,s-6),n[s-6]=t,n[s-5]=e,n[s-4]=i,n[s-3]=t,n[s-2]=e,n[s-1]=i,this._attributes.position.needsUpdate=!0,this._attributes.previous.needsUpdate=!0,this._attributes.next.needsUpdate=!0}}let l=`
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
`,c=parseInt(r.REVISION.replace(/\D+/g,"")),h=`
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
    #include <${c>=154?"colorspace_fragment":"encodings_fragment"}>
  }
`;class f extends r.ShaderMaterial{constructor(t){super({uniforms:{...r.UniformsLib.fog,lineWidth:{value:1},map:{value:null},useMap:{value:0},alphaMap:{value:null},useAlphaMap:{value:0},color:{value:new r.Color(16777215)},gradient:{value:[new r.Color(16711680),new r.Color(65280)]},opacity:{value:1},resolution:{value:new r.Vector2(1,1)},sizeAttenuation:{value:1},dashArray:{value:0},dashOffset:{value:0},dashRatio:{value:.5},useDash:{value:0},useGradient:{value:0},visibility:{value:1},alphaTest:{value:0},repeat:{value:new r.Vector2(1,1)}},vertexShader:l,fragmentShader:h}),s(this,"lineWidth"),s(this,"map"),s(this,"useMap"),s(this,"alphaMap"),s(this,"useAlphaMap"),s(this,"color"),s(this,"gradient"),s(this,"resolution"),s(this,"sizeAttenuation"),s(this,"dashArray"),s(this,"dashOffset"),s(this,"dashRatio"),s(this,"useDash"),s(this,"useGradient"),s(this,"visibility"),s(this,"repeat"),this.type="MeshLineMaterial",Object.defineProperties(this,{lineWidth:{enumerable:!0,get(){return this.uniforms.lineWidth.value},set(t){this.uniforms.lineWidth.value=t}},map:{enumerable:!0,get(){return this.uniforms.map.value},set(t){this.uniforms.map.value=t}},useMap:{enumerable:!0,get(){return this.uniforms.useMap.value},set(t){this.uniforms.useMap.value=t}},alphaMap:{enumerable:!0,get(){return this.uniforms.alphaMap.value},set(t){this.uniforms.alphaMap.value=t}},useAlphaMap:{enumerable:!0,get(){return this.uniforms.useAlphaMap.value},set(t){this.uniforms.useAlphaMap.value=t}},color:{enumerable:!0,get(){return this.uniforms.color.value},set(t){this.uniforms.color.value=t}},gradient:{enumerable:!0,get(){return this.uniforms.gradient.value},set(t){this.uniforms.gradient.value=t}},opacity:{enumerable:!0,get(){return this.uniforms.opacity.value},set(t){this.uniforms.opacity.value=t}},resolution:{enumerable:!0,get(){return this.uniforms.resolution.value},set(t){this.uniforms.resolution.value.copy(t)}},sizeAttenuation:{enumerable:!0,get(){return this.uniforms.sizeAttenuation.value},set(t){this.uniforms.sizeAttenuation.value=t}},dashArray:{enumerable:!0,get(){return this.uniforms.dashArray.value},set(t){this.uniforms.dashArray.value=t,this.useDash=0!==t?1:0}},dashOffset:{enumerable:!0,get(){return this.uniforms.dashOffset.value},set(t){this.uniforms.dashOffset.value=t}},dashRatio:{enumerable:!0,get(){return this.uniforms.dashRatio.value},set(t){this.uniforms.dashRatio.value=t}},useDash:{enumerable:!0,get(){return this.uniforms.useDash.value},set(t){this.uniforms.useDash.value=t}},useGradient:{enumerable:!0,get(){return this.uniforms.useGradient.value},set(t){this.uniforms.useGradient.value=t}},visibility:{enumerable:!0,get(){return this.uniforms.visibility.value},set(t){this.uniforms.visibility.value=t}},alphaTest:{enumerable:!0,get(){return this.uniforms.alphaTest.value},set(t){this.uniforms.alphaTest.value=t}},repeat:{enumerable:!0,get(){return this.uniforms.repeat.value},set(t){this.uniforms.repeat.value.copy(t)}}}),this.setValues(t)}copy(t){return super.copy(t),this.lineWidth=t.lineWidth,this.map=t.map,this.useMap=t.useMap,this.alphaMap=t.alphaMap,this.useAlphaMap=t.useAlphaMap,this.color.copy(t.color),this.gradient=t.gradient,this.opacity=t.opacity,this.resolution.copy(t.resolution),this.sizeAttenuation=t.sizeAttenuation,this.dashArray=t.dashArray,this.dashOffset=t.dashOffset,this.dashRatio=t.dashRatio,this.useDash=t.useDash,this.useGradient=t.useGradient,this.visibility=t.visibility,this.alphaTest=t.alphaTest,this.repeat.copy(t.repeat),this}}}}]);