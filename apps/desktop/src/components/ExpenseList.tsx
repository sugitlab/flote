import { useState, useMemo, useCallback } from "react";
import type { Transaction } from "@flote/types";
import { writeTextFile, exists, mkdir } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useT } from "../hooks/useT";
import { useUIStore } from "../store/uiStore";
import styles from "./ExpenseList.module.css";

type SortKey = "date" | "description" | "category" | "account" | "amount";
type SortDir = "asc" | "desc";

function formatAmount(amount: number): string {
  return "¥" + amount.toLocaleString("ja-JP");
}

type Props = {
  transactions: Transaction[];
  selectedMonth: string | null;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onClearMonth: () => void;
  onNew: () => void;
  onImport: () => void;
  onDelete: (id: string) => void;
  onDeleteMultiple: (ids: string[]) => void;
  onEdit: (tx: Transaction) => void;
};

export default function ExpenseList({
  transactions,
  selectedMonth,
  onPrevMonth,
  onNextMonth,
  onClearMonth,
  onNew,
  onImport,
  onDelete,
  onDeleteMultiple,
  onEdit,
}: Props) {
  const t = useT();
  const te = t.expense;
  const addToast = useUIStore((s) => s.addToast);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectMode = selectedIds.size > 0;

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleRowClick = useCallback((e: React.MouseEvent, tx: Transaction) => {
    if (e.metaKey || e.ctrlKey || selectMode) {
      toggleSelect(tx.id);
    } else {
      onEdit(tx);
    }
  }, [selectMode, toggleSelect, onEdit]);

  const handleBulkDelete = useCallback(() => {
    onDeleteMultiple([...selectedIds]);
    setSelectedIds(new Set());
  }, [selectedIds, onDeleteMultiple]);

  const monthLabel = useMemo(() => {
    if (!selectedMonth) return te.allPeriod;
    const [y, m] = selectedMonth.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(t.date.locale, { year: "numeric", month: "long" });
  }, [selectedMonth, t.date.locale, te.allPeriod]);

  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" || key === "amount" ? "desc" : "asc");
    }
  };

  const sorted = useMemo(() => {
    return [...transactions].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") cmp = a.date.localeCompare(b.date);
      else if (sortKey === "amount") cmp = a.amount - b.amount;
      else cmp = (a[sortKey] ?? "").localeCompare(b[sortKey] ?? "");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [transactions, sortKey, sortDir]);

  const handleExportCsv = useCallback(async () => {
    const header = [te.date, te.description, te.category, te.account, "type", te.amount].join(",");
    const rows = sorted.map((tx) =>
      [tx.date, `"${tx.description.replace(/"/g, '""')}"`, `"${tx.category.replace(/"/g, '""')}"`, `"${tx.account.replace(/"/g, '""')}"`, tx.type, tx.amount].join(",")
    );
    const csv = "﻿" + [header, ...rows].join("\r\n");
    const filename = `flote-expenses${selectedMonth ? `-${selectedMonth}` : ""}.csv`;
    try {
      const dataDir = await appDataDir();
      const exportsDir = await join(dataDir, "exports");
      if (!(await exists(exportsDir))) {
        await mkdir(exportsDir, { recursive: true });
      }
      const filePath = await join(exportsDir, filename);
      await writeTextFile(filePath, csv);
      await revealItemInDir(filePath);
      addToast("success", filename);
    } catch (err) {
      addToast("error", String(err));
    }
  }, [sorted, selectedMonth, te, addToast]);

  const incomeTotal = transactions
    .filter((x) => x.type === "income")
    .reduce((s, x) => s + x.amount, 0);
  const expenseTotal = transactions
    .filter((x) => x.type === "expense")
    .reduce((s, x) => s + x.amount, 0);
  const balance = incomeTotal - expenseTotal;

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        {selectMode ? (
          <>
            <span className={styles.selectCount}>{te.selectedCount(selectedIds.size)}</span>
            <span className={styles.toolbarSpacer} />
            <button className={`${styles.iconBtn} ${styles.deleteBtn2}`} onClick={handleBulkDelete}>
              {te.delete}
            </button>
            <button className={styles.iconBtn} onClick={() => setSelectedIds(new Set())}>
              {te.cancel}
            </button>
          </>
        ) : (
          <>
            <button className={styles.monthNavBtn} onClick={onPrevMonth}>‹</button>
            <span className={styles.monthLabel}>{monthLabel}</span>
            <button
              className={styles.monthNavBtn}
              onClick={onNextMonth}
              disabled={!selectedMonth}
            >›</button>
            {selectedMonth && (
              <button className={styles.allPeriodBtn} onClick={onClearMonth}>
                {te.allPeriod}
              </button>
            )}
            <span className={styles.toolbarSpacer} />
            <button className={styles.iconBtn} onClick={handleExportCsv} title={te.exportCsv} disabled={transactions.length === 0}>
              ↓ {te.exportCsv}
            </button>
            <button className={styles.iconBtn} onClick={onImport} title={te.importTitle}>
              ↑ {te.importCsv}
            </button>
            <button className={`${styles.iconBtn} ${styles.newBtn}`} onClick={onNew}>
              {te.newTransaction}
            </button>
          </>
        )}
      </div>

      <div className={styles.listWrap}>
        {transactions.length === 0 ? (
          <div className={styles.emptyMsg}>{te.noData}</div>
        ) : (
          <table className={styles.table}>
            <thead className={styles.thead}>
              <tr>
                {(["date", "description", "category", "account"] as SortKey[]).map((key) => (
                  <th
                    key={key}
                    className={styles.thSortable}
                    onClick={() => handleSort(key)}
                  >
                    {te[key as keyof typeof te] as string}
                    {sortKey === key && <span className={styles.sortArrow}>{sortDir === "asc" ? " ▲" : " ▼"}</span>}
                  </th>
                ))}
                <th
                  className={`${styles.thSortable} ${styles.thRight}`}
                  onClick={() => handleSort("amount")}
                >
                  {te.amount}
                  {sortKey === "amount" && <span className={styles.sortArrow}>{sortDir === "asc" ? " ▲" : " ▼"}</span>}
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sorted.map((tx) => {
                const isSelected = selectedIds.has(tx.id);
                return (
                  <tr
                    key={tx.id}
                    className={`${styles.row} ${isSelected ? styles.rowSelected : ""}`}
                    onClick={(e) => handleRowClick(e, tx)}
                    style={{ cursor: "pointer" }}
                  >
                    <td className={styles.td}>
                      {selectMode && (
                        <span className={styles.checkbox}>{isSelected ? "☑" : "☐"}</span>
                      )}
                      {tx.date}
                    </td>
                    <td className={styles.td} title={tx.description}>{tx.description}</td>
                    <td className={styles.td} title={tx.category}>{tx.category}</td>
                    <td className={styles.td} title={tx.account}>{tx.account}</td>
                    <td
                      className={`${styles.tdAmount} ${
                        tx.type === "income" ? styles.amountIncome : styles.amountExpense
                      }`}
                    >
                      {tx.type === "income" ? "+" : "-"}{formatAmount(tx.amount)}
                    </td>
                    <td className={styles.deleteCell}>
                      {!selectMode && (
                        <button
                          className={styles.deleteBtn}
                          onClick={(e) => { e.stopPropagation(); onDelete(tx.id); }}
                          title={te.delete}
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className={styles.footer}>
        <span className={styles.footerItem}>
          <span className={styles.footerLabel}>{te.incomeTotal}</span>
          <span className={styles.footerIncome}>{formatAmount(incomeTotal)}</span>
        </span>
        <span className={styles.footerItem}>
          <span className={styles.footerLabel}>{te.expenseTotal}</span>
          <span className={styles.footerExpense}>{formatAmount(expenseTotal)}</span>
        </span>
        <span className={styles.footerItem}>
          <span className={styles.footerLabel}>{te.balance}</span>
          <span className={balance >= 0 ? styles.footerBalance : styles.footerBalanceNeg}>
            {balance >= 0 ? "+" : ""}{formatAmount(balance)}
          </span>
        </span>
      </div>
    </div>
  );
}
