const isDev = __DEV__;

export const logger = {
  info: (...args: unknown[]) => {
    if (isDev) console.log('[info]', ...args);
  },
  warn: (...args: unknown[]) => {
    if (isDev) console.warn('[warn]', ...args);
  },
  error: (...args: unknown[]) => {
    console.error('[error]', ...args);
  },
};
