/* The rest shape of an open page (docs/book/art-direction.md, "Pages"). An open book's page rises out of the
   gutter, flattens near a fifth of its width and rolls gently down to the fore-edge. Static pages, the page
   block, turning sheets at rest, pop-up feet and picking all use this one profile so nothing floats or pops.

   x is metres from the spine along the page (0 … W); the result is the lift above the flat page plane in
   metres. Both pages use the same profile, mirrored by the caller. C¹-continuous: the rise ends with zero
   slope at the peak and the fall is a smoothstep, so normals have no seam. Pure, no imports. */

export const REST=Object.freeze({peak:.006,peakAt:.22,edge:.0015});

const clamp01=v=>v<0?0:v>1?1:v;

/** Lift in metres at x metres from the spine. */
export function restLift(x,W=.142,rest=REST){
 const u=clamp01(x/W),p=rest.peakAt;
 if(u<=p){const s=u/p;return rest.peak*(1-(1-s)*(1-s));}
 const s=(u-p)/(1-p);return rest.peak+(rest.edge-rest.peak)*s*s*(3-2*s);
}

/** d(lift)/dx at x metres from the spine (for normals and the turn blend). */
export function restSlope(x,W=.142,rest=REST){
 const u=clamp01(x/W),p=rest.peakAt;
 if(u<=p){const s=u/p;return rest.peak*2*(1-s)/(p*W);}
 const s=(u-p)/(1-p);return (rest.edge-rest.peak)*6*s*(1-s)/((1-p)*W);
}
