import { useSettingsStore } from "../store/settingsStore";
import { getLocale } from "../i18n";

export function useT() {
  const language = useSettingsStore((s) => s.language);
  return getLocale(language ?? "ja");
}
