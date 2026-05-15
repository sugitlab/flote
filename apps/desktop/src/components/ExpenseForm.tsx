import { useState } from "react";
import type { Transaction, TransactionType } from "@flote/types";
import { useT } from "../hooks/useT";
import styles from "./ExpenseForm.module.css";

type Props = {
  initial?: Partial<Transaction>;
  existingCategories: string[];
  existingAccounts: string[];
  onSave: (t: Transaction) => void;
  onCancel: () => void;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ExpenseForm({
  initial,
  existingCategories,
  existingAccounts,
  onSave,
  onCancel,
}: Props) {
  const t = useT();
  const te = t.expense;

  const [type, setType] = useState<TransactionType>(initial?.type ?? "expense");
  const [date, setDate] = useState(initial?.date ?? today());
  const [amount, setAmount] = useState(initial?.amount ? String(initial.amount) : "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [account, setAccount] = useState(initial?.account ?? "");

  const handleSave = () => {
    const parsed = parseInt(amount.replace(/[^\d]/g, ""), 10);
    if (!date || isNaN(parsed) || parsed <= 0) return;
    const tx: Transaction = {
      id: initial?.id ?? crypto.randomUUID(),
      date,
      amount: parsed,
      type,
      description,
      category,
      account,
      updated_at: new Date().toISOString(),
    };
    onSave(tx);
  };

  const catListId = "expense-categories-list";
  const accListId = "expense-accounts-list";

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className={styles.modal}>
        <p className={styles.title}>{initial?.id ? te.save : te.newTransaction}</p>

        <div className={styles.typeRow}>
          <button
            className={`${styles.typeBtn} ${type === "income" ? styles.typeBtnIncome : ""}`}
            onClick={() => setType("income")}
          >
            {te.income}
          </button>
          <button
            className={`${styles.typeBtn} ${type === "expense" ? styles.typeBtnExpense : ""}`}
            onClick={() => setType("expense")}
          >
            {te.expense}
          </button>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>{te.date}</label>
          <input
            type="date"
            className={styles.input}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>{te.amount} (JPY)</label>
          <input
            type="number"
            className={styles.input}
            value={amount}
            min={1}
            step={1}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>{te.description}</label>
          <input
            type="text"
            className={styles.input}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>{te.category}</label>
          <input
            type="text"
            list={catListId}
            className={styles.input}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder={te.categoryPlaceholder}
          />
          <datalist id={catListId}>
            {existingCategories.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>{te.account}</label>
          <input
            type="text"
            list={accListId}
            className={styles.input}
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            placeholder={te.accountPlaceholder}
          />
          <datalist id={accListId}>
            {existingAccounts.map((a) => <option key={a} value={a} />)}
          </datalist>
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel}>{te.cancel}</button>
          <button className={styles.saveBtn} onClick={handleSave}>{te.save}</button>
        </div>
      </div>
    </div>
  );
}
