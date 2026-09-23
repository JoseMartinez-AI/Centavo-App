/**
 * Logger estructurado para reports-service.
 * Emite logs en formato JSON y realiza sanitización de campos sensibles.
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
  'credentials',
  'creditcard',
  'cardnumber',
  'cvv'
]);

/**
 * Sanitiza recursivamente objetos y arreglos para redactar valores sensibles.
 */
export function sanitize(data) {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    let sanitizedStr = data.replace(/Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/gi, 'Bearer [REDACTED]');
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
    service: 'reports-service',
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
