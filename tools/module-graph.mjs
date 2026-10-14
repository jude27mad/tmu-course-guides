/* Offline native-module analysis. V8 parses dependencies without evaluating code;
   dynamic imports remain outside the static graph, including literal imports. */
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {readFileSync,writeFileSync,mkdtempSync,openSync,closeSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const utilityPath=fileURLToPath(import.meta.url);

function runWorker(mode,input){
 // Regular files also work in sandboxes that deny socket-backed child stdio.
 const directory=mkdtempSync(path.join(tmpdir(),'tmu-module-parser-')),descriptors=[];
 try{
  const inputPath=path.join(directory,'input'),outputPath=path.join(directory,'output'),errorPath=path.join(directory,'error');
  writeFileSync(inputPath,input);
  descriptors.push(openSync(inputPath,'r'),openSync(outputPath,'w'),openSync(errorPath,'w'));
  const result=spawnSync(process.execPath,['--experimental-vm-modules','--no-warnings',utilityPath,mode],{
   stdio:descriptors,timeout:30000
  });
  if(result.error)throw result.error;
  if(result.status!==0)throw Error(readFileSync(errorPath,'utf8').trim()||`Module parser worker exited ${result.status}`);
  return JSON.parse(readFileSync(outputPath,'utf8'));
 }finally{
  for(const descriptor of descriptors)closeSync(descriptor);
  rmSync(directory,{recursive:true,force:true});
 }
}

export function extractModuleReferences(source){
 if(typeof vm.SourceTextModule!=='function')return runWorker('--parse',source);
 const staticImports=[...new vm.SourceTextModule(source).dependencySpecifiers],dynamicImports=[];
 const trivia=String.raw`(?:\s|/\*[\s\S]*?\*/|//[^\n]*(?:\n|$))*`;
 const boundary=String.raw`(?<![\p{ID_Continue}\u200C\u200D$#])`;
 const candidates=new RegExp(String.raw`${boundary}import${trivia}\(${trivia}(?<literal>"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*')${trivia}(?=[,)])`,'gu');
 function isCodeToken(offset,word){
  const prefix=source.slice(0,offset);
  if(new RegExp(String.raw`\.${trivia}$`).test(prefix))return false;
  try{new vm.SourceTextModule(prefix+'@'+source.slice(offset+word.length));return false;}
  catch(error){if(error.name==='SyntaxError')return true;throw error;}
 }
 for(const candidate of source.matchAll(candidates)){
  const offset=candidate.index,prefix=source.slice(0,offset);
  // A candidate inside a comment, string, template text or regular expression
  // remains valid if its word changes to @. In real code @ is a syntax error.
  // Let the same parser establish the lexical boundary instead of a JS lexer.
  if(!isCodeToken(offset,'import'))continue;
  const specifier=new vm.SourceTextModule(`import ${candidate.groups.literal};`).dependencySpecifiers[0];
  const awaitToken=prefix.match(new RegExp(String.raw`${boundary}await${trivia}(?<groups>(?:\(${trivia})*)$`,'u'));
  let awaited=false;
  if(awaitToken&&isCodeToken(awaitToken.index,'await')){
   const groups=awaitToken.groups.groups.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*(?:\n|$)|\s/g,'').length;
   awaited=groups===0||new RegExp(String.raw`^\)${trivia}`+String.raw`\)${trivia}`.repeat(groups)).test(source.slice(offset+candidate[0].length));
  }
  dynamicImports.push({specifier,awaited,offset});
 }
 return {staticImports,dynamicImports};
}

const attributeValue=value=>value.replace(/&(?:amp|#38|#x26);/gi,'&').replace(/&quot;/gi,'"').replace(/&apos;|&#39;/gi,"'");
export function extractDocumentModuleScripts(html,documentURL,{includeOffsets=false}={}){
 const scripts=[],source=html.replace(/<!--[\s\S]*?-->/g,comment=>' '.repeat(comment.length));
 for(const match of source.matchAll(/<script\b([^>]*)>[\s\S]*?<\/script\s*>/gi)){
  const attributes=new Map();
  for(const attribute of match[1].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)){
   const name=attribute[1].toLowerCase();
   if(!attributes.has(name))attributes.set(name,attributeValue(attribute[2]??attribute[3]??attribute[4]??''));
  }
  if(attributes.get('type')?.trim().toLowerCase()!=='module'||!attributes.get('src'))continue;
  scripts.push({url:new URL(attributes.get('src'),documentURL).href,
   kind:attributes.has('data-route-module')?'route':attributes.has('data-shell-module')?'shell':'entry',
   ...(includeOffsets?{offset:match.index}:{})});
 }
 return scripts;
}

function resolveRequest(specifier,referrer){
 if(!/^(?:\.{1,2}\/|\/|https?:\/\/)/.test(specifier))throw Error(`Unsupported module specifier: ${specifier}`);
 return new URL(specifier,referrer).href;
}

function fileForURL(url,baseURL,rootDir){
 const parsed=new URL(url),base=new URL(baseURL);
 if(parsed.origin!==base.origin||!parsed.pathname.startsWith(base.pathname))throw Error(`Module outside deployment base: ${url}`);
 const relative=decodeURIComponent(parsed.pathname.slice(base.pathname.length));
 const file=path.resolve(rootDir,relative),relativePath=path.relative(path.resolve(rootDir),file);
 if(relativePath.startsWith('..'+path.sep)||path.isAbsolute(relativePath))throw Error(`Module outside repository: ${url}`);
 return {file,relativePath:relativePath.split(path.sep).join('/')};
}

/** URL search/hash are module identity; only filesystem lookup discards them.
 * maxDepth is the greatest shortest distance from any eager root. The separate
 * longestChainDepth reports the longest simple static chain, excluding a repeated
 * cycle vertex. Roots may explicitly include a known awaited boot-time import. */
export async function collectModuleGraph({rootDir,roots,baseURL='https://tmu.invalid/',bootDynamicEdges=[]}){
 if(typeof vm.SourceTextModule!=='function')return runWorker('--worker',JSON.stringify({rootDir,roots,baseURL,bootDynamicEdges}));
 if(!rootDir||!Array.isArray(roots))throw Error('rootDir and roots are required');
 const rootURLs=[...new Set(roots.map(root=>new URL(root,baseURL).href))],nodes=new Map(),edges=[];
 const pending=[...rootURLs];
 for(let cursor=0;cursor<pending.length;cursor++){
  const url=pending[cursor];if(nodes.has(url))continue;
  const {file,relativePath}=fileForURL(url,baseURL,rootDir),source=await readFile(file,'utf8');
  let references;try{references=extractModuleReferences(source);}catch(error){throw Error(`Cannot parse ${relativePath}: ${error.message}`);}
  const imports=[...new Set(references.staticImports.map(specifier=>resolveRequest(specifier,url)))];
  const dynamicImports=references.dynamicImports.map(reference=>({...reference,
   url:/^(?:\.{1,2}\/|\/|https?:\/\/)/.test(reference.specifier)?resolveRequest(reference.specifier,url):null}));
  nodes.set(url,{url,path:relativePath,bytes:Buffer.byteLength(source),imports,dynamicImports});
  for(const dependency of imports){edges.push({from:url,to:dependency,kind:'static'});pending.push(dependency);}
  for(const edge of bootDynamicEdges.filter(edge=>edge.from===url)){
   if(!dynamicImports.some(reference=>reference.url===edge.to))throw Error(`Boot import is absent from ${relativePath}: ${edge.to}`);
   edges.push({...edge,kind:'boot-dynamic'});pending.push(edge.to);
  }
 }
 const outgoing=new Map([...nodes.keys()].map(url=>[url,edges.filter(edge=>edge.from===url).map(edge=>edge.to)]));
 const depth=new Map(rootURLs.map(url=>[url,0])),queue=[...rootURLs];
 for(let cursor=0;cursor<queue.length;cursor++){
  const url=queue[cursor];
  for(const dependency of outgoing.get(url))if(!depth.has(dependency)){
   depth.set(dependency,depth.get(url)+1);queue.push(dependency);
  }
 }
 function longest(url,ancestors=new Set()){
  const chain=new Set(ancestors).add(url);let result=0;
  for(const dependency of outgoing.get(url))if(!chain.has(dependency))result=Math.max(result,1+longest(dependency,chain));
  return result;
 }
 const byPath=new Map();
 for(const node of nodes.values())byPath.set(node.path,[...(byPath.get(node.path)||[]),node.url]);
 return {roots:rootURLs,nodes:[...nodes.values()],edges,moduleCount:nodes.size,edgeCount:edges.length,
  maxDepth:Math.max(0,...depth.values()),longestChainDepth:Math.max(0,...rootURLs.map(url=>longest(url))),
  aliases:[...byPath].filter(([,urls])=>urls.length>1).map(([path,urls])=>({path,urls:urls.sort()}))};
}

/** The four documents name route-boot's ordered dynamic imports as module scripts.
 * Desk additionally awaits its directory and both shared course-data imports.
 * These three narrowly named module paths are a boot policy, not a traversal of
 * every dynamic import; their complete URL tokens come from the real source. */
export async function collectBootCriticalGraph({rootDir,documentPath,baseURL='https://tmu.invalid/',html}){
 html??=await readFile(path.resolve(rootDir,documentPath),'utf8');
 const documentURL=new URL(documentPath,baseURL).href,scripts=extractDocumentModuleScripts(html,documentURL);
 const roots=scripts.map(script=>script.url);
 if(!roots.length)throw Error(`No native module roots in ${documentPath}`);
 const staticGraph=await collectModuleGraph({rootDir,roots,baseURL});
 const bootDynamicEdges=[];
 if(/<body\b[^>]*\bdata-page\s*=\s*["']?desk(?:["'\s>])/i.test(html)){
  const boot=staticGraph.nodes.find(node=>node.path==='assets/night/boot.mjs');
  const directory=boot?.dynamicImports.filter(reference=>reference.awaited&&reference.url&&new URL(reference.url).pathname.endsWith('/assets/night/desk.mjs'));
  if(directory?.length!==1)throw Error('Desk requires one literal awaited directory import in assets/night/boot.mjs');
  bootDynamicEdges.push({from:boot.url,to:directory[0].url,kind:'boot-dynamic',reason:'awaited Desk directory'});
  const targets=staticGraph.nodes.find(node=>node.path==='assets/night/targets.mjs');
  for(const modulePath of ['assets/cen-schedule.mjs','assets/course-data.mjs']){
   const references=targets?.dynamicImports.filter(reference=>reference.url&&new URL(reference.url).pathname.endsWith('/'+modulePath));
   if(references?.length!==1)throw Error(`Desk requires one literal target data import for ${modulePath}`);
   bootDynamicEdges.push({from:targets.url,to:references[0].url,kind:'boot-dynamic',reason:'awaited Desk course data'});
  }
 }
 const graph=bootDynamicEdges.length?await collectModuleGraph({rootDir,roots,baseURL,bootDynamicEdges}):staticGraph;
 return {...graph,scripts,documentURL,bootDynamicEdges};
}

if(process.argv[1]&&path.resolve(process.argv[1])===utilityPath&&['--worker','--parse'].includes(process.argv[2])){
 try{
  const input=readFileSync(0,'utf8');
  const result=process.argv[2]==='--parse'?extractModuleReferences(input):await collectModuleGraph(JSON.parse(input));
  process.stdout.write(JSON.stringify(result));
 }catch(error){process.stderr.write(error.message+'\n');process.exitCode=1;}
}
