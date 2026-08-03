import { Heart, ListPlus, X } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Modal } from 'react-native';

import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { triggerHaptic } from '@/utils/haptics';

export type ListSuggestionSheetProps = {
  visible: boolean;
  onCreateList: () => void;
  onSkip: () => void;
};

/**
 * Bottom-sheet prompt that appears the FIRST time a user likes a product.
 * Surfaces the Lists feature ("we noticed you saved your first item —
 * want to group it into a list?"). Subsequent likes don't reopen it.
 */
export default function ListSuggestionSheet({
  visible,
  onCreateList,
  onSkip,
}: ListSuggestionSheetProps) {
  const { tokens, scheme } = useThemeContext();
  const isDark = scheme === 'dark';

  // Slide the panel up over a static (fading) backdrop so the screen underneath
  // stays put, rather than the whole modal window sliding up like a new screen.
  const translateY = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  useEffect(() => {
    if (visible) {
      translateY.setValue(Dimensions.get('window').height);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 90,
        friction: 12,
      }).start();
    }
  }, [visible, translateY]);

  const handleCreate = () => {
    triggerHaptic('selection');
    onCreateList();
  };

  const handleSkip = () => {
    triggerHaptic('selection');
    onSkip();
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={handleSkip}>
      <AppView flex={1} justify="flex-end" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <AppPressableView style={{ flex: 1 }} onPress={handleSkip} accessibilityLabel="Dismiss" />
        <Animated.View style={{ width: '100%', transform: [{ translateY }] }}>
        <AppView
          roundedTop={28}
          safeArea="bottom"
          style={{
            width: '100%',
            backgroundColor: isDark ? tokens.card : tokens.white,
            borderTopWidth: 1,
            borderTopColor: tokens.border,
          }}
        >
          {/* Drag handle */}
          <AppView center pt={10} pb={6}>
            <AppView
              rounded={36}
              style={{ width: 36, height: 4, backgroundColor: tokens.divider }}
            />
          </AppView>

          {/* Close X */}
          <AppView row align="center" justify="flex-end" px={16}>
            <AppPressableView
              center
              rounded={36}
              onPress={handleSkip}
              androidRipple
              accessibilityLabel="Close"
              style={{
                width: 32,
                height: 32,
                borderWidth: 1,
                borderColor: tokens.border,
              }}
            >
              <X size={16} strokeWidth={2.2} color={tokens.text} />
            </AppPressableView>
          </AppView>

          <AppView px={20} pb={24} gap={16}>
            {/* Heart-on-pedestal hero */}
            <AppView center>
              <AppView
                center
                rounded={36}
                style={{
                  width: 64,
                  height: 64,
                  backgroundColor: `${tokens.error}18`,
                  borderWidth: 1,
                  borderColor: `${tokens.error}30`,
                }}
              >
                <Heart size={28} strokeWidth={2.2} color={tokens.error} fill={tokens.error} />
              </AppView>
            </AppView>

            <AppView gap={6} align="center">
              <AppText textVariant="title" family="heading" weight="bold">
                Saved! Want to organize?
              </AppText>
              <AppText
                textVariant="bodySm"
                colorName="gray400"
                style={{ textAlign: 'center', maxWidth: 320 }}
              >
                You can group saved items into Lists by build, vehicle, season, or
                anything else. They show up under Lists in the Cart tab.
              </AppText>
            </AppView>

            <AppView gap={10}>
              <AppButton
                kind="brand"
                size="md"
                fullWidth
                onPress={handleCreate}
                accessibilityLabel="Create a new list"
              >
                <AppView row align="center" justify="center" gap={8}>
                  <ListPlus size={18} strokeWidth={2.4} color={tokens.onBrand} />
                  <AppText weight="semibold" style={{ color: tokens.onBrand }}>
                    Create a list
                  </AppText>
                </AppView>
              </AppButton>
              <AppButton
                title="Maybe later"
                kind="secondary"
                variant="outline"
                size="md"
                fullWidth
                onPress={handleSkip}
              />
            </AppView>
          </AppView>
        </AppView>
        </Animated.View>
      </AppView>
    </Modal>
  );
}
