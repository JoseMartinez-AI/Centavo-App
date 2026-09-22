# 🔔 Centavo — Microservicio de Alertas y Notificaciones (`notifications-service`)

Este microservicio gestiona la recepción de eventos de transacciones, la evaluación del gasto acumulado frente a los techos presupuestarios definidos en `budgets-service`, la emisión de alertas inmediatas de sobregasto y el ciclo de vida de las notificaciones para el ecosistema **Centavo**.

---

## 🛡️ Directivas y Reglas Operativas (`AGENTS.md`)

Este servicio sigue directivas estrictas de consistencia financiera y arquitectura desacoplada:
1. **Evaluación de Sobregasto**: Se compara el gasto acumulado en el período de la categoría contra el límite fijado en `budgets-service`.
2. **Discriminación de Tipos de Movimiento**: Solo las transacciones de tipo `'gasto'` generan alertas de sobregasto. Las transacciones de tipo `'ingreso'` son ignoradas sin emitir alerta.
3. **Estructura de Alerta**: Las alertas generadas deben contar con identificador único, categoría normalizada, severidad (`HIGH` o `CRITICAL`), cálculo del exceso de gasto y mensaje explicativo al usuario.
4. **Tolerancia a Fallos**: Si un microservicio externo (`budgets-service` o `transactions-service`) no responde, el servicio maneja la excepción sin caer en un fallo crítico.
5. **Sanitización de Logs**: Se utiliza `src/utils/logger.js` para evitar registrar credenciales o tokens en texto plano.

---

## 📦 Arquitectura de Módulos

```text
notifications-service/
├── src/
│   ├── controllers/
│   │   └── notificationController.js   # Manejadores de peticiones HTTP (eventos, listar, detalle, marcar leído)
│   ├── repositories/
│   │   └── notificationRepository.js   # Persistencia dual (memoria + archivo JSON en disco)
│   ├── routes/
│   │   └── notificationRoutes.js       # Definición de rutas REST (/api/notifications)
│   ├── services/
│   │   ├── budgetClient.js             # Cliente HTTP desacoplado para consultar budgets-service
│   │   ├── transactionClient.js        # Cliente HTTP desacoplado para consultar transactions-service
│   │   └── notificationService.js      # Lógica de negocio y evaluación de sobregasto
│   ├── utils/
│   │   └── logger.js                   # Logger estructurado JSON con sanitización automática
│   ├── app.js                          # Configuración de Express, CORS y middlewares
│   └── server.js                       # Listener HTTP y manejo de señales SIGINT/SIGTERM
├── tests/
│   └── notification.test.js            # Pruebas automatizadas (Node.js test runner)
├── data/
│   └── notifications.json              # Persistencia local por defecto
├── .dockerignore
├── .env.example                        # Variables de entorno de ejemplo
├── .env                                # Variables de entorno locales
├── AGENTS.md                           # Reglas operativas para agentes de IA
├── Dockerfile                          # Contenedor Docker para producción
└── package.json                        # Dependencias y scripts
```

---

## ⚙️ Variables de Entorno

| Variable | Descripción | Valor por Defecto |
| :--- | :--- | :--- |
| `PORT` | Puerto donde corre el microservicio | `4004` |
| `NODE_ENV` | Entorno de ejecución (`development`, `production`, `test`) | `development` |
| `BUDGETS_SERVICE_URL` | URL base de conexión al microservicio de presupuestos | `http://localhost:4003` |
| `TRANSACTIONS_SERVICE_URL` | URL base de conexión al microservicio de transacciones | `http://localhost:4002` |
| `DATA_FILE_PATH` | Ruta para almacenar la persistencia de alertas (JSON) | `./data/notifications.json` |

---

## 🚀 Endpoints de la API

### 1. Recibir Evento de Transacción y Evaluar Sobregasto
- **Ruta**: `POST /api/notifications/events/transaction` (o `POST /api/events/transaction`)
- **Body**:
  ```json
  {
    "transactionId": "tx_abc123",
    "userId": "usr_test01",
    "category": "Alimentación",
    "amount": 45000.00,
    "type": "gasto",
    "date": "2026-09-22T12:00:00.000Z",
    "description": "Cena restaurante"
  }
  ```
- **Respuesta si se genera alerta (201 Created)**:
  ```json
  {
    "message": "Alerta de sobregasto generada con éxito",
    "processed": true,
    "alertGenerated": true,
    "alert": {
      "id": "762c938d-8a02-4fc9-b684-2191986aa0dc",
      "userId": "usr_test01",
      "type": "OVERSPEND_ALERT",
      "severity": "HIGH",
      "category": "alimentacion",
      "budgetLimit": 100000,
      "currentSpent": 115000,
      "excessAmount": 15000,
      "percentageUsed": 115,
      "transactionId": "tx_abc123",
      "message": "¡Alerta de sobregasto! Has superado el presupuesto de 'alimentacion' por $15000.00 (Límite: $100000.00, Total gastado: $115000.00).",
      "read": false,
      "createdAt": "2026-09-22T17:00:00.000Z",
      "updatedAt": "2026-09-22T17:00:00.000Z"
    },
    "budgetStatus": {
      "category": "alimentacion",
      "limitAmount": 100000,
      "currentSpent": 115000,
      "percentageUsed": 115,
      "isExceeded": true,
      "excessAmount": 15000
    }
  }
  ```
- **Respuesta si está dentro del presupuesto (200 OK)**:
  ```json
  {
    "message": "Transacción evaluada dentro del presupuesto",
    "processed": true,
    "alertGenerated": false,
    "alert": null,
    "budgetStatus": {
      "category": "alimentacion",
      "limitAmount": 100000,
      "currentSpent": 45000,
      "percentageUsed": 45,
      "isExceeded": false,
      "excessAmount": 0
    }
  }
  ```

### 2. Consultar Alertas / Notificaciones
- **Ruta**: `GET /api/notifications`
- **Parámetros opcionales**: `userId`, `category`, `type`, `unreadOnly`, `limit`, `offset`.
- **Respuesta (200 OK)**:
  ```json
  {
    "message": "Notificaciones obtenidas correctamente",
    "notifications": [ ... ],
    "count": 1,
    "total": 1,
    "offset": 0,
    "limit": null
  }
  ```

### 3. Consultar Alerta por ID
- **Ruta**: `GET /api/notifications/:id`
- **Respuesta (200 OK)**

### 4. Marcar Alerta como Leída
- **Ruta**: `PATCH /api/notifications/:id/read`
- **Respuesta (200 OK)**

### 5. Health Check
- **Ruta**: `GET /health`
- **Respuesta (200 OK)**:
  ```json
  {
    "status": "ok",
    "service": "notifications-service"
  }
  ```

---

## 💻 Desarrollo Local

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar en modo desarrollo con recarga automática
npm run dev

# 3. Ejecutar pruebas unitarias y de integración
npm test
```
