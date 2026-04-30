import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";
import {
  enable as enableAutostart,
  disable as disableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";
import type { StorageMode } from "@flote/types";
import { useUIStore, type ThemeMode } from "../store/uiStore";
import { DARK_CODE_THEME_OPTIONS, LIGHT_CODE_THEME_OPTIONS } from "@flote/types";
import type { DarkEditorTheme, LightEditorTheme } from "../store/uiStore";
import { getConfig, setConfig, type AppSettings } from "../config";
import { useAuth } from "../hooks/useAuth";
import styles from "./Settings.module.css";

type SettingsTab = "general" | "shortcuts" | "howto" | "account" | "storage" | "legal";

type Props = {
  currentMode: StorageMode;
  onClose: () => void;
  onStorageModeChange: (mode: StorageMode) => void;
  onRequestLogin?: () => void;
};

export default function Settings({
  currentMode,
  onClose,
  onStorageModeChange,
  onRequestLogin,
}: Props) {
  const [tab, setTab] = useState<SettingsTab>("general");

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.nav}>
          <div className={styles.navHeader}>設定</div>
          {(
            [
              ["general", "一般"],
              ["shortcuts", "ショートカット"],
              ["howto", "使い方"],
              ["account", "アカウント"],
              ["storage", "保存先"],
              ["legal", "法的情報"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={`${styles.navItem} ${tab === key ? styles.navItemActive : ""}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
          <div className={styles.navSpacer} />
          <button className={styles.closeBtn} onClick={onClose}>
            Esc 閉じる
          </button>
        </div>
        <div className={styles.content}>
          {tab === "general" && <GeneralTab />}
          {tab === "shortcuts" && <ShortcutsTab />}
          {tab === "howto" && <HowToTab />}
          {tab === "account" && (
            <AccountTab
              currentMode={currentMode}
              onStorageModeChange={onStorageModeChange}
            />
          )}
          {tab === "storage" && (
            <StorageTab
              currentMode={currentMode}
              onStorageModeChange={onStorageModeChange}
              onRequestLogin={onRequestLogin}
            />
          )}
          {tab === "legal" && <LegalTab />}
        </div>
      </div>
    </div>
  );
}

/* ─── General ─── */


function GeneralTab() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const editorThemeDark = useUIStore((s) => s.editorThemeDark);
  const editorThemeLight = useUIStore((s) => s.editorThemeLight);
  const setEditorThemeDark = useUIStore((s) => s.setEditorThemeDark);
  const setEditorThemeLight = useUIStore((s) => s.setEditorThemeLight);
  const addToast = useUIStore((s) => s.addToast);
  const searchFullText = useUIStore((s) => s.searchFullText);
  const setSearchFullText = useUIStore((s) => s.setSearchFullText);
  const hideCompletedInSearch = useUIStore((s) => s.hideCompletedInSearch);
  const setHideCompletedInSearch = useUIStore((s) => s.setHideCompletedInSearch);
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [hideOnBlur, setHideOnBlur] = useState(false);
  const [launchAtLogin, setLaunchAtLogin] = useState(false);
  const [hideDockIcon, setHideDockIcon] = useState(false);

  useEffect(() => {
    getConfig().then((c) => {
      setAlwaysOnTop(c.alwaysOnTop);
      setHideOnBlur(c.hideOnBlur);
      setLaunchAtLogin(c.launchAtLogin);
      setHideDockIcon(c.hideDockIcon);
    });
  }, []);

  const handleSearchFullText = (v: boolean) => {
    setSearchFullText(v);
    setConfig({ searchFullText: v });
  };

  const handleHideCompletedInSearch = (v: boolean) => {
    setHideCompletedInSearch(v);
    setConfig({ hideCompletedInSearch: v });
  };

  const handleTheme = (t: ThemeMode) => {
    setTheme(t);
    setConfig({ theme: t });
  };

  const handleEditorThemeDark = (t: DarkEditorTheme) => {
    setEditorThemeDark(t);
    setConfig({ editorThemeDark: t });
  };

  const handleEditorThemeLight = (t: LightEditorTheme) => {
    setEditorThemeLight(t);
    setConfig({ editorThemeLight: t });
  };

  const handleAlwaysOnTop = async (v: boolean) => {
    setAlwaysOnTop(v);
    await setConfig({ alwaysOnTop: v });
    await invoke("set_always_on_top", { value: v });
  };

  const handleHideOnBlur = async (v: boolean) => {
    setHideOnBlur(v);
    await setConfig({ hideOnBlur: v });
  };

  const handleLaunchAtLogin = async (v: boolean) => {
    setLaunchAtLogin(v);
    await setConfig({ launchAtLogin: v });
    try {
      if (v) {
        await enableAutostart();
      } else {
        await disableAutostart();
      }
    } catch {
      addToast("error", "自動起動の設定に失敗しました");
    }
  };

  const handleHideDockIcon = async (v: boolean) => {
    setHideDockIcon(v);
    await setConfig({ hideDockIcon: v });
    await invoke("set_dock_visible", { visible: !v });
  };

  return (
    <>
      <h3 className={styles.sectionTitle}>一般</h3>

      <div className={styles.field}>
        <div className={styles.fieldLabel}>テーマ</div>
        <div className={styles.toggleGroup}>
          {(["dark", "light", "system"] as const).map((t) => (
            <button
              key={t}
              className={`${styles.toggleBtn} ${theme === t ? styles.toggleBtnActive : ""}`}
              onClick={() => handleTheme(t)}
            >
              {t === "dark" ? "Dark" : t === "light" ? "Light" : "System"}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <div className={styles.switchRow}>
          <span className={styles.switchLabel}>常に最前面</span>
          <Toggle checked={alwaysOnTop} onChange={handleAlwaysOnTop} />
        </div>
      </div>

      <div className={styles.field}>
        <div className={styles.switchRow}>
          <span className={styles.switchLabel}>
            フォーカスを失ったとき非表示にする
          </span>
          <Toggle checked={hideOnBlur} onChange={handleHideOnBlur} />
        </div>
      </div>

      <div className={styles.field}>
        <div className={styles.switchRow}>
          <span className={styles.switchLabel}>ログイン時に起動</span>
          <Toggle checked={launchAtLogin} onChange={handleLaunchAtLogin} />
        </div>
      </div>

      <div className={styles.field}>
        <div className={styles.switchRow}>
          <span className={styles.switchLabel}>Dockアイコンを非表示</span>
          <Toggle checked={hideDockIcon} onChange={handleHideDockIcon} />
        </div>
      </div>

      <h3 className={styles.sectionTitle}>エディタ</h3>

      <div className={styles.field}>
        <div className={styles.fieldLabel}>Syntax highlight — ダークモード</div>
        <div className={styles.editorThemeGrid}>
          {DARK_CODE_THEME_OPTIONS.map((t) => (
            <button
              key={t.value}
              className={`${styles.editorThemeBtn} ${editorThemeDark === t.value ? styles.editorThemeBtnActive : ""}`}
              onClick={() => handleEditorThemeDark(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <div className={styles.fieldLabel}>Syntax highlight — ライトモード</div>
        <div className={styles.editorThemeGrid}>
          {LIGHT_CODE_THEME_OPTIONS.map((t) => (
            <button
              key={t.value}
              className={`${styles.editorThemeBtn} ${editorThemeLight === t.value ? styles.editorThemeBtnActive : ""}`}
              onClick={() => handleEditorThemeLight(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <h3 className={styles.sectionTitle}>検索</h3>

      <div className={styles.field}>
        <div className={styles.switchRow}>
          <span className={styles.switchLabel}>コマンドパレットで本文も検索する</span>
          <Toggle checked={searchFullText} onChange={handleSearchFullText} />
        </div>
      </div>

      <div className={styles.field}>
        <div className={styles.switchRow}>
          <span className={styles.switchLabel}>完了済みタスクを検索から除外する</span>
          <Toggle checked={hideCompletedInSearch} onChange={handleHideCompletedInSearch} />
        </div>
      </div>
    </>
  );
}

/* ─── Shortcuts ─── */

function ShortcutsTab() {
  const [globalShortcut, setGlobalShortcut] = useState("CmdOrCtrl+Shift+N");
  const [recording, setRecording] = useState(false);
  const addToast = useUIStore((s) => s.addToast);

  useEffect(() => {
    getConfig().then((c) => setGlobalShortcut(c.globalShortcut));
  }, []);

  const startRecording = () => setRecording(true);

  useEffect(() => {
    if (!recording) return;

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Ignore modifier-only presses
      if (["Meta", "Control", "Alt", "Shift"].includes(e.key)) return;

      const parts: string[] = [];
      if (e.metaKey || e.ctrlKey) parts.push("CmdOrCtrl");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");
      parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);

      const shortcut = parts.join("+");
      setGlobalShortcut(shortcut);
      setRecording(false);

      invoke("update_global_shortcut", { shortcut })
        .then(() => {
          setConfig({ globalShortcut: shortcut });
          addToast("success", `ショートカットを ${shortcut} に変更しました`);
        })
        .catch(() => {
          addToast("error", "ショートカットの変更に失敗しました");
        });
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [recording, addToast]);

  const appShortcuts = [
    ["コマンドパレット", "⌘K"],
    ["新規ノート", "⌘N"],
    ["新規タスク", "⌘T"],
    ["検索フォーカス", "⌘F"],
    ["Notesタブ", "⌘1"],
    ["Tasksタブ", "⌘2"],
    ["前のアイテム", "⌘↑"],
    ["次のアイテム", "⌘↓"],
    ["テーマ切替", "⌘⇧L"],
    ["設定", "⌘,"],
  ];

  return (
    <>
      <h3 className={styles.sectionTitle}>ショートカット</h3>

      <div className={styles.field}>
        <div className={styles.fieldLabel}>グローバルショートカット</div>
        {recording ? (
          <div className={styles.recording}>
            キーの組み合わせを押してください...
          </div>
        ) : (
          <div className={styles.shortcutRow}>
            <span className={styles.shortcutLabel}>Floteを開く/閉じる</span>
            <div className={styles.shortcutRight}>
              <span className={styles.shortcutKeys}>{globalShortcut}</span>
              <button
                className={styles.shortcutChangeBtn}
                onClick={startRecording}
              >
                変更
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={styles.field}>
        <div className={styles.fieldLabel}>アプリ内ショートカット</div>
        {appShortcuts.map(([label, keys]) => (
          <div key={label} className={styles.shortcutRow}>
            <span className={styles.shortcutLabel}>{label}</span>
            <span className={styles.shortcutKeys}>{keys}</span>
          </div>
        ))}
      </div>
    </>
  );
}

/* ─── Account ─── */

function AccountTab({
  currentMode,
  onStorageModeChange,
}: {
  currentMode: StorageMode;
  onStorageModeChange: (mode: StorageMode) => void;
}) {
  const { session, supabaseConfigured, signIn, signUp, signOut } = useAuth();
  const addToast = useUIStore((s) => s.addToast);
  const [authTab, setAuthTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (authTab === "signup") {
        await signUp(email, password);
        addToast("success", "アカウントを作成しました");
      } else {
        await signIn(email, password);
        addToast("success", "ログインしました");
      }
      // ローカルモードの場合はクラウドに切り替えてリロード（session伝播の問題を回避）
      if (currentMode === "local") {
        await setConfig({ storageMode: "supabase" });
        window.location.reload();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    addToast("info", "ログアウトしました");
    if (currentMode === "supabase") {
      onStorageModeChange("local");
    }
  };

  if (session) {
    const userEmail = session.user.email ?? "";
    const initial = userEmail.charAt(0).toUpperCase();
    return (
      <>
        <h3 className={styles.sectionTitle}>アカウント</h3>
        <div className={styles.userProfile}>
          <div className={styles.avatar}>{initial}</div>
          <div className={styles.userInfo}>
            <div className={styles.userEmail}>{userEmail}</div>
          </div>
        </div>
        <button className={styles.logoutBtn} onClick={handleSignOut}>
          ログアウト
        </button>
      </>
    );
  }

  if (!supabaseConfigured) {
    return (
      <>
        <h3 className={styles.sectionTitle}>アカウント</h3>
        <div className={styles.storageInfo}>
          クラウド同期が設定されていません。
        </div>
      </>
    );
  }

  return (
    <>
      <h3 className={styles.sectionTitle}>アカウント</h3>
      <form className={styles.authForm} onSubmit={handleSubmit}>
        <div className={styles.authTabs}>
          <button
            type="button"
            className={`${styles.authTab} ${authTab === "login" ? styles.authTabActive : ""}`}
            onClick={() => {
              setAuthTab("login");
              setError(null);
            }}
          >
            ログイン
          </button>
          <button
            type="button"
            className={`${styles.authTab} ${authTab === "signup" ? styles.authTabActive : ""}`}
            onClick={() => {
              setAuthTab("signup");
              setError(null);
            }}
          >
            サインアップ
          </button>
        </div>

        {error && <div className={styles.authError}>{error}</div>}

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="メールアドレス"
          required
          className={styles.authInput}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="パスワード"
          required
          minLength={6}
          className={styles.authInput}
        />
        <button
          type="submit"
          disabled={loading}
          className={styles.authSubmit}
        >
          {loading
            ? "処理中..."
            : authTab === "signup"
              ? "サインアップ"
              : "ログイン"}
        </button>
      </form>
    </>
  );
}

/* ─── Storage ─── */

function StorageTab({
  currentMode,
  onStorageModeChange,
  onRequestLogin,
}: {
  currentMode: StorageMode;
  onStorageModeChange: (mode: StorageMode) => void;
  onRequestLogin?: () => void;
}) {
  const { session, supabaseConfigured } = useAuth();
  const addToast = useUIStore((s) => s.addToast);
  const isLoggedIn = !!session;
  const [dataDir, setDataDir] = useState<string>("");
  const [customUrl, setCustomUrl] = useState("");
  const [customKey, setCustomKey] = useState("");
  const [showSupabaseForm, setShowSupabaseForm] = useState(false);
  const [savingSupabase, setSavingSupabase] = useState(false);

  useEffect(() => {
    appDataDir().then(setDataDir).catch(() => {});
    getConfig().then((c) => {
      setCustomUrl(c.customSupabaseUrl);
      setCustomKey(c.customSupabaseAnonKey);
    });
  }, []);

  const handleCloudClick = () => {
    if (!isLoggedIn) {
      onRequestLogin?.();
    } else {
      onStorageModeChange("supabase");
    }
  };

  const handleOpenDataDir = () => {
    if (dataDir) invoke("open_path", { path: dataDir });
  };

  const handleSaveSupabase = async () => {
    const url = customUrl.trim();
    const key = customKey.trim();
    if (!url || !key) {
      addToast("error", "URLとAnon Keyを両方入力してください");
      return;
    }
    setSavingSupabase(true);
    await setConfig({ customSupabaseUrl: url, customSupabaseAnonKey: key });
    window.location.reload();
  };

  const handleClearSupabase = async () => {
    await setConfig({ customSupabaseUrl: "", customSupabaseAnonKey: "", storageMode: "local" });
    window.location.reload();
  };

  const hasCustomConfig = !!customUrl;

  return (
    <>
      <h3 className={styles.sectionTitle}>保存先</h3>

      <div className={styles.field}>
        <div className={styles.toggleGroup}>
          <button
            className={`${styles.toggleBtn} ${currentMode === "local" ? styles.toggleBtnActive : ""}`}
            onClick={() => onStorageModeChange("local")}
          >
            ローカル
          </button>
          <button
            className={`${styles.toggleBtn} ${currentMode === "supabase" ? styles.toggleBtnActive : ""} ${!supabaseConfigured ? styles.toggleBtnDisabled : ""}`}
            onClick={supabaseConfigured ? handleCloudClick : undefined}
            disabled={!supabaseConfigured}
            title={!supabaseConfigured ? "Supabase接続設定が必要です" : undefined}
          >
            クラウド
            {supabaseConfigured && !isLoggedIn && <span className={styles.badge}>要ログイン</span>}
            {!supabaseConfigured && <span className={styles.badge}>未設定</span>}
          </button>
        </div>
      </div>

      <div className={styles.storageInfo}>
        {currentMode === "local"
          ? "ノートとタスクはこのデバイスにローカル保存されます。"
          : "ノートとタスクはクラウドに保存されます。"}
      </div>

      {currentMode === "local" && dataDir && (
        <div className={styles.field}>
          <div className={styles.fieldLabel}>データ保存場所</div>
          <button className={styles.dataDirBtn} onClick={handleOpenDataDir} title="Finderで開く">
            <span className={styles.dataDirPath}>{dataDir}</span>
            <span className={styles.dataDirIcon}>↗</span>
          </button>
          <div className={styles.fieldHint}>クリックするとFinderで開きます</div>
        </div>
      )}

      <div className={styles.storageInfo}>
        ローカルデータは保持されます。保存先を切り替えてもデータは削除されません。
      </div>

      {/* Supabase接続設定 */}
      <h3 className={styles.sectionTitle}>Supabase接続設定</h3>

      {hasCustomConfig && !showSupabaseForm ? (
        <div className={styles.field}>
          <div className={styles.fieldLabel}>接続先</div>
          <div className={styles.fieldHint} style={{ wordBreak: "break-all" }}>{customUrl}</div>
          <div className={styles.supabaseActions}>
            <button className={styles.shortcutChangeBtn} onClick={() => setShowSupabaseForm(true)}>変更</button>
            <button className={styles.shortcutChangeBtn} style={{ color: "var(--danger, #e53e3e)" }} onClick={handleClearSupabase}>削除</button>
          </div>
        </div>
      ) : (
        <div className={styles.field}>
          <div className={styles.fieldLabel}>Supabase URL</div>
          <input
            className={styles.authInput}
            type="url"
            placeholder="https://xxxx.supabase.co"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
          />
          <div className={styles.fieldLabel} style={{ marginTop: 8 }}>Anon Key</div>
          <input
            className={styles.authInput}
            type="password"
            placeholder="eyJ..."
            value={customKey}
            onChange={(e) => setCustomKey(e.target.value)}
          />
          <div className={styles.fieldHint}>
            Supabase Cloud または セルフホスト版の「プロジェクト設定 → API」から取得できます。
          </div>
          <div className={styles.supabaseActions}>
            <button
              className={styles.authSubmit}
              onClick={handleSaveSupabase}
              disabled={savingSupabase}
            >
              {savingSupabase ? "保存中..." : "保存して接続"}
            </button>
            {hasCustomConfig && (
              <button className={styles.shortcutChangeBtn} onClick={() => setShowSupabaseForm(false)}>キャンセル</button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ─── How To ─── */

function HowToTab() {
  return (
    <>
      <h3 className={styles.sectionTitle}>使い方</h3>

      <div className={styles.helpSection}>
        <div className={styles.helpSectionTitle}>基本操作</div>
        <div className={styles.helpItem}>
          <span className={styles.helpLabel}>ノート・タスクを開く</span>
          <span className={styles.helpDesc}>サイドバーのアイテムをクリック</span>
        </div>
        <div className={styles.helpItem}>
          <span className={styles.helpLabel}>ノートを編集する</span>
          <span className={styles.helpDesc}>エディタエリアをダブルクリック</span>
        </div>
        <div className={styles.helpItem}>
          <span className={styles.helpLabel}>編集を終了する</span>
          <span className={styles.helpDesc}><kbd className={styles.kbd}>Esc</kbd> キー</span>
        </div>
        <div className={styles.helpItem}>
          <span className={styles.helpLabel}>新規ノートを作成</span>
          <span className={styles.helpDesc}><kbd className={styles.kbd}>⌘N</kbd> またはサイドバー上部の「＋ 新しいノート」</span>
        </div>
        <div className={styles.helpItem}>
          <span className={styles.helpLabel}>新規タスクを追加</span>
          <span className={styles.helpDesc}><kbd className={styles.kbd}>⌘T</kbd> またはサイドバー上部の「＋ 新しいタスク」</span>
        </div>
      </div>

      <div className={styles.helpSection}>
        <div className={styles.helpSectionTitle}>一括削除</div>
        <div className={styles.helpItem}>
          <span className={styles.helpLabel}>複数選択して削除する</span>
          <span className={styles.helpDesc}><kbd className={styles.kbd}>⌘クリック</kbd> または 右クリックで選択モードに入り、削除ボタンを押す</span>
        </div>
        <div className={styles.helpItem}>
          <span className={styles.helpLabel}>選択を解除する</span>
          <span className={styles.helpDesc}>「キャンセル」をクリック</span>
        </div>
      </div>

      <div className={styles.helpSection}>
        <div className={styles.helpSectionTitle}>ナビゲーション</div>
        <div className={styles.helpItem}>
          <span className={styles.helpLabel}>コマンドパレットを開く</span>
          <span className={styles.helpDesc}><kbd className={styles.kbd}>⌘K</kbd></span>
        </div>
        <div className={styles.helpItem}>
          <span className={styles.helpLabel}>ノート / タスクタブを切替</span>
          <span className={styles.helpDesc}><kbd className={styles.kbd}>⌘1</kbd> / <kbd className={styles.kbd}>⌘2</kbd></span>
        </div>
        <div className={styles.helpItem}>
          <span className={styles.helpLabel}>前後のアイテムへ移動</span>
          <span className={styles.helpDesc}><kbd className={styles.kbd}>⌘↑</kbd> / <kbd className={styles.kbd}>⌘↓</kbd></span>
        </div>
        <div className={styles.helpItem}>
          <span className={styles.helpLabel}>番号でアイテムを選択</span>
          <span className={styles.helpDesc}><kbd className={styles.kbd}>⌘1</kbd>〜<kbd className={styles.kbd}>⌘9</kbd>（タブ切替後は番号キー）</span>
        </div>
      </div>

      <div className={styles.helpSection}>
        <div className={styles.helpSectionTitle}>コマンドパレット</div>
        <div className={styles.helpItem}>
          <span className={styles.helpLabel}>ノート・タスクを検索</span>
          <span className={styles.helpDesc}>タイトルで絞り込み</span>
        </div>
        <div className={styles.helpItem}>
          <span className={styles.helpLabel}>英語でコマンド検索</span>
          <span className={styles.helpDesc}>add note / add task / show notes / settings など</span>
        </div>
      </div>

    </>
  );
}

/* ─── Legal ─── */

function LegalTab() {
  const items = [
    { label: "プライバシーポリシー", url: "https://example.com" },
    { label: "利用規約", url: "https://example.com" },
    { label: "ライセンス", url: "https://example.com" },
  ];

  return (
    <>
      <h3 className={styles.sectionTitle}>法的情報</h3>
      <div className={styles.helpSection}>
        {items.map(({ label, url }) => (
          <div key={label} className={styles.helpItem}>
            <button
              className={styles.legalLink}
              onClick={() => window.open(url, "_blank")}
            >
              {label}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

/* ─── Toggle component ─── */

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className={styles.switch}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={styles.switchInput}
      />
      <span className={styles.switchSlider} />
    </label>
  );
}
