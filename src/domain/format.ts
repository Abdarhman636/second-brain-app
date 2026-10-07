/*
 * Arabic counting. Arabic has six plural categories (zero, one, two, few,
 * many, other) and the counted noun changes form with each. `{n}` is replaced
 * by the number.
 */

type PluralForms = Record<Intl.LDMLPluralRule, string>;

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
  shelves: {
    zero: 'لا رفوف',
    one: 'رف واحد',
    two: 'رفّان',
    few: '{n} رفوف',
    many: '{n} رفًّا',
    other: '{n} رف',
  },
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
  // After "من": "تذكّرت 6 من 9 مراجعات"
  reviews: {
    zero: 'لا مراجعات',
    one: 'مراجعة واحدة',
    two: 'مراجعتين',
    few: '{n} مراجعات',
    many: '{n} مراجعة',
    other: '{n} مراجعة',
  },
  // How far a forgotten card falls: "وترجع مرحلتين"
  stagesBack: {
    zero: '',
    one: 'مرحلة',
    two: 'مرحلتين',
    few: '{n} مراحل',
    many: '{n} مرحلة',
    other: '{n} مرحلة',
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
} satisfies Record<string, PluralForms>;

export type CountNoun = keyof typeof COUNT_FORMS;

const pluralRules = new Intl.PluralRules('ar');

export function formatCount(count: number, noun: CountNoun): string {
  return COUNT_FORMS[noun][pluralRules.select(count)].replace('{n}', String(count));
}

/** First letter of a name, skipping the Arabic article "ال" (e.g. "العادات" → "ع"). */
export function getInitial(name: string): string {
  const trimmed = name.trim();
  const base = trimmed.startsWith('ال') && trimmed.length > 3 ? trimmed.slice(2) : trimmed;
  return [...base][0] ?? '•';
}
