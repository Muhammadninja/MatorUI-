import { Link, type ExternalPathString } from 'expo-router';
import type { ComponentProps } from 'react';
import { Linking, Platform } from 'react-native';

export function ExternalLink(
  props: Omit<ComponentProps<typeof Link>, 'href'> & { href: ExternalPathString },
) {
  return (
    <Link
      target="_blank"
      {...props}
      href={props.href}
      onPress={(e) => {
        if (Platform.OS !== 'web') {
          // Prevent the default behavior of linking to the default browser on native.
          e.preventDefault();
          void Linking.openURL(props.href);
        }
      }}
    />
  );
}
