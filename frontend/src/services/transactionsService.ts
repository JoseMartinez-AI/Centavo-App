import { Transaction, FinancialSummary } from '../types/transaction';

const TX_STORAGE_KEY = 'centavo_transactions';

function mapBackendTx(backendTx: {
  id: string;
  amount: number;
  category: string;
  date: string;
  description?: string;
  type?: string;
}): Transaction {
  const catRaw = backendTx.category || 'comida';
  const catName = catRaw.charAt(0).toUpperCase() + catRaw.slice(1);
  return {
    id: backendTx.id,
    title: backendTx.description || catName,
    amount: Number(backendTx.amount),
    type: backendTx.type === 'ingreso' ? 'INCOME' : 'EXPENSE',
    category: {
      id: catRaw.toLowerCase(),
      name: catName,
    },
    date: backendTx.date ? backendTx.date.split('T')[0] : new Date().toISOString().split('T')[0],
  };
}

export const transactionsService = {
  /**
   * Obtiene la lista de transacciones del microservicio transactions-service.
   */
  async getTransactions(): Promise<Transaction[]> {
    const txUrl = import.meta.env.VITE_TRANSACTIONS_SERVICE_URL || 'http://localhost:4002';
    try {
      const res = await fetch(`${txUrl}/api/transactions`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.transactions)) {
          const list = data.transactions.map(mapBackendTx);
          localStorage.setItem(TX_STORAGE_KEY, JSON.stringify(list));
          return list;
        }
      }
    } catch {
      // Fallback a almacenamiento local si el microservicio no está disponible
    }

    const stored = localStorage.getItem(TX_STORAGE_KEY);
    if (!stored) {
      return [];
    }
    try {
      return JSON.parse(stored) as Transaction[];
    } catch {
      return [];
    }
  },

  /**
   * Registra una nueva transacción en transactions-service.
   */
  async createTransaction(tx: Omit<Transaction, 'id'>): Promise<Transaction> {
    const txUrl = import.meta.env.VITE_TRANSACTIONS_SERVICE_URL || 'http://localhost:4002';
    try {
      const res = await fetch(`${txUrl}/api/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: tx.amount,
          category: tx.category.name,
          date: tx.date,
          description: tx.title,
          type: tx.type === 'EXPENSE' ? 'gasto' : 'ingreso',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.transaction) {
          const created = mapBackendTx(data.transaction);
          const current = await this.getTransactions();
          const exists = current.some((t) => t.id === created.id);
          const updated = exists ? current : [created, ...current];
          localStorage.setItem(TX_STORAGE_KEY, JSON.stringify(updated));
          return created;
        }
      }
    } catch {
      // Fallback local
    }

    const current = await this.getTransactions();
    const newTx: Transaction = {
      ...tx,
      id: 'tx_' + Date.now(),
    };
    const updated = [newTx, ...current];
    localStorage.setItem(TX_STORAGE_KEY, JSON.stringify(updated));
    return newTx;
  },

  /**
   * Limpia las transacciones locales.
   */
  async clearTransactions(): Promise<void> {
    localStorage.removeItem(TX_STORAGE_KEY);
  },

  /**
   * Obtiene las métricas financieras calculadas con base en las transacciones registradas.
   */
  async getFinancialSummary(): Promise<FinancialSummary> {
    const transactions = await this.getTransactions();

    let totalBalance = 0;
    let monthlyExpenses = 0;

    for (const tx of transactions) {
      if (tx.type === 'INCOME') {
        totalBalance += tx.amount;
      } else {
        totalBalance -= tx.amount;
        monthlyExpenses += tx.amount;
      }
    }

    const defaultMonthlyBudget = 2500000;
    const remainingBudget = Math.max(0, defaultMonthlyBudget - monthlyExpenses);

    return {
      totalBalance,
      monthlyExpenses,
      remainingBudget: transactions.length > 0 ? remainingBudget : 0,
    };
  },
};

