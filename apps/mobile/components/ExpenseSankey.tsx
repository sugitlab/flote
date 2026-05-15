import React from "react";
import { View, Text, useWindowDimensions, StyleSheet } from "react-native";
import type { Transaction } from "@flote/types";
import { useTheme } from "../src/theme";
import { useT } from "../src/hooks/useT";

const CATEGORY_COLORS = [
  "#60a5fa", "#f472b6", "#34d399", "#fbbf24",
  "#a78bfa", "#fb923c", "#22d3ee", "#f87171",
];

const NODE_W = 12;
const PAD = 8;
const TOP_MARGIN = 18;
const CHART_HEIGHT = 260;
const H_PAD = 16;
const LABEL_W = 90;

type NodeInfo = {
  id: string;
  label: string;
  amount: number;
  y: number;
  h: number;
  color: string;
};

type LinkInfo = {
  color: string;
  // source (left) top/bottom y
  sy0: number;
  sy1: number;
  // target (right) top/bottom y
  ty0: number;
  ty1: number;
};

function formatAmount(n: number): string {
  return "¥" + n.toLocaleString("ja-JP");
}

function truncate(s: string, max = 8): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function buildNodes(
  entries: [string, number][],
  maxTotal: number,
  usableH: number,
  colorOffset: number
): NodeInfo[] {
  const totalPad = PAD * Math.max(0, entries.length - 1);
  const availH = usableH - totalPad;
  let yOffset = TOP_MARGIN;
  return entries.map(([label, amount], i) => {
    const h = Math.max(6, Math.round((amount / maxTotal) * availH));
    const node: NodeInfo = {
      id: label,
      label,
      amount,
      y: yOffset,
      h,
      color: CATEGORY_COLORS[(i + colorOffset) % CATEGORY_COLORS.length],
    };
    yOffset += h + PAD;
    return node;
  });
}

type Props = {
  transactions: Transaction[];
};

export default function ExpenseSankey({ transactions }: Props) {
  const { colors } = useTheme();
  const t = useT();
  const te = t.expenses;
  const { width: screenWidth } = useWindowDimensions();

  const totalW = screenWidth - H_PAD * 2;
  // center flow area: between node columns
  // layout: [LABEL_W][NODE_W][flowW][NODE_W][LABEL_W]
  const flowW = totalW - LABEL_W * 2 - NODE_W * 2;

  const incomeMap = new Map<string, number>();
  const expenseMap = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type === "income") {
      const k = tx.category || te.income;
      incomeMap.set(k, (incomeMap.get(k) ?? 0) + tx.amount);
    } else {
      const k = tx.category || te.expense;
      expenseMap.set(k, (expenseMap.get(k) ?? 0) + tx.amount);
    }
  }

  const totalIncome = Array.from(incomeMap.values()).reduce((s, v) => s + v, 0);
  const totalExpense = Array.from(expenseMap.values()).reduce((s, v) => s + v, 0);
  const maxTotal = Math.max(totalIncome, totalExpense, 1);
  const usableH = CHART_HEIGHT - TOP_MARGIN - 8;

  const incomeNodes = buildNodes(
    Array.from(incomeMap.entries()).sort((a, b) => b[1] - a[1]),
    maxTotal, usableH, 0
  );
  const expenseNodes = buildNodes(
    Array.from(expenseMap.entries()).sort((a, b) => b[1] - a[1]),
    maxTotal, usableH, 4
  );

  // Build links: each expense node gets flows from income nodes proportionally
  const links: LinkInfo[] = [];
  const incomeUsed = new Map<string, number>(incomeNodes.map(n => [n.id, 0]));
  const expenseUsed = new Map<string, number>(expenseNodes.map(n => [n.id, 0]));

  for (const tgt of expenseNodes) {
    if (totalIncome === 0) continue;
    let remaining = tgt.amount;
    for (const src of incomeNodes) {
      const portion = Math.round((src.amount / totalIncome) * tgt.amount);
      const linkAmt = Math.min(portion, remaining);
      if (linkAmt <= 0) continue;
      remaining -= linkAmt;

      const srcH_total = Math.max(1, Math.round((src.amount / maxTotal) * (usableH - PAD * Math.max(0, incomeNodes.length - 1))));
      const tgtH_total = Math.max(1, Math.round((tgt.amount / maxTotal) * (usableH - PAD * Math.max(0, expenseNodes.length - 1))));
      const srcOff = incomeUsed.get(src.id) ?? 0;
      const tgtOff = expenseUsed.get(tgt.id) ?? 0;
      const lsh = Math.max(1, Math.round((linkAmt / src.amount) * srcH_total));
      const lth = Math.max(1, Math.round((linkAmt / tgt.amount) * tgtH_total));

      links.push({
        color: tgt.color,
        sy0: src.y + srcOff,
        sy1: src.y + srcOff + lsh,
        ty0: tgt.y + tgtOff,
        ty1: tgt.y + tgtOff + lth,
      });
      incomeUsed.set(src.id, srcOff + lsh);
      expenseUsed.set(tgt.id, tgtOff + lth);
    }
  }

  return (
    <View style={[styles.root, { paddingHorizontal: H_PAD }]}>
      {/* Column headers */}
      <View style={[styles.headers, { paddingRight: LABEL_W }]}>
        <Text style={[styles.headerLeft, { color: colors.textSecondary, width: LABEL_W + NODE_W }]}>
          {te.income}
        </Text>
        <Text style={[styles.headerRight, { color: colors.textSecondary, width: LABEL_W + NODE_W }]}>
          {te.expense}
        </Text>
      </View>

      {/* Chart body */}
      <View style={[styles.body, { height: CHART_HEIGHT }]}>

        {/* Flow ribbons (drawn behind nodes) */}
        {links.map((l, i) => {
          // Each ribbon is a trapezoid from (sy0,sy1) on left to (ty0,ty1) on right.
          // Approximate with: left-edge rect + center fill + right-edge rect
          const minY = Math.min(l.sy0, l.ty0);
          const maxY = Math.max(l.sy1, l.ty1);
          const totalH = Math.max(1, maxY - minY);

          // Center block spans the whole height with opacity
          return (
            <View
              key={i}
              style={[
                styles.ribbon,
                {
                  left: LABEL_W + NODE_W,
                  width: flowW,
                  top: minY,
                  height: totalH,
                  backgroundColor: l.color,
                  opacity: 0.2,
                },
              ]}
            />
          );
        })}

        {/* Income nodes + labels (left side) */}
        {incomeNodes.map((node) => (
          <React.Fragment key={node.id}>
            {/* Node bar */}
            <View
              style={[
                styles.node,
                {
                  left: LABEL_W,
                  top: node.y,
                  width: NODE_W,
                  height: node.h,
                  backgroundColor: node.color,
                },
              ]}
            />
            {/* Label to the left */}
            <View
              style={[
                styles.labelLeft,
                { top: node.y, height: node.h, width: LABEL_W - 4 },
              ]}
            >
              <Text style={[styles.labelText, { color: colors.text }]} numberOfLines={1}>
                {truncate(node.label)}
              </Text>
              <Text style={[styles.amountText, { color: colors.textSecondary }]} numberOfLines={1}>
                {formatAmount(node.amount)}
              </Text>
            </View>
          </React.Fragment>
        ))}

        {/* Expense nodes + labels (right side) */}
        {expenseNodes.map((node) => (
          <React.Fragment key={node.id}>
            {/* Node bar */}
            <View
              style={[
                styles.node,
                {
                  right: LABEL_W,
                  top: node.y,
                  width: NODE_W,
                  height: node.h,
                  backgroundColor: node.color,
                },
              ]}
            />
            {/* Label to the right */}
            <View
              style={[
                styles.labelRight,
                { top: node.y, height: node.h, width: LABEL_W - 4, right: 0 },
              ]}
            >
              <Text style={[styles.labelText, { color: colors.text }]} numberOfLines={1}>
                {truncate(node.label)}
              </Text>
              <Text style={[styles.amountText, { color: colors.textSecondary }]} numberOfLines={1}>
                {formatAmount(node.amount)}
              </Text>
            </View>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingVertical: 4 },
  headers: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  headerLeft: { fontSize: 9, fontWeight: "600", textAlign: "center" },
  headerRight: { fontSize: 9, fontWeight: "600", textAlign: "center" },
  body: { position: "relative" },
  ribbon: { position: "absolute", borderRadius: 2 },
  node: { position: "absolute", borderRadius: 2 },
  labelLeft: {
    position: "absolute",
    left: 0,
    justifyContent: "center",
    paddingRight: 4,
  },
  labelRight: {
    position: "absolute",
    justifyContent: "center",
    paddingLeft: 4 + 12, // 4px gap + NODE_W
  },
  labelText: { fontSize: 10, fontWeight: "500" },
  amountText: { fontSize: 9 },
});
