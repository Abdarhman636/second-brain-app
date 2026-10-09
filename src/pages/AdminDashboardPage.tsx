/*
 * Admin dashboard (ADMIN_PATH in config.ts): the app's numbers at a glance, the subscription
 * requests (#orders), every user with what matters about them, and changing
 * anyone's plan. The data comes from
 * admin-only database functions; this page only hides itself from others.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminOrders } from '../components/AdminOrders';
import { Icon, type IconName } from '../components/Icon';
import { Modal } from '../components/Modal';
import {
  AdminError,
  currentPlan,
  fetchAdminStats,
  fetchAdminUsers,
  setUserPlan,
  type AdminStats,
  type AdminUser,
} from '../data/admin';
import { listAllPaymentRequests } from '../data/payments';
import { formatRelativeDate, formatShortDate, toISODate } from '../domain/date-utils';
import { formatCount } from '../domain/format';
import type { PaymentRequest } from '../domain/payments';
import { PLAN_ORDER, PLANS, type PlanId } from '../domain/plans';
import { useDocumentTitle } from '../hooks/use-document-title';
import { useAppStore } from '../store/app-store';
import { useUiStore } from '../store/ui-store';

const formatNumber = (value: number) => value.toLocaleString('en');
const formatDate = (timestamp: string) => formatShortDate(toISODate(new Date(timestamp)));

/* ---------- Numbers ---------- */

function Tile({ icon, label, value, note, href }: { icon: IconName; label: string; value: string; note?: string; href?: string }) {
  const body = (
    <>
      <span className="admin-tile__label">
        <Icon name={icon} size={14} />
        {label}
      </span>
      <span className="admin-tile__value">{value}</span>
      {note && <span className="admin-tile__note">{note}</span>}
    </>
  );
  return href ? (
    <a className="admin-tile admin-tile--link" href={href}>
      {body}
    </a>
  ) : (
    <div className="admin-tile">{body}</div>
  );
}

function SignupsChart({ days }: { days: AdminStats['signupsByDay'] }) {
  const max = Math.max(1, ...days.map((day) => day.count));
  const total = days.reduce((sum, day) => sum + day.count, 0);
  return (
    <section className="admin-panel" aria-labelledby="admin-signups">
      <header className="admin-panel__head">
        <h2 id="admin-signups">التسجيلات</h2>
        <span className="admin-panel__meta">آخر 30 يومًا · {formatNumber(total)}</span>
      </header>
      <div className="admin-bars" role="img" aria-label={`تسجيلات آخر 30 يومًا: ${total}`}>
        {days.map((day) => (
          <span key={day.day} className="admin-bars__bar" title={`${formatShortDate(day.day)}: ${day.count}`}>
            <span style={{ height: `${(day.count / max) * 100}%` }} />
          </span>
        ))}
      </div>
      {days.length > 0 && (
        <div className="admin-bars__axis">
          <span>{formatShortDate(days[0]!.day)}</span>
          <span>اليوم</span>
        </div>
      )}
    </section>
  );
}

function PlanSplit({ stats }: { stats: AdminStats }) {
  const free = Math.max(0, stats.usersTotal - stats.planPlus - stats.planPro);
  const parts: { id: PlanId; count: number }[] = [
    { id: 'free', count: free },
    { id: 'plus', count: stats.planPlus },
    { id: 'pro', count: stats.planPro },
  ];
  const total = Math.max(1, free + stats.planPlus + stats.planPro);
  return (
    <section className="admin-panel" aria-labelledby="admin-plans">
      <header className="admin-panel__head">
        <h2 id="admin-plans">الخطط</h2>
        <span className="admin-panel__meta">
          {stats.expiring14d > 0 ? `${formatNumber(stats.expiring14d)} ينتهي اشتراكهم خلال أسبوعين` : 'لا اشتراكات تنتهي قريبًا'}
        </span>
      </header>
      <div className="admin-split" role="img" aria-label="توزيع الخطط">
        {parts.map((part) => (
          <span key={part.id} className={`admin-split__part is-${part.id}`} style={{ flexGrow: part.count }} />
        ))}
      </div>
      <ul className="admin-split__legend" role="list">
        {parts.map((part) => (
          <li key={part.id}>
            <span className={`admin-split__swatch is-${part.id}`} aria-hidden="true" />
            {PLANS[part.id].name}
            <strong>{formatNumber(part.count)}</strong>
            <span className="admin-split__share">{Math.round((part.count / total) * 100)}%</span>
          </li>
        ))}
      </ul>
      <p className="admin-panel__note">
        المؤسسون: {stats.foundersTaken} من {stats.founderSeats} · الطلاب: {formatNumber(stats.students)} (بإيميل جامعي{' '}
        {formatNumber(stats.academicEmails)})
      </p>
    </section>
  );
}

/* ---------- Changing a plan ---------- */

const addMonths = (months: number) => {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return toISODate(date);
};

function PlanDialog({ user, onClose, onSaved }: { user: AdminUser; onClose: () => void; onSaved: () => void }) {
  const showToast = useUiStore((state) => state.showToast);
  const plan = currentPlan(user);
  const [nextPlan, setNextPlan] = useState<PlanId>(plan === 'free' ? 'plus' : plan);
  const [until, setUntil] = useState(plan !== 'free' && user.expiresAt ? toISODate(new Date(user.expiresAt)) : addMonths(12));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      // The plan runs until the end of the chosen day.
      const expiresAt = nextPlan === 'free' ? null : new Date(`${until}T23:59:59`).toISOString();
      await setUserPlan(user.id, nextPlan, expiresAt);
      showToast(nextPlan === 'free' ? `أُعيد ${user.email} إلى خطة بذرة` : `فُعّلت خطة ${PLANS[nextPlan].name} لـ ${user.email}`);
      onSaved();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof AdminError ? saveError.message : 'تعذّر تغيير الخطة.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="تعديل الخطة" variant="compact" onClose={onClose}>
      <div className="form">
        <p className="form__lead" dir="auto">
          {user.name ?? 'بدون اسم'} · <span dir="ltr">{user.email}</span>
        </p>
        <fieldset className="field">
          <legend className="field__label">الخطة</legend>
          <div className="ai-compose__counts admin-plan-choices">
            {PLAN_ORDER.map((id) => (
              <label key={id} className="type-option">
                <input className="type-option__input" type="radio" name="admin-plan" checked={nextPlan === id} onChange={() => setNextPlan(id)} />
                <span className="type-option__label">{PLANS[id].name}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {nextPlan !== 'free' && (
          <div className="field">
            <label className="field__label" htmlFor="admin-plan-until">
              ساري حتى
            </label>
            <input
              className="input"
              id="admin-plan-until"
              type="date"
              min={toISODate(new Date())}
              value={until}
              onChange={(event) => setUntil(event.target.value)}
            />
            <div className="admin-quick-dates">
              {[1, 6, 12].map((months) => (
                <button key={months} type="button" className="link-button" onClick={() => setUntil(addMonths(months))}>
                  {months === 1 ? 'شهر' : months === 6 ? '6 أشهر' : '12 شهرًا'} من اليوم
                </button>
              ))}
            </div>
          </div>
        )}
        {error && (
          <p className="checkout-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-footer">
          <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void save()}>
            حفظ الخطة
          </button>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Users ---------- */

type Sort = 'newest' | 'active' | 'cards' | 'paid';
const SORTS: { id: Sort; label: string }[] = [
  { id: 'newest', label: 'الأحدث تسجيلًا' },
  { id: 'active', label: 'الأكثر نشاطًا' },
  { id: 'cards', label: 'الأكثر بطاقات' },
  { id: 'paid', label: 'الأكثر دفعًا' },
];

function UsersTable({ users, onEdit }: { users: AdminUser[]; onEdit: (user: AdminUser) => void }) {
  const [query, setQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<PlanId | 'all'>('all');
  const [sort, setSort] = useState<Sort>('newest');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = users.filter(
      (user) =>
        (planFilter === 'all' || currentPlan(user) === planFilter) &&
        (!q || user.email.toLowerCase().includes(q) || (user.name ?? '').toLowerCase().includes(q)),
    );
    const by: Record<Sort, (a: AdminUser, b: AdminUser) => number> = {
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
      active: (a, b) => b.reviews30d - a.reviews30d,
      cards: (a, b) => b.cards - a.cards,
      paid: (a, b) => b.paidTotal - a.paidTotal,
    };
    return [...filtered].sort(by[sort]);
  }, [users, query, planFilter, sort]);

  const today = toISODate(new Date());

  return (
    <section className="admin-users" aria-labelledby="admin-users-title">
      <header className="admin-panel__head">
        <h2 id="admin-users-title">المستخدمون</h2>
        <span className="admin-panel__meta">
          {formatNumber(shown.length)} من {formatNumber(users.length)}
        </span>
      </header>

      <div className="cards-toolbar admin-users__toolbar">
        <input
          className="input cards-toolbar__search"
          type="search"
          placeholder="ابحث بالاسم أو الإيميل…"
          aria-label="ابحث في المستخدمين"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select className="select" aria-label="الخطة" value={planFilter} onChange={(event) => setPlanFilter(event.target.value as PlanId | 'all')}>
          <option value="all">كل الخطط</option>
          {PLAN_ORDER.map((id) => (
            <option key={id} value={id}>
              {PLANS[id].name}
            </option>
          ))}
        </select>
        <select className="select" aria-label="الترتيب" value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
          {SORTS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              <th>المستخدم</th>
              <th>الخطة</th>
              <th>المحتوى</th>
              <th>النشاط</th>
              <th>الدفع</th>
              <th>
                <span className="visually-hidden">إجراءات</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((user) => {
              const plan = currentPlan(user);
              return (
                <tr key={user.id}>
                  <td>
                    <span className="admin-user__name">
                      {user.name ?? 'بدون اسم'}
                      {user.isAdmin && <span className="admin-tag">أدمن</span>}
                      {user.isStudent && <span className={`admin-tag${user.academicEmail ? ' is-on' : ''}`}>طالب</span>}
                      {user.founder && <span className="admin-tag is-on">مؤسس</span>}
                      {!user.confirmed && <span className="admin-tag is-warn">لم يؤكد</span>}
                    </span>
                    <span className="admin-user__email" dir="ltr">
                      {user.email}
                    </span>
                    <span className="admin-user__meta">انضم {formatDate(user.createdAt)}</span>
                  </td>
                  <td>
                    <span className={`admin-plan is-${plan}`}>{PLANS[plan].name}</span>
                    {plan !== 'free' && user.expiresAt && <span className="admin-user__meta">حتى {formatDate(user.expiresAt)}</span>}
                    {plan === 'free' && user.plan && <span className="admin-user__meta">انتهى اشتراكه</span>}
                  </td>
                  <td className="admin-num">
                    {formatCount(user.cards, 'cards')}
                    <span className="admin-user__meta">
                      {formatCount(user.projects, 'projects')} · {formatCount(user.shelves, 'shelves')}
                      {user.aiCardsMonth > 0 && ` · ${user.aiCardsMonth} ذكية هذا الشهر`}
                    </span>
                  </td>
                  <td className="admin-num">
                    {formatCount(user.reviews30d, 'reviews')} في 30 يومًا
                    <span className="admin-user__meta">
                      {user.lastReview ? `آخر مراجعة ${formatRelativeDate(user.lastReview, today)}` : 'لم يراجع بعد'}
                    </span>
                  </td>
                  <td className="admin-num">{user.paidTotal > 0 ? `${formatNumber(user.paidTotal)} ر.س` : '—'}</td>
                  <td>
                    <button type="button" className="btn btn--secondary btn--sm" onClick={() => onEdit(user)}>
                      تعديل الخطة
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!shown.length && <p className="page-loading">لا يوجد مستخدمون مطابقون.</p>}
    </section>
  );
}

/* ---------- Page ---------- */

export function AdminDashboardPage() {
  useDocumentTitle('لوحة التحكم');
  const isAdmin = useAppStore((state) => state.user?.isAdmin ?? false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [requests, setRequests] = useState<PaymentRequest[] | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<AdminUser | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const [nextStats, nextUsers, nextRequests] = await Promise.all([fetchAdminStats(), fetchAdminUsers(), listAllPaymentRequests()]);
      setStats(nextStats);
      setUsers(nextUsers);
      setRequests(nextRequests);
    } catch (loadError) {
      setError(loadError instanceof AdminError ? loadError.message : 'تعذّر تحميل لوحة التحكم.');
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  // Opened with #orders (e.g. from the new-request email): jump to the list once it's there.
  const loaded = Boolean(stats && users && requests);
  useEffect(() => {
    if (loaded && window.location.hash === '#orders') document.getElementById('orders')?.scrollIntoView();
  }, [loaded]);

  return (
    <div className="page admin-dashboard">
      <header className="page-header">
        <div>
          <p className="page-eyebrow">الإدارة</p>
          <h1 className="page-title">لوحة التحكم</h1>
        </div>
        <div className="page-header__actions">
          <a className="btn btn--secondary" href="#orders">
            <Icon name="receipt" size={16} />
            الطلبات
            {stats && stats.paymentsPending > 0 && <span className="admin-count">{stats.paymentsPending}</span>}
          </a>
          <button type="button" className="btn btn--secondary" onClick={() => void load()}>
            <Icon name="retry" size={16} />
            تحديث
          </button>
        </div>
      </header>

      {error && (
        <p className="checkout-error" role="alert">
          {error}
        </p>
      )}

      {!stats || !users || !requests ? (
        !error && <p className="page-loading">جارٍ التحميل…</p>
      ) : (
        <>
          <div className="admin-tiles">
            <Tile icon="today" label="المستخدمون" value={formatNumber(stats.usersTotal)} note={`+${stats.usersNew7d} هذا الأسبوع · +${stats.usersNew30d} هذا الشهر`} />
            <Tile
              icon="flame"
              label="نشطون (راجعوا)"
              value={formatNumber(stats.active7d)}
              note={`اليوم ${stats.activeToday} · آخر 30 يومًا ${stats.active30d}`}
            />
            <Tile icon="gem" label="المشتركون" value={formatNumber(stats.planPlus + stats.planPro)} note={`جذور ${stats.planPlus} · راسخ ${stats.planPro}`} />
            <Tile
              icon="check"
              label="الإيراد هذا الشهر"
              value={`${formatNumber(stats.revenueMonth)} ر.س`}
              note={`الإجمالي ${formatNumber(stats.revenueTotal)} ر.س`}
            />
            <Tile
              icon="info"
              label="طلبات تنتظرك"
              value={formatNumber(stats.paymentsPending)}
              note="اضغط للمراجعة"
              href="#orders"
            />
            <Tile
              icon="cards"
              label="البطاقات"
              value={formatNumber(stats.cards)}
              note={`${formatCount(stats.projects, 'projects')} · ${formatCount(stats.shelves, 'shelves')}`}
            />
            <Tile icon="review" label="المراجعات" value={formatNumber(stats.reviewsTotal)} note={`آخر 7 أيام ${formatNumber(stats.reviews7d)}`} />
            <Tile
              icon="sparkle"
              label="البطاقات الذكية هذا الشهر"
              value={formatNumber(stats.aiCardsMonth)}
              note={`من ${formatNumber(stats.aiCardsCap)} (الحد الشهري للتطبيق)`}
            />
          </div>

          <div className="admin-panels">
            <SignupsChart days={stats.signupsByDay} />
            <PlanSplit stats={stats} />
          </div>

          {stats.usersUnconfirmed > 0 && (
            <p className="admin-panel__note">لم يؤكد {formatNumber(stats.usersUnconfirmed)} شخص بريدهم بعد، ولا يُحسبون في المستخدمين.</p>
          )}

          <AdminOrders requests={requests} users={users} onChanged={() => void load()} />

          <UsersTable users={users} onEdit={setEditing} />
        </>
      )}

      {editing && <PlanDialog user={editing} onClose={() => setEditing(null)} onSaved={() => void load()} />}
    </div>
  );
}
