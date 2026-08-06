import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { execute, queryOne, type RowDataPacket } from '../db/pool.js';
import { newId, nowSql } from '../lib/util.js';
import { badRequest } from '../http/errors.js';

const TTL_MINUTES = 45;

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export interface ForgotResult {
  /** Se devuelve solo en desarrollo, para poder usar el enlace sin correo. */
  link?: string;
}

/**
 * Crea un token de un solo uso. Nunca revela si el correo existe: la respuesta
 * es identica en ambos casos para que nadie pueda sondear quien tiene cuenta.
 */
export async function requestReset(email: string, origin: string): Promise<ForgotResult> {
  const user = await queryOne<RowDataPacket & { id: string }>('SELECT id FROM users WHERE email = ?', [
    email.trim().toLowerCase(),
  ]);
  if (!user) return {};

  // Un token vivo por usuario: los anteriores se invalidan.
  await execute('DELETE FROM password_resets WHERE user_id = ? AND used_at IS NULL', [user.id]);

  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + TTL_MINUTES * 60_000);

  await execute('INSERT INTO password_resets (id, user_id, token_hash, expires_at, created_at) VALUES (?,?,?,?,?)', [
    newId(),
    user.id,
    hashToken(token),
    nowSql(expires),
    nowSql(),
  ]);

  const link = `${origin}/entrar?recuperar=${token}`;

  // Sin servidor de correo montado: en desarrollo el enlace se devuelve para
  // poder usarlo, y ademas se imprime en la consola del servidor.
  if (env.nodeEnv !== 'production') {
    console.log(`[api] enlace de recuperacion para ${email}: ${link}`);
    return { link };
  }
  return {};
}

export async function consumeReset(token: string, password: string): Promise<string> {
  const row = await queryOne<RowDataPacket & { id: string; user_id: string; expires_at: string; used_at: string | null }>(
    'SELECT * FROM password_resets WHERE token_hash = ?',
    [hashToken(token)],
  );

  if (!row || row.used_at) throw badRequest('Ese enlace ya no sirve. Pide uno nuevo.');
  if (new Date(row.expires_at.replace(' ', 'T')).getTime() < Date.now()) {
    throw badRequest('El enlace caducó. Pide uno nuevo.');
  }

  const hash = await bcrypt.hash(password, env.auth.bcryptRounds);
  await execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, row.user_id]);
  await execute('UPDATE password_resets SET used_at = ? WHERE id = ?', [nowSql(), row.id]);
  return row.user_id;
}
