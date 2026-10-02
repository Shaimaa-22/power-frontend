// Confirmed from Cloudflare account/Worker metadata. Update deliberately if the API origin changes.
export const PRODUCTION_API_ORIGIN = 'https://power-api.power-elec.workers.dev';

export function resolveBuildApiBase(value, mode = 'production') {
  const origin = resolveApiBase(value);
  // Preview is an explicit build mode; Vite's default production build must not target it.
  if (mode !== 'preview' && origin !== PRODUCTION_API_ORIGIN) {
    throw new Error('Production builds require VITE_API_URL=' + PRODUCTION_API_ORIGIN + '; use --mode preview for isolated previews');
  }
  return origin;
}

export function resolveApiBase(value, development = false) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw && development) return 'http://localhost:8787';
  if (!raw) throw new Error('VITE_API_URL is required for production (HTTPS Worker origin, without /api)');
  let url;
  try { url = new URL(raw); } catch { throw new Error('VITE_API_URL must be an absolute URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('VITE_API_URL must contain only the Worker origin, without /api, credentials, query or fragment');
  }
  if (!development && (url.protocol !== 'https:' || /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(url.hostname))) {
    throw new Error('Production VITE_API_URL must be an HTTPS Worker origin, not localhost');
  }
  return url.origin;
}
