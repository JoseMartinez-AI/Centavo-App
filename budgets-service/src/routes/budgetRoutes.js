import { Router } from 'express';
import { defaultBudgetController } from '../controllers/budgetController.js';

export function createBudgetRouter(budgetController = defaultBudgetController) {
  const router = Router();

  // Categorías de presupuestos
  router.get('/categories', budgetController.getCategories);

  // Endpoints principales de presupuestos
  router.post('/', budgetController.create);
  router.get('/', budgetController.list);
  router.get('/:id', budgetController.getById);

  return router;
}

export const budgetRouter = createBudgetRouter();
