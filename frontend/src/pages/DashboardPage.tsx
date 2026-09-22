import React, { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { SummaryCards } from '../components/SummaryCards';
import { TransactionList } from '../components/TransactionList';
import { TransactionModal } from '../components/TransactionModal';
import { useTransactions } from '../hooks/useTransactions';

export const DashboardPage: React.FC = () => {
  const { transactions, summary, isLoading, createTransaction, clearAll } = useTransactions();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="app-container">
      <Navbar />

      <main className="dashboard-main">
        <header className="dashboard-header">
          <h1 className="dashboard-title">Panel General</h1>
          <p className="dashboard-subtitle">
            Resumen de tus movimientos y balance personal del mes actual.
          </p>
        </header>

        <SummaryCards summary={summary} />

        <TransactionList
          transactions={transactions}
          isLoading={isLoading}
          onNewTransaction={() => setIsModalOpen(true)}
          onClearTransactions={clearAll}
        />
      </main>

      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={async (data) => {
          await createTransaction(data);
        }}
      />
    </div>
  );
};
