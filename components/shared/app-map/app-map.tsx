import { forwardRef, memo, useMemo } from 'react';
import { StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import MapView, {
  Marker,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
  type MapViewProps,
  type Region,
} from 'react-native-maps';

import { useThemeContext } from '@/contexts/theme.context';

import { darkMapStyle } from './dark-map-style';

export type AppMapMarker = {
  id: string;
  coordinate: { latitude: number; longitude: number };
  title?: string;
  description?: string;
};

export type AppMapProps = Omit<MapViewProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Marker list — rendered as native Marker children. */
  markers?: AppMapMarker[];
  /** Force Google Maps on iOS too. Default: native (Apple on iOS, Google on Android). */
  forceGoogle?: boolean;
  /** Initial region. Required unless `region` is controlled. */
  initialRegion?: Region;
};

/**
 * Themed wrapper around react-native-maps. Adds:
 *  - Automatic dark/light map style swap based on the app theme.
 *  - Default markers from a typed list (avoids manual <Marker/> noise).
 *  - Memo'd to keep heavy native view stable across parent re-renders.
 */
const AppMapBase = forwardRef<MapView, AppMapProps>(function AppMap(
  { style, markers, forceGoogle, initialRegion, ...props },
  ref,
) {
  const { scheme } = useThemeContext();
  const customMapStyle = useMemo(
    () => (scheme === 'dark' ? darkMapStyle : undefined),
    [scheme],
  );

  return (
    <MapView
      ref={ref}
      provider={forceGoogle ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
      style={[styles.map, style]}
      initialRegion={initialRegion}
      customMapStyle={customMapStyle}
      {...props}
    >
      {markers?.map((m) => (
        <Marker
          key={m.id}
          coordinate={m.coordinate}
          title={m.title}
          description={m.description}
        />
      ))}
    </MapView>
  );
});

const styles = StyleSheet.create({
  map: { flex: 1 },
});

export default memo(AppMapBase);
