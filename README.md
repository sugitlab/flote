# Flote

ショートカット一発で呼び出せる、フローティングのノート＆タスク管理アプリ。

![Platform](https://img.shields.io/badge/platform-macOS-lightgrey)
![License](https://img.shields.io/badge/license-MIT-blue)

## 特徴

- **グローバルショートカット** — どのアプリにいても `Cmd+Shift+N` で即表示／非表示
- **クイックキャプチャ** — `Cmd+Shift+Space` でカーソル位置にメモウィンドウを表示
- **Markdown エディタ** — コードハイライト付きのリッチなノート編集
- **タスク管理** — 期日・タグ・完了状態をシンプルに管理
- **タグフィルター** — `#tag` 記法でノート・タスクを即絞り込み
- **テーマ対応** — ライト / ダーク / システム連動
- **保存先を選べる** — ローカル（オフライン可）/ Supabase クラウド / セルフホスト

## インストール（macOS）

[Releases ページ](https://github.com/sugitlab/flote/releases) から最新の `.dmg` をダウンロードしてください。

1. `.dmg` を開き、`flote.app` を `/Applications` フォルダへドラッグします。
2. **初回起動時に「開発元を確認できない」と表示された場合**、ターミナルで以下を実行してください（macOS Gatekeeper の quarantine 属性を除去します）。

   ```bash
   xattr -rd com.apple.quarantine /Applications/flote.app
   ```

3. その後、アプリを通常通りダブルクリックで起動できます。

> ターミナルを使いたくない場合は、`/Applications` の `flote.app` を右クリック →「開く」→「開く」で初回起動できることもあります（macOS のバージョンによって異なります）。

## スクリーンショット

> 準備中

## 必要環境

| ツール | バージョン |
|--------|-----------|
| Node.js | >= 18 |
| pnpm | >= 9 |
| Rust / Cargo | stable |

## セットアップ

```bash
git clone https://github.com/sugitlab/flote.git
cd flote
pnpm install
```

詳細は [docs/setup.md](docs/setup.md) を参照してください。

## 開発サーバー起動

```bash
pnpm dev:desktop   # Tauri デスクトップアプリ
pnpm dev:mobile    # Expo モバイルアプリ
```

## 主なコマンド

```bash
pnpm typecheck          # 全パッケージ型チェック
pnpm lint               # リント
pnpm build:desktop      # デスクトップ本番ビルド
```

## 技術スタック

- **Desktop** — [Tauri v2](https://tauri.app) + React 18 + TypeScript
- **Mobile** — Expo SDK + React Native + expo-router
- **DB / Auth** — [Supabase](https://supabase.com)（または自前 Supabase）
- **エディタ** — CodeMirror 6
- **状態管理** — Zustand

## ライセンス

[MIT](LICENSE) © 2026 sugitlab
