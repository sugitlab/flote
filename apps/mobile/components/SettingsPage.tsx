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
  TextInput,
} from "react-native";
import * as Notifications from "expo-notifications";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, useThemeStore, type ThemeMode } from "../src/theme";
import { useSettingsStore, DARK_CODE_THEME_OPTIONS, LIGHT_CODE_THEME_OPTIONS } from "../src/store/settingsStore";
import { reinitSupabase, defaultUrl, defaultKey } from "../src/lib/supabase";
import Dropdown from "./Dropdown";
import { useTaskStore } from "../src/store/taskStore";
import { rescheduleAllReminders } from "../src/lib/notifications";
import { supabase } from "../src/lib/supabase";
import FloteLogo from "./FloteLogo";

type SubPage = "general" | "storage" | "howto" | "about" | null;

type Props = { onSignOut: () => void };

export default function SettingsPage({ onSignOut }: Props) {
  const { colors, mode } = useTheme();
  const setThemeMode = useThemeStore((s) => s.setMode);
  const reminderHour = useSettingsStore((s) => s.reminderHour);
  const setReminderHour = useSettingsStore((s) => s.setReminderHour);
  const searchFullText = useSettingsStore((s) => s.searchFullText);
  const setSearchFullText = useSettingsStore((s) => s.setSearchFullText);
  const hideCompletedTasks = useSettingsStore((s) => s.hideCompletedTasks);
  const setHideCompletedTasks = useSettingsStore((s) => s.setHideCompletedTasks);
  const codeThemeDark = useSettingsStore((s) => s.codeThemeDark);
  const codeThemeLight = useSettingsStore((s) => s.codeThemeLight);
  const setCodeThemeDark = useSettingsStore((s) => s.setCodeThemeDark);
  const setCodeThemeLight = useSettingsStore((s) => s.setCodeThemeLight);
  const customSupabaseUrl = useSettingsStore((s) => s.customSupabaseUrl);
  const customSupabaseAnonKey = useSettingsStore((s) => s.customSupabaseAnonKey);
  const setCustomSupabase = useSettingsStore((s) => s.setCustomSupabase);
  const clearCustomSupabase = useSettingsStore((s) => s.clearCustomSupabase);
  const isSelfHosted = !!customSupabaseUrl;
  const [storageMode, setStorageMode] = useState<"cloud" | "selfhosted">(isSelfHosted ? "selfhosted" : "cloud");
  const [supabaseUrlInput, setSupabaseUrlInput] = useState(customSupabaseUrl);
  const [supabaseKeyInput, setSupabaseKeyInput] = useState(customSupabaseAnonKey);
  const tasks = useTaskStore((s) => s.tasks);
  const [email, setEmail] = useState<string | null>(null);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [subPage, setSubPage] = useState<SubPage>(null);

  useEffect(() => {
    setStorageMode(isSelfHosted ? "selfhosted" : "cloud");
  }, [isSelfHosted]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    Notifications.getPermissionsAsync().then(({ status }) => setNotifEnabled(status === "granted"));
  }, []);

  const handleToggleNotif = useCallback(async () => {
    if (notifEnabled) {
      Alert.alert("通知の無効化", "通知を無効にするにはシステム設定から変更してください。", [{ text: "OK" }]);
      return;
    }
    const { status } = await Notifications.requestPermissionsAsync();
    setNotifEnabled(status === "granted");
    if (status !== "granted") Alert.alert("通知が許可されませんでした", "設定アプリから通知を許可してください。");
  }, [notifEnabled]);

  const handleChangeReminderHour = useCallback(async (delta: number) => {
    const next = Math.min(23, Math.max(0, reminderHour + delta));
    await setReminderHour(next);
    rescheduleAllReminders(tasks, next);
  }, [reminderHour, setReminderHour, tasks]);

  const handleSignOut = useCallback(() => {
    Alert.alert("ログアウト", "ログアウトしますか？", [
      { text: "キャンセル", style: "cancel" },
      { text: "ログアウト", style: "destructive", onPress: async () => { await supabase.auth.signOut(); onSignOut(); } },
    ]);
  }, [onSignOut]);

  const handleConnectSelfHosted = useCallback(async () => {
    const url = supabaseUrlInput.trim();
    const key = supabaseKeyInput.trim();
    if (!url || !key) { Alert.alert("入力エラー", "URLとAnon Keyの両方を入力してください。"); return; }
    await setCustomSupabase(url, key);
    reinitSupabase(url, key);
    await supabase.auth.signOut();
    Alert.alert("接続先を変更しました", "新しいSupabaseに接続しました。再度ログインしてください。");
  }, [supabaseUrlInput, supabaseKeyInput, setCustomSupabase]);

  const handleSwitchToCloud = useCallback(() => {
    if (!isSelfHosted) {
      setStorageMode("cloud");
      return;
    }
    Alert.alert("クラウド版に切り替え", "クラウド版に切り替えます。ログアウトされます。", [
      { text: "キャンセル", style: "cancel" },
      { text: "切り替える", style: "destructive", onPress: async () => {
        await clearCustomSupabase();
        setSupabaseUrlInput("");
        setSupabaseKeyInput("");
        reinitSupabase(defaultUrl, defaultKey);
        await supabase.auth.signOut();
      }},
    ]);
  }, [isSelfHosted, clearCustomSupabase]);

  const handleSwitchToSelfHosted = useCallback(() => {
    setSupabaseUrlInput(useSettingsStore.getState().customSupabaseUrl);
    setSupabaseKeyInput(useSettingsStore.getState().customSupabaseAnonKey);
    setStorageMode("selfhosted");
  }, []);

  const s = makeStyles(colors);

  const SubPageWrap = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[s.backBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setSubPage(null)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.backBtn}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.backTitle, { color: colors.text }]}>{title}</Text>
        <View style={s.backBtnPlaceholder} />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>{children}</ScrollView>
    </View>
  );

  // ── 一般 ──────────────────────────────────────────────────────────────────

  if (subPage === "general") return (
    <SubPageWrap title="一般">
      <Text style={s.sectionTitle}>テーマ</Text>
      <View style={s.card}>
        <View style={s.themeRow}>
          {(["system", "light", "dark"] as ThemeMode[]).map((m) => (
            <TouchableOpacity key={m} style={[s.themeBtn, mode === m && { backgroundColor: colors.accent }]} onPress={() => setThemeMode(m)} activeOpacity={0.7}>
              <Text style={[s.themeBtnText, mode === m && { color: "#fff" }]}>
                {m === "system" ? "システム" : m === "light" ? "ライト" : "ダーク"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={s.sectionTitle}>エディタ</Text>
      <View style={s.card}>
        <View style={s.row}>
          <Text style={s.label}>コードテーマ（ダーク）</Text>
          <Dropdown options={DARK_CODE_THEME_OPTIONS} value={codeThemeDark} onChange={setCodeThemeDark} />
        </View>
        <View style={s.separator} />
        <View style={s.row}>
          <Text style={s.label}>コードテーマ（ライト）</Text>
          <Dropdown options={LIGHT_CODE_THEME_OPTIONS} value={codeThemeLight} onChange={setCodeThemeLight} />
        </View>
      </View>

      <Text style={s.sectionTitle}>検索</Text>
      <View style={s.card}>
        <TouchableOpacity style={s.row} onPress={() => setSearchFullText(!searchFullText)} activeOpacity={0.7}>
          <Text style={s.label}>本文も検索する</Text>
          <View style={[s.badge, { backgroundColor: searchFullText ? colors.accent : colors.border }]}>
            <Text style={s.badgeText}>{searchFullText ? "ON" : "OFF"}</Text>
          </View>
        </TouchableOpacity>
        <View style={s.separator} />
        <TouchableOpacity style={s.row} onPress={() => setHideCompletedTasks(!hideCompletedTasks)} activeOpacity={0.7}>
          <Text style={s.label}>完了済みのタスクを非表示</Text>
          <View style={[s.badge, { backgroundColor: hideCompletedTasks ? colors.accent : colors.border }]}>
            <Text style={s.badgeText}>{hideCompletedTasks ? "ON" : "OFF"}</Text>
          </View>
        </TouchableOpacity>
      </View>

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
            <View style={s.separator} />
            <View style={s.row}>
              <Text style={s.label}>リマインダー時刻</Text>
              <View style={s.hourPicker}>
                <TouchableOpacity style={[s.hourBtn, { backgroundColor: colors.border }]} onPress={() => handleChangeReminderHour(-1)} disabled={reminderHour <= 0}>
                  <Text style={[s.hourBtnText, { color: reminderHour <= 0 ? colors.textSecondary : colors.text }]}>−</Text>
                </TouchableOpacity>
                <Text style={[s.hourValue, { color: colors.text }]}>{String(reminderHour).padStart(2, "0")}:00</Text>
                <TouchableOpacity style={[s.hourBtn, { backgroundColor: colors.border }]} onPress={() => handleChangeReminderHour(1)} disabled={reminderHour >= 23}>
                  <Text style={[s.hourBtnText, { color: reminderHour >= 23 ? colors.textSecondary : colors.text }]}>＋</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </>
      )}
    </SubPageWrap>
  );

  // ── 保存先 ────────────────────────────────────────────────────────────────

  if (subPage === "storage") return (
    <SubPageWrap title="保存先">
      {/* Cloud / Self-hosted toggle */}
      <Text style={s.sectionTitle}>接続先</Text>
      <View style={[s.card, { padding: 8 }]}>
        <View style={s.themeRow}>
          <TouchableOpacity
            style={[s.themeBtn, storageMode === "cloud" && { backgroundColor: colors.accent }]}
            onPress={handleSwitchToCloud}
            activeOpacity={0.7}
          >
            <Text style={[s.themeBtnText, { color: storageMode === "cloud" ? "#fff" : colors.text }]}>クラウド版</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.themeBtn, storageMode === "selfhosted" && { backgroundColor: colors.accent }]}
            onPress={handleSwitchToSelfHosted}
            activeOpacity={0.7}
          >
            <Text style={[s.themeBtnText, { color: storageMode === "selfhosted" ? "#fff" : colors.text }]}>セルフホスト版</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Self-hosted connection form */}
      {storageMode === "selfhosted" && (
        <>
          <Text style={s.sectionTitle}>Supabase接続設定</Text>
          <View style={s.card}>
            <View style={{ padding: 16, gap: 10 }}>
              <TextInput
                style={[s.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="Supabase URL (https://xxxx.supabase.co)"
                placeholderTextColor={colors.textSecondary}
                value={supabaseUrlInput}
                onChangeText={setSupabaseUrlInput}
                autoCapitalize="none"
                keyboardType="url"
              />
              <TextInput
                style={[s.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="Anon Key (eyJ...)"
                placeholderTextColor={colors.textSecondary}
                value={supabaseKeyInput}
                onChangeText={setSupabaseKeyInput}
                autoCapitalize="none"
                secureTextEntry
              />
              <Text style={[s.hint, { color: colors.textSecondary }]}>
                Supabase の「プロジェクト設定 → API」から取得できます。
              </Text>
              <TouchableOpacity style={[s.saveBtn, { backgroundColor: colors.accent }]} onPress={handleConnectSelfHosted} activeOpacity={0.8}>
                <Text style={s.saveBtnText}>保存して接続</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* Account */}
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
    </SubPageWrap>
  );

  // ── 使い方 ────────────────────────────────────────────────────────────────

  if (subPage === "howto") return (
    <SubPageWrap title="使い方">
      {howToSections.map((section) => (
        <View key={section.title}>
          <Text style={s.sectionTitle}>{section.title}</Text>
          <View style={s.card}>
            {section.items.map((item, i) => (
              <View key={i}>
                {i > 0 && <View style={s.separator} />}
                <View style={s.howToRow}>
                  <Text style={s.howToLabel}>{item.label}</Text>
                  <Text style={s.howToDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
    </SubPageWrap>
  );

  // ── Floteについて ─────────────────────────────────────────────────────────

  if (subPage === "about") return (
    <SubPageWrap title="Floteについて">
      <View style={s.aboutHeader}>
        <FloteLogo size={64} />
        <Text style={[s.aboutAppName, { color: colors.text }]}>Flote</Text>
        <Text style={[s.aboutDesc, { color: colors.textSecondary }]}>
          ショートカット起動のフローティングノート＆タスク管理アプリ。
        </Text>
      </View>
      <Text style={s.sectionTitle}>法的情報</Text>
      <View style={s.card}>
        {legalItems.map((item, i) => (
          <View key={item.label}>
            {i > 0 && <View style={s.separator} />}
            <TouchableOpacity style={s.row} onPress={() => Linking.openURL(item.url)} activeOpacity={0.7}>
              <Text style={s.label}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </SubPageWrap>
  );

  // ── メインメニュー ────────────────────────────────────────────────────────

  type MenuItem = { key: SubPage; label: string; icon: keyof typeof Ionicons.glyphMap; desc?: string };
  const menuItems: MenuItem[] = [
    { key: "general", label: "一般",          icon: "settings-outline",           desc: "テーマ・エディタ・検索・通知" },
    { key: "howto",   label: "使い方",        icon: "help-circle-outline",        desc: "操作ガイド" },
    { key: "storage", label: "保存先",        icon: "cloud-outline",              desc: customSupabaseUrl ? "カスタム接続" : "未設定" },
    { key: "about",   label: "Floteについて", icon: "information-circle-outline" },
  ];

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.appHeader}>
        <FloteLogo size={56} />
        <Text style={[s.appName, { color: colors.text }]}>Flote</Text>
      </View>

      <Text style={s.sectionTitle}>設定</Text>
      <View style={s.card}>
        {menuItems.map((item, i) => (
          <View key={item.key}>
            {i > 0 && <View style={s.separator} />}
            <TouchableOpacity style={s.menuRow} onPress={() => setSubPage(item.key)} activeOpacity={0.7}>
              <View style={[s.menuIconWrap, { backgroundColor: colors.accent }]}>
                <Ionicons name={item.icon} size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: colors.text }]}>{item.label}</Text>
                {item.desc && <Text style={[s.menuDesc, { color: colors.textSecondary }]} numberOfLines={1}>{item.desc}</Text>}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
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
  { label: "ライセンス (MIT)", url: "https://example.com" },
];

const howToSections = [
  {
    title: "基本操作",
    items: [
      { label: "タブの切り替え", desc: "左右にスワイプ、またはタブをタップ" },
      { label: "リストを最新にする", desc: "リストを下に引っ張って放す（プルダウン更新）" },
      { label: "ノートを編集する", desc: "リストからノートをタップ → 「編集」ボタン" },
      { label: "複数選択して削除", desc: "リストのアイテムを長押し → チェックして「削除」" },
    ],
  },
  {
    title: "タスク",
    items: [
      { label: "完了切り替え", desc: "タスク一覧のチェックボックスをタップ" },
      { label: "期日設定", desc: "タスク詳細画面のカレンダーアイコンをタップ" },
    ],
  },
  {
    title: "タグ",
    items: [
      { label: "#タグ で分類", desc: "ノートやタスクの本文に #タグ と書くと自動抽出され、リスト上部のドロップダウンでフィルターできます" },
    ],
  },
];

function makeStyles(colors: ReturnType<typeof import("../src/theme").useTheme>["colors"]) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48 },
    appHeader: { alignItems: "center", paddingVertical: 24, gap: 6 },
    appName: { fontSize: 22, fontWeight: "700" },
    aboutHeader: { alignItems: "center", paddingVertical: 24, gap: 8 },
    aboutAppName: { fontSize: 20, fontWeight: "700" },
    aboutDesc: { fontSize: 13, textAlign: "center", lineHeight: 18, paddingHorizontal: 16 },
    sectionTitle: {
      fontSize: 12, fontWeight: "600", color: colors.textSecondary,
      textTransform: "uppercase", letterSpacing: 0.5,
      marginBottom: 8, marginTop: 24, marginLeft: 4,
    },
    card: { backgroundColor: colors.surface, borderRadius: 12, overflow: "hidden" },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
    menuRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
    menuIconWrap: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    menuDesc: { fontSize: 12, marginTop: 1 },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 16 },
    label: { fontSize: 16, color: colors.text },
    value: { fontSize: 14, color: colors.textSecondary, maxWidth: "60%" },
    badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
    badgeText: { fontSize: 12, fontWeight: "600", color: "#fff" },
    howToRow: { paddingHorizontal: 16, paddingVertical: 12 },
    howToLabel: { fontSize: 15, fontWeight: "500", color: colors.text, marginBottom: 3 },
    howToDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    themeRow: { flexDirection: "row", padding: 8, gap: 6 },
    themeBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8, backgroundColor: colors.border },
    themeBtnText: { fontSize: 13, fontWeight: "500", color: colors.text },
    hourPicker: { flexDirection: "row", alignItems: "center", gap: 12 },
    hourBtn: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    hourBtnText: { fontSize: 18, fontWeight: "400", lineHeight: 22 },
    hourValue: { fontSize: 16, fontWeight: "600", minWidth: 52, textAlign: "center" },
    input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
    hint: { fontSize: 12, lineHeight: 17 },
    saveBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
    saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
    backBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
    backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    backBtnPlaceholder: { width: 44 },
    backTitle: { flex: 1, fontSize: 17, fontWeight: "600", textAlign: "center" },
  });
}
