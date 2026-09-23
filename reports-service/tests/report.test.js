import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';

import { ReportService } from '../src/services/reportService.js';
import { ReportRepository } from '../src/repositories/reportRepository.js';
import { TransactionClient } from '../src/services/transactionClient.js';
import { BudgetClient } from '../src/services/budgetClient.js';
import { ReportController } from '../src/controllers/reportController.js';
import { createReportRouter } from '../src/routes/reportRoutes.js';
import { createApp } from '../src/app.js';
import { sanitize } from '../src/utils/logger.js';

describe('1. Rango de Fechas y Cálculo de Meses (ReportService)', () => {
  const service = new ReportService();

  it('debe calcular el rango para el mes actual correctamente', () => {
    const range = service.getMonthDateRange();
    assert.ok(range.month);
    assert.match(range.month, /^\d{4}-\d{2}$/);
    assert.match(range.startDate, /^\d{4}-\d{2}-01$/);
    assert.match(range.endDate, /^\d{4}-\d{2}-\d{2}$/);
  });

  it('debe calcular el rango para un mes específico (ej: 2026-09)', () => {
    const range = service.getMonthDateRange('2026-09');
    assert.equal(range.month, '2026-09');
    assert.equal(range.startDate, '2026-09-01');
    assert.equal(range.endDate, '2026-09-30');
  });

  it('debe calcular correctamente años bisiestos (ej: 2024-02)', () => {
    const range = service.getMonthDateRange('2024-02');
    assert.equal(range.startDate, '2024-02-01');
    assert.equal(range.endDate, '2024-02-29');
  });

  it('debe rechazar formatos de mes inválidos', () => {
    assert.throws(() => service.getMonthDateRange('2026/09'), { statusCode: 400 });
    assert.throws(() => service.getMonthDateRange('invalid-month'), { statusCode: 400 });
    assert.throws(() => service.getMonthDateRange('2026-15'), { statusCode: 400 });
  });
});

describe('2. Agregación Financiera y Cruce con Presupuestos (ReportService)', () => {
  it('debe calcular métricas, ahorros y cruce de categorías con presupuestos', async () => {
    const mockTransactions = [
      { id: 't1', amount: 300, category: 'alimentacion', type: 'gasto', date: '2026-09-05', description: 'Supermercado' },
      { id: 't2', amount: 150, category: 'alimentacion', type: 'gasto', date: '2026-09-12', description: 'Restaurante' },
      { id: 't3', amount: 100, category: 'transporte', type: 'gasto', date: '2026-09-10', description: 'Gasolina' },
      { id: 't4', amount: 2000, category: 'salario', type: 'ingreso', date: '2026-09-01', description: 'Nómina quincenal' }
    ];

    const mockBudgets = [
      { id: 'b1', category: 'alimentacion', limitAmount: 400, period: 'mensual' }, // gastado 450 -> sobregasto
      { id: 'b2', category: 'transporte', limitAmount: 200, period: 'mensual' }     // gastado 100 -> dentro de límite
    ];

    const mockRepo = new ReportRepository({ filePath: null, reportsDir: null });
    const mockTxClient = {
      getTransactionsForPeriod: async () => ({ transactions: mockTransactions, count: 4 })
    };
    const mockBudgetClient = {
      getBudgets: async () => mockBudgets
    };

    const service = new ReportService({
      reportRepository: mockRepo,
      transactionClient: mockTxClient,
      budgetClient: mockBudgetClient
    });

    const report = await service.generateMonthlyReport({ month: '2026-09', userId: 'user-01' });

    assert.ok(report.id);
    assert.equal(report.month, '2026-09');
    assert.equal(report.summary.totalExpenses, 550);
    assert.equal(report.summary.totalIncomes, 2000);
    assert.equal(report.summary.netSavings, 1450);
    assert.equal(report.summary.savingsRatePercentage, 72.5);
    assert.equal(report.summary.hasOverspendAlert, true);
    assert.equal(report.summary.overspentCategoriesCount, 1);
    assert.equal(report.summary.topSpendingCategory.category, 'alimentacion');
    assert.equal(report.summary.topSpendingCategory.spent, 450);

    // Revisar la comparación de presupuestos
    const foodComparison = report.reportData.budgetComparison.find(b => b.category === 'alimentacion');
    assert.ok(foodComparison);
    assert.equal(foodComparison.spent, 450);
    assert.equal(foodComparison.budgetLimit, 400);
    assert.equal(foodComparison.status, 'OVER_BUDGET');
    assert.equal(foodComparison.percentageUsed, 112.5);

    const transportComparison = report.reportData.budgetComparison.find(b => b.category === 'transporte');
    assert.ok(transportComparison);
    assert.equal(transportComparison.spent, 100);
    assert.equal(transportComparison.budgetLimit, 200);
    assert.equal(transportComparison.status, 'UNDER_BUDGET');
    assert.equal(transportComparison.percentageUsed, 50);
  });

  it('debe manejar categorías sin presupuesto como NO_BUDGET', async () => {
    const mockTransactions = [
      { id: 't1', amount: 50, category: 'ocio', type: 'gasto', date: '2026-09-02' }
    ];

    const mockRepo = new ReportRepository({ filePath: null, reportsDir: null });
    const service = new ReportService({
      reportRepository: mockRepo,
      transactionClient: { getTransactionsForPeriod: async () => ({ transactions: mockTransactions }) },
      budgetClient: { getBudgets: async () => [] }
    });

    const report = await service.generateMonthlyReport({ month: '2026-09' });
    const ocioComparison = report.reportData.budgetComparison.find(b => b.category === 'ocio');
    assert.ok(ocioComparison);
    assert.equal(ocioComparison.status, 'NO_BUDGET');
    assert.equal(ocioComparison.budgetLimit, null);
  });

  it('debe tolerar fallos o respuestas vacías de los servicios externos', async () => {
    const mockRepo = new ReportRepository({ filePath: null, reportsDir: null });
    const service = new ReportService({
      reportRepository: mockRepo,
      transactionClient: { getTransactionsForPeriod: async () => ({ transactions: [], count: 0 }) },
      budgetClient: { getBudgets: async () => [] }
    });

    const report = await service.generateMonthlyReport({ month: '2026-09' });
    assert.equal(report.summary.totalExpenses, 0);
    assert.equal(report.summary.totalIncomes, 0);
    assert.equal(report.summary.hasOverspendAlert, false);
  });
});

describe('3. Persistencia y Almacenamiento (ReportRepository)', () => {
  let repo;

  beforeEach(() => {
    repo = new ReportRepository({ filePath: null, reportsDir: null });
  });

  it('debe guardar un reporte y permitir su consulta por ID y listado', async () => {
    const saved = await repo.saveReport({
      id: 'test-report-1',
      month: '2026-09',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      userId: 'user-xyz',
      summary: { totalExpenses: 120 },
      data: { title: 'Reporte Test', items: [] }
    });

    assert.equal(saved.id, 'test-report-1');
    assert.equal(saved.fileName, 'report-test-report-1.json');

    const found = await repo.findById('test-report-1');
    assert.ok(found);
    assert.equal(found.metadata.id, 'test-report-1');
    assert.equal(found.data.title, 'Reporte Test');

    const list = await repo.findAll({ userId: 'user-xyz' });
    assert.equal(list.total, 1);
    assert.equal(list.items[0].id, 'test-report-1');
  });

  it('debe obtener el contenido del archivo de reporte para descarga', async () => {
    await repo.saveReport({
      id: 'test-report-download',
      month: '2026-09',
      data: { content: 'hello-report' }
    });

    const fileInfo = await repo.getReportFile('test-report-download');
    assert.ok(fileInfo);
    assert.equal(fileInfo.fileName, 'report-test-report-download.json');
    assert.ok(fileInfo.content.includes('hello-report'));
  });
});

describe('4. Clientes HTTP de Integración (TransactionClient y BudgetClient)', () => {
  it('TransactionClient debe estructurar query params y parsear respuesta exitosa', async () => {
    let capturedUrl = '';
    const fakeFetch = async (url) => {
      capturedUrl = url;
      return {
        ok: true,
        json: async () => ({ transactions: [{ id: 'tx-1', amount: 50 }], totalAmount: 50, count: 1 })
      };
    };

    const client = new TransactionClient({ baseUrl: 'http://transactions-test', fetchFn: fakeFetch });
    const res = await client.getTransactionsForPeriod({
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      userId: 'user-1'
    });

    assert.ok(capturedUrl.includes('startDate=2026-09-01'));
    assert.ok(capturedUrl.includes('endDate=2026-09-30'));
    assert.ok(capturedUrl.includes('userId=user-1'));
    assert.equal(res.count, 1);
    assert.equal(res.transactions[0].id, 'tx-1');
  });

  it('BudgetClient debe procesar respuesta exitosa y manejar fallos de red', async () => {
    const fakeFetchOk = async () => ({
      ok: true,
      json: async () => ({ budgets: [{ id: 'b-1', category: 'ocio', limitAmount: 100 }] })
    });

    const client = new BudgetClient({ baseUrl: 'http://budgets-test', fetchFn: fakeFetchOk });
    const budgets = await client.getBudgets({ userId: 'user-1' });
    assert.equal(budgets.length, 1);
    assert.equal(budgets[0].category, 'ocio');

    // Manejo de error de red
    const fakeFetchErr = async () => { throw new Error('Conexión rehusada'); };
    const clientErr = new BudgetClient({ baseUrl: 'http://budgets-test', fetchFn: fakeFetchErr });
    const emptyBudgets = await clientErr.getBudgets();
    assert.deepEqual(emptyBudgets, []);
  });
});

describe('5. API HTTP Endpoints (Express App)', () => {
  let server;
  let baseUrl;
  let testRepo;
  let testService;
  let testController;
  let generatedReportId = null;

  before(async () => {
    testRepo = new ReportRepository({ filePath: null, reportsDir: null });
    const mockTx = {
      getTransactionsForPeriod: async () => ({
        transactions: [
          { id: 'tx-1', amount: 250, category: 'alimentacion', type: 'gasto', date: '2026-09-10', description: 'Supermercado' },
          { id: 'tx-2', amount: 1500, category: 'salario', type: 'ingreso', date: '2026-09-01', description: 'Pago sueldo' }
        ],
        count: 2
      })
    };
    const mockBg = {
      getBudgets: async () => [
        { id: 'bg-1', category: 'alimentacion', limitAmount: 200, period: 'mensual' }
      ]
    };

    testService = new ReportService({
      reportRepository: testRepo,
      transactionClient: mockTx,
      budgetClient: mockBg
    });

    testController = new ReportController(testService);
    const router = createReportRouter(testController);
    const app = createApp(router);

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('GET /health debe retornar status ok', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'reports-service');
  });

  it('POST /api/reports/current-month debe generar un reporte bajo demanda', async () => {
    const res = await fetch(`${baseUrl}/api/reports/current-month`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'u-123' })
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.reportId);
    assert.ok(body.downloadUrl);
    assert.equal(body.summary.totalExpenses, 250);
    assert.equal(body.summary.totalIncomes, 1500);
    assert.equal(body.summary.netSavings, 1250);
    assert.equal(body.summary.hasOverspendAlert, true); // 250 gastado > 200 presupuesto

    generatedReportId = body.reportId;
  });

  it('GET /api/reports debe listar los reportes generados', async () => {
    const res = await fetch(`${baseUrl}/api/reports?userId=u-123`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.items));
    assert.ok(body.total >= 1);
  });

  it('GET /api/reports/:id debe obtener el detalle del reporte', async () => {
    const res = await fetch(`${baseUrl}/api/reports/${generatedReportId}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.metadata.id, generatedReportId);
    assert.ok(body.data);
    assert.equal(body.data.summary.totalExpenses, 250);
  });

  it('GET /api/reports/:id/download debe descargar el archivo de reporte', async () => {
    const res = await fetch(`${baseUrl}/api/reports/${generatedReportId}/download`);
    assert.equal(res.status, 200);
    assert.ok(res.headers.get('content-disposition')?.includes('attachment'));
    assert.ok(res.headers.get('content-type')?.includes('application/json'));

    const fileContent = await res.json();
    assert.equal(fileContent.id, generatedReportId);
  });

  it('GET /api/reports/:id con ID inexistente debe retornar 404', async () => {
    const res = await fetch(`${baseUrl}/api/reports/non-existent-id`);
    assert.equal(res.status, 404);
  });

  it('Petición a ruta desconocida debe retornar 404', async () => {
    const res = await fetch(`${baseUrl}/api/unknown-endpoint`);
    assert.equal(res.status, 404);
  });
});

describe('6. Sanitización de Logs (logger)', () => {
  it('debe enmascarar contraseñas, tokens y JWTs', () => {
    const payload = {
      user: 'admin',
      password: 'mySecretPassword123',
      token: 'secret-token-xyz',
      authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMCda8Yhe3iZaWbvV5XKSTbuAn0M'
    };

    const cleaned = sanitize(payload);
    assert.equal(cleaned.password, '[REDACTED]');
    assert.equal(cleaned.token, '[REDACTED]');
    assert.ok(cleaned.authorization.includes('[REDACTED]'));
    assert.equal(cleaned.user, 'admin');
  });
});
