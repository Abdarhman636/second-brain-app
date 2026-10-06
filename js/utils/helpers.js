/** Escape user-provided text before interpolating it into HTML templates. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** UUIDs keep ids compatible with a future database (e.g. Supabase uuid columns). */
export function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ---------- Arabic pluralization ---------- */

const pluralRules = new Intl.PluralRules('ar');

/**
 * Arabic has six plural categories (zero, one, two, few, many, other), and the
 * counted noun changes form with each. `{n}` is replaced by the number.
 */
const COUNT_FORMS = {
  cards: {
    zero: 'لا بطاقات',
    one: 'بطاقة واحدة',
    two: 'بطاقتان',
    few: '{n} بطاقات',
    many: '{n} بطاقة',
    other: '{n} بطاقة',
  },
  // Object position, as in "راجعت بطاقتين"
  cardsObject: {
    zero: 'لا بطاقات',
    one: 'بطاقة واحدة',
    two: 'بطاقتين',
    few: '{n} بطاقات',
    many: '{n} بطاقة',
    other: '{n} بطاقة',
  },
  // Noun only, for when the number is displayed separately
  cardsNoun: {
    zero: 'بطاقات',
    one: 'بطاقة',
    two: 'بطاقتان',
    few: 'بطاقات',
    many: 'بطاقة',
    other: 'بطاقة',
  },
  moreCards: {
    zero: '',
    one: 'وبطاقة أخرى',
    two: 'وبطاقتان أخريان',
    few: 'و{n} بطاقات أخرى',
    many: 'و{n} بطاقة أخرى',
    other: 'و{n} بطاقة أخرى',
  },
  projects: {
    zero: 'لا مشاريع',
    one: 'مشروع واحد',
    two: 'مشروعان',
    few: '{n} مشاريع',
    many: '{n} مشروعًا',
    other: '{n} مشروع',
  },
  // After a preposition: "في 7 مشاريع" / "في مشروعين"
  projectsGenitive: {
    zero: 'لا مشاريع',
    one: 'مشروع واحد',
    two: 'مشروعين',
    few: '{n} مشاريع',
    many: '{n} مشروعًا',
    other: '{n} مشروع',
  },
  minutes: {
    zero: 'أقل من دقيقة',
    one: 'دقيقة واحدة',
    two: 'دقيقتان',
    few: '{n} دقائق',
    many: '{n} دقيقة',
    other: '{n} دقيقة',
  },
  // Streak unit, shown after a large number: "7 أيام متتالية"
  streakDays: {
    zero: 'يوم',
    one: 'يوم',
    two: 'يومان متتاليان',
    few: 'أيام متتالية',
    many: 'يومًا متتاليًا',
    other: 'يوم متتالٍ',
  },
  dayCount: {
    zero: 'لا أيام',
    one: 'يوم واحد',
    two: 'يومان',
    few: '{n} أيام',
    many: '{n} يومًا',
    other: '{n} يوم',
  },
  // Genitive, as in "بعد يومين" / "منذ ثلاثة أيام"
  days: {
    zero: '{n} يوم',
    one: 'يوم',
    two: 'يومين',
    few: '{n} أيام',
    many: '{n} يومًا',
    other: '{n} يوم',
  },
};

export function formatCount(count, noun) {
  const forms = COUNT_FORMS[noun];
  const template = forms[pluralRules.select(count)] ?? forms.other;
  return template.replace('{n}', String(count));
}

/* ---------- Misc ---------- */

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Serialize a plain object into `data-*` attributes (camelCase → kebab-case). */
export function dataAttributes(data = {}) {
  return Object.entries(data)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => {
      const name = key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
      return `data-${name}="${escapeHtml(value)}"`;
    })
    .join(' ');
}
