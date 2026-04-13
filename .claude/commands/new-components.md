# コンポーネント作成

引数: $ARGUMENTS（例: "desktop TaskCard" or "mobile NoteListItem"）

- desktop の場合: `apps/desktop/src/components/` に作成、Tailwind使用
- mobile の場合: `apps/mobile/components/` に作成、StyleSheet API使用
- propsの型はinlineで定義（packages/typesのモデル型はそのまま使う）
- コンポーネントはdefault exportしない（named exportのみ）