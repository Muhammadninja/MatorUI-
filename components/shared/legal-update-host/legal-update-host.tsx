import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppBottomSheet } from '@/components/shared/app-bottom-sheet';
import { AppButton } from '@/components/shared/app-button';
import { AppCheckbox } from '@/components/shared/app-checkbox';
import LegalDocumentScreen from '@/components/screens/legal-document-screen';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import { useAcceptLegal, useLegalDocuments, useLegalStatus } from '@/hooks/use-legal';
import { useToast } from '@/hooks/use-toast';
import type { LegalDocumentType } from '@/types/legal';

/**
 * MANDATORY legal acceptance gate for SIGNED-IN users.
 *
 * Policy (product decision — deliberately different per user state):
 *
 *   anonymous browsing        → no prompt at all, and no /status request
 *   registration              → consent collected at OTP (see the auth screen)
 *   authenticated + required  → BLOCKING, no way past it but accepting
 *
 * Blocking is achieved with the same primitive `AppGateHost` uses for the
 * mandatory-update gate: a non-dismissible `AppBottomSheet`. It renders in a
 * native `Modal` above the whole navigation tree, so while it is visible the
 * user cannot reach tabs, Settings, a deep link, or anything else — and
 * `dismissOnOverlayPress={false}` + `swipeToClose={false}` + a no-op
 * `onRequestClose` close the overlay-tap, swipe-down and Android-back routes
 * out. There is no Later/Skip/Close control anywhere in this component.
 *
 * This is NOT a route guard: nothing wraps or intercepts navigation, and an
 * anonymous user is never affected.
 */
export function LegalUpdateHost() {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const { isAuthenticated } = useUserContext();
  const toast = useToast();

  // The status query is gated on the session — an anonymous user never hits
  // this authenticated endpoint (it would 401 anyway).
  const { status, requiresAcceptance, outstandingTypes, isLoading, isError, refresh } =
    useLegalStatus(isAuthenticated);
  const { documents } = useLegalDocuments();
  const { accept, isPending } = useAcceptLegal();

  const [checked, setChecked] = React.useState<Record<string, boolean>>({});
  /** Which document the user is currently reading, if any. Rendered INSIDE the
   *  gate's own Modal (see the note above the document branch below). */
  const [reading, setReading] = React.useState<LegalDocumentType | null>(null);

  // Re-check on resume. This is the app's first AppState listener (nothing
  // else registers one today), so it is deliberately narrow: signed-in only,
  // and it unsubscribes with the component. `refresh()` is a refetch, which
  // bypasses the client's 5-min staleTime by design — a legal requirement
  // published while the app was backgrounded should surface on return.
  React.useEffect(() => {
    if (!isAuthenticated) return;
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') refresh();
    });
    return () => sub.remove();
  }, [isAuthenticated, refresh]);

  // Reset the ticks whenever the required set changes, so a newly published
  // document is never covered by a stale check.
  React.useEffect(() => {
    setChecked({});
    setReading(null);
  }, [outstandingTypes.join(',')]);

  // Anonymous users are never gated — this is the whole point of the policy.
  if (!isAuthenticated) return null;

  // Status could not be determined for a signed-in user. We must NOT assume
  // acceptance and silently expose the authenticated app, so show a blocking
  // retry instead.
  if (isError) {
    return (
      <AppBottomSheet
        visible
        onClose={() => undefined}
        dismissOnOverlayPress={false}
        swipeToClose={false}
        heightFraction={0.34}
      >
        <AppView px="xl" pt="md" pb="lg" gap={16} align="center">
          <AppText
            family="heading"
            weight="bold"
            style={{ fontSize: 18, color: tokens.text, textAlign: 'center' }}
          >
            {t('legal.statusErrorTitle')}
          </AppText>
          <AppText
            family="default"
            style={{
              fontSize: 13.5,
              lineHeight: 20,
              color: tokens.textMuted,
              textAlign: 'center',
              maxWidth: 300,
            }}
          >
            {t('legal.statusErrorBody')}
          </AppText>
          <AppView style={{ alignSelf: 'stretch', marginTop: 4 }}>
            <AppButton
              testID="legal-status-retry"
              title={t('common.retry')}
              kind="brand"
              onPress={refresh}
            />
          </AppView>
        </AppView>
      </AppBottomSheet>
    );
  }

  // Still resolving, or nothing required → render nothing. `isLoading` is
  // never treated as "no acceptance required": the gate simply hasn't
  // resolved yet, and the sheet appears the moment it does.
  if (isLoading || !requiresAcceptance) return null;

  const allChecked =
    outstandingTypes.length > 0 && outstandingTypes.every((type) => checked[type]);

  /** Accept exactly the versions the backend currently requires — read off the
   *  status response, never incremented or guessed locally. */
  const onAccept = async () => {
    const acceptances = (status?.documents ?? [])
      .filter((d) => !d.accepted)
      .map((d) => ({ type: d.type, version: d.required_version }));
    if (acceptances.length === 0) return;
    try {
      // The response carries the updated status and seeds the cache, so the
      // gate closes off that alone — no follow-up /status request.
      await accept(acceptances);
    } catch {
      toast.danger(t('legal.acceptError'));
    }
  };

  const titleOf = (type: LegalDocumentType) =>
    documents.find((d) => d.type === type)?.title ?? t(`legal.types.${type}`);

  // Reading a document.
  //
  // The gate lives in a native `Modal`, which renders above the ENTIRE
  // navigator — so `router.push` would put the document underneath it, leaving
  // the user unable to read what they're being asked to accept. Instead the
  // document is rendered INSIDE the same Modal, replacing the sheet's content
  // at full height.
  //
  // This keeps the gate blocking rather than weakening it: `requires_acceptance`
  // is untouched, the Modal never closes, the dismiss props stay false, and the
  // only way out is Back (which returns here, to the same gate) or accepting.
  // Nothing in the authenticated app becomes reachable.
  if (reading) {
    return (
      <AppBottomSheet
        visible
        // Android hardware back (Modal's onRequestClose) closes the DOCUMENT
        // and returns to the gate — it never dismisses the gate itself.
        onClose={() => setReading(null)}
        dismissOnOverlayPress={false}
        swipeToClose={false}
        // Full height and non-expandable so the document gets a real reading
        // surface with its own scroll, not a third of the screen.
        heightFraction={1}
        expandable={false}
      >
        <LegalDocumentScreen
          type={reading}
          // Back returns to the gate instead of navigating: there is no route
          // to pop, and leaving via the navigator would escape the gate.
          onBack={() => setReading(null)}
        />
      </AppBottomSheet>
    );
  }

  return (
    <AppBottomSheet
      visible
      // No-op: there is no dismiss path out of a mandatory gate. This also
      // neutralizes Android's hardware back (Modal's onRequestClose).
      onClose={() => undefined}
      dismissOnOverlayPress={false}
      swipeToClose={false}
      heightFraction={0.5}
    >
      <AppView px={20} pt="md" pb="lg" gap={14}>
        <AppView gap={6}>
          <AppText family="heading" weight="bold" style={{ fontSize: 18, color: tokens.text }}>
            {t('legal.updatedTitle')}
          </AppText>
          <AppText family="default" style={{ fontSize: 13, lineHeight: 19, color: tokens.textMuted }}>
            {t('legal.updatedBody')}
          </AppText>
        </AppView>

        <AppView gap={10}>
          {outstandingTypes.map((type) => (
            <AppCheckbox
              key={type}
              testID={`legal-update-${type}`}
              checked={!!checked[type]}
              accessibilityLabel={titleOf(type)}
              onChange={(next) => setChecked((prev) => ({ ...prev, [type]: next }))}
            >
              <AppPressableView
                onPress={() => setReading(type)}
                accessibilityRole="button"
                accessibilityLabel={titleOf(type)}
              >
                <AppText
                  family="default"
                  weight="semibold"
                  underline
                  style={{ fontSize: 13, color: tokens.text }}
                >
                  {titleOf(type)}
                </AppText>
              </AppPressableView>
            </AppCheckbox>
          ))}
        </AppView>

        {/* Sole control: accept. No Later / Skip / Close / dismiss. */}
        <AppButton
          testID="legal-update-accept"
          title={t('legal.acceptAndContinue')}
          kind="brand"
          size="lg"
          fullWidth
          disabled={!allChecked || isPending}
          onPress={onAccept}
        />
      </AppView>
    </AppBottomSheet>
  );
}

export default LegalUpdateHost;
