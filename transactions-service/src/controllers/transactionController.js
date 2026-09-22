import { defaultTransactionService } from '../services/transactionService.js';
import { getDefaultCategories } from '../services/categoryService.js';
import { logger } from '../utils/logger.js';

export class TransactionController {
  constructor(transactionService = defaultTransactionService) {
    this.transactionService = transactionService;
  }

  create = async (req, res) => {
    try {
      const { amount, category, date, description, type, userId } = req.body || {};

      const transaction = await this.transactionService.createTransaction({
        amount,
        category,
        date,
        description,
        type,
        userId
      });

      logger.info('Transacción registrada exitosamente', {
        transactionId: transaction.id,
        category: transaction.category,
        amount: transaction.amount
      });

      return res.status(201).json({
        message: 'Transacción registrada con éxito',
        transaction
      });
    } catch (err) {
      if (err.statusCode && err.statusCode < 500) {
        return res.status(err.statusCode).json({
          error: err.message,
          details: err.details
        });
      }

      logger.error('Error al registrar transacción', { error: err.message });
      return res.status(500).json({ error: 'Error interno del servidor al procesar la transacción' });
    }
  };

  list = async (req, res) => {
    try {
      const { category, startDate, endDate, userId, type, limit, offset } = req.query || {};

      const result = await this.transactionService.getTransactions({
        category,
        startDate,
        endDate,
        userId,
        type,
        limit,
        offset
      });

      logger.debug('Transacciones listadas con éxito', { count: result.count, total: result.total });

      return res.status(200).json({
        message: 'Transacciones obtenidas correctamente',
        ...result
      });
    } catch (err) {
      if (err.statusCode && err.statusCode < 500) {
        return res.status(err.statusCode).json({ error: err.message });
      }

      logger.error('Error al listar transacciones', { error: err.message });
      return res.status(500).json({ error: 'Error interno del servidor al listar transacciones' });
    }
  };

  getById = async (req, res) => {
    try {
      const { id } = req.params;
      const transaction = await this.transactionService.getTransactionById(id);

      return res.status(200).json({
        message: 'Transacción obtenida con éxito',
        transaction
      });
    } catch (err) {
      if (err.statusCode && err.statusCode < 500) {
        return res.status(err.statusCode).json({ error: err.message });
      }

      logger.error('Error al obtener transacción por ID', { error: err.message });
      return res.status(500).json({ error: 'Error interno del servidor al consultar la transacción' });
    }
  };

  getCategories = async (req, res) => {
    try {
      const categories = getDefaultCategories();
      return res.status(200).json({
        categories
      });
    } catch (err) {
      logger.error('Error al obtener catálogo de categorías', { error: err.message });
      return res.status(500).json({ error: 'Error interno del servidor al obtener categorías' });
    }
  };
}

export const defaultTransactionController = new TransactionController();
