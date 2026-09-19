import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';

/**
 * Loads the categories of one service and, for each category, its items.
 * Returns { status: 'loading' | 'ready' | 'error', categories, reload }
 * where categories = [{ id, name_ar, name_en, name_he, items: [...] }]
 */
export function useServiceContent(slug) {
  const [state, setState] = useState({ status: 'loading', categories: [] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const opts = { signal: controller.signal };
    setState({ status: 'loading', categories: [] });

    (async () => {
      try {
        const categories = await api.categoriesByService(slug, opts);
        const withItems = await Promise.all(
          categories.map(async (category) => ({
            ...category,
            items: await api.itemsByCategory(category.id, opts),
          }))
        );
        setState({ status: 'ready', categories: withItems });
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error(err);
        setState({ status: 'error', categories: [] });
      }
    })();

    return () => controller.abort();
  }, [slug, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}
