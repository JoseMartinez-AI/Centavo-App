import { logger } from '../utils/logger.js';

export class BudgetClient {
  constructor({ baseUrl, fetchFn } = {}) {
    this.baseUrl = baseUrl || process.env.BUDGETS_SERVICE_URL || 'http://localhost:4003';
    this.fetchFn = fetchFn || globalThis.fetch;
  }

  async getBudgets({ period = 'mensual', userId = null } = {}) {
    try {
      const url = new URL(`${this.baseUrl}/api/budgets`);
      if (period) url.searchParams.set('period', period);
      if (userId) url.searchParams.set('userId', userId);

      const response = await this.fetchFn(url.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        logger.warn('Respuesta no exitosa al consultar budgets-service', {
          status: response.status,
          period,
          userId
        });
        return [];
      }

      const data = await response.json();
      if (data && Array.isArray(data.budgets)) {
        return data.budgets;
      }

      return [];
    } catch (err) {
      logger.error('Error de conexión con budgets-service al obtener presupuestos', {
        error: err.message,
        period,
        userId
      });
      return [];
    }
  }
}

export const defaultBudgetClient = new BudgetClient();
