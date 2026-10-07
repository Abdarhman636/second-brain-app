import { formatCount } from './format';
import type { ISODate } from './types';

/*
 * Review dates are calendar days, stored as local "YYYY-MM-DD" strings.
 * ISO date strings sort lexically, so they can be compared with < and >.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const LOCALE = 'ar-u-nu-latn';

const pad = (value: number) => String(value).padStart(2, '0');

export function toISODate(date: Date): ISODate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseISODate(isoDate: ISODate): Date {
  const [year = 1970, month = 1, day = 1] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function getToday(): ISODate {
  return toISODate(new Date());
}

export function addDays(isoDate: ISODate, days: number): ISODate {
  const date = parseISODate(isoDate);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** Adds calendar months, clamping to the last day (Jan 31 + 1 month → Feb 28/29). */
export function addMonths(isoDate: ISODate, months: number): ISODate {
  const date = parseISODate(isoDate);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDayOfMonth));
  return toISODate(date);
}

/** Whole days from `fromIso` to `toIso` (negative when `toIso` is earlier). */
export function diffInDays(fromIso: ISODate, toIso: ISODate): number {
  // Rounding absorbs the one-hour shift on daylight-saving transitions.
  return Math.round((parseISODate(toIso).getTime() - parseISODate(fromIso).getTime()) / MS_PER_DAY);
}

/* ---------- Formatting ---------- */

const longDateFormatter = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
const shortDateFormatter = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long' });
const fullDateFormatter = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });
const narrowWeekdayFormatter = new Intl.DateTimeFormat(LOCALE, { weekday: 'narrow' });

/** e.g. "الاثنين، 5 أكتوبر" */
export function formatLongDate(isoDate: ISODate): string {
  return longDateFormatter.format(parseISODate(isoDate));
}

/** e.g. "5 أكتوبر", with the year only when it differs from today's. */
export function formatShortDate(isoDate: ISODate, today: ISODate = getToday()): string {
  const sameYear = isoDate.slice(0, 4) === today.slice(0, 4);
  return (sameYear ? shortDateFormatter : fullDateFormatter).format(parseISODate(isoDate));
}

/** Single-letter weekday, e.g. "ن" for Monday. */
export function formatWeekdayNarrow(isoDate: ISODate): string {
  return narrowWeekdayFormatter.format(parseISODate(isoDate));
}

/** Human, relative wording for a review date: "اليوم"، "غدًا"، "بعد 4 أيام"، "18 أكتوبر". */
export function formatRelativeDate(isoDate: ISODate, today: ISODate = getToday()): string {
  const diff = diffInDays(today, isoDate);

  if (diff === 0) return 'اليوم';
  if (diff === 1) return 'غدًا';
  if (diff === -1) return 'أمس';
  if (diff < 0) return `منذ ${formatCount(-diff, 'days')}`;
  if (diff <= 10) return `بعد ${formatCount(diff, 'days')}`;
  return formatShortDate(isoDate, today);
}
