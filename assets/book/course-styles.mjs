/* Book styles and themes (semester-book spec §5.1, §5.5, §5.6, §9).
   One style per course book; Stage 2 fills in only MTH140's `sketchbook`. The schema is general so Stage 4
   adds CEN100's technical manual and MTH141's graph-paper notebook as data, not engine branches.

   Style = {
     id, course, cover: {code, title, term},
     dims:    {W, H, corner, board: {width, height, thickness, radius, bevel, overhang}, block, spine},
     band:    {width, thickness, x} | null       // elastic closure, x as a fraction of W from the spine
     ribbon:  {width, thickness, angle, tail} | null
     rules:   'none' | 'blueprint' | 'grid'      // procedural page rules (shader flag; off for MTH140)
     sketch:  'pencil' | 'pen' | 'fineliner'     // the painted sketch layer (textures.mjs)
     popup:   {mechanism: 'arch' | 'box' | 'vfold'}
     ease:    {turn, riffle, rise}               // GSAP ease strings
     themes:  {dark: Theme, light: Theme}        // materials and the light rig (§5.5, §5.6)
   }
   Colours are sRGB hex strings; the engine converts them once. Lights are in world space with the open
   spread's centre at the origin, Y up, the viewer at +Z. Both themes drive one key SpotLight: the night
   lamp, or the window light as a distant, non-decaying spot with a narrow cone (it reads as directional,
   and a theme change becomes a uniform tween with no program recompile).

   Shell module: no side effects at import. */

export const BOOK_COURSES=Object.freeze(['mth140']);
export const THEMES=Object.freeze(['dark','light']);

const W=.142,H=.206;

const sketchbook={
 id:'sketchbook',course:'mth140',
 cover:{code:'MTH140',title:'CALCULUS I',term:'FALL 2026'},
 dims:{W,H,corner:.005,
  board:{width:.148,height:.212,thickness:.0024,radius:.006,bevel:.0006,overhang:.003},
  block:.011,spine:.016},
 band:{width:.006,thickness:.0012,x:.8},
 ribbon:{width:.006,thickness:.0003,angle:6,tail:.025},
 rules:'none',sketch:'pencil',
 popup:{mechanism:'arch'},
 ease:{turn:'power2.inOut',riffle:'power2.inOut',rise:'back.out(1.15)'},
 themes:{
  dark:{
   paper:'#efe6d2',ink:'#1f2624',accent:'#096450',urgent:'#a8391d',pencil:'#5a5f61',
   gutter:{ao:.78,width:.12},
   edge:{base:'#e3d8c0',line:'#cfc2a5',gap:'#b9ab8d'},
   linen:{color:'#a6d6c2',roughness:.82,sheen:.45,sheenColor:'#dff2e7',sheenRoughness:.55,normalScale:.35},
   endpaper:'#dfeee5',
   elastic:{color:'#1f5a48',roughness:.55,sheen:.7,sheenColor:'#78b89b',sheenRoughness:.35},
   ribbon:{color:'#1f5a48',roughness:.35,sheen:1,sheenColor:'#9ed1b8',sheenRoughness:.25},
   wash:'#b9dfc9',
   blotter:{color:'#202c30',roughness:1,sheen:.3,sheenColor:'#3a4a50'},
   contact:{color:'#000000',opacity:.55},
   curl:.35,foot:.18,
   emissive:{urgent:'#ff7a59',soon:1.15,hot:1.6,spine:'#b9dfc9',spineGain:1.3},
   key:{color:'#ffecd4',position:[-.42,.62,.18],target:[-.03,0,-.03],angle:27,penumbra:.95,decay:2,E:3.5},
   fill:{sky:'#a9bcc6',ground:'#1a1410',intensity:.42},
   rim:{color:'#9fc2d2',position:[.6,.35,-.7],intensity:.6},
   environment:.12,exposure:.95,shadow:1024,shadowOpacity:1
  },
  light:{
   paper:'#fbfaf6',ink:'#1f2624',accent:'#096450',urgent:'#a8391d',pencil:'#5a5f61',
   gutter:{ao:.86,width:.12},
   edge:{base:'#f1efe8',line:'#dedbd2',gap:'#cbc7bc'},
   linen:{color:'#b2dbc4',roughness:.86,sheen:.22,sheenColor:'#d6eadd',sheenRoughness:.6,normalScale:.35},
   endpaper:'#e6f2ea',
   elastic:{color:'#1f5a48',roughness:.55,sheen:.7,sheenColor:'#78b89b',sheenRoughness:.35},
   ribbon:{color:'#24624f',roughness:.35,sheen:1,sheenColor:'#9ed1b8',sheenRoughness:.25},
   wash:'#b9dfc9',
   blotter:{color:'#bdb6a8',roughness:1,sheen:.12,sheenColor:'#e6e0d4'},
   contact:{color:'#4a3b22',opacity:.28},
   curl:.2,foot:.1,
   emissive:{urgent:'#a8391d',soon:.9,hot:.9,spine:'#b9dfc9',spineGain:.9},
   // The window: far up-left of the desk, cone just wide enough for the blotter, no fall-off.
   key:{color:'#fff4e8',position:[-1.35,1.95,.52],target:[0,0,0],angle:11,penumbra:1,decay:0,E:2.6},
   fill:{sky:'#eef3f7',ground:'#d9cfbd',intensity:.75},
   rim:{color:'#ffffff',position:[.5,.4,-.8],intensity:.25},
   environment:.38,exposure:1,shadow:512,shadowOpacity:.8
  }
 }
};

/* Stage 4 targets, kept as data so the schema is exercised; BOOK_COURSES gates what mounts. */
const STYLES={sketchbook};
const BY_COURSE={mth140:'sketchbook'};

const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const key of Object.keys(value))freeze(value[key]);}return value;};
freeze(STYLES);

export const isBookCourse=course=>BOOK_COURSES.includes(course);
/** The style for a course book, or null for a course without one. */
export function bookStyle(course){const id=BY_COURSE[course];return id?STYLES[id]:null;}
export function styleById(id){return STYLES[id]??null;}

/** Real-renderer posters for the poster path (§5.11): `{wide, tall}` absolute URLs. */
export function bookPosterPaths(course,theme=currentTheme()){
 const tone=theme==='light'?'light':'dark',name=String(course||'').replace(/[^a-z0-9]/gi,'');
 const url=view=>new URL(`./posters/${name}-${tone}-${view}.webp`,import.meta.url).href;
 return {wide:url('wide'),tall:url('tall')};
}

/* ---- theme ----
   The hub writes <html data-theme="light|dark"> for an explicit choice and removes it for Auto, which follows
   prefers-color-scheme. */
const darkQuery=()=>{try{return globalThis.matchMedia?.('(prefers-color-scheme: dark)')??null;}catch{return null;}};
export function currentTheme(){
 const explicit=globalThis.document?.documentElement?.dataset?.theme;
 if(explicit==='light'||explicit==='dark')return explicit;
 return darkQuery()?.matches?'dark':'light';
}
/** Calls fn(theme) after each actual change of the resolved theme. Returns an unsubscribe. */
export function onTheme(fn){
 const doc=globalThis.document;if(!doc||typeof fn!=='function')return()=>{};
 let last=currentTheme(),active=true;
 const check=()=>{if(!active)return;const next=currentTheme();if(next===last)return;last=next;try{fn(next);}catch(error){console.warn('Theme listener failed',error);}};
 let observer=null;
 if(typeof MutationObserver==='function'){observer=new MutationObserver(check);observer.observe(doc.documentElement,{attributes:true,attributeFilter:['data-theme']});}
 const query=darkQuery();query?.addEventListener?.('change',check);
 return()=>{active=false;observer?.disconnect();query?.removeEventListener?.('change',check);};
}
