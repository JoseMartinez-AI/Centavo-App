# 🔐 Centavo — Microservicio de Autenticación (`auth-service`)

Este microservicio se encarga de la gestión de identidades, registro, inicio de sesión y verificación de sesiones para el ecosistema **Centavo**.

---

## 🛡️ Directivas y Reglas de Seguridad (`AGENTS.md`)

Este servicio sigue estrictamente las directivas de seguridad establecidas en `AGENTS.md`:
1. **Confidencialidad en Logs**: Bajo ninguna circunstancia se registran en los logs contraseñas, hashes, credenciales ni tokens JWT en texto plano. Todo dato sensible se sanitiza mediante `src/utils/logger.js`.
2. **Validación Central de Sesión**: Toda validación de sesión (endpoints HTTP, middlewares de rutas o llamadas internas) debe pasar exclusivamente por el módulo central `src/services/sessionValidator.js`.
3. **Justificación de Hashing**: La lógica de contraseñas utiliza `bcryptjs` con 10 rondas de salt para garantizar protección ante fuerza bruta y tablas rainbow. Cualquier modificación futura requiere justificación explícita documentada.

---

## 📦 Arquitectura de Módulos

```text
auth-service/
├── src/
│   ├── controllers/
│   │   └── authController.js      # Manejadores de rutas HTTP (register, login, verifySession)
│   ├── middlewares/
│   │   └── authMiddleware.js      # Middleware de protección de rutas (usa sessionValidator)
│   ├── repositories/
│   │   └── userRepository.js      # Capa de persistencia y acceso a datos de usuario
│   ├── routes/
│   │   └── authRoutes.js          # Definición de rutas REST (/api/auth)
│   ├── services/
│   │   ├── passwordHasher.js      # Hashing seguro con bcrypt (10 salt rounds)
│   │   └── sessionValidator.js    # MÓDULO CENTRAL de validación y emisión de sesiones JWT
│   ├── utils/
│   │   └── logger.js              # Logger seguro con filtro de sanitización automática
│   ├── app.js                     # Configuración de Express, CORS y middlewares
│   └── server.js                  # Punto de entrada y listener HTTP
├── tests/
│   └── auth.test.js               # Pruebas automatizadas (Node.js test runner)
├── .env.example                   # Variables de entorno requeridas
├── AGENTS.md                      # Reglas operativas para agentes de IA
└── package.json                   # Dependencias y scripts
```

---

## ⚙️ Variables de Entorno

| Variable | Descripción | Valor por Defecto |
| :--- | :--- | :--- |
| `PORT` | Puerto donde corre el microservicio | `4001` |
| `NODE_ENV` | Entorno de ejecución (`development`, `production`, `test`) | `development` |
| `JWT_SECRET` | Clave secreta para firmar tokens JWT | *Configurar en producción* |
| `JWT_EXPIRES_IN` | Tiempo de expiración del token | `24h` |
| `DATA_FILE_PATH` | Ruta para almacenar la persistencia de usuarios (JSON) | `./data/users.json` |

---

## 🚀 Endpoints de la API

### 1. Registro de Usuario
- **Ruta**: `POST /api/auth/register`
- **Body**:
  ```json
  {
    "email": "usuario@ejemplo.com",
    "password": "Password123!",
    "name": "Juan Pérez"
  }
  ```
- **Respuesta (201 Created)**:
  ```json
  {
    "message": "Usuario registrado con éxito",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "c1f7a2b9-...",
      "email": "usuario@ejemplo.com",
      "name": "Juan Pérez",
      "createdAt": "2026-09-21T18:30:00.000Z"
    }
  }
  ```

### 2. Inicio de Sesión
- **Ruta**: `POST /api/auth/login`
- **Body**:
  ```json
  {
    "email": "usuario@ejemplo.com",
    "password": "Password123!"
  }
  ```
- **Respuesta (200 OK)**:
  ```json
  {
    "message": "Inicio de sesión exitoso",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "c1f7a2b9-...",
      "email": "usuario@ejemplo.com",
      "name": "Juan Pérez"
    }
  }
  ```

### 3. Verificación de Sesión y Tokens
- **Rutas soportadas**:
  - `GET /api/auth/verify-session` (con header `Authorization: Bearer <token_jwt>`)
  - `POST /api/auth/verify-session` (con header `Authorization` o body `{ "token": "<token_jwt>" }`)
  - `POST /api/auth/verify-token` (con header `Authorization` o body `{ "token": "<token_jwt>" }`)
- **Headers opcionales / recomendados**:
  ```text
  Authorization: Bearer <token_jwt>
  ```
- **Body opcional (para POST)**:
  ```json
  {
    "token": "<token_jwt>"
  }
  ```
- **Respuesta (200 OK)**:
  ```json
  {
    "valid": true,
    "user": {
      "id": "c1f7a2b9-...",
      "email": "usuario@ejemplo.com",
      "name": "Juan Pérez"
    }
  }
  ```
- **Respuesta si es inválido o expiró (401 Unauthorized)**:
  ```json
  {
    "valid": false,
    "error": "La sesión ha expirado"
  }
  ```

### 4. Perfil Autenticado (Ejemplo con middleware)
- **Ruta**: `GET /api/auth/me`
- **Headers**: `Authorization: Bearer <token_jwt>`

### 5. Health Check
- **Ruta**: `GET /health`

---

## 🧪 Pruebas Automatizadas

Para ejecutar la suite de pruebas:
```bash
npm test
```
Utiliza el test runner nativo de Node.js (`node:test`) sin necesidad de librerías de testing adicionales pesadas.
