import { icon } from './icons.js';
import { formatWeekdayNarrow } from '../utils/date-utils.js';
import { formatCount } from '../utils/helpers.js';

const DAY_KIND_LABELS = {
  completed: 'مكتمل',
  rest: 'لا مراجعات — لا يؤثر في السلسلة',
  missed: 'لم يكتمل',
  today: 'اليوم',
};

// The flame celebrates only when the number actually goes up, not on every re-render.
let lastRenderedStreak = null;

function getStatusMessage({ current, completedToday }, dueCount) {
  if (completedToday) return 'أكملت مراجعة اليوم، وسلسلتك محفوظة.';
  if (dueCount === 0) return current ? 'لا مراجعات اليوم، وسلسلتك محفوظة.' : 'لا مراجعات مستحقة اليوم.';
  if (current === 0) return 'أنهِ مراجعة اليوم لتبدأ سلسلة جديدة.';
  return `أنهِ مراجعة اليوم لتصل إلى ${formatCount(current + 1, 'dayCount')}.`;
}

function renderWeek(recentDays) {
  const days = recentDays
    .map(({ date, kind }) => {
      const completed = kind === 'completed';
      return `
        <li class="streak-week__day is-${kind}" title="${DAY_KIND_LABELS[kind]}">
          <span class="streak-week__dot">${completed ? icon('check', { size: 14 }) : ''}</span>
          <span class="streak-week__label">${formatWeekdayNarrow(date)}</span>
        </li>`;
    })
    .join('');

  const completedCount = recentDays.filter((day) => day.kind === 'completed').length;
  return `<ol class="streak-week" role="list" aria-label="أكملت ${completedCount} من آخر 7 أيام">${days}</ol>`;
}

/**
 * The dashboard's hero: the current streak, the last seven days, and what
 * today means for the streak.
 */
export function renderStreakCard(streak, { dueCount }) {
  const { current, longest, completedToday, recentDays } = streak;
  const justIncreased = lastRenderedStreak !== null && current > lastRenderedStreak;
  lastRenderedStreak = current;

  const classes = [
    'streak-card',
    completedToday ? 'is-complete' : '',
    current === 0 ? 'is-empty' : '',
    justIncreased ? 'is-celebrating' : '',
  ].join(' ');

  return `
    <section class="${classes.replace(/\s+/g, ' ').trim()}" aria-labelledby="streak-title">
      <header class="streak-card__header">
        <h2 class="streak-card__title" id="streak-title">سلسلتك</h2>
        ${longest ? `<span class="streak-card__best">الأطول: ${formatCount(longest, 'dayCount')}</span>` : ''}
      </header>

      <div class="streak-card__main">
        <span class="streak-card__flame">${icon('flame', { size: 44 })}</span>
        <p class="streak-card__count">
          <span class="streak-card__number">${current}</span>
          <span class="streak-card__unit">${current ? formatCount(current, 'streakDays') : 'أيام متتالية'}</span>
        </p>
      </div>

      ${renderWeek(recentDays)}

      <p class="streak-card__status">${getStatusMessage(streak, dueCount)}</p>
    </section>`;
}

/** Compact version for the end-of-review screen. */
export function renderStreakLine({ current, completedToday }) {
  if (!current) return '';
  return `
    <p class="streak-line${completedToday ? ' is-complete' : ''}">
      ${icon('flame', { size: 20 })}
      <span><strong>${current}</strong> ${formatCount(current, 'streakDays')}</span>
    </p>`;
}
