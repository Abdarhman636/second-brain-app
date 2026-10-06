import { icon } from './icons.js';
import { renderThemeToggle } from './theme-toggle.js';
import { routes } from '../router.js';

const NAV_ITEMS = [
  { section: 'today', href: routes.today, label: 'اليوم' },
  { section: 'projects', href: routes.projects, label: 'المشاريع' },
  { section: 'cards', href: routes.cards, label: 'البطاقات' },
];

// Sub-pages highlight their parent section.
const ACTIVE_SECTION = { today: 'today', review: 'today', projects: 'projects', project: 'projects', cards: 'cards' };

function renderLinks() {
  return `
    <ul class="nav-list" role="list">
      ${NAV_ITEMS.map(
        (item) => `
          <li>
            <a class="nav-link" href="${item.href}" data-nav="${item.section}">
              ${item.label}
              ${item.section === 'today' ? '<span class="nav-link__count" data-nav-count hidden></span>' : ''}
            </a>
          </li>`,
      ).join('')}
    </ul>`;
}

function renderActions() {
  return `
    <button type="button" class="btn btn--primary header-add" data-action="create-card" aria-label="إضافة بطاقة">
      ${icon('plus', { size: 18 })}<span class="header-add__label">إضافة بطاقة</span>
    </button>

    ${renderThemeToggle()}

    <details class="user-menu" data-user-menu>
      <summary class="user-menu__trigger" aria-label="حسابك">
        <span class="user-menu__avatar" data-user-initial></span>
      </summary>
      <div class="user-menu__panel">
        <p class="user-menu__name" data-user-name></p>
        <p class="user-menu__email" dir="ltr" data-user-email></p>
        <button type="button" class="user-menu__item" data-action="sign-out">تسجيل الخروج</button>
      </div>
    </details>`;
}

/**
 * The header is built once and then updated in place, so focus and open
 * menus survive the frequent re-renders triggered by state changes.
 */
export function renderNavigation({ navElement, actionsElement }, { currentPage, dueCount, user }) {
  if (!navElement.dataset.ready) {
    navElement.innerHTML = renderLinks();
    actionsElement.innerHTML = renderActions();
    navElement.dataset.ready = 'true';
  }

  const activeSection = ACTIVE_SECTION[currentPage];
  navElement.querySelectorAll('[data-nav]').forEach((link) => {
    if (link.dataset.nav === activeSection) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  const count = navElement.querySelector('[data-nav-count]');
  count.textContent = String(dueCount);
  count.hidden = dueCount === 0;
  count.setAttribute('aria-label', `${dueCount} للمراجعة`);

  if (user) {
    actionsElement.querySelector('[data-user-initial]').textContent = [...user.name.trim()][0] ?? '؟';
    actionsElement.querySelector('[data-user-name]').textContent = user.name;
    actionsElement.querySelector('[data-user-email]').textContent = user.email;
  }
}

/** Close the account menu when clicking elsewhere or pressing Escape. */
export function setupUserMenuDismissal() {
  const close = () => document.querySelector('[data-user-menu][open]')?.removeAttribute('open');

  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-user-menu]') || event.target.closest('[data-action="sign-out"]')) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
}
