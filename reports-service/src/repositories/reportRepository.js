import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';

dotenv.config();

export class ReportRepository {
  constructor({ filePath, reportsDir } = {}) {
    this.filePath = filePath === null ? null : (filePath || process.env.DATA_FILE_PATH || './data/reports.json');
    this.reportsDir = reportsDir === null ? null : (reportsDir || process.env.REPORTS_DIR || './data/reports');
    this.reports = new Map();
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

      if (this.reportsDir) {
        const resolvedReportsDir = path.resolve(this.reportsDir);
        if (!fs.existsSync(resolvedReportsDir)) {
          fs.mkdirSync(resolvedReportsDir, { recursive: true });
        }
      }

      if (fs.existsSync(resolvedPath)) {
        const data = fs.readFileSync(resolvedPath, 'utf8');
        if (data.trim()) {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            for (const report of parsed) {
              this.reports.set(report.id, report);
            }
          }
        }
      }
      this.isLoaded = true;
    } catch (err) {
      logger.error('Error al inicializar almacenamiento de reportes', { error: err.message });
      this.isLoaded = true;
    }
  }

  _persist() {
    if (!this.filePath) return;
    try {
      const resolvedPath = path.resolve(this.filePath);
      const data = JSON.stringify(Array.from(this.reports.values()), null, 2);
      fs.writeFileSync(resolvedPath, data, 'utf8');
    } catch (err) {
      logger.error('Error al persistir índice de reportes en disco', { error: err.message });
    }
  }

  async saveReport({ id, month, startDate, endDate, userId = null, summary, data }) {
    const reportId = id || crypto.randomUUID();
    const now = new Date().toISOString();
    const fileName = `report-${reportId}.json`;
    let relativeFilePath = null;
    let absoluteFilePath = null;

    if (this.reportsDir) {
      const resolvedReportsDir = path.resolve(this.reportsDir);
      if (!fs.existsSync(resolvedReportsDir)) {
        fs.mkdirSync(resolvedReportsDir, { recursive: true });
      }
      absoluteFilePath = path.join(resolvedReportsDir, fileName);
      relativeFilePath = path.join(this.reportsDir, fileName);

      try {
        fs.writeFileSync(absoluteFilePath, JSON.stringify(data, null, 2), 'utf8');
      } catch (err) {
        logger.error('Error al guardar archivo físico del reporte en disco', { error: err.message, reportId });
      }
    }

    const reportRecord = {
      id: reportId,
      userId: userId || null,
      month,
      startDate,
      endDate,
      fileName,
      filePath: relativeFilePath,
      absoluteFilePath,
      summary: summary || {},
      generatedAt: now,
      createdAt: now
    };

    // Cachear en memoria también los datos completos para rapidez
    this.reports.set(reportId, {
      ...reportRecord,
      _fullData: data
    });

    this._persist();

    return { ...reportRecord };
  }

  async findAll(filters = {}) {
    const { userId, month, limit, offset = 0 } = filters;
    let list = Array.from(this.reports.values()).map(r => {
      const { _fullData, ...meta } = r;
      return meta;
    });

    if (userId !== undefined && userId !== null) {
      list = list.filter(r => r.userId === userId);
    }

    if (month) {
      list = list.filter(r => r.month === month);
    }

    // Ordenar de más reciente a más antiguo
    list.sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt));

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
    const record = this.reports.get(id);
    if (!record) return null;

    let fullData = record._fullData;
    if (!fullData && record.absoluteFilePath && fs.existsSync(record.absoluteFilePath)) {
      try {
        const content = fs.readFileSync(record.absoluteFilePath, 'utf8');
        fullData = JSON.parse(content);
      } catch (err) {
        logger.error('Error al leer archivo físico del reporte', { error: err.message, id });
      }
    }

    const { _fullData, ...metadata } = record;
    return {
      metadata,
      data: fullData || null
    };
  }

  async getReportFile(id) {
    const record = this.reports.get(id);
    if (!record) return null;

    if (record.absoluteFilePath && fs.existsSync(record.absoluteFilePath)) {
      return {
        fileName: record.fileName,
        filePath: record.absoluteFilePath,
        existsOnDisk: true
      };
    }

    // Si está en memoria (por ejemplo en tests sin disco)
    if (record._fullData) {
      return {
        fileName: record.fileName,
        content: JSON.stringify(record._fullData, null, 2),
        existsOnDisk: false
      };
    }

    return null;
  }

  async clear() {
    this.reports.clear();
    this._persist();
  }
}

export const defaultReportRepository = new ReportRepository();
