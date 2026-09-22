import { app } from './app.js';
import { logger } from './utils/logger.js';

const PORT = process.env.PORT || 4002;

const server = app.listen(PORT, () => {
  logger.info(`transactions-service ejecutándose exitosamente en el puerto ${PORT}`);
});

process.on('SIGINT', () => {
  logger.info('Cerrando transactions-service por señal SIGINT...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  logger.info('Cerrando transactions-service por señal SIGTERM...');
  server.close(() => {
    process.exit(0);
  });
});
