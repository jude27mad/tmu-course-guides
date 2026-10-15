/** @type {import('next').NextConfig} */

// Static export for GitHub Pages. The site is served from a sub-path of the
// Pages project, so every route and asset URL carries a basePath. The default
// is the preview location (/tmu-course-guides/next); set SITE_BASE_PATH (or
// NEXT_PUBLIC_BASE_PATH) to build for another location, e.g.
// SITE_BASE_PATH=/tmu-course-guides for the Pages root, '' for a domain root.
const rawBasePath = process.env.SITE_BASE_PATH ?? process.env.NEXT_PUBLIC_BASE_PATH ?? '/tmu-course-guides/next';
const basePath = rawBasePath === '/' ? '' : rawBasePath.replace(/\/+$/, '');

const nextConfig = {
  output: 'export',
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  pageExtensions: ['page.jsx'],
  env: {
    // Read by src/utils/basePath.js for files in public/ (images, models,
    // HDRs, fonts referenced from JS) that Next does not prefix by itself.
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  sassOptions: {
    // Lets SCSS reach files in public/ under the basePath: url('#{$base-path}/fonts/x.woff2').
    additionalData: `$base-path: '${basePath}';`,
  },
  experimental: {
    // optimizeCss: true,
    // nextScriptWorkers: true,
  },
  // uncomment the following snippet if using styled components
  // compiler: {
  //   styledComponents: true,
  // },
  reactStrictMode: false, // Recommended for the `pages` directory, default in `app`.

  // No image optimisation server on GitHub Pages.
  images: { unoptimized: true },
  webpack(config, { isServer }) {
    if (!isServer) {
      // We're in the browser build, so we can safely exclude the sharp module
      config.externals.push('sharp');
    }
    // shader support
    config.module.rules.push({
      test: /\.(glsl|vs|fs|vert|frag)$/,
      exclude: /node_modules/,
      use: ['raw-loader', 'glslify-loader'],
    });

    return config;
  },
  // headers() and redirects() are not supported by `output: 'export'`.
  // The /404 -> / redirect is still done client side by src/pages/404.page.jsx;
  // /home -> / is dropped (GitHub Pages serves 404.html for it, which redirects).
};

module.exports = nextConfig;
