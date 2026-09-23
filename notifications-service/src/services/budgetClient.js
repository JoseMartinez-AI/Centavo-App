import { logger } from '../utils/logger.js';

export class BudgetClient {
  constructor({ baseUrl, fetchFn } = {}) {
    this.baseUrl = baseUrl || process.env.BUDGETS_SERVICE_URL || 'http://localhost:4003';
    this.fetchFn = fetchFn || globalThis.fetch;
  }

  async getBudgetByCategory({ category, period = 'mensual', userId = null }) {
    try {
      const url = new URL(`${this.baseUrl}/api/budgets`);
      if (category) url.searchParams.set('category', category);
      if (period) url.searchParams.set('period', period);
      if (userId) url.searchParams.set('userId', userId);

      const response = await this.fetchFn(url.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        logger.warn('Respuesta no exitosa al consultar budgets-service', {
          status: response.status,
          category,
          userId
        });
        return null;
      }

      const data = await response.json();
      if (data && Array.isArray(data.budgets) && data.budgets.length > 0) {
        // Encontrar la mejor coincidencia por usuario o coincidencia general
        const match = data.budgets.find(b => (userId ? b.userId === userId : true)) || data.budgets[0];
        return match;
      }

      return null;
    } catch (err) {
      logger.error('Error de conexión con budgets-service', { error: err.message, category, userId });
      return null;
    }
  }
}

export const defaultBudgetClient = new BudgetClient();
