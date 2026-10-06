import { renderStreakLine } from './streak.js';
import { formatRelativeDate } from '../utils/date-utils.js';
import { formatCount } from '../utils/helpers.js';
import { routes } from '../router.js';

/**
 * End-of-review state. `pendingCount` covers the edge case where new cards
 * were added after the session finished.
 */
export function renderReviewCompletion({ summary, upcoming, today, streak, pendingCount = 0, headingLevel = 2 }) {
  const heading = `h${headingLevel}`;
  const upcomingText = upcoming
    ? `موعدك القادم ${formatRelativeDate(upcoming.date, today)} · ${formatCount(upcoming.count, 'cards')}`
    : '';

  const primaryActions = pendingCount
    ? `<button type="button" class="btn btn--primary btn--lg" data-action="restart-review">
         ابدأ المراجعة · ${formatCount(pendingCount, 'cards')}
       </button>
       <a class="btn btn--secondary btn--lg" href="${routes.projects}">استعراض المشاريع</a>`
    : `<a class="btn btn--primary btn--lg" href="${routes.projects}">استعراض المشاريع</a>
       <button type="button" class="btn btn--secondary btn--lg" data-action="create-card">إضافة بطاقة جديدة</button>`;

  return `
    <section class="completion">
      <div class="completion__mark" aria-hidden="true">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="32" cy="32" r="24" transform="rotate(-90 32 32)" />
          <path d="M22 32.5l7 7 13-14" />
        </svg>
      </div>

      <${heading} class="completion__title">خلصت مراجعتك لليوم.</${heading}>
      <p class="completion__count">راجعت ${formatCount(summary.reviewed, 'cardsObject')}</p>
      ${streak ? renderStreakLine(streak) : ''}

      ${
        summary.reviewed
          ? `<dl class="completion__stats">
               <div><dt>تذكّرتها</dt><dd>${summary.remembered}</dd></div>
               <div><dt>تعود غدًا</dt><dd>${summary.forgot}</dd></div>
             </dl>`
          : ''
      }

      ${upcomingText ? `<p class="completion__upcoming">${upcomingText}</p>` : ''}

      <div class="completion__actions">${primaryActions}</div>
    </section>`;
}
