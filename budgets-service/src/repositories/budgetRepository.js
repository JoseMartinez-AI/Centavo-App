import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';

dotenv.config();

export class BudgetRepository {
  constructor(filePath) {
    this.filePath = filePath === null ? null : (filePath || process.env.DATA_FILE_PATH || './data/budgets.json');
    this.budgets = new Map();
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
            for (const budget of parsed) {
              this.budgets.set(budget.id, budget);
            }
          }
        }
      }
      this.isLoaded = true;
    } catch (err) {
      logger.error('Error al inicializar almacenamiento de presupuestos', { error: err.message });
      this.isLoaded = true;
    }
  }

  _persist() {
    if (!this.filePath) return;
    try {
      const resolvedPath = path.resolve(this.filePath);
      const data = JSON.stringify(Array.from(this.budgets.values()), null, 2);
      fs.writeFileSync(resolvedPath, data, 'utf8');
    } catch (err) {
      logger.error('Error al persistir presupuestos en disco', { error: err.message });
    }
  }

  async create({ category, limitAmount, period, userId = null }) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const newBudget = {
      id,
      category: category.trim().toLowerCase(),
      limitAmount: Number(limitAmount),
      period: period.trim().toLowerCase(),
      userId: userId || null,
      createdAt: now,
      updatedAt: now
    };

    this.budgets.set(id, newBudget);
    this._persist();

    return { ...newBudget };
  }

  async findAll(filters = {}) {
    const { category, period, userId, limit, offset = 0 } = filters;
    let list = Array.from(this.budgets.values());

    if (category) {
      const normalizedCategory = category.trim().toLowerCase();
      list = list.filter((b) => b.category.toLowerCase() === normalizedCategory);
    }

    if (period) {
      const normalizedPeriod = period.trim().toLowerCase();
      list = list.filter((b) => b.period.toLowerCase() === normalizedPeriod);
    }

    if (userId !== undefined && userId !== null) {
      list = list.filter((b) => b.userId === userId);
    }

    // Ordenar de más reciente a más antiguo por fecha de creación
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = list.length;
    const start = Math.max(0, parseInt(offset, 10) || 0);
    const end = limit ? start + Math.max(0, parseInt(limit, 10) || 0) : undefined;
    const paginated = end ? list.slice(start, end) : list.slice(start);

    return {
      items: paginated,
      total,
      count: paginated.length,
      offset: start,
      limit: limit ? parseInt(limit, 10) : null
    };
  }

  async findById(id) {
    const budget = this.budgets.get(id);
    return budget ? { ...budget } : null;
  }

  async findByCategoryAndPeriod(category, period, userId = null) {
    const normCategory = category.trim().toLowerCase();
    const normPeriod = period.trim().toLowerCase();

    for (const b of this.budgets.values()) {
      const userMatch = (userId === null || userId === undefined) ? (b.userId === null) : (b.userId === userId);
      if (b.category.toLowerCase() === normCategory && b.period.toLowerCase() === normPeriod && userMatch) {
        return { ...b };
      }
    }
    return null;
  }

  async update(id, updates = {}) {
    const budget = this.budgets.get(id);
    if (!budget) return null;

    const updated = {
      ...budget,
      ...updates,
      id: budget.id, // Preservar ID
      updatedAt: new Date().toISOString()
    };

    this.budgets.set(id, updated);
    this._persist();

    return { ...updated };
  }

  async delete(id) {
    const existed = this.budgets.delete(id);
    if (existed) {
      this._persist();
    }
    return existed;
  }

  async clear() {
    this.budgets.clear();
    this._persist();
  }
}

export const defaultBudgetRepository = new BudgetRepository();
