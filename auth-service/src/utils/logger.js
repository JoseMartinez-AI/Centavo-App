/**
 * Logger seguro para auth-service.
 * Cumple con la directiva estricta de AGENTS.md:
 * "Nunca loqueas credenciales ni tokens en texto plano."
 */

const SENSITIVE_KEYS = new Set([
  'password',
  'contrasena',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'secret',
  'jwt_secret',
  'credential',
  'credentials'
]);

/**
 * Sanitiza recursivamente objetos y arreglos para redactar valores sensibles.
 */
export function sanitize(data) {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    // Redactar tokens Bearer o strings tipo JWT
    let sanitizedStr = data.replace(/Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/gi, 'Bearer [REDACTED]');
    // Redactar posibles jwt planos
    sanitizedStr = sanitizedStr.replace(/eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, '[REDACTED_JWT]');
    return sanitizedStr;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitize(item));
  }

  if (typeof data === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.has(lowerKey)) {
        cleaned[key] = '[REDACTED]';
      } else {
        cleaned[key] = sanitize(value);
      }
    }
    return cleaned;
  }

  return data;
}

function formatMessage(level, message, meta) {
  const timestamp = new Date().toISOString();
  const sanitizedMeta = meta !== undefined ? sanitize(meta) : '';
  const sanitizedMsg = typeof message === 'string' ? sanitize(message) : sanitize(message);

  return {
    timestamp,
    level,
    message: sanitizedMsg,
    ...(sanitizedMeta ? { meta: sanitizedMeta } : {})
  };
}

export const logger = {
  info: (message, meta) => {
    const logObj = formatMessage('INFO', message, meta);
    console.log(JSON.stringify(logObj));
  },
  warn: (message, meta) => {
    const logObj = formatMessage('WARN', message, meta);
    console.warn(JSON.stringify(logObj));
  },
  error: (message, meta) => {
    const logObj = formatMessage('ERROR', message, meta);
    console.error(JSON.stringify(logObj));
  },
  debug: (message, meta) => {
    if (process.env.NODE_ENV !== 'production') {
      const logObj = formatMessage('DEBUG', message, meta);
      console.debug(JSON.stringify(logObj));
    }
  }
};
