import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type AppBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Fraction of screen height the sheet occupies (0–1). Default 0.33 (one-third). */
  heightFraction?: number;
  /** Tap on the dim overlay closes the sheet. Default true. */
  dismissOnOverlayPress?: boolean;
  /** KeyboardAvoidingView wrapping. Default true. */
  avoidKeyboard?: boolean;
  /**
   * When true (default), the sheet wraps its content tightly and capped at heightFraction —
   * no empty space inside the sheet.
   * When false, the sheet is fixed at heightFraction regardless of content size.
   */
  expandable?: boolean;
  /** Allow drag-down on the drag handle to dismiss. Default true. */
  swipeToClose?: boolean;
  children?: ReactNode;
};

/** Minimum bottom safe-area we guarantee. Modal on Android sometimes loses SafeAreaProvider context. */
const MIN_SAFE_BOTTOM = Platform.OS === 'android' ? 20 : 0;
const SWIPE_CLOSE_DISTANCE = 100;
const SWIPE_CLOSE_VELOCITY = 0.5;
/** Clear space kept between the sheet's top edge and the status bar / Dynamic Island. */
const SHEET_TOP_GAP = 12;
/** Bottom padding while the keyboard is up: it already covers the home indicator. */
const KEYBOARD_BOTTOM_GAP = 8;

/**
 * Where the keyboard's top edge is on screen while it is up, else null.
 *
 * The keyboard-avoiding wrapper lifts the sheet by the keyboard's height but
 * never shrinks it, so a tall sheet (the 0.8 address form) was pushed up under
 * the status bar and Dynamic Island. Knowing the keyboard's top lets the sheet
 * cap itself to the room that is really left.
 */
function useKeyboardTop(enabled: boolean): number | null {
  const [top, setTop] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) {
      setTop(null);
      return;
    }
    const screenHeight = Dimensions.get('screen').height;
    const onFrame = (e: { endCoordinates: { screenY: number } }) =>
      setTop(e.endCoordinates.screenY < screenHeight ? e.endCoordinates.screenY : null);
    const subs =
      Platform.OS === 'ios'
        ? [
            // Will-change also catches the QuickType bar and keyboard switches.
            Keyboard.addListener('keyboardWillChangeFrame', onFrame),
            Keyboard.addListener('keyboardWillHide', () => setTop(null)),
          ]
        : [
            Keyboard.addListener('keyboardDidShow', onFrame),
            Keyboard.addListener('keyboardDidHide', () => setTop(null)),
          ];
    return () => subs.forEach((sub) => sub.remove());
  }, [enabled]);
  return top;
}

export function AppBottomSheet({
  visible,
  onClose,
  heightFraction = 1 / 3,
  dismissOnOverlayPress = true,
  avoidKeyboard = true,
  expandable = true,
  swipeToClose = true,
  children,
}: AppBottomSheetProps) {
  const { t } = useTranslation();
  const { tokens, scheme } = useThemeContext();
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get('window').height;
  const clampedFraction = Math.max(0.1, Math.min(1, heightFraction));
  const fullHeight = Math.round(screenHeight * clampedFraction);
  const keyboardTop = useKeyboardTop(visible && avoidKeyboard);
  // Never taller than the room between the status bar and the keyboard (or the
  // screen's foot): the content scrolls inside instead of riding off the top.
  const roomAbove = (keyboardTop ?? screenHeight) - insets.top - SHEET_TOP_GAP;
  const sheetHeight = Math.max(0, Math.min(fullHeight, Math.round(roomAbove)));

  const translateY = useRef(new Animated.Value(0)).current;

  // Slide the sheet panel up whenever it becomes visible. The backdrop itself
  // fades in via the Modal's `fade` animation, so the screen underneath stays
  // put (just dims) instead of the whole modal window sliding up from the
  // bottom — which read as a brand-new screen appearing. Starting from the
  // full sheet height guarantees the panel begins fully off-screen. Keyed on the
  // uncapped height so the keyboard resizing the sheet doesn't replay it.
  useEffect(() => {
    if (visible) {
      translateY.setValue(fullHeight);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 90,
        friction: 12,
      }).start();
    }
  }, [visible, translateY, fullHeight]);

  const animateClose = useCallback(() => {
    Animated.timing(translateY, {
      toValue: screenHeight,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      translateY.setValue(0);
      onClose();
    });
  }, [translateY, screenHeight, onClose]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => swipeToClose,
        onMoveShouldSetPanResponder: (_, g) => swipeToClose && Math.abs(g.dy) > 4,
        onPanResponderMove: (_, g) => {
          if (g.dy > 0) translateY.setValue(g.dy);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > SWIPE_CLOSE_DISTANCE || g.vy > SWIPE_CLOSE_VELOCITY) {
            animateClose();
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              tension: 60,
              friction: 10,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
      }),
    [swipeToClose, translateY, animateClose],
  );

  const bottomPadding =
    keyboardTop != null ? KEYBOARD_BOTTOM_GAP : Math.max(insets.bottom, MIN_SAFE_BOTTOM);

  const sheetStyle = expandable
    ? { maxHeight: sheetHeight, paddingBottom: bottomPadding }
    : { height: sheetHeight, paddingBottom: bottomPadding };

  const sheet = (
    <Animated.View style={{ transform: [{ translateY }] }}>
      <AppView
        roundedTop={28}
        colorName="background"
        borderName="border"
        borderTopWidth={1}
        borderLeftWidth={1}
        borderRightWidth={1}
        style={sheetStyle}
      >
        <AppView center pt={10} pb={6} {...(swipeToClose ? panResponder.panHandlers : {})}>
          <AppView
            rounded={999}
            style={{
              width: 40,
              height: 4,
              backgroundColor:
                scheme === 'dark' ? 'rgba(255, 255, 255, 0.4)' : tokens.gray300,
            }}
          />
        </AppView>
        {expandable ? children : <AppView flex={1}>{children}</AppView>}
      </AppView>
    </Animated.View>
  );

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <AppView flex={1} style={styles.overlayContainer}>
        <Pressable
          style={styles.overlayPressable}
          onPress={dismissOnOverlayPress ? onClose : undefined}
          accessibilityRole="button"
          accessibilityLabel={t('fields.dismissSheet')}
        >
          <AppView flex={1} style={{ backgroundColor: 'rgba(0, 0, 0, 0.42)' }} />
        </Pressable>

        {avoidKeyboard ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            {sheet}
          </KeyboardAvoidingView>
        ) : (
          sheet
        )}
      </AppView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    justifyContent: 'flex-end',
  },
  overlayPressable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

export default AppBottomSheet;
