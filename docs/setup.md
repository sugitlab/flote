# Flote セットアップガイド

## 前提条件

- Node.js >= 18
- pnpm >= 9
- Rust（`rustup` でインストール）
- [Supabase CLI](https://supabase.com/docs/guides/cli)（ローカル開発する場合）

## 1. リポジトリのセットアップ

```bash
git clone <repo-url>
cd flote
pnpm install
```

## 2. Supabase プロジェクト作成

### クラウド（推奨）

1. [Supabase Dashboard](https://supabase.com/dashboard) にログイン
2. 「New Project」でプロジェクトを作成
3. **Settings → API** から以下を控える：
   - **Project URL** （例: `https://xxxx.supabase.co`）
   - **anon public** キー

### ローカル（Supabase CLI）

```bash
supabase init
supabase start
```

起動後に表示される `API URL` と `anon key` を使用します。

## 3. データベースマイグレーション

### クラウドの場合

Supabase Dashboard の **SQL Editor** で `supabase/migrations/001_initial.sql` の内容を実行してください。

```sql
-- notes テーブル
create table notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null default '',
  body_md text not null default '',
  updated_at timestamptz not null default now()
);
alter table notes enable row level security;
create policy "users can crud own notes"
  on notes for all using (auth.uid() = user_id);

-- tasks テーブル
create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null,
  due_date date,
  remind_at timestamptz,
  done boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table tasks enable row level security;
create policy "users can crud own tasks"
  on tasks for all using (auth.uid() = user_id);
```

### ローカルの場合

```bash
supabase db reset
```

`supabase/migrations/` 配下のSQLが自動適用されます。

## 4. Realtime を有効にする

Supabase Dashboard → **Database → Replication** で：

1. `notes` テーブルの Realtime を **ON**
2. `tasks` テーブルの Realtime を **ON**

> これを有効にしないと、別デバイスからの変更がリアルタイム反映されません。

## 5. 環境変数の設定

`apps/desktop/.env.local` を編集：

```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...（anon publicキー）
```

> ⚠️ `.env.local` は `.gitignore` に追加してコミットしないでください。

## 6. デスクトップアプリの起動

```bash
pnpm dev:desktop
```

- `Cmd+Shift+N`（macOS）/ `Ctrl+Shift+N`（Windows）でウィンドウ表示
- メニューバーのトレイアイコンからも操作可能

## 7. ユーザー登録

アプリ起動後、ログイン画面が表示されます。

1. 「アカウントを作成する」をクリック
2. メールアドレスとパスワード（6文字以上）を入力
3. 「サインアップ」をクリック

### メール確認について

- **クラウド**: デフォルトでメール確認が必要です。開発中は Dashboard → **Authentication → Providers → Email** で「Confirm email」を OFF にすると便利です
- **ローカル**: メール確認は無効化されています。そのままログインできます

## トラブルシューティング

### 「⚠️ Supabase未設定」と表示される

`.env.local` に `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` が正しく設定されているか確認してください。設定後はアプリを再起動する必要があります。

### ログインできない

- Supabase Dashboard → **Authentication → Users** でユーザーが作成されているか確認
- メール確認が有効になっている場合、確認メールのリンクをクリックしてください

### データが保存されない

- Supabase Dashboard → **Table Editor** でテーブルが作成されているか確認
- RLS ポリシーが設定されているか確認（`auth.uid() = user_id`）

### Realtime が動かない

- Dashboard → **Database → Replication** で対象テーブルが有効か確認
- ブラウザのコンソール（DevTools）でWebSocketエラーがないか確認

## 開発コマンド一覧

```bash
pnpm dev:desktop        # デスクトップアプリ起動
pnpm typecheck          # 全パッケージの型チェック
pnpm lint               # リント
pnpm build:desktop      # プロダクションビルド
```
