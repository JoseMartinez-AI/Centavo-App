import React, { useState } from 'react';
import { X, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { TransactionType } from '../types/transaction';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    amount: number;
    type: TransactionType;
    category: { id: string; name: string };
    date: string;
    notes?: string;
  }) => Promise<void>;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [categoryName, setCategoryName] = useState('Comida');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!title.trim() || isNaN(numAmount) || numAmount <= 0) return;

    try {
      setIsSubmitting(true);
      await onSubmit({
        title: title.trim(),
        amount: numAmount,
        type,
        category: {
          id: categoryName.toLowerCase(),
          name: categoryName,
        },
        date: new Date().toISOString().split('T')[0],
      });
      setTitle('');
      setAmount('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '460px',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Registrar Movimiento
          </h3>
          <button
            onClick={onClose}
            style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {/* Tipo de Transacción */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <button
              type="button"
              onClick={() => setType('EXPENSE')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                padding: '0.65rem',
                borderRadius: 'var(--radius-md)',
                border: type === 'EXPENSE' ? '2px solid var(--danger)' : '1px solid var(--border)',
                backgroundColor: type === 'EXPENSE' ? 'var(--danger-bg)' : 'transparent',
                color: type === 'EXPENSE' ? 'var(--danger)' : 'var(--text-secondary)',
                fontWeight: 600,
              }}
            >
              <ArrowDownRight size={18} />
              <span>Gasto</span>
            </button>

            <button
              type="button"
              onClick={() => setType('INCOME')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                padding: '0.65rem',
                borderRadius: 'var(--radius-md)',
                border: type === 'INCOME' ? '2px solid var(--primary)' : '1px solid var(--border)',
                backgroundColor: type === 'INCOME' ? 'var(--primary-light)' : 'transparent',
                color: type === 'INCOME' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: 600,
              }}
            >
              <ArrowUpRight size={18} />
              <span>Ingreso</span>
            </button>
          </div>

          <div className="form-group">
            <label className="form-label">Concepto o Descripción</label>
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '1rem' }}
              placeholder="Ej. Supermercado, Almuerzo, Salario"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Monto ($)</label>
            <input
              type="number"
              min="1"
              step="any"
              className="form-input"
              style={{ paddingLeft: '1rem' }}
              placeholder="Ej. 45000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Categoría</label>
            <select
              className="form-input"
              style={{ paddingLeft: '1rem' }}
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
            >
              <option value="Comida">Comida</option>
              <option value="Alimentación">Alimentación</option>
              <option value="Transporte">Transporte</option>
              <option value="Servicios">Servicios</option>
              <option value="Entretenimiento">Entretenimiento</option>
              <option value="Salud">Salud</option>
              <option value="Ingreso Salarial">Ingreso Salarial</option>
              <option value="Otros">Otros</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.75rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                fontWeight: 600,
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary"
              style={{ flex: 1 }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
