import { router, useLocalSearchParams } from 'expo-router';
import { CheckCircle2, Globe } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import {
  LANGUAGE_OPTIONS,
  useLanguageContext,
  type LanguageCode,
} from '@/contexts/language.context';
import { useThemeContext } from '@/contexts/theme.context';
import { triggerHaptic } from '@/utils/haptics';

/**
 * Language picker. Two flavors via the `mode` param:
 *   - mode=onboarding (first launch): no back affordance, CTA reads
 *     "Continue", lands the user on /explore after save.
 *   - mode=edit (from Settings): close button in the corner, CTA reads
 *     "Save", navigates back on save.
 */
export default function SelectLanguageScreen() {
  const { tokens, scheme } = useThemeContext();
  const insets = useSafeAreaInsets();
  const { language, setLanguage } = useLanguageContext();
  const params = useLocalSearchParams<{ mode?: string }>();
  const isOnboarding = params.mode === 'onboarding';

  // Local pick — only committed when the user presses the CTA. Lets
  // them browse options without persistence churn.
  const [pick, setPick] = useState<LanguageCode>(language);

  useEffect(() => {
    setPick(language);
  }, [language]);

  const headlines = {
    en: { title: 'Choose your language', subtitle: 'You can change this anytime in Settings.' },
    ru: { title: 'Выберите язык', subtitle: 'Это можно изменить в настройках.' },
    uz: { title: 'Tilni tanlang', subtitle: 'Buni har doim sozlamalarda oʻzgartirishingiz mumkin.' },
  } as const;
  const ctaLabels = { en: { onboarding: 'Continue', edit: 'Save' }, ru: { onboarding: 'Продолжить', edit: 'Сохранить' }, uz: { onboarding: 'Davom etish', edit: 'Saqlash' } } as const;
  const headline = headlines[pick];
  const ctaLabel = ctaLabels[pick][isOnboarding ? 'onboarding' : 'edit'];

  const handleClose = () => {
    triggerHaptic('selection');
    if (router.canGoBack()) router.back();
    else router.replace('/profile');
  };

  const handleConfirm = async () => {
    triggerHaptic('success');
    await setLanguage(pick);
    if (isOnboarding) {
      router.replace('/explore');
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/profile');
    }
  };

  return (
    <AppView
      flex={1}
      colorName="background"
      style={{
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 16,
        paddingHorizontal: 20,
      }}
    >
      {/* Close button — edit mode only */}
      {!isOnboarding ? (
        <View style={{ alignItems: 'flex-end' }}>
          <Pressable
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: tokens.border,
              backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <AppText textVariant="bodySm" weight="bold">
              ×
            </AppText>
          </Pressable>
        </View>
      ) : null}

      {/* Headline */}
      <AppView align="center" gap={14} mt={isOnboarding ? 40 : 16}>
        <AppView
          center
          rounded={999}
          style={{
            width: 72,
            height: 72,
            backgroundColor: `${tokens.brand}1F`,
            borderWidth: 1,
            borderColor: `${tokens.brand}40`,
          }}
        >
          <Globe size={32} strokeWidth={2} color={tokens.brand} />
        </AppView>
        <AppView gap={6} align="center">
          <AppText
            textVariant="title"
            family="heading"
            weight="bold"
            align="center"
            colorName="text"
          >
            {headline.title}
          </AppText>
          <AppText
            textVariant="bodySm"
            colorName="gray400"
            align="center"
            style={{ maxWidth: 320 }}
          >
            {headline.subtitle}
          </AppText>
        </AppView>
      </AppView>

      {/* Spacer pushes the options + CTA to the bottom of the screen */}
      <View style={{ flex: 1 }} />

      {/* Options */}
      <AppView gap="md" mb="lg">
        {LANGUAGE_OPTIONS.map((opt) => {
          const selected = opt.code === pick;
          return (
            <Pressable
              key={opt.code}
              onPress={() => {
                triggerHaptic('selection');
                setPick(opt.code);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${opt.englishName}, ${opt.nativeName}`}
              accessibilityState={{ selected }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: selected ? tokens.brand : tokens.border,
                backgroundColor: selected
                  ? `${tokens.brand}10`
                  : scheme === 'dark'
                    ? tokens.card
                    : tokens.white,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
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
                <AppText style={{ fontSize: 26, lineHeight: 30 }}>
                  {opt.flag}
                </AppText>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText
                  textVariant="bodySemibold"
                  weight="semibold"
                  numberOfLines={1}
                >
                  {opt.nativeName}
                </AppText>
                <AppText
                  textVariant="bodyXs"
                  colorName="gray400"
                  numberOfLines={1}
                >
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

      <AppButton
        title={ctaLabel}
        kind="brand"
        size="lg"
        fullWidth
        onPress={handleConfirm}
      />
    </AppView>
  );
}
