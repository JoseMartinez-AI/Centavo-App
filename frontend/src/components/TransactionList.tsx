import React from 'react';
import { Plus, ArrowUpRight, ArrowDownRight, RotateCcw } from 'lucide-react';
import { Transaction } from '../types/transaction';
import { EmptyState } from './EmptyState';

interface TransactionListProps {
  transactions: Transaction[];
  isLoading: boolean;
  onNewTransaction?: () => void;
  onClearTransactions?: () => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  isLoading,
  onNewTransaction,
  onClearTransactions,
}) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="section-panel">
      <div className="section-topbar">
        <div className="section-title-wrap">
          <h2 className="section-title">Movimientos Recientes</h2>
          <span className="badge-count">
            {transactions.length} transacciones
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {transactions.length > 0 && onClearTransactions && (
            <button
              type="button"
              onClick={onClearTransactions}
              title="Restablecer al listado vacío"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.6rem 0.85rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
                fontWeight: 500,
              }}
            >
              <RotateCcw size={14} />
              <span>Vaciar lista</span>
            </button>
          )}

          <button
            type="button"
            className="btn-action-primary"
            onClick={onNewTransaction}
          >
            <Plus size={16} />
            <span>Nueva Transacción</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Cargando movimientos...
        </div>
      ) : transactions.length === 0 ? (
        <EmptyState onAction={onNewTransaction} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {transactions.map((tx) => {
            const isIncome = tx.type === 'INCOME';
            return (
              <div
                key={tx.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-card)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: isIncome ? 'var(--primary-light)' : 'var(--danger-bg)',
                      color: isIncome ? 'var(--primary)' : 'var(--danger)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isIncome ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                      {tx.title}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem' }}>
                      <span>{tx.category.name}</span>
                      <span>•</span>
                      <span>{tx.date}</span>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    fontWeight: 700,
                    fontSize: '1rem',
                    color: isIncome ? 'var(--primary)' : 'var(--danger)',
                  }}
                >
                  {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
