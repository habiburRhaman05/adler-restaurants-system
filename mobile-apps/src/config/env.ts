import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { z } from 'zod';

const envSchema = z.object({
  API_URL: z.string().url(),
  APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
});

const rawEnv = {
  API_URL: process.env.EXPO_PUBLIC_API_URL,
  APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
};

const parsed = envSchema.safeParse(rawEnv);

if (!parsed.success) {
  throw new Error(
    `Invalid environment configuration: ${parsed.error.issues.map((i) => i.message).join(', ')}`
  );
}

/**
 * On a physical device or emulator, `localhost` points at the device itself —
 * not your dev machine. Swap it for the machine's LAN IP, which Expo already
 * knows (hostUri is where Metro is serving from, e.g. "192.168.1.20:8081").
 * Web keeps localhost. Production URLs are untouched.
 */
function resolveApiUrl(url: string): string {
  if (Platform.OS === 'web') return url;
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) return url;
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];
  if (!host) return url;
  return url.replace('localhost', host).replace('127.0.0.1', host);
}

export const env = {
  ...parsed.data,
  API_URL: resolveApiUrl(parsed.data.API_URL),
};
