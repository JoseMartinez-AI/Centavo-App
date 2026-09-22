import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';

dotenv.config();

export class TransactionRepository {
  constructor(filePath = null) {
    this.filePath = filePath || process.env.DATA_FILE_PATH || './data/transactions.json';
    this.transactions = new Map();
    this.isLoaded = false;
    this._initStorage();
  }

  _initStorage() {
    if (!this.filePath) {
      this.isLoaded = true;
      return;
    }

    try {
      const resolvedPath = path.resolve(this.filePath);
      const dir = path.dirname(resolvedPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(resolvedPath)) {
        const data = fs.readFileSync(resolvedPath, 'utf8');
        if (data.trim()) {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            for (const tx of parsed) {
              this.transactions.set(tx.id, tx);
            }
          }
        }
      }
      this.isLoaded = true;
    } catch (err) {
      logger.error('Error al inicializar almacenamiento de transacciones', { error: err.message });
      this.isLoaded = true;
    }
  }

  _persist() {
    if (!this.filePath) return;
    try {
      const resolvedPath = path.resolve(this.filePath);
      const data = JSON.stringify(Array.from(this.transactions.values()), null, 2);
      fs.writeFileSync(resolvedPath, data, 'utf8');
    } catch (err) {
      logger.error('Error al persistir transacciones en disco', { error: err.message });
    }
  }

  async create({ amount, category, date, description, type = 'gasto', userId = null }) {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    const newTransaction = {
      id,
      amount: Number(amount),
      category: category.trim(),
      date: new Date(date).toISOString(),
      description: description ? description.trim() : '',
      type: type ? type.trim().toLowerCase() : 'gasto',
      userId: userId || null,
      createdAt
    };

    this.transactions.set(id, newTransaction);
    this._persist();

    return { ...newTransaction };
  }

  async findAll(filters = {}) {
    const { category, startDate, endDate, userId, type, limit, offset = 0 } = filters;
    let list = Array.from(this.transactions.values());

    if (category) {
      const normalizedCategory = category.trim().toLowerCase();
      list = list.filter((t) => t.category.toLowerCase() === normalizedCategory);
    }

    if (userId) {
      list = list.filter((t) => t.userId === userId);
    }

    if (type) {
      const normalizedType = type.trim().toLowerCase();
      list = list.filter((t) => t.type.toLowerCase() === normalizedType);
    }

    if (startDate) {
      const start = new Date(startDate).getTime();
      if (!isNaN(start)) {
        list = list.filter((t) => new Date(t.date).getTime() >= start);
      }
    }

    if (endDate) {
      const end = new Date(endDate).getTime();
      if (!isNaN(end)) {
        list = list.filter((t) => new Date(t.date).getTime() <= end);
      }
    }

    // Ordenar de más reciente a más antiguo por fecha de transacción
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const total = list.length;
    const startIndex = Math.max(0, Number(offset) || 0);
    const paginated = limit ? list.slice(startIndex, startIndex + Number(limit)) : list.slice(startIndex);

    return {
      items: paginated.map((t) => ({ ...t })),
      total
    };
  }

  async findById(id) {
    if (!id) return null;
    const tx = this.transactions.get(id);
    return tx ? { ...tx } : null;
  }

  async deleteById(id) {
    if (!id) return false;
    const deleted = this.transactions.delete(id);
    if (deleted) {
      this._persist();
    }
    return deleted;
  }

  async clear() {
    this.transactions.clear();
    this._persist();
  }
}

export const defaultTransactionRepository = new TransactionRepository();
