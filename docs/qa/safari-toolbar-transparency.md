# Safari toolbar transparency, not flat colour matching

## Report

The owner wants page content continuing behind Safari's translucent controls. Matching a solid bar to the page colour does not meet that requirement. The prior `data-safari-edge` layers had opaque computed backgrounds and text clipping; they deliberately caused solid background extension. Remove them rather than adding another colour case.

## Change

Use empty, transparent sticky guards outside the animated application root. The bottom guard follows all page content; the top guard precedes it. Both have a 6px box, a -2px edge offset, no paint, and no pointer events. Negative margins compensate their flow height so they neither add a bottom gap nor move the page. The guards do not change fluid colours, intensity, input or rendering. Desktop remains unchanged.

The shared browser-surface state and theme-color hint remain for existing menu and non-Safari compatibility. The old sampler CSS no longer consumes its opaque colour variables.

## Evidence and limitations

- WebKit engineer explanation of fixed/sticky viewport-edge background extension: https://bugs.webkit.org/show_bug.cgi?id=301756#c2
- Matt Fantinel, firsthand iPhone reproduction and transparent bottom-sticky workaround, 7 October 2026: https://fantinel.dev/blog/safari-floating-url-bar-background

The bottom guard follows that documented workaround. The top guard is a symmetric adaptation, not a physically verified iPhone result. This is not a standardized Safari API. The source explicitly notes that a native dialog can keep the toolbar opaque while open and recover when it closes.

## Automated checks

The old test asserted that opaque samples existed, so it could pass while the owner's visual requirement failed. The replacement regression rejects those samples and the text-clipping disguise. The existing WebKit iPhone-emulation script now checks the actual compiled CSS on all six routes with normal/reduced motion: transparent sticky backgrounds, edge geometry, no hit interception, no extra document height, preserved scrolling, and menu open/close. Existing Pages checks exercise touch fluid, saved work, navigation and glass controls.

Linux WebKit does not render iPhone Safari's native browser UI. Passing these tests is evidence of correct page geometry, not proof that the toolbar blending is fixed. Physical acceptance remains: real content is visible behind Safari controls during scrolling, not merely a different solid bar colour; light pages, dark footer, menu open/close, expanded/collapsed controls, and route changes all need to be checked.
