import { create } from "zustand";
import type { Transaction } from "@flote/types";
import { supabase } from "../lib/supabase";

type ExpenseStore = {
  transactions: Transaction[];
  loading: boolean;
  fetchTransactions: (userId: string, from?: string, to?: string) => Promise<void>;
};

function toTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    date: row.date as string,
    amount: row.amount as number,
    type: row.type as "income" | "expense",
    description: (row.description as string) ?? "",
    category: (row.category as string) ?? "",
    account: (row.account as string) ?? "",
    updated_at: row.updated_at as string,
  };
}

export const useExpenseStore = create<ExpenseStore>((set) => ({
  transactions: [],
  loading: false,

  fetchTransactions: async (userId: string, from?: string, to?: string) => {
    set({ loading: true });
    try {
      // Default to the last 12 months — an unbounded fetch reads the entire
      // (ever-growing) transactions table on every sync.
      if (!from) {
        const now = new Date();
        const past = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        from = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, "0")}-01`;
      }
      let query = supabase
        .from("transactions")
        .select("id, user_id, date, amount, type, description, category, account, updated_at")
        .eq("user_id", userId)
        .order("date", { ascending: false });
      if (from) query = query.gte("date", from);
      if (to) query = query.lte("date", to);
      const { data, error } = await query;
      if (error) throw error;
      set({ transactions: (data ?? []).map(toTransaction) });
    } finally {
      set({ loading: false });
    }
  },
}));
