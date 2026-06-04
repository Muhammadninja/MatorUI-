import { Search, X } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Dimensions, Keyboard, TextInput } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { triggerHaptic } from '@/utils/haptics';

import { AppExpandableSearchProps } from './types';

const SCREEN_WIDTH = Dimensions.get('window').width;

export function AppExpandableSearch({
  placeholder = 'Search',
  onSearchChange,
  onExpandChange,
  isExpanded: controlledIsExpanded,
  searchQuery: controlledSearchQuery,
  expandedWidth,
  inputColorName = 'background',
  actionColorName = 'background',
  inputIconColorName = 'gray400',
  actionIconColorName = 'gray400',
  textColorName = 'text',
  placeholderColorName = 'gray400',
  shadowColorName = 'black',
}: AppExpandableSearchProps) {
  const { scheme, tokens } = useThemeContext();
  const inputRef = useRef<TextInput>(null);

  const searchWidth = useSharedValue(0);

  const isExpanded = controlledIsExpanded ?? false;
  const searchQuery = controlledSearchQuery ?? '';
  const resolvedExpandedWidth = expandedWidth ?? SCREEN_WIDTH - 78;
  const activeActionColor = scheme === 'dark' ? tokens.gray200 : tokens.gray100;

  useEffect(() => {
    let focusTimeout: ReturnType<typeof setTimeout> | undefined;

    if (isExpanded) {
      searchWidth.value = withTiming(resolvedExpandedWidth, { duration: 250 });
      focusTimeout = setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      searchWidth.value = withTiming(0, { duration: 220 });
    }

    return () => {
      if (focusTimeout) clearTimeout(focusTimeout);
    };
  }, [isExpanded, resolvedExpandedWidth, searchWidth]);

  const handleExpand = () => {
    triggerHaptic('selection');
    onExpandChange?.(true);
  };

  const handleCollapse = () => {
    triggerHaptic('selection');
    Keyboard.dismiss();
    onExpandChange?.(false);
    onSearchChange?.('');
  };

  const handleSearchChange = (text: string) => {
    onSearchChange?.(text);
  };

  const searchAnimatedStyle = useAnimatedStyle(() => ({
    width: searchWidth.value,
    overflow: 'hidden',
  }));

  return (
    <AppView row align="center" gap={8} justify="flex-end">
      {isExpanded ? (
        <>
          <Animated.View style={searchAnimatedStyle}>
            <AppView
              colorName={inputColorName}
              row
              align="center"
              px={12}
              rounded={18}
              style={{
                height: 40,
                borderWidth: 1,
                borderColor: tokens.border,
              }}
            >
              <Search size={16} strokeWidth={2.1} color={tokens[inputIconColorName]} />
              <AppView flex={1} ml={8}>
                <TextInput
                  ref={inputRef}
                  value={searchQuery}
                  onChangeText={handleSearchChange}
                  placeholder={placeholder}
                  placeholderTextColor={tokens[placeholderColorName]}
                  style={{
                    fontSize: 15,
                    color: tokens[textColorName],
                    padding: 0,
                  }}
                />
              </AppView>
            </AppView>
          </Animated.View>
          <AppPressableView
            onPress={handleCollapse}
            hitSlop={8}
            androidRipple={false}
            pressedScale={0.96}
          >
            <AppView
              colorName={actionColorName}
              rounded={18}
              center
              style={{
                width: 40,
                height: 40,
                borderWidth: 1,
                borderColor: tokens.border,
                backgroundColor: activeActionColor,
                shadowColor: tokens[shadowColorName],
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: scheme === 'dark' ? 0.22 : 0.08,
                shadowRadius: 6,
                elevation: 3,
              }}
            >
              <X size={16} strokeWidth={2.1} color={tokens[actionIconColorName]} />
            </AppView>
          </AppPressableView>
        </>
      ) : (
        <AppPressableView
          onPress={handleExpand}
          hitSlop={8}
          androidRipple={false}
          pressedScale={0.96}
        >
          <AppView
            colorName={actionColorName}
            rounded={18}
            center
            style={{
              width: 40,
              height: 40,
              borderWidth: 1,
              borderColor: tokens.border,
              shadowColor: tokens[shadowColorName],
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: scheme === 'dark' ? 0.22 : 0.08,
              shadowRadius: 6,
              elevation: 3,
            }}
          >
            <Search size={16} strokeWidth={2.1} color={tokens[actionIconColorName]} />
          </AppView>
        </AppPressableView>
      )}
    </AppView>
  );
}
