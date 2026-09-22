import { defaultNotificationService } from '../services/notificationService.js';
import { logger } from '../utils/logger.js';

export class NotificationController {
  constructor(notificationService = defaultNotificationService) {
    this.notificationService = notificationService;
  }

  handleTransactionEvent = async (req, res) => {
    try {
      const result = await this.notificationService.processTransactionEvent(req.body);
      const statusCode = result.alertGenerated ? 201 : 200;
      return res.status(statusCode).json({
        message: result.alertGenerated
          ? 'Alerta de sobregasto generada con éxito'
          : (result.reason || 'Transacción evaluada dentro del presupuesto'),
        ...result
      });
    } catch (err) {
      if (err.statusCode && err.statusCode < 500) {
        return res.status(err.statusCode).json({
          error: err.message,
          details: err.details
        });
      }
      logger.error('Error al procesar evento de transacción', { error: err.message });
      return res.status(500).json({ error: 'Error interno del servidor al evaluar sobregasto' });
    }
  };

  list = async (req, res) => {
    try {
      const { userId, category, type, unreadOnly, limit, offset } = req.query || {};
      const result = await this.notificationService.getNotifications({
        userId,
        category,
        type,
        unreadOnly,
        limit,
        offset
      });

      return res.status(200).json({
        message: 'Notificaciones obtenidas correctamente',
        notifications: result.items,
        count: result.count,
        total: result.total,
        offset: result.offset,
        limit: result.limit
      });
    } catch (err) {
      if (err.statusCode && err.statusCode < 500) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      logger.error('Error al listar notificaciones', { error: err.message });
      return res.status(500).json({ error: 'Error interno del servidor al consultar notificaciones' });
    }
  };

  getById = async (req, res) => {
    try {
      const { id } = req.params;
      const notification = await this.notificationService.getNotificationById(id);
      return res.status(200).json({
        message: 'Notificación obtenida con éxito',
        notification
      });
    } catch (err) {
      if (err.statusCode && err.statusCode < 500) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      logger.error('Error al obtener notificación por ID', { error: err.message });
      return res.status(500).json({ error: 'Error interno del servidor al consultar notificación' });
    }
  };

  markAsRead = async (req, res) => {
    try {
      const { id } = req.params;
      const notification = await this.notificationService.markAsRead(id);
      return res.status(200).json({
        message: 'Notificación marcada como leída',
        notification
      });
    } catch (err) {
      if (err.statusCode && err.statusCode < 500) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      logger.error('Error al marcar notificación como leída', { error: err.message });
      return res.status(500).json({ error: 'Error interno del servidor al actualizar notificación' });
    }
  };
}

export const defaultNotificationController = new NotificationController();
