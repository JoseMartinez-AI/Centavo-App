import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';

import {
  normalizeCategory,
  isValidCategory,
  getDefaultCategories
} from '../src/services/categoryService.js';
import { BudgetRepository } from '../src/repositories/budgetRepository.js';
import { BudgetService } from '../src/services/budgetService.js';
import { BudgetController } from '../src/controllers/budgetController.js';
import { createBudgetRouter } from '../src/routes/budgetRoutes.js';
import { createApp } from '../src/app.js';
import { sanitize } from '../src/utils/logger.js';

describe('1. Categorización de Presupuestos (categoryService)', () => {
  it('debe normalizar categorías removiendo acentos y espacios innecesarios', () => {
    assert.equal(normalizeCategory(' Alimentación '), 'alimentacion');
    assert.equal(normalizeCategory('Educación'), 'educacion');
    assert.equal(normalizeCategory('VEHÍCULO'), 'vehiculo');
  });

  it('debe validar la longitud y formato de la categoría', () => {
    assert.equal(isValidCategory('alimentacion'), true);
    assert.equal(isValidCategory('ocio'), true);
    assert.equal(isValidCategory('a'), false);
    assert.equal(isValidCategory(''), false);
    assert.equal(isValidCategory('   '), false);
    assert.equal(isValidCategory('A'.repeat(51)), false);
  });

  it('debe listar las categorías por defecto del sistema Centavo', () => {
    const categories = getDefaultCategories();
    assert.ok(Array.isArray(categories));
    assert.ok(categories.includes('alimentacion'));
    assert.ok(categories.includes('transporte'));
    assert.ok(categories.includes('vivienda'));
    assert.ok(categories.includes('servicios'));
    assert.ok(categories.includes('ocio'));
  });
});

describe('2. Validación y Reglas de Negocio (budgetService)', () => {
  it('debe rechazar montos límite nulos, no numéricos o menores o iguales a cero', () => {
    const repo = new BudgetRepository(null);
    const service = new BudgetService(repo);

    const resZero = service.validateBudgetData({ limitAmount: 0, category: 'ocio', period: 'mensual' });
    assert.equal(resZero.isValid, false);

    const resNegative = service.validateBudgetData({ limitAmount: -100, category: 'ocio', period: 'mensual' });
    assert.equal(resNegative.isValid, false);

    const resNaN = service.validateBudgetData({ limitAmount: 'cien', category: 'ocio', period: 'mensual' });
    assert.equal(resNaN.isValid, false);

    const resMissing = service.validateBudgetData({ category: 'ocio', period: 'mensual' });
    assert.equal(resMissing.isValid, false);
  });

  it('debe rechazar categorías vacías o inválidas', () => {
    const repo = new BudgetRepository(null);
    const service = new BudgetService(repo);

    const resEmpty = service.validateBudgetData({ limitAmount: 500, category: '', period: 'mensual' });
    assert.equal(resEmpty.isValid, false);

    const resShort = service.validateBudgetData({ limitAmount: 500, category: 'a', period: 'mensual' });
    assert.equal(resShort.isValid, false);
  });

  it('debe rechazar períodos vacíos o fuera de rango', () => {
    const repo = new BudgetRepository(null);
    const service = new BudgetService(repo);

    const resEmptyPeriod = service.validateBudgetData({ limitAmount: 500, category: 'ocio', period: '' });
    assert.equal(resEmptyPeriod.isValid, false);

    const resLongPeriod = service.validateBudgetData({ limitAmount: 500, category: 'ocio', period: 'P'.repeat(35) });
    assert.equal(resLongPeriod.isValid, false);
  });

  it('debe crear un presupuesto con datos normalizados y redondeados', async () => {
    const repo = new BudgetRepository(null);
    const service = new BudgetService(repo);

    const budget = await service.createBudget({
      category: ' Alimentación ',
      limitAmount: 150000.555,
      period: ' Mensual '
    });

    assert.ok(budget.id);
    assert.equal(budget.category, 'alimentacion');
    assert.equal(budget.limitAmount, 150000.56);
    assert.equal(budget.period, 'mensual');
  });

  it('debe impedir duplicados de presupuesto para la misma categoría y período (409 Conflict)', async () => {
    const repo = new BudgetRepository(null);
    const service = new BudgetService(repo);

    await service.createBudget({
      category: 'alimentacion',
      limitAmount: 100000,
      period: 'mensual'
    });

    await assert.rejects(
      async () => {
        await service.createBudget({
          category: 'Alimentación',
          limitAmount: 120000,
          period: 'mensual'
        });
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        return true;
      }
    );
  });
});

describe('3. Persistencia y Consultas en Repositorio (budgetRepository)', () => {
  it('debe crear y consultar presupuestos correctamente', async () => {
    const repo = new BudgetRepository(null);
    const created = await repo.create({
      category: 'transporte',
      limitAmount: 80000,
      period: 'mensual'
    });

    assert.ok(created.id);
    assert.equal(created.category, 'transporte');
    assert.equal(created.limitAmount, 80000);
    assert.equal(created.period, 'mensual');

    const found = await repo.findById(created.id);
    assert.deepEqual(found, created);
  });

  it('debe filtrar presupuestos por categoría', async () => {
    const repo = new BudgetRepository(null);
    await repo.create({ category: 'alimentacion', limitAmount: 100000, period: 'mensual' });
    await repo.create({ category: 'transporte', limitAmount: 50000, period: 'mensual' });
    await repo.create({ category: 'alimentacion', limitAmount: 20000, period: 'semanal' });

    const result = await repo.findAll({ category: 'alimentacion' });
    assert.equal(result.total, 2);
    assert.equal(result.count, 2);
    assert.ok(result.items.every((b) => b.category === 'alimentacion'));
  });

  it('debe filtrar presupuestos por período', async () => {
    const repo = new BudgetRepository(null);
    await repo.create({ category: 'alimentacion', limitAmount: 100000, period: 'mensual' });
    await repo.create({ category: 'transporte', limitAmount: 50000, period: 'semanal' });
    await repo.create({ category: 'ocio', limitAmount: 30000, period: 'semanal' });

    const result = await repo.findAll({ period: 'semanal' });
    assert.equal(result.total, 2);
    assert.equal(result.count, 2);
    assert.ok(result.items.every((b) => b.period === 'semanal'));
  });

  it('debe actualizar presupuestos existentes', async () => {
    const repo = new BudgetRepository(null);
    const created = await repo.create({ category: 'ocio', limitAmount: 40000, period: 'mensual' });
    const updated = await repo.update(created.id, { limitAmount: 60000 });

    assert.equal(updated.limitAmount, 60000);
    assert.equal(updated.id, created.id);

    const found = await repo.findById(created.id);
    assert.equal(found.limitAmount, 60000);
  });

  it('debe eliminar presupuestos', async () => {
    const repo = new BudgetRepository(null);
    const created = await repo.create({ category: 'salud', limitAmount: 90000, period: 'anual' });
    const deleted = await repo.delete(created.id);
    assert.equal(deleted, true);

    const found = await repo.findById(created.id);
    assert.equal(found, null);
  });
});

describe('4. Integración de API HTTP (budgets-service)', () => {
  let server;
  let baseUrl;
  let testRepo;
  let testService;
  let testController;
  let testRouter;

  before(async () => {
    testRepo = new BudgetRepository(null);
    testService = new BudgetService(testRepo);
    testController = new BudgetController(testService);
    testRouter = createBudgetRouter(testController);

    const testApp = createApp(testRouter);
    server = http.createServer(testApp);

    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      await new Promise((resolve) => server.close(resolve));
    }
  });

  beforeEach(async () => {
    await testRepo.clear();
  });

  it('GET /health debe responder 200 y servicio correcto', async () => {
    const res = await fetch(`${baseUrl}/health`);
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.status, 'ok');
    assert.equal(data.service, 'budgets-service');
  });

  it('GET /api/budgets/categories debe retornar catálogo de categorías', async () => {
    const res = await fetch(`${baseUrl}/api/budgets/categories`);
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data.categories));
    assert.ok(data.categories.includes('alimentacion'));
    assert.ok(data.categories.includes('servicios'));
  });

  it('POST /api/budgets debe crear un presupuesto exitosamente (201 Created)', async () => {
    const payload = {
      category: 'Alimentación',
      limitAmount: 250000,
      period: 'mensual'
    };

    const res = await fetch(`${baseUrl}/api/budgets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    assert.equal(res.status, 201);
    assert.ok(data.budget);
    assert.ok(data.budget.id);
    assert.equal(data.budget.category, 'alimentacion'); // Normalizada
    assert.equal(data.budget.limitAmount, 250000);
    assert.equal(data.budget.period, 'mensual');
  });

  it('POST /api/budgets debe fallar con 400 si faltan campos obligatorios', async () => {
    const resNoAmount = await fetch(`${baseUrl}/api/budgets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'transporte', period: 'mensual' })
    });
    assert.equal(resNoAmount.status, 400);
    await resNoAmount.json();

    const resNoCategory = await fetch(`${baseUrl}/api/budgets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limitAmount: 50000, period: 'mensual' })
    });
    assert.equal(resNoCategory.status, 400);
    await resNoCategory.json();

    const resNoPeriod = await fetch(`${baseUrl}/api/budgets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'transporte', limitAmount: 50000 })
    });
    assert.equal(resNoPeriod.status, 400);
    await resNoPeriod.json();
  });

  it('POST /api/budgets debe retornar 409 Conflict si ya existe el presupuesto', async () => {
    const payload = {
      category: 'servicios',
      limitAmount: 80000,
      period: 'mensual'
    };

    const res1 = await fetch(`${baseUrl}/api/budgets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.equal(res1.status, 201);
    await res1.json();

    const res2 = await fetch(`${baseUrl}/api/budgets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.equal(res2.status, 409);
    const data2 = await res2.json();
    assert.ok(data2.error.includes('Ya existe un presupuesto'));
  });

  it('GET /api/budgets debe consultar y listar presupuestos (200 OK)', async () => {
    await testRepo.create({ category: 'alimentacion', limitAmount: 100000, period: 'mensual' });
    await testRepo.create({ category: 'ocio', limitAmount: 50000, period: 'mensual' });

    const res = await fetch(`${baseUrl}/api/budgets`);
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data.budgets));
    assert.equal(data.total, 2);
    assert.equal(data.count, 2);
  });

  it('GET /api/budgets debe filtrar presupuestos por categoría y período', async () => {
    await testRepo.create({ category: 'alimentacion', limitAmount: 100000, period: 'mensual' });
    await testRepo.create({ category: 'transporte', limitAmount: 60000, period: 'semanal' });
    await testRepo.create({ category: 'alimentacion', limitAmount: 40000, period: 'anual' });

    const resCategory = await fetch(`${baseUrl}/api/budgets?category=alimentacion`);
    const dataCategory = await resCategory.json();

    assert.equal(resCategory.status, 200);
    assert.equal(dataCategory.count, 2);
    assert.ok(dataCategory.budgets.every((b) => b.category === 'alimentacion'));

    const resPeriod = await fetch(`${baseUrl}/api/budgets?period=semanal`);
    const dataPeriod = await resPeriod.json();

    assert.equal(resPeriod.status, 200);
    assert.equal(dataPeriod.count, 1);
    assert.equal(dataPeriod.budgets[0].category, 'transporte');
  });

  it('GET /api/budgets/:id debe consultar un presupuesto existente', async () => {
    const createRes = await fetch(`${baseUrl}/api/budgets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'vivienda', limitAmount: 400000, period: 'mensual' })
    });
    const createdData = await createRes.json();
    const budgetId = createdData.budget.id;

    const res = await fetch(`${baseUrl}/api/budgets/${budgetId}`);
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.budget.id, budgetId);
    assert.equal(data.budget.category, 'vivienda');
  });

  it('GET /api/budgets/:id debe retornar 404 para ID inexistente', async () => {
    const res = await fetch(`${baseUrl}/api/budgets/00000000-0000-0000-0000-000000000000`);
    assert.equal(res.status, 404);
    await res.json();
  });

  it('debe responder 400 Bad Request ante cuerpo con JSON malformado', async () => {
    const res = await fetch(`${baseUrl}/api/budgets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ "invalid_json": '
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('JSON inválido'));
  });

  it('debe responder 404 para rutas inexistentes', async () => {
    const res = await fetch(`${baseUrl}/api/ruta-desconocida`);
    assert.equal(res.status, 404);
    await res.json();
  });
});

describe('5. Sanitización de Logger (logger.js)', () => {
  it('debe redactar tokens JWT y claves sensibles', () => {
    const data = {
      password: 'mi_secreto_super_seguro',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz',
      category: 'alimentacion',
      limitAmount: 10000
    };

    const sanitized = sanitize(data);
    assert.equal(sanitized.password, '[REDACTED]');
    assert.equal(sanitized.token, '[REDACTED]');
    assert.equal(sanitized.category, 'alimentacion');
    assert.equal(sanitized.limitAmount, 10000);
  });
});
