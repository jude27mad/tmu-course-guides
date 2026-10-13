import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three-0.186.1.mjs';

const existing='ACESFilmicToneMapping AdditiveBlending BoxGeometry BufferGeometry CatmullRomCurve3 Color CylinderGeometry DataTexture DirectionalLight DoubleSide EdgesGeometry ExtrudeGeometry Float32BufferAttribute Group HemisphereLight IcosahedronGeometry InstancedMesh Line LineBasicMaterial LineSegments Matrix3 Matrix4 Mesh MeshBasicMaterial MeshPhysicalMaterial MeshStandardMaterial NoToneMapping OctahedronGeometry PMREMGenerator Path PerspectiveCamera PlaneGeometry Points PointsMaterial Quaternion RGBAFormat RepeatWrapping RingGeometry RoomEnvironment RoundedBoxGeometry SRGBColorSpace Scene ShaderMaterial Shape SphereGeometry TorusGeometry TubeGeometry UnsignedByteType Vector2 Vector3 WebGLRenderer mergeGeometries'.split(' ');
const added='CanvasTexture Raycaster Plane WebGLRenderTarget HalfFloatType PCFSoftShadowMap NeutralToneMapping NoColorSpace LinearSRGBColorSpace SpotLight ShadowMaterial DynamicDrawUsage FrontSide BackSide Box3 Sphere Vector4 MathUtils ClampToEdgeWrapping EffectComposer RenderPass UnrealBloomPass OutputPass ShaderPass'.split(' ');

test('Three vendor retains every existing export and supplies the book engine exports',()=>{
 for(const name of [...existing,...added])assert.notEqual(THREE[name],undefined,name+' is exported');
 assert.equal(THREE.MathUtils.clamp(2,0,1),1);
 assert.equal(THREE.NeutralToneMapping,7);
 assert.equal(THREE.HalfFloatType,1016);
});

test('bundled addons construct resources from the exported Three core',()=>{
 const room=new THREE.RoomEnvironment();
 assert.ok(room instanceof THREE.Scene);
 room.traverse(node=>{if(node.isMesh){assert.ok(node instanceof THREE.Mesh);assert.ok(node.geometry instanceof THREE.BufferGeometry);}});
 const renderer={getPixelRatio:()=>1,getSize:v=>v.set(640,480)};
 const composer=new THREE.EffectComposer(renderer);
 assert.ok(composer.renderTarget1 instanceof THREE.WebGLRenderTarget);
 assert.ok(composer.renderTarget2 instanceof THREE.WebGLRenderTarget);
 const render=new THREE.RenderPass(new THREE.Scene(),new THREE.PerspectiveCamera());
 composer.addPass(render);
 const bloom=new THREE.UnrealBloomPass(new THREE.Vector2(640,480),.3,.4,.85);
 assert.ok(bloom.renderTargetBright instanceof THREE.WebGLRenderTarget);
 assert.ok(bloom.renderTargetsHorizontal.every(target=>target instanceof THREE.WebGLRenderTarget));
 const output=new THREE.OutputPass();
 const shader=new THREE.ShaderPass({uniforms:{tDiffuse:{value:null}},vertexShader:'void main() { gl_Position = vec4(position, 1.0); }',fragmentShader:'void main() { gl_FragColor = vec4(1.0); }'});
 assert.ok(shader.material instanceof THREE.ShaderMaterial);
 assert.ok(shader._fsQuad._mesh instanceof THREE.Mesh);
 assert.ok(output._fsQuad._mesh instanceof THREE.Mesh);
 room.dispose();composer.dispose();bloom.dispose();output.dispose();shader.dispose();
});
