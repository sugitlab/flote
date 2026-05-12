import { useUIStore } from "../store/uiStore";
import { getLocale } from "../locales";

export function useT() {
  const language = useUIStore((s) => s.language);
  return getLocale(language);
}
