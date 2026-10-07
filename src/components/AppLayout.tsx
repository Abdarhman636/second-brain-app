import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { AUTHOR_SITE_URL } from '../config';
import { retryLoad, signOut as endAccountSession } from '../data/session';
import { getInitial } from '../domain/format';
import { useTodaysReviews } from '../hooks/use-app-data';
import { useGlobalShortcuts } from '../hooks/use-global-shortcuts';
import { useToggleTheme } from '../hooks/use-theme';
import { useToday } from '../hooks/use-today';
import { useVacationExpiry } from '../hooks/use-vacation-actions';
import { useAppStore } from '../store/app-store';
import { useSessionStore } from '../store/session-store';
import { useUiStore } from '../store/ui-store';
import { Footer } from './Footer';
import { BrandMark, Icon, type IconName } from './Icon';

type Section = 'today' | 'projects' | 'cards' | 'settings';

const NAV_ITEMS: { section: Section; to: string; label: string; icon: IconName }[] = [
  { section: 'today', to: '/', label: 'اليوم', icon: 'today' },
  { section: 'projects', to: '/projects', label: 'المشاريع', icon: 'projects' },
  { section: 'cards', to: '/cards', label: 'البطاقات', icon: 'cards' },
  { section: 'settings', to: '/settings', label: 'الإعدادات', icon: 'settings' },
];

/** Page key for the current path; sub-pages belong to their parent section. */
function getPageKey(pathname: string): string {
  if (pathname === '/') return 'today';
  return pathname.split('/')[1] ?? 'today';
}

function getSection(page: string): Section | null {
  if (page === 'review') return 'today';
  return NAV_ITEMS.find((item) => item.section === page)?.section ?? null;
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const toggleTheme = useToggleTheme();
  return (
    <button
      type="button"
      className={`icon-btn theme-toggle ${className}`.trim()}
      aria-label="تبديل المظهر بين الفاتح والداكن"
      title="الوضع الفاتح / الداكن"
      onClick={toggleTheme}
    >
      <Icon name="moon" size={18} className="theme-toggle__moon" />
      <Icon name="sun" size={18} className="theme-toggle__sun" />
    </button>
  );
}

/* ---------- Sidebar ---------- */

function SidebarUser({ onNavigate }: { onNavigate: () => void }) {
  const user = useAppStore((state) => state.user);
  const mode = useAppStore((state) => state.mode);
  if (!user) return null;

  return (
    <Link className="sidebar-user" to="/settings" onClick={onNavigate} aria-label={`حسابك: ${user.name}`}>
      <span className="sidebar-user__avatar" aria-hidden="true">
        {getInitial(user.name)}
      </span>
      <span className="sidebar-user__body">
        <span className="sidebar-user__name">{user.name}</span>
        {mode === 'demo' ? (
          <span className="sidebar-user__meta">وضع تجريبي · لا يُحفظ شيء</span>
        ) : (
          <span className="sidebar-user__meta" dir="ltr">
            {user.email}
          </span>
        )}
      </span>
    </Link>
  );
}

function Sidebar({ section, id, onNavigate }: { section: Section | null; id: string; onNavigate: () => void }) {
  const today = useToday();
  const dueCount = useTodaysReviews(today).cards.length;
  const mode = useAppStore((state) => state.mode);
  const openDialog = useUiStore((state) => state.openDialog);
  const navigate = useNavigate();

  const signOut = async () => {
    await endAccountSession();
    navigate('/login');
  };

  return (
    <aside className="sidebar" id={id} aria-label="القائمة الجانبية">
      <div className="sidebar__brand-row">
        <Link className="brand" to="/" onClick={onNavigate}>
          <BrandMark />
          <span className="brand__name">رسوخ</span>
        </Link>
        <ThemeToggle />
      </div>

      <SidebarUser onNavigate={onNavigate} />

      <button
        type="button"
        className="btn btn--primary sidebar__add"
        aria-keyshortcuts="N"
        onClick={() => {
          onNavigate();
          openDialog({ kind: 'create-card' });
        }}
      >
        <Icon name="plus" size={18} />
        إضافة بطاقة
        <kbd className="sidebar__kbd" aria-hidden="true">
          N
        </kbd>
      </button>

      <nav className="sidebar-nav" aria-label="التنقل الرئيسي">
        <p className="sidebar__label">القائمة</p>
        <ul role="list">
          {NAV_ITEMS.map((item) => (
            <li key={item.section}>
              <Link
                className="sidebar-nav__link"
                to={item.to}
                aria-current={item.section === section ? 'page' : undefined}
                onClick={onNavigate}
              >
                <Icon name={item.icon} size={18} />
                <span className="sidebar-nav__label">{item.label}</span>
                {item.section === 'today' && dueCount > 0 && (
                  <span className="sidebar-nav__count" aria-label={`${dueCount} للمراجعة`}>
                    {String(dueCount).padStart(2, '0')}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <footer className="sidebar__footer">
        <ul className="sidebar__links" role="list">
          <li>
            <Link className="sidebar__link" to="/about" onClick={onNavigate}>
              <Icon name="info" size={16} />
              ما هو رسوخ؟
            </Link>
          </li>
          <li>
            {AUTHOR_SITE_URL ? (
              <a className="sidebar__link" href={AUTHOR_SITE_URL} target="_blank" rel="noopener noreferrer">
                <Icon name="heart" size={16} />
                ادعيلي دعوة حلوة
              </a>
            ) : (
              <span className="sidebar__link is-pending">
                <Icon name="heart" size={16} />
                ادعيلي دعوة حلوة
                <span className="app-footer__soon">قريبًا</span>
              </span>
            )}
          </li>
          <li>
            <button type="button" className="sidebar__link sidebar__link--quiet" onClick={() => void signOut()}>
              <Icon name="signOut" size={16} />
              {mode === 'demo' ? 'الخروج من الوضع التجريبي' : 'تسجيل الخروج'}
            </button>
          </li>
        </ul>
        <p className="sidebar__copyright">رسوخ · {new Date().getFullYear()}</p>
      </footer>
    </aside>
  );
}

/** Phones: a slim bar with the menu button, the brand, and quick add. */
function MobileBar({ menuOpen, sidebarId, onToggleMenu }: { menuOpen: boolean; sidebarId: string; onToggleMenu: () => void }) {
  const openDialog = useUiStore((state) => state.openDialog);
  return (
    <header className="mobile-bar">
      <button
        type="button"
        className="icon-btn mobile-bar__menu"
        aria-label={menuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
        aria-expanded={menuOpen}
        aria-controls={sidebarId}
        onClick={onToggleMenu}
      >
        <Icon name={menuOpen ? 'close' : 'menu'} />
      </button>
      <Link className="brand" to="/">
        <BrandMark />
        <span className="brand__name">رسوخ</span>
      </Link>
      <button type="button" className="btn btn--primary mobile-bar__add" aria-label="إضافة بطاقة" onClick={() => openDialog({ kind: 'create-card' })}>
        <Icon name="plus" size={20} />
      </button>
    </header>
  );
}

/** Signed-in shell: sidebar (a drawer on phones), page, global shortcuts. */
export function AppLayout({ children }: { children?: ReactNode }) {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);
  const sidebarId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const page = getPageKey(pathname);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useGlobalShortcuts();
  useVacationExpiry(useToday());

  // Page-level styling hooks (e.g. review focus mode) key off <body data-page>.
  useEffect(() => {
    document.body.dataset.page = page;
    return () => {
      delete document.body.dataset.page;
    };
  }, [page]);

  // On navigation, start at the top and move focus to the new content.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  // The drawer closes with Escape, and the page behind it doesn't scroll.
  useEffect(() => {
    if (!menuOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    document.body.classList.add('has-open-drawer');
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.classList.remove('has-open-drawer');
    };
  }, [menuOpen]);

  return (
    <div className={`app-shell${menuOpen ? ' is-menu-open' : ''}`}>
      <MobileBar menuOpen={menuOpen} sidebarId={sidebarId} onToggleMenu={() => setMenuOpen((open) => !open)} />
      <Sidebar section={getSection(page)} id={sidebarId} onNavigate={closeMenu} />
      {menuOpen && <div className="drawer-backdrop" aria-hidden="true" onClick={closeMenu} />}
      <main className="app-main" ref={mainRef} tabIndex={-1}>
        {children ?? <Outlet />}
      </main>
    </div>
  );
}

/** Shell for public pages (e.g. About) when nobody is signed in. */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="public-shell">
      <header className="public-header">
        <Link className="brand" to="/login" aria-label="رسوخ — تسجيل الدخول">
          <BrandMark />
          <span className="brand__name">رسوخ</span>
        </Link>
        <ThemeToggle />
      </header>
      <main className="public-main" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </div>
  );
}

/** A page anyone can open: inside the app shell when signed in, the public shell otherwise. */
export function OpenToAll({ children }: { children: ReactNode }) {
  const signedIn = useAppStore((state) => Boolean(state.user));
  return signedIn ? <AppLayout>{children}</AppLayout> : <PublicShell>{children}</PublicShell>;
}

/* ---------- Session guards ---------- */

/** Shown while a saved session is checked or the user's data is loading. */
function SessionLoading() {
  return (
    <div className="session-screen" role="status">
      <BrandMark />
      <p>جارٍ تجهيز مراجعتك…</p>
    </div>
  );
}

function SessionError({ message }: { message: string }) {
  return (
    <div className="session-screen" role="alert">
      <BrandMark />
      <p>{message}</p>
      <p className="session-screen__hint">تأكد من اتصالك بالإنترنت، ثم حاول مرة أخرى.</p>
      <div className="session-screen__actions">
        <button type="button" className="btn btn--primary" onClick={() => void retryLoad()}>
          إعادة المحاولة
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => void endAccountSession()}>
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
}

/** Signed-out visitors go to sign-in, and return to this page afterwards. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const user = useAppStore((state) => state.user);
  const phase = useSessionStore((state) => state.phase);
  const error = useSessionStore((state) => state.error);
  const location = useLocation();

  if (user) return children;
  if (phase === 'starting' || phase === 'loading') return <SessionLoading />;
  if (phase === 'error') return <SessionError message={error ?? 'تعذّر تحميل بياناتك.'} />;
  return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
}

/** Once signed in, leave the auth pages for the page originally requested (or home). */
export function PublicOnly({ children }: { children: ReactNode }) {
  const user = useAppStore((state) => state.user);
  const phase = useSessionStore((state) => state.phase);
  const location = useLocation();

  if (user) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? '/'} replace />;
  }
  // Wait for a saved session before showing the sign-in form.
  if (phase === 'starting' || phase === 'loading') return <SessionLoading />;
  return children;
}
