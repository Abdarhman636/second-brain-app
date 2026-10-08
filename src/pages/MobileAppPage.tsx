/*
 * The mobile app page. The native apps launch once Rusookh reaches
 * MOBILE_LAUNCH_USERS users (a live counter shows how close we are); until
 * then, step-by-step instructions to add the web app to the home screen,
 * where it opens full screen like an app (see public/manifest.webmanifest).
 */
import { useEffect, useState } from 'react';
import { Icon, type IconName } from '../components/Icon';
import { fetchUserCount } from '../data/payments';
import { useDocumentTitle } from '../hooks/use-document-title';
import { useUiStore } from '../store/ui-store';

const MOBILE_LAUNCH_USERS = 100;

type Platform = 'ios' | 'android';

/** The install prompt Chrome on Android offers (not in TypeScript's DOM types). */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function detectPlatform(): Platform | null {
  const agent = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(agent) || (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(agent)) return 'android';
  return null;
}

function isInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Counts up to the number once, for a bit of life. */
function useCountUp(target: number | null): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (time: number) => {
      const progress = Math.min(1, (time - start) / 900);
      setValue(Math.round(target * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return value;
}

function UserCounter() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    void fetchUserCount().then((result) => active && setCount(result));
    return () => {
      active = false;
    };
  }, []);
  const shown = useCountUp(count);
  if (count === null) return null;

  const reached = count >= MOBILE_LAUNCH_USERS;
  return (
    <section className="app-counter" aria-labelledby="app-counter-title">
      <h2 className="visually-hidden" id="app-counter-title">
        عدد المستخدمين
      </h2>
      <p className="app-counter__number" aria-live="polite">
        <span>{shown}</span>
        <small>/ {MOBILE_LAUNCH_USERS}</small>
      </p>
      <div className="app-counter__body">
        <p className="app-counter__label">{reached ? 'وصلنا إلى 100 مستخدم، شكرًا لكم!' : 'مستخدمًا في رسوخ حتى الآن'}</p>
        <span className="app-counter__bar" role="progressbar" aria-valuemin={0} aria-valuemax={MOBILE_LAUNCH_USERS} aria-valuenow={Math.min(count, MOBILE_LAUNCH_USERS)}>
          <span style={{ width: `${Math.min(100, (count / MOBILE_LAUNCH_USERS) * 100)}%` }} />
        </span>
        <p className="app-counter__note">
          {reached
            ? 'نعمل الآن على إطلاق التطبيق في آب ستور وجوجل بلاي.'
            : `عند ${MOBILE_LAUNCH_USERS} مستخدم نطلق التطبيق. شارك رسوخ مع زملائك لنصل أسرع.`}
        </p>
      </div>
    </section>
  );
}

/** "اضغط «إضافة»" with the English label for phones set to English. */
function Ui({ ar, en, icon }: { ar: string; en: string; icon?: IconName }) {
  return (
    <span className="ui-label">
      {icon && <Icon name={icon} size={15} />}«{ar}»
      <span className="ui-label__en" dir="ltr">
        ({en})
      </span>
    </span>
  );
}

const IOS_STEPS = [
  <>
    افتح رسوخ في متصفح <strong>Safari</strong>. إن كنت تقرأ هذه الصفحة في متصفح آخر، انسخ الرابط بالأسفل والصقه في Safari.
  </>,
  <>
    اضغط زر <Ui ar="المشاركة" en="Share" icon="share" /> في الشريط أسفل الشاشة (أو أعلاها في iPad).
  </>,
  <>
    مرّر القائمة للأسفل واختر <Ui ar="إضافة إلى الشاشة الرئيسية" en="Add to Home Screen" icon="addSquare" />. إن لم تجده، اضغط{' '}
    <Ui ar="تحرير الإجراءات" en="Edit Actions" /> وأضفه.
  </>,
  <>
    اضغط <Ui ar="إضافة" en="Add" /> أعلى الشاشة.
  </>,
  <>
    ستجد أيقونة رسوخ البرتقالية على الشاشة الرئيسية. افتحه منها، وسجّل دخولك مرة واحدة.
  </>,
];

const ANDROID_STEPS = [
  <>
    افتح رسوخ في متصفح <strong>Chrome</strong>.
  </>,
  <>
    اضغط زر القائمة <Ui ar="⋮" en="More" icon="moreVertical" /> أعلى الشاشة.
  </>,
  <>
    اختر <Ui ar="تثبيت التطبيق" en="Install app" /> أو <Ui ar="إضافة إلى الشاشة الرئيسية" en="Add to Home screen" icon="addSquare" />.
  </>,
  <>
    اضغط <Ui ar="تثبيت" en="Install" /> أو <Ui ar="إضافة" en="Add" /> للتأكيد.
  </>,
  <>
    ستجد أيقونة رسوخ على الشاشة الرئيسية أو في قائمة التطبيقات. افتحه منها، وسجّل دخولك مرة واحدة.
  </>,
];

export function MobileAppPage() {
  useDocumentTitle('تطبيق الجوال');
  const [platform, setPlatform] = useState<Platform>(() => detectPlatform() ?? 'ios');
  const [installed] = useState(isInstalled);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const showToast = useUiStore((state) => state.showToast);
  const siteUrl = window.location.origin;

  // Chrome on Android can install in one tap: keep its prompt for our button.
  useEffect(() => {
    const keep = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', keep);
    return () => window.removeEventListener('beforeinstallprompt', keep);
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') showToast('أُضيف رسوخ إلى الشاشة الرئيسية');
    setInstallPrompt(null);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(siteUrl);
      showToast('نُسخ الرابط، الصقه في Safari');
    } catch {
      showToast('تعذّر النسخ، انسخ الرابط يدويًا', 'error');
    }
  };

  const steps = platform === 'ios' ? IOS_STEPS : ANDROID_STEPS;

  return (
    <div className="page mobile-app">
      <header className="page-header">
        <div>
          <p className="page-eyebrow">تطبيق الجوال</p>
          <h1 className="page-title">رسوخ على جوالك</h1>
          <p className="mobile-app__lead">
            نعمل الآن على تطبيق رسوخ للآيفون والأندرويد، ونطلقه حين يصل عدد مستخدمي رسوخ إلى {MOBILE_LAUNCH_USERS}. وإلى ذلك الحين، أضف رسوخ
            إلى الشاشة الرئيسية في جوالك، فيفتح بلمسة واحدة وبملء الشاشة، تمامًا كالتطبيق.
          </p>
        </div>
      </header>

      <UserCounter />

      {installed ? (
        <p className="mobile-app__installed" role="status">
          <Icon name="check" size={18} />
          أنت تستخدم رسوخ من الشاشة الرئيسية. أحسنت!
        </p>
      ) : (
        <section className="install" aria-labelledby="install-title">
          <div className="install__head">
            <h2 className="install__title" id="install-title">
              أضف رسوخ إلى الشاشة الرئيسية
            </h2>
            <p className="install__time">دقيقة واحدة · مجانًا · بلا تحميل من المتجر</p>
          </div>

          {installPrompt && (
            <button type="button" className="btn btn--primary btn--lg" onClick={() => void install()}>
              <Icon name="addSquare" size={18} />
              أضف رسوخ الآن بلمسة واحدة
            </button>
          )}

          <div className="install__tabs" role="tablist" aria-label="نوع الجوال">
            {(
              [
                { id: 'ios', label: 'آيفون' },
                { id: 'android', label: 'أندرويد' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`install-tab-${tab.id}`}
                aria-selected={platform === tab.id}
                aria-controls="install-steps"
                className="install__tab"
                onClick={() => setPlatform(tab.id)}
              >
                <Icon name="phone" size={16} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="install__panel" role="tabpanel" id="install-steps" aria-labelledby={`install-tab-${platform}`}>
            <ol className="install__steps">
              {steps.map((step, index) => (
                <li key={index} className="install__step">
                  <span className="install__number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <p>{step}</p>
                </li>
              ))}
            </ol>

            <aside className="install__preview" aria-label="هكذا ستظهر الأيقونة">
              <img src="/icons/icon-192.png" alt="" width="72" height="72" />
              <span>رسوخ</span>
            </aside>
          </div>

          {platform === 'ios' && (
            <div className="install__link">
              <span dir="ltr">{siteUrl}</span>
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => void copyLink()}>
                <Icon name="copy" size={14} />
                نسخ الرابط
              </button>
            </div>
          )}
          {platform === 'android' && (
            <p className="install__hint">
              تستخدم متصفح سامسونج؟ اضغط <Ui ar="القائمة" en="Menu" /> ثم <Ui ar="إضافة صفحة إلى" en="Add page to" /> ثم{' '}
              <Ui ar="الشاشة الرئيسية" en="Home screen" />.
            </p>
          )}
        </section>
      )}

      <ul className="mobile-app__perks" role="list">
        <li>
          <Icon name="phone" size={18} />
          يفتح بلمسة من الشاشة الرئيسية، بلا شريط المتصفح.
        </li>
        <li>
          <Icon name="flame" size={18} />
          سلسلتك وبطاقاتك هي نفسها على الجوال والكمبيوتر.
        </li>
        <li>
          <Icon name="check" size={18} />
          حين يصدر التطبيق، تدخل بنفس حسابك ويبقى كل شيء كما هو.
        </li>
      </ul>
    </div>
  );
}
