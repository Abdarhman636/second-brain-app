/*
 * Filtering for the "all cards" page. Pure: takes cards and a filter, returns
 * the matching cards. Search ignores Arabic diacritics and common letter
 * variants (أ/إ/آ → ا، ة → ه، ى → ي) so near-spellings still match.
 */

export function normalizeArabic(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '') // tashkeel + tatweel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();
}

function getSearchableText(card, project) {
  return normalizeArabic([...Object.values(card.content), project?.name ?? ''].join(' '));
}

/**
 * @param {object[]} cards
 * @param {{ query?: string, projectId?: string, type?: string }} filter
 * @param {(projectId: string) => object} getProject
 */
export function filterCards(cards, { query = '', projectId = '', type = '' }, getProject) {
  const terms = normalizeArabic(query).split(/\s+/).filter(Boolean);

  return cards.filter((card) => {
    if (projectId && card.projectId !== projectId) return false;
    if (type && card.type !== type) return false;
    if (!terms.length) return true;

    const text = getSearchableText(card, getProject(card.projectId));
    return terms.every((term) => text.includes(term));
  });
}
