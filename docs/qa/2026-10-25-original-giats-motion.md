# Original Giats card and fluid motion

Source: [Giats2498/giats-portfolio at 1e0b7b0](https://github.com/Giats2498/giats-portfolio/tree/1e0b7b0bfc0dce086a91c8d742c3c13cff6cf270).
Original portfolio design and development by Evangelos Giatsidis — https://giats.me.
The existing MIT licence and design credit are retained.

The request is to restore the original motion, superseding the earlier requests
for heavier cards and additional contact/release fluid effects.

The card positions and course textures stay as they are. Their shared-world
translation is independent of the motion: the original starting offsets,
damping, gravity, timestep, colliders, rope/spherical joints, per-render-frame
scroll impulse, angular correction and band interpolation are restored. There
is no impulse cap, smoothing, expiry, altered timestep or near-hanging start.
The visibility observer uses the original `isIntersecting` semantics at its
0.7 threshold and only gates scroll input; it no longer freezes the simulation.
The explicit Pause motion/reduced-motion control still freezes the scene.

`Fluid.jsx` and `useOpts.jsx` are copied verbatim from the source above. The
shaders, framebuffer setup and materials already match that source. The
original shared-pointer calculation in `usePointerEvents.jsx` is restored.
Native iOS document scrolling retains one passive input adapter: changed
`touchmove` coordinates enter the original calculation, while duplicate touch
pointer events are excluded. Mouse/pen movement still enters through
`pointermove`. There are no synthetic contact or release splats, extra dye,
per-finger momentum calculations or resets. This adapter changes browser event
transport, not the brush's calculations. The existing effect-wrapper resource
caches are retained; they do not change shader values or simulation operations.
The app retains its original Giats `#D7D7D4` fluid colour and difference blend.

Reference fixtures preserve the upstream code independently of production.
GitHub CI on bd14123752ea034f8cd1c9069286928ff25eab35 reproduced both regressions:
the added contact dye (32 instead of no contact splat) and a different first
card position (0.5999 instead of 1.9627). Tests compare actual pointer responses,
Rapier drop trajectories at translated positions, and per-frame scroll forces.
The native input adapter is covered for multiple fingers, different child
nodes, mouse/pen input, rapid reversals, retouch, duplicate streams and cleanup.
Browser checks retain rapid scrolling, finite connected bodies, rendered badge
faces, course routes, pause, fluid shaders, native scrolling and navigation.
The old artificial sway limit is replaced by a recovery check: after repeated
instant full-screen jumps, the same finite bodies must return to a hanging
position with low velocity. The original uncapped forces can temporarily stretch
Rapier's soft constraints; limiting that excursion would restore the unwanted
retuning. The full touch-fluid check and all iPhone WebKit routes passed in the
first restoration run; that run exposed this obsolete bounded-sway assertion.

All application tests, builds and browser checks run in GitHub CI. Physical
iPhone frame pacing cannot be established by emulated browser checks.
