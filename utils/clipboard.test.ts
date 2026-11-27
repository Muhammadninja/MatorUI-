import { afterEach, describe, expect, it, vi } from 'vitest';

const setStringAsync = vi.fn(async () => true);

async function load(nativeModule: object | null) {
  vi.resetModules();
  vi.doMock('expo', () => ({ requireOptionalNativeModule: () => nativeModule }));
  vi.doMock('expo-clipboard', () => ({ setStringAsync }));
  return import('./clipboard');
}

afterEach(() => {
  setStringAsync.mockClear();
  vi.doUnmock('expo');
  vi.doUnmock('expo-clipboard');
});

describe('clipboard', () => {
  it('offers no copy on a build without the native module (≤1.1.0)', async () => {
    const { canCopyToClipboard, copyToClipboard } = await load(null);
    expect(canCopyToClipboard).toBe(false);
    await expect(copyToClipboard('26391154')).resolves.toBe(false);
    expect(setStringAsync).not.toHaveBeenCalled();
  });

  it('copies when the native module is present', async () => {
    const { canCopyToClipboard, copyToClipboard } = await load({});
    expect(canCopyToClipboard).toBe(true);
    await expect(copyToClipboard('26391154')).resolves.toBe(true);
    expect(setStringAsync).toHaveBeenCalledWith('26391154');
  });

  it('reports failure instead of throwing', async () => {
    setStringAsync.mockRejectedValueOnce(new Error('denied'));
    const { copyToClipboard } = await load({});
    await expect(copyToClipboard('x')).resolves.toBe(false);
  });
});
