import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AppPrice } from '@/components/shared/app-price';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import type { AiChatPartGroup } from '@/types/ai-chat';
import { openItemDetail } from '@/utils/nav';

/** Catalog matches as product links, grouped by the part they answer so a
 *  customer can see what each result is for and notice one that's missing. */
export function AiChatPartLinks({ groups }: { groups: AiChatPartGroup[] }) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  return (
    <AppView gap={10} style={{ paddingLeft: 40 }}>
      {groups.map((group, index) => (
        <AppView key={`${group.partName ?? 'part'}-${index}`} gap={6}>
          {group.partName ? (
            <AppText textVariant="bodyXs" colorName="textMuted">
              {t('aiChat.resultsFor', { part: group.partName })}
            </AppText>
          ) : null}
          <AppView
            rounded={12}
            colorName="card"
            borderWidth={1}
            borderName="border"
            style={{ overflow: 'hidden' }}
          >
            {group.links.map((link, linkIndex) => (
              <AppPressableView
                key={link.id}
                testID={`chat-part-link-${link.id}`}
                onPress={() => openItemDetail(link.id)}
                accessibilityRole="link"
                accessibilityLabel={t('aiChat.openPartA11y', {
                  title: link.title,
                  price: link.price,
                })}
                androidRipple={false}
                pressedScale={1}
                row
                align="center"
                gap={10}
                fillContainer
                style={{
                  minHeight: 48,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderTopWidth: linkIndex === 0 ? 0 : 1,
                  borderTopColor: tokens.divider,
                }}
              >
                <AppView flex={1} gap={2} style={{ minWidth: 0 }}>
                  <AppText textVariant="bodySemibold" weight="semibold" colorName="text">
                    {link.title}
                  </AppText>
                  <AppPrice value={link.price} size={14} color={tokens.text} />
                  {link.fit ? (
                    <AppText
                      textVariant="bodyXs"
                      style={{ color: link.fit === 'FITS' ? tokens.success : tokens.textMuted }}
                    >
                      {t(
                        link.fit === 'FITS'
                          ? 'aiChat.fitsSelectedVehicle'
                          : 'aiChat.fitNotConfirmed',
                      )}
                    </AppText>
                  ) : null}
                </AppView>
                <ChevronRight size={18} strokeWidth={2.2} color={tokens.textMuted} />
              </AppPressableView>
            ))}
          </AppView>
        </AppView>
      ))}
    </AppView>
  );
}
