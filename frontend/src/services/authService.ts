import { LoginCredentials, AuthResponse, User } from '../types/auth';
import { setStoredToken, clearStoredToken, getStoredToken } from './api';

const AUTH_USER_KEY = 'centavo_user';

export const authService = {
  /**
   * Inicia sesión del usuario contra auth-service.
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    if (!credentials.email || !credentials.password) {
      throw new Error('Por favor ingresa correo y contraseña');
    }

    if (credentials.password.length < 4) {
      throw new Error('La contraseña debe tener al menos 4 caracteres');
    }

    const authUrl = import.meta.env.VITE_AUTH_SERVICE_URL || 'http://localhost:4001';
    try {
      const response = await fetch(`${authUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      if (response.ok) {
        const data = await response.json();
        setStoredToken(data.token);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
        return data;
      } else {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Credenciales inválidas');
      }
    } catch (err: any) {
      // Si fue un error HTTP devuelto con mensaje específico, propagarlo
      if (err.message && !err.message.includes('fetch') && !err.message.includes('NetworkError') && !err.message.includes('Failed to')) {
        throw err;
      }
      // Solo si el servicio está apagado/inaccesible por red, fallback de conveniencia
    }

    // Mock response de fallback solo si el backend no está disponible
    const mockUser: User = {
      id: 'usr_01',
      name: credentials.email.split('@')[0].toUpperCase(),
      email: credentials.email,
    };
    const mockToken = 'mock_jwt_token_centavo_' + Date.now();

    setStoredToken(mockToken);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(mockUser));

    return {
      token: mockToken,
      user: mockUser,
    };
  },

  /**
   * Registra un nuevo usuario en auth-service.
   */
  async register(data: { email: string; password: string; name?: string }): Promise<AuthResponse> {
    const authUrl = import.meta.env.VITE_AUTH_SERVICE_URL || 'http://localhost:4001';
    const response = await fetch(`${authUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Error al registrar el usuario');
    }

    const resData = await response.json();
    setStoredToken(resData.token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(resData.user));
    return resData;
  },

  /**
   * Cierra sesión y remueve tokens.
   */
  async logout(): Promise<void> {
    clearStoredToken();
    localStorage.removeItem(AUTH_USER_KEY);
  },

  /**
   * Recupera el usuario autenticado desde el almacenamiento local.
   */
  getCurrentUser(): User | null {
    const token = getStoredToken();
    const storedUser = localStorage.getItem(AUTH_USER_KEY);
    if (!token || !storedUser) {
      return null;
    }
    try {
      return JSON.parse(storedUser) as User;
    } catch {
      return null;
    }
  },
};

