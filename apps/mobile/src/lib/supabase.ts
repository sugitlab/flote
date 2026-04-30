import "react-native-url-polyfill/auto";
import * as SecureStore from "expo-secure-store";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare const process: { env: Record<string, string | undefined> };

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

function makeClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

const defaultUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const defaultKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

let _client: SupabaseClient = makeClient(defaultUrl, defaultKey);

export function reinitSupabase(url: string, anonKey: string): SupabaseClient {
  _client = makeClient(url, anonKey);
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
