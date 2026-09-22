import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';

/**
 * Módulo Central de Validación y Gestión de Sesiones.
 * DIRECTIVA AGENTS.md: "Toda validación de sesión debe pasar por un solo módulo central."
 * 
 * Ningún middleware, controlador o servicio debe verificar sesiones o tokens JWT
 * sin pasar exclusivamente a través de las funciones expuestas en este módulo.
 */

const DEFAULT_SECRET = 'super_secret_jwt_key_change_in_production_123456';
const DEFAULT_EXPIRES_IN = '24h';

function getJwtSecret() {
  return process.env.JWT_SECRET || DEFAULT_SECRET;
}

function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRES_IN;
}

/**
 * Genera un token de sesión para un usuario autenticado.
 * @param {Object} user 
 * @returns {string} Token JWT
 */
export function generateSessionToken(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name || ''
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: getJwtExpiresIn()
  });
}

/**
 * Valida un token de sesión. Única puerta de entrada para validación de sesión en todo el servicio.
 * @param {string} token Token JWT en texto plano (o extraído del header)
 * @param {Object} [userRepository] Repositorio opcional para verificar existencia activa del usuario
 * @returns {Promise<{ valid: boolean, user?: Object, error?: string }>}
 */
export async function validateSession(token, userRepository = null) {
  if (!token || typeof token !== 'string') {
    return {
      valid: false,
      error: 'Token no proporcionado o formato inválido'
    };
  }

  // Limpiar posible prefijo 'Bearer '
  const rawToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();

  if (!rawToken) {
    return {
      valid: false,
      error: 'Token vacío'
    };
  }

  try {
    const decoded = jwt.verify(rawToken, getJwtSecret());

    // Si se provee repositorio, validamos que el usuario siga existiendo
    if (userRepository && typeof userRepository.findById === 'function') {
      const existingUser = await userRepository.findById(decoded.sub);
      if (!existingUser) {
        logger.warn('Intento de validación de sesión para usuario inexistente', { userId: decoded.sub });
        return {
          valid: false,
          error: 'Usuario de la sesión no encontrado o inactivo'
        };
      }

      return {
        valid: true,
        user: {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
          createdAt: existingUser.createdAt
        }
      };
    }

    return {
      valid: true,
      user: {
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name
      }
    };
  } catch (err) {
    let errorMessage = 'Sesión inválida';
    if (err.name === 'TokenExpiredError') {
      errorMessage = 'La sesión ha expirado';
    } else if (err.name === 'JsonWebTokenError') {
      errorMessage = 'Token de sesión corrupto o firma inválida';
    }

    // Asegurar que nunca se loguee el token en texto plano
    logger.warn(`Fallo de validación de sesión: ${errorMessage}`);
    return {
      valid: false,
      error: errorMessage
    };
  }
}
