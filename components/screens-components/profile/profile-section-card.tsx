import { AppListItem, type AppListItemProps } from '@/components/shared/app-list-item';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';

type ProfileSectionItem = AppListItemProps & {
  key: string;
};

type ProfileSectionCardProps = {
  title: string;
  subtitle?: string;
  items: ProfileSectionItem[];
};

// Locked to the screen-wide radius scale (16 / 8 / full). Matches the
// hero card, payment carousel, and guest welcome.
const SECTION_RADIUS = 16;

export default function ProfileSectionCard({ title, subtitle, items }: ProfileSectionCardProps) {
  return (
    <AppView gap={10} px="lg">
      <AppView gap={2}>
        <AppText textVariant="subtitle" family="accent" colorName="text">
          {title}
        </AppText>
        {subtitle ? (
          <AppText textVariant="bodyXs" colorName="gray400">
            {subtitle}
          </AppText>
        ) : null}
      </AppView>

      <AppView rounded={SECTION_RADIUS} colorName="card" borderWidth={1} borderName="border">
        {items.map(({ key, ...itemProps }, index) => (
          <AppListItem
            key={key}
            {...itemProps}
            _isFirst={index === 0}
            _isLast={index === items.length - 1}
            _parentRounded={SECTION_RADIUS}
            divider={index !== items.length - 1}
            colorName="card"
          />
        ))}
      </AppView>
    </AppView>
  );
}
