import { createClient as _createClient, type SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

export function createClient(url: string, anonKey: string): SupabaseClient {
  if (!_supabase) {
    _supabase = _createClient(url, anonKey);
  }
  return _supabase;
}

export function getClient(): SupabaseClient {
  if (!_supabase) {
    throw new Error("Supabase client not initialized. Call createClient first.");
  }
  return _supabase;
}
