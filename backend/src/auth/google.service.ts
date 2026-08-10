import { env } from '../config/env.js';
import { execute, queryOne, type RowDataPacket } from '../db/pool.js';
import type { User } from '../domain/types.js';
import { newId, nowSql, toIso } from '../lib/util.js';
import { badRequest } from '../http/errors.js';

interface TokenInfo {
  sub?: string;
  aud?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  picture?: string;
  exp?: string;
}

export const googleEnabled = (): boolean => env.auth.googleClientId.length > 0;

/** Ruta de vuelta. Es la que hay que registrar en la consola de Google. */
export const RUTA_VUELTA = '/auth/google/callback';

/**
 * A donde se manda al usuario para que Google le pregunte.
 *
 * Se usa el flujo de redireccion, no el boton incrustado: es el que espera el
 * servidor —una sola URI de vuelta por aplicacion— y ademas deja el diseno
 * intacto, porque el boton es nuestro y no un iframe de Google.
 */
export function googleAuthUrl(base: string, state: string): string {
  const parametros = new URLSearchParams({
    client_id: env.auth.googleClientId,
    redirect_uri: `${base}${RUTA_VUELTA}`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    // Sin esto, con varias cuentas abiertas entra con la ultima sin preguntar.
    prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${parametros}`;
}

/** Canjea el codigo de un solo uso por el token de identidad. */
export async function exchangeCode(base: string, code: string): Promise<string> {
  if (!env.auth.googleClientSecret) throw badRequest('Falta GOOGLE_CLIENT_SECRET para completar el acceso');

  const respuesta = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.auth.googleClientId,
      client_secret: env.auth.googleClientSecret,
      redirect_uri: `${base}${RUTA_VUELTA}`,
      grant_type: 'authorization_code',
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!respuesta.ok) throw badRequest('Google rechazo el canje del codigo');
  const datos = (await respuesta.json()) as { id_token?: string };
  if (!datos.id_token) throw badRequest('Google no devolvio identidad');
  return datos.id_token;
}

/**
 * Verifica el token de Google contra el propio Google. Se usa su endpoint
 * publico en vez de una libreria para no sumar dependencias por una sola cosa.
 */
async function verify(credential: string): Promise<TokenInfo> {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw badRequest('Google no validó ese acceso');

  const info = (await response.json()) as TokenInfo;
  if (info.aud !== env.auth.googleClientId) throw badRequest('Ese acceso no es de esta aplicación');
  if (!info.sub || !info.email) throw badRequest('Google no devolvió un correo');
  if (info.email_verified !== true && info.email_verified !== 'true') {
    throw badRequest('Ese correo de Google no está verificado');
  }
  if (info.exp && Number(info.exp) * 1000 < Date.now()) throw badRequest('El acceso de Google caducó');
  return info;
}

interface UserRow extends RowDataPacket {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role_label: string | null;
  theme: 'system' | 'light' | 'dark';
  created_at: string;
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

/** Entra o crea la cuenta a partir del token de Google. Devuelve si es nueva. */
export async function signInWithGoogle(credential: string): Promise<{ user: User; created: boolean }> {
  if (!googleEnabled()) {
    throw badRequest('Falta configurar GOOGLE_CLIENT_ID en backend/.env para usar Google');
  }

  const info = await verify(credential);
  const email = info.email!.toLowerCase();

  const existing = await queryOne<UserRow>('SELECT * FROM users WHERE google_sub = ? OR email = ? LIMIT 1', [
    info.sub,
    email,
  ]);

  if (existing) {
    // Enlaza la cuenta local con Google la primera vez, y trae la foto si falta.
    await execute('UPDATE users SET google_sub = ?, avatar_url = COALESCE(avatar_url, ?), last_login_at = ? WHERE id = ?', [
      info.sub,
      info.picture ?? null,
      nowSql(),
      existing.id,
    ]);
    const fresh = await queryOne<UserRow>('SELECT * FROM users WHERE id = ?', [existing.id]);
    return { user: toUser(fresh ?? existing), created: false };
  }

  // Entrar con Google tambien es abrir cuenta: la lista de correos permitidos
  // manda igual que en el registro por correo, o seria la puerta de atras.
  if (!env.auth.allowSignup) throw badRequest('El registro de cuentas nuevas esta desactivado');
  const permitidos = env.auth.signupAllowlist;
  if (permitidos.length && !permitidos.includes(email)) {
    throw badRequest('Ese correo no tiene permitido abrir cuenta aqui');
  }

  const id = newId();
  await execute(
    `INSERT INTO users (id, email, name, avatar_url, password_hash, google_sub, created_at, last_login_at)
     VALUES (?,?,?,?,NULL,?,?,?)`,
    [id, email, info.name?.trim() || email.split('@')[0], info.picture ?? null, info.sub, nowSql(), nowSql()],
  );

  const created = await queryOne<UserRow>('SELECT * FROM users WHERE id = ?', [id]);
  if (!created) throw new Error('No se pudo crear la cuenta');
  return { user: toUser(created), created: true };
}
