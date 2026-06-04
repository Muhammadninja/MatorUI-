import type { ViewStyle } from 'react-native';

export type SpacingProps = {
  p?: number;
  px?: number;
  py?: number;
  pt?: number;
  pb?: number;
  pl?: number;
  pr?: number;
  m?: number;
  mx?: number;
  my?: number;
  mt?: number;
  mb?: number;
  ml?: number;
  mr?: number;
  gap?: number;
  rowGap?: number;
  columnGap?: number;
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
  return {
    ...(s.p != null ? { padding: s.p } : null),
    ...(s.px != null ? { paddingHorizontal: s.px } : null),
    ...(s.py != null ? { paddingVertical: s.py } : null),
    ...(s.pt != null ? { paddingTop: s.pt } : null),
    ...(s.pb != null ? { paddingBottom: s.pb } : null),
    ...(s.pl != null ? { paddingLeft: s.pl } : null),
    ...(s.pr != null ? { paddingRight: s.pr } : null),

    ...(s.m != null ? { margin: s.m } : null),
    ...(s.mx != null ? { marginHorizontal: s.mx } : null),
    ...(s.my != null ? { marginVertical: s.my } : null),
    ...(s.mt != null ? { marginTop: s.mt } : null),
    ...(s.mb != null ? { marginBottom: s.mb } : null),
    ...(s.ml != null ? { marginLeft: s.ml } : null),
    ...(s.mr != null ? { marginRight: s.mr } : null),

    ...(s.gap != null ? ({ gap: s.gap } as any) : null),
    ...(s.rowGap != null ? ({ rowGap: s.rowGap } as any) : null),
    ...(s.columnGap != null ? ({ columnGap: s.columnGap } as any) : null),
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
