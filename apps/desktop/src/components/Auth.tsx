import { useState } from "react";
import FloteLogo from "./FloteLogo";
import { useT } from "../hooks/useT";
import styles from "./Auth.module.css";

type AuthProps = {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
  onUseLocal?: () => void;
};

export default function Auth({ onSignIn, onSignUp, onUseLocal }: AuthProps) {
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isSignUp) {
        await onSignUp(email, password);
      } else {
        await onSignIn(email, password);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.auth.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div data-tauri-drag-region className={styles.dragRegion} />
      <div className={styles.body}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.logoWrap}>
            <FloteLogo size={56} />
            <span className={styles.appName}>Flote</span>
          </div>
          <p className={styles.subtitle}>
            {isSignUp ? t.auth.signup : t.auth.login}
          </p>

          {isSignUp ? (
            <div className={styles.signupClosed}>
              {t.auth.signupClosed}
            </div>
          ) : (
            <>
              {error && <div className={styles.error}>{error}</div>}

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.auth.emailPlaceholder}
                required
                className={styles.input}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.auth.passwordPlaceholder}
                required
                minLength={6}
                className={styles.input}
              />

              <button type="submit" disabled={loading} className={styles.submitBtn}>
                {loading ? t.auth.processing : t.auth.login}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className={styles.toggleBtn}
          >
            {isSignUp ? t.auth.switchToLogin : t.auth.switchToSignup}
          </button>

          {onUseLocal && (
            <button type="button" onClick={onUseLocal} className={styles.localBtn}>
              {t.auth.useLocal}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
