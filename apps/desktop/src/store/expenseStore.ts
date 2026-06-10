import { create } from "zustand";
import type { Transaction } from "@flote/types";
import type { TransactionRepository } from "@flote/api-client";

type ExpenseStore = {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  repo: TransactionRepository | null;
  initStore: (repo: TransactionRepository) => void;
  fetchTransactions: (userId?: string, from?: string, to?: string) => Promise<void>;
  saveTransaction: (t: Transaction, userId?: string) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
};

export const useExpenseStore = create<ExpenseStore>((set, get) => ({
  transactions: [],
  loading: false,
  error: null,
  repo: null,

  initStore: (repo: TransactionRepository) => {
    set({ repo });
  },

  fetchTransactions: async (userId?: string, from?: string, to?: string) => {
    const { repo } = get();
    if (!repo) return;
    set({ loading: true, error: null });
    try {
      // Default to the last 12 months — an unbounded fetch reads the entire
      // (ever-growing) transactions table on every sync. Screens that need
      // older data pass an explicit range.
      if (!from) {
        const now = new Date();
        const past = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        from = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, "0")}-01`;
      }
      const transactions = await repo.getTransactions(userId ?? "", from, to);
      set({ transactions, loading: false });
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  saveTransaction: async (t: Transaction, userId?: string) => {
    const { repo } = get();
    if (!repo) return;
    const prev = get().transactions;
    const exists = prev.some((x) => x.id === t.id);
    const optimistic = exists
      ? prev.map((x) => (x.id === t.id ? t : x))
      : [t, ...prev];
    set({ transactions: optimistic });

    try {
      await repo.saveTransaction(t, userId ?? "");
    } catch (e) {
      set({ transactions: prev });
      throw e;
    }
  },

  deleteTransaction: async (id: string) => {
    const { repo } = get();
    if (!repo) return;
    const prev = get().transactions;
    set({ transactions: prev.filter((x) => x.id !== id) });

    try {
      await repo.deleteTransaction(id);
    } catch (e) {
      set({ transactions: prev });
      throw e;
    }
  },
}));
