import { validateSession } from '../services/sessionValidator.js';
import { defaultUserRepository } from '../repositories/userRepository.js';

/**
 * Middleware Express para proteger rutas privadas.
 * Garantiza que la validación pase exclusivamente por el módulo central sessionValidator.
 */
export function requireAuth(userRepository = defaultUserRepository) {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: 'Acceso no autorizado: falta cabecera Authorization' });
    }

    const validation = await validateSession(authHeader, userRepository);

    if (!validation.valid) {
      return res.status(401).json({ error: validation.error || 'Sesión no válida' });
    }

    req.user = validation.user;
    next();
  };
}
