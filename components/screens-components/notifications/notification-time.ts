/** Date helpers for the notifications feed, from real `created_at` timestamps. */

export type NotificationDayGroup = 'today' | 'yesterday' | 'earlier';

const DATE_LOCALES: Record<string, string> = { en: 'en-US', ru: 'ru-RU', uz: 'uz-UZ' };

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** Which calendar day a notification belongs to, in the phone's time zone. A
 *  missing or unparseable timestamp can't claim to be recent. */
export function notificationDayGroup(
  iso: string | undefined,
  now = new Date(),
): NotificationDayGroup {
  const ms = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(ms)) return 'earlier';
  const today = startOfDay(now);
  const day = startOfDay(new Date(ms));
  if (day >= today) return 'today';
  // Calendar arithmetic rather than 24h, so a DST day still has one "yesterday".
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
  return day >= yesterday ? 'yesterday' : 'earlier';
}

type T = (key: string, options?: Record<string, unknown>) => string;

/** "5 мин" within a day, otherwise the date ("3 нояб."), in the active language. */
export function localizedNotificationTime(
  iso: string | undefined,
  t: T,
  language: string,
  now = new Date(),
): string {
  const ms = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(ms)) return '';
  const minutes = Math.floor(Math.max(0, now.getTime() - ms) / 60000);
  if (minutes < 1) return t('notifications.timeNow');
  if (minutes < 60) return t('notifications.timeMinutes', { count: minutes });
  if (minutes < 24 * 60) return t('notifications.timeHours', { count: Math.floor(minutes / 60) });
  try {
    const label = new Date(ms).toLocaleDateString(DATE_LOCALES[language] ?? 'en-US', {
      day: 'numeric',
      month: 'short',
    });
    if (label && !/Invalid/i.test(label)) return label;
  } catch {
    // Fall through to the day count when the runtime can't format this locale.
  }
  return t('notifications.timeDays', { count: Math.floor(minutes / (24 * 60)) });
}
