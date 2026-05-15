import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "../src/theme";
import { useExpenseStore } from "../src/store/expenseStore";
import { useT } from "../src/hooks/useT";
import type { Transaction } from "@flote/types";
import ExpenseSankey from "./ExpenseSankey";

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

// ── Main ─────────────────────────────────────────────────────────────────────

type Props = {
  userId: string | null;
};

export default function ExpensesList({ userId }: Props) {
  const { colors } = useTheme();
  const t = useT();
  const te = t.expenses;
  const { transactions, loading, fetchTransactions } = useExpenseStore();

  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

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
          {/* Top: summary + sankey */}
          <View style={[styles.chartPane, { borderBottomColor: colors.border }]}>
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
                <Text style={[styles.summaryValue, { color: (incomeTotal - expenseTotal) >= 0 ? "#22c55e" : "#ef4444" }]}>
                  {(incomeTotal - expenseTotal) >= 0 ? "+" : ""}{formatAmount(incomeTotal - expenseTotal)}
                </Text>
              </View>
            </View>
            <ExpenseSankey transactions={transactions} />
          </View>

          {/* Bottom: transaction list */}
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

  chartPane: {
    borderBottomWidth: StyleSheet.hairlineWidth,
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
