import { useState, useEffect, useCallback } from "react";
import { getSupabase } from "@flote/api-client";
import type { Session } from "@supabase/supabase-js";
import { useUIStore } from "../store/uiStore";

export function useAuth() {
  const supabaseReady = useUIStore((s) => s.supabaseReady);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseReady) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const supabase = getSupabase();

    const sessionTimeout = new Promise<{ data: { session: null } }>((resolve) =>
      setTimeout(() => resolve({ data: { session: null } }), 10_000)
    );
    Promise.race([supabase.auth.getSession(), sessionTimeout])
      .then(({ data: { session: s } }) => {
        setSession(s);
        setLoading(false);
      })
      .catch((e) => {
        console.error("[useAuth] getSession failed:", e);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, [supabaseReady]);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("接続タイムアウト。Supabase URL / キーを確認してください。")), 15_000)
    );
    const { error } = await Promise.race([
      supabase.auth.signInWithPassword({ email, password }),
      timeout,
    ]);
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  return { session, loading, supabaseConfigured: supabaseReady, signIn, signUp, signOut };
}
