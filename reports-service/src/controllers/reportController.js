import path from 'path';
import { defaultReportService } from '../services/reportService.js';
import { logger } from '../utils/logger.js';

export class ReportController {
  constructor(reportService = defaultReportService) {
    this.reportService = reportService;
  }

  generateCurrentMonth = async (req, res) => {
    try {
      const { month, userId } = req.body || {};
      const queryMonth = req.query?.month;
      const queryUserId = req.query?.userId;

      const targetMonth = month || queryMonth || null;
      const targetUserId = userId || queryUserId || null;

      const reportResult = await this.reportService.generateMonthlyReport({
        month: targetMonth,
        userId: targetUserId
      });

      const downloadUrl = `/api/reports/${reportResult.id}/download`;

      return res.status(201).json({
        message: 'Reporte mensual generado y guardado exitosamente',
        reportId: reportResult.id,
        month: reportResult.month,
        startDate: reportResult.startDate,
        endDate: reportResult.endDate,
        fileName: reportResult.fileName,
        downloadUrl,
        summary: reportResult.summary,
        reportData: reportResult.reportData
      });
    } catch (err) {
      if (err.statusCode && err.statusCode < 500) {
        return res.status(err.statusCode).json({ error: err.message });
      }

      logger.error('Error al generar reporte mensual bajo demanda', { error: err.message });
      return res.status(500).json({ error: 'Error interno del servidor al generar el reporte' });
    }
  };

  list = async (req, res) => {
    try {
      const { userId, month, limit, offset } = req.query || {};

      const result = await this.reportService.getReports({
        userId,
        month,
        limit,
        offset
      });

      return res.status(200).json({
        message: 'Reportes obtenidos correctamente',
        ...result
      });
    } catch (err) {
      if (err.statusCode && err.statusCode < 500) {
        return res.status(err.statusCode).json({ error: err.message });
      }

      logger.error('Error al listar reportes', { error: err.message });
      return res.status(500).json({ error: 'Error interno del servidor al listar reportes' });
    }
  };

  getById = async (req, res) => {
    try {
      const { id } = req.params;
      const report = await this.reportService.getReportById(id);

      return res.status(200).json({
        message: 'Reporte obtenido con éxito',
        ...report
      });
    } catch (err) {
      if (err.statusCode && err.statusCode < 500) {
        return res.status(err.statusCode).json({ error: err.message });
      }

      logger.error('Error al consultar reporte por ID', { error: err.message });
      return res.status(500).json({ error: 'Error interno del servidor al consultar el reporte' });
    }
  };

  download = async (req, res) => {
    try {
      const { id } = req.params;
      const fileInfo = await this.reportService.getReportFile(id);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${fileInfo.fileName}"`);

      if (fileInfo.existsOnDisk && fileInfo.filePath) {
        return res.download(path.resolve(fileInfo.filePath), fileInfo.fileName, (downloadErr) => {
          if (downloadErr && !res.headersSent) {
            logger.error('Error al enviar archivo en descarga', { error: downloadErr.message, id });
            return res.status(500).json({ error: 'Error al transferir el archivo de reporte' });
          }
        });
      }

      // Si el archivo está en memoria (por ejemplo en entornos de prueba o almacenamiento volátil)
      return res.status(200).send(fileInfo.content);
    } catch (err) {
      if (err.statusCode && err.statusCode < 500) {
        return res.status(err.statusCode).json({ error: err.message });
      }

      logger.error('Error al descargar archivo de reporte', { error: err.message });
      return res.status(500).json({ error: 'Error interno al procesar la descarga del reporte' });
    }
  };
}

export const defaultReportController = new ReportController();
