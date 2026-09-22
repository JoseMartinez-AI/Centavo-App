import { normalizeCategory, isValidCategory } from './categoryService.js';
import { defaultTransactionRepository } from '../repositories/transactionRepository.js';

export class TransactionService {
  constructor(transactionRepository = defaultTransactionRepository) {
    this.transactionRepository = transactionRepository;
  }

  validateTransactionData({ amount, category, date, type }) {
    const errors = [];

    // 1. Validación de monto
    if (amount === undefined || amount === null || amount === '') {
      errors.push('El monto es obligatorio');
    } else {
      const numAmount = Number(amount);
      if (isNaN(numAmount) || !isFinite(numAmount)) {
        errors.push('El monto debe ser un valor numérico válido');
      } else if (numAmount <= 0) {
        errors.push('El monto debe ser un valor positivo mayor a 0');
      }
    }

    // 2. Validación de categoría
    if (!category || typeof category !== 'string' || !category.trim()) {
      errors.push('La categoría es obligatoria');
    } else if (!isValidCategory(category)) {
      errors.push('La categoría debe tener entre 2 y 50 caracteres');
    }

    // 3. Validación de fecha — se exige formato ISO 8601 o YYYY-MM-DD estricto
    if (!date) {
      errors.push('La fecha es obligatoria');
    } else {
      const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;
      const dateStr = String(date).trim();
      if (!ISO_DATE_REGEX.test(dateStr)) {
        errors.push('La fecha proporcionada no tiene un formato válido (se esperaba ISO 8601 o YYYY-MM-DD)');
      } else {
        const parsedDate = new Date(dateStr);
        if (isNaN(parsedDate.getTime())) {
          errors.push('La fecha proporcionada no tiene un formato válido');
        }
      }
    }

    // 4. Validación de tipo (opcional, por defecto 'gasto')
    if (type !== undefined && type !== null) {
      const normalizedType = String(type).trim().toLowerCase();
      if (normalizedType !== 'gasto' && normalizedType !== 'ingreso') {
        errors.push("El tipo de transacción debe ser 'gasto' o 'ingreso'");
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async createTransaction(payload) {
    const validation = this.validateTransactionData(payload);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.details = validation.errors;
      throw error;
    }

    const { amount, category, date, description, type, userId } = payload;
    const normalizedCategory = normalizeCategory(category);
    const parsedAmount = Math.round(Number(amount) * 100) / 100; // Redondear a 2 decimales

    return await this.transactionRepository.create({
      amount: parsedAmount,
      category: normalizedCategory,
      date,
      description,
      type: type ? String(type).trim().toLowerCase() : 'gasto',
      userId
    });
  }

  async getTransactions(filters = {}) {
    const { category, startDate, endDate, userId, type, limit, offset } = filters;

    if (startDate && isNaN(new Date(startDate).getTime())) {
      const err = new Error('startDate no es una fecha válida');
      err.statusCode = 400;
      throw err;
    }

    if (endDate && isNaN(new Date(endDate).getTime())) {
      const err = new Error('endDate no es una fecha válida');
      err.statusCode = 400;
      throw err;
    }

    const result = await this.transactionRepository.findAll({
      category: category ? normalizeCategory(category) : undefined,
      startDate,
      endDate,
      userId,
      type,
      limit,
      offset
    });

    const totalAmount = result.items.reduce((acc, curr) => acc + curr.amount, 0);

    return {
      transactions: result.items,
      count: result.items.length,
      total: result.total,
      totalAmount: Math.round(totalAmount * 100) / 100
    };
  }

  async getTransactionById(id) {
    if (!id) {
      const err = new Error('ID no proporcionado');
      err.statusCode = 400;
      throw err;
    }

    const tx = await this.transactionRepository.findById(id);
    if (!tx) {
      const err = new Error('Transacción no encontrada');
      err.statusCode = 404;
      throw err;
    }

    return tx;
  }
}

export const defaultTransactionService = new TransactionService();
