import { Router } from 'express';
import { defaultTransactionController } from '../controllers/transactionController.js';

export function createTransactionRouter(transactionController = defaultTransactionController) {
  const router = Router();

  // Categorías de gastos
  router.get('/categories', transactionController.getCategories);

  // CRUD básico de transacciones
  router.post('/', transactionController.create);
  router.get('/', transactionController.list);
  router.get('/:id', transactionController.getById);

  return router;
}

export const transactionRouter = createTransactionRouter();
