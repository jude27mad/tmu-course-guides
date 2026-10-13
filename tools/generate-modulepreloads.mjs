/* Development-only generation; the published documents stay native/static. */
import {readFile,writeFile,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {collectBootCriticalGraph,extractDocumentModuleScripts} from './module-graph.mjs';

export const ROUTE_DOCUMENTS=['index.html','cen100/index.html','mth140/index.html','mth141/index.html'];
const BEGIN='<!-- BEGIN GENERATED BOOT PRELOADS: tools/generate-modulepreloads.mjs -->';
const END='<!-- END GENERATED BOOT PRELOADS -->';
const escapeAttribute=value=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;');

function relativeURL(url,documentURL){
 const target=new URL(url),document=new URL(documentURL);
 if(target.origin!==document.origin)throw Error(`Cannot preload an external URL: ${url}`);
 return path.posix.relative(path.posix.dirname(document.pathname),target.pathname)+target.search+target.hash;
}

async function latinFontURL({rootDir,html,documentURL,baseURL}){
 const stylesheets=[...html.matchAll(/<link\b([^>]+)>/gi)];
 let stylesheetURL;
 for(const [,attributes] of stylesheets){
  const href=attributes.match(/\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
  if(!href)continue;
  const url=new URL(href[1]??href[2]??href[3],documentURL);
  if(url.pathname.endsWith('/assets/fonts/archivo.css')){stylesheetURL=url;break;}
 }
 if(!stylesheetURL)throw Error('The route has no self-hosted Archivo stylesheet');
 const base=new URL(baseURL);
 if(stylesheetURL.origin!==base.origin||!stylesheetURL.pathname.startsWith(base.pathname))throw Error('Archivo stylesheet must remain inside the deployment base');
 const relative=decodeURIComponent(stylesheetURL.pathname.slice(base.pathname.length));
 const stylesheet=await readFile(path.resolve(rootDir,relative),'utf8');
 const faces=[...stylesheet.matchAll(/@font-face\s*\{([^}]+)\}/gi)];
 const latin=faces.filter(([,face])=>/unicode-range\s*:\s*U\+0000-00FF\b/i.test(face));
 if(latin.length!==1)throw Error('Archivo must define exactly one basic Latin font face');
 const source=latin[0][1].match(/\bsrc\s*:\s*url\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)]+))\s*\)/i);
 if(!source)throw Error('The basic Latin font face has no local source');
 const font=new URL(source[1]??source[2]??source[3],stylesheetURL);
 if(font.origin!==base.origin||!font.pathname.startsWith(base.pathname)||!font.pathname.endsWith('.woff2'))throw Error('Basic Latin font must be a local WOFF2 asset');
 await access(path.resolve(rootDir,decodeURIComponent(font.pathname.slice(base.pathname.length))));
 return font.href;
}

export async function generateRoutePreloads({rootDir,documentPath,baseURL='https://tmu.invalid/',html}){
 html??=await readFile(path.resolve(rootDir,documentPath),'utf8');
 const graph=await collectBootCriticalGraph({rootDir,documentPath,baseURL,html});
 const forbidden=graph.nodes.find(node=>/^(?:assets\/vendor\/(?:night-vendor|three-)|assets\/course-scene\.mjs)/.test(node.path));
 if(forbidden)throw Error(`Optional rendering/vendor module entered the boot graph: ${forbidden.path}`);
 const font=await latinFontURL({rootDir,html,documentURL:graph.documentURL,baseURL});
 const modules=graph.nodes.map(node=>relativeURL(node.url,graph.documentURL)).sort();
 const block=[BEGIN,
  `<link rel="preload" href="${escapeAttribute(relativeURL(font,graph.documentURL))}" as="font" type="font/woff2" crossorigin>`,
  ...modules.map(href=>`<link rel="modulepreload" href="${escapeAttribute(href)}">`),END
 ].join('\n')+'\n';
 const begin=html.indexOf(BEGIN),end=html.indexOf(END);
 let generated;
 if(begin!==-1||end!==-1){
  if(begin===-1||end<begin||html.indexOf(BEGIN,begin+BEGIN.length)!==-1||html.indexOf(END,end+END.length)!==-1)throw Error('Malformed or duplicate generated preload block');
  let after=end+END.length;if(html[after]==='\n')after++;
  generated=html.slice(0,begin)+block+html.slice(after);
 }else{
  const entries=extractDocumentModuleScripts(html,graph.documentURL,{includeOffsets:true}).filter(script=>script.kind==='entry'&&new URL(script.url).pathname.endsWith('/assets/app/route-boot.mjs'));
  const script=entries.length===1?entries[0]:null;
  const headEnd=html.match(/<\/head\s*>/i)?.index;
  if(!script||headEnd===undefined||script.offset>headEnd)throw Error('The route requires one head route-boot entry insertion point');
  generated=html.slice(0,script.offset)+block+html.slice(script.offset);
 }
 return {html:generated,block,graph};
}

export async function generateModulepreloads({rootDir=path.resolve(import.meta.dirname,'..'),write=false}={}){
 const results=[];
 for(const documentPath of ROUTE_DOCUMENTS){
  const documentFile=path.join(rootDir,documentPath),original=await readFile(documentFile,'utf8');
  const result=await generateRoutePreloads({rootDir,documentPath,html:original});
  const changed=result.html!==original;
  if(changed&&write)await writeFile(documentFile,result.html);
  results.push({documentPath,changed,moduleCount:result.graph.moduleCount});
 }
 return results;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const args=process.argv.slice(2);
  if(args.some(arg=>!['--check','--write'].includes(arg))||args.includes('--check')&&args.includes('--write'))throw Error('Usage: node tools/generate-modulepreloads.mjs [--check|--write]');
  const write=args.includes('--write'),results=await generateModulepreloads({write});
  for(const result of results)console.log(`${result.documentPath}: ${result.changed?(write?'updated':'stale'):'current'} (${result.moduleCount} modules)`);
  if(!write&&results.some(result=>result.changed)){console.error('Run node tools/generate-modulepreloads.mjs --write to refresh generated head blocks.');process.exitCode=1;}
 }catch(error){console.error(error.message);process.exitCode=2;}
}
