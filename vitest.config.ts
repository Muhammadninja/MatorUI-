import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Vitest config.
 *
 * - `@/*` alias matches the tsconfig so tests can import modules the
 *   same way runtime code does.
 * - `expo-secure-store` is aliased to an in-memory shim because
 *   importing the real module pulls in `react-native`'s flow-typed
 *   index.js which the test parser can't read. The shim mirrors the
 *   three methods the auth-storage module uses.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      'expo-secure-store': path.resolve(
        __dirname,
        './tests/__shims__/expo-secure-store.ts',
      ),
      // react-native's index.js uses Flow's `import typeof` syntax which
      // Rollup can't parse. Alias to react-native-web so tests can render
      // real components against DOM nodes via react-test-renderer.
      'react-native': 'react-native-web',
    },
  },
});
