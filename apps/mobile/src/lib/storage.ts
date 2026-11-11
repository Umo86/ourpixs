import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/** SecureStore keys may only contain letters, digits, ".", "-" and "_". */
export function safeKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, "_");
}

const isWeb = Platform.OS === "web";

/**
 * Small key/value store. Keychain/Keystore on device (SecureStore), localStorage on web
 * (web is only used for the demo export / screenshots).
 */
export const storage = {
  async get(key: string): Promise<string | null> {
    const k = safeKey(key);
    try {
      if (isWeb) return typeof localStorage === "undefined" ? null : localStorage.getItem(k);
      return await SecureStore.getItemAsync(k);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    const k = safeKey(key);
    try {
      if (isWeb) {
        if (typeof localStorage !== "undefined") localStorage.setItem(k, value);
        return;
      }
      await SecureStore.setItemAsync(k, value);
    } catch {
      // Storage is best-effort; the session simply won't persist.
    }
  },
  async remove(key: string): Promise<void> {
    const k = safeKey(key);
    try {
      if (isWeb) {
        if (typeof localStorage !== "undefined") localStorage.removeItem(k);
        return;
      }
      await SecureStore.deleteItemAsync(k);
    } catch {
      // ignore
    }
  },
  async getJSON<T>(key: string): Promise<T | null> {
    const raw = await storage.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  async setJSON(key: string, value: unknown): Promise<void> {
    await storage.set(key, JSON.stringify(value));
  },
};
