import "react-native-url-polyfill/auto";
import * as SecureStore from "expo-secure-store";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare const process: { env: Record<string, string | undefined> };

// SecureStore has a 2048-byte limit per key on Android. Supabase session JSON
// easily exceeds this. Chunk large values across multiple keys automatically.
const CHUNK_SIZE = 1800;
const CHUNK_COUNT_SUFFIX = "__chunks";

const ChunkedSecureStore = {
  async getItem(key: string): Promise<string | null> {
    const countStr = await SecureStore.getItemAsync(key + CHUNK_COUNT_SUFFIX);
    if (countStr === null) {
      // Single-key (small value, legacy)
      return SecureStore.getItemAsync(key);
    }
    const count = parseInt(countStr, 10);
    const chunks: string[] = [];
    for (let i = 0; i < count; i++) {
      const chunk = await SecureStore.getItemAsync(`${key}__chunk_${i}`);
      if (chunk === null) return null;
      chunks.push(chunk);
    }
    return chunks.join("");
  },

  async setItem(key: string, value: string): Promise<void> {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      // Clean up any old chunks from a previous large value
      const oldCount = await SecureStore.getItemAsync(key + CHUNK_COUNT_SUFFIX);
      if (oldCount !== null) {
        const n = parseInt(oldCount, 10);
        await SecureStore.deleteItemAsync(key + CHUNK_COUNT_SUFFIX);
        for (let i = 0; i < n; i++) {
          await SecureStore.deleteItemAsync(`${key}__chunk_${i}`);
        }
      }
      return;
    }
    // Split into chunks
    const count = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(
        `${key}__chunk_${i}`,
        value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
      );
    }
    await SecureStore.setItemAsync(key + CHUNK_COUNT_SUFFIX, String(count));
    // Remove simple key if it existed before
    await SecureStore.deleteItemAsync(key);
  },

  async removeItem(key: string): Promise<void> {
    const countStr = await SecureStore.getItemAsync(key + CHUNK_COUNT_SUFFIX);
    if (countStr !== null) {
      const count = parseInt(countStr, 10);
      await SecureStore.deleteItemAsync(key + CHUNK_COUNT_SUFFIX);
      for (let i = 0; i < count; i++) {
        await SecureStore.deleteItemAsync(`${key}__chunk_${i}`);
      }
    }
    await SecureStore.deleteItemAsync(key);
  },
};

function makeClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      storage: ChunkedSecureStore,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

export const defaultUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const defaultKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

let _client: SupabaseClient = makeClient(defaultUrl, defaultKey);

// Listeners notified whenever the Supabase client is replaced (reinit).
// _layout.tsx uses this to re-subscribe onAuthStateChange to the new client.
const _reinitListeners: Array<() => void> = [];
export function addReinitListener(cb: () => void): () => void {
  _reinitListeners.push(cb);
  return () => {
    const i = _reinitListeners.indexOf(cb);
    if (i >= 0) _reinitListeners.splice(i, 1);
  };
}

export function reinitSupabase(url: string, anonKey: string): SupabaseClient {
  _client = makeClient(url, anonKey);
  _reinitListeners.forEach((cb) => cb());
  return _client;
}

// Proxy always delegates to the current _client so reinit takes effect immediately
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const value = Reflect.get(_client, prop, _client);
    if (typeof value === "function") {
      return (value as Function).bind(_client);
    }
    return value;
  },
});
