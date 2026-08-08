import { createHash, randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { execute, query, queryOne, type RowDataPacket } from '../db/pool.js';
import { newId, nowSql, toIso } from '../lib/util.js';

/**
 * Llaves de API personales. Sirven para que un agente que esta trabajando en
 * otro proyecto pueda mirar la pila y actualizarla sin abrir el navegador ni
 * tener la cookie de sesion.
 *
 * Del token solo se guarda el SHA-256. El texto se ve una unica vez, al
 * crearlo; si se pierde, se borra y se saca otro.
 */

const PREFIJO = 'tp_';

export interface TokenInfo {
  id: string;
  label: string;
  /** Primeros caracteres, para reconocerlo en la lista sin revelarlo entero. */
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface TokenRow extends RowDataPacket {
  id: string;
  user_id: string;
  label: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
}

const hash = (raw: string): string => createHash('sha256').update(raw).digest('hex');

const toInfo = (row: TokenRow): TokenInfo => ({
  id: row.id,
  label: row.label,
  prefix: row.prefix,
  createdAt: toIso(row.created_at) ?? '',
  lastUsedAt: toIso(row.last_used_at),
});

export async function listTokens(userId: string): Promise<TokenInfo[]> {
  const rows = await query<TokenRow>('SELECT * FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC', [userId]);
  return rows.map(toInfo);
}

/** Devuelve la llave en claro: es la unica vez que se puede leer. */
export async function createToken(userId: string, label: string): Promise<TokenInfo & { token: string }> {
  const token = PREFIJO + randomBytes(24).toString('hex');
  const id = newId();
  const prefix = token.slice(0, 8);
  await execute('INSERT INTO api_tokens (id, user_id, label, token_hash, prefix, created_at) VALUES (?,?,?,?,?,?)', [
    id,
    userId,
    label.trim() || 'Agente',
    hash(token),
    prefix,
    nowSql(),
  ]);
  const row = await queryOne<TokenRow>('SELECT * FROM api_tokens WHERE id = ?', [id]);
  return { ...toInfo(row as TokenRow), token };
}

export async function deleteToken(userId: string, id: string): Promise<boolean> {
  const result = await execute('DELETE FROM api_tokens WHERE id = ? AND user_id = ?', [id, userId]);
  return result.affectedRows > 0;
}

/**
 * Acepta `Authorization: Bearer tp_...` como alternativa a la cookie. No
 * bloquea: si no hay llave o no vale, deja pasar y ya decidira `requireAuth`.
 */
export async function readApiToken(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (req.userId) {
    next();
    return;
  }
  const cabecera = String(req.headers['authorization'] ?? '');
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : '';
  if (!token.startsWith(PREFIJO)) {
    next();
    return;
  }
  try {
    const row = await queryOne<TokenRow>('SELECT * FROM api_tokens WHERE token_hash = ?', [hash(token)]);
    if (row) {
      req.userId = row.user_id;
      req.viaToken = true;
      await execute('UPDATE api_tokens SET last_used_at = ? WHERE id = ?', [nowSql(), row.id]);
    }
  } catch {
    /* si la consulta falla se trata como no autenticado */
  }
  next();
}

declare module 'express-serve-static-core' {
  interface Request {
    /** Cierto si la peticion llego con llave de API y no con cookie. */
    viaToken?: boolean;
  }
}
