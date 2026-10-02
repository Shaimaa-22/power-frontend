/**
 * A tiny History-API router (no dependency) — enough for this site:
 * <Router>, <Routes routes=[{ path, element }]>, <Link>, <NavLink>, useParams(), useRouter().
 * Paths support ':param' segments and a '*' catch-all.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { safeDecode } from './lib/url';

const RouterContext = createContext(null);
const ParamsContext = createContext({});

const readLocation = () => ({
  pathname: window.location.pathname,
  search: window.location.search,
  hash: window.location.hash,
});

export function Router({ children }) {
  const [location, setLocation] = useState(readLocation);
  const [navCount, setNavCount] = useState(0); // bumps on every programmatic navigation

  useEffect(() => {
    const onPop = () => setLocation(readLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to, { replace = false } = {}) => {
    const url = new URL(to, window.location.origin);
    if (url.origin !== window.location.origin) {
      window.location.assign(to);
      return;
    }
    const next = url.pathname + url.search + url.hash;
    window.history[replace ? 'replaceState' : 'pushState'](null, '', next);
    setLocation({ pathname: url.pathname, search: url.search, hash: url.hash });
    setNavCount((n) => n + 1);
  }, []);

  // New page => scroll to top (or to the #hash target when there is one).
  useEffect(() => {
    if (navCount === 0) return;
    if (location.hash) {
      const el = document.getElementById(safeDecode(location.hash.slice(1)) ?? location.hash.slice(1));
      if (el) {
        el.scrollIntoView();
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [navCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(() => ({ location, navigate }), [location, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export const useRouter = () => useContext(RouterContext);
export const useParams = () => useContext(ParamsContext);

const normalize = (p) => (p.length > 1 ? p.replace(/\/+$/, '') : p) || '/';

function matchPath(pattern, pathname) {
  if (pattern === '*') return {};
  const a = normalize(pattern).split('/');
  const b = normalize(pathname).split('/');
  if (a.length !== b.length) return null;
  const params = {};
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].startsWith(':')) {
      const decoded = safeDecode(b[i]);
      if (decoded === null) return null;
      params[a[i].slice(1)] = decoded;
    }
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

export function Routes({ routes }) {
  const { location } = useRouter();
  for (const route of routes) {
    const params = matchPath(route.path, location.pathname);
    if (params) return <ParamsContext.Provider value={params}>{route.element}</ParamsContext.Provider>;
  }
  return null;
}

export function Link({ to, onClick, target, children, ...rest }) {
  const { navigate } = useRouter();
  const handleClick = (e) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || target === '_blank') return;
    e.preventDefault();
    navigate(to);
  };
  return (
    <a href={to} target={target} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}

export function NavLink({ to, end = false, className = '', children, ...rest }) {
  const { location } = useRouter();
  const path = normalize(location.pathname);
  const target = normalize(to);
  const active = end ? path === target : path === target || path.startsWith(`${target}/`);
  return (
    <Link to={to} className={`${className}${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined} {...rest}>
      {children}
    </Link>
  );
}
