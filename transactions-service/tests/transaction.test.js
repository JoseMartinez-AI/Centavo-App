import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';

import {
  normalizeCategory,
  isValidCategory,
  suggestCategory,
  getDefaultCategories
} from '../src/services/categoryService.js';
import { TransactionRepository } from '../src/repositories/transactionRepository.js';
import { TransactionService } from '../src/services/transactionService.js';
import { TransactionController } from '../src/controllers/transactionController.js';
import { createTransactionRouter } from '../src/routes/transactionRoutes.js';
import { createApp } from '../src/app.js';
import { sanitize } from '../src/utils/logger.js';

describe('1. Categorización de Gastos (categoryService)', () => {
  it('debe normalizar categorías removiendo acentos y espacios innecesarios', () => {
    assert.equal(normalizeCategory(' Alimentación '), 'alimentacion');
    assert.equal(normalizeCategory('Educación'), 'educacion');
    assert.equal(normalizeCategory('VEHÍCULO'), 'vehiculo');
  });

  it('debe validar la longitud y validez de la categoría', () => {
    assert.equal(isValidCategory('comida'), true);
    assert.equal(isValidCategory('a'), false);
    assert.equal(isValidCategory(''), false);
    assert.equal(isValidCategory('   '), false);
    assert.equal(isValidCategory('A'.repeat(51)), false);
  });

  it('debe sugerir categoría adecuada según palabras clave en la descripción', () => {
    assert.equal(suggestCategory('Compra en supermercado Éxito'), 'alimentacion');
    assert.equal(suggestCategory('Tanqueada de gasolina para el auto'), 'transporte');
    assert.equal(suggestCategory('Pago mensual de Netflix'), 'servicios');
    assert.equal(suggestCategory('Compra de libros de programación'), 'educacion');
    assert.equal(suggestCategory('Gasto desconocido xyz'), 'otros');
  });

  it('debe listar las categorías por defecto del sistema', () => {
    const categories = getDefaultCategories();
    assert.ok(Array.isArray(categories));
    assert.ok(categories.includes('alimentacion'));
    assert.ok(categories.includes('transporte'));
    assert.ok(categories.includes('ocio'));
  });
});

describe('2. Validación y Reglas de Negocio (transactionService)', () => {
  const repo = new TransactionRepository(null); // en memoria para pruebas
  const service = new TransactionService(repo);

  it('debe rechazar montos no numéricos, nulos o menores o iguales a cero', () => {
    const resZero = service.validateTransactionData({ amount: 0, category: 'ocio', date: '2026-09-21' });
    assert.equal(resZero.isValid, false);

    const resNegative = service.validateTransactionData({ amount: -50, category: 'ocio', date: '2026-09-21' });
    assert.equal(resNegative.isValid, false);

    const resNaN = service.validateTransactionData({ amount: 'cincuenta', category: 'ocio', date: '2026-09-21' });
    assert.equal(resNaN.isValid, false);

    const resEmpty = service.validateTransactionData({ amount: '', category: 'ocio', date: '2026-09-21' });
    assert.equal(resEmpty.isValid, false);
  });

  it('debe rechazar categorías vacías o ausentes', () => {
    const resEmptyCat = service.validateTransactionData({ amount: 100, category: '  ', date: '2026-09-21' });
    assert.equal(resEmptyCat.isValid, false);
  });

  it('debe rechazar fechas inválidas', () => {
    const resInvalidDate = service.validateTransactionData({ amount: 100, category: 'ocio', date: 'fecha-falsa-123' });
    assert.equal(resInvalidDate.isValid, false);
  });

  it('debe validar tipos de transacción permitidos (gasto / ingreso)', () => {
    const resValidType = service.validateTransactionData({
      amount: 100,
      category: 'ocio',
      date: '2026-09-21',
      type: 'gasto'
    });
    assert.equal(resValidType.isValid, true);

    const resInvalidType = service.validateTransactionData({
      amount: 100,
      category: 'ocio',
      date: '2026-09-21',
      type: 'prestamo'
    });
    assert.equal(resInvalidType.isValid, false);
  });
});

describe('3. Persistencia y Repositorio (transactionRepository)', () => {
  let repo;

  beforeEach(async () => {
    repo = new TransactionRepository(null);
  });

  it('debe crear y almacenar transacciones correctamente', async () => {
    const tx = await repo.create({
      amount: 45.5,
      category: 'transporte',
      date: '2026-09-21T10:00:00.000Z',
      description: 'Viaje en taxi'
    });

    assert.ok(tx.id);
    assert.equal(tx.amount, 45.5);
    assert.equal(tx.category, 'transporte');
    assert.equal(tx.description, 'Viaje en taxi');

    const found = await repo.findById(tx.id);
    assert.deepEqual(found, tx);
  });

  it('debe filtrar transacciones por categoría', async () => {
    await repo.create({ amount: 10, category: 'alimentacion', date: '2026-09-21' });
    await repo.create({ amount: 20, category: 'transporte', date: '2026-09-21' });
    await repo.create({ amount: 30, category: 'alimentacion', date: '2026-09-21' });

    const result = await repo.findAll({ category: 'alimentacion' });
    assert.equal(result.total, 2);
    assert.equal(result.items.length, 2);
    assert.ok(result.items.every((t) => t.category === 'alimentacion'));
  });

  it('debe filtrar transacciones por rango de fechas', async () => {
    await repo.create({ amount: 10, category: 'ocio', date: '2026-09-10T00:00:00.000Z' });
    await repo.create({ amount: 20, category: 'ocio', date: '2026-09-15T00:00:00.000Z' });
    await repo.create({ amount: 30, category: 'ocio', date: '2026-09-20T00:00:00.000Z' });

    const result = await repo.findAll({
      startDate: '2026-09-12T00:00:00.000Z',
      endDate: '2026-09-18T00:00:00.000Z'
    });

    assert.equal(result.total, 1);
    assert.equal(result.items[0].amount, 20);
  });
});

describe('4. API Endpoints de Transacciones (Integración HTTP)', () => {
  let server;
  let baseUrl;
  let repo;

  before(async () => {
    repo = new TransactionRepository(null); // en memoria pura para tests
    const service = new TransactionService(repo);
    const controller = new TransactionController(service);
    const customRouter = createTransactionRouter(controller);
    const app = createApp(customRouter);
    server = http.createServer(app);

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
    await repo.clear();
  });

  it('GET /health debe responder status 200 y servicio correcto', async () => {
    const res = await fetch(`${baseUrl}/health`);
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.status, 'ok');
    assert.equal(data.service, 'transactions-service');
  });

  it('GET /api/transactions/categories debe retornar el listado de categorías', async () => {
    const res = await fetch(`${baseUrl}/api/transactions/categories`);
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data.categories));
    assert.ok(data.categories.includes('alimentacion'));
  });

  it('POST /api/transactions debe registrar una transacción exitosamente (201 Created)', async () => {
    const payload = {
      amount: 15000.5,
      category: 'Alimentación',
      date: '2026-09-21T14:30:00.000Z',
      description: 'Almuerzo ejecutivo'
    };

    const res = await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    assert.equal(res.status, 201);
    assert.ok(data.transaction);
    assert.ok(data.transaction.id);
    assert.equal(data.transaction.amount, 15000.5);
    assert.equal(data.transaction.category, 'alimentacion'); // normalizada
    assert.equal(data.transaction.description, 'Almuerzo ejecutivo');
    assert.equal(data.transaction.type, 'gasto');
  });

  it('POST /api/transactions debe fallar con 400 si faltan campos obligatorios', async () => {
    const resNoAmount = await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'transporte', date: '2026-09-21' })
    });
    assert.equal(resNoAmount.status, 400);

    const resNoCategory = await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 50, date: '2026-09-21' })
    });
    assert.equal(resNoCategory.status, 400);

    const resNoDate = await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 50, category: 'ocio' })
    });
    assert.equal(resNoDate.status, 400);
  });

  it('POST /api/transactions debe rechazar montos menores o iguales a cero con 400', async () => {
    const resNegative = await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: -10, category: 'salud', date: '2026-09-21' })
    });
    assert.equal(resNegative.status, 400);

    const resZero = await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 0, category: 'salud', date: '2026-09-21' })
    });
    assert.equal(resZero.status, 400);
  });

  it('GET /api/transactions debe listar transacciones con cálculo total y conteo', async () => {
    // Insertamos 2 transacciones
    await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 100, category: 'alimentacion', date: '2026-09-20' })
    });

    await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 50, category: 'transporte', date: '2026-09-21' })
    });

    const res = await fetch(`${baseUrl}/api/transactions`);
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.count, 2);
    assert.equal(data.total, 2);
    assert.equal(data.totalAmount, 150);
    assert.equal(data.transactions.length, 2);
  });

  it('GET /api/transactions debe filtrar por categoría', async () => {
    await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 120, category: 'vivienda', date: '2026-09-20' })
    });

    await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 40, category: 'ocio', date: '2026-09-21' })
    });

    const res = await fetch(`${baseUrl}/api/transactions?category=vivienda`);
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.count, 1);
    assert.equal(data.totalAmount, 120);
    assert.equal(data.transactions[0].category, 'vivienda');
  });

  it('GET /api/transactions/:id debe retornar la transacción correspondiente', async () => {
    const createRes = await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 75, category: 'servicios', date: '2026-09-21' })
    });
    const createdData = await createRes.json();
    const id = createdData.transaction.id;

    const getRes = await fetch(`${baseUrl}/api/transactions/${id}`);
    const getData = await getRes.json();

    assert.equal(getRes.status, 200);
    assert.equal(getData.transaction.id, id);
    assert.equal(getData.transaction.amount, 75);
  });

  it('GET /api/transactions/:id debe retornar 404 ante un ID no encontrado', async () => {
    const res = await fetch(`${baseUrl}/api/transactions/id-inexistente-12345`);
    assert.equal(res.status, 404);
  });

  it('debe responder 400 Bad Request ante cuerpo con JSON malformado', async () => {
    const res = await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ "invalid_json": '
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('JSON inválido'));
  });

  it('debe responder 404 Not Found ante rutas no configuradas', async () => {
    const res = await fetch(`${baseUrl}/api/ruta-que-no-existe`);
    assert.equal(res.status, 404);
  });
});

describe('5. Logger y Sanitización de Datos', () => {
  it('debe sanitizar llaves sensibles en objetos', () => {
    const payload = {
      amount: 100,
      token: 'jwt-sensible-xyz',
      creditCard: '1234-5678-9012-3456',
      description: 'Cena de negocios'
    };

    const sanitized = sanitize(payload);
    assert.equal(sanitized.token, '[REDACTED]');
    assert.equal(sanitized.creditCard, '[REDACTED]');
    assert.equal(sanitized.description, 'Cena de negocios');
  });
});
