const PRODUCTION_API = 'https://api.mator.uz';

function isLoopbackUrl(value) {
  try {
    const host = new URL(value).hostname;
    return host === 'localhost' || host === '[::1]' || /^127\./.test(host);
  } catch { return false; }
}

function environmentFrom(env, release = false) {
  const apiBaseUrl = (env.EXPO_PUBLIC_API_BASE_URL || '').trim().replace(/\/+$/, '');
  const name = env.EXPO_PUBLIC_APP_ENV || (isLoopbackUrl(apiBaseUrl) ? 'local' : 'development');
  const allowDevOtp = env.EXPO_PUBLIC_ALLOW_DEV_OTP === 'true';
  if (!['local', 'development', 'staging', 'production'].includes(name)) {
    throw new Error('EXPO_PUBLIC_APP_ENV must be local, development, staging or production.');
  }
  let parsed;
  try { parsed = new URL(apiBaseUrl); } catch {
    if (release || apiBaseUrl) throw new Error('EXPO_PUBLIC_API_BASE_URL must be a valid URL.');
  }
  if (parsed && (parsed.username || parsed.password || parsed.search || parsed.hash)) {
    throw new Error('API URL must not contain credentials, query parameters or a fragment.');
  }
  if (name === 'local' && !isLoopbackUrl(apiBaseUrl)) {
    throw new Error('Local integration builds must use a loopback API URL.');
  }
  if (allowDevOtp && (name !== 'local' || !isLoopbackUrl(apiBaseUrl))) {
    throw new Error('Development OTP is allowed only for the local loopback environment.');
  }
  if (release) {
    if (name === 'local' || allowDevOtp || env.AUTH_DEV_MODE === 'true' || env.EXPO_PUBLIC_AUTH_DEV_MODE === 'true') {
      throw new Error('Release builds cannot use local integration or development authentication.');
    }
    // Only the known HTTPS environments are shippable. This also excludes LAN,
    // loopback, private IPv4/IPv6, custom DNS aliases and credentials in a URL.
    const allowed = {
      production: PRODUCTION_API,
      staging: 'https://api.staging.mator.uz',
      development: 'https://api.dev.matorui.com',
    };
    if (apiBaseUrl !== allowed[name]) {
      throw new Error('Release API must match the selected official HTTPS environment.');
    }
    if (name === 'production' && env.EXPO_PUBLIC_HTTP_DOMAINS?.trim()) {
      throw new Error('Production must enable every HTTP domain; remove EXPO_PUBLIC_HTTP_DOMAINS.');
    }
  }
  return { name, apiBaseUrl, httpDomains: env.EXPO_PUBLIC_HTTP_DOMAINS || '', allowDevOtp };
}

module.exports = { PRODUCTION_API, environmentFrom, isLoopbackUrl };
