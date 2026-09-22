import { hashPassword, comparePassword } from '../services/passwordHasher.js';
import { generateSessionToken, validateSession } from '../services/sessionValidator.js';
import { defaultUserRepository } from '../repositories/userRepository.js';
import { logger } from '../utils/logger.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export class AuthController {
  constructor(userRepository = defaultUserRepository) {
    this.userRepository = userRepository;
  }

  register = async (req, res) => {
    try {
      const { email, password, name } = req.body || {};

      if (!email || !EMAIL_REGEX.test(email)) {
        return res.status(400).json({ error: 'El correo electrónico proporcionado no es válido' });
      }

      if (!password || typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({
          error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`
        });
      }

      if (password.length > MAX_PASSWORD_LENGTH) {
        return res.status(400).json({
          error: `La contraseña no puede exceder los ${MAX_PASSWORD_LENGTH} caracteres`
        });
      }

      const existingUser = await this.userRepository.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: 'El correo electrónico ya se encuentra registrado' });
      }

      const passwordHash = await hashPassword(password);
      const newUser = await this.userRepository.create({
        email,
        passwordHash,
        name
      });

      const token = generateSessionToken(newUser);

      logger.info('Usuario registrado exitosamente', { userId: newUser.id });

      return res.status(201).json({
        message: 'Usuario registrado con éxito',
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          createdAt: newUser.createdAt
        }
      });
    } catch (err) {
      logger.error('Error durante el registro de usuario', { error: err.message });
      return res.status(500).json({ error: 'Error interno del servidor al procesar el registro' });
    }
  };

  login = async (req, res) => {
    try {
      const { email, password } = req.body || {};

      if (!email || !password) {
        return res.status(400).json({ error: 'Se requiere correo electrónico y contraseña' });
      }

      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        logger.warn('Intento de inicio de sesión fallido: usuario no encontrado');
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      const isMatch = await comparePassword(password, user.passwordHash);
      if (!isMatch) {
        logger.warn('Intento de inicio de sesión fallido: contraseña incorrecta', { userId: user.id });
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      const token = generateSessionToken(user);

      logger.info('Inicio de sesión exitoso', { userId: user.id });

      return res.status(200).json({
        message: 'Inicio de sesión exitoso',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      });
    } catch (err) {
      logger.error('Error durante el inicio de sesión', { error: err.message });
      return res.status(500).json({ error: 'Error interno del servidor al procesar el login' });
    }
  };

  verifySession = async (req, res) => {
    try {
      const token = req.headers.authorization || req.body?.token;
      if (!token) {
        return res.status(401).json({
          valid: false,
          error: 'Token no proporcionado (se requiere cabecera Authorization o campo token en el body)'
        });
      }

      // Toda validación pasa por el módulo central sessionValidator
      const validation = await validateSession(token, this.userRepository);

      if (!validation.valid) {
        return res.status(401).json({ valid: false, error: validation.error });
      }

      return res.status(200).json({
        valid: true,
        user: validation.user
      });
    } catch (err) {
      logger.error('Error en verificación de sesión', { error: err.message });
      return res.status(500).json({ valid: false, error: 'Error interno al validar sesión' });
    }
  };
}

export const defaultAuthController = new AuthController();
