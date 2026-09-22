import { Router } from 'express';
import { defaultAuthController } from '../controllers/authController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

export function createAuthRouter(authController = defaultAuthController) {
  const router = Router();

  router.post('/register', authController.register);
  router.post('/login', authController.login);
  router.get('/verify-session', authController.verifySession);
  router.post('/verify-session', authController.verifySession);
  router.post('/verify-token', authController.verifySession);

  // Ruta protegida de ejemplo para perfil del usuario autenticado
  router.get('/me', requireAuth(authController.userRepository), (req, res) => {
    return res.status(200).json({
      message: 'Perfil obtenido correctamente',
      user: req.user
    });
  });

  return router;
}

export const authRouter = createAuthRouter();
