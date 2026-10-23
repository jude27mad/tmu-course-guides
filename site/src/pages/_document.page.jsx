import Document, { Head, Html, Main, NextScript } from 'next/document';
import { TOKENS } from '@src/lib/palette.mjs';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

// The old pages' policy, plus what this stack needs, and nothing remote:
// Rapier compiles its inlined WASM ('wasm-unsafe-eval'); three/drei may use
// blob: workers; textures are generated in the page (data:/blob:).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

// The old site's guide mark (assets/guide-mark.svg), inline as before, so no
// /favicon.ico request leaves the Pages base.
const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='3' fill='%23102a2d'/%3E%3Cpath d='M8 15 17 10v21l-9 5zm12-1 12-6v21l-12 6zm-9-6 9-5 4 4-9 5z' fill='%23f5e5d4'/%3E%3C/svg%3E";

// Runs before first paint: marks JS as available (so the original "hidden until the
// loader reveals it" styles apply only with JS) and applies the motion setting
// early (prefers-reduced-motion or the saved 'guide-motion-paused' = 'true').
const BOOT = `(function(d){const r=d.documentElement;r.classList.add('js');try{const q=new URLSearchParams(location.search).get('motion'),p=localStorage.getItem('guide-motion-paused')==='true',m=!!window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;if(q==='off'||p||(m&&q!=='full'))r.setAttribute('data-motion','off');}catch(e){}})(document);`;

export default class MyDocument extends Document {
  render() {
    return (
      <Html lang="en">
        <Head>
          <meta httpEquiv="Content-Security-Policy" content={CSP} />
          <meta name="referrer" content="no-referrer" />
          {/* eslint-disable-next-line react/no-danger */}
          <script dangerouslySetInnerHTML={{ __html: BOOT }} />
          {/* Light only, and no automatic dark mode: forced darkening inverts the design (see global.scss). */}
          <meta name="color-scheme" content="only light" />
          <meta name="theme-color" content={TOKENS.page} />
          <meta name="format-detection" content="telephone=no" />
          <link rel="icon" href={FAVICON} />
          <link rel="apple-touch-icon" sizes="180x180" href={`${BASE_PATH}/apple-touch-icon.png`} />
          <link rel="manifest" href={`${BASE_PATH}/site.webmanifest`} />
          {/* weight 550 (Regular) sets almost every type class, including the loader */}
          <link rel="preload" href={`${BASE_PATH}/fonts/InterDisplay-Regular.woff2`} as="font" type="font/woff2" crossOrigin="anonymous" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
