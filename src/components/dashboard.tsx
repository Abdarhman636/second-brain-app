/*
 * Dashboard cells: streak, knowledge journey, upcoming reviews, hardest
 * project. Each is a "cell": a corner tag on top, then its content, so they
 * sit together on the home grid.
 */
import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router';
import { formatRelativeDate, formatWeekdayNarrow } from '../domain/date-utils';
import { formatCount } from '../domain/format';
import { summarizeStages } from '../domain/review-scheduler';
import { STATS_WINDOW_DAYS, type ProjectDifficulty } from '../domain/stats';
import type { DayKind, StreakSummary } from '../domain/streak';
import type { Card, ISODate } from '../domain/types';
import { getVacationDaysLeft } from '../domain/vacation';
import { Icon, type IconName } from './Icon';
import { accentProps, ProjectBadge } from './ui';

/** Two-digit numbers read like the grid's counters ("07", "12"). */
export const padNumber = (value: number) => String(value).padStart(2, '0');

/** The header every dashboard cell shares: a boxed tag and an optional note. */
export function CellHead({ id, icon, title, meta }: { id: string; icon?: IconName; title: string; meta?: ReactNode }) {
  return (
    <header className="cell-head">
      <h2 className="cell-tag" id={id}>
        {icon && <Icon name={icon} size={13} />}
        {title}
      </h2>
      {meta && <span className="cell-meta">{meta}</span>}
    </header>
  );
}

/* ---------- Streak ---------- */

const DAY_KIND_LABELS: Record<DayKind, string> = {
  completed: 'مكتمل',
  rest: 'لا مراجعات — لا يؤثر في السلسلة',
  vacation: 'إجازة — لا يؤثر في السلسلة',
  missed: 'لم يكتمل',
  today: 'اليوم',
};

// The flame celebrates only when the number actually goes up between visits.
let lastSeenStreak: number | null = null;

function getStatusMessage({ current, completedToday }: StreakSummary, dueCount: number, onVacation: boolean): string {
  if (completedToday) return 'أكملت مراجعة اليوم، وسلسلتك محفوظة.';
  if (onVacation) return 'سلسلتك محفوظة طوال الإجازة، والمراجعة اختيارية.';
  if (dueCount === 0) return current ? 'لا مراجعات اليوم، وسلسلتك محفوظة.' : 'لا مراجعات مستحقة اليوم.';
  if (current === 0) return 'أنهِ مراجعة اليوم لتبدأ سلسلة جديدة.';
  return `أنهِ مراجعة اليوم لتصل إلى ${formatCount(current + 1, 'dayCount')}.`;
}

export function StreakCard({
  streak,
  dueCount,
  vacationSince,
  onStartVacation,
  onEndVacation,
}: {
  streak: StreakSummary;
  dueCount: number;
  /** Start date of the running vacation, if any. */
  vacationSince?: ISODate | null;
  onStartVacation?: () => void;
  onEndVacation?: () => void;
}) {
  const { current, longest, completedToday, recentDays } = streak;
  const onVacation = Boolean(vacationSince);
  const celebrating = lastSeenStreak !== null && current > lastSeenStreak;

  useEffect(() => {
    lastSeenStreak = current;
  }, [current]);

  const classes = ['streak-card', completedToday && 'is-complete', current === 0 && 'is-empty', celebrating && 'is-celebrating']
    .filter(Boolean)
    .join(' ');
  const completedCount = recentDays.filter((day) => day.kind === 'completed').length;
  const today = recentDays.at(-1)?.date;

  return (
    <section className={classes} aria-labelledby="streak-title">
      <CellHead id="streak-title" icon="flame" title="سلسلتك" meta={longest > 0 ? `الأطول ${padNumber(longest)}` : undefined} />

      <div className="streak-card__main">
        <p className="streak-card__count">
          <span className="streak-card__number">{padNumber(current)}</span>
          <span className="streak-card__unit">{current ? formatCount(current, 'streakDays') : 'أيام متتالية'}</span>
        </p>
        <span className="streak-card__flame" aria-hidden="true">
          <Icon name="flame" size={34} />
        </span>
      </div>

      <ol className="streak-week" role="list" aria-label={`أكملت ${completedCount} من آخر 7 أيام`}>
        {recentDays.map(({ date, kind }) => (
          <li key={date} className={`streak-week__day is-${kind}`} title={DAY_KIND_LABELS[kind]}>
            <span className="streak-week__dot">
              {kind === 'completed' && <Icon name="check" size={14} />}
              {kind === 'vacation' && <Icon name="pause" size={12} />}
            </span>
            <span className="streak-week__label">{formatWeekdayNarrow(date)}</span>
          </li>
        ))}
      </ol>

      <footer className="streak-card__footer">
        <p className="streak-card__status">
          {onVacation && vacationSince && today && (
            <strong className="streak-card__vacation-title">
              في إجازة {vacationSince === today ? 'منذ اليوم' : formatRelativeDate(vacationSince, today)}، يتبقى{' '}
              {formatCount(getVacationDaysLeft({ start: vacationSince }, today), 'dayCount')} ·{' '}
            </strong>
          )}
          {getStatusMessage(streak, dueCount, onVacation)}
        </p>
        {onVacation
          ? onEndVacation && (
              <button type="button" className="streak-card__vacation" onClick={onEndVacation}>
                إنهاء الإجازة
              </button>
            )
          : onStartVacation && (
              <button type="button" className="streak-card__vacation" onClick={onStartVacation}>
                <Icon name="pause" size={14} />
                خذ إجازة
              </button>
            )}
      </footer>
    </section>
  );
}

/** Compact version for the end-of-review screen. */
export function StreakLine({ streak }: { streak: StreakSummary }) {
  if (!streak.current) return null;
  return (
    <p className={`streak-line${streak.completedToday ? ' is-complete' : ''}`}>
      <Icon name="flame" size={20} />
      <span>
        <strong>{streak.current}</strong> {formatCount(streak.current, 'streakDays')}
      </span>
    </p>
  );
}

/* ---------- Knowledge journey ---------- */

export function KnowledgeJourney({ cards }: { cards: readonly Card[] }) {
  const groups = summarizeStages(cards);
  const rooted = groups.find((group) => group.id === 'rooted')?.count ?? 0;
  const rootedPercent = cards.length ? Math.round((rooted / cards.length) * 100) : 0;
  const description = groups.map((group) => `${group.label}: ${group.count}`).join('، ');

  return (
    <section className="panel" aria-labelledby="journey-title">
      <CellHead id="journey-title" icon="chart" title="رحلة معرفتك" meta={`${rootedPercent}% راسخة`} />
      <div className="journey-bar" role="img" aria-label={description}>
        {groups
          .filter((group) => group.count > 0)
          .map((group) => (
            <span key={group.id} className={`journey-bar__segment journey-bar__segment--${group.id}`} style={{ flexGrow: group.count }} />
          ))}
      </div>
      <ul className="journey-legend" role="list">
        {groups.map((group) => (
          <li key={group.id} className="journey-legend__item">
            <span className={`journey-legend__swatch journey-legend__swatch--${group.id}`} aria-hidden="true" />
            <span className="journey-legend__label">{group.label}</span>
            <span className="journey-legend__count">{padNumber(group.count)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- Upcoming reviews ---------- */

export function UpcomingReviews({ schedule, today }: { schedule: { date: ISODate; count: number }[]; today: ISODate }) {
  return (
    <section className="panel" aria-labelledby="upcoming-heading">
      <CellHead id="upcoming-heading" icon="today" title="المراجعات القادمة" />
      {schedule.length ? (
        <ul className="upcoming-list" role="list">
          {schedule.map(({ date, count }) => (
            <li key={date} className="upcoming-list__item">
              <span className="upcoming-list__date">{formatRelativeDate(date, today)}</span>
              <span className="upcoming-list__count">{formatCount(count, 'cards')}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="panel__note">لا توجد مراجعات مجدولة بعد.</p>
      )}
    </section>
  );
}

/* ---------- Hardest project ---------- */

export function HardestProject({ difficulty, hasReviews }: { difficulty: ProjectDifficulty | null; hasReviews: boolean }) {
  return (
    <section className="panel" aria-labelledby="hardest-title">
      <CellHead id="hardest-title" icon="target" title="أصعب مشروع" meta={`آخر ${STATS_WINDOW_DAYS} يومًا`} />

      {difficulty ? (
        <>
          <Link className="hardest-project" to={`/projects/${difficulty.project.id}`} {...accentProps(difficulty.project)}>
            <ProjectBadge project={difficulty.project} />
            <span className="hardest-project__body">
              <span className="hardest-project__name">{difficulty.project.name}</span>
              <span className="hardest-project__meta">
                تذكّرت {difficulty.remembered} من {formatCount(difficulty.reviews, 'reviews')}
              </span>
            </span>
            <span className="hardest-project__rate">{difficulty.rate}%</span>
          </Link>
          <p className="panel__note">ركّز على بطاقاته، أو قسّم الطويلة منها إلى بطاقات أقصر.</p>
        </>
      ) : (
        <p className="panel__note">
          {hasReviews ? 'لا يوجد مشروع يتعثر فيه تذكّرك حاليًا.' : 'راجع بضعة أيام، وسنعرف أي مشاريعك أصعب عليك.'}
        </p>
      )}
    </section>
  );
}
