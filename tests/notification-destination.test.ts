/**
 * Where a tapped notification goes. Notifications sits on the root stack, so a
 * push into a tab's stack doesn't animate, leaves that tab stuck on the pushed
 * screen, and Back can't return here. Every destination must be a root route.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { notificationDestination } from '@/components/screens-components/notifications/notification-destination';
import type { NotificationItem } from '@/services/notifications-service';

const row = (over: Partial<NotificationItem>) => ({ id: 'n1', ...over }) as NotificationItem;
const TAB_ORDER_LINK = '/(tabs)/(cart)/order-confirmation';

describe('notificationDestination', () => {
  test('a car update opens the root vehicle screen, not the Garage tab', () => {
    const n = row({
      type: 'vehicle_status_updated',
      vehicleId: 'veh 1',
      deeplinkPath: '/(tabs)/(garage)/vehicle/veh 1',
    });
    expect(notificationDestination(n, true)).toBe('/notification-vehicle?id=veh%201');
  });

  test('a car that has left the garage has nowhere to go', () => {
    const n = row({ type: 'vehicle_status_updated', vehicleId: 'veh1' });
    expect(notificationDestination(n, false)).toBeNull();
  });

  test.each(['order_status_changed', 'order_paid'])('%s opens that order on track-order', (type) => {
    const n = row({ type, orderId: 'ord/1', deeplinkPath: TAB_ORDER_LINK });
    expect(notificationDestination(n, false)).toBe('/track-order?orderId=ord%2F1');
  });

  test('an order row without an id is not sent to a screen with no order', () => {
    const n = row({ type: 'order_paid', deeplinkPath: TAB_ORDER_LINK });
    expect(notificationDestination(n, false)).toBeNull();
  });

  test.each(['/(tabs)/(services)/booking/1', '/(tabs)/(advisor)/session/1'])(
    'a tab link is never followed: %s',
    (deeplinkPath) => {
      expect(notificationDestination(row({ type: 'other', deeplinkPath }), false)).toBeNull();
    },
  );

  test('a root link is followed as sent', () => {
    const n = row({ type: 'sourcing_offer', deeplinkPath: '/sourcing/offer/o1' });
    expect(notificationDestination(n, false)).toBe('/sourcing/offer/o1');
  });

  test('no link means no destination', () => {
    expect(notificationDestination(row({ type: 'other' }), false)).toBeNull();
  });
});

describe('the routes those destinations use', () => {
  const root = join(__dirname, '..');

  test.each(['notification-vehicle', 'track-order'])('%s is on the root stack', (route) => {
    expect(existsSync(join(root, 'app', `${route}.tsx`))).toBe(true);
    const layout = readFileSync(join(root, 'app/_layout.tsx'), 'utf8');
    expect(layout).toContain(`name="${route}"`);
  });
});
