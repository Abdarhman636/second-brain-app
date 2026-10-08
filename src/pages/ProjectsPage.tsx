/*
 * Projects, on their shelves. The shelf bar filters to one shelf (kept in the
 * URL, ?shelf=<id> or ?shelf=none); "الكل" groups every shelf's projects.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ActionMenu } from '../components/ActionMenu';
import { padNumber } from '../components/dashboard';
import { Icon } from '../components/Icon';
import { accentProps, EmptyState, ProjectBadge } from '../components/ui';
import { formatCount } from '../domain/format';
import { getProjectTypeLabel } from '../domain/project-types';
import { getProjectStats, PROJECT_SORT_OPTIONS, sortProjects, type ProjectSort, type ProjectStats } from '../domain/projects';
import { groupByShelf, sortShelves } from '../domain/shelves';
import type { Project, Shelf } from '../domain/types';
import { useActiveCards } from '../hooks/use-app-data';
import { useDocumentTitle } from '../hooks/use-document-title';
import { useToday } from '../hooks/use-today';
import { useAppStore } from '../store/app-store';
import { useUiStore } from '../store/ui-store';

// Kept between visits so the chosen order sticks for the session.
let savedSort: ProjectSort = 'activity';

/** ?shelf=none shows the projects on no shelf. */
const NO_SHELF = 'none';

type Item = { project: Project; stats: ProjectStats };

function ProjectCard({ project, stats }: Item) {
  return (
    <article className={`project-card${project.archived ? ' is-archived' : ''}`} {...accentProps(project)}>
      <Link className="project-card__link" to={`/projects/${project.id}`}>
        <div className="project-card__visual">
          <span className="project-card__type">{getProjectTypeLabel(project)}</span>
          <ProjectBadge project={project} size="lg" />
        </div>
        <h2 className="project-card__name">{project.name}</h2>
        <dl className="project-card__stats">
          <div>
            <dt>بطاقات</dt>
            <dd>{padNumber(stats.cardCount)}</dd>
          </div>
          {project.archived ? (
            <div>
              <dt>الحالة</dt>
              <dd className="project-card__status">مؤرشف</dd>
            </div>
          ) : (
            <div className={stats.dueCount ? 'is-due' : ''}>
              <dt>للمراجعة اليوم</dt>
              <dd>{padNumber(stats.dueCount)}</dd>
            </div>
          )}
          <span className="project-card__arrow" aria-hidden="true">
            <Icon name="arrowLeft" size={18} />
          </span>
        </dl>
      </Link>
    </article>
  );
}

function ProjectGrid({ items }: { items: Item[] }) {
  return (
    <ul className="project-grid" role="list">
      {items.map(({ project, stats }) => (
        <li key={project.id}>
          <ProjectCard project={project} stats={stats} />
        </li>
      ))}
    </ul>
  );
}

/** Rename / delete, shared by the shelf's own view and its group in "الكل". */
function useShelfMenu(shelf: Shelf) {
  const navigate = useNavigate();
  const { openDialog, confirm, showToast } = useUiStore.getState();

  const remove = async () => {
    const count = useAppStore.getState().projects.filter((project) => project.shelfId === shelf.id).length;
    const confirmed = await confirm({
      title: 'حذف الرف؟',
      message: count
        ? `سيُحذف رف «${shelf.name}» فقط. مشاريعه (${formatCount(count, 'projects')}) وبطاقاتها تبقى كما هي، لكن بدون رف.`
        : `سيُحذف رف «${shelf.name}».`,
      confirmLabel: 'حذف الرف',
    });
    if (!confirmed) return;
    useAppStore.getState().deleteShelf(shelf.id);
    navigate('/projects', { replace: true });
    showToast(`حُذف رف «${shelf.name}»`);
  };

  return [
    { label: 'إعادة تسمية الرف', icon: 'edit' as const, onSelect: () => openDialog({ kind: 'rename-shelf', shelfId: shelf.id }) },
    { label: 'حذف الرف', icon: 'trash' as const, onSelect: () => void remove(), danger: true },
  ];
}

function ShelfMenu({ shelf }: { shelf: Shelf }) {
  return <ActionMenu label={`خيارات رف ${shelf.name}`} items={useShelfMenu(shelf)} />;
}

/** One shelf's projects, with its own header (in the "الكل" view). */
function ShelfGroup({ shelf, items }: { shelf: Shelf | null; items: Item[] }) {
  const openDialog = useUiStore((state) => state.openDialog);
  const headingId = `shelf-${shelf?.id ?? NO_SHELF}`;

  return (
    <section className="shelf-group" aria-labelledby={headingId}>
      <header className="shelf-group__header">
        <h2 className="shelf-group__title" id={headingId}>
          <Link to={`/projects?shelf=${shelf?.id ?? NO_SHELF}`}>
            <Icon name="shelf" size={18} />
            {shelf ? `رف ${shelf.name}` : 'بدون رف'}
          </Link>
        </h2>
        <span className="shelf-group__count">{formatCount(items.length, 'projects')}</span>
        {shelf && <ShelfMenu shelf={shelf} />}
      </header>
      {items.length ? (
        <ProjectGrid items={items} />
      ) : (
        <div className="shelf-group__empty">
          <p>هذا الرف فارغ.</p>
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => shelf && openDialog({ kind: 'create-project', shelfId: shelf.id })}>
            <Icon name="plus" size={16} />
            مشروع في هذا الرف
          </button>
        </div>
      )}
    </section>
  );
}

export function ProjectsPage() {
  useDocumentTitle('المشاريع');
  const today = useToday();
  const projects = useAppStore((state) => state.projects);
  const shelves = useAppStore((state) => state.shelves);
  const cards = useAppStore((state) => state.cards);
  const activeCards = useActiveCards();
  const openDialog = useUiStore((state) => state.openDialog);
  const [sort, setSort] = useState<ProjectSort>(savedSort);
  const [searchParams] = useSearchParams();

  const shelfParam = searchParams.get('shelf');
  const selectedShelf = shelves.find((shelf) => shelf.id === shelfParam) ?? null;
  // An unknown shelf id (e.g. a deleted shelf) falls back to "الكل".
  const filter: 'all' | 'none' | Shelf = selectedShelf ?? (shelfParam === NO_SHELF ? 'none' : 'all');

  const items = useMemo(() => {
    const withStats = projects.map((project) => ({ project, stats: getProjectStats(project, cards, today) }));
    return sortProjects(withStats, sort);
  }, [projects, cards, today, sort]);

  const active = items.filter(({ project }) => !project.archived);
  const groups = useMemo(() => groupByShelf(active, shelves), [active, shelves]);
  const looseCount = groups.find((group) => !group.shelf)?.items.length ?? 0;

  const inFilter = ({ project }: Item) =>
    filter === 'all' ? true : filter === 'none' ? !shelves.some((shelf) => shelf.id === project.shelfId) : project.shelfId === filter.id;
  const archived = items.filter((item) => item.project.archived && inFilter(item));
  const shelfMenu = selectedShelf ? <ShelfMenu shelf={selectedShelf} /> : null;

  if (!projects.length && !shelves.length) {
    return (
      <div className="page">
        <EmptyState
          icon="folderPlus"
          title="ابدأ أول مشروع لك"
          message="اجمع المعلومات التي تريد تذكرها، ونرتب لك مراجعتها مع الوقت."
          actions={[
            { label: 'إنشاء مشروع', onClick: () => openDialog({ kind: 'create-project' }) },
            { label: 'إنشاء رف', onClick: () => openDialog({ kind: 'create-shelf' }), variant: 'secondary' },
          ]}
          headingLevel={1}
        />
      </div>
    );
  }

  const visible = active.filter(inFilter);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">الرفوف والمشاريع</h1>
          <p className="page-subtitle">
            {formatCount(shelves.length, 'shelves')} · {formatCount(active.length, 'projects')} · {formatCount(activeCards.length, 'cards')}
          </p>
        </div>
        <div className="page-header__actions">
          <label className="sort-control">
            <span className="sort-control__label">ترتيب حسب</span>
            <select
              className="select select--compact"
              value={sort}
              onChange={(event) => {
                savedSort = event.target.value as ProjectSort;
                setSort(savedSort);
              }}
            >
              {PROJECT_SORT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn--secondary" onClick={() => openDialog({ kind: 'create-shelf' })}>
            <Icon name="shelf" size={18} />
            رف جديد
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => openDialog({ kind: 'create-project', ...(selectedShelf ? { shelfId: selectedShelf.id } : {}) })}
          >
            <Icon name="plus" size={18} />
            مشروع جديد
          </button>
        </div>
      </header>

      {shelves.length > 0 && (
        <nav className="shelf-bar" aria-label="الرفوف">
          <Link className="shelf-chip" to="/projects" aria-current={filter === 'all' ? 'page' : undefined}>
            الكل <span className="shelf-chip__count">{padNumber(active.length)}</span>
          </Link>
          {sortShelves(shelves).map((shelf) => (
            <Link key={shelf.id} className="shelf-chip" to={`/projects?shelf=${shelf.id}`} aria-current={selectedShelf?.id === shelf.id ? 'page' : undefined}>
              {shelf.name}
              <span className="shelf-chip__count">{padNumber(active.filter((item) => item.project.shelfId === shelf.id).length)}</span>
            </Link>
          ))}
          {looseCount > 0 && (
            <Link className="shelf-chip" to={`/projects?shelf=${NO_SHELF}`} aria-current={filter === 'none' ? 'page' : undefined}>
              بدون رف <span className="shelf-chip__count">{padNumber(looseCount)}</span>
            </Link>
          )}
          {shelfMenu && <span className="shelf-bar__menu">{shelfMenu}</span>}
        </nav>
      )}

      {filter === 'all' && shelves.length > 0 ? (
        <div className="shelf-groups">
          {groups.map((group) => (
            <ShelfGroup key={group.shelf?.id ?? NO_SHELF} shelf={group.shelf} items={group.items} />
          ))}
        </div>
      ) : visible.length ? (
        <ProjectGrid items={visible} />
      ) : selectedShelf ? (
        <EmptyState
          icon="shelf"
          title={`رف «${selectedShelf.name}» فارغ`}
          message="أنشئ مشروعًا في هذا الرف، أو انقل إليه مشروعًا من خيار «تعديل المشروع»."
          actions={[{ label: 'مشروع في هذا الرف', onClick: () => openDialog({ kind: 'create-project', shelfId: selectedShelf.id }) }]}
        />
      ) : active.length ? (
        <EmptyState icon="projects" title="كل مشاريعك على رفوف" message="لا توجد مشاريع بدون رف." />
      ) : (
        <EmptyState icon="projects" title="كل مشاريعك مؤرشفة" message="أعد مشروعًا من الأرشيف لتعود مراجعاته، أو أنشئ مشروعًا جديدًا." />
      )}

      {archived.length > 0 && (
        <details className="archived-section">
          <summary className="archived-section__summary">
            <Icon name="archive" size={18} />
            المشاريع المؤرشفة ({archived.length})
          </summary>
          <p className="archived-section__note">مراجعات هذه المشاريع متوقفة، وبطاقاتها محفوظة كما هي.</p>
          <ProjectGrid items={archived} />
        </details>
      )}
    </div>
  );
}
