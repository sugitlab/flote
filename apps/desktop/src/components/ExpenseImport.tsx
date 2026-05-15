import { useState, useMemo } from "react";
import type { Transaction, TransactionType } from "@flote/types";
import { useT } from "../hooks/useT";
import styles from "./ExpenseImport.module.css";

type ParsedRow = Omit<Transaction, "id" | "user_id" | "updated_at">;

function parseDate(raw: string): string | null {
  const s = raw.trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // YYYY/MM/DD
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) return s.replace(/\//g, "-");
  // MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  return null;
}

function parseAmount(raw: string): { amount: number; type: TransactionType } | null {
  const s = raw.replace(/[¥,\s]/g, "");
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return { amount: Math.abs(Math.round(n)), type: n < 0 ? "expense" : "income" };
}

function inferType(raw: string): TransactionType | null {
  const s = raw.trim().toLowerCase();
  if (s === "income" || s === "収入") return "income";
  if (s === "expense" || s === "支出") return "expense";
  return null;
}

function splitLine(line: string): string[] {
  // Try CSV (comma-separated, respecting quoted fields), then tab
  if (line.includes("\t")) return line.split("\t");
  const result: string[] = [];
  let cur = "";
  let inQuote = false;
  for (const ch of line) {
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === "," && !inQuote) { result.push(cur); cur = ""; continue; }
    cur += ch;
  }
  result.push(cur);
  return result;
}

function parseLines(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const cols = splitLine(line).map((c) => c.trim());
    if (cols.length < 2) continue;

    const date = parseDate(cols[0]);
    if (!date) continue; // skip header / invalid

    const amtResult = parseAmount(cols[1]);
    if (!amtResult) continue;

    let type: TransactionType = amtResult.type;
    let description = "";
    let category = "";
    let account = "";

    // Try to detect if column 2 is a type column (income/expense/収入/支出)
    if (cols.length >= 6) {
      // date, amount, type, description, category, account
      const inferredType = inferType(cols[2]);
      if (inferredType) {
        type = inferredType;
        description = cols[3] ?? "";
        category = cols[4] ?? "";
        account = cols[5] ?? "";
      } else {
        // date, amount, description, category, account, ...
        description = cols[2] ?? "";
        category = cols[3] ?? "";
        account = cols[4] ?? "";
      }
    } else if (cols.length === 5) {
      const inferredType = inferType(cols[2]);
      if (inferredType) {
        type = inferredType;
        description = cols[3] ?? "";
        category = cols[4] ?? "";
      } else {
        description = cols[2] ?? "";
        category = cols[3] ?? "";
        account = cols[4] ?? "";
      }
    } else if (cols.length === 4) {
      description = cols[2] ?? "";
      category = cols[3] ?? "";
    } else if (cols.length === 3) {
      description = cols[2] ?? "";
    }

    rows.push({
      date,
      amount: amtResult.amount,
      type,
      description,
      category,
      account,
    });
  }
  return rows;
}

type Props = {
  onImport: (rows: Transaction[]) => void;
  onCancel: () => void;
};

export default function ExpenseImport({ onImport, onCancel }: Props) {
  const t = useT();
  const te = t.expense;
  const [activeTab, setActiveTab] = useState<"csv" | "text">("csv");
  const [text, setText] = useState("");

  const parsed = useMemo(() => parseLines(text), [text]);

  const handleImport = () => {
    const txs: Transaction[] = parsed.map((row) => ({
      ...row,
      id: crypto.randomUUID(),
      updated_at: new Date().toISOString(),
    }));
    onImport(txs);
  };

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className={styles.modal}>
        <p className={styles.title}>{te.importTitle}</p>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === "csv" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("csv")}
          >
            {te.importCsv}
          </button>
          <button
            className={`${styles.tab} ${activeTab === "text" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("text")}
          >
            {te.importText}
          </button>
        </div>

        <p className={styles.hint}>{te.importHint}</p>

        <textarea
          className={styles.textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={activeTab === "csv"
            ? "2026-01-15,5000,expense,ランチ,食費,三井住友カード"
            : "2026-01-15\t5000\t支出\tランチ\t食費\t三井住友カード"
          }
          rows={6}
        />

        {parsed.length > 0 && (
          <>
            <p className={styles.previewTitle}>{te.importCount(parsed.length)}</p>
            <div className={styles.previewWrap}>
              <table className={styles.previewTable}>
                <thead>
                  <tr>
                    <th>{te.date}</th>
                    <th style={{ textAlign: "right" }}>{te.amount}</th>
                    <th>{te.description}</th>
                    <th>{te.category}</th>
                    <th>{te.account}</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((row, i) => (
                    <tr key={i}>
                      <td>{row.date}</td>
                      <td className={row.type === "income" ? styles.amountIncome : styles.amountExpense} style={{ textAlign: "right" }}>
                        {row.type === "income" ? "+" : "-"}¥{row.amount.toLocaleString("ja-JP")}
                      </td>
                      <td>{row.description}</td>
                      <td>{row.category}</td>
                      <td>{row.account}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel}>{te.cancel}</button>
          <button
            className={styles.importBtn}
            disabled={parsed.length === 0}
            onClick={handleImport}
          >
            {te.importConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}
