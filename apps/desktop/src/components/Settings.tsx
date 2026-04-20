import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  enable as enableAutostart,
  disable as disableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";
import type { StorageMode } from "@flote/types";
import { useUIStore, type ThemeMode } from "../store/uiStore";
import { getConfig, setConfig, type AppSettings } from "../config";
import { useAuth } from "../hooks/useAuth";
import styles from "./Settings.module.css";

type SettingsTab = "general" | "shortcuts" | "account" | "storage";

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
              ["account", "アカウント"],
              ["storage", "保存先"],
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
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── General ─── */

function GeneralTab() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const addToast = useUIStore((s) => s.addToast);
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [hideOnBlur, setHideOnBlur] = useState(false);
  const [launchAtLogin, setLaunchAtLogin] = useState(false);

  useEffect(() => {
    getConfig().then((c) => {
      setAlwaysOnTop(c.alwaysOnTop);
      setHideOnBlur(c.hideOnBlur);
      setLaunchAtLogin(c.launchAtLogin);
    });
  }, []);

  const handleTheme = (t: ThemeMode) => {
    setTheme(t);
    setConfig({ theme: t });
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
      // Auto-switch to supabase
      if (currentMode === "local") {
        onStorageModeChange("supabase");
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
          Supabaseが設定されていません。
          <code>apps/desktop/.env.local</code> に接続情報を追加してください。
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
}: {
  currentMode: StorageMode;
  onStorageModeChange: (mode: StorageMode) => void;
}) {
  const { session } = useAuth();
  const addToast = useUIStore((s) => s.addToast);
  const isLoggedIn = !!session;

  const handleChange = (mode: StorageMode) => {
    if (mode === "supabase" && !isLoggedIn) return;
    onStorageModeChange(mode);
    addToast("info", "設定を反映するにはアプリを再起動してください");
  };

  return (
    <>
      <h3 className={styles.sectionTitle}>保存先</h3>

      <div className={styles.field}>
        <div className={styles.toggleGroup}>
          <button
            className={`${styles.toggleBtn} ${currentMode === "local" ? styles.toggleBtnActive : ""}`}
            onClick={() => handleChange("local")}
          >
            ローカル
          </button>
          <button
            className={`${styles.toggleBtn} ${currentMode === "supabase" ? styles.toggleBtnActive : ""} ${!isLoggedIn ? styles.toggleBtnDisabled : ""}`}
            onClick={() => handleChange("supabase")}
            disabled={!isLoggedIn}
          >
            クラウド (Supabase)
            {!isLoggedIn && <span className={styles.badge}>要ログイン</span>}
          </button>
        </div>
      </div>

      <div className={styles.storageInfo}>
        {currentMode === "local"
          ? "ノートとタスクはこのデバイスにローカル保存されます。"
          : "ノートとタスクはSupabaseクラウドに保存されます。"}
      </div>

      <div className={styles.storageInfo}>
        ローカルデータは保持されます。保存先を切り替えてもデータは削除されません。
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
