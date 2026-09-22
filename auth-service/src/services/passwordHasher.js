import bcrypt from 'bcryptjs';

/**
 * Lógica de hashing de contraseñas para auth-service.
 * Justificación (según directiva AGENTS.md):
 * Se emplea bcryptjs con 10 rondas de salt (cost factor).
 * Proporciona resistencia comprobada contra ataques de fuerza bruta basados en GPU/ASIC
 * e integra salts criptográficos pseudoaleatorios de 128 bits para mitigar ataques de rainbow tables.
 */
const SALT_ROUNDS = 10;

/**
 * Hashea una contraseña en texto plano utilizando bcrypt.
 * @param {string} plainPassword 
 * @returns {Promise<string>} Hash de la contraseña
 */
export async function hashPassword(plainPassword) {
  if (!plainPassword || typeof plainPassword !== 'string') {
    throw new Error('La contraseña proporcionada es inválida');
  }
  return await bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Compara una contraseña en texto plano con un hash almacenado.
 * @param {string} plainPassword 
 * @param {string} hashedPassword 
 * @returns {Promise<boolean>} True si coinciden, false en caso contrario
 */
export async function comparePassword(plainPassword, hashedPassword) {
  if (!plainPassword || !hashedPassword) {
    return false;
  }
  return await bcrypt.compare(plainPassword, hashedPassword);
}
