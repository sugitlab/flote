import React, { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import WebView from "react-native-webview";
import type { Transaction } from "@flote/types";
import { useTheme } from "../src/theme";
import { useT } from "../src/hooks/useT";

const CATEGORY_COLORS = [
  "#60a5fa", "#f472b6", "#34d399", "#fbbf24",
  "#a78bfa", "#fb923c", "#22d3ee", "#f87171",
];

const NODE_W = 14;
const PAD = 10;
const LABEL_PAD = 8;
const TOP_MARGIN = 24;
const SVG_HEIGHT = 300;
const H_PAD = 16;

function fmt(n: number): string {
  return "¥" + n.toLocaleString("ja-JP");
}

type NodeInfo = {
  id: string; label: string; amount: number;
  x: number; y: number; h: number; color: string;
};
type LinkInfo = {
  sourceNode: NodeInfo; targetNode: NodeInfo;
  color: string;
  sourceY: number; targetY: number; srcH: number; tgtH: number;
};

function buildSankeyHTML(
  transactions: Transaction[],
  svgWidth: number,
  bgColor: string,
  textColor: string,
  textMuted: string,
  incomeLabel: string,
  expenseLabel: string,
): string {
  const LEFT_MARGIN = Math.round(svgWidth * 0.32);
  const RIGHT_MARGIN = Math.round(svgWidth * 0.32);
  const INCOME_NODE_X = LEFT_MARGIN;
  const EXPENSE_NODE_X = svgWidth - RIGHT_MARGIN - NODE_W;
  const LINK_X0 = INCOME_NODE_X + NODE_W;
  const LINK_X1 = EXPENSE_NODE_X;
  const CX1 = LINK_X0 + (LINK_X1 - LINK_X0) * 0.4;
  const CX2 = LINK_X0 + (LINK_X1 - LINK_X0) * 0.6;

  const incomeMap = new Map<string, number>();
  const expenseMap = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type === "income") {
      const k = tx.category || incomeLabel;
      incomeMap.set(k, (incomeMap.get(k) ?? 0) + tx.amount);
    } else {
      const k = tx.category || expenseLabel;
      expenseMap.set(k, (expenseMap.get(k) ?? 0) + tx.amount);
    }
  }

  const totalIncome = [...incomeMap.values()].reduce((s, v) => s + v, 0);
  const totalExpense = [...expenseMap.values()].reduce((s, v) => s + v, 0);
  const maxTotal = Math.max(totalIncome, totalExpense, 1);
  const usableH = SVG_HEIGHT - TOP_MARGIN - 16;

  function makeNodes(entries: [string, number][], nodeX: number, colorOffset: number): NodeInfo[] {
    const totalPad = PAD * Math.max(0, entries.length - 1);
    const availH = usableH - totalPad;
    let yOff = TOP_MARGIN;
    return entries.map(([label, amt], i) => {
      const h = Math.max(6, Math.round((amt / maxTotal) * availH));
      const node: NodeInfo = { id: label, label, amount: amt, x: nodeX, y: yOff, h, color: CATEGORY_COLORS[(i + colorOffset) % CATEGORY_COLORS.length] };
      yOff += h + PAD;
      return node;
    });
  }

  const incomeNodes = makeNodes([...incomeMap.entries()], INCOME_NODE_X, 0);
  const expenseNodes = makeNodes([...expenseMap.entries()], EXPENSE_NODE_X, 4);

  const links: LinkInfo[] = [];
  const incUsed = new Map(incomeNodes.map(n => [n.id, 0]));
  const expUsed = new Map(expenseNodes.map(n => [n.id, 0]));

  for (const tgt of expenseNodes) {
    if (totalIncome === 0) continue;
    let rem = tgt.amount;
    for (const src of incomeNodes) {
      const linkAmt = Math.min(Math.round((src.amount / totalIncome) * tgt.amount), rem);
      if (linkAmt <= 0) continue;
      rem -= linkAmt;
      const srcTH = Math.max(1, Math.round((src.amount / maxTotal) * (usableH - PAD * Math.max(0, incomeNodes.length - 1))));
      const tgtTH = Math.max(1, Math.round((tgt.amount / maxTotal) * (usableH - PAD * Math.max(0, expenseNodes.length - 1))));
      const so = incUsed.get(src.id) ?? 0;
      const to = expUsed.get(tgt.id) ?? 0;
      const lsh = Math.max(1, Math.round((linkAmt / src.amount) * srcTH));
      const lth = Math.max(1, Math.round((linkAmt / tgt.amount) * tgtTH));
      links.push({ sourceNode: src, targetNode: tgt, color: tgt.color, sourceY: src.y + so, targetY: tgt.y + to, srcH: lsh, tgtH: lth });
      incUsed.set(src.id, so + lsh);
      expUsed.set(tgt.id, to + lth);
    }
  }

  const defs = links.map((l, i) => `<linearGradient id="sg${i}" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="${l.sourceNode.color}" stop-opacity="0.45"/><stop offset="100%" stop-color="${l.color}" stop-opacity="0.55"/></linearGradient>`).join("");

  const paths = links.map((l, i) => {
    const d = `M ${LINK_X0} ${l.sourceY} C ${CX1} ${l.sourceY}, ${CX2} ${l.targetY}, ${LINK_X1} ${l.targetY} L ${LINK_X1} ${l.targetY + l.tgtH} C ${CX2} ${l.sourceY + l.srcH}, ${CX1} ${l.sourceY + l.srcH}, ${LINK_X0} ${l.sourceY + l.srcH} Z`;
    return `<path d="${d}" fill="url(#sg${i})" opacity="0.7"/>`;
  }).join("");

  const incSVG = incomeNodes.map(n => `
    <rect x="${n.x}" y="${n.y}" width="${NODE_W}" height="${n.h}" fill="${n.color}" rx="2"/>
    <text x="${INCOME_NODE_X - LABEL_PAD}" y="${n.y + n.h / 2}" dominant-baseline="middle" text-anchor="end">
      <tspan font-size="10" fill="${textMuted}">${fmt(n.amount)}  </tspan><tspan font-size="11" font-weight="500" fill="${textColor}">${n.label}</tspan>
    </text>`).join("");

  const expSVG = expenseNodes.map(n => `
    <rect x="${n.x}" y="${n.y}" width="${NODE_W}" height="${n.h}" fill="${n.color}" rx="2"/>
    <text x="${EXPENSE_NODE_X + NODE_W + LABEL_PAD}" y="${n.y + n.h / 2}" dominant-baseline="middle" text-anchor="start">
      <tspan font-size="11" font-weight="500" fill="${textColor}">${n.label}  </tspan><tspan font-size="10" fill="${textMuted}">${fmt(n.amount)}</tspan>
    </text>`).join("");

  const headers = `
    <text x="${INCOME_NODE_X + NODE_W / 2}" y="12" text-anchor="middle" font-size="10" font-weight="600" fill="${textMuted}">${incomeLabel}</text>
    <text x="${EXPENSE_NODE_X + NODE_W / 2}" y="12" text-anchor="middle" font-size="10" font-weight="600" fill="${textMuted}">${expenseLabel}</text>`;

  const svg = `<svg width="${svgWidth}" height="${SVG_HEIGHT}" viewBox="0 0 ${svgWidth} ${SVG_HEIGHT}" style="overflow:visible;display:block"><defs>${defs}</defs>${paths}${incSVG}${expSVG}${headers}</svg>`;

  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:${bgColor};padding:4px ${H_PAD}px}</style></head><body>${svg}</body></html>`;
}

type Props = { transactions: Transaction[] };

export default function ExpenseSankey({ transactions }: Props) {
  const { colors } = useTheme();
  const t = useT();
  const te = t.expenses;
  const { width } = useWindowDimensions();

  const html = useMemo(() => buildSankeyHTML(
    transactions,
    width - H_PAD * 2,
    colors.background,
    colors.text,
    colors.textSecondary,
    te.income,
    te.expense,
  ), [transactions, width, colors, te]);

  return (
    <WebView
      source={{ html }}
      style={{ height: SVG_HEIGHT + 8, backgroundColor: colors.background }}
      scrollEnabled={false}
      originWhitelist={["*"]}
    />
  );
}
