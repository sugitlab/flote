import type { Transaction } from "@flote/types";
import type { TransactionRepository } from "../types";
import { getSupabase } from "../../supabase";

function toTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: String(row.id ?? ""),
    date: String(row.date ?? ""),
    amount: Number(row.amount ?? 0),
    type: (row.type === "income" ? "income" : "expense") as Transaction["type"],
    description: String(row.description ?? ""),
    category: String(row.category ?? ""),
    account: String(row.account ?? ""),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

export class SupabaseTransactionRepository implements TransactionRepository {
  async getTransactions(userId: string, from?: string, to?: string): Promise<Transaction[]> {
    const supabase = getSupabase();
    let query = supabase
      .from("transactions")
      .select("id, date, amount, type, description, category, account, updated_at")
      .eq("user_id", userId);
    if (from) query = query.gte("date", from);
    if (to) query = query.lte("date", to);
    query = query.order("date", { ascending: false });
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(toTransaction);
  }

  async saveTransaction(t: Transaction, userId: string): Promise<Transaction> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("transactions")
      .upsert({
        id: t.id,
        date: t.date,
        amount: t.amount,
        type: t.type,
        description: t.description,
        category: t.category,
        account: t.account,
        updated_at: t.updated_at,
        user_id: userId,
      })
      .select()
      .single();
    if (error) throw error;
    return toTransaction(data);
  }

  async deleteTransaction(id: string): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) throw error;
  }
}
