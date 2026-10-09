/*
 * First steps: how shelves, projects and cards fit together, drawn as nested
 * boxes (a shelf holds projects, a project holds cards). Shown to new
 * accounts before their first project, and in the guide.
 */
import { Link } from 'react-router';
import { useUiStore } from '../store/ui-store';
import { Icon, type IconName } from './Icon';

const PROJECTS = [
  { name: 'العادات الذرية', cards: ['ما قاعدة الدقيقتين؟', 'الهوية قبل الهدف'] },
  { name: 'فن التفكير الواضح', cards: ['ما انحياز التأكيد؟', 'تكلفة الفرصة'] },
];

const LAYERS: { icon: IconName; name: string; text: string }[] = [
  { icon: 'shelf', name: 'الرف', text: 'يجمع مشاريع متشابهة، مثل «كتب» أو «الفصل الأول». اختياري.' },
  { icon: 'projects', name: 'المشروع', text: 'كتاب أو مادة أو كورس واحد، بلونه ونوعه.' },
  { icon: 'cards', name: 'البطاقة', text: 'معلومة واحدة تراجعها في موعدها حتى تترسّخ.' },
];

/** A shelf holding projects, each holding cards. */
export function ShelfDiagram() {
  return (
    <figure className="shelf-diagram">
      <div className="shelf-diagram__shelf" role="img" aria-label="رف «كتب» فيه مشروعان، وفي كل مشروع بطاقات">
        <p className="shelf-diagram__label">
          <Icon name="shelf" size={16} />
          رف · كتب
        </p>
        <div className="shelf-diagram__projects">
          {PROJECTS.map((project) => (
            <div key={project.name} className="shelf-diagram__project">
              <p className="shelf-diagram__label">
                <Icon name="projects" size={14} />
                مشروع · {project.name}
              </p>
              <ul className="shelf-diagram__cards">
                {project.cards.map((card) => (
                  <li key={card}>
                    <Icon name="cards" size={12} />
                    {card}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <figcaption>
        <ol className="shelf-diagram__legend">
          {LAYERS.map((layer) => (
            <li key={layer.name}>
              <span className="shelf-diagram__legend-icon">
                <Icon name={layer.icon} size={16} />
              </span>
              <span>
                <strong>{layer.name}</strong>
                {layer.text}
              </span>
            </li>
          ))}
        </ol>
      </figcaption>
    </figure>
  );
}

/** Before the first project: what goes where, and the first step. */
export function WelcomeStart() {
  const openDialog = useUiStore((state) => state.openDialog);

  return (
    <section className="welcome" aria-labelledby="welcome-title">
      <p className="page-eyebrow">أهلًا بك في رسوخ</p>
      <h1 className="welcome__title" id="welcome-title">
        ابدأ أول مشروع لك
      </h1>
      <p className="welcome__lead">
        رسوخ يرتّب ما تتعلمه في ثلاث طبقات: <strong>رفوف</strong> فيها <strong>مشاريع</strong>، وفي كل مشروع <strong>بطاقات</strong>.
        ابدأ بمشروع واحد لكتاب تقرؤه أو مادة تدرسها، ثم أضف إليه بطاقاتك.
      </p>

      <ShelfDiagram />

      <div className="welcome__actions">
        <button type="button" className="btn btn--primary btn--lg" onClick={() => openDialog({ kind: 'create-project' })}>
          <Icon name="plus" size={18} />
          أنشئ أول مشروع
        </button>
        <button type="button" className="btn btn--secondary btn--lg" onClick={() => openDialog({ kind: 'create-shelf' })}>
          <Icon name="shelf" size={18} />
          أو ابدأ برف
        </button>
        <Link className="welcome__guide" to="/guide">
          <Icon name="book" size={16} />
          اقرأ طريقة الاستخدام
        </Link>
      </div>
    </section>
  );
}
