import * as T from './node_modules/three/build/three.module.js';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createCircuit} from '../../assets/scenes/circuit.mjs';
import {createCalculus} from '../../assets/scenes/calculus.mjs';
import {createAlgebra} from '../../assets/scenes/algebra.mjs';
import {framePose} from '../../assets/scenes/framing.mjs';
import {createStudioEnvironment} from '../../assets/scenes/future-look.mjs';
const out=process.argv[2];if(!out)throw Error('Pass an output directory');mkdirSync(out,{recursive:true});
const p={cen100:{accent:'#edbba7',signal:'#ff7198'},mth140:{accent:'#b9dfc9',signal:'#ff8aa9'},mth141:{accent:'#d3c3ee',signal:'#ff8ab0'}};
const v=new T.Vector3(),normal=new T.Vector3(),matrix=new T.Matrix4(),nm=new T.Matrix3();
for(const [course,create]of Object.entries({cen100:createCircuit,mth140:createCalculus,mth141:createAlgebra}))for(const [view,width,height]of [['wide',1080,480],['tall',520,560]]){
 const model=create(p[course]),stage=new T.Group(),pose=framePose(course,width,height);model.update(1.4,0,{still:true});stage.add(model.root);stage.position.set(...pose.position);stage.rotation.set(...pose.rotation);stage.updateMatrixWorld(true);
 const groups=new Map();
 stage.traverse(o=>{
  if(!o.geometry)return;const g=o.geometry,position=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,index=g.index,mat=o.material;
  if(!groups.has(mat.uuid))groups.set(mat.uuid,{material:{color:mat.color.toArray(),metalness:mat.metalness||0,roughness:mat.roughness||.15,transmission:mat.transmission||0,ior:mat.ior||1.46,basic:!!mat.isMeshBasicMaterial,opacity:mat.opacity},vertices:[],faces:[]});
  const bucket=groups.get(mat.uuid),flow=mat.customProgramCacheKey?.()==='future-flow-1';
  for(let i=0;i<(o.isInstancedMesh?o.count:1);i++){
   if(o.isInstancedMesh){o.getMatrixAt(i,matrix);matrix.premultiply(o.matrixWorld);}else matrix.copy(o.matrixWorld);nm.getNormalMatrix(matrix);const offset=bucket.vertices.length;
   for(let j=0;j<position.count;j++){
    v.fromBufferAttribute(position,j);normal.fromBufferAttribute(n,j);
    if(flow){const phase=v.x*2.1+v.y*1.7-1.4*.55,d=Math.cos(phase)*.07;v.z+=Math.sin(phase)*.07;normal.set(normal.x-normal.z*d*2.1,normal.y-normal.z*d*1.7,normal.z).normalize();}
    v.applyMatrix4(matrix);normal.applyMatrix3(nm).normalize();bucket.vertices.push([...v.toArray(),...normal.toArray(),uv?.getX(j)||0,uv?.getY(j)||0]);
   }
   for(let j=0;j<(index?.count||position.count);j+=3)bucket.faces.push([0,1,2].map(k=>offset+(index?index.getX(j+k):j+k)));
  }
 });
 const meshes=[];let count=0;
 for(const {material,vertices,faces}of groups.values()){
  const filename=resolve(out,`${course}-${view}-${count++}.ply`),header=Buffer.from(`ply\nformat binary_little_endian 1.0\nelement vertex ${vertices.length}\nproperty float x\nproperty float y\nproperty float z\nproperty float nx\nproperty float ny\nproperty float nz\nproperty float s\nproperty float t\nelement face ${faces.length}\nproperty list uchar int vertex_indices\nend_header\n`),buffer=Buffer.alloc(vertices.length*32+faces.length*13);let cursor=0;
  for(const vertex of vertices)for(const value of vertex){buffer.writeFloatLE(value,cursor);cursor+=4;}
  for(const face of faces){buffer.writeUInt8(3,cursor++);for(const value of face){buffer.writeInt32LE(value,cursor);cursor+=4;}}
  writeFileSync(filename,Buffer.concat([header,buffer]));meshes.push({filename,material});
 }
 const environment=createStudioEnvironment(p[course]);environment.updateMatrixWorld(true);const lights=[];environment.traverse(o=>{if(o.geometry)lights.push({matrix:o.matrixWorld.toArray(),width:o.geometry.parameters.width,height:o.geometry.parameters.height,color:o.material.color.toArray()});});
 writeFileSync(resolve(out,`${course}-${view}.json`),JSON.stringify({course,width,height,distance:pose.distance,meshes,lights,background:environment.background.toArray(),accent:new T.Color(p[course].accent).toArray()}));model.dispose();
 console.log(`${course}-${view}: ${meshes.length} material groups exported`);
}
