import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const memoryStorage = new Map<string, string>();

export const secureStorage = Platform.OS === 'web'
  ? {
      async get(key: string): Promise<string | null> {
        return localStorage.getItem(key);
      },
      async set(key: string, value: string): Promise<void> {
        localStorage.setItem(key, value);
      },
      async remove(key: string): Promise<void> {
        localStorage.removeItem(key);
      },
    }
  : {
      async get(key: string): Promise<string | null> {
        try {
          return await SecureStore.getItemAsync(key);
        } catch (e) {
          console.warn('SecureStore.getItemAsync failed, using memory:', e);
          return memoryStorage.get(key) || null;
        }
      },
      async set(key: string, value: string): Promise<void> {
        try {
          await SecureStore.setItemAsync(key, value);
        } catch (e) {
          console.warn('SecureStore.setItemAsync failed, using memory:', e);
          memoryStorage.set(key, value);
        }
      },
      async remove(key: string): Promise<void> {
        try {
          await SecureStore.deleteItemAsync(key);
        } catch (e) {
          console.warn('SecureStore.deleteItemAsync failed, using memory:', e);
          memoryStorage.delete(key);
        }
      },
    };
