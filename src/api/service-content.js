export async function loadServiceContent(api, slug, signal) {
  const categories = await api.categoriesByService(slug, { signal });
  const result = new Array(categories.length);
  let cursor = 0;
  async function loadNext() {
    while (cursor < categories.length) {
      if (signal?.aborted) throw signal.reason;
      const index = cursor++;
      const category = categories[index];
      try {
        result[index] = { ...category, items: await api.itemsByCategory(category.id, { signal }), loadError: false };
      } catch (err) {
        if (signal?.aborted) throw err;
        result[index] = { ...category, items: [], loadError: true };
      }
    }
  }
  // Bound concurrency, and retain successful categories when one request fails.
  await Promise.all(Array.from({ length: Math.min(3, categories.length) }, loadNext));
  return { categories: result, partial: result.some(c => c.loadError) };
}
