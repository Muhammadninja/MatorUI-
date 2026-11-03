import { describe, expect, test } from 'vitest';

import {
  localizedNotificationTime,
  notificationDayGroup,
} from '@/components/screens-components/notifications/notification-time';

const NOW = new Date(2026, 10, 3, 12, 0, 0);
const at = (day: number, hour: number) => new Date(2026, 10, day, hour, 0, 0).toISOString();
const t = (key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${options.count}` : key;

describe('notificationDayGroup', () => {
  test('sorts by calendar day, not by a 24-hour window', () => {
    expect(notificationDayGroup(at(3, 0), NOW)).toBe('today');
    expect(notificationDayGroup(at(2, 23), NOW)).toBe('yesterday');
    expect(notificationDayGroup(at(2, 0), NOW)).toBe('yesterday');
    expect(notificationDayGroup(at(1, 23), NOW)).toBe('earlier');
  });

  test('a missing or invalid timestamp is never "today"', () => {
    expect(notificationDayGroup(undefined, NOW)).toBe('earlier');
    expect(notificationDayGroup('not a date', NOW)).toBe('earlier');
  });
});

describe('localizedNotificationTime', () => {
  test('uses translated minute and hour labels', () => {
    expect(localizedNotificationTime(at(3, 12), t, 'ru', NOW)).toBe('notifications.timeNow');
    expect(localizedNotificationTime(at(3, 10), t, 'ru', NOW)).toBe('notifications.timeHours:2');
    const fiveMinutes = new Date(NOW.getTime() - 5 * 60000).toISOString();
    expect(localizedNotificationTime(fiveMinutes, t, 'ru', NOW)).toBe(
      'notifications.timeMinutes:5',
    );
  });

  test('shows nothing rather than a guess when there is no timestamp', () => {
    expect(localizedNotificationTime(undefined, t, 'ru', NOW)).toBe('');
  });
});
