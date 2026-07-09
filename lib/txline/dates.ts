export const BOARD_TIMEZONE = 'Africa/Lagos';
export const WC_2026_DURATION_DAYS = 38;

export function getEpochDay(date: Date, timeZone = BOARD_TIMEZONE): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = Number(parts.find((p) => p.type === 'year')?.value ?? 0);
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? 1);
  const day = Number(parts.find((p) => p.type === 'day')?.value ?? 1);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

export const WC_2026_START_EPOCH_DAY = getEpochDay(new Date('2026-06-11T12:00:00Z'));

export function formatEpochDayLabel(
  epochDay: number,
  today: number,
  timeZone = BOARD_TIMEZONE
): string {
  if (epochDay === today) return 'Today';
  if (epochDay === today - 1) return 'Yesterday';
  if (epochDay === today + 1) return 'Tomorrow';

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).formatToParts(new Date(epochDay * 86400000));

  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  return `${weekday} ${day} ${month}`;
}

export function fixtureStartsOnEpochDay(
  startTimeMs: number,
  epochDay: number,
  timeZone = BOARD_TIMEZONE
): boolean {
  return getEpochDay(new Date(startTimeMs), timeZone) === epochDay;
}
