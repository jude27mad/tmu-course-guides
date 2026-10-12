import {T} from './primitives.mjs?v=20261012-future1';

export function surface(n,m,sample,{caps=false}={}){
 const positions=[],normals=[],uvs=[],indices=[];
 const a=new T.Vector3(),b=new T.Vector3(),normal=new T.Vector3();
 for(let i=0;i<=n;i++)for(let j=0;j<=m;j++){
  const u=i/n,v=j/m,p=sample(u,v),h=.0001;
  const l=sample(u-h,v),r=sample(u+h,v),lo=sample(u,v-h),hi=sample(u,v+h);
  a.set(r[0]-l[0],r[1]-l[1],r[2]-l[2]);b.set(hi[0]-lo[0],hi[1]-lo[1],hi[2]-lo[2]);normal.crossVectors(a,b).normalize();
  positions.push(...p);normals.push(...normal.toArray());uvs.push(u,v);
 }
 for(let i=0;i<n;i++)for(let j=0;j<m;j++){const a=i*(m+1)+j,b=a+m+1;indices.push(a,b,a+1,a+1,b,b+1);}
 if(caps)for(const u of [0,1]){
  const pts=Array.from({length:m},(_,j)=>sample(u,j/m)),center=pts.reduce((s,p)=>s.map((v,k)=>v+p[k]/m),[0,0,0]);
  const p0=sample(u-.0001,0),p1=sample(u+.0001,0);normal.set(p1[0]-p0[0],p1[1]-p0[1],p1[2]-p0[2]).normalize().multiplyScalar(u?1:-1);
  const start=positions.length/3;positions.push(...center);normals.push(...normal.toArray());uvs.push(.5,.5);
  for(const p of pts){positions.push(...p);normals.push(...normal.toArray());uvs.push(.5,.5);}
  for(let j=0;j<m;j++){const a=start+1+j,b=start+1+(j+1)%m;indices.push(start,...(u?[a,b]:[b,a]));}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeBoundingSphere();return g;
}

export function triangularPanel(radius,depth=.16,bevel=.045){
 const positions=[],uvs=[],indices=[];
 const corners=Array.from({length:3},(_,i)=>{const a=Math.PI/2+i*Math.PI*2/3;return[Math.cos(a)*radius,Math.sin(a)*radius];});
 const layers=[[-depth/2,1-bevel/radius],[-depth/2+bevel,1],[depth/2-bevel,1],[depth/2,1-bevel/radius]];
 function tri(a,b,c){const k=positions.length/3;for(const p of [a,b,c]){positions.push(...p);uvs.push(p[0]/(2*radius)+.5,p[1]/(2*radius)+.5);}indices.push(k,k+1,k+2);}
 const point=(layer,i)=>[corners[i][0]*layers[layer][1],corners[i][1]*layers[layer][1],layers[layer][0]];
 tri(point(0,2),point(0,1),point(0,0));tri(point(3,0),point(3,1),point(3,2));
 for(let l=0;l<3;l++)for(let i=0;i<3;i++){const j=(i+1)%3;tri(point(l,i),point(l,j),point(l+1,j));tri(point(l,i),point(l+1,j),point(l+1,i));}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
}

// Low-detail geometry projection for diagnostics; the production fallback uses a render.
export function sketchMeshes(root,fill='#aabfc8'){
 const shapes=[],v=new T.Vector3(),matrix=new T.Matrix4();root.updateMatrixWorld(true);
 root.traverse(o=>{
  if(!o.geometry||o.visible===false)return;const p=o.geometry.attributes.position,index=o.geometry.index;
  const count=o.isInstancedMesh?o.count:1,step=Math.max(3,Math.ceil((index?.count||p.count)/150/3)*3);
  for(let instance=0;instance<count;instance++){
   if(o.isInstancedMesh){o.getMatrixAt(instance,matrix);matrix.premultiply(o.matrixWorld);}else matrix.copy(o.matrixWorld);
   for(let i=0;i<(index?.count||p.count)-2;i+=step){const points=[];for(let j=0;j<3;j++){const k=index?index.getX(i+j):i+j;points.push(v.fromBufferAttribute(p,k).applyMatrix4(matrix).toArray());}shapes.push({kind:'poly',points,fill,stroke:fill,alpha:1,width:0});}
  }
 });return shapes;
}
