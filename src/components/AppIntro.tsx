import { BrandMark, Icon, type IconName } from './Icon';

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'projects', title: 'نظّم ما تتعلمه', text: 'من كتاب أو بودكاست أو كورس، في مشاريع وبطاقات قصيرة.' },
  { icon: 'today', title: 'راجع ما يستحق اليوم فقط', text: 'نختار لك البطاقات المستحقة، وأنت تراجع وتكمل يومك.' },
  { icon: 'flame', title: 'معرفة تبقى معك', text: 'كل مرة تتذكر فيها بطاقة تتباعد مراجعتها، حتى تصبح راسخة.' },
];

const SCHEDULE = ['اليوم', 'غدًا', 'بعد يومين', 'بعد أسبوع', 'بعد أسبوعين', 'كل شهر'];

/**
 * What Rusookh is, in a few lines. Shown next to sign-in / sign-up and on
 * the About page, so the explanation is the same everywhere.
 */
export function AppIntro({ headingLevel = 2 }: { headingLevel?: 1 | 2 }) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <section className="auth-intro" aria-labelledby="auth-intro-title">
      <span className="brand auth-intro__brand">
        <BrandMark />
        <span className="brand__name">رسوخ</span>
      </span>

      <Heading className="auth-intro__title" id="auth-intro-title">
        احفظ ما تتعلمه، ونعيده إليك في الوقت المناسب.
      </Heading>
      <p className="auth-intro__lead">
        نقرأ ونسمع ونتعلم كل يوم، ثم ننسى معظمه خلال أيام. رسوخ يحفظ المعلومات المهمة في بطاقات صغيرة، ويعيدها
        إليك على فترات متباعدة حتى تنتقل إلى ذاكرتك طويلة المدى.
      </p>

      <ul className="auth-features" role="list">
        {FEATURES.map((feature) => (
          <li key={feature.title} className="auth-feature">
            <span className="auth-feature__icon">
              <Icon name={feature.icon} size={18} />
            </span>
            <div>
              <p className="auth-feature__title">{feature.title}</p>
              <p className="auth-feature__text">{feature.text}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="auth-schedule">
        <p className="auth-schedule__label">متى تعود البطاقة إليك؟</p>
        <ol className="auth-schedule__steps" role="list">
          {SCHEDULE.map((step) => (
            <li key={step} className="auth-schedule__step">
              {step}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

