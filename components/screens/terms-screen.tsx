import React from 'react';

import { useTranslation } from 'react-i18next';

import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

/**
 * Terms & Conditions — a plain, scrollable legal page reached from Settings.
 * The section copy below is a starting scaffold; replace it with the finalized
 * legal text (or point the screen at a hosted document) before release.
 */
function buildSections(t: (key: string) => string): { heading: string; body: string }[] {
  return [
    { heading: t('terms.s1Heading'), body: t('terms.s1Body') },
    { heading: t('terms.s2Heading'), body: t('terms.s2Body') },
    { heading: t('terms.s3Heading'), body: t('terms.s3Body') },
    { heading: t('terms.s4Heading'), body: t('terms.s4Body') },
    { heading: t('terms.s5Heading'), body: t('terms.s5Body') },
    { heading: t('terms.s6Heading'), body: t('terms.s6Body') },
    { heading: t('terms.s7Heading'), body: t('terms.s7Body') },
  ];
}

export default function TermsScreen() {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const SECTIONS = React.useMemo(() => buildSections(t), [t]);

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader title={t('terms.title')} fallbackHref="/settings-security" />
      <AppScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 40, paddingHorizontal: 20 }}
      >
        <AppView gap={18}>
          <AppText family="default" style={{ fontSize: 12.5, color: tokens.textMuted }}>
            {t('terms.intro')}
          </AppText>

          {SECTIONS.map((s) => (
            <AppView key={s.heading} gap={6}>
              <AppText family="heading" weight="bold" style={{ fontSize: 15.5, color: tokens.text }}>
                {s.heading}
              </AppText>
              <AppText family="default" style={{ fontSize: 13.5, lineHeight: 20, color: tokens.textMuted }}>
                {s.body}
              </AppText>
            </AppView>
          ))}
        </AppView>
      </AppScrollView>
    </AppView>
  );
}
