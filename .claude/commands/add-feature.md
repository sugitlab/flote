# 新機能追加

引数: $ARGUMENTS（機能の説明）

以下の順番で実装してください：

1. `packages/types/src/index.ts` に必要な型を追加
2. `packages/api-client/src/` にSupabase操作関数を追加
3. `apps/desktop/src/` にReactコンポーネントを実装
4. `apps/mobile/` にReact Nativeコンポーネントを実装
5. `pnpm typecheck` を実行して型エラーがないか確認

実装方針:
- Zustandのstoreを経由してstateを管理
- Supabase Realtimeのサブスクリプションを設定
- エラーハンドリングを必ず入れる