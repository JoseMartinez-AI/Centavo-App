import React from 'react';
import { Wallet, TrendingDown, PiggyBank } from 'lucide-react';
import { FinancialSummary } from '../types/transaction';

interface SummaryCardsProps {
  summary: FinancialSummary;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ summary }) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="summary-grid">
      <div className="summary-card">
        <div>
          <div className="summary-label">Saldo Total</div>
          <div className="summary-value">{formatCurrency(summary.totalBalance)}</div>
        </div>
        <div className="summary-icon-box icon-box-primary">
          <Wallet size={24} />
        </div>
      </div>

      <div className="summary-card">
        <div>
          <div className="summary-label">Gastos del Mes</div>
          <div className="summary-value">{formatCurrency(summary.monthlyExpenses)}</div>
        </div>
        <div className="summary-icon-box icon-box-danger">
          <TrendingDown size={24} />
        </div>
      </div>

      <div className="summary-card">
        <div>
          <div className="summary-label">Presupuesto Restante</div>
          <div className="summary-value">{formatCurrency(summary.remainingBudget)}</div>
        </div>
        <div className="summary-icon-box icon-box-warning">
          <PiggyBank size={24} />
        </div>
      </div>
    </div>
  );
};
