import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { triggerHaptic } from '@/utils/haptics';

export type CartSection = 'cart' | 'lists' | 'buy-again';

export type CartSectionTabsProps = {
  active: CartSection;
  onChange: (next: CartSection) => void;
};

const SECTIONS: { key: CartSection; label: string }[] = [
  { key: 'cart', label: 'Cart' },
  { key: 'lists', label: 'Lists' },
  { key: 'buy-again', label: 'Buy again' },
];

export default function CartSectionTabs({ active, onChange }: CartSectionTabsProps) {
  const { tokens } = useThemeContext();

  return (
    <AppView row gap={20}>
      {SECTIONS.map((section) => {
        const isActive = section.key === active;
        return (
          <AppPressableView
            key={section.key}
            py={4}
            androidRipple={false}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={section.label}
            onPress={() => {
              if (isActive) return;
              triggerHaptic('selection');
              onChange(section.key);
            }}
            style={{
              borderBottomWidth: 2,
              borderBottomColor: isActive ? tokens.text : 'transparent',
            }}
          >
            <AppText
              textVariant="h4"
              family="heading"
              colorName={isActive ? 'text' : 'gray400'}
              style={{ fontSize: 14, lineHeight: 18 }}
            >
              {section.label}
            </AppText>
          </AppPressableView>
        );
      })}
    </AppView>
  );
}
