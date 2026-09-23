import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';

dotenv.config();

export class NotificationRepository {
  constructor(filePath) {
    this.filePath = filePath === null ? null : (filePath || process.env.DATA_FILE_PATH || './data/notifications.json');
    this.notifications = new Map();
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
            for (const notif of parsed) {
              this.notifications.set(notif.id, notif);
            }
          }
        }
      }
      this.isLoaded = true;
    } catch (err) {
      logger.error('Error al inicializar almacenamiento de notificaciones', { error: err.message });
      this.isLoaded = true;
    }
  }

  _persist() {
    if (!this.filePath) return;
    try {
      const resolvedPath = path.resolve(this.filePath);
      const data = JSON.stringify(Array.from(this.notifications.values()), null, 2);
      fs.writeFileSync(resolvedPath, data, 'utf8');
    } catch (err) {
      logger.error('Error al persistir notificaciones en disco', { error: err.message });
    }
  }

  async create(payload) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const newNotification = {
      id,
      userId: payload.userId || null,
      type: payload.type || 'OVERSPEND_ALERT',
      severity: payload.severity || 'HIGH',
      category: payload.category ? payload.category.trim().toLowerCase() : 'general',
      budgetLimit: Number(payload.budgetLimit) || 0,
      currentSpent: Number(payload.currentSpent) || 0,
      excessAmount: Number(payload.excessAmount) || 0,
      percentageUsed: Number(payload.percentageUsed) || 0,
      transactionId: payload.transactionId || null,
      message: payload.message || '',
      read: false,
      createdAt: now,
      updatedAt: now
    };

    this.notifications.set(id, newNotification);
    this._persist();

    return { ...newNotification };
  }

  async findAll(filters = {}) {
    const { userId, category, type, unreadOnly, limit, offset = 0 } = filters;
    let list = Array.from(this.notifications.values());

    if (userId !== undefined && userId !== null) {
      list = list.filter((n) => n.userId === userId);
    }

    if (category) {
      const normCat = category.trim().toLowerCase();
      list = list.filter((n) => n.category.toLowerCase() === normCat);
    }

    if (type) {
      list = list.filter((n) => n.type.toLowerCase() === type.trim().toLowerCase());
    }

    if (unreadOnly === true || unreadOnly === 'true') {
      list = list.filter((n) => n.read === false);
    }

    // Ordenar de más reciente a más antiguo
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
    const notif = this.notifications.get(id);
    return notif ? { ...notif } : null;
  }

  async markAsRead(id) {
    const notif = this.notifications.get(id);
    if (!notif) return null;

    const updated = {
      ...notif,
      read: true,
      updatedAt: new Date().toISOString()
    };

    this.notifications.set(id, updated);
    this._persist();

    return { ...updated };
  }

  async delete(id) {
    const existed = this.notifications.delete(id);
    if (existed) {
      this._persist();
    }
    return existed;
  }

  async clear() {
    this.notifications.clear();
    this._persist();
  }
}

export const defaultNotificationRepository = new NotificationRepository();
