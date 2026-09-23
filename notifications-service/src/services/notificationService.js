import { defaultNotificationRepository } from '../repositories/notificationRepository.js';
import { defaultBudgetClient } from './budgetClient.js';
import { defaultTransactionClient } from './transactionClient.js';
import { logger } from '../utils/logger.js';

export function normalizeCategory(category) {
  if (!category || typeof category !== 'string') return '';
  return category
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function getMonthDateRange(dateInput) {
  const d = dateInput ? new Date(dateInput) : new Date();
  const validDate = isNaN(d.getTime()) ? new Date() : d;

  const year = validDate.getUTCFullYear();
  const month = validDate.getUTCMonth();

  const startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)).toISOString();
  const lastDay = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
  const endDate = lastDay.toISOString();

  return { startDate, endDate };
}

export class NotificationService {
  constructor({
    notificationRepository = defaultNotificationRepository,
    budgetClient = defaultBudgetClient,
    transactionClient = defaultTransactionClient
  } = {}) {
    this.notificationRepository = notificationRepository;
    this.budgetClient = budgetClient;
    this.transactionClient = transactionClient;
  }

  validateTransactionEvent(payload) {
    const errors = [];
    if (!payload || typeof payload !== 'object') {
      return { isValid: false, errors: ['El cuerpo del evento es obligatorio y debe ser un objeto'] };
    }

    const { amount, category, type } = payload;

    // Validación de monto
    if (amount === undefined || amount === null || amount === '') {
      errors.push('El monto de la transacción es obligatorio');
    } else {
      const numAmount = Number(amount);
      if (isNaN(numAmount) || !isFinite(numAmount)) {
        errors.push('El monto debe ser un valor numérico válido');
      } else if (numAmount <= 0) {
        errors.push('El monto debe ser un valor positivo mayor a 0');
      }
    }

    // Validación de categoría
    if (!category || typeof category !== 'string' || !category.trim()) {
      errors.push('La categoría de la transacción es obligatoria');
    }

    // Validación de tipo (opcional, por defecto 'gasto')
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

  async processTransactionEvent(eventPayload) {
    const validation = this.validateTransactionEvent(eventPayload);
    if (!validation.isValid) {
      const err = new Error(validation.errors.join(', '));
      err.statusCode = 400;
      err.details = validation.errors;
      throw err;
    }

    const {
      id,
      transactionId,
      amount,
      category,
      date,
      userId = null,
      type = 'gasto',
      description = '',
      currentSpent: explicitCurrentSpent,
      budgetLimit: explicitBudgetLimit
    } = eventPayload;

    const actualTxId = transactionId || id || null;
    const normCategory = normalizeCategory(category);
    const numAmount = Math.round(Number(amount) * 100) / 100;
    const txType = String(type).trim().toLowerCase();

    // 1. Transacciones que no sean de gasto no generan sobregasto
    if (txType === 'ingreso') {
      logger.info("Transacción de tipo 'ingreso' ignorada para alertas de sobregasto", {
        transactionId: actualTxId,
        category: normCategory
      });
      return {
        processed: true,
        alertGenerated: false,
        reason: "Las transacciones de tipo 'ingreso' no generan alertas de sobregasto",
        budgetStatus: null,
        alert: null
      };
    }

    // 2. Determinar período y consultar presupuesto
    const { startDate, endDate } = getMonthDateRange(date);
    let budget = null;

    if (explicitBudgetLimit !== undefined && explicitBudgetLimit !== null) {
      budget = {
        category: normCategory,
        limitAmount: Number(explicitBudgetLimit),
        period: 'mensual',
        userId
      };
    } else {
      budget = await this.budgetClient.getBudgetByCategory({
        category: normCategory,
        period: 'mensual',
        userId
      });
    }

    // Si no hay presupuesto fijado para esta categoría, no se puede generar alerta
    if (!budget || typeof budget.limitAmount !== 'number' || budget.limitAmount <= 0) {
      logger.info('No se encontró presupuesto activo para la categoría', {
        category: normCategory,
        userId
      });
      return {
        processed: true,
        alertGenerated: false,
        reason: `No hay presupuesto configurado para la categoría '${normCategory}'`,
        budgetStatus: null,
        alert: null
      };
    }

    const budgetLimit = Math.round(budget.limitAmount * 100) / 100;

    // 3. Determinar gasto acumulado en el período
    let totalSpent = 0;

    if (explicitCurrentSpent !== undefined && explicitCurrentSpent !== null) {
      // Si se pasó explícitamente el gasto acumulado previo o total
      const prevSpent = Number(explicitCurrentSpent);
      // Si el gasto provisto ya incluye el monto actual o es acumulado previo
      totalSpent = Math.round((prevSpent + (eventPayload.includesCurrentTransaction ? 0 : numAmount)) * 100) / 100;
    } else {
      const txData = await this.transactionClient.getSpentForCategory({
        category: normCategory,
        startDate,
        endDate,
        userId
      });

      if (txData && typeof txData.totalAmount === 'number') {
        const alreadyInHistory = actualTxId && txData.transactions && txData.transactions.some(t => t.id === actualTxId);
        if (alreadyInHistory) {
          totalSpent = txData.totalAmount;
        } else {
          totalSpent = Math.round((txData.totalAmount + numAmount) * 100) / 100;
        }
      } else {
        // Fallback cuando transactions-service no está disponible
        totalSpent = numAmount;
      }
    }

    const percentageUsed = Math.round((totalSpent / budgetLimit) * 10000) / 100;
    const isExceeded = totalSpent > budgetLimit;
    const excessAmount = isExceeded ? Math.round((totalSpent - budgetLimit) * 100) / 100 : 0;

    const budgetStatus = {
      category: normCategory,
      limitAmount: budgetLimit,
      currentSpent: totalSpent,
      percentageUsed,
      isExceeded,
      excessAmount
    };

    // 4. Generación de alerta si excede presupuesto
    if (isExceeded) {
      const severity = percentageUsed >= 120 ? 'CRITICAL' : 'HIGH';
      const message = `¡Alerta de sobregasto! Has superado el presupuesto de '${normCategory}' por $${excessAmount.toFixed(2)} (Límite: $${budgetLimit.toFixed(2)}, Total gastado: $${totalSpent.toFixed(2)}).`;

      const alert = await this.notificationRepository.create({
        userId,
        type: 'OVERSPEND_ALERT',
        severity,
        category: normCategory,
        budgetLimit,
        currentSpent: totalSpent,
        excessAmount,
        percentageUsed,
        transactionId: actualTxId,
        message
      });

      logger.warn('Alerta de sobregasto emitida', {
        alertId: alert.id,
        category: normCategory,
        excessAmount,
        userId
      });

      return {
        processed: true,
        alertGenerated: true,
        alert,
        budgetStatus
      };
    }

    logger.info('Transacción evaluada dentro del margen presupuestario', {
      category: normCategory,
      totalSpent,
      budgetLimit
    });

    return {
      processed: true,
      alertGenerated: false,
      alert: null,
      budgetStatus
    };
  }

  async getNotifications(filters = {}) {
    return await this.notificationRepository.findAll(filters);
  }

  async getNotificationById(id) {
    if (!id || typeof id !== 'string') {
      const err = new Error('El ID de la notificación es obligatorio');
      err.statusCode = 400;
      throw err;
    }

    const notif = await this.notificationRepository.findById(id);
    if (!notif) {
      const err = new Error('Notificación no encontrada');
      err.statusCode = 404;
      throw err;
    }

    return notif;
  }

  async markAsRead(id) {
    if (!id || typeof id !== 'string') {
      const err = new Error('El ID de la notificación es obligatorio');
      err.statusCode = 400;
      throw err;
    }

    const notif = await this.notificationRepository.markAsRead(id);
    if (!notif) {
      const err = new Error('Notificación no encontrada');
      err.statusCode = 404;
      throw err;
    }

    return notif;
  }
}

export const defaultNotificationService = new NotificationService();
