import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { execute, queryOne, type RowDataPacket } from '../db/pool.js';
import type { User } from '../domain/types.js';
import { newId, nowSql, toIso } from '../lib/util.js';
import { conflict, unauthorized } from '../http/errors.js';

interface UserRow extends RowDataPacket {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role_label: string | null;
  password_hash: string;
  theme: 'system' | 'light' | 'dark';
  created_at: string;
  last_login_at: string | null;
}

const toUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  name: row.name,
  avatarUrl: row.avatar_url,
  roleLabel: row.role_label,
  theme: row.theme,
  createdAt: toIso(row.created_at),
});

export async function countUsers(): Promise<number> {
  const row = await queryOne<RowDataPacket & { n: number }>('SELECT COUNT(*) AS n FROM users');
  return Number(row?.n ?? 0);
}

export async function findUserById(id: string): Promise<User | null> {
  const row = await queryOne<UserRow>('SELECT * FROM users WHERE id = ?', [id]);
  return row ? toUser(row) : null;
}

export async function register(email: string, name: string, password: string): Promise<User> {
  const normalized = email.trim().toLowerCase();
  const existing = await queryOne<UserRow>('SELECT id FROM users WHERE email = ?', [normalized]);
  if (existing) throw conflict('Ya existe una cuenta con ese correo');

  const id = newId();
  const hash = await bcrypt.hash(password, env.auth.bcryptRounds);
  await execute('INSERT INTO users (id, email, name, password_hash, created_at, last_login_at) VALUES (?,?,?,?,?,?)', [
    id,
    normalized,
    name.trim(),
    hash,
    nowSql(),
    nowSql(),
  ]);

  const created = await findUserById(id);
  if (!created) throw new Error('No se pudo crear la cuenta');
  return created;
}

export async function login(email: string, password: string): Promise<User> {
  const row = await queryOne<UserRow>('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
  // Se compara igual aunque el usuario no exista, para no filtrar que correos estan registrados.
  const hash = row?.password_hash ?? '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';
  const ok = await bcrypt.compare(password, hash);
  if (!row || !ok) throw unauthorized('Correo o contrasena incorrectos');

  await execute('UPDATE users SET last_login_at = ? WHERE id = ?', [nowSql(), row.id]);
  return toUser(row);
}

export interface ProfilePatch {
  name?: string;
  theme?: User['theme'];
  avatarUrl?: string | null;
  roleLabel?: string | null;
}

export async function updateProfile(id: string, patch: ProfilePatch): Promise<User | null> {
  const sets: string[] = [];
  const args: unknown[] = [];
  if (patch.name !== undefined) {
    sets.push('name = ?');
    args.push(patch.name.trim());
  }
  if (patch.theme !== undefined) {
    sets.push('theme = ?');
    args.push(patch.theme);
  }
  if (patch.avatarUrl !== undefined) {
    sets.push('avatar_url = ?');
    args.push(patch.avatarUrl);
  }
  if (patch.roleLabel !== undefined) {
    sets.push('role_label = ?');
    args.push(patch.roleLabel);
  }
  if (sets.length) await execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...args, id]);
  return findUserById(id);
}

export async function changePassword(id: string, current: string, next: string): Promise<void> {
  const row = await queryOne<UserRow>('SELECT * FROM users WHERE id = ?', [id]);
  if (!row) throw unauthorized();
  if (!(await bcrypt.compare(current, row.password_hash))) {
    throw unauthorized('La contrasena actual no es correcta');
  }
  const hash = await bcrypt.hash(next, env.auth.bcryptRounds);
  await execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
}

/* ------------------------------------------------------------------ sesion --- */

const MAX_AGE_MS = env.auth.days * 24 * 60 * 60 * 1000;

export function issueSession(res: Response, userId: string): void {
  const token = jwt.sign({ sub: userId }, env.auth.secret, { expiresIn: `${env.auth.days}d` });
  res.cookie(env.auth.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    maxAge: MAX_AGE_MS,
    path: '/',
  });
}

export function clearSession(res: Response): void {
  res.clearCookie(env.auth.cookieName, { path: '/' });
}

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
  }
}

/** Lee la cookie y deja el id del usuario en req.userId. No bloquea. */
export function readSession(req: Request, _res: Response, next: NextFunction): void {
  const token = (req.cookies as Record<string, string> | undefined)?.[env.auth.cookieName];
  if (token) {
    try {
      const payload = jwt.verify(token, env.auth.secret) as { sub?: string };
      if (payload.sub) req.userId = payload.sub;
    } catch {
      /* token invalido o vencido: se trata como sesion cerrada */
    }
  }
  next();
}

/** Exige sesion activa. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.userId) {
    next(unauthorized());
    return;
  }
  next();
}
