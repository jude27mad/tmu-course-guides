// Optional Night Shift plugins, loaded lazily. ScrollTrigger and SplitText carry no GSAP core of their own:
// the night layer registers them against the guide's single instance from gsap-3.15.0.mjs.
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import {SplitText} from 'gsap/SplitText';
import Lenis from 'lenis';
export {ScrollTrigger,SplitText,Lenis};
