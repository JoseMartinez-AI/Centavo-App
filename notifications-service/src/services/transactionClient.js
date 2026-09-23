import { logger } from '../utils/logger.js';

export class TransactionClient {
  constructor({ baseUrl, fetchFn } = {}) {
    this.baseUrl = baseUrl || process.env.TRANSACTIONS_SERVICE_URL || 'http://localhost:4002';
    this.fetchFn = fetchFn || globalThis.fetch;
  }

  async getSpentForCategory({ category, startDate, endDate, userId = null }) {
    try {
      const url = new URL(`${this.baseUrl}/api/transactions`);
      if (category) url.searchParams.set('category', category);
      if (startDate) url.searchParams.set('startDate', startDate);
      if (endDate) url.searchParams.set('endDate', endDate);
      if (userId) url.searchParams.set('userId', userId);
      url.searchParams.set('type', 'gasto');

      const response = await this.fetchFn(url.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        logger.warn('Respuesta no exitosa al consultar transactions-service', {
          status: response.status,
          category,
          userId
        });
        return null;
      }

      const data = await response.json();
      if (data && typeof data.totalAmount === 'number') {
        return {
          totalAmount: data.totalAmount,
          count: data.count || 0,
          transactions: data.transactions || []
        };
      }

      return null;
    } catch (err) {
      logger.error('Error de conexión con transactions-service', { error: err.message, category, userId });
      return null;
    }
  }
}

export const defaultTransactionClient = new TransactionClient();
