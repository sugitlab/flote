import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";
import { getVersion } from "@tauri-apps/api/app";
import { useT } from "../hooks/useT";
import {
  enable as enableAutostart,
  disable as disableAutostart,
} from "@tauri-apps/plugin-autostart";
import type { StorageMode } from "@flote/types";
import { useUIStore, type ThemeMode } from "../store/uiStore";
import { DARK_CODE_THEME_OPTIONS, LIGHT_CODE_THEME_OPTIONS } from "@flote/types";
import type { DarkEditorTheme, LightEditorTheme } from "../store/uiStore";
import { getConfig, setConfig } from "../config";
import type { Language } from "../locales";
import { reinitSupabase, getSupabase, exportToMarkdown } from "@flote/api-client";
import { useNoteStore } from "../store/noteStore";
import { useTaskStore } from "../store/taskStore";
import { SCHEMA_SQL } from "../migrations";
import { useAuth } from "../hooks/useAuth";
import FloteLogo from "./FloteLogo";
import styles from "./Settings.module.css";

type SettingsTab = "general" | "shortcuts" | "howto" | "storage" | "about";

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
  const t = useT();
  const [tab, setTab] = useState<SettingsTab>("general");

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.nav}>
          <div className={styles.navHeader}>{t.settings.title}</div>
          {(
            [
              ["general", t.settings.nav.general],
              ["shortcuts", t.settings.nav.shortcuts],
              ["howto", t.settings.nav.howto],
              ["storage", t.settings.nav.storage],
              ["about", t.settings.nav.about],
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
            {t.settings.closeBtn}
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
          {tab === "about" && <AboutTab />}
        </div>
      </div>
    </div>
  );
}

/* ─── General ─── */

function GeneralTab() {
  const t = useT();
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
  const vimMode = useUIStore((s) => s.vimMode);
  const setVimMode = useUIStore((s) => s.setVimMode);
  const language = useUIStore((s) => s.language);
  const setLanguage = useUIStore((s) => s.setLanguage);
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [hideOnBlur, setHideOnBlur] = useState(false);
  const [launchAtLogin, setLaunchAtLogin] = useState(false);
  const [hideDockIcon, setHideDockIcon] = useState(false);
  const isMacos = navigator.userAgent.includes("Mac");

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

  const handleVimMode = (v: boolean) => {
    setVimMode(v);
    setConfig({ vimMode: v });
  };

  const handleLanguage = (lang: Language) => {
    setLanguage(lang);
    setConfig({ language: lang });
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
      <h3 className={styles.sectionTitle}>{t.settings.general.title}</h3>

      <div className={styles.field}>
        <div className={styles.fieldLabel}>{t.settings.general.theme}</div>
        <div className={styles.toggleGroup}>
          {(["dark", "light", "system"] as const).map((th) => (
            <button
              key={th}
              className={`${styles.toggleBtn} ${theme === th ? styles.toggleBtnActive : ""}`}
              onClick={() => handleTheme(th)}
            >
              {th === "dark" ? "Dark" : th === "light" ? "Light" : "System"}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <div className={styles.switchRow}>
          <span className={styles.switchLabel}>{t.settings.general.alwaysOnTop}</span>
          <Toggle checked={alwaysOnTop} onChange={handleAlwaysOnTop} />
        </div>
      </div>

      <div className={styles.field}>
        <div className={styles.switchRow}>
          <span className={styles.switchLabel}>{t.settings.general.hideOnBlur}</span>
          <Toggle checked={hideOnBlur} onChange={handleHideOnBlur} />
        </div>
      </div>

      <div className={styles.field}>
        <div className={styles.switchRow}>
          <span className={styles.switchLabel}>{t.settings.general.launchAtLogin}</span>
          <Toggle checked={launchAtLogin} onChange={handleLaunchAtLogin} />
        </div>
      </div>

      {isMacos && (
        <div className={styles.field}>
          <div className={styles.switchRow}>
            <span className={styles.switchLabel}>{t.settings.general.hideDockIcon}</span>
            <Toggle checked={hideDockIcon} onChange={handleHideDockIcon} />
          </div>
        </div>
      )}

      <h3 className={styles.sectionTitle}>{t.settings.general.editor}</h3>

      <div className={styles.field}>
        <div className={styles.fieldLabel}>{t.settings.general.syntaxDark}</div>
        <div className={styles.editorThemeGrid}>
          {DARK_CODE_THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`${styles.editorThemeBtn} ${editorThemeDark === opt.value ? styles.editorThemeBtnActive : ""}`}
              onClick={() => handleEditorThemeDark(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <div className={styles.fieldLabel}>{t.settings.general.syntaxLight}</div>
        <div className={styles.editorThemeGrid}>
          {LIGHT_CODE_THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`${styles.editorThemeBtn} ${editorThemeLight === opt.value ? styles.editorThemeBtnActive : ""}`}
              onClick={() => handleEditorThemeLight(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <div className={styles.switchRow}>
          <span className={styles.switchLabel}>{t.settings.general.vimMode}</span>
          <Toggle checked={vimMode} onChange={handleVimMode} />
        </div>
      </div>

      <div className={styles.field}>
        <div className={styles.switchRow}>
          <span className={styles.switchLabel}>{t.settings.general.language}</span>
          <select
            className={styles.select}
            value={language}
            onChange={(e) => handleLanguage(e.target.value as Language)}
          >
            <option value="ja">日本語</option>
            <option value="en">English (US)</option>
          </select>
        </div>
      </div>

      <h3 className={styles.sectionTitle}>{t.settings.general.search}</h3>

      <div className={styles.field}>
        <div className={styles.switchRow}>
          <span className={styles.switchLabel}>{t.settings.general.searchFullText}</span>
          <Toggle checked={searchFullText} onChange={handleSearchFullText} />
        </div>
        <div className={styles.fieldHint}>{t.settings.general.searchFullTextHint}</div>
      </div>

      <div className={styles.field}>
        <div className={styles.switchRow}>
          <span className={styles.switchLabel}>{t.settings.general.hideCompleted}</span>
          <Toggle checked={hideCompletedInSearch} onChange={handleHideCompletedInSearch} />
        </div>
      </div>
    </>
  );
}

/* ─── Shortcuts ─── */

function ShortcutsTab() {
  const t = useT();
  const [globalShortcut, setGlobalShortcut] = useState("CmdOrCtrl+Shift+N");
  const [captureShortcut, setCaptureShortcut] = useState("CmdOrCtrl+Shift+Space");
  const [recording, setRecording] = useState<"main" | "capture" | null>(null);
  const addToast = useUIStore((s) => s.addToast);

  useEffect(() => {
    getConfig().then((c) => {
      setGlobalShortcut(c.globalShortcut);
      setCaptureShortcut(c.captureShortcut);
    });
  }, []);

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
      setRecording(null);

      if (recording === "main") {
        setGlobalShortcut(shortcut);
        invoke("update_global_shortcut", { shortcut })
          .then(() => {
            setConfig({ globalShortcut: shortcut });
            addToast("success", t.toasts.shortcutChanged(shortcut));
          })
          .catch(() => addToast("error", t.toasts.shortcutFailed));
      } else {
        setCaptureShortcut(shortcut);
        invoke("update_capture_shortcut", { shortcut })
          .then(() => {
            setConfig({ captureShortcut: shortcut });
            addToast("success", t.toasts.captureShortcutChanged(shortcut));
          })
          .catch(() => addToast("error", t.toasts.shortcutFailed));
      }
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [recording, addToast]);

  return (
    <>
      <h3 className={styles.sectionTitle}>{t.settings.shortcuts.title}</h3>

      <div className={styles.field}>
        <div className={styles.fieldLabel}>{t.settings.shortcuts.globalShortcut}</div>
        {recording === "main" ? (
          <div className={styles.recording}>{t.settings.shortcuts.recording}</div>
        ) : (
          <div className={styles.shortcutRow}>
            <span className={styles.shortcutLabel}>{t.settings.shortcuts.openClose}</span>
            <div className={styles.shortcutRight}>
              <span className={styles.shortcutKeys}>{globalShortcut}</span>
              <button className={styles.shortcutChangeBtn} onClick={() => setRecording("main")}>
                {t.settings.shortcuts.change}
              </button>
            </div>
          </div>
        )}
        {recording === "capture" ? (
          <div className={styles.recording}>{t.settings.shortcuts.recording}</div>
        ) : (
          <div className={styles.shortcutRow}>
            <span className={styles.shortcutLabel}>{t.settings.shortcuts.quickCapture}</span>
            <div className={styles.shortcutRight}>
              <span className={styles.shortcutKeys}>{captureShortcut}</span>
              <button className={styles.shortcutChangeBtn} onClick={() => setRecording("capture")}>
                {t.settings.shortcuts.change}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={styles.field}>
        <div className={styles.fieldLabel}>{t.settings.shortcuts.appShortcuts}</div>
        {t.settings.shortcuts.names.map(([label, keys]) => (
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
  const t = useT();
  const [pane, setPane] = useState<StorageMode>(currentMode);
  const cloudAvailable = !!(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  );

  const storageTabs = [
    { mode: "local" as StorageMode, label: t.settings.storage.local },
    { mode: "supabase" as StorageMode, label: t.settings.storage.cloud },
    { mode: "selfhost" as StorageMode, label: t.settings.storage.selfhost },
  ];

  return (
    <>
      <h3 className={styles.sectionTitle}>{t.settings.storage.title}</h3>

      <div className={styles.storageModeTabs}>
        {storageTabs.map(({ mode, label }) => (
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

      <NoteImportSection />

      <div className={styles.storageFootnote}>{t.settings.storage.footnote}</div>
    </>
  );
}

/* ─── Note import ─── */

function extractTitleFromBody(body: string, filename: string): string {
  const heading = body.match(/^#{1,6}\s+(.+)$/m);
  if (heading) return heading[1].trim();
  const firstLine = body.split("\n").find((l) => l.trim());
  if (firstLine) return firstLine.trim().slice(0, 80);
  return filename.replace(/\.md$/i, "");
}

function parseMarkdownNote(text: string, filename: string): { title: string; body_md: string } {
  if (text.startsWith("---")) {
    const end = text.indexOf("\n---", 3);
    if (end !== -1) {
      const frontmatter = text.slice(3, end);
      const afterFrontmatter = text.slice(end + 4).replace(/^\n/, "");
      const titleMatch = frontmatter.match(/^title:\s*(.+)$/m);
      const title = titleMatch
        ? titleMatch[1].replace(/^["']|["']$/g, "").trim()
        : extractTitleFromBody(afterFrontmatter, filename);
      return { title, body_md: afterFrontmatter };
    }
  }
  return { title: extractTitleFromBody(text, filename), body_md: text };
}

function NoteImportSection() {
  const t = useT();
  const saveNote = useNoteStore((s) => s.saveNote);
  const addToast = useUIStore((s) => s.addToast);
  const { session } = useAuth();
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList) => {
    setImporting(true);
    let count = 0;
    try {
      const userId = session?.user.id ?? "";
      for (const file of Array.from(files)) {
        const text = await file.text();
        const { title, body_md } = parseMarkdownNote(text, file.name);
        await saveNote(
          { id: crypto.randomUUID(), title, body_md, updated_at: new Date().toISOString() },
          userId
        );
        count++;
      }
      addToast("success", t.settings.storage.importNoteDone(count));
    } catch {
      addToast("error", t.settings.storage.importNoteError);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <h3 className={styles.sectionTitle}>{t.settings.storage.importNote}</h3>
      <div className={styles.field}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md"
          multiple
          style={{ display: "none" }}
          onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); }}
        />
        <button
          className={styles.useModeBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
        >
          {importing ? t.settings.storage.importingNote : t.settings.storage.importNote}
        </button>
        <div className={styles.fieldHint}>{t.settings.storage.importNoteHint}</div>
      </div>
    </>
  );
}

/* ─── Local pane ─── */

function LocalPane({
  currentMode,
  onStorageModeChange: _onStorageModeChange,
}: {
  currentMode: StorageMode;
  onStorageModeChange: (mode: StorageMode) => void;
}) {
  const t = useT();
  const notes = useNoteStore((s) => s.notes);
  const tasks = useTaskStore((s) => s.tasks);
  const addToast = useUIStore((s) => s.addToast);
  const [dataDir, setDataDir] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    appDataDir().then(setDataDir).catch(() => {});
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const exportDir = await exportToMarkdown(notes, tasks);
      addToast("success", t.settings.storage.exportDone);
      invoke("open_path", { path: exportDir }).catch(() => {});
    } catch {
      addToast("error", t.settings.storage.exportError);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <p className={styles.storageDesc}>{t.settings.storage.localDesc}</p>

      {currentMode !== "local" && (
        <button
          className={styles.useModeBtn}
          onClick={async () => {
            await setConfig({ storageMode: "local" });
            window.location.reload();
          }}
        >
          {t.settings.storage.useLocal}
        </button>
      )}

      {dataDir && (
        <div className={styles.field}>
          <div className={styles.fieldLabel}>{t.settings.storage.dataLocation}</div>
          <button
            className={styles.dataDirBtn}
            onClick={() => invoke("open_path", { path: dataDir })}
            title={t.settings.storage.finderHint}
          >
            <span className={styles.dataDirPath}>{dataDir}</span>
            <span className={styles.dataDirIcon}>↗</span>
          </button>
          <div className={styles.fieldHint}>{t.settings.storage.finderHint}</div>
        </div>
      )}

      <div className={styles.field}>
        <button
          className={styles.useModeBtn}
          onClick={handleExport}
          disabled={exporting}
          style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
        >
          {exporting ? t.settings.storage.exporting : t.settings.storage.exportData}
        </button>
        <div className={styles.fieldHint}>{t.settings.storage.exportHint}</div>
      </div>
    </>
  );
}

/* ─── Cloud pane ─── */

function CloudPane({
  currentMode,
  onStorageModeChange: _onStorageModeChange,
}: {
  currentMode: StorageMode;
  onStorageModeChange: (mode: StorageMode) => void;
}) {
  const t = useT();
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
      setError(err instanceof Error ? err.message : t.auth.error);
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
            {t.settings.storage.useCloud}
          </button>
        )}
        <button className={styles.logoutBtn} onClick={handleSignOut}>
          {t.settings.storage.logout}
        </button>
      </>
    );
  }

  return (
    <>
      <p className={styles.storageDesc}>{t.settings.storage.cloudDesc}</p>
      <form className={styles.authForm} onSubmit={handleSubmit}>
        <div className={styles.authTabs}>
          <button
            type="button"
            className={`${styles.authTab} ${authTab === "login" ? styles.authTabActive : ""}`}
            onClick={() => { setAuthTab("login"); setError(null); }}
          >
            {t.settings.storage.loginTab}
          </button>
          <button
            type="button"
            className={`${styles.authTab} ${authTab === "signup" ? styles.authTabActive : ""}`}
            onClick={() => { setAuthTab("signup"); setError(null); }}
          >
            {t.settings.storage.signupTab}
          </button>
        </div>
        {authTab === "signup" ? (
          <div className={styles.signupClosed}>{t.settings.storage.signupClosed}</div>
        ) : (
          <>
            {error && <div className={styles.authError}>{error}</div>}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.auth.emailPlaceholder}
              required
              className={styles.authInput}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.auth.passwordPlaceholder}
              required
              minLength={6}
              className={styles.authInput}
            />
            <button type="submit" disabled={loading} className={styles.authSubmit}>
              {loading ? t.auth.processing : t.settings.storage.loginTab}
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
  onStorageModeChange: _onStorageModeChange,
}: {
  currentMode: StorageMode;
  onStorageModeChange: (mode: StorageMode) => void;
}) {
  const t = useT();
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
      addToast("error", t.settings.storage.anonKeyHint);
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
      <p className={styles.storageDesc}>{t.settings.storage.selfhostDesc}</p>

      {/* Connection config */}
      <div className={styles.subSectionTitle}>{t.settings.storage.connectionSettings}</div>
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
        <div className={styles.fieldHint}>{t.settings.storage.anonKeyHint}</div>
        <div className={styles.supabaseActions}>
          <button className={styles.authSubmit} onClick={handleSave} disabled={saving}>
            {saving ? t.settings.storage.saving : t.settings.storage.saveConnect}
          </button>
          {customUrl && (
            <button
              className={styles.shortcutChangeBtn}
              style={{ color: "var(--danger, #e53e3e)" }}
              onClick={handleClear}
            >
              {t.settings.storage.deleteConnection}
            </button>
          )}
        </div>
      </div>

      {/* Auth state */}
      {customUrl && (
        <>
          <div className={styles.subSectionTitle}>{t.settings.storage.account}</div>
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
                  {t.settings.storage.useSelfhost}
                </button>
              )}
              <button className={styles.logoutBtn} onClick={handleSignOut}>
                {t.settings.storage.logout}
              </button>
            </>
          ) : (
            <p className={styles.storageDesc}>{t.settings.storage.loginPending}</p>
          )}
        </>
      )}

      {/* Schema setup */}
      <div className={styles.subSectionTitle}>
        {t.settings.storage.schemaSetup}
        <button
          className={styles.schemaToggleBtn}
          onClick={() => setShowSchema((v) => !v)}
        >
          {showSchema ? t.settings.storage.hideSQL : t.settings.storage.showSQL}
        </button>
      </div>
      {showSchema && (
        <>
          <p className={styles.storageDesc}>{t.settings.storage.schemaDesc}</p>
          <div className={styles.sqlBox}>
            <pre className={styles.sqlPre}>{SCHEMA_SQL}</pre>
          </div>
          <button className={styles.shortcutChangeBtn} onClick={handleCopySQL}>
            {copied ? t.settings.storage.copiedSQL : t.settings.storage.copySQL}
          </button>
        </>
      )}
    </>
  );
}

/* ─── How To ─── */

function HowToTab() {
  const t = useT();
  return (
    <>
      <h3 className={styles.sectionTitle}>{t.settings.howto.title}</h3>
      {t.settings.howto.sections.map((section) => (
        <div key={section.title} className={styles.helpSection}>
          <div className={styles.helpSectionTitle}>{section.title}</div>
          {section.items.map((item) => (
            <div key={item.label} className={styles.helpItem}>
              <span className={styles.helpLabel}>{item.label}</span>
              <span className={styles.helpDesc}>{item.desc}</span>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

/* ─── About ─── */

function AboutTab() {
  const t = useT();
  const [version, setVersion] = useState("");

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
  }, []);

  const oss = [
    { name: "Tauri", license: "MIT / Apache-2.0" },
    { name: "React", license: "MIT" },
    { name: "CodeMirror", license: "MIT" },
    { name: "Zustand", license: "MIT" },
    { name: "Tailwind CSS", license: "MIT" },
    { name: "Supabase JS", license: "MIT" },
  ];

  return (
    <>
      <h3 className={styles.sectionTitle}>{t.settings.about.title}</h3>

      <div className={styles.aboutCard}>
        <FloteLogo size={64} className={styles.aboutIcon} />
        <div className={styles.aboutAppName}>Flote</div>
        {version && (
          <div className={styles.aboutVersion}>{t.settings.about.versionLabel(version)}</div>
        )}
        <div className={styles.aboutDesc}>{t.settings.about.appDesc}</div>
      </div>

      <h3 className={styles.sectionTitle}>{t.settings.about.licenseTitle}</h3>
      <div className={styles.helpSection}>
        <div className={styles.helpItem}>
          <span className={styles.helpLabel}>Flote</span>
          <span className={styles.helpDesc}>{t.settings.about.licenseValue}</span>
        </div>
      </div>

      <h3 className={styles.sectionTitle}>{t.settings.about.ossTitle}</h3>
      <div className={styles.helpSection}>
        {oss.map(({ name, license }) => (
          <div key={name} className={styles.helpItem}>
            <span className={styles.helpLabel}>{name}</span>
            <span className={styles.helpDesc}>{license}</span>
          </div>
        ))}
      </div>

      <h3 className={styles.sectionTitle}>{t.settings.about.legalTitle}</h3>
      <div className={styles.helpSection}>
        <div className={styles.helpItem}>
          <button
            className={styles.legalLink}
            onClick={() => window.open("https://github.com/sugitlab/flote?tab=MIT-1-ov-file#readme", "_blank")}
          >
            {t.settings.about.licenseLink}
          </button>
        </div>
        <div className={styles.helpItem}>
          <button
            className={styles.legalLink}
            onClick={() => window.open("https://github.com/sugitlab/flote", "_blank")}
          >
            {t.settings.about.sourceCode}
          </button>
        </div>
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
