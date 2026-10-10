/*
 * First steps: how shelves, projects and cards fit together, as three
 * numbered steps side by side (a shelf holds projects, a project holds
 * cards). Shown to new accounts before their first project, and in the guide.
 */
import { Link } from 'react-router';
import { useUiStore } from '../store/ui-store';
import { Icon, type IconName } from './Icon';

const STEPS: { icon: IconName; name: string; text: string }[] = [
  { icon: 'shelf', name: 'أنشئ رفًا', text: 'يجمع مشاريع متشابهة، مثل «كتب» أو «الفصل الأول».' },
  { icon: 'projects', name: 'أضف مشروعًا', text: 'لكل كتاب أو مادة أو كورس مشروع، بلونه ونوعه.' },
  { icon: 'cards', name: 'اكتب بطاقاتك', text: 'كل بطاقة معلومة واحدة تراجعها في موعدها حتى تترسّخ.' },
];

/** Shelf → project → card, as numbered steps. */
export function StartSteps() {
  return (
    <ol className="start-steps" aria-label="ابدأ في ثلاث خطوات">
      {STEPS.map((step, index) => (
        <li key={step.name} className="start-steps__step">
          <span className="start-steps__head">
            <span className="start-steps__number" aria-hidden="true">
              {index + 1}
            </span>
            <Icon name={step.icon} size={18} />
          </span>
          <strong className="start-steps__name">{step.name}</strong>
          <span className="start-steps__text">{step.text}</span>
        </li>
      ))}
    </ol>
  );
}

/** Before the first project: the three steps, and the first one. */
export function WelcomeStart() {
  const openDialog = useUiStore((state) => state.openDialog);

  return (
    <section className="welcome" aria-labelledby="welcome-title">
      <p className="page-eyebrow">أهلًا بك في رسوخ</p>
      <h1 className="welcome__title" id="welcome-title">
        ابدأ في ثلاث خطوات
      </h1>
      <p className="welcome__lead">
        رسوخ يرتّب ما تتعلمه في ثلاث طبقات: <strong>رفوف</strong> فيها <strong>مشاريع</strong>، وفي كل مشروع <strong>بطاقات</strong>.
      </p>

      <StartSteps />

      <div className="welcome__actions">
        <button type="button" className="btn btn--primary btn--lg" onClick={() => openDialog({ kind: 'create-shelf' })}>
          <Icon name="shelf" size={18} />
          أنشئ أول رف
        </button>
        <button type="button" className="btn btn--secondary btn--lg" onClick={() => openDialog({ kind: 'create-project' })}>
          <Icon name="plus" size={18} />
          أو ابدأ بمشروع
        </button>
        <Link className="welcome__guide" to="/guide">
          <Icon name="book" size={16} />
          اقرأ طريقة الاستخدام
        </Link>
      </div>
    </section>
  );
}
