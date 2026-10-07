import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ActionMenu } from '../components/ActionMenu';
import { Icon } from '../components/Icon';
import { KnowledgeCard } from '../components/KnowledgeCard';
import { accentProps, EmptyState, ProjectBadge } from '../components/ui';
import { formatCount } from '../domain/format';
import { getProjectTypeLabel } from '../domain/project-types';
import { getProjectStats } from '../domain/projects';
import type { Shelf } from '../domain/types';
import { compareByReviewDate, isCardDue } from '../domain/review-scheduler';
import { useDocumentTitle } from '../hooks/use-document-title';
import { useToday } from '../hooks/use-today';
import { useAppStore } from '../store/app-store';
import { useUiStore } from '../store/ui-store';

/** المشاريع ‹ the project's shelf, as a way back. */
function BackLink({ shelf }: { shelf?: Shelf | undefined }) {
  return (
    <nav className="breadcrumb" aria-label="مسار الصفحة">
      <Link className="back-link" to="/projects">
        <Icon name="arrowRight" size={18} />
        المشاريع
      </Link>
      {shelf && (
        <>
          <span className="breadcrumb__separator" aria-hidden="true">
            /
          </span>
          <Link className="back-link" to={`/projects?shelf=${shelf.id}`}>
            <Icon name="shelf" size={16} />
            {shelf.name}
          </Link>
        </>
      )}
    </nav>
  );
}

export function ProjectDetailsPage() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const today = useToday();
  const project = useAppStore((state) => state.projects.find((item) => item.id === projectId));
  const allCards = useAppStore((state) => state.cards);
  const shelf = useAppStore((state) => state.shelves.find((item) => item.id === project?.shelfId));
  const { setProjectArchived, deleteProject } = useAppStore.getState();
  const { openDialog, confirm, showToast } = useUiStore.getState();
  useDocumentTitle(project?.name ?? 'مشروع');

  const cards = useMemo(
    () => allCards.filter((card) => card.projectId === projectId).sort(compareByReviewDate),
    [allCards, projectId],
  );

  if (!project) {
    return (
      <div className="page">
        <BackLink />
        <EmptyState
          icon="projects"
          title="لم نجد هذا المشروع"
          message="ربما حُذف أو تغيّر الرابط."
          actions={[{ label: 'استعراض المشاريع', to: '/projects' }]}
          headingLevel={1}
        />
      </div>
    );
  }

  const { cardCount, dueCount } = getProjectStats(project, allCards, today);

  const toggleArchive = () => {
    setProjectArchived(project.id, !project.archived);
    showToast(project.archived ? 'عاد المشروع، وعادت مراجعاته' : 'أُرشف المشروع، وتوقفت مراجعاته');
  };

  const remove = async () => {
    const confirmed = await confirm({
      title: 'حذف المشروع؟',
      message: cardCount
        ? `سيتم حذف «${project.name}» و${formatCount(cardCount, 'cards')} نهائيًا. إن أردت إيقاف مراجعاته فقط، استخدم الأرشفة.`
        : `سيتم حذف «${project.name}» نهائيًا.`,
      confirmLabel: 'حذف المشروع',
    });
    if (!confirmed) return;
    deleteProject(project.id);
    navigate('/projects');
    showToast(`حُذف مشروع «${project.name}»`);
  };

  return (
    <div className="page" {...accentProps(project)}>
      <BackLink shelf={shelf} />

      <header className="project-hero">
        <div className="project-hero__top">
          <div className="project-hero__identity">
            <ProjectBadge project={project} size="lg" />
            <div>
              <p className="type-tag">{getProjectTypeLabel(project)}</p>
              <h1 className="project-hero__title">{project.name}</h1>
            </div>
          </div>
          <ActionMenu
            label="خيارات المشروع"
            items={[
              { label: 'تعديل المشروع', icon: 'edit', onSelect: () => openDialog({ kind: 'edit-project', projectId: project.id }) },
              project.archived
                ? { label: 'إلغاء الأرشفة', icon: 'unarchive', onSelect: toggleArchive }
                : { label: 'أرشفة المشروع', icon: 'archive', onSelect: toggleArchive },
              { label: 'حذف المشروع', icon: 'trash', onSelect: remove, danger: true },
            ]}
          />
        </div>

        <p className="project-hero__meta">
          {formatCount(cardCount, 'cards')}
          {dueCount > 0 && ` · ${dueCount} للمراجعة اليوم`}
        </p>

        {project.archived ? (
          <div className="archived-banner" role="status">
            <Icon name="archive" size={18} />
            <p>هذا المشروع مؤرشف، ومراجعات بطاقاته متوقفة.</p>
            <button type="button" className="btn btn--secondary" onClick={toggleArchive}>
              إلغاء الأرشفة
            </button>
          </div>
        ) : (
          <div className="project-hero__actions">
            {cardCount > 0 && (
              <Link className="btn btn--primary" to={`/projects/${project.id}/review`}>
                <Icon name="review" size={18} />
                راجع بطاقات المشروع
              </Link>
            )}
            <button
              type="button"
              className={`btn ${cardCount > 0 ? 'btn--secondary' : 'btn--primary'}`}
              onClick={() => openDialog({ kind: 'create-card', projectId: project.id })}
            >
              <Icon name="plus" size={18} />
              إضافة بطاقة
            </button>
            {cardCount > 0 && (
              <p className="project-hero__hint">
                {dueCount > 0
                  ? `تبدأ بالمستحق اليوم (${dueCount})، ثم بقية البطاقات للتمرين. ما لا تتذكره يعود إلى مراجعة اليوم.`
                  : 'لا شيء مستحق اليوم، فالمراجعة هنا تمرين: ما تتذكره لا يتغير موعده، وما لا تتذكره يعود إلى مراجعة اليوم.'}
              </p>
            )}
          </div>
        )}
      </header>

      {cards.length ? (
        <section aria-labelledby="project-cards-heading">
          <h2 className="visually-hidden" id="project-cards-heading">
            بطاقات المشروع
          </h2>
          <ul className="card-list" role="list">
            {cards.map((card) => (
              <li key={card.id}>
                <KnowledgeCard card={card} project={project} today={today} due={!project.archived && isCardDue(card, today)} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <EmptyState
          icon="cardPlus"
          title="هذا المشروع فارغ"
          message="أضف أول بطاقة وابدأ بحفظ ما تتعلمه."
          actions={project.archived ? [] : [{ label: 'إضافة بطاقة', onClick: () => openDialog({ kind: 'create-card', projectId: project.id }) }]}
        />
      )}
    </div>
  );
}
