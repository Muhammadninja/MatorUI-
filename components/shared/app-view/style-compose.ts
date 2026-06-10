import type { ViewStyle } from 'react-native';

import { resolveSpace, type SpacingKey } from '@/themes';

/** Either a token-scale key like `"md"` or a raw pixel number for one-offs. */
export type SpaceValue = number | SpacingKey;

export type SpacingProps = {
  p?: SpaceValue;
  px?: SpaceValue;
  py?: SpaceValue;
  pt?: SpaceValue;
  pb?: SpaceValue;
  pl?: SpaceValue;
  pr?: SpaceValue;
  m?: SpaceValue;
  mx?: SpaceValue;
  my?: SpaceValue;
  mt?: SpaceValue;
  mb?: SpaceValue;
  ml?: SpaceValue;
  mr?: SpaceValue;
  gap?: SpaceValue;
  rowGap?: SpaceValue;
  columnGap?: SpaceValue;
};

export type FlexboxProps = {
  row?: boolean;
  center?: boolean;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  wrap?: boolean;
  flex?: number;
  grow?: number;
  shrink?: number;
};

export type RoundingProps = {
  rounded?: number;
  roundedTop?: number;
  roundedBottom?: number;
  roundedLeft?: number;
  roundedRight?: number;
};

export type BorderProps = {
  borderWidth?: number;
  borderTopWidth?: number;
  borderBottomWidth?: number;
  borderLeftWidth?: number;
  borderRightWidth?: number;
  borderColor?: string;
};

export function composeSpacing(s: SpacingProps): ViewStyle {
  const p = resolveSpace(s.p);
  const px = resolveSpace(s.px);
  const py = resolveSpace(s.py);
  const pt = resolveSpace(s.pt);
  const pb = resolveSpace(s.pb);
  const pl = resolveSpace(s.pl);
  const pr = resolveSpace(s.pr);
  const m = resolveSpace(s.m);
  const mx = resolveSpace(s.mx);
  const my = resolveSpace(s.my);
  const mt = resolveSpace(s.mt);
  const mb = resolveSpace(s.mb);
  const ml = resolveSpace(s.ml);
  const mr = resolveSpace(s.mr);
  const gap = resolveSpace(s.gap);
  const rowGap = resolveSpace(s.rowGap);
  const columnGap = resolveSpace(s.columnGap);

  return {
    ...(p != null ? { padding: p } : null),
    ...(px != null ? { paddingHorizontal: px } : null),
    ...(py != null ? { paddingVertical: py } : null),
    ...(pt != null ? { paddingTop: pt } : null),
    ...(pb != null ? { paddingBottom: pb } : null),
    ...(pl != null ? { paddingLeft: pl } : null),
    ...(pr != null ? { paddingRight: pr } : null),

    ...(m != null ? { margin: m } : null),
    ...(mx != null ? { marginHorizontal: mx } : null),
    ...(my != null ? { marginVertical: my } : null),
    ...(mt != null ? { marginTop: mt } : null),
    ...(mb != null ? { marginBottom: mb } : null),
    ...(ml != null ? { marginLeft: ml } : null),
    ...(mr != null ? { marginRight: mr } : null),

    ...(gap != null ? ({ gap } as any) : null),
    ...(rowGap != null ? ({ rowGap } as any) : null),
    ...(columnGap != null ? ({ columnGap } as any) : null),
  };
}

export function composeFlexbox(f: FlexboxProps): ViewStyle {
  return {
    ...(f.row ? { flexDirection: 'row' } : null),
    ...(f.center ? { alignItems: 'center', justifyContent: 'center' } : null),
    ...(f.align ? { alignItems: f.align } : null),
    ...(f.justify ? { justifyContent: f.justify } : null),
    ...(f.wrap ? { flexWrap: 'wrap' } : null),
    ...(f.flex != null ? { flex: f.flex } : null),
    ...(f.grow != null ? { flexGrow: f.grow } : null),
    ...(f.shrink != null ? { flexShrink: f.shrink } : null),
  };
}

export function composeRounding(r: RoundingProps): ViewStyle {
  return {
    ...(r.rounded != null ? { borderRadius: r.rounded } : null),
    ...(r.roundedTop != null
      ? { borderTopLeftRadius: r.roundedTop, borderTopRightRadius: r.roundedTop }
      : null),
    ...(r.roundedBottom != null
      ? { borderBottomLeftRadius: r.roundedBottom, borderBottomRightRadius: r.roundedBottom }
      : null),
    ...(r.roundedLeft != null
      ? { borderTopLeftRadius: r.roundedLeft, borderBottomLeftRadius: r.roundedLeft }
      : null),
    ...(r.roundedRight != null
      ? { borderTopRightRadius: r.roundedRight, borderBottomRightRadius: r.roundedRight }
      : null),
  };
}

export function composeBorder(b: BorderProps): ViewStyle {
  return {
    ...(b.borderWidth != null ? { borderWidth: b.borderWidth } : null),
    ...(b.borderTopWidth != null ? { borderTopWidth: b.borderTopWidth } : null),
    ...(b.borderBottomWidth != null ? { borderBottomWidth: b.borderBottomWidth } : null),
    ...(b.borderLeftWidth != null ? { borderLeftWidth: b.borderLeftWidth } : null),
    ...(b.borderRightWidth != null ? { borderRightWidth: b.borderRightWidth } : null),
    ...(b.borderColor != null ? { borderColor: b.borderColor } : null),
  };
}
