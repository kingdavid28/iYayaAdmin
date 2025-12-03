import Constants from 'expo-constants';

export const getEnvVar = (name: string): string | undefined => {
  if (typeof process !== 'undefined' && process.env?.[name]) {
    const value = process.env[name];
    return typeof value === 'string' ? value.trim() : value;
  }

  const extra = (Constants as any)?.expoConfig?.extra ?? (Constants as any)?.manifest?.extra;
  if (extra?.[name]) {
    const value = extra[name];
    return typeof value === 'string' ? value.trim() : value;
  }

  return undefined;
};

const normalizeHostInput = (hostOrUrl: string, defaultPort: string): string => {
  if (/^https?:\/\//i.test(hostOrUrl)) {
    return hostOrUrl.replace(/\/$/, '');
  }

  const trimmed = hostOrUrl.trim().replace(/\/$/, '');
  if (!trimmed) {
    return '';
  }

  const hasPort = /:[0-9]+$/.test(trimmed);
  const protocol = trimmed.includes('localhost') || trimmed.startsWith('127.') ? 'http' : 'http';
  return hasPort ? `${protocol}://${trimmed}` : `${protocol}://${trimmed}:${defaultPort}`;
};

export const resolveDevHost = (): string | undefined => {
  const port = getEnvVar('EXPO_PUBLIC_API_PORT') ?? '5000';
  const explicitHost = getEnvVar('EXPO_PUBLIC_API_HOST');
  if (explicitHost) {
    const normalized = normalizeHostInput(explicitHost, port);
    if (normalized) {
      return normalized;
    }
  }

  const hostUri = (Constants as any)?.expoConfig?.hostUri ?? (Constants as any)?.manifest?.debuggerHost;
  if (!hostUri) {
    return undefined;
  }

  const [host] = hostUri.split(':');
  if (!host) {
    return undefined;
  }

  return normalizeHostInput(host, port);
};

const rawBaseUrl =
  getEnvVar('EXPO_PUBLIC_API_URL') ??
  (__DEV__ ? resolveDevHost() : undefined) ??
  'https://iyaya-backend-8k1q0bnbg-reycelrcentino-1494s-projects.vercel.app';

export const apiBaseUrl = rawBaseUrl.replace(/\/$/, '');

export const apiBaseUrlWithApiPrefix = `${apiBaseUrl}/api`;
