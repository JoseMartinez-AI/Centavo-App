import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';

import {
  normalizeCategory,
  getMonthDateRange,
  NotificationService
} from '../src/services/notificationService.js';
import { NotificationRepository } from '../src/repositories/notificationRepository.js';
import { NotificationController } from '../src/controllers/notificationController.js';
import { createNotificationRouter } from '../src/routes/notificationRoutes.js';
import { createApp } from '../src/app.js';
import { sanitize } from '../src/utils/logger.js';

describe('1. Utilidades y Normalización (notificationService)', () => {
  it('debe normalizar categorías removiendo acentos, mayúsculas y espacios', () => {
    assert.equal(normalizeCategory(' Alimentación '), 'alimentacion');
    assert.equal(normalizeCategory('EDUCACIÓN'), 'educacion');
    assert.equal(normalizeCategory('Vehículo'), 'vehiculo');
    assert.equal(normalizeCategory(''), '');
  });

  it('debe calcular el rango de fechas mensual en UTC', () => {
    const { startDate, endDate } = getMonthDateRange('2026-09-15T12:00:00.000Z');
    assert.ok(startDate.startsWith('2026-09-01T00:00:00.000Z'));
    assert.ok(endDate.startsWith('2026-09-30T23:59:59.999Z'));
  });
});

describe('2. Validación de Eventos de Transacción', () => {
  it('debe rechazar eventos sin cuerpo o nulos', () => {
    const service = new NotificationService({
      notificationRepository: new NotificationRepository(null)
    });

    const resNull = service.validateTransactionEvent(null);
    assert.equal(resNull.isValid, false);

    const resUndefined = service.validateTransactionEvent(undefined);
    assert.equal(resUndefined.isValid, false);
  });

  it('debe rechazar montos nulos, negativos, cero o no numéricos', () => {
    const service = new NotificationService({
      notificationRepository: new NotificationRepository(null)
    });

    const resZero = service.validateTransactionEvent({ amount: 0, category: 'ocio' });
    assert.equal(resZero.isValid, false);

    const resNegative = service.validateTransactionEvent({ amount: -50, category: 'ocio' });
    assert.equal(resNegative.isValid, false);

    const resNaN = service.validateTransactionEvent({ amount: 'cien', category: 'ocio' });
    assert.equal(resNaN.isValid, false);

    const resMissing = service.validateTransactionEvent({ category: 'ocio' });
    assert.equal(resMissing.isValid, false);
  });

  it('debe rechazar categorías vacías', () => {
    const service = new NotificationService({
      notificationRepository: new NotificationRepository(null)
    });

    const resEmpty = service.validateTransactionEvent({ amount: 100, category: '' });
    assert.equal(resEmpty.isValid, false);

    const resSpaces = service.validateTransactionEvent({ amount: 100, category: '   ' });
    assert.equal(resSpaces.isValid, false);
  });

  it('debe rechazar tipos de transacción no válidos', () => {
    const service = new NotificationService({
      notificationRepository: new NotificationRepository(null)
    });

    const resInvalidType = service.validateTransactionEvent({
      amount: 100,
      category: 'comida',
      type: 'invalido'
    });
    assert.equal(resInvalidType.isValid, false);
  });
});

describe('3. Reglas de Negocio de Sobregasto (NotificationService)', () => {
  it('no debe generar alerta para transacciones de tipo ingreso', async () => {
    const repo = new NotificationRepository(null);
    const service = new NotificationService({ notificationRepository: repo });

    const result = await service.processTransactionEvent({
      amount: 500000,
      category: 'salario',
      type: 'ingreso'
    });

    assert.equal(result.alertGenerated, false);
    assert.equal(result.alert, null);
    assert.ok(result.reason.includes('ingreso'));
  });

  it('no debe generar alerta si no existe presupuesto fijado para la categoría', async () => {
    const repo = new NotificationRepository(null);
    const mockBudgetClient = {
      getBudgetByCategory: async () => null
    };
    const service = new NotificationService({
      notificationRepository: repo,
      budgetClient: mockBudgetClient
    });

    const result = await service.processTransactionEvent({
      amount: 10000,
      category: 'viajes',
      type: 'gasto'
    });

    assert.equal(result.alertGenerated, false);
    assert.equal(result.alert, null);
    assert.ok(result.reason.includes('No hay presupuesto configurado'));
  });

  it('no debe generar alerta si el gasto total está dentro del límite presupuestario', async () => {
    const repo = new NotificationRepository(null);
    const mockBudgetClient = {
      getBudgetByCategory: async () => ({
        category: 'alimentacion',
        limitAmount: 100000,
        period: 'mensual'
      })
    };
    const mockTxClient = {
      getSpentForCategory: async () => ({
        totalAmount: 40000,
        count: 1,
        transactions: []
      })
    };

    const service = new NotificationService({
      notificationRepository: repo,
      budgetClient: mockBudgetClient,
      transactionClient: mockTxClient
    });

    const result = await service.processTransactionEvent({
      transactionId: 'tx_01',
      amount: 30000,
      category: 'alimentacion',
      type: 'gasto'
    });

    assert.equal(result.alertGenerated, false);
    assert.equal(result.alert, null);
    assert.equal(result.budgetStatus.limitAmount, 100000);
    assert.equal(result.budgetStatus.currentSpent, 70000); // 40000 + 30000
    assert.equal(result.budgetStatus.isExceeded, false);
    assert.equal(result.budgetStatus.excessAmount, 0);
  });

  it('debe generar alerta de sobregasto si el gasto total excede el presupuesto', async () => {
    const repo = new NotificationRepository(null);
    const mockBudgetClient = {
      getBudgetByCategory: async () => ({
        category: 'alimentacion',
        limitAmount: 100000,
        period: 'mensual'
      })
    };
    const mockTxClient = {
      getSpentForCategory: async () => ({
        totalAmount: 80000,
        count: 2,
        transactions: []
      })
    };

    const service = new NotificationService({
      notificationRepository: repo,
      budgetClient: mockBudgetClient,
      transactionClient: mockTxClient
    });

    const result = await service.processTransactionEvent({
      transactionId: 'tx_02',
      amount: 35000,
      category: 'Alimentación',
      type: 'gasto',
      userId: 'usr_100'
    });

    assert.equal(result.alertGenerated, true);
    assert.ok(result.alert);
    assert.equal(result.alert.category, 'alimentacion');
    assert.equal(result.alert.budgetLimit, 100000);
    assert.equal(result.alert.currentSpent, 115000); // 80000 + 35000
    assert.equal(result.alert.excessAmount, 15000);
    assert.equal(result.alert.severity, 'HIGH');
    assert.equal(result.alert.userId, 'usr_100');
    assert.equal(result.alert.transactionId, 'tx_02');
    assert.ok(result.alert.message.includes('15000.00'));

    // Debe haberse persistido en el repositorio
    const stored = await repo.findById(result.alert.id);
    assert.deepEqual(stored, result.alert);
  });

  it('debe asignar severidad CRITICAL si el sobregasto supera el 120%', async () => {
    const repo = new NotificationRepository(null);
    const mockBudgetClient = {
      getBudgetByCategory: async () => ({
        category: 'ocio',
        limitAmount: 50000,
        period: 'mensual'
      })
    };
    const mockTxClient = {
      getSpentForCategory: async () => null
    };

    const service = new NotificationService({
      notificationRepository: repo,
      budgetClient: mockBudgetClient,
      transactionClient: mockTxClient
    });

    const result = await service.processTransactionEvent({
      transactionId: 'tx_03',
      amount: 70000, // 140%
      category: 'ocio',
      type: 'gasto'
    });

    assert.equal(result.alertGenerated, true);
    assert.equal(result.alert.severity, 'CRITICAL');
    assert.equal(result.alert.percentageUsed, 140);
  });

  it('no debe duplicar el monto si la transacción ya estaba registrada en transactions-service', async () => {
    const repo = new NotificationRepository(null);
    const mockBudgetClient = {
      getBudgetByCategory: async () => ({
        category: 'transporte',
        limitAmount: 50000,
        period: 'mensual'
      })
    };
    const mockTxClient = {
      getSpentForCategory: async () => ({
        totalAmount: 60000, // Ya incluye tx_04
        count: 1,
        transactions: [{ id: 'tx_04', amount: 60000 }]
      })
    };

    const service = new NotificationService({
      notificationRepository: repo,
      budgetClient: mockBudgetClient,
      transactionClient: mockTxClient
    });

    const result = await service.processTransactionEvent({
      transactionId: 'tx_04',
      amount: 60000,
      category: 'transporte',
      type: 'gasto'
    });

    assert.equal(result.alertGenerated, true);
    assert.equal(result.budgetStatus.currentSpent, 60000);
    assert.equal(result.budgetStatus.excessAmount, 10000);
  });
});

describe('4. Persistencia en Repositorio (NotificationRepository)', () => {
  it('debe crear, consultar y filtrar alertas', async () => {
    const repo = new NotificationRepository(null);

    const a1 = await repo.create({
      userId: 'usr_1',
      category: 'alimentacion',
      budgetLimit: 100,
      currentSpent: 120,
      excessAmount: 20
    });

    const a2 = await repo.create({
      userId: 'usr_2',
      category: 'transporte',
      budgetLimit: 50,
      currentSpent: 60,
      excessAmount: 10
    });

    assert.ok(a1.id);
    assert.equal(a1.read, false);

    const all = await repo.findAll();
    assert.equal(all.total, 2);

    const forUser1 = await repo.findAll({ userId: 'usr_1' });
    assert.equal(forUser1.total, 1);
    assert.equal(forUser1.items[0].userId, 'usr_1');

    const marked = await repo.markAsRead(a1.id);
    assert.equal(marked.read, true);

    const unread = await repo.findAll({ unreadOnly: true });
    assert.equal(unread.total, 1);
    assert.equal(unread.items[0].id, a2.id);
  });
});

describe('5. Integración HTTP (notifications-service)', () => {
  let server;
  let baseUrl;
  let testRepo;
  let testService;
  let testController;
  let testRouter;

  before(async () => {
    testRepo = new NotificationRepository(null);

    const mockBudgetClient = {
      getBudgetByCategory: async ({ category }) => {
        if (category === 'alimentacion') {
          return { category: 'alimentacion', limitAmount: 100000, period: 'mensual' };
        }
        if (category === 'transporte') {
          return { category: 'transporte', limitAmount: 50000, period: 'mensual' };
        }
        return null;
      }
    };

    const mockTxClient = {
      getSpentForCategory: async ({ category }) => {
        if (category === 'alimentacion') {
          return { totalAmount: 70000, count: 2, transactions: [] };
        }
        return { totalAmount: 0, count: 0, transactions: [] };
      }
    };

    testService = new NotificationService({
      notificationRepository: testRepo,
      budgetClient: mockBudgetClient,
      transactionClient: mockTxClient
    });

    testController = new NotificationController(testService);
    testRouter = createNotificationRouter(testController);

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
    assert.equal(data.service, 'notifications-service');
  });

  it('POST /api/notifications/events/transaction debe retornar 200 si no supera presupuesto', async () => {
    const res = await fetch(`${baseUrl}/api/notifications/events/transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 20000, // 70000 + 20000 = 90000 <= 100000
        category: 'alimentacion',
        type: 'gasto'
      })
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.alertGenerated, false);
    assert.equal(data.alert, null);
    assert.equal(data.budgetStatus.isExceeded, false);
  });

  it('POST /api/notifications/events/transaction debe generar alerta (201 Created) al superar presupuesto', async () => {
    const res = await fetch(`${baseUrl}/api/notifications/events/transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactionId: 'tx_integ_01',
        amount: 40000, // 70000 + 40000 = 110000 > 100000
        category: 'Alimentación',
        type: 'gasto',
        userId: 'usr_integ'
      })
    });

    const data = await res.json();
    assert.equal(res.status, 201);
    assert.equal(data.alertGenerated, true);
    assert.ok(data.alert);
    assert.equal(data.alert.excessAmount, 10000);
    assert.equal(data.budgetStatus.isExceeded, true);
    assert.equal(data.alert.userId, 'usr_integ');
  });

  it('POST /api/events/transaction alias directo también debe funcionar', async () => {
    const res = await fetch(`${baseUrl}/api/events/transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 60000, // 0 + 60000 = 60000 > 50000
        category: 'transporte',
        type: 'gasto'
      })
    });

    const data = await res.json();
    assert.equal(res.status, 201);
    assert.equal(data.alertGenerated, true);
    assert.equal(data.alert.category, 'transporte');
  });

  it('POST con validación fallida debe responder 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}/api/notifications/events/transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: -100,
        category: ''
      })
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
    assert.ok(Array.isArray(data.details));
  });

  it('GET /api/notifications debe listar notificaciones generadas', async () => {
    await testRepo.create({ category: 'ocio', budgetLimit: 100, currentSpent: 150, excessAmount: 50 });

    const res = await fetch(`${baseUrl}/api/notifications`);
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.total, 1);
    assert.equal(data.notifications.length, 1);
  });

  it('PATCH /api/notifications/:id/read debe marcar como leída', async () => {
    const created = await testRepo.create({ category: 'salud', budgetLimit: 50, currentSpent: 70, excessAmount: 20 });
    assert.equal(created.read, false);

    const res = await fetch(`${baseUrl}/api/notifications/${created.id}/read`, {
      method: 'PATCH'
    });
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.notification.read, true);
  });

  it('debe responder 400 ante JSON malformado', async () => {
    const res = await fetch(`${baseUrl}/api/notifications/events/transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"invalid": '
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('JSON inválido'));
  });

  it('debe responder 404 para rutas inexistentes', async () => {
    const res = await fetch(`${baseUrl}/api/ruta-fantasma`);
    assert.equal(res.status, 404);
  });
});

describe('6. Sanitización en Logger', () => {
  it('debe ocultar claves sensibles y tokens', () => {
    const sanitized = sanitize({
      password: 'mypassword',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig',
      category: 'alimentacion'
    });

    assert.equal(sanitized.password, '[REDACTED]');
    assert.equal(sanitized.token, '[REDACTED]');
    assert.equal(sanitized.category, 'alimentacion');
  });
});
