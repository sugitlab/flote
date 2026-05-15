import React from "react";
import { View, useWindowDimensions } from "react-native";
import Svg, {
  Path,
  Rect,
  Text as SvgText,
  TSpan,
  G,
} from "react-native-svg";
import type { Transaction } from "@flote/types";
import { useTheme } from "../src/theme";
import { useT } from "../src/hooks/useT";

const CATEGORY_COLORS = [
  "#60a5fa", "#f472b6", "#34d399", "#fbbf24",
  "#a78bfa", "#fb923c", "#22d3ee", "#f87171",
];

const NODE_WIDTH = 12;
const PAD = 8;
const LABEL_PAD = 6;
const TOP_MARGIN = 20;
const SVG_HEIGHT = 260;
const H_PADDING = 16;

type SankeyNode = {
  id: string;
  label: string;
  amount: number;
  x: number;
  y: number;
  height: number;
  color: string;
};

type SankeyLink = {
  sourceNode: SankeyNode;
  targetNode: SankeyNode;
  amount: number;
  color: string;
  sourceY: number;
  targetY: number;
  srcH: number;
  tgtH: number;
};

function formatAmount(n: number): string {
  return "¥" + n.toLocaleString("ja-JP");
}

function truncate(s: string, max = 9): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

type Props = {
  transactions: Transaction[];
};

export default function ExpenseSankey({ transactions }: Props) {
  const { colors } = useTheme();
  const t = useT();
  const te = t.expenses;
  const { width: screenWidth } = useWindowDimensions();

  const SVG_WIDTH = screenWidth - H_PADDING * 2;
  const LEFT_MARGIN = Math.round(SVG_WIDTH * 0.32);
  const RIGHT_MARGIN = Math.round(SVG_WIDTH * 0.32);
  const INCOME_NODE_X = LEFT_MARGIN;
  const EXPENSE_NODE_X = SVG_WIDTH - RIGHT_MARGIN - NODE_WIDTH;
  const LINK_X0 = INCOME_NODE_X + NODE_WIDTH;
  const LINK_X1 = EXPENSE_NODE_X;
  const CX1 = LINK_X0 + (LINK_X1 - LINK_X0) * 0.4;
  const CX2 = LINK_X0 + (LINK_X1 - LINK_X0) * 0.6;

  const incomeByCategory = new Map<string, number>();
  const expenseByCategory = new Map<string, number>();

  for (const tx of transactions) {
    if (tx.type === "income") {
      const key = tx.category || te.income;
      incomeByCategory.set(key, (incomeByCategory.get(key) ?? 0) + tx.amount);
    } else {
      const key = tx.category || te.expense;
      expenseByCategory.set(key, (expenseByCategory.get(key) ?? 0) + tx.amount);
    }
  }

  const totalIncome = Array.from(incomeByCategory.values()).reduce((s, v) => s + v, 0);
  const totalExpense = Array.from(expenseByCategory.values()).reduce((s, v) => s + v, 0);
  const maxTotal = Math.max(totalIncome, totalExpense, 1);
  const usableHeight = SVG_HEIGHT - TOP_MARGIN - 16;

  const incomeEntries = Array.from(incomeByCategory.entries());
  const incomeNodes: SankeyNode[] = [];
  {
    const totalPad = PAD * Math.max(0, incomeEntries.length - 1);
    const availH = usableHeight - totalPad;
    let yOffset = TOP_MARGIN;
    incomeEntries.forEach(([cat, amt], i) => {
      const h = Math.max(6, Math.round((amt / maxTotal) * availH));
      incomeNodes.push({
        id: "inc-" + cat, label: cat, amount: amt,
        x: INCOME_NODE_X, y: yOffset, height: h,
        color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      });
      yOffset += h + PAD;
    });
  }

  const expenseEntries = Array.from(expenseByCategory.entries());
  const expenseNodes: SankeyNode[] = [];
  {
    const totalPad = PAD * Math.max(0, expenseEntries.length - 1);
    const availH = usableHeight - totalPad;
    let yOffset = TOP_MARGIN;
    expenseEntries.forEach(([cat, amt], i) => {
      const h = Math.max(6, Math.round((amt / maxTotal) * availH));
      expenseNodes.push({
        id: "exp-" + cat, label: cat, amount: amt,
        x: EXPENSE_NODE_X, y: yOffset, height: h,
        color: CATEGORY_COLORS[(i + 4) % CATEGORY_COLORS.length],
      });
      yOffset += h + PAD;
    });
  }

  const links: SankeyLink[] = [];
  const incomeUsed = new Map<string, number>();
  const expenseUsed = new Map<string, number>();
  for (const n of incomeNodes) incomeUsed.set(n.id, 0);
  for (const n of expenseNodes) expenseUsed.set(n.id, 0);

  for (const tgtNode of expenseNodes) {
    if (totalIncome === 0) continue;
    let remaining = tgtNode.amount;
    for (const srcNode of incomeNodes) {
      const portion = Math.round((srcNode.amount / totalIncome) * tgtNode.amount);
      const linkAmt = Math.min(portion, remaining);
      if (linkAmt <= 0) continue;
      remaining -= linkAmt;
      const srcStrokeH = Math.max(1, Math.round((srcNode.amount / maxTotal) * (usableHeight - PAD * Math.max(0, incomeNodes.length - 1))));
      const tgtStrokeH = Math.max(1, Math.round((tgtNode.amount / maxTotal) * (usableHeight - PAD * Math.max(0, expenseNodes.length - 1))));
      const srcOffset = incomeUsed.get(srcNode.id) ?? 0;
      const tgtOffset = expenseUsed.get(tgtNode.id) ?? 0;
      const linkSrcH = Math.max(1, Math.round((linkAmt / srcNode.amount) * srcStrokeH));
      const linkTgtH = Math.max(1, Math.round((linkAmt / tgtNode.amount) * tgtStrokeH));
      links.push({
        sourceNode: srcNode, targetNode: tgtNode, amount: linkAmt, color: tgtNode.color,
        sourceY: srcNode.y + srcOffset, targetY: tgtNode.y + tgtOffset,
        srcH: linkSrcH, tgtH: linkTgtH,
      });
      incomeUsed.set(srcNode.id, srcOffset + linkSrcH);
      expenseUsed.set(tgtNode.id, tgtOffset + linkTgtH);
    }
  }

  return (
    <View style={{ paddingHorizontal: H_PADDING, paddingVertical: 4 }}>
      <Svg width={SVG_WIDTH} height={SVG_HEIGHT}>
        {links.map((l, i) => {
          const d = [
            `M ${LINK_X0} ${l.sourceY}`,
            `C ${CX1} ${l.sourceY}, ${CX2} ${l.targetY}, ${LINK_X1} ${l.targetY}`,
            `L ${LINK_X1} ${l.targetY + l.tgtH}`,
            `C ${CX2} ${l.sourceY + l.srcH}, ${CX1} ${l.sourceY + l.srcH}, ${LINK_X0} ${l.sourceY + l.srcH}`,
            "Z",
          ].join(" ");
          return <Path key={i} d={d} fill={l.color} fillOpacity={0.35} />;
        })}

        {incomeNodes.map((node) => (
          <G key={node.id}>
            <Rect x={node.x} y={node.y} width={NODE_WIDTH} height={node.height} fill={node.color} rx={2} />
            <SvgText
              x={INCOME_NODE_X - LABEL_PAD}
              y={node.y + node.height / 2}
              textAnchor="end"
              dominantBaseline="middle"
            >
              <TSpan fontSize={9} fill={colors.textSecondary}>{formatAmount(node.amount)}{"  "}</TSpan>
              <TSpan fontSize={10} fontWeight="500" fill={colors.text}>{truncate(node.label)}</TSpan>
            </SvgText>
          </G>
        ))}

        {expenseNodes.map((node) => (
          <G key={node.id}>
            <Rect x={node.x} y={node.y} width={NODE_WIDTH} height={node.height} fill={node.color} rx={2} />
            <SvgText
              x={EXPENSE_NODE_X + NODE_WIDTH + LABEL_PAD}
              y={node.y + node.height / 2}
              textAnchor="start"
              dominantBaseline="middle"
            >
              <TSpan fontSize={10} fontWeight="500" fill={colors.text}>{truncate(node.label)}{"  "}</TSpan>
              <TSpan fontSize={9} fill={colors.textSecondary}>{formatAmount(node.amount)}</TSpan>
            </SvgText>
          </G>
        ))}

        <SvgText x={INCOME_NODE_X + NODE_WIDTH / 2} y={10} textAnchor="middle" fontSize={9} fontWeight="600" fill={colors.textSecondary}>
          {te.income}
        </SvgText>
        <SvgText x={EXPENSE_NODE_X + NODE_WIDTH / 2} y={10} textAnchor="middle" fontSize={9} fontWeight="600" fill={colors.textSecondary}>
          {te.expense}
        </SvgText>
      </Svg>
    </View>
  );
}
