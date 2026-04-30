import { createClient as _createClient, type SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

export function initSupabase(url: string, anonKey: string): SupabaseClient {
  if (!_supabase) {
    _supabase = _createClient(url, anonKey);
  }
  return _supabase;
}

export function reinitSupabase(url: string, anonKey: string): SupabaseClient {
  _supabase = _createClient(url, anonKey);
  return _supabase;
}

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    throw new Error(
      "Supabase client not initialized. Call initSupabase(url, anonKey) first."
    );
  }
  return _supabase;
}
