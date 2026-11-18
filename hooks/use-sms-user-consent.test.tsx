import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, test, vi } from 'vitest';

vi.mock('@/modules/sms-user-consent', () => ({ SmsUserConsent: null }));

import { useSmsUserConsent } from './use-sms-user-consent';
import type { SmsConsentEvent } from '@/modules/sms-user-consent';

function fakeNative() {
  let listener: ((e: SmsConsentEvent) => void) | null = null;
  const remove = vi.fn(() => {
    listener = null;
  });
  const native = {
    start: vi.fn(() => true),
    stop: vi.fn(),
    addListener: vi.fn((_: string, l: (e: SmsConsentEvent) => void) => {
      listener = l;
      return { remove };
    }),
  };
  return { native, remove, emit: (e: SmsConsentEvent) => act(() => listener?.(e)) };
}

type ProbeProps = { listenKey: string | null; onMessage: (m: string) => void; native: unknown };
function Probe({ listenKey, onMessage, native }: ProbeProps) {
  useSmsUserConsent(listenKey, onMessage, native as never);
  return null;
}

function mount(props: ProbeProps) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<Probe {...props} />);
  });
  return {
    update: (next: Partial<ProbeProps>) => act(() => r.update(<Probe {...props} {...next} />)),
    unmount: () => act(() => r.unmount()),
  };
}

describe('useSmsUserConsent', () => {
  test('does nothing without a listen key or without the native module', () => {
    const { native } = fakeNative();
    mount({ listenKey: null, onMessage: vi.fn(), native });
    mount({ listenKey: 'otp_1', onMessage: vi.fn(), native: null });
    expect(native.start).not.toHaveBeenCalled();
  });

  test('starts listening and passes an allowed message on', () => {
    const { native, emit } = fakeNative();
    const onMessage = vi.fn();
    mount({ listenKey: 'otp_1', onMessage, native });
    expect(native.start).toHaveBeenCalledTimes(1);
    emit({ status: 'received', message: 'Mator ilovasi: tasdiqlash kodingiz 483917.' });
    expect(onMessage).toHaveBeenCalledWith('Mator ilovasi: tasdiqlash kodingiz 483917.');
  });

  test('ignores denied, timed out and failed prompts', () => {
    const { native, emit } = fakeNative();
    const onMessage = vi.fn();
    mount({ listenKey: 'otp_1', onMessage, native });
    emit({ status: 'denied' });
    emit({ status: 'timeout' });
    emit({ status: 'error' });
    expect(onMessage).not.toHaveBeenCalled();
  });

  test('a resent code restarts the window; unmount stops it', () => {
    const { native, remove } = fakeNative();
    const view = mount({ listenKey: 'otp_1', onMessage: vi.fn(), native });
    view.update({ listenKey: 'otp_2' });
    expect(native.stop).toHaveBeenCalledTimes(1);
    expect(native.start).toHaveBeenCalledTimes(2);
    view.unmount();
    expect(native.stop).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalledTimes(2);
  });

  test('a native start failure does not throw into the screen', () => {
    const { native } = fakeNative();
    native.start.mockImplementation(() => {
      throw new Error('no play services');
    });
    expect(() => mount({ listenKey: 'otp_1', onMessage: vi.fn(), native })).not.toThrow();
  });
});
