import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';

dotenv.config();

export class UserRepository {
  constructor(filePath = null) {
    this.filePath = filePath || process.env.DATA_FILE_PATH || './data/users.json';
    this.users = new Map();
    this.isLoaded = false;
    this._initStorage();
  }

  _initStorage() {
    if (!this.filePath) {
      this.isLoaded = true;
      return;
    }

    try {
      const resolvedPath = path.resolve(this.filePath);
      const dir = path.dirname(resolvedPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(resolvedPath)) {
        const data = fs.readFileSync(resolvedPath, 'utf8');
        if (data.trim()) {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            for (const u of parsed) {
              this.users.set(u.id, u);
            }
          }
        }
      }
      this.isLoaded = true;
    } catch (err) {
      logger.error('Error al inicializar almacenamiento de usuarios', { error: err.message });
      this.isLoaded = true;
    }
  }

  _persist() {
    if (!this.filePath) return;
    try {
      const resolvedPath = path.resolve(this.filePath);
      const data = JSON.stringify(Array.from(this.users.values()), null, 2);
      fs.writeFileSync(resolvedPath, data, 'utf8');
    } catch (err) {
      logger.error('Error al persistir usuarios en disco', { error: err.message });
    }
  }

  async create({ email, passwordHash, name }) {
    const normalizedEmail = email.toLowerCase().trim();
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    const newUser = {
      id,
      email: normalizedEmail,
      passwordHash,
      name: name ? name.trim() : '',
      createdAt
    };

    this.users.set(id, newUser);
    this._persist();

    return { ...newUser };
  }

  async findByEmail(email) {
    if (!email) return null;
    const normalizedEmail = email.toLowerCase().trim();
    for (const user of this.users.values()) {
      if (user.email === normalizedEmail) {
        return { ...user };
      }
    }
    return null;
  }

  async findById(id) {
    if (!id) return null;
    const user = this.users.get(id);
    return user ? { ...user } : null;
  }

  async clear() {
    this.users.clear();
    this._persist();
  }
}

export const defaultUserRepository = new UserRepository();
