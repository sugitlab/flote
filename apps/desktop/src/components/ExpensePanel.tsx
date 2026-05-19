import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type { Transaction } from "@flote/types";
import { useExpenseStore } from "../store/expenseStore";
import { useUIStore } from "../store/uiStore";
import ExpenseList from "./ExpenseList";
import ExpenseForm from "./ExpenseForm";
import ExpenseImport from "./ExpenseImport";
import ExpenseSankey from "./ExpenseSankey";
import ConfirmDialog from "./ConfirmDialog";
import { useT } from "../hooks/useT";
import styles from "./ExpensePanel.module.css";

const LIST_MIN = 180;
const LIST_MAX = 700;

type Props = {
  userId?: string;
};

export default function ExpensePanel({ userId }: Props) {
  const t = useT();
  const te = t.expense;

  const { transactions, fetchTransactions, saveTransaction, deleteTransaction } = useExpenseStore();
  const addToast = useUIStore((s) => s.addToast);

  const [listWidth, setListWidth] = useState<number>(() => {
    const saved = localStorage.getItem("expenseListWidth");
    return saved ? Math.min(LIST_MAX, Math.max(LIST_MIN, Number(saved))) : 320;
  });
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = listWidth;
    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const next = Math.min(LIST_MAX, Math.max(LIST_MIN, dragStartWidth.current + ev.clientX - dragStartX.current));
      setListWidth(next);
    };
    const onUp = (ev: MouseEvent) => {
      isDragging.current = false;
      const next = Math.min(LIST_MAX, Math.max(LIST_MIN, dragStartWidth.current + ev.clientX - dragStartX.current));
      localStorage.setItem("expenseListWidth", String(next));
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [listWidth]);

  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);

  const fetchForMonth = useCallback((month: string | null) => {
    if (!month) {
      const now = new Date();
      const past = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      const from = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, "0")}-01`;
      fetchTransactions(userId, from);
    } else {
      const [y, m] = month.split("-").map(Number);
      const from = `${month}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const to = `${month}-${String(lastDay).padStart(2, "0")}`;
      fetchTransactions(userId, from, to);
    }
  }, [userId, fetchTransactions]);

  const handlePrevMonth = useCallback(() => {
    setSelectedMonth((prev) => {
      const base = prev ?? new Date().toISOString().slice(0, 7);
      const [y, m] = base.split("-").map(Number);
      const d = new Date(y, m - 2, 1);
      const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      fetchForMonth(next);
      return next;
    });
  }, [fetchForMonth]);

  const handleNextMonth = useCallback(() => {
    setSelectedMonth((prev) => {
      if (!prev) return prev;
      const [y, m] = prev.split("-").map(Number);
      const d = new Date(y, m, 1);
      const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      fetchForMonth(next);
      return next;
    });
  }, [fetchForMonth]);

  const handleClearMonth = useCallback(() => {
    setSelectedMonth(null);
    fetchForMonth(null);
  }, [fetchForMonth]);

  useEffect(() => {
    fetchForMonth(selectedMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = useCallback(async (tx: Transaction) => {
    try {
      await saveTransaction(tx, userId);
      setShowForm(false);
      setEditingTx(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? JSON.stringify(e);
      addToast("error", `保存失敗: ${msg}`);
    }
  }, [userId, saveTransaction, addToast]);

  const handleImport = useCallback(async (rows: Transaction[]) => {
    try {
      for (const row of rows) {
        await saveTransaction(row, userId);
      }
      setShowImport(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? JSON.stringify(e);
      addToast("error", `インポート失敗: ${msg}`);
    }
  }, [userId, saveTransaction, addToast]);

  const handleDeleteConfirm = useCallback(async () => {
    try {
      for (const id of pendingDeleteIds) {
        await deleteTransaction(id);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? JSON.stringify(e);
      addToast("error", `削除失敗: ${msg}`);
    }
    setPendingDeleteIds([]);
  }, [pendingDeleteIds, deleteTransaction, addToast]);

  const existingCategories = useMemo(
    () => Array.from(new Set(transactions.map((x) => x.category).filter(Boolean))),
    [transactions]
  );
  const existingAccounts = useMemo(
    () => Array.from(new Set(transactions.map((x) => x.account).filter(Boolean))),
    [transactions]
  );

  // Filter transactions for the sankey (all currently loaded)
  const sankeyTx = useMemo(() => transactions, [transactions]);

  return (
    <div className={styles.root}>
      <div className={styles.listPane} style={{ width: listWidth }}>
        <ExpenseList
          transactions={transactions}
          selectedMonth={selectedMonth}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onClearMonth={handleClearMonth}
          onNew={() => setShowForm(true)}
          onImport={() => setShowImport(true)}
          onDelete={(id) => setPendingDeleteIds([id])}
          onDeleteMultiple={(ids) => setPendingDeleteIds(ids)}
          onEdit={(tx) => setEditingTx(tx)}
        />
      </div>
      <div className={styles.divider} onMouseDown={handleDividerMouseDown} />
      <div className={styles.contentPane}>
        <ExpenseSankey transactions={sankeyTx} />
      </div>

      {showForm && (
        <ExpenseForm
          existingCategories={existingCategories}
          existingAccounts={existingAccounts}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}

      {editingTx && (
        <ExpenseForm
          initial={editingTx}
          existingCategories={existingCategories}
          existingAccounts={existingAccounts}
          onSave={handleSave}
          onCancel={() => setEditingTx(null)}
        />
      )}

      {showImport && (
        <ExpenseImport
          onImport={handleImport}
          onCancel={() => setShowImport(false)}
        />
      )}

      {pendingDeleteIds.length > 0 && (
        <ConfirmDialog
          message={pendingDeleteIds.length === 1 ? te.deleteConfirm : te.selectedCount(pendingDeleteIds.length) + "を削除しますか？"}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setPendingDeleteIds([])}
        />
      )}
    </div>
  );
}
