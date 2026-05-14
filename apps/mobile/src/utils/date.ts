import type { Locale } from "../i18n";

export function relativeDate(dateStr: string, dateLocale?: Locale["date"]): string {
  const d = dateLocale ?? {
    today: "今日",
    daysAgo: (n: number) => `${n}日前`,
    yearsAgo: (n: number) => `${n}年前`,
    monthDay: (date: Date) => `${date.getMonth() + 1}月${date.getDate()}日`,
  };
  const then = new Date(dateStr.length === 10 ? dateStr + "T00:00:00" : dateStr);
  const now = new Date();
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thenMid = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const diffDays = Math.round((todayMid.getTime() - thenMid.getTime()) / 86400000);
  if (diffDays === 0) return d.today;
  if (diffDays >= 1 && diffDays <= 3) return d.daysAgo(diffDays);
  if (diffDays >= 365) return d.yearsAgo(Math.floor(diffDays / 365));
  return d.monthDay(then);
}
