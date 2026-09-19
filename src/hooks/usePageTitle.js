import { useEffect } from 'react';

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | Power` : 'Power — Engineering & Electrical Solutions';
  }, [title]);
}
