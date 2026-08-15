import React from 'react';

import { useTranslation } from 'react-i18next';

import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

/**
 * Terms & Conditions — a plain, scrollable legal page reached from Settings.
 *
 * ⚠️ LEGAL REVIEW REQUIRED BEFORE LAUNCH: the copy below (locale key `terms.*`)
 * is a comprehensive, launch-shaped DRAFT written for an Uzbek auto-parts
 * marketplace — it has NOT been vetted by a lawyer. Before release: (1) have
 * counsel review it, and (2) fill the operating legal-entity name + address in
 * `terms.company` / `terms.contactBody` and the date in `terms.effectiveDate`.
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
    { heading: t('terms.s8Heading'), body: t('terms.s8Body') },
    { heading: t('terms.s9Heading'), body: t('terms.s9Body') },
    { heading: t('terms.s10Heading'), body: t('terms.s10Body') },
    { heading: t('terms.s11Heading'), body: t('terms.s11Body') },
    { heading: t('terms.s12Heading'), body: t('terms.s12Body') },
    { heading: t('terms.s13Heading'), body: t('terms.s13Body') },
    { heading: t('terms.s14Heading'), body: t('terms.s14Body') },
    { heading: t('terms.s15Heading'), body: t('terms.s15Body') },
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
          <AppView gap={4}>
            <AppText family="default" style={{ fontSize: 12.5, color: tokens.textMuted }}>
              {t('terms.intro')}
            </AppText>
            <AppText family="default" style={{ fontSize: 11.5, color: tokens.textMuted }}>
              {t('terms.effectiveDate')}
            </AppText>
          </AppView>

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
