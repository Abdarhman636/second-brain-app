/*
 * All cards from active projects, with search and two filters. Results load
 * in batches as you scroll, so long collections stay fast.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '../components/Icon';
import { KnowledgeCard } from '../components/KnowledgeCard';
import { EmptyState } from '../components/ui';
import { CARD_TYPE_ORDER, getCardType } from '../domain/card-types';
import { filterCards, type CardFilter } from '../domain/card-search';
import { formatCount } from '../domain/format';
import { compareByReviewDate, isCardDue } from '../domain/review-scheduler';
import type { CardType } from '../domain/types';
import { useActiveCards, useDueCards, useProjectMap, useTodaysReviews } from '../hooks/use-app-data';
import { useDocumentTitle } from '../hooks/use-document-title';
import { useToday } from '../hooks/use-today';
import { useAppStore } from '../store/app-store';
import { useUiStore } from '../store/ui-store';

const PAGE_SIZE = 20;

// Kept between visits so returning to the page restores the last search.
let savedFilter: CardFilter = { query: '', projectId: '', type: '' };

export function CardsPage() {
  useDocumentTitle('البطاقات');
  const today = useToday();
  const projects = useAppStore((state) => state.projects);
  const activeCards = useActiveCards();
  const dueCount = useDueCards(today).length;
  const todaysCount = useTodaysReviews(today).cards.length;
  const projectMap = useProjectMap();
  const openDialog = useUiStore((state) => state.openDialog);

  const activeProjects = useMemo(() => projects.filter((project) => !project.archived), [projects]);
  const [filter, setFilter] = useState<CardFilter>(() =>
    savedFilter.projectId && !activeProjects.some((project) => project.id === savedFilter.projectId)
      ? { ...savedFilter, projectId: '' }
      : savedFilter,
  );
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(
    () => filterCards(activeCards, filter, (id) => projectMap.get(id)).sort(compareByReviewDate),
    [activeCards, filter, projectMap],
  );
  const visible = matches.slice(0, visibleCount);
  const remaining = matches.length - visible.length;
  const isFiltered = Boolean(filter.query || filter.projectId || filter.type);

  const updateFilter = (changes: Partial<CardFilter>) => {
    const next = { ...filter, ...changes };
    savedFilter = next;
    setFilter(next);
    setVisibleCount(PAGE_SIZE);
  };

  // Load the next batch when the end of the list scrolls into view.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || remaining <= 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisibleCount((count) => count + PAGE_SIZE);
      },
      { rootMargin: '400px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [remaining]);

  if (!activeCards.length) {
    return (
      <div className="page">
        <EmptyState
          icon="cardPlus"
          title="لا توجد بطاقات بعد"
          message="أضف أول بطاقة وابدأ بحفظ ما تتعلمه."
          actions={[{ label: 'إضافة بطاقة', onClick: () => openDialog({ kind: 'create-card' }) }]}
          headingLevel={1}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">كل البطاقات</h1>
          <p className="page-subtitle">
            {formatCount(activeCards.length, 'cards')} في {formatCount(activeProjects.length, 'projectsGenitive')}
            {dueCount > 0 && ` · ${dueCount} للمراجعة اليوم`}
          </p>
        </div>
        <div className="page-header__actions">
          {/* With a project chosen in the filter, review that project; otherwise today's review. */}
          {filter.projectId ? (
            <Link className="btn btn--primary" to={`/projects/${filter.projectId}/review`}>
              <Icon name="review" size={18} />
              راجع بطاقات المشروع
            </Link>
          ) : todaysCount > 0 ? (
            <Link className="btn btn--primary" to="/review">
              <Icon name="review" size={18} />
              ابدأ المراجعة · {formatCount(todaysCount, 'cards')}
            </Link>
          ) : (
            <button type="button" className="btn btn--secondary" disabled>
              <Icon name="check" size={18} />
              لا مراجعات متبقية اليوم
            </button>
          )}
        </div>
      </header>

      <form className="cards-toolbar" role="search" onSubmit={(event) => event.preventDefault()}>
        <label className="visually-hidden" htmlFor="cards-search">
          ابحث في البطاقات
        </label>
        <input
          className="input cards-toolbar__search"
          id="cards-search"
          type="search"
          placeholder="ابحث في البطاقات…"
          autoComplete="off"
          value={filter.query}
          onChange={(event) => updateFilter({ query: event.target.value })}
        />

        <label className="visually-hidden" htmlFor="cards-project">
          المشروع
        </label>
        <select className="select" id="cards-project" value={filter.projectId} onChange={(event) => updateFilter({ projectId: event.target.value })}>
          <option value="">كل المشاريع</option>
          {activeProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>

        <label className="visually-hidden" htmlFor="cards-type">
          نوع البطاقة
        </label>
        <select className="select" id="cards-type" value={filter.type} onChange={(event) => updateFilter({ type: event.target.value as CardType | '' })}>
          <option value="">كل الأنواع</option>
          {CARD_TYPE_ORDER.map((typeId) => (
            <option key={typeId} value={typeId}>
              {getCardType(typeId).label}
            </option>
          ))}
        </select>
      </form>

      {matches.length ? (
        <>
          <p className="cards-results__count" aria-live="polite">
            {isFiltered ? `${formatCount(matches.length, 'cards')} مطابقة` : ''}
          </p>
          <ul className="card-list" role="list">
            {visible.map((card) => (
              <li key={card.id}>
                <KnowledgeCard card={card} project={projectMap.get(card.projectId)} today={today} due={isCardDue(card, today)} showProject />
              </li>
            ))}
          </ul>
          {remaining > 0 && (
            <div className="load-more" ref={sentinelRef}>
              <button type="button" className="btn btn--secondary" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                عرض المزيد · {formatCount(remaining, 'cards')} متبقية
              </button>
            </div>
          )}
        </>
      ) : (
        <EmptyState icon="search" title="لا توجد بطاقات مطابقة" message="جرّب كلمة أخرى، أو غيّر المشروع أو النوع." />
      )}
    </div>
  );
}
