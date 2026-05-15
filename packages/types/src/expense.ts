export type TransactionType = "income" | "expense";

export type Transaction = {
  id: string;
  user_id?: string;
  date: string;           // YYYY-MM-DD
  amount: number;         // always positive integer (JPY)
  type: TransactionType;
  description: string;
  category: string;
  account: string;
  updated_at: string;
};

export type TransactionInsert = Omit<Transaction, "updated_at">;
