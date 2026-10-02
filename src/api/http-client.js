export function createApi(base, fetcher = fetch) {
  async function request(path, { signal } = {}, kind) {
    const controller = new AbortController();
    const abort = () => controller.abort(signal.reason);
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), 15000);
    try {
      const response = await fetcher(base + path, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const type = response.headers.get('content-type') || '';
      if (!type.includes('application/json')) throw new Error('API returned a non-JSON response');
      const rows = await response.json();
      const prefix = kind === 'categories' ? 'name' : 'title';
      if (!Array.isArray(rows) || rows.some(row => !row || !Number.isSafeInteger(row.id) || row.id < 1 ||
        ['ar','en','he'].some(lang => typeof row[`${prefix}_${lang}`] !== 'string') ||
        (kind === 'items' && ((row.image_url != null && typeof row.image_url !== 'string') ||
          ['ar','en','he'].some(lang => row[`description_${lang}`] != null && typeof row[`description_${lang}`] !== 'string'))))) {
        throw new Error('API returned malformed data');
      }
      return rows;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  }
  return {
    categoriesByService: (slug, opts) => request(`/api/categories/service/${encodeURIComponent(slug)}`, opts, 'categories'),
    itemsByCategory: (id, opts) => request(`/api/items/category/${encodeURIComponent(id)}`, opts, 'items'),
    imageUrl: filename => typeof filename === 'string' && filename ? `${base}/images/${encodeURIComponent(filename)}` : null,
  };
}
