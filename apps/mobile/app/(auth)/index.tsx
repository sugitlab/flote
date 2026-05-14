import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/theme";
import { supabase, reinitSupabase, defaultUrl, defaultKey } from "../../src/lib/supabase";
import { useSettingsStore } from "../../src/store/settingsStore";
import FloteLogo from "../../components/FloteLogo";
import { useT } from "../../src/hooks/useT";

type ScreenView = "login" | "selfhosted-setup";

export default function AuthScreen() {
  const { colors } = useTheme();
  const t = useT();
  const customSupabaseUrl = useSettingsStore((s) => s.customSupabaseUrl);
  const customSupabaseAnonKey = useSettingsStore((s) => s.customSupabaseAnonKey);
  const setCustomSupabase = useSettingsStore((s) => s.setCustomSupabase);
  const clearCustomSupabase = useSettingsStore((s) => s.clearCustomSupabase);
  const isSelfHosted = !!customSupabaseUrl;

  const [view, setView] = useState<ScreenView>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [keyInput, setKeyInput] = useState("");

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t.auth.error, t.auth.emptyFields);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (e: unknown) {
      Alert.alert(t.auth.error, e instanceof Error ? e.message : t.auth.loginFailed);
    } finally {
      setLoading(false);
    }
  };

  const openSelfHostedSetup = () => {
    setUrlInput(customSupabaseUrl);
    setKeyInput(customSupabaseAnonKey);
    setView("selfhosted-setup");
  };

  const handleSaveSelfHosted = async () => {
    const url = urlInput.trim();
    const key = keyInput.trim();
    if (!url || !key) {
      Alert.alert(t.auth.error, t.auth.emptySupabaseFields);
      return;
    }
    await setCustomSupabase(url, key);
    reinitSupabase(url, key);
    setView("login");
  };

  const handleResetToCloud = async () => {
    await clearCustomSupabase();
    reinitSupabase(defaultUrl, defaultKey);
  };

  if (view === "selfhosted-setup") {
    return (
      <KeyboardAvoidingView
        style={[s.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={s.inner} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => setView("login")} style={s.backRow}>
            <Ionicons name="chevron-back" size={22} color={colors.accent} />
            <Text style={[s.backText, { color: colors.accent }]}>{t.auth.backToLogin}</Text>
          </TouchableOpacity>

          <Text style={[s.setupTitle, { color: colors.text }]}>{t.auth.selfHostedSetupTitle}</Text>
          <Text style={[s.setupDesc, { color: colors.textSecondary }]}>
            {t.auth.selfHostedSetupDesc}
          </Text>

          <TextInput
            style={[s.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
            placeholder={t.auth.supabaseUrlPlaceholder}
            placeholderTextColor={colors.textSecondary}
            value={urlInput}
            onChangeText={setUrlInput}
            autoCapitalize="none"
            keyboardType="url"
          />
          <TextInput
            style={[s.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
            placeholder={t.auth.supabaseKeyPlaceholder}
            placeholderTextColor={colors.textSecondary}
            value={keyInput}
            onChangeText={setKeyInput}
            autoCapitalize="none"
            multiline
          />

          <TouchableOpacity
            style={[s.button, { backgroundColor: colors.accent }]}
            onPress={handleSaveSelfHosted}
          >
            <Text style={s.buttonText}>{t.auth.saveAndReturn}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[s.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={s.inner} keyboardShouldPersistTaps="handled">
        <View style={s.logoWrap}>
          <FloteLogo size={72} />
          <Text style={[s.title, { color: colors.text }]}>Flote</Text>
          {isSelfHosted && (
            <View style={[s.badge, { borderColor: colors.accent }]}>
              <Text style={[s.badgeText, { color: colors.accent }]}>{t.auth.selfHostedBadge}</Text>
            </View>
          )}
        </View>

        <TextInput
          style={[s.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
          placeholder={t.auth.emailPlaceholder}
          placeholderTextColor={colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <TextInput
          style={[s.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
          placeholder={t.auth.passwordPlaceholder}
          placeholderTextColor={colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
        />

        <TouchableOpacity
          style={[s.button, { backgroundColor: colors.accent }]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.buttonText}>{t.auth.login}</Text>}
        </TouchableOpacity>

        <Text style={[s.note, { color: colors.textSecondary }]}>
          {t.auth.signupNote}
        </Text>

        <View style={[s.divider, { backgroundColor: colors.border }]} />

        <TouchableOpacity style={s.linkRow} onPress={openSelfHostedSetup}>
          <Text style={[s.linkText, { color: colors.accent }]}>
            {isSelfHosted ? t.auth.changeSettings : t.auth.selfHostedLink}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.accent} />
        </TouchableOpacity>

        {isSelfHosted && (
          <TouchableOpacity style={s.linkRow} onPress={handleResetToCloud}>
            <Text style={[s.linkText, { color: colors.textSecondary }]}>{t.auth.switchToCloud}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  inner: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 32, paddingVertical: 48 },
  logoWrap: { alignItems: "center", gap: 12, marginBottom: 40 },
  title: { fontSize: 28, fontWeight: "700" },
  badge: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, marginTop: 4 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  input: { height: 48, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, fontSize: 16, marginBottom: 12 },
  button: { height: 48, borderRadius: 8, alignItems: "center", justifyContent: "center", marginTop: 4 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  note: { fontSize: 13, textAlign: "center", marginTop: 16 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 24 },
  linkRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 6 },
  linkText: { fontSize: 14 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 32 },
  backText: { fontSize: 16 },
  setupTitle: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  setupDesc: { fontSize: 14, lineHeight: 20, marginBottom: 24 },
});
