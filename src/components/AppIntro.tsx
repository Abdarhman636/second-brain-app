import { Link } from 'react-router';
import { BrandMark, Icon, type IconName } from './Icon';

// The method in three steps, in the order the user lives it.
const FEATURES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'edit',
    title: 'دوّن ونظّم ما تتعلمه',
    text: 'من كتاب أو محاضرة أو بودكاست: سؤال وجواب، أو تعريف، أو اقتباس، أو صورة. ورتّبها في رفوف ومشاريع لكل مادة.',
  },
  {
    icon: 'today',
    title: 'راجعه باستمرار',
    text: 'كل يوم نجهّز لك ما حان وقت مراجعته فقط، فتكفيك دقائق قليلة.',
  },
  {
    icon: 'flame',
    title: 'وتترسّخ معك',
    text: 'كلما تذكّرت بطاقة تباعدت مراجعتها، حتى تصير المعلومة جزءًا ثابتًا منك.',
  },
];

const SCHEDULE = ['اليوم', 'غدًا', 'بعد يومين', 'بعد أسبوع', 'بعد أسبوعين', 'كل شهر'];

/**
 * What Rusookh is, in a few lines, shown next to sign-in / sign-up, with a
 * clear link to the full guide (/guide).
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
        معرفةٌ تترسّخ معك
      </Heading>
      <p className="auth-intro__lead">
        نتعلم كل يوم، ثم ننسى أكثره خلال أيام. في رسوخ تدوّن ما تتعلمه في بطاقات قصيرة وتنظّمه، ثم نعيده إليك في الوقت المناسب، قبل أن
        تنساه بقليل، حتى يثبت في ذاكرتك.
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

      <Link className="auth-guide-link" to="/guide">
        <Icon name="book" size={20} />
        <span>
          <strong>جديد على رسوخ؟ اقرأ طريقة الاستخدام</strong>
          <small>دليل خطوة بخطوة: الرفوف، والبطاقات، والمراجعة اليومية.</small>
        </span>
        <Icon name="arrowLeft" size={18} />
      </Link>
    </section>
  );
}

