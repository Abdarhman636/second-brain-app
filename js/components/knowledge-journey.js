import { summarizeStages } from '../utils/review-scheduler.js';
import { formatCount } from '../utils/helpers.js';

/**
 * Where the user's cards are on the way to long-term memory: one stacked bar
 * plus a three-line legend. Gives a sense of progress without charts.
 */
export function renderKnowledgeJourney(cards) {
  const groups = summarizeStages(cards);
  const total = cards.length;
  const rooted = groups.find((group) => group.id === 'rooted').count;
  const rootedPercent = total ? Math.round((rooted / total) * 100) : 0;

  const segments = groups
    .filter((group) => group.count)
    .map((group) => `<span class="journey-bar__segment journey-bar__segment--${group.id}" style="flex-grow: ${group.count}"></span>`)
    .join('');

  const legend = groups
    .map(
      (group) => `
        <li class="journey-legend__item">
          <span class="journey-legend__swatch journey-legend__swatch--${group.id}" aria-hidden="true"></span>
          <span class="journey-legend__label">${group.label}</span>
          <span class="journey-legend__count">${group.count}</span>
        </li>`,
    )
    .join('');

  const description = groups.map((group) => `${group.label}: ${group.count}`).join('، ');

  return `
    <section class="panel" aria-labelledby="journey-title">
      <header class="panel__header">
        <h2 class="panel__title" id="journey-title">رحلة معرفتك</h2>
        <span class="panel__meta">${rootedPercent}% راسخة</span>
      </header>
      <div class="journey-bar" role="img" aria-label="${description}">${segments}</div>
      <ul class="journey-legend" role="list">${legend}</ul>
      <p class="panel__note">
        ${rooted ? `${formatCount(rooted, 'cards')} في ذاكرتك طويلة المدى.` : 'تصبح البطاقة راسخة حين تتذكرها على فترات تصل إلى شهر.'}
      </p>
    </section>`;
}
