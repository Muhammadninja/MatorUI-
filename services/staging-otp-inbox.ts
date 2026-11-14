/**
 * Staging tester OTP inbox — how a tester gets their sign-in code on the
 * staging API, which sends no SMS.
 *
 * `GET /v1/staging/otp/inbox` lists the pending codes for the numbers bound to
 * the CALLING tester. The tester is identified by the staging proxy from the
 * per-tester access token this device already sends (see staging-access.ts);
 * nothing here adds a credential. The backend answers 404 to anyone else and on
 * any server where the inbox is off.
 *
 * The code is returned to the caller only. Never log it, put it in a toast,
 * or send it to analytics. It is written straight into the code field, and the
 * user still taps the verify button themselves.
 */

import { ApiError, apiClient } from '@/services/api-client';
import { isStagingBuild } from '@/services/staging-access';

interface InboxItem {
  request_id?: unknown;
  code?: unknown;
}

export type StagingOtpLookup =
  | { status: 'found'; code: string }
  | { status: 'none' }
  | { status: 'unavailable' };

/**
 * The pending code for one OTP request (`request_id`, the app's `otpToken`),
 * or why there is none. Always `unavailable` outside a staging build, without
 * making a request.
 */
export async function fetchStagingOtpCode(requestId: string): Promise<StagingOtpLookup> {
  if (!isStagingBuild() || !requestId) return { status: 'unavailable' };
  try {
    const res = await apiClient.get<{ items?: InboxItem[] }>('/v1/staging/otp/inbox', {
      // The inbox is keyed to the tester, not to an app account: it is used
      // before sign-in, and a session must not be refreshed for it.
      skipAuth: true,
    });
    const item = (res?.items ?? []).find((i) => i.request_id === requestId);
    const code = typeof item?.code === 'string' ? item.code : '';
    return /^\d{4,8}$/.test(code) ? { status: 'found', code } : { status: 'none' };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return { status: 'unavailable' };
    throw err;
  }
}
