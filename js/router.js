/*
 * Minimal hash router.
 *   #login / #signup  → Authentication (public)
 *   #today            → Home dashboard (default)
 *   #review           → Focused review session
 *   #projects         → All projects
 *   #project/<id>     → Project details
 *   #cards            → All cards
 */

export const routes = Object.freeze({
  login: '#login',
  signup: '#signup',
  today: '#today',
  review: '#review',
  projects: '#projects',
  cards: '#cards',
  project: (projectId) => `#project/${encodeURIComponent(projectId)}`,
});

/** Pages reachable without signing in. */
export const PUBLIC_PAGES = new Set(['login', 'signup']);

export function parseRoute(hash) {
  const [segment = '', param] = hash.replace(/^#\/?/, '').split('/');

  switch (segment) {
    case 'login':
    case 'signup':
    case 'review':
    case 'projects':
    case 'cards':
      return { page: segment };
    case 'project':
      return param ? { page: 'project', projectId: decodeURIComponent(param) } : { page: 'projects' };
    default:
      return { page: 'today' };
  }
}

export function navigate(hash) {
  if (window.location.hash !== hash) window.location.hash = hash;
}

/* ---------- Where to go after signing in ---------- */

let pendingRoute = null;

export function rememberRoute(hash) {
  pendingRoute = hash;
}

export function takeRememberedRoute() {
  const route = pendingRoute ?? routes.today;
  pendingRoute = null;
  return route;
}
