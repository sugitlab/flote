# Windows 11 対応 調査レポート

## 結論

**基本機能は既にクロスプラットフォーム対応済み。修正箇所は限定的（推定 8〜16h）。**

Tauri v2・React のフロントエンド・プラグインはどれも Windows 対応しており、macOS 専用 API の条件化と CI 追加がメインの作業になる。

---

## 対応が必要な箇所（必須）

### 1. `Cargo.toml` — `macos-private-api` フィーチャー

```toml
# 現状（Windows でコンパイルエラーになる可能性）
tauri = { version = "2", features = ["macos-private-api", "tray-icon"] }

# 修正後
tauri = { version = "2", features = ["tray-icon"] }

[target.'cfg(target_os = "macos")'.dependencies]
tauri-macos = { package = "tauri", version = "2", features = ["macos-private-api"] }
```

または `build.rs` で条件付き feature フラグを使う方式でも可。  
**作業量: 小**

---

### 2. `src-tauri/src/lib.rs:366` — Autostart launcher

```rust
// 現状（macOS 専用）
.plugin(tauri_plugin_autostart::init(
    tauri_plugin_autostart::MacosLauncher::LaunchAgent,
    None,
))

// 修正後
.plugin(tauri_plugin_autostart::init(
    #[cfg(target_os = "macos")]
    tauri_plugin_autostart::MacosLauncher::LaunchAgent,
    #[cfg(not(target_os = "macos"))]
    tauri_plugin_autostart::WindowsLauncher::CurrentUserRun,
    None,
))
```

**作業量: 小**

---

### 3. `src-tauri/src/lib.rs` — トレイアイコンのテンプレート設定

```rust
// 現状（Windows では効果なし・エラーではないが明示的に条件化すべき）
.icon_as_template(true)

// 修正後
.icon_as_template(cfg!(target_os = "macos"))
```

**作業量: 小**

---

### 4. `src/components/Settings.tsx:225` — Dock アイコン非表示 UI

Windows に Dock は存在しないため、このトグルを macOS 限定にする。

```tsx
// 現状（全プラットフォームで表示）
<span className={styles.switchLabel}>{t.settings.general.hideDockIcon}</span>
<Toggle checked={hideDockIcon} onChange={handleHideDockIcon} />

// 修正後（Tauri の OS 判定 API を使う）
import { platform } from "@tauri-apps/plugin-os";
// ...
{isMacos && (
  <>
    <span className={styles.switchLabel}>{t.settings.general.hideDockIcon}</span>
    <Toggle checked={hideDockIcon} onChange={handleHideDockIcon} />
  </>
)}
```

**作業量: 小**

---

### 5. `src/App.tsx:962` — `set_dock_visible` の呼び出し

```tsx
// 現状（Windows では何もしないが明示的に条件化すべき）
invoke("set_dock_visible", { visible: !config.hideDockIcon });

// 修正後
if (os === "macos") {
  invoke("set_dock_visible", { visible: !config.hideDockIcon });
}
```

**作業量: 小**

---

### 6. `.github/workflows/release.yml` — Windows ビルド job の追加

現在は macOS + Android のみ。以下の job を追加する。

```yaml
release-windows:
  runs-on: windows-latest
  permissions:
    contents: write

  steps:
    - uses: actions/checkout@v4

    - name: Setup pnpm
      uses: pnpm/action-setup@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: pnpm

    - name: Setup Rust
      uses: dtolnay/rust-toolchain@stable
      with:
        targets: x86_64-pc-windows-msvc

    - name: Cache Rust
      uses: swatinem/rust-cache@v2
      with:
        workspaces: apps/desktop/src-tauri

    - name: Install dependencies
      run: pnpm install --frozen-lockfile

    - name: Build Windows (x64)
      uses: tauri-apps/tauri-action@v0
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
        VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      with:
        projectPath: apps/desktop
        tauriScript: pnpm tauri
        args: --target x86_64-pc-windows-msvc
        tagName: ${{ github.ref_name }}
        releaseName: "Flote ${{ github.ref_name }}"
        releaseBody: |
          ### Windows
          1. `flote_*_x64_en-US.msi` をダウンロード
          2. インストーラーを実行
```

**作業量: 中**（CI の確認ランが必要）

---

## 対応不要（既に動く）

| 項目 | 理由 |
|------|------|
| グローバルショートカット | `CmdOrCtrl` で抽象化済み。Windows では Ctrl に自動マップ |
| トレイアイコン表示 | `tray.png` (16x16 RGBA) は Windows でも使用可能 |
| ウィンドウ操作・リサイズ | Tauri v2 標準 API、クロスプラットフォーム対応 |
| カスタムタイトルバー (`decorations: false`) | Windows でも動作する |
| ファイル操作 (`tauri-plugin-fs`) | クロスプラットフォーム対応済み |
| Supabase 通信 | プラットフォーム依存なし |
| SQLite ローカル DB | クロスプラットフォーム対応済み |
| Opener プラグイン（Finder で開く） | `lib.rs` に Windows (`explorer`) 対応が既にある |
| CSS フォント | `Segoe UI` が既にフォールバックに含まれている |
| アイコン (.ico) | `src-tauri/icons/icon.ico` が既に存在 |
| `tauri.conf.json` | `macOSPrivateApi: true` は Windows で安全に無視される |

---

## 注意点・リスク

### WebView2 ランタイム
Windows 11 には WebView2 がプリインストールされているが、Windows 10 では別途インストールが必要。MSI インストーラーに WebView2 ブートストラッパーを同梱するか、`tauri.conf.json` の `bundle.windows.webviewInstallMode` で設定する。

```json
"bundle": {
  "windows": {
    "webviewInstallMode": {
      "type": "embedBootstrapper"
    }
  }
}
```

### コード署名（本番リリース時）
署名なしの `.exe` / `.msi` は Windows Defender SmartScreen で警告が出る。本番リリース前に Microsoft Authenticode 証明書の取得が必要（EV 証明書推奨、年間 $300〜$500 程度）。

CI での署名設定（参考）:
```yaml
env:
  TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
```

### グローバルショートカットの権限
Windows では UAC によってグローバルショートカットが他のアプリに奪われる場合がある。動作確認が必要。

---

## 作業フェーズと見積もり

| フェーズ | 内容 | 見積もり |
|---------|------|---------|
| **Phase 1** | Rust・TypeScript のコード修正（上記 1〜5） | 2〜3h |
| **Phase 2** | ローカルで Windows ビルドテスト（VM または実機） | 2〜4h |
| **Phase 3** | GitHub Actions に Windows ビルド job 追加・CI 確認 | 2〜3h |
| **Phase 4** | Windows 実機での QA・バグ修正 | 4〜8h |
| **Phase 5** | コード署名設定（本番リリース用、任意） | 4〜8h |
| **合計** | | **10〜26h** |

コード署名なし・最小限の対応（Phase 1〜3）は **6〜10h** 程度。

---

## 推奨実行順序

```
1. Cargo.toml: macos-private-api を条件化               ← ビルドエラー防止
2. lib.rs: MacosLauncher → プラットフォーム条件化        ← ビルドエラー防止
3. lib.rs: icon_as_template を条件化                    ← 念のため
4. Settings.tsx: Dock UI を macOS 限定に                ← UX
5. App.tsx: set_dock_visible 呼び出しを条件化            ← 念のため
6. ローカルで Windows ビルド確認（GitHub Actions / VM）
7. release.yml に Windows job 追加
8. 本番リリース前にコード署名検討
```
