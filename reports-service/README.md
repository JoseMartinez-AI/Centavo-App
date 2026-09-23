# 📈 Centavo — Microservicio de Reportes Financieros (`reports-service`)

Este microservicio es responsable del procesamiento analítico, agregación y generación periódica o bajo demanda de balances financieros y reportes de gastos mensuales para el ecosistema **Centavo**, consumiendo datos de `transactions-service` y `budgets-service`, y persistiendo físicamente cada reporte generado para su posterior consulta y descarga.

---

## 🛡️ Directivas y Reglas Operativas (`AGENTS.md`)

Este servicio sigue directivas de arquitectura desacoplada, consistencia analítica y persistencia segura:
1. **Agregación Mensual**: Consolida transacciones (ingresos y gastos) dentro del intervalo temporal del mes seleccionado o el mes actual por defecto (`YYYY-MM-01` hasta el último día del mes).
2. **Cruce con Presupuestos**: Compara el gasto real acumulado por categoría frente a los límites definidos en `budgets-service`, identificando categorías con sobregasto (`OVER_BUDGET`), próximas al límite (`NEAR_LIMIT`) o dentro del presupuesto (`UNDER_BUDGET`).
3. **Persistencia Física de Archivo**: Cada reporte generado se almacena como un archivo JSON independiente en disco (`./data/reports/report-{id}.json`), permitiendo su descarga directa e inalterable posterior.
4. **Resiliencia y Tolerancia a Fallos**: Si alguno de los servicios externos (`transactions-service` o `budgets-service`) no responde o genera un error, el servicio aplica degradación elegante retornando la información disponible sin interrumpir el flujo.
5. **Sanitización de Logs**: Se utiliza `src/utils/logger.js` para redactar cualquier credencial o dato sensible antes de ser emitido a consola.

---

## 📦 Arquitectura de Módulos

```text
reports-service/
├── src/
│   ├── controllers/
│   │   └── reportController.js         # Manejadores de endpoints HTTP (generar, listar, detalle, descarga)
│   ├── repositories/
│   │   └── reportRepository.js         # Persistencia dual (índice en memoria/JSON + archivos de reporte en disco)
│   ├── routes/
│   │   └── reportRoutes.js             # Definición de rutas REST (/api/reports)
│   ├── services/
│   │   ├── budgetClient.js             # Cliente HTTP desacoplado para consultar budgets-service
│   │   ├── transactionClient.js        # Cliente HTTP desacoplado para consultar transactions-service
│   │   └── reportService.js            # Lógica analítica, agregación de gastos y cruce presupuestario
│   ├── utils/
│   │   └── logger.js                   # Logger estructurado JSON con sanitización automática
│   ├── app.js                          # Configuración de Express, CORS y middlewares
│   └── server.js                       # Listener HTTP y manejo de señales SIGINT/SIGTERM
├── tests/
│   └── report.test.js                  # Pruebas unitarias e integración (Node.js test runner)
├── data/
│   ├── reports/                        # Directorio donde se guardan físicamente los reportes generados (.json)
│   └── reports.json                    # Registro e índice persistente de reportes
├── .dockerignore
├── .env.example                        # Plantilla de variables de entorno
├── .env                                # Variables de entorno locales
├── AGENTS.md                           # Directivas operativas para agentes
├── Dockerfile                          # Contenedor Docker para producción
└── package.json                        # Dependencias y scripts del microservicio
```

---

## ⚙️ Variables de Entorno

| Variable | Descripción | Valor por Defecto |
| :--- | :--- | :--- |
| `PORT` | Puerto donde corre el microservicio | `4005` |
| `NODE_ENV` | Entorno de ejecución (`development`, `production`, `test`) | `development` |
| `TRANSACTIONS_SERVICE_URL` | URL base de conexión al microservicio de transacciones | `http://localhost:4002` |
| `BUDGETS_SERVICE_URL` | URL base de conexión al microservicio de presupuestos | `http://localhost:4003` |
| `DATA_FILE_PATH` | Ruta del archivo de índice de reportes (JSON) | `./data/reports.json` |
| `REPORTS_DIR` | Directorio donde se guardan físicamente los archivos de reportes | `./data/reports` |

---

## 🔌 Endpoints de la API REST

### 1. Health Check
- **`GET /health`**
- **Respuesta `200 OK`**:
```json
{
  "status": "ok",
  "service": "reports-service"
}
```

### 2. Generar Reporte Mensual Bajo Demanda
- **`POST /api/reports/current-month`** (o alias **`POST /api/reports/monthly`**)
- **Cuerpo Opcional (`application/json`)**:
```json
{
  "month": "2026-09",
  "userId": "user-123"
}
```
*(Si no se especifica `month`, se toma automáticamente el mes actual en curso)*.

- **Respuesta Exitosa `201 Created`**:
```json
{
  "message": "Reporte mensual generado y guardado exitosamente",
  "reportId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "month": "2026-09",
  "startDate": "2026-09-01",
  "endDate": "2026-09-30",
  "fileName": "report-f47ac10b-58cc-4372-a567-0e02b2c3d479.json",
  "downloadUrl": "/api/reports/f47ac10b-58cc-4372-a567-0e02b2c3d479/download",
  "summary": {
    "totalExpenses": 1450.50,
    "totalIncomes": 3200.00,
    "netSavings": 1749.50,
    "savingsRatePercentage": 54.67,
    "totalBudgeted": 1600.00,
    "overspentCategoriesCount": 1,
    "hasOverspendAlert": true,
    "topSpendingCategory": {
      "category": "alimentacion",
      "spent": 850.50
    },
    "totalTransactionsCount": 12,
    "expensesCount": 10,
    "incomesCount": 2
  },
  "reportData": { ... }
}
```

### 3. Listar Reportes Generados
- **`GET /api/reports?month=2026-09&userId=user-123&limit=10&offset=0`**
- **Respuesta `200 OK`**:
```json
{
  "message": "Reportes obtenidos correctamente",
  "items": [
    {
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "userId": "user-123",
      "month": "2026-09",
      "startDate": "2026-09-01",
      "endDate": "2026-09-30",
      "fileName": "report-f47ac10b-58cc-4372-a567-0e02b2c3d479.json",
      "filePath": "./data/reports/report-f47ac10b-58cc-4372-a567-0e02b2c3d479.json",
      "summary": { ... },
      "generatedAt": "2026-09-22T17:53:00.000Z"
    }
  ],
  "total": 1,
  "count": 1,
  "offset": 0,
  "limit": 10
}
```

### 4. Consultar Detalle Completo de Reporte
- **`GET /api/reports/:id`**
- **Respuesta `200 OK`**: Retorna el registro metadata y la estructura completa del reporte (`budgetComparison`, `categoryAnalysis`, transacciones agregadas, etc.).

### 5. Descargar Archivo Físico del Reporte
- **`GET /api/reports/:id/download`**
- Retorna el archivo con cabeceras HTTP `Content-Type: application/json` y `Content-Disposition: attachment; filename="report-{id}.json"` para descarga inmediata en el navegador o cliente HTTP.

---

## 🛠️ Comandos de Ejecución y Pruebas

```bash
# 1. Instalar dependencias
npm install

# 2. Ejecutar pruebas unitarias e integración
npm test

# 3. Iniciar en modo desarrollo con recarga automática
npm run dev

# 4. Iniciar en modo producción
npm start
```

---

## 🐳 Contenedor Docker

```bash
# Construir la imagen
docker build -t centavo-reports-service .

# Ejecutar el contenedor
docker run -p 4005:4005 --env-file .env centavo-reports-service
```
