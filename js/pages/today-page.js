/*
 * Home dashboard. Answers three questions at a glance:
 *   What do I need to do today?  → the Today card
 *   How am I progressing?        → stats + knowledge journey
 *   What is my streak?           → the Streak card (the hero)
 */
import { icon } from '../components/icons.js';
import { renderEmptyState } from '../components/empty-state.js';
import { renderProgress } from '../components/progress.js';
import { renderKnowledgeCard } from '../components/knowledge-card.js';
import { renderStreakCard } from '../components/streak.js';
import { renderKnowledgeJourney } from '../components/knowledge-journey.js';
import {
  getCards,
  getCurrentUser,
  getDueCards,
  getProjectById,
  getProjects,
  getReviewSession,
  getReviewSummary,
  getStreakData,
  getUpcomingSchedule,
  isReviewSessionActive,
} from '../state/app-state.js';
import { getStreakSummary } from '../utils/streak.js';
import { formatLongDate, formatRelativeDate, getToday } from '../utils/date-utils.js';
import { formatCount } from '../utils/helpers.js';
import { routes } from '../router.js';

const DUE_PREVIEW_LIMIT = 5;
const CARDS_PER_MINUTE = 3;

function getGreeting() {
  const greeting = new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير';
  const firstName = getCurrentUser()?.name.split(/\s+/)[0];
  return firstName ? `${greeting}، ${firstName}` : greeting;
}

function renderNoProjects() {
  return `
    <div class="page page--narrow">
      ${renderEmptyState({
        icon: 'folderPlus',
        title: 'ابدأ أول مشروع لك',
        message: 'اجمع المعلومات التي تريد تذكرها، ونرتب لك مراجعتها مع الوقت.',
        actions: [{ label: 'إنشاء مشروع', action: 'create-project' }],
        headingLevel: 1,
      })}
    </div>`;
}

/* ---------- Today card: what to do now ---------- */

function renderTodayCard({ dueCards, summary, today }) {
  const total = summary.reviewed + dueCards.length;
  const upcoming = getUpcomingSchedule(today, 1)[0];
  const upcomingText = upcoming
    ? `موعدك القادم ${formatRelativeDate(upcoming.date, today)} · ${formatCount(upcoming.count, 'cards')}`
    : '';

  if (!dueCards.length) {
    const finished = summary.reviewed > 0;
    return `
      <section class="today-card ${finished ? 'is-complete' : 'is-clear'}" aria-labelledby="today-card-title">
        <p class="today-card__eyebrow">مهمة اليوم</p>
        <div class="today-card__done">
          <span class="today-card__check">${icon(finished ? 'check' : 'sun', { size: 22 })}</span>
          <div>
            <h2 class="today-card__title" id="today-card-title">${finished ? 'خلصت مراجعتك لليوم.' : 'لا توجد مراجعات اليوم'}</h2>
            <p class="today-card__text">
              ${finished ? `راجعت ${formatCount(summary.reviewed, 'cardsObject')}، وتذكّرت ${summary.remembered} منها.` : 'أنت مخلص كل شيء حاليًا.'}
            </p>
          </div>
        </div>
        ${finished ? renderProgress({ value: total, max: total, label: 'تقدّم مراجعة اليوم' }) : ''}
        ${upcomingText ? `<p class="today-card__footnote">${upcomingText}</p>` : ''}
      </section>`;
  }

  const isResuming = isReviewSessionActive(today) && getReviewSession().currentIndex > 0;
  const minutes = Math.max(1, Math.ceil(dueCards.length / CARDS_PER_MINUTE));

  return `
    <section class="today-card" aria-labelledby="today-card-title">
      <p class="today-card__eyebrow">مهمة اليوم</p>
      <h2 class="today-card__headline" id="today-card-title">
        <span class="today-card__number">${dueCards.length}</span>
        ${formatCount(dueCards.length, 'cardsNoun')} بانتظارك
      </h2>
      <p class="today-card__text">نحو ${formatCount(minutes, 'minutes')} من وقتك.</p>

      <div class="today-card__progress">
        ${renderProgress({ value: summary.reviewed, max: total, label: 'تقدّم مراجعة اليوم' })}
        <p class="today-card__progress-text"><strong>${summary.reviewed}</strong> من ${formatCount(total, 'cards')} تمت مراجعتها</p>
      </div>

      <a class="btn btn--primary btn--lg btn--block" href="${routes.review}">
        ${isResuming ? 'تابع المراجعة' : 'ابدأ المراجعة'}
      </a>
    </section>`;
}

/* ---------- Small numbers ---------- */

function renderStats({ summary, dueCount, cardCount, projectCount }) {
  const stats = [
    { label: 'راجعتها اليوم', value: summary.reviewed },
    { label: 'متبقية اليوم', value: dueCount, highlight: dueCount > 0 },
    { label: 'إجمالي البطاقات', value: cardCount },
    { label: 'المشاريع', value: projectCount },
  ];

  return `
    <dl class="stat-row">
      ${stats
        .map(
          ({ label, value, highlight }) => `
            <div class="stat${highlight ? ' is-highlight' : ''}">
              <dt class="stat__label">${label}</dt>
              <dd class="stat__value">${value}</dd>
            </div>`,
        )
        .join('')}
    </dl>`;
}

/* ---------- Due cards: same card layout as everywhere else ---------- */

function renderDueSection(dueCards, today) {
  const visible = dueCards.slice(0, DUE_PREVIEW_LIMIT);
  const hiddenCount = dueCards.length - visible.length;

  return `
    <section class="section dashboard-due" aria-labelledby="due-heading">
      <header class="section__header">
        <h2 class="section-title" id="due-heading">بانتظار المراجعة</h2>
        <a class="section__link" href="${routes.cards}">عرض كل البطاقات</a>
      </header>
      <ul class="card-list" role="list">
        ${visible
          .map((card) => `<li>${renderKnowledgeCard(card, { today, project: getProjectById(card.projectId), showProject: true })}</li>`)
          .join('')}
      </ul>
      ${hiddenCount ? `<p class="card-list__more">${formatCount(hiddenCount, 'moreCards')} تنتظرك في المراجعة</p>` : ''}
    </section>`;
}

function renderUpcomingPanel(today) {
  const schedule = getUpcomingSchedule(today, 4);
  const rows = schedule
    .map(
      ({ date, count }) => `
        <li class="upcoming-list__item">
          <span class="upcoming-list__date">${formatRelativeDate(date, today)}</span>
          <span class="upcoming-list__count">${formatCount(count, 'cards')}</span>
        </li>`,
    )
    .join('');

  return `
    <section class="panel" aria-labelledby="upcoming-heading">
      <header class="panel__header">
        <h2 class="panel__title" id="upcoming-heading">المراجعات القادمة</h2>
      </header>
      ${rows ? `<ul class="upcoming-list" role="list">${rows}</ul>` : '<p class="panel__note">لا توجد مراجعات مجدولة بعد.</p>'}
    </section>`;
}

/* ---------- Page ---------- */

export function renderTodayPage(container) {
  const projects = getProjects();
  if (!projects.length) {
    container.innerHTML = renderNoProjects();
    return;
  }

  const today = getToday();
  const cards = getCards();
  const dueCards = getDueCards(today);
  const summary = getReviewSummary(today);
  const streak = getStreakSummary(getStreakData(), today);

  container.innerHTML = `
    <div class="page dashboard">
      <header class="dashboard-header">
        <div>
          <p class="page-eyebrow">${getGreeting()} · ${formatLongDate(today)}</p>
          <h1 class="page-title">مراجعتك اليوم</h1>
        </div>
        <button type="button" class="btn btn--primary btn--lg dashboard-header__add" data-action="create-card">
          ${icon('plus', { size: 20 })}إضافة كارت
        </button>
      </header>

      <div class="dashboard-hero">
        ${renderStreakCard(streak, { dueCount: dueCards.length })}
        ${renderTodayCard({ dueCards, summary, today })}
      </div>

      ${renderStats({ summary, dueCount: dueCards.length, cardCount: cards.length, projectCount: projects.length })}

      ${dueCards.length ? renderDueSection(dueCards, today) : ''}

      <div class="dashboard-grid">
        ${renderUpcomingPanel(today)}
        ${renderKnowledgeJourney(cards)}
      </div>
    </div>`;
}
