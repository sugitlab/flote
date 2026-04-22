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
} from "react-native";
import { useTheme } from "../../src/theme";
import { supabase } from "../../src/lib/supabase";
import FloteLogo from "../../components/FloteLogo";

type Mode = "login" | "signup";

export default function AuthScreen() {
  const { colors } = useTheme();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert("エラー", "メールアドレスとパスワードを入力してください");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        Alert.alert("確認", "確認メールを送信しました。メールを確認してください。");
      }
    } catch (e: unknown) {
      Alert.alert("エラー", e instanceof Error ? e.message : "認証に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.inner}>
        <View style={styles.logoWrap}>
          <FloteLogo size={72} />
          <Text style={[styles.title, { color: colors.text }]}>Flote</Text>
        </View>

        <View style={[styles.segmented, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            style={[styles.segment, mode === "login" && { backgroundColor: colors.accent }]}
            onPress={() => setMode("login")}
          >
            <Text style={[styles.segmentText, { color: mode === "login" ? "#fff" : colors.text }]}>
              ログイン
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, mode === "signup" && { backgroundColor: colors.accent }]}
            onPress={() => setMode("signup")}
          >
            <Text style={[styles.segmentText, { color: mode === "signup" ? "#fff" : colors.text }]}>
              サインアップ
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
          placeholder="メールアドレス"
          placeholderTextColor={colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
          placeholder="パスワード"
          placeholderTextColor={colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
        />

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.accent }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {mode === "login" ? "ログイン" : "サインアップ"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center" },
  inner: { paddingHorizontal: 32 },
  logoWrap: { alignItems: "center", gap: 20, marginBottom: 40 },
  title: { fontSize: 28, fontWeight: "700", textAlign: "center" },
  segmented: {
    flexDirection: "row",
    borderRadius: 8,
    marginBottom: 24,
    overflow: "hidden",
  },
  segment: { flex: 1, paddingVertical: 10, alignItems: "center" },
  segmentText: { fontSize: 15, fontWeight: "600" },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  button: {
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
