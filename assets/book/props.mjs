/* Desk and props for the book scene (docs/book/art-direction.md, "Desk and props"). Contract stub: the scene
   integrates it now; the geometry pass fills in the wood desk, blotter, pencil and sticky notes.

   createProps({style, theme, tier}) → {
     group,                 THREE.Group in world space (book spread centre at the origin, Y up, viewer at +Z)
     setTheme(theme),       'dark' | 'light'; swaps material values, never rebuilds geometry
     setTier(tier),         'high' | 'mid'; may drop detail on mid
     setNote(view),         the next assessment for the top sticky note ({title, when} from describeSpread), or null
     setLayout({phone}),    hides props that would crowd a phone framing
     dispose()              releases geometries, materials and canvas textures
   }
   Props cast and receive shadows, are excluded from picking (raycast is a no-op) and do no work per frame. */
import * as T from '../app/three.mjs?v=20261013-stage1';

export function createProps({style=null,theme='dark',tier='mid'}={}){
 const group=new T.Group();group.name='props';
 return {
  group,
  setTheme(){},setTier(){},setNote(){},setLayout(){},
  dispose(){group.removeFromParent();}
 };
}
