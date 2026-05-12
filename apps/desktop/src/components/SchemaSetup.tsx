import { useState } from "react";
import { SCHEMA_SQL } from "../migrations";
import { useT } from "../hooks/useT";
import styles from "./SchemaSetup.module.css";

type Props = {
  onRetry: () => Promise<void>;
  onSignOut: () => void;
};

export default function SchemaSetup({ onRetry, onSignOut }: Props) {
  const t = useT();
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
        <h2 className={styles.title}>{t.schema.title}</h2>
        <p className={styles.desc}>{t.schema.desc}</p>

        <div className={styles.sqlWrapper}>
          <pre className={styles.sql}>{SCHEMA_SQL}</pre>
        </div>

        <div className={styles.actions}>
          <button className={styles.copyBtn} onClick={handleCopy}>
            {copied ? t.schema.copied : t.schema.copySQL}
          </button>
          <button
            className={styles.retryBtn}
            onClick={handleRetry}
            disabled={checking}
          >
            {checking ? t.schema.checking : t.schema.retry}
          </button>
        </div>

        <button className={styles.signOutLink} onClick={onSignOut}>
          {t.schema.signOut}
        </button>
      </div>
    </div>
  );
}
