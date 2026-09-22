import { useState, useEffect, useCallback } from 'react';
import { Transaction, FinancialSummary } from '../types/transaction';
import { transactionsService } from '../services/transactionsService';

interface UseTransactionsResult {
  transactions: Transaction[];
  summary: FinancialSummary;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createTransaction: (data: Omit<Transaction, 'id'>) => Promise<void>;
  clearAll: () => Promise<void>;
}

export const useTransactions = (): UseTransactionsResult => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<FinancialSummary>({
    totalBalance: 0,
    monthlyExpenses: 0,
    remainingBudget: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [txList, financialSummary] = await Promise.all([
        transactionsService.getTransactions(),
        transactionsService.getFinancialSummary(),
      ]);
      setTransactions(txList);
      setSummary(financialSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar transacciones');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createTransaction = async (data: Omit<Transaction, 'id'>) => {
    try {
      await transactionsService.createTransaction(data);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar transacción');
      throw err;
    }
  };

  const clearAll = async () => {
    await transactionsService.clearTransactions();
    await fetchData();
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    transactions,
    summary,
    isLoading,
    error,
    refetch: fetchData,
    createTransaction,
    clearAll,
  };
};
