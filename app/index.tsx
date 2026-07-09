import 'expo-dev-client';
import { Redirect } from 'expo-router';

/**
 * Entry-point gate. Always routes to the branded Splash, which shows the
 * spinning MATOR wheel for ~2.4s and then decides where to go: the language
 * picker on first launch, or straight to Explore once a language has been
 * chosen. Splash owns the persisted-language hydration wait, so the entry
 * point stays a dumb redirect.
 */
export default function RootIndex() {
  return <Redirect href="/splash" />;
}
