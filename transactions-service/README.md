# 💳 Centavo — Microservicio de Transacciones (`transactions-service`)

Este microservicio gestiona el registro, persistencia y categorización de gastos e ingresos para el ecosistema **Centavo**.

---

## 🛡️ Directivas y Reglas Operativas (`AGENTS.md`)

Este servicio sigue directivas estrictas de consistencia financiera:
1. **Validación Numérica**: Todo monto debe ser estrictamente numérico, mayor a 0 y con precisión estándar redondeada a 2 decimales.
2. **Requisitos de Registro**: Toda transacción debe contar al menos con monto, categoría y fecha válida.
3. **Categorización Centralizada**: La asignación, normalización (sin tildes, minúsculas) y sugerencias de categorías se gestiona en `src/services/categoryService.js`.
4. **Sanitización de Logs**: Se utiliza `src/utils/logger.js` para evitar registrar credenciales, números de tarjetas o tokens en texto plano.

---

## 📦 Arquitectura de Módulos

```text
transactions-service/
├── src/
│   ├── controllers/
│   │   └── transactionController.js   # Manejadores de peticiones HTTP (create, list, getById, getCategories)
│   ├── repositories/
│   │   └── transactionRepository.js   # Almacenamiento en memoria y persistencia JSON en disco
│   ├── routes/
│   │   └── transactionRoutes.js       # Definición de rutas REST (/api/transactions)
│   ├── services/
│   │   ├── categoryService.js         # Catálogo de categorías, normalización y sugerencias
│   │   └── transactionService.js      # Lógica de negocio y validación de transacciones
│   ├── utils/
│   │   └── logger.js                  # Logger estructurado JSON con sanitización automática
│   ├── app.js                         # Configuración de Express, CORS y middlewares
│   └── server.js                      # Listener HTTP y manejo de señales SIGINT/SIGTERM
├── tests/
│   └── transaction.test.js            # Pruebas automatizadas (Node.js test runner)
├── .env.example                       # Variables de entorno de ejemplo
├── .env                               # Variables de entorno locales
├── AGENTS.md                          # Reglas operativas para agentes de IA
├── Dockerfile                         # Contenedor Docker para producción
└── package.json                       # Dependencias y scripts
```

---

## ⚙️ Variables de Entorno

| Variable | Descripción | Valor por Defecto |
| :--- | :--- | :--- |
| `PORT` | Puerto donde corre el microservicio | `4002` |
| `NODE_ENV` | Entorno de ejecución (`development`, `production`, `test`) | `development` |
| `DATA_FILE_PATH` | Ruta para almacenar la persistencia de transacciones (JSON) | `./data/transactions.json` |

---

## 🚀 Endpoints de la API

### 1. Registrar Transacción (Gasto)
- **Ruta**: `POST /api/transactions`
- **Body**:
  ```json
  {
    "amount": 25000.50,
    "category": "Alimentación",
    "date": "2026-09-21T13:00:00.000Z",
    "description": "Almuerzo de trabajo",
    "type": "gasto"
  }
  ```
- **Respuesta (201 Created)**:
  ```json
  {
    "message": "Transacción registrada con éxito",
    "transaction": {
      "id": "e4a28f80-0887-410a-81be-cc0bece2f0ea",
      "amount": 25000.5,
      "category": "alimentacion",
      "date": "2026-09-21T13:00:00.000Z",
      "description": "Almuerzo de trabajo",
      "type": "gasto",
      "userId": null,
      "createdAt": "2026-09-21T21:00:00.000Z"
    }
  }
  ```

### 2. Listar Transacciones con Filtros
- **Ruta**: `GET /api/transactions`
- **Parámetros de consulta opcionales (`Query Params`)**:
  - `category`: Filtrar por categoría (ej. `alimentacion`, `transporte`).
  - `startDate`: Fecha mínima en formato ISO o YYYY-MM-DD.
  - `endDate`: Fecha máxima en formato ISO o YYYY-MM-DD.
  - `type`: Filtrar por tipo (`gasto` o `ingreso`).
  - `limit`: Número máximo de registros a devolver.
  - `offset`: Desplazamiento para paginación.
- **Respuesta (200 OK)**:
  ```json
  {
    "message": "Transacciones obtenidas correctamente",
    "transactions": [
      {
        "id": "e4a28f80-0887-410a-81be-cc0bece2f0ea",
        "amount": 25000.5,
        "category": "alimentacion",
        "date": "2026-09-21T13:00:00.000Z",
        "description": "Almuerzo de trabajo",
        "type": "gasto",
        "userId": null,
        "createdAt": "2026-09-21T21:00:00.000Z"
      }
    ],
    "count": 1,
    "total": 1,
    "totalAmount": 25000.5
  }
  ```

### 3. Obtener Transacción por ID
- **Ruta**: `GET /api/transactions/:id`
- **Respuesta (200 OK)**:
  ```json
  {
    "message": "Transacción obtenida con éxito",
    "transaction": {
      "id": "e4a28f80-0887-410a-81be-cc0bece2f0ea",
      "amount": 25000.5,
      "category": "alimentacion",
      "date": "2026-09-21T13:00:00.000Z",
      "description": "Almuerzo de trabajo",
      "type": "gasto",
      "userId": null,
      "createdAt": "2026-09-21T21:00:00.000Z"
    }
  }
  ```

### 4. Catálogo de Categorías
- **Ruta**: `GET /api/transactions/categories`
- **Respuesta (200 OK)**:
  ```json
  {
    "categories": [
      "alimentacion",
      "transporte",
      "vivienda",
      "servicios",
      "ocio",
      "salud",
      "educacion",
      "otros"
    ]
  }
  ```

### 5. Health Check
- **Ruta**: `GET /health`
- **Respuesta (200 OK)**:
  ```json
  {
    "status": "ok",
    "service": "transactions-service"
  }
  ```

---

## 🧪 Pruebas Automatizadas

Para ejecutar la suite de pruebas del microservicio:
```bash
npm test
```
Utiliza el test runner nativo de Node.js (`node:test`) y aserciones estrictas (`node:assert/strict`).
