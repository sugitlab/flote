import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";
import {
  enable as enableAutostart,
  disable as disableAutostart,
} from "@tauri-apps/plugin-autostart";
import type { StorageMode } from "@flote/types";
import { useUIStore, type ThemeMode } from "../store/uiStore";
import { DARK_CODE_THEME_OPTIONS, LIGHT_CODE_THEME_OPTIONS } from "@flote/types";
import type { DarkEditorTheme, LightEditorTheme } from "../store/uiStore";
import { getConfig, setConfig } from "../config";
import { reinitSupabase, getSupabase } from "@flote/api-client";
import { SCHEMA_SQL } from "../migrations";
import { useAuth } from "../hooks/useAuth";
import styles from "./Settings.module.css";

type SettingsTab = "general" | "shortcuts" | "howto" | "storage" | "legal";

type Props = {
  currentMode: StorageMode;
  onClose: () => void;
  onStorageModeChange: (mode: StorageMode) => void;
};

export default function Settings({
  currentMode,
  onClose,
  onStorageModeChange,
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
          {tab === "storage" && (
            <StorageTab
              currentMode={currentMode}
              onStorageModeChange={onStorageModeChange}
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

/* ─── Storage ─── */

function StorageTab({
  currentMode,
  onStorageModeChange,
}: {
  currentMode: StorageMode;
  onStorageModeChange: (mode: StorageMode) => void;
}) {
  const [pane, setPane] = useState<StorageMode>(currentMode);
  const cloudAvailable = !!(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  );

  return (
    <>
      <h3 className={styles.sectionTitle}>保存先</h3>

      <div className={styles.storageModeTabs}>
        {([
          ["local", "ローカル"],
          ["supabase", "クラウド"],
          ["selfhost", "セルフホスト"],
        ] as const).map(([mode, label]) => (
          <button
            key={mode}
            className={[
              styles.storageModeTab,
              pane === mode ? styles.storageModeTabSelected : "",
              mode === "supabase" && !cloudAvailable ? styles.storageModeTabDisabled : "",
            ].join(" ")}
            onClick={() => !(mode === "supabase" && !cloudAvailable) && setPane(mode)}
            disabled={mode === "supabase" && !cloudAvailable}
          >
            {label}
            {currentMode === mode && <span className={styles.activeModeDot} />}
          </button>
        ))}
      </div>

      <div className={styles.storagePane}>
        {pane === "local" && (
          <LocalPane currentMode={currentMode} onStorageModeChange={onStorageModeChange} />
        )}
        {pane === "supabase" && (
          <CloudPane currentMode={currentMode} onStorageModeChange={onStorageModeChange} />
        )}
        {pane === "selfhost" && (
          <SelfhostPane currentMode={currentMode} onStorageModeChange={onStorageModeChange} />
        )}
      </div>

      <div className={styles.storageFootnote}>
        ローカルデータは保持されます。保存先を切り替えてもデータは削除されません。
      </div>
    </>
  );
}

/* ─── Local pane ─── */

function LocalPane({
  currentMode,
  onStorageModeChange,
}: {
  currentMode: StorageMode;
  onStorageModeChange: (mode: StorageMode) => void;
}) {
  const [dataDir, setDataDir] = useState("");

  useEffect(() => {
    appDataDir().then(setDataDir).catch(() => {});
  }, []);

  return (
    <>
      <p className={styles.storageDesc}>
        ノートとタスクはこのデバイスにのみ保存されます。インターネット接続は不要です。
      </p>

      {currentMode !== "local" && (
        <button
          className={styles.useModeBtn}
          onClick={async () => {
            await setConfig({ storageMode: "local" });
            window.location.reload();
          }}
        >
          ローカルを使う
        </button>
      )}

      {dataDir && (
        <div className={styles.field}>
          <div className={styles.fieldLabel}>データ保存場所</div>
          <button
            className={styles.dataDirBtn}
            onClick={() => invoke("open_path", { path: dataDir })}
            title="Finderで開く"
          >
            <span className={styles.dataDirPath}>{dataDir}</span>
            <span className={styles.dataDirIcon}>↗</span>
          </button>
          <div className={styles.fieldHint}>クリックするとFinderで開きます</div>
        </div>
      )}
    </>
  );
}

/* ─── Cloud pane ─── */

function CloudPane({
  currentMode,
  onStorageModeChange,
}: {
  currentMode: StorageMode;
  onStorageModeChange: (mode: StorageMode) => void;
}) {
  const { session, signOut } = useAuth();
  const setSupabaseReady = useUIStore((s) => s.setSupabaseReady);
  const addToast = useUIStore((s) => s.addToast);
  const [authTab, setAuthTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const envUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  // Ensure Supabase client is active when this pane is shown
  useEffect(() => {
    if (envUrl && envKey) {
      reinitSupabase(envUrl, envKey);
      setSupabaseReady(true);
    }
  }, [setSupabaseReady, envUrl, envKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabase();
      if (authTab === "signup") {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
      await setConfig({ storageMode: "supabase" });
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    await setConfig({ storageMode: "local" });
    window.location.reload();
  };

  if (session) {
    const userEmail = session.user.email ?? "";
    return (
      <>
        <div className={styles.userProfile}>
          <div className={styles.avatar}>{userEmail.charAt(0).toUpperCase()}</div>
          <div className={styles.userInfo}>
            <div className={styles.userEmail}>{userEmail}</div>
          </div>
        </div>
        {currentMode !== "supabase" && (
          <button
            className={styles.useModeBtn}
            onClick={async () => {
              await setConfig({ storageMode: "supabase" });
              window.location.reload();
            }}
          >
            クラウドを使う
          </button>
        )}
        <button className={styles.logoutBtn} onClick={handleSignOut}>
          ログアウト
        </button>
      </>
    );
  }

  return (
    <>
      <p className={styles.storageDesc}>
        Floteのクラウドに保存します。複数デバイスで同期できます。
      </p>
      <form className={styles.authForm} onSubmit={handleSubmit}>
        <div className={styles.authTabs}>
          <button
            type="button"
            className={`${styles.authTab} ${authTab === "login" ? styles.authTabActive : ""}`}
            onClick={() => { setAuthTab("login"); setError(null); }}
          >
            ログイン
          </button>
          <button
            type="button"
            className={`${styles.authTab} ${authTab === "signup" ? styles.authTabActive : ""}`}
            onClick={() => { setAuthTab("signup"); setError(null); }}
          >
            サインアップ
          </button>
        </div>
        {authTab === "signup" ? (
          <div className={styles.signupClosed}>
            現在、新規アカウントの受付を停止しています。
          </div>
        ) : (
          <>
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
            <button type="submit" disabled={loading} className={styles.authSubmit}>
              {loading ? "処理中..." : "ログイン"}
            </button>
          </>
        )}
      </form>
    </>
  );
}

/* ─── Selfhost pane ─── */

function SelfhostPane({
  currentMode,
  onStorageModeChange,
}: {
  currentMode: StorageMode;
  onStorageModeChange: (mode: StorageMode) => void;
}) {
  const { session, signOut } = useAuth();
  const setSupabaseReady = useUIStore((s) => s.setSupabaseReady);
  const addToast = useUIStore((s) => s.addToast);
  const [customUrl, setCustomUrl] = useState("");
  const [customKey, setCustomKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSchema, setShowSchema] = useState(false);

  useEffect(() => {
    getConfig().then((c) => {
      setCustomUrl(c.customSupabaseUrl);
      setCustomKey(c.customSupabaseAnonKey);
      if (c.customSupabaseUrl && c.customSupabaseAnonKey) {
        reinitSupabase(c.customSupabaseUrl, c.customSupabaseAnonKey);
        setSupabaseReady(true);
      }
    });
  }, [setSupabaseReady]);

  const handleSave = async () => {
    const url = customUrl.trim();
    const key = customKey.trim();
    if (!url || !key) {
      addToast("error", "URLとAnon Keyを両方入力してください");
      return;
    }
    setSaving(true);
    await setConfig({ customSupabaseUrl: url, customSupabaseAnonKey: key, storageMode: "selfhost" });
    window.location.reload();
  };

  const handleClear = async () => {
    await setConfig({ customSupabaseUrl: "", customSupabaseAnonKey: "", storageMode: "local" });
    window.location.reload();
  };

  const handleSignOut = async () => {
    await signOut();
    await setConfig({ storageMode: "local" });
    window.location.reload();
  };

  const handleCopySQL = async () => {
    await navigator.clipboard.writeText(SCHEMA_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <p className={styles.storageDesc}>
        あなたが管理するSupabaseに保存します。デスクトップ版とモバイル版で同期できます。
      </p>

      {/* Connection config */}
      <div className={styles.subSectionTitle}>接続設定</div>
      <div className={styles.field}>
        <div className={styles.fieldLabel}>Supabase URL</div>
        <input
          className={styles.authInput}
          type="url"
          placeholder="https://xxxx.supabase.co"
          value={customUrl}
          onChange={(e) => setCustomUrl(e.target.value)}
        />
        <div className={styles.fieldLabel} style={{ marginTop: 8 }}>Publishable (Anon) Key</div>
        <input
          className={styles.authInput}
          type="password"
          placeholder="eyJ..."
          value={customKey}
          onChange={(e) => setCustomKey(e.target.value)}
        />
        <div className={styles.fieldHint}>
          Supabase ダッシュボードの「プロジェクト設定 → API」から取得できます。
        </div>
        <div className={styles.supabaseActions}>
          <button className={styles.authSubmit} onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存して接続"}
          </button>
          {customUrl && (
            <button
              className={styles.shortcutChangeBtn}
              style={{ color: "var(--danger, #e53e3e)" }}
              onClick={handleClear}
            >
              削除
            </button>
          )}
        </div>
      </div>

      {/* Auth state */}
      {customUrl && (
        <>
          <div className={styles.subSectionTitle}>アカウント</div>
          {session ? (
            <>
              <div className={styles.userProfile}>
                <div className={styles.avatar}>
                  {(session.user.email ?? "?").charAt(0).toUpperCase()}
                </div>
                <div className={styles.userInfo}>
                  <div className={styles.userEmail}>{session.user.email}</div>
                </div>
              </div>
              {currentMode !== "selfhost" && (
                <button
                  className={styles.useModeBtn}
                  onClick={async () => {
                    await setConfig({ storageMode: "selfhost" });
                    window.location.reload();
                  }}
                >
                  セルフホストを使う
                </button>
              )}
              <button className={styles.logoutBtn} onClick={handleSignOut}>
                ログアウト
              </button>
            </>
          ) : (
            <p className={styles.storageDesc}>
              接続設定を保存するとログイン画面が表示されます。
            </p>
          )}
        </>
      )}

      {/* Schema setup */}
      <div className={styles.subSectionTitle}>
        スキーマセットアップ
        <button
          className={styles.schemaToggleBtn}
          onClick={() => setShowSchema((v) => !v)}
        >
          {showSchema ? "閉じる" : "SQLを表示"}
        </button>
      </div>
      {showSchema && (
        <>
          <p className={styles.storageDesc}>
            初回接続時はSupabaseの「SQL エディタ」で以下を実行してください。
          </p>
          <div className={styles.sqlBox}>
            <pre className={styles.sqlPre}>{SCHEMA_SQL}</pre>
          </div>
          <button className={styles.shortcutChangeBtn} onClick={handleCopySQL}>
            {copied ? "✓ コピーしました" : "SQLをコピー"}
          </button>
        </>
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
