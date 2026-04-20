import { useState } from "react";

type AuthProps = {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
};

export default function Auth({ onSignIn, onSignUp }: AuthProps) {
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
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100 rounded-lg overflow-hidden">
      <div
        data-tauri-drag-region
        className="h-8 shrink-0 bg-gray-900/80 select-none cursor-move"
      />
      <div className="flex-1 flex items-center justify-center">
        <form
          onSubmit={handleSubmit}
          className="w-80 flex flex-col gap-4 p-6 bg-gray-800 rounded-lg"
        >
          <h2 className="text-lg font-semibold text-center">
            {isSignUp ? "アカウント作成" : "ログイン"}
          </h2>

          {error && (
            <div className="text-sm text-red-400 bg-red-900/30 px-3 py-2 rounded">
              {error}
            </div>
          )}

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="メールアドレス"
            required
            className="bg-gray-700 text-sm text-white px-3 py-2 rounded outline-none placeholder-gray-500 focus:ring-1 focus:ring-blue-500"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワード"
            required
            minLength={6}
            className="bg-gray-700 text-sm text-white px-3 py-2 rounded outline-none placeholder-gray-500 focus:ring-1 focus:ring-blue-500"
          />

          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm font-medium py-2 rounded transition-colors"
          >
            {loading
              ? "処理中..."
              : isSignUp
                ? "サインアップ"
                : "ログイン"}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            {isSignUp
              ? "アカウントをお持ちの方はこちら"
              : "アカウントを作成する"}
          </button>
        </form>
      </div>
    </div>
  );
}
