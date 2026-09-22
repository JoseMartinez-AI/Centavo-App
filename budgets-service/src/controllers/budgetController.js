import { defaultBudgetService } from '../services/budgetService.js';
import { getDefaultCategories } from '../services/categoryService.js';
import { logger } from '../utils/logger.js';

export class BudgetController {
  constructor(budgetService = defaultBudgetService) {
    this.budgetService = budgetService;
  }

  create = async (req, res) => {
    try {
      const { category, limitAmount, period, userId } = req.body || {};

      const budget = await this.budgetService.createBudget({
        category,
        limitAmount,
        period,
        userId
      });

      logger.info('Presupuesto creado exitosamente', {
        budgetId: budget.id,
        category: budget.category,
        limitAmount: budget.limitAmount,
        period: budget.period
      });

      return res.status(201).json({
        message: 'Presupuesto creado con éxito',
        budget
      });
    } catch (err) {
      if (err.statusCode && err.statusCode < 500) {
        return res.status(err.statusCode).json({
          error: err.message,
          details: err.details
        });
      }

      logger.error('Error al crear presupuesto', { error: err.message });
      return res.status(500).json({ error: 'Error interno del servidor al procesar el presupuesto' });
    }
  };

  list = async (req, res) => {
    try {
      const { category, period, userId, limit, offset } = req.query || {};

      const result = await this.budgetService.getBudgets({
        category,
        period,
        userId,
        limit,
        offset
      });

      logger.debug('Presupuestos listados con éxito', { count: result.count, total: result.total });

      return res.status(200).json({
        message: 'Presupuestos obtenidos correctamente',
        ...result
      });
    } catch (err) {
      if (err.statusCode && err.statusCode < 500) {
        return res.status(err.statusCode).json({ error: err.message });
      }

      logger.error('Error al listar presupuestos', { error: err.message });
      return res.status(500).json({ error: 'Error interno del servidor al listar presupuestos' });
    }
  };

  getById = async (req, res) => {
    try {
      const { id } = req.params;
      const budget = await this.budgetService.getBudgetById(id);

      return res.status(200).json({
        message: 'Presupuesto obtenido con éxito',
        budget
      });
    } catch (err) {
      if (err.statusCode && err.statusCode < 500) {
        return res.status(err.statusCode).json({ error: err.message });
      }

      logger.error('Error al consultar presupuesto por ID', { error: err.message });
      return res.status(500).json({ error: 'Error interno del servidor al consultar el presupuesto' });
    }
  };

  getCategories = async (req, res) => {
    try {
      const categories = getDefaultCategories();
      return res.status(200).json({
        categories
      });
    } catch (err) {
      logger.error('Error al obtener categorías de presupuesto', { error: err.message });
      return res.status(500).json({ error: 'Error interno al consultar las categorías' });
    }
  };
}

export const defaultBudgetController = new BudgetController();
