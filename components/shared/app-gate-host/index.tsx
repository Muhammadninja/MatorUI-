import { ArrowDownToLine, WifiOff } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';

import { AppBottomSheet } from '@/components/shared/app-bottom-sheet';
import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useAppUpdateGate } from '@/hooks/use-app-update-gate';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { triggerHaptic } from '@/utils/haptics';

/**
 * Global gate host — renders BLOCKING bottom sheets over the whole app:
 *
 *  1. Mandatory update — this build is below the server's minimum supported
 *     version (`/v1/app/config`). Takes precedence over everything.
 *  2. No internet — reactive via NetInfo; auto-dismisses when connectivity
 *     returns.
 *
 * Both are non-dismissible (no overlay tap, no swipe, no Android back): the user
 * can only act on the CTA. Mount once near the app root.
 */
export function AppGateHost() {
  const { t } = useTranslation();
  const { updateRequired, storeUrl } = useAppUpdateGate();
  const { isOffline, recheck } = useNetworkStatus();

  // Update outranks offline — never stack them.
  if (updateRequired) {
    return (
      <GateSheet
        icon={ArrowDownToLine}
        tone="brand"
        title={t('gate.updateTitle')}
        body={t('gate.updateBody')}
        cta={t('gate.updateCta')}
        onPress={() => {
          triggerHaptic('selection');
          void Linking.openURL(storeUrl);
        }}
      />
    );
  }

  if (isOffline) {
    return (
      <GateSheet
        icon={WifiOff}
        tone="muted"
        title={t('gate.offlineTitle')}
        body={t('gate.offlineBody')}
        cta={t('common.tryAgain')}
        onPress={() => {
          triggerHaptic('selection');
          recheck();
        }}
      />
    );
  }

  return null;
}

function GateSheet({
  icon: Icon,
  tone,
  title,
  body,
  cta,
  onPress,
}: {
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  tone: 'brand' | 'muted';
  title: string;
  body: string;
  cta: string;
  onPress: () => void;
}) {
  const { tokens } = useThemeContext();
  const accent = tone === 'brand' ? tokens.brand : tokens.textMuted;

  return (
    <AppBottomSheet
      visible
      onClose={() => undefined}
      dismissOnOverlayPress={false}
      swipeToClose={false}
      heightFraction={0.42}
    >
      <AppView px="xl" pt="md" pb="lg" gap={16} align="center">
        <AppView
          center
          rounded={999}
          style={{ width: 64, height: 64, backgroundColor: `${accent}1f` }}
        >
          <Icon size={30} color={accent} strokeWidth={2} />
        </AppView>

        <AppView align="center" gap={6}>
          <AppText family="heading" weight="bold" style={{ fontSize: 19, color: tokens.text, textAlign: 'center' }}>
            {title}
          </AppText>
          <AppText
            family="default"
            style={{ fontSize: 13.5, lineHeight: 20, color: tokens.textMuted, textAlign: 'center', maxWidth: 300 }}
          >
            {body}
          </AppText>
        </AppView>

        <AppView style={{ alignSelf: 'stretch', marginTop: 4 }}>
          <AppButton title={cta} kind="brand" onPress={onPress} />
        </AppView>
      </AppView>
    </AppBottomSheet>
  );
}

export default AppGateHost;
