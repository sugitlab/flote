import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  Linking,
} from "react-native";
import * as Notifications from "expo-notifications";
import { useTheme, useThemeStore, type ThemeMode } from "../src/theme";
import { supabase } from "../src/lib/supabase";

type Props = {
  onSignOut: () => void;
};

export default function SettingsPage({ onSignOut }: Props) {
  const { colors, mode } = useTheme();
  const setThemeMode = useThemeStore((s) => s.setMode);
  const [email, setEmail] = useState<string | null>(null);
  const [notifEnabled, setNotifEnabled] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
    Notifications.getPermissionsAsync().then(({ status }) => {
      setNotifEnabled(status === "granted");
    });
  }, []);

  const handleToggleNotif = useCallback(async () => {
    if (notifEnabled) {
      // Cannot programmatically revoke; guide user to settings
      Alert.alert(
        "通知の無効化",
        "通知を無効にするにはシステム設定から変更してください。",
        [{ text: "OK" }]
      );
      return;
    }
    const { status } = await Notifications.requestPermissionsAsync();
    setNotifEnabled(status === "granted");
    if (status !== "granted") {
      Alert.alert("通知が許可されませんでした", "設定アプリから通知を許可してください。");
    }
  }, [notifEnabled]);

  const handleSignOut = useCallback(() => {
    Alert.alert("ログアウト", "ログアウトしますか？", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "ログアウト",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
          onSignOut();
        },
      },
    ]);
  }, [onSignOut]);

  const s = makeStyles(colors);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>

      {/* テーマ */}
      <Text style={s.sectionTitle}>テーマ</Text>
      <View style={s.card}>
        <View style={s.themeRow}>
          {(["system", "light", "dark"] as ThemeMode[]).map((m, i, arr) => (
            <TouchableOpacity
              key={m}
              style={[
                s.themeBtn,
                i === 0 && s.themeBtnFirst,
                i === arr.length - 1 && s.themeBtnLast,
                mode === m && { backgroundColor: colors.accent },
              ]}
              onPress={() => setThemeMode(m)}
              activeOpacity={0.7}
            >
              <Text style={[s.themeBtnText, mode === m && { color: "#fff" }]}>
                {m === "system" ? "システム" : m === "light" ? "ライト" : "ダーク"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* アカウント */}
      <Text style={s.sectionTitle}>アカウント</Text>
      <View style={s.card}>
        <View style={s.row}>
          <Text style={s.label}>メールアドレス</Text>
          <Text style={s.value} numberOfLines={1}>{email ?? "—"}</Text>
        </View>
        <View style={s.separator} />
        <TouchableOpacity style={s.row} onPress={handleSignOut} activeOpacity={0.7}>
          <Text style={[s.label, { color: colors.danger }]}>ログアウト</Text>
        </TouchableOpacity>
      </View>

      {/* 通知 */}
      {Platform.OS !== "web" && (
        <>
          <Text style={s.sectionTitle}>通知</Text>
          <View style={s.card}>
            <TouchableOpacity style={s.row} onPress={handleToggleNotif} activeOpacity={0.7}>
              <Text style={s.label}>プッシュ通知</Text>
              <View style={[s.badge, { backgroundColor: notifEnabled ? colors.accent : colors.border }]}>
                <Text style={s.badgeText}>{notifEnabled ? "ON" : "OFF"}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* 使い方 */}
      <Text style={s.sectionTitle}>使い方</Text>
      <View style={s.card}>
        {howToItems.map((item, i) => (
          <View key={i}>
            {i > 0 && <View style={s.separator} />}
            <View style={s.howToRow}>
              <Text style={s.howToLabel}>{item.label}</Text>
              <Text style={s.howToDesc}>{item.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* 法的情報 */}
      <Text style={s.sectionTitle}>法的情報</Text>
      <View style={s.card}>
        {legalItems.map((item, i) => (
          <View key={item.label}>
            {i > 0 && <View style={s.separator} />}
            <TouchableOpacity style={s.row} onPress={() => Linking.openURL(item.url)} activeOpacity={0.7}>
              <Text style={s.label}>{item.label}</Text>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

    </ScrollView>
  );
}

const legalItems = [
  { label: "プライバシーポリシー", url: "https://example.com" },
  { label: "利用規約", url: "https://example.com" },
  { label: "ライセンス", url: "https://example.com" },
];

const howToItems = [
  {
    label: "タブの切り替え",
    desc: "左右にスワイプ、またはタブをタップ",
  },
  {
    label: "リストを最新にする",
    desc: "リストを下に引っ張って放す（プルダウン更新）",
  },
  {
    label: "ノートを編集する",
    desc: "リストからノートをタップ → 「編集」ボタン",
  },
  {
    label: "複数選択して一括削除",
    desc: "リストのアイテムを長押し → チェックして「削除」",
  },
  {
    label: "タスクの完了切り替え",
    desc: "タスク一覧のチェックボックスをタップ",
  },
  {
    label: "タスクの期日設定",
    desc: "タスク詳細画面のカレンダーアイコンをタップ",
  },
  {
    label: "ノートの1行目がタイトル",
    desc: "編集画面で最初の行に書いたテキストがリストのタイトルに反映される",
  },
];

function makeStyles(colors: ReturnType<typeof import("../src/theme").useTheme>["colors"]) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48 },
    sectionTitle: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 8,
      marginTop: 24,
      marginLeft: 4,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginLeft: 16,
    },
    label: {
      fontSize: 16,
      color: colors.text,
    },
    value: {
      fontSize: 14,
      color: colors.textSecondary,
      maxWidth: "60%",
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 12,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: "600",
      color: "#fff",
    },
    howToRow: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    howToLabel: {
      fontSize: 15,
      fontWeight: "500",
      color: colors.text,
      marginBottom: 3,
    },
    howToDesc: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    chevron: {
      fontSize: 20,
      color: colors.textSecondary,
    },
    themeRow: {
      flexDirection: "row",
      padding: 8,
      gap: 6,
    },
    themeBtn: {
      flex: 1,
      paddingVertical: 8,
      alignItems: "center",
      borderRadius: 8,
      backgroundColor: colors.border,
    },
    themeBtnFirst: {},
    themeBtnLast: {},
    themeBtnText: {
      fontSize: 13,
      fontWeight: "500",
      color: colors.text,
    },
  });
}
