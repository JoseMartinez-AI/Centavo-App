import React from 'react';
import { Receipt, PlusCircle } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No hay transacciones registradas',
  description = 'Aún no has registrado ingresos ni gastos. Comienza agregando tu primer movimiento para ver estadísticas y controlar tu presupuesto.',
  actionText = 'Registrar Primer Movimiento',
  onAction,
}) => {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Receipt size={32} />
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{description}</p>
      {onAction && (
        <button type="button" className="btn-action-primary" onClick={onAction}>
          <PlusCircle size={18} />
          <span>{actionText}</span>
        </button>
      )}
    </div>
  );
};
