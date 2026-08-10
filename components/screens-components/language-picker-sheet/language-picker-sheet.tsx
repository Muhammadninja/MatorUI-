import { CheckCircle2, X } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Dimensions, Modal, Pressable, View } from 'react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import {
  LANGUAGE_OPTIONS,
  useLanguageContext,
  type LanguageCode,
} from '@/contexts/language.context';
import { useThemeContext } from '@/contexts/theme.context';
import { triggerHaptic } from '@/utils/haptics';

export type LanguagePickerSheetProps = {
  visible: boolean;
  onClose: () => void;
};

/**
 * Bottom-sheet language picker used from Settings. Onboarding still uses
 * the full-screen [[select-language-screen]] for the first-launch flow —
 * this sheet is the in-app "change language" affordance.
 *
 * Saves on tap (no separate CTA) so the row is the commit action.
 */
export default function LanguagePickerSheet({ visible, onClose }: LanguagePickerSheetProps) {
  const { tokens, scheme } = useThemeContext();
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguageContext();
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

  const handlePick = async (code: LanguageCode) => {
    triggerHaptic('selection');
    await setLanguage(code);
    onClose();
  };

  const handleClose = () => {
    triggerHaptic('selection');
    onClose();
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={handleClose}>
      <AppView flex={1} justify="flex-end" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <AppPressableView style={{ flex: 1 }} onPress={handleClose} accessibilityLabel={t('languageSheet.dismiss')} />
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

          {/* Header row: title + close */}
          <AppView row align="center" justify="space-between" px={20} pb={8}>
            <AppText textVariant="bodySemibold" family="heading" weight="bold">
              {t('languageSheet.title')}
            </AppText>
            <Pressable
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={({ pressed }) => ({
                width: 32,
                height: 32,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: tokens.border,
                backgroundColor: isDark ? tokens.backgroundSecondary : tokens.white,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <X size={16} strokeWidth={2.2} color={tokens.text} />
            </Pressable>
          </AppView>

          {/* Options */}
          <AppView gap={10} px={20} pb={20}>
            {LANGUAGE_OPTIONS.map((opt) => {
              const selected = opt.code === language;
              return (
                <Pressable
                  key={opt.code}
                  onPress={() => handlePick(opt.code)}
                  accessibilityRole="button"
                  accessibilityLabel={`${opt.englishName}, ${opt.nativeName}`}
                  accessibilityState={{ selected }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: selected ? tokens.brand : tokens.border,
                    backgroundColor: selected
                      ? `${tokens.brand}10`
                      : isDark
                        ? tokens.card
                        : tokens.white,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 999,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: selected
                        ? `${tokens.brand}25`
                        : tokens.backgroundSecondary,
                      borderWidth: 1,
                      borderColor: selected ? `${tokens.brand}40` : tokens.border,
                      overflow: 'hidden',
                    }}
                  >
                    <AppText style={{ fontSize: 24, lineHeight: 28 }}>{opt.flag}</AppText>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText textVariant="bodySemibold" weight="semibold" numberOfLines={1}>
                      {opt.nativeName}
                    </AppText>
                    <AppText textVariant="bodyXs" colorName="gray400" numberOfLines={1}>
                      {opt.englishName}
                    </AppText>
                  </View>
                  {selected ? (
                    <CheckCircle2 size={22} strokeWidth={2.2} color={tokens.brand} />
                  ) : (
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 999,
                        borderWidth: 2,
                        borderColor: tokens.border,
                      }}
                    />
                  )}
                </Pressable>
              );
            })}
          </AppView>
        </AppView>
        </Animated.View>
      </AppView>
    </Modal>
  );
}
