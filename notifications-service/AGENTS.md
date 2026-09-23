Ten en cuenta siempre las directivas del README.md de este servicio antes de proponer
cualquier cambio. Este servicio gestiona las alertas de sobregasto y notificaciones del sistema Centavo.
1. La evaluación de sobregasto debe comparar el gasto acumulado en el período de la categoría contra el límite fijado en budgets-service.
2. Solo las transacciones de tipo 'gasto' son elegibles para generar alertas de sobregasto; ignorar 'ingreso'.
3. Las alertas generadas deben contar con identificador único, categoría, severidad, exceso de gasto y mensaje explicativo claro.
4. El servicio debe ser tolerante a fallos si un servicio externo (budgets o transactions) no responde.
5. Nunca expongas datos internos innecesarios en las respuestas o logs de error.
