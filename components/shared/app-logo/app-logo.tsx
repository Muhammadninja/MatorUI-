import { View } from 'react-native';

import { AppText } from '@/components/shared/app-text';
import { useThemeContext } from '@/contexts/theme.context';

import WheelMark from './wheel-mark';

export type AppLogoProps = {
  /** Cap height of the wordmark in px. The wheel-O scales with it. */
  size?: number;
  /** Wordmark + glyph color. Defaults to theme `text` so it inverts. */
  color?: string;
  /** Spin the wheel-O (splash screen). */
  spin?: boolean;
};

/**
 * `Logo` — the MATOR wordmark whose "O" is the alloy-wheel glyph
 * ([[WheelMark]]). Per the v2 handoff the letters are Raleway 800 (the one
 * deliberate exception to the app-wide Inter family), tightened with
 * negative tracking to read as a wordmark.
 */
export default function AppLogo({ size = 28, color, spin = false }: AppLogoProps) {
  const { tokens } = useThemeContext();
  const tint = color ?? tokens.text;
  // The wheel glyph reads a touch larger than the cap height so its rings
  // align with the letterforms' optical weight.
  const wheelSize = Math.round(size * 1.02);

  const letterStyle = {
    fontFamily: 'Raleway_800ExtraBold',
    color: tint,
    fontSize: size,
    lineHeight: size * 1.04,
    letterSpacing: size * -0.02,
  } as const;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <AppText style={letterStyle}>MAT</AppText>
      <WheelMark size={wheelSize} color={tint} spin={spin} />
      <AppText style={letterStyle}>R</AppText>
    </View>
  );
}
