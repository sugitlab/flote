# 型同期チェック

packages/typesの型定義がdesktopとmobileで正しく使われているか確認する。

1. `packages/types/src/index.ts` の全exportを確認
2. desktop/mobileで古い型定義が残っていないか grep
3. `pnpm typecheck` を実行
4. 問題があれば修正案を提示