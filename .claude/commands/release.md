# リリース

引数: $ARGUMENTS（リリースするバージョン番号。例: 0.3.0）

## バージョン番号の更新対象ファイル

以下の4ファイルのバージョンをすべて同じ番号に揃える:

1. `apps/desktop/src-tauri/Cargo.toml` — `version = "..."`
2. `apps/desktop/src-tauri/tauri.conf.json` — `"version": "..."`
3. `apps/desktop/package.json` — `"version": "..."`
4. `apps/desktop/src-tauri/Cargo.lock` — `Cargo.toml` を更新後に `cargo update --workspace` で自動更新（desktop ディレクトリで実行）

## 手順

1. 上記4ファイルのバージョンを `$ARGUMENTS` に更新する
2. `cargo update --workspace` を `apps/desktop/src-tauri/` で実行して Cargo.lock を同期する
3. 変更をコミットする（メッセージ例: `chore: bump version to $ARGUMENTS`）
4. git push する
5. タグとその push についてはユーザーの許可を取ること（CLAUDE.md のルール参照）

## タグの命名規則

- `v{バージョン}` — 全プラットフォーム（macOS + Android + Windows）の本番リリース
- `v{バージョン}-win` — Windows のみのビルド（テスト・単独リリース用）

## GitHub Actions の動作

| タグパターン | 動くワークフロー |
|-------------|----------------|
| `v*`（`-win` を含まない） | `release.yml`（macOS arm64/x86_64 + Android + Windows） |
| `v*-win*` | `release-windows.yml`（Windows x64 のみ、Draft リリース） |

## 注意事項

- Cargo.lock は必ずコミットに含める（再現性のため）
- Windows のみビルドは Draft・prerelease として作成される
- 本番リリースタグは打つ前にユーザーの許可を取ること
