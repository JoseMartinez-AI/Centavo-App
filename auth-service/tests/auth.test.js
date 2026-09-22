import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import http from 'http';

import { hashPassword, comparePassword } from '../src/services/passwordHasher.js';
import { generateSessionToken, validateSession } from '../src/services/sessionValidator.js';
import { sanitize } from '../src/utils/logger.js';
import { UserRepository } from '../src/repositories/userRepository.js';
import { AuthController } from '../src/controllers/authController.js';
import { createAuthRouter } from '../src/routes/authRoutes.js';
import { createApp } from '../src/app.js';

describe('1. Seguridad: Hashing de Contraseñas (passwordHasher)', () => {
  it('debe hashear la contraseña y nunca almacenarla en texto plano', async () => {
    const plain = 'SuperPassword123!';
    const hash = await hashPassword(plain);

    assert.notEqual(hash, plain);
    assert.ok(hash.startsWith('$2'), 'El hash debe ser un hash de bcrypt válido');
  });

  it('debe validar correctamente la contraseña correcta y rechazar la incorrecta', async () => {
    const plain = 'CorrectSecret99#';
    const hash = await hashPassword(plain);

    const isMatch = await comparePassword(plain, hash);
    assert.equal(isMatch, true);

    const isWrongMatch = await comparePassword('WrongSecret99#', hash);
    assert.equal(isWrongMatch, false);
  });
});

describe('2. Seguridad: Logger y Sanitización (AGENTS.md)', () => {
  it('debe redactar campos sensibles en objetos (password, token, authorization)', () => {
    const rawData = {
      user: 'test@example.com',
      password: 'MySecretPassword123',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz',
      authorization: 'Bearer secret_token_123',
      nested: {
        accessToken: 'access_abc',
        otherField: 'safeValue'
      }
    };

    const sanitized = sanitize(rawData);

    assert.equal(sanitized.password, '[REDACTED]');
    assert.equal(sanitized.token, '[REDACTED]');
    assert.equal(sanitized.authorization, '[REDACTED]');
    assert.equal(sanitized.nested.accessToken, '[REDACTED]');
    assert.equal(sanitized.nested.otherField, 'safeValue');
    assert.equal(sanitized.user, 'test@example.com');
  });

  it('debe redactar tokens JWT y Bearer presentes en cadenas de texto plano', () => {
    const textWithBearer = 'Request headers had Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig and nothing else';
    const sanitized = sanitize(textWithBearer);

    assert.ok(!sanitized.includes('payload.sig'));
    assert.ok(sanitized.includes('[REDACTED]'));
  });
});

describe('3. Módulo Central de Sesión (sessionValidator)', () => {
  const mockUser = {
    id: 'user-uuid-1234',
    email: 'session@test.com',
    name: 'Sesión Test'
  };

  it('debe generar y validar tokens de sesión válidos', async () => {
    const token = generateSessionToken(mockUser);
    assert.ok(typeof token === 'string' && token.length > 0);

    const result = await validateSession(token);
    assert.equal(result.valid, true);
    assert.equal(result.user.id, mockUser.id);
    assert.equal(result.user.email, mockUser.email);
  });

  it('debe soportar tokens con prefijo Bearer', async () => {
    const token = generateSessionToken(mockUser);
    const result = await validateSession(`Bearer ${token}`);
    assert.equal(result.valid, true);
    assert.equal(result.user.id, mockUser.id);
  });

  it('debe rechazar tokens con firma inválida o corruptos', async () => {
    const result = await validateSession('Bearer token_falso_invalido');
    assert.equal(result.valid, false);
    assert.ok(result.error);
  });

  it('debe rechazar tokens expirados', async () => {
    // Generar un token con expiración en el pasado
    const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_change_in_production_123456';
    const expiredToken = jwt.sign({ sub: mockUser.id, email: mockUser.email }, secret, { expiresIn: '-1s' });

    const result = await validateSession(expiredToken);
    assert.equal(result.valid, false);
    assert.equal(result.error, 'La sesión ha expirado');
  });

  it('debe validar la existencia activa del usuario cuando se provee el repositorio', async () => {
    const repo = new UserRepository(null);
    const created = await repo.create({
      email: 'active@test.com',
      passwordHash: 'hash',
      name: 'Activo'
    });

    const token = generateSessionToken(created);

    // Con usuario existente
    const validResult = await validateSession(token, repo);
    assert.equal(validResult.valid, true);
    assert.equal(validResult.user.id, created.id);

    // Si el usuario es borrado
    await repo.clear();
    const invalidResult = await validateSession(token, repo);
    assert.equal(invalidResult.valid, false);
    assert.equal(invalidResult.error, 'Usuario de la sesión no encontrado o inactivo');
  });
});

describe('4. API Endpoints de Autenticación (Integración HTTP)', () => {
  let server;
  let baseUrl;
  let repo;

  before(async () => {
    repo = new UserRepository(null); // en memoria pura para tests
    const authController = new AuthController(repo);
    const customRouter = createAuthRouter(authController);
    const app = createApp(customRouter);
    server = http.createServer(app);

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

  it('POST /api/auth/register debe registrar un usuario exitosamente', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nuevo@centavo.app',
        password: 'PasswordSegura123!',
        name: 'Nuevo Usuario'
      })
    });

    const data = await res.json();

    assert.equal(res.status, 201);
    assert.ok(data.token, 'Debe devolver un token de sesión');
    assert.equal(data.user.email, 'nuevo@centavo.app');
    assert.equal(data.user.name, 'Nuevo Usuario');
    assert.equal(data.user.passwordHash, undefined, 'Nunca debe exponerse el hash ni la contraseña');
  });

  it('POST /api/auth/register debe rechazar correos duplicados con 409', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nuevo@centavo.app',
        password: 'PasswordSegura123!',
        name: 'Duplicado'
      })
    });

    const data = await res.json();
    assert.equal(res.status, 409);
    assert.ok(data.error.includes('registrado'));
  });

  it('POST /api/auth/register debe validar longitud mínima de contraseña', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'corto@centavo.app',
        password: '123',
        name: 'Corto'
      })
    });

    assert.equal(res.status, 400);
  });

  it('POST /api/auth/login debe iniciar sesión correctamente con credenciales válidas', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nuevo@centavo.app',
        password: 'PasswordSegura123!'
      })
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.ok(data.token);
    assert.equal(data.user.email, 'nuevo@centavo.app');
  });

  it('POST /api/auth/login debe fallar con 401 si la contraseña es incorrecta', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nuevo@centavo.app',
        password: 'PasswordIncorrecta999!'
      })
    });

    assert.equal(res.status, 401);
  });

  it('GET /api/auth/verify-session debe validar el token de sesión', async () => {
    // 1. Iniciar sesión para obtener token
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nuevo@centavo.app',
        password: 'PasswordSegura123!'
      })
    });
    const loginData = await loginRes.json();

    // 2. Verificar la sesión
    const verifyRes = await fetch(`${baseUrl}/api/auth/verify-session`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${loginData.token}`
      }
    });

    const verifyData = await verifyRes.json();
    assert.equal(verifyRes.status, 200);
    assert.equal(verifyData.valid, true);
    assert.equal(verifyData.user.email, 'nuevo@centavo.app');
  });

  it('GET /api/auth/verify-session debe responder 401 ante token ausente o inválido', async () => {
    const res = await fetch(`${baseUrl}/api/auth/verify-session`, {
      method: 'GET'
    });
    assert.equal(res.status, 401);

    const resInvalid = await fetch(`${baseUrl}/api/auth/verify-session`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer token_invalido_xyz'
      }
    });
    assert.equal(resInvalid.status, 401);
  });

  it('GET /api/auth/me debe permitir acceso a ruta protegida con token válido', async () => {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nuevo@centavo.app',
        password: 'PasswordSegura123!'
      })
    });
    const loginData = await loginRes.json();

    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${loginData.token}`
      }
    });
    const meData = await meRes.json();

    assert.equal(meRes.status, 200);
    assert.equal(meData.user.email, 'nuevo@centavo.app');
  });

  it('POST /api/auth/verify-token debe validar el token enviado en el body', async () => {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nuevo@centavo.app',
        password: 'PasswordSegura123!'
      })
    });
    const loginData = await loginRes.json();

    const verifyRes = await fetch(`${baseUrl}/api/auth/verify-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: loginData.token })
    });
    const verifyData = await verifyRes.json();

    assert.equal(verifyRes.status, 200);
    assert.equal(verifyData.valid, true);
    assert.equal(verifyData.user.email, 'nuevo@centavo.app');
  });

  it('POST /api/auth/register debe rechazar contraseñas mayores a 128 caracteres (DoS protection)', async () => {
    const excessivePassword = 'A'.repeat(129);
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'dos@centavo.app',
        password: excessivePassword,
        name: 'DoS Test'
      })
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('128'));
  });

  it('debe responder 400 Bad Request ante cuerpo con JSON malformado', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ "invalid_json": '
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('JSON inválido'));
  });
});
