/*
 * Settings: account, appearance, vacation mode, data export, shortcuts.
 * Each section is a row: what it is on one side, its controls on the other.
 */
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { Icon } from '../components/Icon';
import { requestEmailChange, signOut, updateDailyLimit, updateIsStudent, updateName } from '../data/session';
import { formatLongDate, formatRelativeDate, formatShortDate, toISODate } from '../domain/date-utils';
import { formatCount, getInitial } from '../domain/format';
import { CARDS_PER_MINUTE, DAILY_LIMIT_OPTIONS, DEFAULT_DAILY_LIMIT } from '../domain/review-scheduler';
import type { DailyLimit } from '../domain/types';
import { getDaysUntilExpiry, PLANS, RESOURCE_LABELS } from '../domain/plans';
import { ACADEMIC_EMAIL_EXAMPLE, isAcademicEmail, isStudentDiscountEligible } from '../domain/students';
import { getActiveVacation, getVacationDaysLeft, MAX_VACATION_DAYS } from '../domain/vacation';
import { useDocumentTitle } from '../hooks/use-document-title';
import { useToday } from '../hooks/use-today';
import { useVacationActions } from '../hooks/use-vacation-actions';
import type { Theme } from '../lib/theme-storage';
import { useAppStore } from '../store/app-store';
import { useUiStore } from '../store/ui-store';

const NAME_MAX_LENGTH = 60;

function SettingsSection({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section className="settings-section" aria-labelledby={id}>
      <div className="settings-section__intro">
        <h2 className="settings-section__title" id={id}>
          {title}
        </h2>
        <p className="settings-section__description">{description}</p>
      </div>
      <div className="settings-section__body">{children}</div>
    </section>
  );
}

function AccountSection() {
  const user = useAppStore((state) => state.user);
  const mode = useAppStore((state) => state.mode);
  const navigate = useNavigate();
  const showToast = useUiStore((state) => state.showToast);
  const [name, setName] = useState(user?.name ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!user) return null;
  const trimmed = name.trim();
  const changed = trimmed !== user.name;

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trimmed) return setError('اكتب اسمك');
    setSaving(true);
    const result = await updateName(trimmed);
    setSaving(false);
    if (result.error) return setError(result.error);
    showToast('حُفظ اسمك');
  };

  return (
    <SettingsSection
      id="settings-account"
      title="الحساب"
      description={mode === 'demo' ? 'أنت في الوضع التجريبي: التغييرات هنا لا تُحفظ.' : 'اسمك كما يظهر في التطبيق، والبريد الذي تدخل به.'}
    >
      <div className="settings-account">
        <span className="settings-account__avatar" aria-hidden="true">
          {getInitial(user.name)}
        </span>
        <div className="settings-account__body">
          <p className="settings-account__name">{user.name}</p>
          <p className="settings-account__email" dir={mode === 'demo' ? undefined : 'ltr'}>
            {mode === 'demo' ? 'وضع تجريبي' : user.email}
          </p>
        </div>
      </div>

      <form className="settings-inline-form" noValidate onSubmit={save}>
        <label className="field__label" htmlFor="settings-name">
          الاسم
        </label>
        <div className="settings-inline-form__row">
          <input
            className="input"
            id="settings-name"
            type="text"
            autoComplete="name"
            maxLength={NAME_MAX_LENGTH}
            value={name}
            aria-invalid={Boolean(error)}
            aria-describedby="settings-name-error"
            onChange={(event) => {
              setName(event.target.value);
              setError('');
            }}
          />
          <button type="submit" className="btn btn--dark" disabled={!changed || saving} aria-busy={saving}>
            حفظ
          </button>
        </div>
        <p className="field__error" id="settings-name-error" hidden={!error}>
          {error}
        </p>
      </form>

      <fieldset className="settings-inline-form">
        <legend className="field__label">هل أنت طالب؟</legend>
        <div className="auth-choices">
          {[
            { value: true, label: 'نعم، طالب' },
            { value: false, label: 'لا' },
          ].map((option) => (
            <label key={option.label} className="type-option">
              <input
                className="type-option__input"
                type="radio"
                name="settings-student"
                checked={user.isStudent === option.value}
                onChange={async () => {
                  const result = await updateIsStudent(option.value);
                  showToast(result.error ?? 'حُفظت إجابتك', result.error ? 'error' : 'success');
                }}
              />
              <span className="type-option__label">{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <StudentDiscount />

      <button
        type="button"
        className="btn btn--secondary settings-signout"
        onClick={async () => {
          await signOut();
          navigate('/login');
        }}
      >
        <Icon name="signOut" size={16} />
        {mode === 'demo' ? 'الخروج من الوضع التجريبي' : 'تسجيل الخروج'}
      </button>
    </SettingsSection>
  );
}

function PlanSection() {
  const user = useAppStore((state) => state.user);
  const mode = useAppStore((state) => state.mode);
  if (!user) return null;
  const plan = PLANS[user.plan];
  const { shelves, projects, cards } = plan.limits;

  return (
    <SettingsSection id="settings-plan" title="خطتك" description="ما تتيحه خطتك الحالية، وكيف ترتقي.">
      <div className="settings-status">
        <span className="settings-status__dot is-on" aria-hidden="true" />
        <p>
          <strong>{plan.name}</strong>
          {mode === 'demo'
            ? ' · الوضع التجريبي بلا حدود لتجرّب كل شيء'
            : shelves === null || projects === null || cards === null
              ? ' · رفوف ومشاريع وبطاقات بلا حدود'
              : ` · ${RESOURCE_LABELS.shelves.limitText(shelves)}، ${RESOURCE_LABELS.projects.limitText(projects)}، ${RESOURCE_LABELS.cards.limitText(cards)}`}
        </p>
      </div>
      {user.planExpiresAt && user.plan !== 'free' && (
        <p className="settings-hint">
          ساري حتى {formatShortDate(toISODate(new Date(user.planExpiresAt)))} · يتبقى {formatCount(getDaysUntilExpiry(user.planExpiresAt), 'dayCount')}. لا يتجدد
          تلقائيًا.
        </p>
      )}
      <div className="settings-actions">
        {user.plan !== 'free' ? (
          <Link className="btn btn--primary" to={`/checkout?plan=${user.plan}&period=year`}>
            جدّد اشتراكك
          </Link>
        ) : (
          mode === 'account' && (
            <Link className="btn btn--primary" to="/checkout">
              اشترك أو تابع طلبك
            </Link>
          )
        )}
        <Link className="btn btn--secondary" to="/pricing">
          <Icon name="gem" size={16} />
          الباقات والأسعار
        </Link>
      </div>
    </SettingsSection>
  );
}

/** Student price: on with a university email; otherwise, a way to switch to one. */
function StudentDiscount() {
  const user = useAppStore((state) => state.user);
  const mode = useAppStore((state) => state.mode);
  const showToast = useUiStore((state) => state.showToast);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!user || mode !== 'account' || !user.isStudent) return null;

  if (isStudentDiscountEligible(user)) {
    return (
      <p className="settings-student is-active">
        <Icon name="gem" size={16} />
        خصم الطلاب مفعّل لحسابك (إيميل جامعي).
      </p>
    );
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!isAcademicEmail(trimmed)) return setError(`اكتب إيميل جامعتك، مثل ${ACADEMIC_EMAIL_EXAMPLE}`);
    setBusy(true);
    const result = await requestEmailChange(trimmed);
    setBusy(false);
    if (result.error) return setError(result.error);
    setSentTo(trimmed);
    showToast('أرسلنا رابط تأكيد إلى إيميل الجامعة');
  };

  if (sentTo) {
    return (
      <p className="settings-student" role="status">
        <Icon name="check" size={16} />
        <span>
          أرسلنا رابط تأكيد إلى <span dir="ltr">{sentTo}</span>. افتحه لتأكيد التغيير، وقد يُطلب منك تأكيده من إيميلك الحالي أيضًا. بعدها
          يظهر لك سعر الطالب.
        </span>
      </p>
    );
  }

  return (
    <form className="settings-inline-form" noValidate onSubmit={submit}>
      <label className="field__label" htmlFor="settings-academic-email">
        خصم الطلاب: انقل حسابك إلى إيميل جامعتك
      </label>
      <div className="settings-inline-form__row">
        <input
          className="input"
          id="settings-academic-email"
          type="email"
          dir="ltr"
          autoComplete="email"
          placeholder={ACADEMIC_EMAIL_EXAMPLE}
          value={email}
          aria-invalid={Boolean(error)}
          aria-describedby="settings-academic-email-error"
          onChange={(event) => {
            setEmail(event.target.value);
            setError('');
          }}
        />
        <button type="submit" className="btn btn--dark" disabled={busy || !email.trim()} aria-busy={busy}>
          تأكيد
        </button>
      </div>
      <p className="field__error" id="settings-academic-email-error" hidden={!error}>
        {error}
      </p>
      <p className="settings-hint">ستسجّل الدخول بعدها بإيميل الجامعة، وتبقى كل بياناتك كما هي.</p>
    </form>
  );
}

const THEME_OPTIONS: { id: Theme; label: string; description: string }[] = [
  { id: 'light', label: 'فاتح', description: 'الوضع الافتراضي' },
  { id: 'dark', label: 'داكن', description: 'أريح للعين ليلًا' },
];

function AppearanceSection() {
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);

  return (
    <SettingsSection id="settings-appearance" title="المظهر" description="يُحفظ اختيارك على هذا الجهاز.">
      <div className="theme-choices" role="radiogroup" aria-labelledby="settings-appearance">
        {THEME_OPTIONS.map((option) => (
          <label key={option.id} className={`theme-choice theme-choice--${option.id}`}>
            <input
              className="theme-choice__input"
              type="radio"
              name="theme"
              value={option.id}
              checked={theme === option.id}
              onChange={() => setTheme(option.id)}
            />
            <span className="theme-choice__preview" aria-hidden="true">
              <span className="theme-choice__sidebar" />
              <span className="theme-choice__cell" />
              <span className="theme-choice__cell theme-choice__cell--accent" />
            </span>
            <span className="theme-choice__text">
              <span className="theme-choice__label">{option.label}</span>
              <span className="theme-choice__description">{option.description}</span>
            </span>
          </label>
        ))}
      </div>
    </SettingsSection>
  );
}

function VacationSection() {
  const today = useToday();
  const vacations = useAppStore((state) => state.vacations);
  const vacation = getActiveVacation(vacations);
  const { start, end } = useVacationActions(today);

  return (
    <SettingsSection
      id="settings-vacation"
      title="وضع الإجازة"
      description={`خلال الإجازة لا تنكسر سلسلتك، وعند العودة نؤجل البطاقات التي استحقت أثناء غيابك. تمتد حتى ${MAX_VACATION_DAYS} يومًا ثم تنتهي تلقائيًا.`}
    >
      <div className="settings-status">
        <span className={`settings-status__dot${vacation ? ' is-on' : ''}`} aria-hidden="true" />
        <p>
          {vacation
            ? `مفعّل ${vacation.start === today ? 'منذ اليوم' : formatRelativeDate(vacation.start, today)} (${formatLongDate(vacation.start)}) · يتبقى ${formatCount(getVacationDaysLeft(vacation, today), 'dayCount')}`
            : 'غير مفعّل'}
        </p>
      </div>
      {vacation ? (
        <button type="button" className="btn btn--dark" onClick={end}>
          إنهاء الإجازة
        </button>
      ) : (
        <button type="button" className="btn btn--secondary" onClick={() => void start()}>
          <Icon name="pause" size={16} />
          ابدأ إجازة
        </button>
      )}
    </SettingsSection>
  );
}

const limitLabel = (limit: DailyLimit) => (limit === null ? 'بلا حد' : String(limit));

function DailyLimitSection() {
  const limit = useAppStore((state) => (state.user ? state.user.dailyLimit : DEFAULT_DAILY_LIMIT));
  const showToast = useUiStore((state) => state.showToast);

  const choose = async (next: DailyLimit) => {
    if (next === limit) return;
    const result = await updateDailyLimit(next);
    showToast(result.error ?? (next === null ? 'ألغينا الحد اليومي' : `حدّك اليومي الآن ${next} بطاقة`), result.error ? 'error' : 'success');
  };

  return (
    <SettingsSection
      id="settings-limit"
      title="الحد اليومي للمراجعة"
      description="أقصى عدد من البطاقات نطلبه منك في اليوم. ما يزيد عنه يبقى مستحقًا ويأتي أولًا في اليوم التالي، ويمكنك دائمًا مراجعة دفعة إضافية."
    >
      <div className="limit-choices" role="radiogroup" aria-labelledby="settings-limit">
        {DAILY_LIMIT_OPTIONS.map((option) => (
          <label key={limitLabel(option)} className="limit-choice">
            <input
              className="limit-choice__input"
              type="radio"
              name="daily-limit"
              checked={option === limit}
              onChange={() => void choose(option)}
            />
            <span className="limit-choice__value">{limitLabel(option)}</span>
            <span className="limit-choice__note">
              {option === null ? 'كل المستحق' : `نحو ${formatCount(Math.ceil(option / CARDS_PER_MINUTE), 'minutes')}`}
            </span>
          </label>
        ))}
      </div>
      <p className="settings-hint">المقترح: {DEFAULT_DAILY_LIMIT} بطاقة، نحو 10 دقائق يوميًا.</p>
    </SettingsSection>
  );
}

function DataSection() {
  const mode = useAppStore((state) => state.mode);
  const showToast = useUiStore((state) => state.showToast);

  const exportData = () => {
    const { user, shelves, projects, cards, reviewLog, completedDays, vacations } = useAppStore.getState();
    const payload = {
      app: 'rusookh',
      version: 1,
      exportedAt: new Date().toISOString(),
      user: user && { name: user.name, email: user.email },
      shelves,
      projects,
      cards,
      reviewLog,
      completedDays,
      vacations,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: `rusookh-${new Date().toISOString().slice(0, 10)}.json` });
    link.click();
    URL.revokeObjectURL(url);
    showToast('جُهّز ملف بياناتك');
  };

  return (
    <SettingsSection
      id="settings-data"
      title="بياناتك"
      description={
        mode === 'demo'
          ? 'يمكنك تصدير البيانات التجريبية لترى شكل الملف.'
          : 'نزّل نسخة من رفوفك ومشاريعك وبطاقاتك وسجل مراجعاتك في ملف JSON.'
      }
    >
      <button type="button" className="btn btn--secondary" onClick={exportData}>
        <Icon name="download" size={16} />
        تصدير بياناتي
      </button>
      <p className="settings-hint">الصور تُضمَّن كروابط مؤقتة.</p>
    </SettingsSection>
  );
}

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['N'], label: 'إضافة بطاقة من أي صفحة' },
  { keys: ['مسافة'], label: 'إظهار الجزء المخفي أثناء المراجعة' },
  { keys: ['→'], label: 'تذكرتها' },
  { keys: ['←'], label: 'لم أتذكرها' },
  { keys: ['⌘ / Ctrl', 'Enter'], label: 'حفظ البطاقة في النموذج' },
  { keys: ['Esc'], label: 'إغلاق النوافذ والقوائم' },
];

function ShortcutsSection() {
  return (
    <SettingsSection id="settings-shortcuts" title="اختصارات لوحة المفاتيح" description="للتنقل والمراجعة أسرع.">
      <dl className="shortcut-list">
        {SHORTCUTS.map((shortcut) => (
          <div key={shortcut.label} className="shortcut-list__item">
            <dt>
              {shortcut.keys.map((key, index) => (
                <span key={key}>
                  {index > 0 && ' + '}
                  <kbd>{key}</kbd>
                </span>
              ))}
            </dt>
            <dd>{shortcut.label}</dd>
          </div>
        ))}
      </dl>
    </SettingsSection>
  );
}

export function SettingsPage() {
  useDocumentTitle('الإعدادات');

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="page-eyebrow">حسابك وتفضيلاتك</p>
          <h1 className="page-title">الإعدادات</h1>
        </div>
      </header>

      <div className="settings">
        <AccountSection />
        <PlanSection />
        <AppearanceSection />
        <DailyLimitSection />
        <VacationSection />
        <DataSection />
        <ShortcutsSection />
      </div>
    </div>
  );
}
