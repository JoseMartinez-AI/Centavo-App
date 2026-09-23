import { Router } from 'express';
import { defaultReportController } from '../controllers/reportController.js';

export function createReportRouter(reportController = defaultReportController) {
  const router = Router();

  // Generación de reporte del mes actual o específico bajo demanda
  router.post('/current-month', reportController.generateCurrentMonth);
  router.post('/monthly', reportController.generateCurrentMonth);

  // Listar reportes generados
  router.get('/', reportController.list);

  // Descarga del archivo físico del reporte
  router.get('/:id/download', reportController.download);

  // Consultar metadata y detalle JSON de un reporte específico
  router.get('/:id', reportController.getById);

  return router;
}

export const reportRouter = createReportRouter();
