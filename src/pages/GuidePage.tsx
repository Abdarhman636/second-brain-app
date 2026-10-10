/*
 * "طريقة استخدام رسوخ": a step-by-step guide to the whole app, open to
 * everyone (linked from sign-in, sign-up, the sidebar and the footer).
 * Button names here match the app's labels exactly.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Icon, type IconName } from '../components/Icon';
import { StartSteps } from '../components/Welcome';
import { useDocumentTitle } from '../hooks/use-document-title';
import { useAppStore } from '../store/app-store';

interface Section {
  id: string;
  icon: IconName;
  title: string;
  body: ReactNode;
}

const SCHEDULE = [
  { step: '1', when: 'اليوم', note: 'يوم إضافتها' },
  { step: '2', when: 'غدًا', note: '' },
  { step: '3', when: 'بعد يومين', note: '' },
  { step: '4', when: 'بعد أسبوع', note: '' },
  { step: '5', when: 'بعد أسبوعين', note: '' },
  { step: '6', when: 'بعد شهر', note: 'ثم كل شهر' },
];

const CARD_TYPES: { name: string; shown: string; hidden: string; example: string }[] = [
  { name: 'سؤال وجواب', shown: 'السؤال', hidden: 'الجواب', example: 'ما المراحل الخمس للتفكير التصميمي؟' },
  { name: 'تعريف', shown: 'المصطلح', hidden: 'التعريف', example: 'التكرار المتباعد' },
  { name: 'اقتباس', shown: 'بداية الاقتباس', hidden: 'بقيته', example: '«أنت لا ترتقي إلى مستوى أهدافك…»' },
  { name: 'صورة', shown: 'العنوان', hidden: 'الصورة', example: 'خريطة الدورة الدموية' },
  { name: 'ملاحظة', shown: 'النص كله', hidden: 'لا شيء', example: 'فكرة تريد تذكّرها كما هي' },
];

const SHORTCUTS = [
  { keys: 'N', action: 'إضافة بطاقة من أي صفحة' },
  { keys: 'مسافة', action: 'إظهار الجزء المخفي أثناء المراجعة' },
  { keys: '→', action: 'تذكرتها' },
  { keys: '←', action: 'لم أتذكرها' },
  { keys: '⌘ / Ctrl + Enter', action: 'حفظ البطاقة' },
  { keys: 'Esc', action: 'إغلاق النوافذ والقوائم' },
];

const SECTIONS: Section[] = [
  {
    id: 'idea',
    icon: 'flame',
    title: 'الفكرة في دقيقة',
    body: (
      <>
        <p>
          ننسى معظم ما نتعلمه خلال أيام إن لم نرجع إليه. والحل ليس أن تذاكر أكثر، بل أن تراجع <strong>في الوقت المناسب</strong>: قبل أن
          تنسى بقليل. هذا ما يسمى <strong>التكرار المتباعد</strong>.
        </p>
        <p>
          في رسوخ تكتب ما تتعلمه في بطاقات قصيرة، ونحن نعيد إليك كل بطاقة في موعدها. كلما تذكرتها تباعدت مواعيدها، حتى تثبت المعلومة في
          ذاكرتك طويلة المدى.
        </p>
      </>
    ),
  },
  {
    id: 'start',
    icon: 'check',
    title: 'ابدأ في ثلاث خطوات',
    body: (
      <ol className="guide-steps">
        <li>
          <strong>أنشئ حسابك</strong> من صفحة «إنشاء حساب»، وأكّد بريدك من الرسالة التي تصلك. إن كنت طالبًا، سجّل بإيميل جامعتك لتحصل على
          سعر الطالب لاحقًا. ويمكنك قبل ذلك أن تضغط «جرّب التطبيق بدون حساب» لتتعرف عليه ببيانات تجريبية.
        </li>
        <li>
          <strong>أنشئ مشروعًا</strong> لكل كتاب أو مادة أو كورس من صفحة «الرفوف والمشاريع» ← «مشروع جديد».
        </li>
        <li>
          <strong>أضف بطاقاتك</strong> بزر «إضافة بطاقة» البرتقالي، ثم ارجع كل يوم إلى صفحة «اليوم» واضغط «ابدأ المراجعة».
        </li>
      </ol>
    ),
  },
  {
    id: 'organize',
    icon: 'shelf',
    title: 'الرفوف والمشاريع',
    body: (
      <>
        <StartSteps />
        <p>
          <strong>المشروع</strong> يجمع بطاقات موضوع واحد: كتاب، أو مادة جامعية، أو بودكاست. ولكل مشروع لون ونوع تختارهما.
        </p>
        <p>
          <strong>الرف</strong> يجمع مشاريع متشابهة: رف «كتب» فيه مشروع لكل كتاب، أو رف «الفصل الأول» فيه مشروع لكل مادة. أنشئ رفًا من
          زر «رف جديد»، أو اختره وأنت تنشئ مشروعًا. وفي أعلى صفحة المشاريع تجد شريطًا تتنقل به بين رفوفك.
        </p>
        <ul className="guide-list">
          <li>
            <strong>الأرشفة</strong> (من قائمة ⋯ في صفحة المشروع): توقف مراجعات المشروع وتحفظ بطاقاته، مثلًا بعد انتهاء الفصل. ويمكنك
            إعادته في أي وقت.
          </li>
          <li>
            <strong>حذف الرف</strong> لا يحذف مشاريعه، بل تبقى «بدون رف».
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'cards',
    icon: 'cards',
    title: 'أنواع البطاقات',
    body: (
      <>
        <p>
          لكل بطاقة جزء ظاهر وجزء مخفي. أثناء المراجعة ترى الجزء الظاهر، وتحاول أن تتذكر المخفي قبل أن تكشفه. هذا التذكّر هو ما يثبّت
          المعلومة.
        </p>
        <div className="table-scroll">
          <table className="guide-table">
            <thead>
              <tr>
                <th>النوع</th>
                <th>تراه أولًا</th>
                <th>تتذكره</th>
                <th>مثال</th>
              </tr>
            </thead>
            <tbody>
              {CARD_TYPES.map((type) => (
                <tr key={type.name}>
                  <td>
                    <strong>{type.name}</strong>
                  </td>
                  <td>{type.shown}</td>
                  <td>{type.hidden}</td>
                  <td className="guide-table__example">{type.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          أضف بطاقة بزر «إضافة بطاقة» أو بالضغط على حرف <kbd>N</kbd> من أي صفحة. وتجد كل بطاقاتك في صفحة «البطاقات»، مع بحث يتجاهل
          التشكيل والهمزات.
        </p>
      </>
    ),
  },
  {
    id: 'review',
    icon: 'review',
    title: 'المراجعة اليومية',
    body: (
      <>
        <ol className="guide-steps">
          <li>
            افتح صفحة «اليوم» واضغط <strong>«ابدأ المراجعة»</strong>. نعرض عليك فقط ما حان موعده اليوم.
          </li>
          <li>
            اقرأ الجزء الظاهر وحاول أن تتذكر، ثم اضغط على البطاقة أو زر «إظهار…» أو مفتاح <kbd>مسافة</kbd>.
          </li>
          <li>
            قيّم نفسك بصدق: <strong>«تذكرتها»</strong> (أو <kbd>→</kbd>) إن تذكرتها، و<strong>«لم أتذكرها»</strong> (أو <kbd>←</kbd>) إن
            لم تتذكرها.
          </li>
        </ol>
        <p>هكذا تتباعد مواعيد البطاقة كلما تذكرتها:</p>
        <ol className="guide-schedule" aria-label="مواعيد المراجعة">
          {SCHEDULE.map((item) => (
            <li key={item.step}>
              <span className="guide-schedule__when">{item.when}</span>
              {item.note && <span className="guide-schedule__note">{item.note}</span>}
            </li>
          ))}
        </ol>
        <p>
          وإن لم تتذكرها، تعود إليك <strong>غدًا</strong> وترجع مرحلتين إلى الوراء. لا بأس في ذلك: النسيان جزء من التعلم، والمهم أن تكون
          صادقًا مع نفسك.
        </p>
        <p>
          <strong>الحد اليومي:</strong> لا نطلب منك أكثر من 30 بطاقة في اليوم (تغيّره من «الإعدادات»). ما يزيد يبقى مستحقًا ويأتي أولًا
          غدًا، ويمكنك دائمًا أن تراجع «دفعة إضافية».
        </p>
      </>
    ),
  },
  {
    id: 'project-review',
    icon: 'projects',
    title: 'مراجعة مشروع وحده',
    body: (
      <>
        <p>
          قبل اختبار مادة معينة مثلًا، افتح المشروع واضغط <strong>«راجع بطاقات المشروع»</strong>. نبدأ بالبطاقات المستحقة اليوم، ثم بقية
          بطاقات المشروع للتمرين.
        </p>
        <ul className="guide-list">
          <li>بطاقة تمرين تذكرتها: يبقى موعدها كما هو، فالمراجعة المبكرة لا تفسد جدولها.</li>
          <li>بطاقة تمرين نسيتها: تعود إلى مراجعة اليوم في الصفحة الرئيسية لتثبيتها.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'streak',
    icon: 'flame',
    title: 'السلسلة ووضع الإجازة',
    body: (
      <>
        <p>
          <strong>السلسلة</strong> عدد الأيام المتتالية التي أنهيت فيها مراجعة اليوم. الأيام التي ليس فيها ما يُراجع لا تكسرها.
        </p>
        <p>
          <strong>وضع الإجازة</strong>: إن احتجت راحة (سفر أو مرض)، اضغط «خذ إجازة» من خانة السلسلة أو من «الإعدادات». لن تنكسر سلسلتك،
          وعند عودتك نؤجل البطاقات التي استحقت أثناء غيابك حتى لا تجد كومة تنتظرك. تمتد الإجازة حتى 14 يومًا ثم تنتهي تلقائيًا.
        </p>
      </>
    ),
  },
  {
    id: 'reminder',
    icon: 'today',
    title: 'التذكير اليومي',
    body: (
      <>
        <p>
          نرسل لك رسالة على بريدك كل يوم الساعة 8 مساءً بتوقيتك، إن كان عندك بطاقات تنتظر المراجعة: «عندك 12 بطاقة تراجعها اليوم». إن راجعت
          قبلها، أو كنت في إجازة، فلا رسالة.
        </p>
        <p>
          أوقف التذكير أو شغّله من <strong>«الإعدادات»</strong>، أو أوقفه من رابط «إيقاف التذكير» أسفل أي رسالة.
        </p>
      </>
    ),
  },
  {
    id: 'share',
    icon: 'share',
    title: 'شارك مشاريعك',
    body: (
      <>
        <p>
          من صفحة المشروع اضغط <strong>«مشاركة»</strong> (أو «مشاركة الرف» من قائمة الرف)، ثم أرسل الرابط لأصدقائك. يرون البطاقات، وينسخونها
          إلى حساباتهم بضغطة ليراجعوها بأنفسهم، ثم يعدّلون نسختهم كما يريدون.
        </p>
        <ul>
          <li>الرابط يعرض آخر نسخة من بطاقاتك كلما فتحت «مشاركة».</li>
          <li>يظهر اسمك، ولا يظهر تقدّمك في المراجعة. بطاقات الصور لا تُشارك.</li>
          <li>النسخ يُحسب من حدود خطة من ينسخ.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'ai',
    icon: 'sparkle',
    title: 'البطاقات الذكية',
    body: (
      <>
        <p>
          في خطة راسخ، اضغط <strong>«بطاقات بالذكاء الاصطناعي»</strong> في صفحة المشروع، ثم الصق نصًا أو صوّر صفحة كتاب أو سبورة، واختر عدد
          البطاقات. نقترح عليك بطاقات جاهزة تراجعها وتعدّلها وتحذف ما لا تحتاجه قبل إضافتها.
        </p>
        <p>
          البطاقات المقترحة نقطة بداية جيدة، لكن <strong>مراجعتها بنفسك</strong> جزء من الفهم. لكل مشترك 300 بطاقة ذكية في الشهر.
        </p>
      </>
    ),
  },
  {
    id: 'tips',
    icon: 'edit',
    title: 'كيف تكتب بطاقة جيدة',
    body: (
      <ul className="guide-list">
        <li>
          <strong>فكرة واحدة لكل بطاقة.</strong> بطاقتان قصيرتان أفضل من بطاقة طويلة تتذكر نصفها.
        </li>
        <li>
          <strong>اكتب السؤال بحيث يُفهم وحده</strong>، دون أن تحتاج الكتاب أمامك.
        </li>
        <li>
          <strong>اجعل الجواب قصيرًا:</strong> جملة أو جملتين.
        </li>
        <li>
          <strong>بكلماتك أنت</strong>، لا بنسخ الفقرة كما هي. إعادة الصياغة نفسها مذاكرة.
        </li>
        <li>
          <strong>راجع كل يوم ولو قليلًا.</strong> عشر دقائق يومية أنفع من ساعتين في نهاية الأسبوع.
        </li>
      </ul>
    ),
  },
  {
    id: 'shortcuts',
    icon: 'keyboard',
    title: 'اختصارات لوحة المفاتيح',
    body: (
      <dl className="guide-shortcuts">
        {SHORTCUTS.map((shortcut) => (
          <div key={shortcut.action}>
            <dt>
              <kbd>{shortcut.keys}</kbd>
            </dt>
            <dd>{shortcut.action}</dd>
          </div>
        ))}
      </dl>
    ),
  },
  {
    id: 'more',
    icon: 'settings',
    title: 'أشياء أخرى مفيدة',
    body: (
      <ul className="guide-list">
        <li>
          <strong>على جوالك:</strong> أضف رسوخ إلى الشاشة الرئيسية ليفتح كالتطبيق. الخطوات في صفحة <Link to="/app">تطبيق الجوال</Link>.
        </li>
        <li>
          <strong>الوضع الداكن:</strong> من زر القمر أعلى القائمة، أو من «الإعدادات».
        </li>
        <li>
          <strong>بياناتك ملكك:</strong> نزّل نسخة منها في أي وقت من «الإعدادات» ← «تصدير بياناتي».
        </li>
        <li>
          <strong>الخطط:</strong> خطة بذرة مجانية (رف ومشروعان و20 بطاقة)، وللمزيد راجع <Link to="/pricing">الباقات والأسعار</Link>.
        </li>
      </ul>
    ),
  },
];

export function GuidePage() {
  useDocumentTitle('طريقة استخدام رسوخ');
  const signedIn = useAppStore((state) => Boolean(state.user));

  return (
    <div className="page guide">
      <header className="page-header">
        <div>
          <p className="page-eyebrow">دليل الاستخدام</p>
          <h1 className="page-title">طريقة استخدام رسوخ</h1>
          <p className="guide__lead">كل ما تحتاجه لتبدأ وتستفيد من رسوخ، خطوة بخطوة. يكفيك أن تقرأ أول قسمين لتبدأ، وارجع إلى البقية حين تحتاجها.</p>
        </div>
      </header>

      <div className="guide__layout">
        <nav className="guide__toc" aria-label="محتويات الدليل">
          <p className="guide__toc-title">المحتويات</p>
          <ol>
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.title}</a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="guide__sections">
          {SECTIONS.map((section, index) => (
            <section key={section.id} id={section.id} className="guide-section" aria-labelledby={`${section.id}-title`}>
              <h2 className="guide-section__title" id={`${section.id}-title`}>
                <span className="guide-section__number">{String(index + 1).padStart(2, '0')}</span>
                <Icon name={section.icon} size={20} />
                {section.title}
              </h2>
              <div className="guide-section__body">{section.body}</div>
            </section>
          ))}

          <div className="guide__actions">
            {signedIn ? (
              <Link className="btn btn--primary btn--lg" to="/">
                ابدأ مراجعة اليوم
              </Link>
            ) : (
              <>
                <Link className="btn btn--primary btn--lg" to="/signup">
                  أنشئ حسابك
                </Link>
                <Link className="btn btn--secondary btn--lg" to="/login">
                  تسجيل الدخول
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
