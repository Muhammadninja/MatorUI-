import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  focus: null as null | (() => void),
  session: null as null | object,
}));
vi.mock('@/services/auth-storage', () => ({ getCurrentSession: () => mocks.session }));
vi.mock('expo-router', () => ({
  router: { push: mocks.push },
  useFocusEffect: (run: () => void) => {
    mocks.focus = run;
  },
}));

import { useSourcingSignInGate } from './use-sourcing-sign-in-gate';

const submit = vi.fn();
let request: (id: string) => void;

function Probe({ isAuthenticated, ready = true }: { isAuthenticated: boolean; ready?: boolean }) {
  request = useSourcingSignInGate<string>({ isAuthenticated, ready, submit });
  return null;
}

function mount(isAuthenticated: boolean) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<Probe isAuthenticated={isAuthenticated} />);
  });
  return (next: boolean, ready = true) =>
    act(() => {
      r.update(<Probe isAuthenticated={next} ready={ready} />);
    });
}

beforeEach(() => {
  submit.mockReset();
  mocks.push.mockReset();
  mocks.session = null;
});

describe('sourcing sign-in gate', () => {
  test('a guest goes to the existing sign-in, and nothing is sent yet', () => {
    mount(false);
    act(() => request('a1'));
    expect(mocks.push).toHaveBeenCalledWith('/sign-in?gate=1');
    expect(submit).not.toHaveBeenCalled();
  });

  test('signing in sends the held request exactly once', () => {
    const setAuth = mount(false);
    act(() => request('a1'));
    setAuth(true);
    setAuth(true);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith('a1');
  });

  test('waits until the account has loaded', () => {
    const setAuth = mount(false);
    act(() => request('a1'));
    setAuth(true, false);
    expect(submit).not.toHaveBeenCalled();
    setAuth(true, true);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  test('dismissing the sheet and signing in later sends nothing', () => {
    const setAuth = mount(false);
    act(() => request('a1'));
    act(() => mocks.focus?.());
    setAuth(true);
    expect(submit).not.toHaveBeenCalled();
  });

  test('the sheet closing before the screen knows about the sign-in keeps the request', () => {
    const setAuth = mount(false);
    act(() => request('a1'));
    // The code is verified and the sheet closes; this screen is focused again
    // while it still renders as signed out.
    mocks.session = { accessToken: 't' };
    act(() => mocks.focus?.());
    setAuth(true);
    expect(submit).toHaveBeenCalledWith('a1');
  });

  test('signing in without asking sends nothing', () => {
    const setAuth = mount(false);
    setAuth(true);
    expect(submit).not.toHaveBeenCalled();
  });

  test('a signed-in customer sends straight away', () => {
    mount(true);
    act(() => request('a1'));
    expect(submit).toHaveBeenCalledWith('a1');
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
