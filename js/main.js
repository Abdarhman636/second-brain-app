/*
 * Application bootstrap: route guarding, rendering, and global event wiring.
 * Business rules live in utils/ and state/; this file only connects them.
 */
import { getCurrentUser, getDueCards, getProjectById, getState, setCurrentPage, subscribe } from './state/app-state.js';
import { parseRoute, PUBLIC_PAGES, rememberRoute, routes } from './router.js';
import { getToday } from './utils/date-utils.js';
import { renderNavigation, setupUserMenuDismissal } from './components/navigation.js';
import { renderAuthPage } from './pages/auth-page.js';
import { renderTodayPage } from './pages/today-page.js';
import { renderReviewPage } from './pages/review-page.js';
import { renderProjectsPage } from './pages/projects-page.js';
import { renderProjectDetailsPage } from './pages/project-details-page.js';
import { renderCardsPage } from './pages/cards-page.js';
import { actionHandlers } from './actions/index.js';
import { handleReviewKeydown, prepareReviewSession } from './actions/review-actions.js';

const APP_NAME = 'رسوخ';

const PAGES = {
  login: { render: (el) => renderAuthPage(el, { mode: 'login' }), title: 'تسجيل الدخول' },
  signup: { render: (el) => renderAuthPage(el, { mode: 'signup' }), title: 'إنشاء حساب' },
  today: { render: renderTodayPage, title: 'اليوم' },
  review: { render: renderReviewPage, title: 'المراجعة' },
  projects: { render: renderProjectsPage, title: 'المشاريع' },
  project: { render: renderProjectDetailsPage, title: 'مشروع' },
  cards: { render: renderCardsPage, title: 'البطاقات' },
};

const mainElement = document.getElementById('app-main');
const header = {
  navElement: document.getElementById('app-nav'),
  actionsElement: document.getElementById('app-header-actions'),
};

function renderApp() {
  const { currentPage, selectedProjectId } = getState();
  const page = PAGES[currentPage] ?? PAGES.today;
  const user = getCurrentUser();

  document.body.dataset.page = currentPage;
  document.body.dataset.auth = user ? 'signed-in' : 'signed-out';

  if (user) {
    renderNavigation(header, { currentPage, dueCount: getDueCards(getToday()).length, user });
  }
  page.render(mainElement);

  const pageTitle = currentPage === 'project' ? getProjectById(selectedProjectId)?.name ?? page.title : page.title;
  document.title = `${pageTitle} · ${APP_NAME}`;
}

/** Replace the current URL without adding a history entry, then route again. */
function redirect(hash) {
  window.history.replaceState(null, '', hash);
  applyRoute({ moveFocus: false });
}

function applyRoute({ moveFocus }) {
  const route = parseRoute(window.location.hash);
  const isPublic = PUBLIC_PAGES.has(route.page);
  const signedIn = Boolean(getCurrentUser());

  // Signed-out visitors go to sign-in, and return to this page afterwards.
  if (!signedIn && !isPublic) {
    rememberRoute(window.location.hash || routes.today);
    redirect(routes.login);
    return;
  }
  if (signedIn && isPublic) {
    redirect(routes.today);
    return;
  }

  if (route.page === 'review') prepareReviewSession();
  setCurrentPage(route.page, { projectId: route.projectId });

  if (moveFocus) {
    window.scrollTo(0, 0);
    mainElement.focus({ preventScroll: true });
  }
}

/** One delegated listener dispatches every `data-action` click. */
function handleActionClick(event) {
  const trigger = event.target.closest('[data-action]');
  const handler = trigger && actionHandlers[trigger.dataset.action];
  if (!handler) return;

  event.preventDefault();
  handler({ ...trigger.dataset }, trigger);
}

function init() {
  subscribe(renderApp);

  window.addEventListener('hashchange', () => applyRoute({ moveFocus: true }));
  document.addEventListener('click', handleActionClick);
  document.addEventListener('keydown', handleReviewKeydown);
  setupUserMenuDismissal();

  // Refresh when returning to the tab, in case the day rolled over.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && getCurrentUser()) renderApp();
  });

  applyRoute({ moveFocus: false });
}

init();
