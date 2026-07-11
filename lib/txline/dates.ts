/** Default when browser/server timezone is unavailable (product origin). */
export const DEFAULT_USER_TIMEZONE = 'Africa/Lagos';

/** @deprecated use DEFAULT_USER_TIMEZONE or pass explicit viewer timezone */
export const USER_TIMEZONE = DEFAULT_USER_TIMEZONE;

/** WC 2026 host kickoff reference (US Eastern). */
export const HOST_TIMEZONE = 'America/New_York';

/** TxLINE epochDay / hour buckets in their API (UTC calendar day). */
export const TXLINE_TIMEZONE = 'UTC';

/** @deprecated use USER_TIMEZONE */
export const BOARD_TIMEZONE = USER_TIMEZONE;

export const WC_2026_DURATION_DAYS = 38;

export function resolveUserTimeZone(timeZone?: string | null): string {
  if (!timeZone?.trim()) return DEFAULT_USER_TIMEZONE;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timeZone.trim() });
    return timeZone.trim();
  } catch {
    return DEFAULT_USER_TIMEZONE;
  }
}

export function formatTimezoneShort(timeZone: string, date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    timeZoneName: 'short',
  }).formatToParts(date);
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? timeZone;
}

export function getEpochDay(date: Date, timeZone = DEFAULT_USER_TIMEZONE): number {
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

/** TxLINE epoch day for a timestamp (UTC). */
export function getTxlineEpochDay(startTimeMs: number): number {
  return getEpochDay(new Date(startTimeMs), TXLINE_TIMEZONE);
}

/**
 * TxLINE day buckets to query when building a user-facing board day.
 * Covers fixtures whose kickoff is on the user's calendar date but may sit
 * on an adjacent UTC day in TxLINE's hourly archive.
 */
export function getTxlineEpochDaysForUserDay(userEpochDay: number): number[] {
  return [userEpochDay - 1, userEpochDay, userEpochDay + 1];
}

export function formatEpochDayLabel(
  epochDay: number,
  today: number,
  timeZone = DEFAULT_USER_TIMEZONE
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

/** True when host (US ET) calendar date differs from the viewer's selected board day. */
export function hostDateDiffersFromUserDay(
  userEpochDay: number,
  userTimeZone = DEFAULT_USER_TIMEZONE
): boolean {
  const noonMs = userEpochDay * 86400000 + 12 * 60 * 60_000;
  return getEpochDay(new Date(noonMs), HOST_TIMEZONE) !== getEpochDay(new Date(noonMs), userTimeZone);
}

export function formatHostDayHint(
  userEpochDay: number,
  userTimeZone = DEFAULT_USER_TIMEZONE
): string | null {
  const noonMs = userEpochDay * 86400000 + 12 * 60 * 60_000;
  const hostDay = getEpochDay(new Date(noonMs), HOST_TIMEZONE);
  const viewerDay = getEpochDay(new Date(noonMs), userTimeZone);
  if (hostDay === viewerDay) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: HOST_TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).formatToParts(new Date(hostDay * 86400000));
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  return `${weekday} ${day} ${month} US ET`;
}

export function fixtureStartsOnEpochDay(
  startTimeMs: number,
  epochDay: number,
  timeZone = DEFAULT_USER_TIMEZONE
): boolean {
  return getEpochDay(new Date(startTimeMs), timeZone) === epochDay;
}

export function formatKickoff(startTimeMs: number, timeZone = DEFAULT_USER_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).formatToParts(new Date(startTimeMs));
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

const TZ_SHORT: Record<string, string> = {
  'Africa/Lagos': 'WAT',
  'America/New_York': 'ET',
  UTC: 'UTC',
};

export function formatKickoffWithZone(startTimeMs: number, timeZone: string): string {
  const label = TZ_SHORT[timeZone] ?? formatTimezoneShort(timeZone, new Date(startTimeMs));
  return `${formatKickoff(startTimeMs, timeZone)} ${label}`;
}

/** Viewer-local kickoff + US host (ET) reference for WC fixtures. */
export function formatKickoffDual(
  startTimeMs: number,
  userTimeZone = DEFAULT_USER_TIMEZONE
): string {
  const local = formatKickoffWithZone(startTimeMs, resolveUserTimeZone(userTimeZone));
  if (resolveUserTimeZone(userTimeZone) === HOST_TIMEZONE) return local;
  return `${local} · ${formatKickoffWithZone(startTimeMs, HOST_TIMEZONE)}`;
}
