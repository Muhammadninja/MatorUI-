import { AppText } from '@/components/shared/app-text';
import { AppPressableView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export default function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { tokens, scheme } = useThemeContext();
  const isDark = scheme === 'dark';
  return (
    <AppPressableView
      onPress={onPress}
      androidRipple={false}
      style={{
        borderRadius: 36,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: selected ? tokens.text : tokens.border,
        backgroundColor: selected
          ? isDark
            ? tokens.gray200
            : tokens.gray100
          : 'transparent',
      }}
    >
      <AppText
        textVariant="bodySm"
        weight={selected ? 'semibold' : 'medium'}
        colorName={selected ? 'text' : 'gray400'}
      >
        {label}
      </AppText>
    </AppPressableView>
  );
}
