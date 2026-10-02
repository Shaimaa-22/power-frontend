import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { loadServiceContent } from '../api/service-content';

export function useServiceContent(slug) {
  const [state, setState] = useState({ status: 'loading', categories: [], partial: false });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', categories: [], partial: false });
    loadServiceContent(api, slug, controller.signal).then(result => {
      if (!controller.signal.aborted) setState({ status: 'ready', ...result });
    }).catch(err => {
      if (controller.signal.aborted) return;
      console.error('Service content unavailable', err.message);
      setState({ status: 'error', categories: [], partial: false });
    });
    return () => controller.abort();
  }, [slug, attempt]);
  const reload = useCallback(() => setAttempt(n => n + 1), []);
  return { ...state, reload };
}
