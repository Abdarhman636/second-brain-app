/*
 * Settings: account, appearance, vacation mode, data export, shortcuts.
 * Each section is a row: what it is on one side, its controls on the other.
 */
import { useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from '../components/Icon';
import { signOut, updateDailyLimit, updateName } from '../data/session';
import { formatLongDate, formatRelativeDate } from '../domain/date-utils';
import { formatCount, getInitial } from '../domain/format';
import { CARDS_PER_MINUTE, DAILY_LIMIT_OPTIONS, DEFAULT_DAILY_LIMIT } from '../domain/review-scheduler';
import type { DailyLimit } from '../domain/types';
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
        <AppearanceSection />
        <DailyLimitSection />
        <VacationSection />
        <DataSection />
        <ShortcutsSection />
      </div>
    </div>
  );
}
