import { randomBytes } from 'node:crypto';
import { Router, type Request } from 'express';
import { env } from '../config/env.js';
import { issueSession } from '../auth/auth.service.js';
import { RUTA_VUELTA, exchangeCode, googleAuthUrl, googleEnabled, signInWithGoogle } from '../auth/google.service.js';
import { seedForUser } from '../db/seed.js';
import { asyncRoute } from './errors.js';

/**
 * Acceso con Google por redireccion, colgando de la raiz y no de /api.
 *
 * La URI de vuelta es `/auth/google/callback`, que es la que se registra en la
 * consola de Google y la misma que usan las demas aplicaciones del servidor.
 * Se va a Google, Google devuelve un codigo, y aqui se canjea por la identidad.
 */
export const googleWeb = Router();

const COOKIE_ESTADO = 'tp_google_state';

/** Direccion publica. Detras del proxy la peticion llega como localhost. */
function baseDe(req: Request): string {
  if (env.origin) return env.origin;
  const primero = (valor: unknown): string => String(valor ?? '').split(',')[0]?.trim() ?? '';
  const host = primero(req.headers['x-forwarded-host']) || primero(req.headers['host']) || '127.0.0.1';
  const esquema = primero(req.headers['x-forwarded-proto']) || req.protocol;
  return `${esquema}://${host}`;
}

googleWeb.get('/auth/google/start', (req, res) => {
  if (!googleEnabled()) {
    res.redirect('/entrar?google=sin-configurar');
    return;
  }
  // El estado viaja en una cookie y en la URL: si al volver no coinciden, la
  // peticion no la empezo este navegador y se descarta.
  const estado = randomBytes(16).toString('hex');
  res.cookie(COOKIE_ESTADO, estado, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    maxAge: 10 * 60_000,
    path: '/',
  });
  res.redirect(googleAuthUrl(baseDe(req), estado));
});

googleWeb.get(
  RUTA_VUELTA,
  asyncRoute(async (req, res) => {
    const esperado = (req.cookies as Record<string, string> | undefined)?.[COOKIE_ESTADO];
    res.clearCookie(COOKIE_ESTADO, { path: '/' });

    const code = typeof req.query['code'] === 'string' ? req.query['code'] : '';
    const estado = typeof req.query['state'] === 'string' ? req.query['state'] : '';

    // El usuario pudo cancelar en la pantalla de Google: eso no es un fallo.
    if (req.query['error']) {
      res.redirect('/entrar');
      return;
    }
    if (!code || !estado || !esperado || estado !== esperado) {
      res.redirect('/entrar?google=estado');
      return;
    }

    try {
      const identidad = await exchangeCode(baseDe(req), code);
      const { user, created } = await signInWithGoogle(identidad);
      issueSession(res, user.id);
      if (created && env.seedNewAccounts) await seedForUser(user.id);
      res.redirect('/proyectos');
    } catch (error) {
      // El motivo real se queda en el servidor; fuera solo va el aviso.
      console.error('[api] fallo el acceso con Google:', error instanceof Error ? error.message : error);
      const motivo = error instanceof Error && /permitido/.test(error.message) ? 'no-permitido' : 'error';
      res.redirect(`/entrar?google=${motivo}`);
    }
  }),
);
