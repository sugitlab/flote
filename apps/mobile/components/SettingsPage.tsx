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
  Image,
} from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { useLatestVersion } from "../src/hooks/useLatestVersion";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, useThemeStore, type ThemeMode } from "../src/theme";
import { useSettingsStore, DARK_CODE_THEME_OPTIONS, LIGHT_CODE_THEME_OPTIONS, type AccentColor } from "../src/store/settingsStore";

const FRUIT_IMAGES: Record<AccentColor, ReturnType<typeof require>> = {
  blueberry: require("../assets/blueberry.png"),
  cherry:    require("../assets/cherry.png"),
  kiwi:      require("../assets/kiwi.png"),
  orange:    require("../assets/orange.png"),
};
const ACCENT_KEYS: AccentColor[] = ["blueberry", "cherry", "kiwi", "orange"];
import { reinitSupabase, defaultUrl, defaultKey } from "../src/lib/supabase";
import Dropdown from "./Dropdown";
import { useTaskStore } from "../src/store/taskStore";
import { rescheduleAllReminders } from "../src/lib/notifications";
import { supabase } from "../src/lib/supabase";
import FloteLogo from "./FloteLogo";
import { useT } from "../src/hooks/useT";
import type { Language } from "../src/i18n";

type SubPage = "general" | "storage" | "howto" | "about" | null;

type SubPageWrapProps = {
  title: string;
  children: React.ReactNode;
  colors: ReturnType<typeof import("../src/theme").useTheme>["colors"];
  onBack: () => void;
};

function SubPageWrap({ title, children, colors, onBack }: SubPageWrapProps) {
  const s = makeStyles(colors);
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[s.backBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.backBtn}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.backTitle, { color: colors.text }]}>{title}</Text>
        <View style={s.backBtnPlaceholder} />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>{children}</ScrollView>
    </View>
  );
}

type Props = { onSignOut: () => void };

export default function SettingsPage({ onSignOut }: Props) {
  const { colors, mode } = useTheme();
  const t = useT();
  const setThemeMode = useThemeStore((s) => s.setMode);
  const reminderHour = useSettingsStore((s) => s.reminderHour);
  const setReminderHour = useSettingsStore((s) => s.setReminderHour);
  const mermaidHandDrawn = useSettingsStore((s) => s.mermaidHandDrawn);
  const setMermaidHandDrawn = useSettingsStore((s) => s.setMermaidHandDrawn);
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
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const accentColor = useSettingsStore((s) => s.accentColor);
  const setAccentColor = useSettingsStore((s) => s.setAccentColor);
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
      Alert.alert(t.settings.pushNotifications, t.settings.notificationDisableMessage, [{ text: "OK" }]);
      return;
    }
    const { status } = await Notifications.requestPermissionsAsync();
    setNotifEnabled(status === "granted");
    if (status !== "granted") Alert.alert(t.settings.notificationPermissionDenied, t.settings.notificationPermissionDeniedMessage);
  }, [notifEnabled, t]);

  const handleChangeReminderHour = useCallback(async (delta: number) => {
    const next = Math.min(23, Math.max(0, reminderHour + delta));
    await setReminderHour(next);
    rescheduleAllReminders(tasks, next);
  }, [reminderHour, setReminderHour, tasks]);

  const handleSignOut = useCallback(() => {
    Alert.alert(t.settings.logout, t.settings.logoutConfirm, [
      { text: t.common.cancel, style: "cancel" },
      { text: t.settings.logout, style: "destructive", onPress: async () => { await supabase.auth.signOut(); onSignOut(); } },
    ]);
  }, [onSignOut, t]);

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
      { text: t.common.cancel, style: "cancel" },
      { text: "切り替える", style: "destructive", onPress: async () => {
        await clearCustomSupabase();
        setSupabaseUrlInput("");
        setSupabaseKeyInput("");
        reinitSupabase(defaultUrl, defaultKey);
        await supabase.auth.signOut();
      }},
    ]);
  }, [isSelfHosted, clearCustomSupabase, t]);

  const handleSwitchToSelfHosted = useCallback(() => {
    setSupabaseUrlInput(useSettingsStore.getState().customSupabaseUrl);
    setSupabaseKeyInput(useSettingsStore.getState().customSupabaseAnonKey);
    setStorageMode("selfhosted");
  }, []);

  const s = makeStyles(colors);

  const goBack = useCallback(() => setSubPage(null), []);

  if (subPage === "general") return (
    <SubPageWrap title={t.settings.general} colors={colors} onBack={goBack}>
      <Text style={s.sectionTitle}>{t.settings.language}</Text>
      <View style={s.card}>
        <View style={s.themeRow}>
          {(["ja", "en"] as Language[]).map((lang) => (
            <TouchableOpacity key={lang} style={[s.themeBtn, language === lang && { backgroundColor: colors.accent }]} onPress={() => setLanguage(lang)} activeOpacity={0.7}>
              <Text style={[s.themeBtnText, language === lang && { color: "#fff" }]}>
                {lang === "ja" ? "日本語" : "English"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={s.sectionTitle}>{t.settings.theme}</Text>
      <View style={s.card}>
        <View style={s.themeRow}>
          {(["system", "light", "dark"] as ThemeMode[]).map((m) => (
            <TouchableOpacity key={m} style={[s.themeBtn, mode === m && { backgroundColor: colors.accent }]} onPress={() => setThemeMode(m)} activeOpacity={0.7}>
              <Text style={[s.themeBtnText, mode === m && { color: "#fff" }]}>
                {m === "system" ? t.settings.themeSystem : m === "light" ? t.settings.themeLight : t.settings.themeDark}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={s.sectionTitle}>{t.settings.accentColor}</Text>
      <View style={s.card}>
        <View style={s.fruitRow}>
          {ACCENT_KEYS.map((key) => (
            <TouchableOpacity
              key={key}
              style={[s.fruitBtn, accentColor === key && { borderColor: colors.accent, backgroundColor: colors.accent + "22" }]}
              onPress={() => setAccentColor(key)}
              activeOpacity={0.7}
            >
              <Image source={FRUIT_IMAGES[key]} style={s.fruitImg} resizeMode="contain" />
              <Text style={[s.fruitLabel, accentColor === key && { color: colors.accent }]}>
                {t.settings.accentColors[key]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={s.sectionTitle}>{t.settings.editor}</Text>
      <View style={s.card}>
        <View style={s.row}>
          <Text style={s.label}>{t.settings.codeThemeDark}</Text>
          <Dropdown options={DARK_CODE_THEME_OPTIONS} value={codeThemeDark} onChange={setCodeThemeDark} />
        </View>
        <View style={s.separator} />
        <View style={s.row}>
          <Text style={s.label}>{t.settings.codeThemeLight}</Text>
          <Dropdown options={LIGHT_CODE_THEME_OPTIONS} value={codeThemeLight} onChange={setCodeThemeLight} />
        </View>
      </View>

      <Text style={s.sectionTitle}>{t.settings.mermaid}</Text>
      <View style={s.card}>
        <TouchableOpacity style={s.row} onPress={() => setMermaidHandDrawn(!mermaidHandDrawn)} activeOpacity={0.7}>
          <Text style={s.label}>{t.settings.mermaidHandDrawn}</Text>
          <View style={[s.badge, { backgroundColor: mermaidHandDrawn ? colors.accent : colors.border }]}>
            <Text style={s.badgeText}>{mermaidHandDrawn ? t.common.on : t.common.off}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <Text style={s.sectionTitle}>{t.settings.search}</Text>
      <View style={s.card}>
        <TouchableOpacity style={s.row} onPress={() => setSearchFullText(!searchFullText)} activeOpacity={0.7}>
          <Text style={s.label}>{t.settings.searchFullText}</Text>
          <View style={[s.badge, { backgroundColor: searchFullText ? colors.accent : colors.border }]}>
            <Text style={s.badgeText}>{searchFullText ? t.common.on : t.common.off}</Text>
          </View>
        </TouchableOpacity>
        <View style={s.separator} />
        <TouchableOpacity style={s.row} onPress={() => setHideCompletedTasks(!hideCompletedTasks)} activeOpacity={0.7}>
          <Text style={s.label}>{t.settings.hideCompleted}</Text>
          <View style={[s.badge, { backgroundColor: hideCompletedTasks ? colors.accent : colors.border }]}>
            <Text style={s.badgeText}>{hideCompletedTasks ? t.common.on : t.common.off}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {Platform.OS !== "web" && (
        <>
          <Text style={s.sectionTitle}>{t.settings.notifications}</Text>
          <View style={s.card}>
            <TouchableOpacity style={s.row} onPress={handleToggleNotif} activeOpacity={0.7}>
              <Text style={s.label}>{t.settings.pushNotifications}</Text>
              <View style={[s.badge, { backgroundColor: notifEnabled ? colors.accent : colors.border }]}>
                <Text style={s.badgeText}>{notifEnabled ? t.common.on : t.common.off}</Text>
              </View>
            </TouchableOpacity>
            <View style={s.separator} />
            <View style={s.row}>
              <Text style={s.label}>{t.settings.reminderHour}</Text>
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

  if (subPage === "storage") return (
    <SubPageWrap title={t.settings.storage} colors={colors} onBack={goBack}>
      <Text style={s.sectionTitle}>接続先</Text>
      <View style={[s.card, { padding: 8 }]}>
        <View style={s.themeRow}>
          <TouchableOpacity
            style={[s.themeBtn, storageMode === "cloud" && { backgroundColor: colors.accent }]}
            onPress={handleSwitchToCloud}
            activeOpacity={0.7}
          >
            <Text style={[s.themeBtnText, { color: storageMode === "cloud" ? "#fff" : colors.text }]}>{t.settings.cloud}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.themeBtn, storageMode === "selfhosted" && { backgroundColor: colors.accent }]}
            onPress={handleSwitchToSelfHosted}
            activeOpacity={0.7}
          >
            <Text style={[s.themeBtnText, { color: storageMode === "selfhosted" ? "#fff" : colors.text }]}>{t.settings.selfHosted}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {storageMode === "selfhosted" && (
        <>
          <Text style={s.sectionTitle}>{t.settings.supabaseSettings}</Text>
          <View style={s.card}>
            <View style={{ padding: 16, gap: 10 }}>
              <TextInput
                style={[s.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder={t.settings.supabaseUrlPlaceholder}
                placeholderTextColor={colors.textSecondary}
                value={supabaseUrlInput}
                onChangeText={setSupabaseUrlInput}
                autoCapitalize="none"
                keyboardType="url"
              />
              <TextInput
                style={[s.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder={t.settings.supabaseKeyPlaceholder}
                placeholderTextColor={colors.textSecondary}
                value={supabaseKeyInput}
                onChangeText={setSupabaseKeyInput}
                autoCapitalize="none"
                secureTextEntry
              />
              <Text style={[s.hint, { color: colors.textSecondary }]}>
                {t.settings.supabaseHint}
              </Text>
              <TouchableOpacity style={[s.saveBtn, { backgroundColor: colors.accent }]} onPress={handleConnectSelfHosted} activeOpacity={0.8}>
                <Text style={s.saveBtnText}>{t.settings.saveAndConnect}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      <Text style={s.sectionTitle}>{t.settings.account}</Text>
      <View style={s.card}>
        <View style={s.row}>
          <Text style={s.label}>{t.settings.email}</Text>
          <Text style={s.value} numberOfLines={1}>{email ?? "—"}</Text>
        </View>
        <View style={s.separator} />
        <TouchableOpacity style={s.row} onPress={handleSignOut} activeOpacity={0.7}>
          <Text style={[s.label, { color: colors.danger }]}>{t.settings.logout}</Text>
        </TouchableOpacity>
      </View>
    </SubPageWrap>
  );

  if (subPage === "howto") {
    const howToSections = [
      {
        title: t.settings.basicOperations,
        items: [
          { label: t.settings.tabSwitch, desc: t.settings.tabSwitchDesc },
          { label: t.settings.refreshList, desc: t.settings.refreshListDesc },
          { label: t.settings.editNote, desc: t.settings.editNoteDesc },
          { label: t.settings.exitEdit, desc: t.settings.exitEditDesc },
          { label: t.settings.multiDelete, desc: t.settings.multiDeleteDesc },
          { label: t.settings.pinItem, desc: t.settings.pinItemDesc },
          { label: t.settings.convertItem, desc: t.settings.convertItemDesc },
        ],
      },
      {
        title: t.settings.tasksSection,
        items: [
          { label: t.settings.toggleDone, desc: t.settings.toggleDoneDesc },
          { label: t.settings.setDueDate, desc: t.settings.setDueDateDesc },
        ],
      },
      {
        title: t.settings.tagsSection,
        items: [
          { label: t.settings.tagClassify, desc: t.settings.tagClassifyDesc },
        ],
      },
      {
        title: t.settings.markdownSection,
        items: [
          { label: t.settings.markdownToolbar, desc: t.settings.markdownToolbarDesc },
          { label: t.settings.markdownAutoList, desc: t.settings.markdownAutoListDesc },
        ],
      },
    ];

    return (
      <SubPageWrap title={t.settings.howToUse} colors={colors} onBack={goBack}>
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
  }

  if (subPage === "about") {
    const currentVersion = Constants.expoConfig?.version ?? "";
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { status, releasesUrl } = useLatestVersion(currentVersion);

    const legalItems = [
      { label: t.settings.privacyPolicy, url: "https://github.com/sugitlab/flote/blob/main/docs/privacy.md" },
      { label: t.settings.terms, url: "https://github.com/sugitlab/flote/blob/main/docs/terms.md" },
      { label: t.settings.license, url: "https://github.com/sugitlab/flote/blob/main/LICENSE" },
    ];

    return (
      <SubPageWrap title={t.settings.about} colors={colors} onBack={goBack}>
        <View style={s.aboutHeader}>
          <FloteLogo size={64} />
          <Text style={[s.aboutAppName, { color: colors.text }]}>Flote</Text>
          <View style={s.versionRow}>
            <Text style={[s.aboutVersion, { color: colors.textSecondary }]}>
              v{currentVersion || "—"}
            </Text>
            {status === "latest" && (
              <View style={[s.versionLatestBadge, { backgroundColor: colors.accent + "22" }]}>
                <Text style={[s.versionLatestText, { color: colors.accent }]}>{t.settings.latestBadge}</Text>
              </View>
            )}
            {status === "update-available" && (
              <TouchableOpacity
                style={[s.versionUpdateBtn, { backgroundColor: colors.accent }]}
                onPress={() => Linking.openURL(releasesUrl)}
                activeOpacity={0.8}
              >
                <Text style={s.versionUpdateText}>{t.settings.updateAvailable}</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={[s.aboutDesc, { color: colors.textSecondary }]}>
            {t.settings.aboutDescription}
          </Text>
        </View>
        <Text style={s.sectionTitle}>{t.settings.legal}</Text>
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
  }

  type MenuItem = { key: SubPage; label: string; icon: keyof typeof Ionicons.glyphMap; desc?: string };
  const menuItems: MenuItem[] = [
    { key: "general", label: t.settings.general,  icon: "settings-outline",           desc: `${t.settings.theme} · ${t.settings.editor} · ${t.settings.search} · ${t.settings.notifications}` },
    { key: "howto",   label: t.settings.howToUse, icon: "help-circle-outline",        desc: "操作ガイド" },
    { key: "storage", label: t.settings.storage,  icon: "cloud-outline",              desc: isSelfHosted ? t.settings.selfHosted : email ? t.settings.cloud : t.settings.notLoggedIn },
    { key: "about",   label: t.settings.about,    icon: "information-circle-outline" },
  ];

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.appHeader}>
        <FloteLogo size={56} />
        <Text style={[s.appName, { color: colors.text }]}>Flote</Text>
      </View>

      <Text style={s.sectionTitle}>{t.settings.settingsSection}</Text>
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

function makeStyles(colors: ReturnType<typeof import("../src/theme").useTheme>["colors"]) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48 },
    appHeader: { alignItems: "center", paddingVertical: 24, gap: 6 },
    appName: { fontSize: 22, fontWeight: "700" },
    aboutHeader: { alignItems: "center", paddingVertical: 24, gap: 8 },
    aboutAppName: { fontSize: 20, fontWeight: "700" },
    aboutVersion: { fontSize: 13 },
    versionRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "center" },
    versionLatestBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
    versionLatestText: { fontSize: 11, fontWeight: "600" },
    versionUpdateBtn: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
    versionUpdateText: { fontSize: 11, fontWeight: "600", color: "#fff" },
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
    fruitRow: { flexDirection: "row", padding: 8, gap: 6 },
    fruitBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10, borderWidth: 2, borderColor: "transparent", backgroundColor: colors.border + "60" },
    fruitImg: { width: 40, height: 40 },
    fruitLabel: { fontSize: 11, fontWeight: "500", color: colors.textSecondary, marginTop: 4 },
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
