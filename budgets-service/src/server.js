import { app } from './app.js';
import { logger } from './utils/logger.js';

const PORT = process.env.PORT || 4003;

const server = app.listen(PORT, () => {
  logger.info(`budgets-service ejecutándose exitosamente en el puerto ${PORT}`);
});

process.on('SIGINT', () => {
  logger.info('Cerrando budgets-service por señal SIGINT...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  logger.info('Cerrando budgets-service por señal SIGTERM...');
  server.close(() => {
    process.exit(0);
  });
});
