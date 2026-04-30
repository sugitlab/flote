import { useState } from "react";
import { SCHEMA_SQL } from "../migrations";
import styles from "./SchemaSetup.module.css";

type Props = {
  onRetry: () => Promise<void>;
  onSignOut: () => void;
};

export default function SchemaSetup({ onRetry, onSignOut }: Props) {
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(SCHEMA_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRetry = async () => {
    setChecking(true);
    await onRetry();
    setChecking(false);
  };

  return (
    <div className={styles.container}>
      <div data-tauri-drag-region className={styles.drag} />
      <div className={styles.content}>
        <h2 className={styles.title}>データベースセットアップ</h2>
        <p className={styles.desc}>
          接続先のSupabaseにFloteのテーブルが見つかりませんでした。<br />
          以下のSQLをSupabaseの <strong>SQL エディタ</strong> で実行してください。
        </p>

        <div className={styles.sqlWrapper}>
          <pre className={styles.sql}>{SCHEMA_SQL}</pre>
        </div>

        <div className={styles.actions}>
          <button className={styles.copyBtn} onClick={handleCopy}>
            {copied ? "✓ コピーしました" : "SQLをコピー"}
          </button>
          <button
            className={styles.retryBtn}
            onClick={handleRetry}
            disabled={checking}
          >
            {checking ? "確認中..." : "実行完了 → 再確認する"}
          </button>
        </div>

        <button className={styles.signOutLink} onClick={onSignOut}>
          別のアカウントでログイン
        </button>
      </div>
    </div>
  );
}
