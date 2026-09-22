import { Router } from 'express';
import { defaultNotificationController } from '../controllers/notificationController.js';

export function createNotificationRouter(notificationController = defaultNotificationController) {
  const router = Router();

  // Endpoint para recibir eventos de nuevas transacciones y evaluar sobregasto
  router.post('/events/transaction', notificationController.handleTransactionEvent);
  router.post('/events/transaction-created', notificationController.handleTransactionEvent);
  router.post('/alerts/check', notificationController.handleTransactionEvent);

  // Endpoints para gestión y consulta de notificaciones
  router.get('/', notificationController.list);
  router.get('/:id', notificationController.getById);
  router.patch('/:id/read', notificationController.markAsRead);

  return router;
}

export const notificationRouter = createNotificationRouter();
