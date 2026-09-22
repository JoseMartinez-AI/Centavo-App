import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { budgetRouter } from './routes/budgetRoutes.js';
import { logger } from './utils/logger.js';

dotenv.config();

export function createApp(customBudgetRouter = null) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Middleware de logging seguro para peticiones entrantes
  app.use((req, res, next) => {
    logger.debug(`HTTP ${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      ip: req.ip
    });
    next();
  });

  // Health check
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'budgets-service' });
  });

  // Rutas de presupuestos
  app.use('/api/budgets', customBudgetRouter || budgetRouter);

  // Manejador de rutas no encontradas (404)
  app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
  });

  // Manejador global de errores
  app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      return res.status(400).json({ error: 'Formato JSON inválido en el cuerpo de la petición' });
    }
    logger.error('Error no controlado en la aplicación', { error: err.message });
    res.status(500).json({ error: 'Error interno del servidor' });
  });

  return app;
}

export const app = createApp();
