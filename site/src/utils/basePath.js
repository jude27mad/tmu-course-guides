// The site is exported under a basePath (next.config.js). Next prefixes its
// own routes and /_next assets, but not root-absolute URLs that point into
// public/ (next/image with unoptimized images, <video>, three.js loaders,
// favicons). Wrap those with withBasePath('/model/Tag.glb').
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

export function withBasePath(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return path;
  if (BASE_PATH && (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`))) return path;
  return `${BASE_PATH}${path}`;
}
