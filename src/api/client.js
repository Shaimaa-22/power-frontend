/**
 * Thin client for the Power backend (see backend README).
 * Only the PUBLIC read endpoints are used here — the website has no login.
 */
const BASE = (import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3000' : ''))
  .toString()
  .replace(/\/+$/, '');

async function request(path, { signal } = {}) {
  const res = await fetch(`${BASE}${path}`, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Request failed (${res.status}) — ${path}`);
  return res.json();
}

export const api = {
  /** GET /api/categories/service/:slug */
  categoriesByService: (slug, opts) => request(`/api/categories/service/${encodeURIComponent(slug)}`, opts),

  /** GET /api/items/category/:categoryId */
  itemsByCategory: (categoryId, opts) => request(`/api/items/category/${encodeURIComponent(categoryId)}`, opts),

  /** The backend stores only the filename; images are streamed from GET /images/:filename */
  imageUrl: (filename) => (filename ? `${BASE}/images/${encodeURIComponent(filename)}` : null),
};
