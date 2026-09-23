import crypto from 'crypto';
import { defaultReportRepository } from '../repositories/reportRepository.js';
import { defaultTransactionClient } from './transactionClient.js';
import { defaultBudgetClient } from './budgetClient.js';
import { logger } from '../utils/logger.js';

export class ReportService {
  constructor({
    reportRepository = defaultReportRepository,
    transactionClient = defaultTransactionClient,
    budgetClient = defaultBudgetClient
  } = {}) {
    this.reportRepository = reportRepository;
    this.transactionClient = transactionClient;
    this.budgetClient = budgetClient;
  }

  /**
   * Calcula el rango de fechas para un mes específico (YYYY-MM) o el mes actual por defecto.
   */
  getMonthDateRange(monthStr = null) {
    let year;
    let monthIndex; // 0-11

    if (monthStr) {
      const match = String(monthStr).trim().match(/^(\d{4})-(\d{2})$/);
      if (!match) {
        const error = new Error("Formato de mes inválido. Se espera formato 'YYYY-MM' (ejemplo: '2026-09')");
        error.statusCode = 400;
        throw error;
      }
      year = parseInt(match[1], 10);
      monthIndex = parseInt(match[2], 10) - 1;

      if (monthIndex < 0 || monthIndex > 11) {
        const error = new Error("Mes fuera de rango válido (01 a 12)");
        error.statusCode = 400;
        throw error;
      }
    } else {
      const now = new Date();
      year = now.getFullYear();
      monthIndex = now.getMonth();
    }

    const pad = (n) => String(n).padStart(2, '0');
    const monthFormatted = `${year}-${pad(monthIndex + 1)}`;
    const startDate = `${year}-${pad(monthIndex + 1)}-01`;

    // El día 0 del mes siguiente nos da el último día del mes actual
    const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    const endDate = `${year}-${pad(monthIndex + 1)}-${pad(lastDay)}`;

    return {
      month: monthFormatted,
      startDate,
      endDate
    };
  }

  /**
   * Genera el reporte mensual agregando información de transacciones y presupuestos.
   */
  async generateMonthlyReport({ month = null, userId = null } = {}) {
    const { month: targetMonth, startDate, endDate } = this.getMonthDateRange(month);

    logger.info('Iniciando generación de reporte mensual', {
      month: targetMonth,
      startDate,
      endDate,
      userId
    });

    // 1. Obtener datos de servicios en paralelo
    const [transactionsData, budgets] = await Promise.all([
      this.transactionClient.getTransactionsForPeriod({ startDate, endDate, userId }),
      this.budgetClient.getBudgets({ period: 'mensual', userId })
    ]);

    const transactions = transactionsData.transactions || [];

    // 2. Procesar transacciones (gastos e ingresos)
    const expenses = [];
    const incomes = [];
    const expensesByCategory = new Map();
    let totalExpenses = 0;
    let totalIncomes = 0;

    for (const tx of transactions) {
      const amount = Number(tx.amount) || 0;
      const txType = (tx.type || 'gasto').trim().toLowerCase();
      const cat = (tx.category || 'general').trim().toLowerCase();

      if (txType === 'ingreso') {
        incomes.push(tx);
        totalIncomes += amount;
      } else {
        // Por defecto o 'gasto'
        expenses.push(tx);
        totalExpenses += amount;

        const currentCat = expensesByCategory.get(cat) || {
          category: cat,
          spent: 0,
          count: 0,
          transactions: []
        };
        currentCat.spent += amount;
        currentCat.count += 1;
        currentCat.transactions.push({
          id: tx.id,
          date: tx.date,
          amount,
          description: tx.description
        });
        expensesByCategory.set(cat, currentCat);
      }
    }

    totalExpenses = Math.round(totalExpenses * 100) / 100;
    totalIncomes = Math.round(totalIncomes * 100) / 100;
    const netSavings = Math.round((totalIncomes - totalExpenses) * 100) / 100;
    const savingsRate = totalIncomes > 0
      ? Math.round((netSavings / totalIncomes) * 10000) / 100
      : 0;

    // 3. Procesar presupuestos y comparar con gastos
    const budgetsByCategory = new Map();
    let totalBudget = 0;

    for (const b of budgets) {
      const cat = (b.category || 'general').trim().toLowerCase();
      const limit = Number(b.limitAmount) || 0;
      budgetsByCategory.set(cat, b);
      totalBudget += limit;
    }
    totalBudget = Math.round(totalBudget * 100) / 100;

    // Unificar categorías (las que tienen presupuesto + las que tienen gastos)
    const allCategories = new Set([
      ...budgetsByCategory.keys(),
      ...expensesByCategory.keys()
    ]);

    const budgetComparison = [];
    const overspentCategories = [];
    let topSpendingCategory = null;

    for (const cat of allCategories) {
      const budgetObj = budgetsByCategory.get(cat);
      const expenseObj = expensesByCategory.get(cat);

      const spent = expenseObj ? Math.round(expenseObj.spent * 100) / 100 : 0;
      const count = expenseObj ? expenseObj.count : 0;
      const limitAmount = budgetObj ? Math.round(Number(budgetObj.limitAmount) * 100) / 100 : null;

      let difference = null;
      let percentageUsed = null;
      let status = 'NO_BUDGET';

      if (limitAmount !== null && limitAmount > 0) {
        difference = Math.round((limitAmount - spent) * 100) / 100;
        percentageUsed = Math.round((spent / limitAmount) * 10000) / 100;

        if (spent > limitAmount) {
          status = 'OVER_BUDGET';
          overspentCategories.push({
            category: cat,
            spent,
            limitAmount,
            excess: Math.round((spent - limitAmount) * 100) / 100,
            percentageUsed
          });
        } else if (percentageUsed >= 80) {
          status = 'NEAR_LIMIT';
        } else {
          status = 'UNDER_BUDGET';
        }
      }

      const item = {
        category: cat,
        spent,
        transactionsCount: count,
        budgetLimit: limitAmount,
        difference,
        percentageUsed,
        status
      };

      budgetComparison.push(item);

      if (!topSpendingCategory || spent > topSpendingCategory.spent) {
        if (spent > 0) {
          topSpendingCategory = { category: cat, spent };
        }
      }
    }

    // Ordenar comparación de presupuestos por mayor gasto
    budgetComparison.sort((a, b) => b.spent - a.spent);

    // Análisis de categorías ordenadas
    const categoryAnalysis = Array.from(expensesByCategory.values())
      .map(item => ({
        category: item.category,
        spent: Math.round(item.spent * 100) / 100,
        count: item.count,
        percentageOfTotalExpenses: totalExpenses > 0
          ? Math.round((item.spent / totalExpenses) * 10000) / 100
          : 0
      }))
      .sort((a, b) => b.spent - a.spent);

    const reportId = crypto.randomUUID();
    const now = new Date().toISOString();

    const summary = {
      totalExpenses,
      totalIncomes,
      netSavings,
      savingsRatePercentage: savingsRate,
      totalBudgeted: totalBudget,
      totalSpentInBudgetedCategories: Math.round(
        budgetComparison.filter(b => b.budgetLimit !== null).reduce((sum, b) => sum + b.spent, 0) * 100
      ) / 100,
      overspentCategoriesCount: overspentCategories.length,
      hasOverspendAlert: overspentCategories.length > 0,
      topSpendingCategory,
      totalTransactionsCount: transactions.length,
      expensesCount: expenses.length,
      incomesCount: incomes.length
    };

    const fullReportData = {
      id: reportId,
      title: `Reporte Mensual de Finanzas y Gastos - ${targetMonth}`,
      generatedAt: now,
      period: {
        month: targetMonth,
        startDate,
        endDate
      },
      user: {
        userId: userId || null
      },
      summary,
      budgetComparison,
      categoryAnalysis,
      transactions: {
        expenses,
        incomes
      }
    };

    // 4. Guardar archivo físico y registrar metadata en el repositorio
    const savedRecord = await this.reportRepository.saveReport({
      id: reportId,
      month: targetMonth,
      startDate,
      endDate,
      userId,
      summary,
      data: fullReportData
    });

    logger.info('Reporte mensual generado y guardado exitosamente', {
      reportId,
      month: targetMonth,
      fileName: savedRecord.fileName,
      totalExpenses
    });

    return {
      ...savedRecord,
      reportData: fullReportData
    };
  }

  async getReports(filters = {}) {
    return await this.reportRepository.findAll(filters);
  }

  async getReportById(id) {
    if (!id || typeof id !== 'string') {
      const error = new Error('El ID del reporte es obligatorio');
      error.statusCode = 400;
      throw error;
    }

    const report = await this.reportRepository.findById(id);
    if (!report) {
      const error = new Error('Reporte no encontrado');
      error.statusCode = 404;
      throw error;
    }

    return report;
  }

  async getReportFile(id) {
    if (!id || typeof id !== 'string') {
      const error = new Error('El ID del reporte es obligatorio');
      error.statusCode = 400;
      throw error;
    }

    const fileInfo = await this.reportRepository.getReportFile(id);
    if (!fileInfo) {
      const error = new Error('Archivo de reporte no encontrado');
      error.statusCode = 404;
      throw error;
    }

    return fileInfo;
  }
}

export const defaultReportService = new ReportService();
