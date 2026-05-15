import type { Transaction } from "@flote/types";
import type { TransactionRepository } from "../types";
import { getTransactions, saveTransaction, deleteTransaction } from "../../sqlite-storage";

export class LocalTransactionRepository implements TransactionRepository {
  async getTransactions(_userId: string, from?: string, to?: string): Promise<Transaction[]> {
    return getTransactions(from, to);
  }

  async saveTransaction(t: Transaction, _userId: string): Promise<Transaction> {
    await saveTransaction(t);
    return t;
  }

  async deleteTransaction(id: string): Promise<void> {
    await deleteTransaction(id);
  }
}
