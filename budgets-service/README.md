# 📊 Centavo — Microservicio de Presupuestos (`budgets-service`)

Este microservicio gestiona la definición, consulta y control de techos de gasto por categoría y período para el ecosistema **Centavo**.

---

## 🛡️ Directivas y Reglas Operativas (`AGENTS.md`)

Este servicio sigue directivas estrictas de consistencia financiera:
1. **Validación Numérica**: Todo monto límite debe ser estrictamente numérico, mayor a 0 y redondeado a 2 decimales.
2. **Requisitos de Registro**: Todo presupuesto debe contar con categoría válida, monto límite positivo y período.
3. **Categorización Centralizada**: La normalización de categorías (sin tildes, minúsculas) y el catálogo estándar se gestiona en `src/services/categoryService.js`.
4. **Sanitización de Logs**: Se utiliza `src/utils/logger.js` para evitar registrar credenciales o tokens en texto plano.

---

## 📦 Arquitectura de Módulos

```text
budgets-service/
├── src/
│   ├── controllers/
│   │   └── budgetController.js    # Manejadores de peticiones HTTP (create, list, getById, getCategories)
│   ├── repositories/
│   │   └── budgetRepository.js    # Persistencia dual (memoria + archivo JSON en disco)
│   ├── routes/
│   │   └── budgetRoutes.js        # Definición de rutas REST (/api/budgets)
│   ├── services/
│   │   ├── categoryService.js     # Catálogo y normalización estandarizada de categorías
│   │   └── budgetService.js       # Lógica de negocio y validación de presupuestos
│   ├── utils/
│   │   └── logger.js              # Logger estructurado JSON con sanitización automática
│   ├── app.js                     # Configuración de Express, CORS y middlewares
│   └── server.js                  # Listener HTTP y manejo de señales SIGINT/SIGTERM
├── tests/
│   └── budget.test.js             # Pruebas automatizadas (Node.js test runner)
├── data/
│   └── budgets.json               # Persistencia local por defecto
├── .dockerignore
├── .env.example                   # Variables de entorno de ejemplo
├── .env                           # Variables de entorno locales
├── AGENTS.md                      # Reglas operativas para agentes de IA
├── Dockerfile                     # Contenedor Docker para producción
└── package.json                   # Dependencias y scripts
```

---

## ⚙️ Variables de Entorno

| Variable | Descripción | Valor por Defecto |
| :--- | :--- | :--- |
| `PORT` | Puerto donde corre el microservicio | `4003` |
| `NODE_ENV` | Entorno de ejecución (`development`, `production`, `test`) | `development` |
| `DATA_FILE_PATH` | Ruta para almacenar la persistencia de presupuestos (JSON) | `./data/budgets.json` |

---

## 🚀 Endpoints de la API

### 1. Crear Presupuesto
- **Ruta**: `POST /api/budgets`
- **Body**:
  ```json
  {
    "category": "Alimentación",
    "limitAmount": 350000.50,
    "period": "mensual",
    "userId": "usr_abc123"
  }
  ```
- **Respuesta (201 Created)**:
  ```json
  {
    "message": "Presupuesto creado con éxito",
    "budget": {
      "id": "7b58c5c7-9204-43cb-bfa2-fc8e815fa25d",
      "category": "alimentacion",
      "limitAmount": 350000.5,
      "period": "mensual",
      "userId": "usr_abc123",
      "createdAt": "2026-09-22T10:00:00.000Z",
      "updatedAt": "2026-09-22T10:00:00.000Z"
    }
  }
  ```

### 2. Consultar Presupuestos (con filtros)
- **Ruta**: `GET /api/budgets`
- **Parámetros de consulta opcionales (`Query Params`)**:
  - `category`: Filtrar por categoría (ej. `alimentacion`).
  - `period`: Filtrar por período (ej. `mensual`, `semanal`).
  - `userId`: Filtrar por ID de usuario.
  - `limit`: Número máximo de registros.
  - `offset`: Desplazamiento para paginación.
- **Respuesta (200 OK)**:
  ```json
  {
    "message": "Presupuestos obtenidos correctamente",
    "budgets": [
      {
        "id": "7b58c5c7-9204-43cb-bfa2-fc8e815fa25d",
        "category": "alimentacion",
        "limitAmount": 350000.5,
        "period": "mensual",
        "userId": "usr_abc123",
        "createdAt": "2026-09-22T10:00:00.000Z",
        "updatedAt": "2026-09-22T10:00:00.000Z"
      }
    ],
    "count": 1,
    "total": 1,
    "offset": 0,
    "limit": null
  }
  ```

### 3. Consultar Presupuesto por ID
- **Ruta**: `GET /api/budgets/:id`
- **Respuesta (200 OK)**:
  ```json
  {
    "message": "Presupuesto obtenido con éxito",
    "budget": {
      "id": "7b58c5c7-9204-43cb-bfa2-fc8e815fa25d",
      "category": "alimentacion",
      "limitAmount": 350000.5,
      "period": "mensual",
      "userId": "usr_abc123",
      "createdAt": "2026-09-22T10:00:00.000Z",
      "updatedAt": "2026-09-22T10:00:00.000Z"
    }
  }
  ```

### 4. Consultar Categorías Soportadas
- **Ruta**: `GET /api/budgets/categories`
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
    "service": "budgets-service"
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
