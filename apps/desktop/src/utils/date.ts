import type { Locale } from "../locales";

export function relativeDate(dateStr: string, dateLocale?: Locale["date"]): string {
  const d = dateLocale ?? {
    justNow: "たった今",
    minutesAgo: (n: number) => `${n}分前`,
    hoursAgo: (n: number) => `${n}時間前`,
    daysAgo: (n: number) => `${n}日前`,
    locale: "ja-JP",
  };

  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return d.justNow;
  if (diffMins < 60) return d.minutesAgo(diffMins);
  const diffHours = Math.floor(diffMs / 3600000);
  if (diffHours < 24) return d.hoursAgo(diffHours);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays < 7) return d.daysAgo(diffDays);
  return new Date(dateStr).toLocaleDateString(d.locale, {
    month: "short",
    day: "numeric",
  });
}
