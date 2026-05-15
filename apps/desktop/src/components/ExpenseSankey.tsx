import React, { useState } from "react";
import type { Transaction } from "@flote/types";
import { useT } from "../hooks/useT";

const CATEGORY_COLORS = [
  "#60a5fa",
  "#f472b6",
  "#34d399",
  "#fbbf24",
  "#a78bfa",
  "#fb923c",
  "#22d3ee",
  "#f87171",
];

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

const NODE_WIDTH = 14;
const PAD = 10;
const LABEL_PAD = 8;
const LEFT_MARGIN = 140;
const RIGHT_MARGIN = 140;
const SVG_WIDTH = 620;
const SVG_HEIGHT = 340;
const TOP_MARGIN = 24;

function formatAmount(n: number): string {
  return "¥" + n.toLocaleString("ja-JP");
}

type Props = {
  transactions: Transaction[];
};

const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;

// x-coordinates of node edges
const INCOME_NODE_X = LEFT_MARGIN;
const EXPENSE_NODE_X = SVG_WIDTH - RIGHT_MARGIN - NODE_WIDTH;
const LINK_X0 = INCOME_NODE_X + NODE_WIDTH;
const LINK_X1 = EXPENSE_NODE_X;
const CX1 = LINK_X0 + (LINK_X1 - LINK_X0) * 0.4;
const CX2 = LINK_X0 + (LINK_X1 - LINK_X0) * 0.6;

export default function ExpenseSankey({ transactions }: Props) {
  const t = useT();
  const te = t.expense;

  const [zoom, setZoom] = useState(1);

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

  if (incomeByCategory.size === 0 && expenseByCategory.size === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: 12 }}>
        {te.noData}
      </div>
    );
  }

  const totalIncome = Array.from(incomeByCategory.values()).reduce((s, v) => s + v, 0);
  const totalExpense = Array.from(expenseByCategory.values()).reduce((s, v) => s + v, 0);
  const maxTotal = Math.max(totalIncome, totalExpense, 1);
  const usableHeight = SVG_HEIGHT - TOP_MARGIN - 16;

  const incomeEntries = Array.from(incomeByCategory.entries());
  const incomeNodes: SankeyNode[] = [];
  {
    const totalPad = PAD * (incomeEntries.length - 1);
    const availH = usableHeight - totalPad;
    let yOffset = TOP_MARGIN;
    incomeEntries.forEach(([cat, amt], i) => {
      const h = Math.max(6, Math.round((amt / maxTotal) * availH));
      incomeNodes.push({ id: "income-" + cat, label: cat, amount: amt, x: INCOME_NODE_X, y: yOffset, height: h, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] });
      yOffset += h + PAD;
    });
  }

  const expenseEntries = Array.from(expenseByCategory.entries());
  const expenseNodes: SankeyNode[] = [];
  {
    const totalPad = PAD * (expenseEntries.length - 1);
    const availH = usableHeight - totalPad;
    let yOffset = TOP_MARGIN;
    expenseEntries.forEach(([cat, amt], i) => {
      const h = Math.max(6, Math.round((amt / maxTotal) * availH));
      expenseNodes.push({ id: "expense-" + cat, label: cat, amount: amt, x: EXPENSE_NODE_X, y: yOffset, height: h, color: CATEGORY_COLORS[(i + 4) % CATEGORY_COLORS.length] });
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
      const srcStrokeH = Math.max(1, Math.round((srcNode.amount / maxTotal) * (usableHeight - PAD * (incomeNodes.length - 1))));
      const tgtStrokeH = Math.max(1, Math.round((tgtNode.amount / maxTotal) * (usableHeight - PAD * (expenseNodes.length - 1))));
      const srcOffset = incomeUsed.get(srcNode.id) ?? 0;
      const tgtOffset = expenseUsed.get(tgtNode.id) ?? 0;
      const linkSrcH = Math.max(1, Math.round((linkAmt / srcNode.amount) * srcStrokeH));
      const linkTgtH = Math.max(1, Math.round((linkAmt / tgtNode.amount) * tgtStrokeH));
      links.push({ sourceNode: srcNode, targetNode: tgtNode, amount: linkAmt, color: tgtNode.color, sourceY: srcNode.y + srcOffset, targetY: tgtNode.y + tgtOffset, srcH: linkSrcH, tgtH: linkTgtH });
      incomeUsed.set(srcNode.id, srcOffset + linkSrcH);
      expenseUsed.set(tgtNode.id, tgtOffset + linkTgtH);
    }
  }

  return (
    <div style={{ padding: "12px 16px", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8, gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", flex: 1 }}>
          {te.sankeyTitle}
        </span>
        <button onClick={() => setZoom((z) => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 100) / 100))} disabled={zoom <= ZOOM_MIN} style={zoomBtnStyle}>−</button>
        <span style={{ fontSize: 10, color: "var(--text-muted)", minWidth: 32, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((z) => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 100) / 100))} disabled={zoom >= ZOOM_MAX} style={zoomBtnStyle}>+</button>
      </div>
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        <svg
          width={Math.round(SVG_WIDTH * zoom)}
          height={Math.round(SVG_HEIGHT * zoom)}
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          style={{ overflow: "visible", display: "block" }}
        >
          <defs>
            {links.map((link, i) => (
              <linearGradient key={i} id={`sg${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={link.sourceNode.color} stopOpacity={0.45} />
                <stop offset="100%" stopColor={link.color} stopOpacity={0.55} />
              </linearGradient>
            ))}
          </defs>

          {/* Links */}
          {links.map((l, i) => {
            const d = [
              `M ${LINK_X0} ${l.sourceY}`,
              `C ${CX1} ${l.sourceY}, ${CX2} ${l.targetY}, ${LINK_X1} ${l.targetY}`,
              `L ${LINK_X1} ${l.targetY + l.tgtH}`,
              `C ${CX2} ${l.sourceY + l.srcH}, ${CX1} ${l.sourceY + l.srcH}, ${LINK_X0} ${l.sourceY + l.srcH}`,
              "Z",
            ].join(" ");
            return <path key={i} d={d} fill={`url(#sg${i})`} opacity={0.7} />;
          })}

          {/* Income nodes + labels (labels on the LEFT side: "¥amount  Label" right-aligned) */}
          {incomeNodes.map((node) => (
            <g key={node.id}>
              <rect x={node.x} y={node.y} width={NODE_WIDTH} height={node.height} fill={node.color} rx={2} />
              <text x={INCOME_NODE_X - LABEL_PAD} y={node.y + node.height / 2} dominantBaseline="middle" textAnchor="end">
                <tspan fontSize={10} fill="var(--text-muted)">{formatAmount(node.amount)}{"  "}</tspan>
                <tspan fontSize={11} fontWeight={500} fill="var(--text-primary)">{node.label}</tspan>
              </text>
            </g>
          ))}

          {/* Expense nodes + labels (labels on the RIGHT side: "Label  ¥amount" left-aligned) */}
          {expenseNodes.map((node) => (
            <g key={node.id}>
              <rect x={node.x} y={node.y} width={NODE_WIDTH} height={node.height} fill={node.color} rx={2} />
              <text x={EXPENSE_NODE_X + NODE_WIDTH + LABEL_PAD} y={node.y + node.height / 2} dominantBaseline="middle" textAnchor="start">
                <tspan fontSize={11} fontWeight={500} fill="var(--text-primary)">{node.label}</tspan>
                <tspan fontSize={10} fill="var(--text-muted)" dx={5}>{formatAmount(node.amount)}</tspan>
              </text>
            </g>
          ))}

          {/* Column headers */}
          <text x={INCOME_NODE_X + NODE_WIDTH / 2} y={12} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--text-secondary)">{te.income}</text>
          <text x={EXPENSE_NODE_X + NODE_WIDTH / 2} y={12} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--text-secondary)">{te.expense}</text>
        </svg>
      </div>
    </div>
  );
}

const zoomBtnStyle: React.CSSProperties = {
  width: 22,
  height: 22,
  border: "1px solid var(--border)",
  borderRadius: 4,
  background: "transparent",
  color: "var(--text-secondary)",
  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  flexShrink: 0,
};
