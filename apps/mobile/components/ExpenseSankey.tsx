import React from "react";
import { View, Text, useWindowDimensions, StyleSheet } from "react-native";
import type { Transaction } from "@flote/types";
import { useTheme } from "../src/theme";
import { useT } from "../src/hooks/useT";

const CATEGORY_COLORS = [
  "#60a5fa", "#f472b6", "#34d399", "#fbbf24",
  "#a78bfa", "#fb923c", "#22d3ee", "#f87171",
];

const NODE_W = 10;
const PAD = 6;
const TOP_MARGIN = 16;
const CHART_H = 240;
const H_PAD = 12;
const LABEL_W = 88;
const LABEL_GAP = 4;
// slices per link for trapezoid approximation (more = smoother)
const SLICES = 32;

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
  sy0: number; // source top
  sy1: number; // source bottom
  ty0: number; // target top
  ty1: number; // target bottom
};

function fmt(n: number): string {
  return "¥" + n.toLocaleString("ja-JP");
}

function trunc(s: string, max = 7): string {
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
  let y = TOP_MARGIN;
  return entries.map(([label, amount], i) => {
    const h = Math.max(4, Math.round((amount / maxTotal) * availH));
    const node: NodeInfo = {
      id: label, label, amount, y, h,
      color: CATEGORY_COLORS[(i + colorOffset) % CATEGORY_COLORS.length],
    };
    y += h + PAD;
    return node;
  });
}

type Props = { transactions: Transaction[] };

export default function ExpenseSankey({ transactions }: Props) {
  const { colors } = useTheme();
  const t = useT();
  const te = t.expenses;
  const { width: screenW } = useWindowDimensions();

  const totalW = screenW - H_PAD * 2;
  // [LABEL_W][NODE_W][LABEL_GAP][flowW][LABEL_GAP][NODE_W][LABEL_W]
  const flowW = totalW - LABEL_W * 2 - NODE_W * 2 - LABEL_GAP * 2;
  const flowX = LABEL_W + NODE_W + LABEL_GAP; // left edge of flow area

  const incomeMap = new Map<string, number>();
  const expenseMap = new Map<string, number>();
  for (const tx of transactions) {
    const map = tx.type === "income" ? incomeMap : expenseMap;
    const key = tx.category || (tx.type === "income" ? te.income : te.expense);
    map.set(key, (map.get(key) ?? 0) + tx.amount);
  }

  const totalIncome = [...incomeMap.values()].reduce((s, v) => s + v, 0);
  const totalExpense = [...expenseMap.values()].reduce((s, v) => s + v, 0);
  const maxTotal = Math.max(totalIncome, totalExpense, 1);
  const usableH = CHART_H - TOP_MARGIN - 4;

  const incomeNodes = buildNodes(
    [...incomeMap.entries()].sort((a, b) => b[1] - a[1]),
    maxTotal, usableH, 0
  );
  const expenseNodes = buildNodes(
    [...expenseMap.entries()].sort((a, b) => b[1] - a[1]),
    maxTotal, usableH, 4
  );

  // Build per-link flow positions
  const links: LinkInfo[] = [];
  const incomeUsed = new Map(incomeNodes.map(n => [n.id, 0]));
  const expenseUsed = new Map(expenseNodes.map(n => [n.id, 0]));

  for (const tgt of expenseNodes) {
    if (totalIncome === 0) continue;
    let rem = tgt.amount;
    for (const src of incomeNodes) {
      const linkAmt = Math.min(
        Math.round((src.amount / totalIncome) * tgt.amount),
        rem
      );
      if (linkAmt <= 0) continue;
      rem -= linkAmt;

      const srcTotalH = Math.max(1, Math.round(
        (src.amount / maxTotal) * (usableH - PAD * Math.max(0, incomeNodes.length - 1))
      ));
      const tgtTotalH = Math.max(1, Math.round(
        (tgt.amount / maxTotal) * (usableH - PAD * Math.max(0, expenseNodes.length - 1))
      ));
      const srcOff = incomeUsed.get(src.id) ?? 0;
      const tgtOff = expenseUsed.get(tgt.id) ?? 0;
      const lsh = Math.max(1, Math.round((linkAmt / src.amount) * srcTotalH));
      const lth = Math.max(1, Math.round((linkAmt / tgt.amount) * tgtTotalH));

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

  // Sliced trapezoid ribbons
  const ribbons: React.ReactElement[] = [];
  const sliceW = flowW / SLICES;
  links.forEach((l, li) => {
    for (let s = 0; s < SLICES; s++) {
      // use midpoint of each slice for smooth centering
      const t = (s + 0.5) / SLICES;
      const topY = l.sy0 + (l.ty0 - l.sy0) * t;
      const botY = l.sy1 + (l.ty1 - l.sy1) * t;
      ribbons.push(
        <View
          key={`${li}-${s}`}
          style={{
            position: "absolute",
            left: flowX + s * sliceW,
            width: Math.ceil(sliceW) + 1,
            top: topY,
            height: Math.max(1, botY - topY),
            backgroundColor: l.color,
            opacity: 0.4,
          }}
        />
      );
    }
  });

  return (
    <View style={[styles.root, { paddingHorizontal: H_PAD }]}>
      {/* Column headers */}
      <View style={styles.headers}>
        <Text style={[styles.header, { color: colors.textSecondary, width: LABEL_W + NODE_W }]}>
          {te.income}
        </Text>
        <View style={{ flex: 1 }} />
        <Text style={[styles.header, { color: colors.textSecondary, width: LABEL_W + NODE_W }]}>
          {te.expense}
        </Text>
      </View>

      {/* Chart */}
      <View style={[styles.chart, { height: CHART_H }]}>
        {/* Flow ribbons */}
        {ribbons}

        {/* Income nodes */}
        {incomeNodes.map(node => (
          <View key={"n-" + node.id} style={[styles.node, {
            left: LABEL_W, top: node.y, width: NODE_W, height: node.h,
            backgroundColor: node.color,
          }]} />
        ))}

        {/* Expense nodes */}
        {expenseNodes.map(node => (
          <View key={"n-" + node.id} style={[styles.node, {
            right: LABEL_W, top: node.y, width: NODE_W, height: node.h,
            backgroundColor: node.color,
          }]} />
        ))}

        {/* Income labels: "¥amount  Label" right-aligned before node (desktop style) */}
        {incomeNodes.map(node => (
          <View key={"l-" + node.id} style={[styles.labelLeft, {
            top: node.y, height: node.h, width: LABEL_W - LABEL_GAP,
          }]}>
            <Text style={[styles.incomeLine, { color: colors.text }]} numberOfLines={1}>
              <Text style={{ color: colors.textSecondary, fontSize: 8 }}>{fmt(node.amount)}  </Text>
              <Text style={{ fontWeight: "500", fontSize: 9 }}>{trunc(node.label)}</Text>
            </Text>
          </View>
        ))}

        {/* Expense labels: "Label  ¥amount" left-aligned after node (desktop style) */}
        {expenseNodes.map(node => (
          <View key={"l-" + node.id} style={[styles.labelRight, {
            top: node.y, height: node.h, width: LABEL_W - LABEL_GAP, right: 0,
          }]}>
            <Text style={[styles.expenseLine, { color: colors.text }]} numberOfLines={1}>
              <Text style={{ fontWeight: "500", fontSize: 9 }}>{trunc(node.label)}  </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 8 }}>{fmt(node.amount)}</Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingVertical: 4 },
  headers: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  header: { fontSize: 9, fontWeight: "600", textAlign: "center" },
  chart: { position: "relative" },
  node: { position: "absolute", borderRadius: 2 },
  labelLeft: {
    position: "absolute",
    left: 0,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingRight: LABEL_GAP,
  },
  labelRight: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "flex-start",
    paddingLeft: LABEL_GAP,
  },
  incomeLine: { textAlign: "right" },
  expenseLine: { textAlign: "left" },
});
