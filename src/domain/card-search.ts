/*
 * Filtering for the "all cards" page. Search ignores Arabic diacritics and
 * common letter variants (أ/إ/آ → ا، ة → ه، ى → ي) so near-spellings match.
 */
import { getCardTextParts } from './card-types';
import type { Card, CardType, Project } from './types';

export interface CardFilter {
  query: string;
  projectId: string;
  type: CardType | '';
}

export function normalizeArabic(text = ''): string {
  return text
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // tashkeel + tatweel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();
}

function getSearchableText(card: Card, project: Project | undefined): string {
  return normalizeArabic([...getCardTextParts(card), project?.name ?? ''].join(' '));
}

export function filterCards(
  cards: readonly Card[],
  { query, projectId, type }: CardFilter,
  getProject: (projectId: string) => Project | undefined,
): Card[] {
  const terms = normalizeArabic(query).split(/\s+/).filter(Boolean);

  return cards.filter((card) => {
    if (projectId && card.projectId !== projectId) return false;
    if (type && card.type !== type) return false;
    if (!terms.length) return true;

    const text = getSearchableText(card, getProject(card.projectId));
    return terms.every((term) => text.includes(term));
  });
}
