import { normalizeCategory, isValidCategory } from './categoryService.js';
import { defaultBudgetRepository } from '../repositories/budgetRepository.js';

export class BudgetService {
  constructor(budgetRepository = defaultBudgetRepository) {
    this.budgetRepository = budgetRepository;
  }

  validateBudgetData({ category, limitAmount, period }) {
    const errors = [];

    // 1. Validación de categoría
    if (!category || typeof category !== 'string' || !category.trim()) {
      errors.push('La categoría es obligatoria');
    } else if (!isValidCategory(category)) {
      errors.push('La categoría debe tener entre 2 y 50 caracteres');
    }

    // 2. Validación de monto límite
    if (limitAmount === undefined || limitAmount === null || limitAmount === '') {
      errors.push('El monto límite es obligatorio');
    } else {
      const numAmount = Number(limitAmount);
      if (isNaN(numAmount) || !isFinite(numAmount)) {
        errors.push('El monto límite debe ser un valor numérico válido');
      } else if (numAmount <= 0) {
        errors.push('El monto límite debe ser un valor positivo mayor a 0');
      }
    }

    // 3. Validación de periodo
    if (!period || typeof period !== 'string' || !period.trim()) {
      errors.push('El período es obligatorio');
    } else {
      const trimmedPeriod = period.trim();
      if (trimmedPeriod.length < 2 || trimmedPeriod.length > 30) {
        errors.push('El período debe tener entre 2 y 30 caracteres');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async createBudget(payload) {
    const validation = this.validateBudgetData(payload || {});
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.details = validation.errors;
      throw error;
    }

    const { category, limitAmount, period, userId } = payload;
    const normalizedCategory = normalizeCategory(category);
    const normalizedPeriod = period.trim().toLowerCase();
    const parsedLimitAmount = Math.round(Number(limitAmount) * 100) / 100;

    // Verificar si ya existe un presupuesto para la misma categoría, período y usuario
    const existing = await this.budgetRepository.findByCategoryAndPeriod(
      normalizedCategory,
      normalizedPeriod,
      userId || null
    );

    if (existing) {
      const error = new Error(`Ya existe un presupuesto registrado para la categoría '${normalizedCategory}' en el período '${normalizedPeriod}'`);
      error.statusCode = 409;
      throw error;
    }

    return await this.budgetRepository.create({
      category: normalizedCategory,
      limitAmount: parsedLimitAmount,
      period: normalizedPeriod,
      userId: userId || null
    });
  }

  async getBudgets(filters = {}) {
    const { category, period, userId, limit, offset } = filters;

    const result = await this.budgetRepository.findAll({
      category: category ? normalizeCategory(category) : undefined,
      period: period ? String(period).trim().toLowerCase() : undefined,
      userId: userId || undefined,
      limit,
      offset
    });

    return {
      budgets: result.items,
      count: result.count,
      total: result.total,
      offset: result.offset,
      limit: result.limit
    };
  }

  async getBudgetById(id) {
    if (!id || typeof id !== 'string') {
      const err = new Error('El ID del presupuesto es obligatorio');
      err.statusCode = 400;
      throw err;
    }

    const budget = await this.budgetRepository.findById(id);
    if (!budget) {
      const err = new Error('Presupuesto no encontrado');
      err.statusCode = 404;
      throw err;
    }

    return budget;
  }
}

export const defaultBudgetService = new BudgetService();
