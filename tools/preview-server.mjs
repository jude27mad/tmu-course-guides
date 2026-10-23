// Development preview only; GitHub Pages still serves the unbuilt static files.
// --base /tmu-course-guides/ reproduces the Pages project subpath: requests outside the base 404.
import http from 'node:http';import {readFile,stat} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.json':'application/json'};
export const normalizeBase=value=>'/'+String(value??'').split('/').filter(Boolean).map(part=>part+'/').join('');
// Repo-relative path for a request under the base, or null outside it.
export const mapPath=(pathname,base='/')=>pathname.startsWith(base)?pathname.slice(base.length):null;
export function createPreview({root=process.cwd(),base='/'}={}){
 root=path.resolve(root);base=normalizeBase(base);
 return http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://preview'),rel=mapPath(url.pathname+(url.pathname+'/'===base?'/':''),base);if(rel===null)throw Error();
  let p=path.resolve(root,'./'+decodeURIComponent(rel));if(p!==root&&!p.startsWith(root+path.sep))throw Error();
  if((await stat(p)).isDirectory()){
   // Like Pages: a bare directory redirects to its trailing slash so relative assets resolve.
   if(!url.pathname.endsWith('/')){res.writeHead(301,{Location:url.pathname+'/'+url.search});res.end();return;}
   p=path.join(p,'index.html');
  }
  res.setHeader('Content-Type',mime[path.extname(p)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(await readFile(p));
 }catch{res.writeHead(404);res.end('Not found');}});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),option=name=>args.includes(name)?args[args.indexOf(name)+1]:undefined;
 const port=Number(option('--port'))||4173,base=normalizeBase(option('--base'));
 createPreview({base}).listen(port,'0.0.0.0',()=>console.log('Preview ready on '+port+(base==='/'?'':' at '+base)));
}
