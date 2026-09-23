import { logger } from '../utils/logger.js';

export class TransactionClient {
  constructor({ baseUrl, fetchFn } = {}) {
    this.baseUrl = baseUrl || process.env.TRANSACTIONS_SERVICE_URL || 'http://localhost:4002';
    this.fetchFn = fetchFn || globalThis.fetch;
  }

  async getTransactionsForPeriod({ startDate, endDate, userId = null, type = null }) {
    try {
      const url = new URL(`${this.baseUrl}/api/transactions`);
      if (startDate) url.searchParams.set('startDate', startDate);
      if (endDate) url.searchParams.set('endDate', endDate);
      if (userId) url.searchParams.set('userId', userId);
      if (type) url.searchParams.set('type', type);

      const response = await this.fetchFn(url.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        logger.warn('Respuesta no exitosa al consultar transactions-service', {
          status: response.status,
          startDate,
          endDate,
          userId
        });
        return { transactions: [], totalAmount: 0, count: 0, total: 0 };
      }

      const data = await response.json();
      return {
        transactions: Array.isArray(data.transactions) ? data.transactions : [],
        totalAmount: typeof data.totalAmount === 'number' ? data.totalAmount : 0,
        count: data.count || (Array.isArray(data.transactions) ? data.transactions.length : 0),
        total: data.total || 0
      };
    } catch (err) {
      logger.error('Error de conexión con transactions-service al obtener movimientos', {
        error: err.message,
        startDate,
        endDate,
        userId
      });
      return { transactions: [], totalAmount: 0, count: 0, total: 0, error: err.message };
    }
  }
}

export const defaultTransactionClient = new TransactionClient();
