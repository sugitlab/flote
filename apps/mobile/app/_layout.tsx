import { useEffect, useState, useRef } from "react";
import { Text } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { useFonts } from "expo-font";
import { Ionicons } from "@expo/vector-icons";
import {
  NotoSansJP_400Regular,
  NotoSansJP_500Medium,
  NotoSansJP_600SemiBold,
  NotoSansJP_700Bold,
} from "@expo-google-fonts/noto-sans-jp";
import * as Notifications from "expo-notifications";
import type { Session } from "@supabase/supabase-js";
import { supabase, reinitSupabase } from "../src/lib/supabase";
import { useThemeStore } from "../src/theme";
import { useSettingsStore } from "../src/store/settingsStore";
import { setupNotifications } from "../src/lib/notifications";

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const router = useRouter();
  const segments = useSegments();
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    NotoSansJP_400Regular,
    NotoSansJP_500Medium,
    NotoSansJP_600SemiBold,
    NotoSansJP_700Bold,
  });

  if (fontsLoaded) {
    // @ts-ignore
    Text.defaultProps = Text.defaultProps ?? {};
    // @ts-ignore
    Text.defaultProps.style = { fontFamily: "NotoSansJP_400Regular" };
  }
  const loadMode = useThemeStore((s) => s.loadMode);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const notifListenerRef = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    setupNotifications();
    // Load settings first so custom Supabase config can be applied before auth
    loadSettings().then(() => {
      const { customSupabaseUrl, customSupabaseAnonKey } = useSettingsStore.getState();
      if (customSupabaseUrl && customSupabaseAnonKey) {
        reinitSupabase(customSupabaseUrl, customSupabaseAnonKey);
      }
    });
    notifListenerRef.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const taskId = response.notification.request.content.data?.taskId as string | undefined;
        if (taskId) {
          router.push(`/(app)/tasks/${taskId}` as never);
        }
      }
    );
    return () => notifListenerRef.current?.remove();
  }, []);

  useEffect(() => {
    loadMode();
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (!initialized) setInitialized(true);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!initialized) return;
    const inAuth = segments[0] === "(auth)";
    if (!session && !inAuth) {
      router.replace("/(auth)");
    } else if (session && inAuth) {
      router.replace("/(app)");
    }
  }, [session, initialized, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}
