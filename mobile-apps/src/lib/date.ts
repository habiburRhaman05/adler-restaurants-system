/** Month helpers shared by the scheduling screens. Month key format: 'YYYY-MM'. */

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const pad = (n: number) => n.toString().padStart(2, '0');

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function parseMonthKey(key: string): { year: number; month: number } {
  const [y, m] = key.split('-').map(Number);
  return { year: y, month: m - 1 };
}

export function addMonths(key: string, delta: number): string {
  const { year, month } = parseMonthKey(key);
  return monthKey(new Date(year, month + delta, 1));
}

export function monthLabel(key: string): string {
  const { year, month } = parseMonthKey(key);
  return `${MONTH_NAMES[month]} ${year}`;
}

export function daysInMonth(key: string): number {
  const { year, month } = parseMonthKey(key);
  return new Date(year, month + 1, 0).getDate();
}

/** Weekday offset (0 = Sunday) of day 1 of the month. */
export function firstDayOffset(key: string): number {
  const { year, month } = parseMonthKey(key);
  return new Date(year, month, 1).getDay();
}

/** '2026-07-05' → 'Sun 5 Jul' style pieces for shift cards. */
export function shiftDateParts(dateStr: string): { dayNum: number; monthShort: string; weekday: string } {
  const d = new Date(`${dateStr}T00:00:00`);
  return {
    dayNum: d.getDate(),
    monthShort: MONTH_SHORT[d.getMonth()],
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
  };
}

/** '2026-07-06' + '2026-07-12' → '6 Jul – 12 Jul 2026' week-range label. */
export function formatDateRange(startStr: string, endStr: string): string {
  const s = new Date(`${startStr}T00:00:00`);
  const e = new Date(`${endStr}T00:00:00`);
  const sameYear = s.getFullYear() === e.getFullYear();
  const startPart = `${s.getDate()} ${MONTH_SHORT[s.getMonth()]}${sameYear ? '' : ` ${s.getFullYear()}`}`;
  return `${startPart} – ${e.getDate()} ${MONTH_SHORT[e.getMonth()]} ${e.getFullYear()}`;
}

export function formatCutoff(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
