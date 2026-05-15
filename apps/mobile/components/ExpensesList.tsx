import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useTheme } from "../src/theme";
import { useExpenseStore } from "../src/store/expenseStore";
import { useT } from "../src/hooks/useT";
import type { Transaction } from "@flote/types";

const CATEGORY_COLORS = [
  "#60a5fa", "#f472b6", "#34d399", "#fbbf24",
  "#a78bfa", "#fb923c", "#22d3ee", "#f87171",
];

function formatAmount(n: number): string {
  return "¥" + n.toLocaleString("ja-JP");
}

function currentMonthStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}

// ── Chart ────────────────────────────────────────────────────────────────────

type CategoryStat = { label: string; amount: number; color: string };

function buildStats(transactions: Transaction[], type: "income" | "expense"): CategoryStat[] {
  const map = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== type) continue;
    const key = tx.category || (type === "income" ? "収入" : "支出");
    map.set(key, (map.get(key) ?? 0) + tx.amount);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, amount], i) => ({ label, amount, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }));
}

function Chart({
  transactions,
  incomeTotal,
  expenseTotal,
}: {
  transactions: Transaction[];
  incomeTotal: number;
  expenseTotal: number;
}) {
  const { colors } = useTheme();
  const t = useT();
  const te = t.expenses;
  const balance = incomeTotal - expenseTotal;

  const expenseStats = buildStats(transactions, "expense");
  const incomeStats = buildStats(transactions, "income");
  const maxTotal = Math.max(incomeTotal, expenseTotal, 1);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.chartContent} showsVerticalScrollIndicator={false}>
      {/* Summary row */}
      <View style={[styles.summaryRow, { borderBottomColor: colors.border }]}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{te.income}</Text>
          <Text style={[styles.summaryValue, { color: "#22c55e" }]}>{formatAmount(incomeTotal)}</Text>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{te.expense}</Text>
          <Text style={[styles.summaryValue, { color: "#ef4444" }]}>{formatAmount(expenseTotal)}</Text>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{te.balance}</Text>
          <Text style={[styles.summaryValue, { color: balance >= 0 ? "#22c55e" : "#ef4444" }]}>
            {balance >= 0 ? "+" : ""}{formatAmount(balance)}
          </Text>
        </View>
      </View>

      {/* Income vs Expense overall bar */}
      {(incomeTotal > 0 || expenseTotal > 0) && (
        <View style={styles.overallBar}>
          <View style={[styles.overallBarTrack, { backgroundColor: colors.surface }]}>
            {incomeTotal > 0 && (
              <View style={[styles.overallBarIncome, { flex: incomeTotal }]} />
            )}
            {expenseTotal > 0 && (
              <View style={[styles.overallBarExpense, { flex: expenseTotal }]} />
            )}
            {Math.max(0, maxTotal - incomeTotal - expenseTotal) > 0 && (
              <View style={{ flex: Math.max(0, maxTotal - incomeTotal - expenseTotal) }} />
            )}
          </View>
          <View style={styles.overallBarLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#22c55e" }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>{te.income}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#ef4444" }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>{te.expense}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Expense breakdown */}
      {expenseStats.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{te.expense}</Text>
          {expenseStats.map((stat) => {
            const pct = expenseTotal > 0 ? stat.amount / expenseTotal : 0;
            return (
              <View key={stat.label} style={styles.barRow}>
                <Text style={[styles.barLabel, { color: colors.text }]} numberOfLines={1}>{stat.label}</Text>
                <View style={[styles.barTrack, { backgroundColor: colors.surface }]}>
                  <View style={[styles.barFill, { flex: pct, backgroundColor: stat.color }]} />
                  <View style={{ flex: 1 - pct }} />
                </View>
                <Text style={[styles.barAmount, { color: colors.textSecondary }]}>
                  {formatAmount(stat.amount)}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Income breakdown */}
      {incomeStats.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{te.income}</Text>
          {incomeStats.map((stat) => {
            const pct = incomeTotal > 0 ? stat.amount / incomeTotal : 0;
            return (
              <View key={stat.label} style={styles.barRow}>
                <Text style={[styles.barLabel, { color: colors.text }]} numberOfLines={1}>{stat.label}</Text>
                <View style={[styles.barTrack, { backgroundColor: colors.surface }]}>
                  <View style={[styles.barFill, { flex: pct, backgroundColor: stat.color }]} />
                  <View style={{ flex: 1 - pct }} />
                </View>
                <Text style={[styles.barAmount, { color: colors.textSecondary }]}>
                  {formatAmount(stat.amount)}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

type Props = {
  userId: string | null;
};

export default function ExpensesList({ userId }: Props) {
  const { colors } = useTheme();
  const t = useT();
  const te = t.expenses;
  const { transactions, loading, fetchTransactions } = useExpenseStore();

  const [selectedMonth, setSelectedMonth] = useState<string | null>(currentMonthStr());

  const doFetch = useCallback((month: string | null, uid: string) => {
    if (!month) {
      fetchTransactions(uid);
    } else {
      const { from, to } = monthRange(month);
      fetchTransactions(uid, from, to);
    }
  }, [fetchTransactions]);

  useEffect(() => {
    if (!userId) return;
    doFetch(selectedMonth, userId);
  }, [userId, selectedMonth]);

  const handlePrev = useCallback(() => {
    setSelectedMonth((prev) => {
      const base = prev ?? currentMonthStr();
      const [y, m] = base.split("-").map(Number);
      const d = new Date(y, m - 2, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
  }, []);

  const handleNext = useCallback(() => {
    setSelectedMonth((prev) => {
      if (!prev) return prev;
      const [y, m] = prev.split("-").map(Number);
      const d = new Date(y, m, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
  }, []);

  const monthLabel = selectedMonth
    ? (() => {
        const [y, m] = selectedMonth.split("-").map(Number);
        return te.monthLabel(y, m);
      })()
    : te.allPeriod;

  const incomeTotal = transactions.filter((x) => x.type === "income").reduce((s, x) => s + x.amount, 0);
  const expenseTotal = transactions.filter((x) => x.type === "expense").reduce((s, x) => s + x.amount, 0);

  const renderItem = useCallback(({ item }: { item: Transaction }) => (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={styles.rowLeft}>
        <Text style={[styles.date, { color: colors.textSecondary }]}>{item.date}</Text>
        {item.description ? (
          <Text style={[styles.desc, { color: colors.text }]} numberOfLines={1}>{item.description}</Text>
        ) : null}
        {item.category ? (
          <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>{item.category}</Text>
        ) : null}
      </View>
      <Text style={[styles.amount, { color: item.type === "income" ? "#22c55e" : "#ef4444" }]}>
        {item.type === "income" ? "+" : "−"}{formatAmount(item.amount)}
      </Text>
    </View>
  ), [colors]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Read-only notice */}
      <View style={[styles.notice, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.noticeText, { color: colors.textSecondary }]}>{te.readonlyNotice}</Text>
      </View>

      {/* Month navigator */}
      <View style={[styles.monthBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handlePrev} style={styles.monthBtn} activeOpacity={0.6}>
          <Text style={[styles.monthBtnText, { color: colors.accent }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.monthLabel, { color: colors.text }]}>{monthLabel}</Text>
        <TouchableOpacity
          onPress={handleNext}
          style={styles.monthBtn}
          activeOpacity={0.6}
          disabled={!selectedMonth}
        >
          <Text style={[styles.monthBtnText, { color: selectedMonth ? colors.accent : colors.border }]}>›</Text>
        </TouchableOpacity>
        {selectedMonth && (
          <TouchableOpacity onPress={() => setSelectedMonth(null)} style={styles.allPeriodBtn} activeOpacity={0.6}>
            <Text style={[styles.allPeriodText, { color: colors.textSecondary }]}>{te.allPeriod}</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : transactions.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.empty, { color: colors.textSecondary }]}>{te.noData}</Text>
        </View>
      ) : (
        <View style={styles.body}>
          {/* Top half: chart */}
          <View style={[styles.chartPane, { borderBottomColor: colors.border }]}>
            <Chart transactions={transactions} incomeTotal={incomeTotal} expenseTotal={expenseTotal} />
          </View>

          {/* Bottom half: transaction list */}
          <View style={styles.listPane}>
            <FlatList
              data={transactions}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              refreshControl={
                <RefreshControl
                  refreshing={loading}
                  onRefresh={() => userId && doFetch(selectedMonth, userId)}
                  tintColor={colors.accent}
                />
              }
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notice: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  noticeText: { fontSize: 11, textAlign: "center" },
  monthBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  monthBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  monthBtnText: { fontSize: 22, lineHeight: 26 },
  monthLabel: { fontSize: 14, fontWeight: "600", flex: 1, textAlign: "center" },
  allPeriodBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  allPeriodText: { fontSize: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { fontSize: 13 },

  body: { flex: 1 },

  // Chart pane (top half)
  chartPane: {
    flex: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chartContent: {
    paddingBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryLabel: { fontSize: 10, marginBottom: 3 },
  summaryValue: { fontSize: 14, fontWeight: "700" },
  summaryDivider: { width: StyleSheet.hairlineWidth, marginVertical: 4 },

  overallBar: { paddingHorizontal: 16, paddingTop: 12 },
  overallBarTrack: {
    flexDirection: "row",
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  overallBarIncome: { backgroundColor: "#22c55e" },
  overallBarExpense: { backgroundColor: "#ef4444" },
  overallBarLegend: {
    flexDirection: "row",
    gap: 16,
    marginTop: 6,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11 },

  section: { paddingHorizontal: 16, paddingTop: 14 },
  sectionTitle: { fontSize: 11, fontWeight: "600", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 },
  barLabel: { width: 72, fontSize: 12 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, flexDirection: "row", overflow: "hidden" },
  barFill: { borderRadius: 4 },
  barAmount: { width: 72, fontSize: 11, textAlign: "right" },

  // List pane (bottom half)
  listPane: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLeft: { flex: 1, marginRight: 12 },
  date: { fontSize: 11, marginBottom: 2 },
  desc: { fontSize: 13, fontWeight: "500" },
  meta: { fontSize: 11, marginTop: 1 },
  amount: { fontSize: 13, fontWeight: "600", textAlign: "right" },
});
