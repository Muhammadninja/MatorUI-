import { AppIcon } from '@/components/shared/app-icon';
import { useThemeColor } from '@/hooks/use-theme-color';
import { BlurView } from 'expo-blur';
import React, { ReactNode } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { KeyboardAwareScrollView, KeyboardToolbar } from 'react-native-keyboard-controller';

interface KeyboardControllerProps {
  kStyle?: StyleProp<ViewStyle>;
  scrollStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
  offset?: number;
  showToolbar?: boolean;
  kclosed?: number;
  horizontalPadding?: number;
  fillContainer?: boolean;
}

export default function AppKeyboardController({
  children,
  kStyle,
  scrollStyle,
  offset = 190,
  showToolbar = true,
  kclosed = 34,
  horizontalPadding = 16,
  fillContainer = false,
}: KeyboardControllerProps) {
  const grayColor = useThemeColor({}, 'gray300');

  const CustomBlur: React.ReactElement = (
    <BlurView
      tint="light"
      intensity={70}
      style={[styles.blurContainer, { backgroundColor: grayColor }]}
    />
  );

  return (
    <>
      <KeyboardAwareScrollView
        style={[
          fillContainer ? styles.content : null,
          { paddingHorizontal: horizontalPadding },
          scrollStyle,
        ]}
        bottomOffset={offset}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={[fillContainer ? styles.container : null, kStyle]}
        extraKeyboardSpace={offset}
      >
        {children}
      </KeyboardAwareScrollView>

      {showToolbar && (
        <KeyboardToolbar
          blur={CustomBlur}
          offset={{ closed: 100, opened: kclosed }}
          doneText={<AppIcon family="material" name="keyboard-hide" size={26} colorName="text" />}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
  },
  blurContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  },
});
