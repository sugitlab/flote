# Flote

ショートカット起動のフローティングノート＆タスク管理アプリ。
Raycast Notesライクな体験をmacOS/Windows/iOS/Androidで提供する。

## アーキテクチャ

- **Desktop**: Tauri v2 + React 18 + TypeScript（apps/desktop）
- **Mobile**: Expo SDK 51 + React Native + expo-router（apps/mobile）
- **Backend**: Supabase（PostgreSQL + Realtime + Edge Functions）
- **共有コード**: packages/types, packages/api-client（pnpm workspace）
- **モノレポ管理**: pnpm workspaces + Turborepo

## ディレクトリ
apps/desktop/src/          # Reactフロントエンド（Tauri webview内）
apps/desktop/src-tauri/    # Rustバックエンド（基本触らない。プラグイン設定のみ）
apps/mobile/app/           # expo-routerのページ
apps/mobile/components/    # モバイル専用コンポーネント
packages/types/src/        # Note, Task等の共有型
packages/api-client/src/   # Supabase操作ロジック（両アプリから使う）

## 主要コマンド

```bash
# 開発
pnpm dev:desktop       # Tauri dev server起動
pnpm dev:mobile        # Expo dev server起動

# ビルド
pnpm build:desktop     # Tauri production build
pnpm build:mobile:ios  # Expo iOS build (EAS)
pnpm build:mobile:android

# 型チェック・Lint
pnpm typecheck         # 全パッケージ一括
pnpm lint
```

## データモデル（Supabase PostgreSQL）

```sql
notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users,
  title text,
  body_md text,
  updated_at timestamptz DEFAULT now()
)

tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users,
  title text NOT NULL,
  due_date date,
  remind_at timestamptz,
  done boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
)
```

## エージェントの行動ルール

- **GitHub Actions のトリガーは要確認**: `git tag` のプッシュや workflow_dispatch など、Actions を起動する操作は必ずユーザーの許可を得てから実行すること。コスト問題に直結するため。コードの変更・コミット・通常の `git push` は確認不要。

## 重要な制約・方針

- **Rustコードは最小限**。Tauri commandsはプラグインで解決できない場合のみ書く
- **スタイリング**: desktop側はTailwind CSS、mobile側はStyleSheet API（NativeWindは使わない）
- **状態管理**: Zustand（軽量・シンプル）。ReduxやJotaiは使わない
- **型共有**: packages/typesで定義した型をdesktop/mobileの両方でimportする
- **オフライン対応**: updated_atベースのlast-write-wins。楽観的更新で実装
- **認証**: Supabase Auth（メール+パスワード）。OAuthは後回し

## Tauri固有の注意点

- ウィンドウ設定は `apps/desktop/src-tauri/tauri.conf.json` で管理
- グローバルショートカット: `tauri-plugin-global-shortcut`
- メニューバー: `tauri-plugin-tray`
- Tauri commandsの呼び出しは `@tauri-apps/api/core` の `invoke()` を使う
- `src-tauri/` 配下を変更した場合は必ずRustのビルドが必要（時間かかる）

## Expo固有の注意点

- ルーティングは `expo-router` (App Router方式、app/ディレクトリ)
- Push通知は `expo-notifications` + Supabase Edge Functions cron
- ネイティブモジュールを追加した場合は `npx expo prebuild` が必要
- EASでビルド（`eas build`）

## よくある作業パターン

### 新しい機能をdesktop+mobileに追加する場合
1. `packages/types` に型を追加
2. `packages/api-client` にSupabase操作を追加
3. desktop側のReactコンポーネントを実装
4. mobile側のReact Nativeコンポーネントを実装

### Tauri commandを追加する場合
1. `src-tauri/src/main.rs` にcommand関数を追加
2. `tauri.conf.json` の capabilities に権限を追加
3. desktop側から `invoke('command_name')` で呼ぶ