import Constants from 'expo-constants';

export type AppEnvironment = {
  name: 'local' | 'development' | 'staging' | 'production';
  apiBaseUrl: string;
  httpDomains: string;
  allowDevOtp: boolean;
};

export function getAppEnvironment(): AppEnvironment {
  const resolved = Constants.expoConfig?.extra?.appEnvironment as AppEnvironment | undefined;
  if (resolved) return resolved;
  // Older installed dev clients and unit tests may not have a new manifest.
  return {
    name: 'development',
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || '',
    httpDomains: process.env.EXPO_PUBLIC_HTTP_DOMAINS || '',
    allowDevOtp: false,
  };
}

export function allowLocalDevOtp(): boolean {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return false;
  const env = getAppEnvironment();
  if (env.name !== 'local' || !env.allowDevOtp) return false;
  try {
    const host = new URL(env.apiBaseUrl).hostname;
    return host === 'localhost' || host === '[::1]' || /^127\./.test(host);
  } catch { return false; }
}
