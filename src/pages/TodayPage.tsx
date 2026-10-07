/*
 * Home: one screen, no scrolling on a laptop. A grid of cells answers
 *   What do I need to do today?  → مهمة اليوم (with "ابدأ المراجعة")
 *   How am I progressing?        → the numbers row, hardest project, journey
 *   What is my streak?           → سلسلتك (with vacation mode)
 */
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { CellHead, HardestProject, KnowledgeJourney, padNumber, StreakCard, UpcomingReviews } from '../components/dashboard';
import { Icon } from '../components/Icon';
import { EmptyState, Progress } from '../components/ui';
import { formatLongDate, formatRelativeDate } from '../domain/date-utils';
import { formatCount } from '../domain/format';
import { CARDS_PER_MINUTE } from '../domain/review-scheduler';
import { getHardestProject, getRecallStats, getRootedStats, STATS_WINDOW_DAYS } from '../domain/stats';
import type { Card, ISODate } from '../domain/types';
import { getActiveVacation } from '../domain/vacation';
import { useActiveCards, useReviewSummary, useStreak, useTodaysReviews } from '../hooks/use-app-data';
import { useDocumentTitle } from '../hooks/use-document-title';
import { useToday } from '../hooks/use-today';
import { useVacationActions } from '../hooks/use-vacation-actions';
import { useAppStore } from '../store/app-store';
import { getUpcomingSchedule, isReviewSessionActive, type ReviewSummary } from '../store/selectors';
import { useUiStore } from '../store/ui-store';

const UPCOMING_DAYS = 3;

function useGreeting(): string {
  const name = useAppStore((state) => state.user?.name);
  const greeting = new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير';
  const firstName = name?.split(/\s+/)[0];
  return firstName ? `${greeting}، ${firstName}` : greeting;
}

/** The main cell: how many cards are waiting, and the button to start. */
function TodayCard({
  dueCount,
  deferred,
  summary,
  today,
  activeCards,
  onVacation,
}: {
  dueCount: number;
  /** Due cards past the daily limit, waiting for tomorrow. */
  deferred: number;
  summary: ReviewSummary;
  today: ISODate;
  activeCards: Card[];
  onVacation: boolean;
}) {
  const session = useAppStore((state) => state.reviewSession);
  const navigate = useNavigate();
  const total = summary.reviewed + dueCount;
  const upcoming = getUpcomingSchedule(activeCards, today, 1)[0];

  if (dueCount === 0) {
    const finished = summary.reviewed > 0;
    const reviewMore = () => {
      useAppStore.getState().startReviewSession(today, { extra: true });
      navigate('/review');
    };
    return (
      <section className={`today-card ${finished ? 'is-complete' : 'is-clear'}`} aria-labelledby="today-card-title">
        <CellHead id="today-card-title" icon="today" title="مهمة اليوم" meta={formatLongDate(today)} />
        <div className="today-card__done">
          <span className="today-card__check">
            <Icon name={finished ? 'check' : 'sun'} size={26} />
          </span>
          <p className="today-card__title">{finished ? 'خلصت مراجعتك لليوم.' : 'لا توجد مراجعات اليوم'}</p>
          <p className="today-card__text">
            {finished ? `راجعت ${formatCount(summary.reviewed, 'cardsObject')}، وتذكّرت ${summary.remembered} منها.` : 'أنت مخلص كل شيء حاليًا.'}
          </p>
        </div>
        {deferred > 0 ? (
          <div className="today-card__footnote today-card__deferred">
            <p>وصلت لحدّك اليومي. {formatCount(deferred, 'cards')} تنتظر الغد.</p>
            <button type="button" className="btn btn--secondary btn--sm" onClick={reviewMore}>
              راجع دفعة إضافية
            </button>
          </div>
        ) : (
          upcoming && (
            <p className="today-card__footnote">
              موعدك القادم {formatRelativeDate(upcoming.date, today)} · {formatCount(upcoming.count, 'cards')}
            </p>
          )
        )}
      </section>
    );
  }

  const isResuming = isReviewSessionActive(session, today) && session.currentIndex > 0;
  const minutes = Math.max(1, Math.ceil(dueCount / CARDS_PER_MINUTE));

  return (
    <section className="today-card" aria-labelledby="today-card-title">
      <CellHead id="today-card-title" icon="today" title="مهمة اليوم" meta={formatLongDate(today)} />

      <div className="today-card__headline">
        <span className="today-card__number">{padNumber(dueCount)}</span>
        <span className="today-card__label">
          <span className="today-card__noun">{formatCount(dueCount, 'cardsNoun')} بانتظارك</span>
          <span className="today-card__text">
            {onVacation ? 'أنت في إجازة، فالمراجعة اختيارية.' : `نحو ${formatCount(minutes, 'minutes')} من وقتك.`}
            {deferred > 0 && ` و${formatCount(deferred, 'cards')} مؤجلة للغد.`}
          </span>
        </span>
      </div>

      <div className="today-card__progress">
        <p className="today-card__progress-text">
          <span>تمت مراجعتها</span>
          <span className="today-card__progress-count">
            {padNumber(summary.reviewed)} / {padNumber(total)}
          </span>
        </p>
        <Progress value={summary.reviewed} max={total} label="تقدّم مراجعة اليوم" />
      </div>

      <Link className="btn btn--primary btn--lg btn--block today-card__start" to="/review">
        {isResuming ? 'تابع المراجعة' : 'ابدأ المراجعة'}
        <Icon name="arrowLeft" size={18} />
      </Link>
    </section>
  );
}

export function TodayPage() {
  useDocumentTitle('اليوم');
  const today = useToday();
  const greeting = useGreeting();
  const { openDialog } = useUiStore.getState();
  const projects = useAppStore((state) => state.projects);
  const cards = useAppStore((state) => state.cards);
  const reviewLog = useAppStore((state) => state.reviewLog);
  const vacations = useAppStore((state) => state.vacations);
  const activeCards = useActiveCards();
  const todays = useTodaysReviews(today);
  const summary = useReviewSummary(today);
  const streak = useStreak(today);

  const stats = useMemo(
    () => ({
      recall: getRecallStats(reviewLog, today),
      rooted: getRootedStats(activeCards),
      hardest: getHardestProject(reviewLog, cards, projects, today),
      upcoming: getUpcomingSchedule(activeCards, today, UPCOMING_DAYS),
    }),
    [reviewLog, cards, projects, activeCards, today],
  );
  const vacation = getActiveVacation(vacations);
  const vacationActions = useVacationActions(today);

  if (!projects.length) {
    return (
      <div className="page">
        <EmptyState
          icon="folderPlus"
          title="ابدأ أول مشروع لك"
          message="اجمع المعلومات التي تريد تذكرها، ونرتب لك مراجعتها مع الوقت."
          actions={[{ label: 'إنشاء مشروع', onClick: () => openDialog({ kind: 'create-project' }) }]}
          headingLevel={1}
        />
      </div>
    );
  }

  const statCells = [
    {
      label: 'نسبة التذكّر',
      value: stats.recall.rate === null ? '—' : `${stats.recall.rate}%`,
      note: stats.recall.reviews ? `${formatCount(stats.recall.reviews, 'reviews')} · ${STATS_WINDOW_DAYS} يومًا` : 'لا مراجعات بعد',
    },
    { label: 'بطاقات راسخة', value: padNumber(stats.rooted.rooted), note: `من ${formatCount(stats.rooted.total, 'cards')}` },
    { label: 'راجعتها اليوم', value: padNumber(summary.reviewed), note: `تذكّرت منها ${summary.remembered}` },
    { label: 'أطول سلسلة', value: padNumber(streak.longest), note: streak.longest ? `الحالية ${padNumber(streak.current)}` : 'ابدأها اليوم' },
  ];

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <p className="page-eyebrow">{greeting}</p>
        <h1 className="dashboard__title">مراجعتك اليوم</h1>
      </header>

      <div className="dashboard-board">
        <TodayCard dueCount={todays.cards.length} deferred={todays.deferred} summary={summary} today={today} activeCards={activeCards} onVacation={Boolean(vacation)} />
        <StreakCard
          streak={streak}
          dueCount={todays.cards.length}
          vacationSince={vacation?.start ?? null}
          onStartVacation={vacationActions.start}
          onEndVacation={vacationActions.end}
        />

        <dl className="stat-strip">
          {statCells.map((stat) => (
            <div key={stat.label} className="stat">
              <dt className="stat__label">{stat.label}</dt>
              <dd className="stat__value">{stat.value}</dd>
              <dd className="stat__note">{stat.note}</dd>
            </div>
          ))}
        </dl>

        <HardestProject difficulty={stats.hardest} hasReviews={stats.recall.reviews > 0} />
        <KnowledgeJourney cards={activeCards} />
        <UpcomingReviews schedule={stats.upcoming} today={today} />
      </div>
    </div>
  );
}
