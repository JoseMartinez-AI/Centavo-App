Ten en cuenta siempre las directivas del README.md de este servicio antes de proponer
cualquier cambio. Este servicio procesa y genera reportes analíticos financieros.
1. Los reportes mensuales deben agregar transacciones (gastos e ingresos) del mes en curso o del período indicado.
2. Se debe cruzar el gasto por categoría con los límites presupuestarios definidos en budgets-service.
3. El resultado de cada reporte generado debe guardarse físicamente como un archivo accesible para consultas y descargas posteriores.
4. Tolera fallos en servicios externos: si transactions-service o budgets-service no responden o tienen demoras, maneja los errores con resiliencia sin romper la estabilidad del servicio.
5. Utiliza siempre el logger con sanitización automática (src/utils/logger.js) y nunca expongas credenciales o datos sensibles.
