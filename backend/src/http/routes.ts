import { Router } from 'express';
import { env } from '../config/env.js';
import {
  forgotSchema,
  googleSchema,
  loginSchema,
  passwordSchema,
  profileSchema,
  projectCreateSchema,
  projectUpdateSchema,
  registerSchema,
  reorderSchema,
  resetSchema,
  tokenSchema,
} from '../domain/schemas.js';
import { consumeReset, requestReset } from '../auth/reset.service.js';
import { signInWithGoogle } from '../auth/google.service.js';
import { asyncRoute, badRequest, notFound, unauthorized } from './errors.js';
import {
  changePassword,
  clearSession,
  countUsers,
  findUserById,
  issueSession,
  login,
  register,
  requireAuth,
  updateProfile,
} from '../auth/auth.service.js';
import {
  countProjects,
  createProject,
  deleteProject,
  findProject,
  findProjectByName,
  listProjects,
  reorderProjects,
  updateProject,
} from '../projects/projects.repo.js';
import { createToken, deleteToken, listTokens } from '../auth/tokens.service.js';
import { apiDocs } from './docs.js';

export const api = Router();

/* ------------------------------------------------------------------ estado --- */

api.get(
  '/health',
  asyncRoute(async (_req, res) => {
    res.json({ ok: true, users: await countUsers(), allowSignup: env.auth.allowSignup });
  }),
);

/** Lo que el cliente necesita saber antes de pintar la pantalla de acceso. */
api.get('/config', (_req, res) => {
  res.json({
    allowSignup: env.auth.allowSignup,
    googleClientId: env.auth.googleClientId || null,
  });
});

/**
 * Instrucciones para un agente externo. Abierta a proposito: lo que se protege
 * son los datos, no la forma de pedirlos, y asi basta con pasar el enlace.
 */
api.get('/docs', (req, res) => {
  // ORIGIN manda si esta puesto: detras del proxy la peticion llega como
  // localhost y esa direccion no le sirve a ningun agente. Si no, se arma con
  // las cabeceras reenviadas, que es lo que ocurre en desarrollo.
  const primero = (valor: unknown): string => String(valor ?? '').split(',')[0]?.trim() ?? '';
  const host = primero(req.headers['x-forwarded-host']) || primero(req.headers['host']) || '127.0.0.1';
  const esquema = primero(req.headers['x-forwarded-proto']) || req.protocol;
  const base = env.origin || `${esquema}://${host}`;
  res.type('text/plain; charset=utf-8').send(apiDocs(`${base}/api`));
});

/** Con que cuenta esta hablando el agente. Sirve para probar la llave. */
api.get(
  '/whoami',
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = await findUserById(req.userId as string);
    if (!user) throw unauthorized();
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      projects: await countProjects(user.id),
      via: req.viaToken ? 'token' : 'sesion',
    });
  }),
);

/* --------------------------------------------------------------------- auth --- */

/** Cierto si ese correo tiene permitido abrir cuenta. */
export function puedeRegistrarse(email: string): boolean {
  const permitidos = env.auth.signupAllowlist;
  return permitidos.length === 0 || permitidos.includes(email.trim().toLowerCase());
}

api.post(
  '/auth/register',
  asyncRoute(async (req, res) => {
    if (!env.auth.allowSignup) throw badRequest('El registro de cuentas nuevas esta desactivado');
    const input = registerSchema.parse(req.body);
    if (!puedeRegistrarse(input.email)) throw badRequest('Ese correo no tiene permitido abrir cuenta aqui');
    const user = await register(input.email, input.name, input.password);
    issueSession(res, user.id);
    res.status(201).json(user);
  }),
);

api.post(
  '/auth/login',
  asyncRoute(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await login(input.email, input.password);
    issueSession(res, user.id);
    res.json(user);
  }),
);

api.post('/auth/logout', (_req, res) => {
  clearSession(res);
  res.status(204).end();
});

api.post(
  '/auth/google',
  asyncRoute(async (req, res) => {
    const input = googleSchema.parse(req.body);
    const { user } = await signInWithGoogle(input.credential);
    issueSession(res, user.id);
    res.json(user);
  }),
);

api.post(
  '/auth/forgot',
  asyncRoute(async (req, res) => {
    const input = forgotSchema.parse(req.body);
    // ORIGIN primero; si no esta, el origen del navegador, que en desarrollo
    // apunta al puerto real. El host de la peticion es el ultimo recurso.
    const delNavegador = String(req.headers['origin'] ?? '').replace(/\/$/, '');
    const base = env.origin || delNavegador || `http://${req.headers['host'] ?? '127.0.0.1'}`;
    const result = await requestReset(input.email, base);
    // Respuesta identica exista o no la cuenta: no se filtra quien esta registrado.
    res.json({ ok: true, ...result });
  }),
);

api.post(
  '/auth/reset',
  asyncRoute(async (req, res) => {
    const input = resetSchema.parse(req.body);
    const userId = await consumeReset(input.token, input.password);
    issueSession(res, userId);
    const user = await findUserById(userId);
    res.json(user);
  }),
);

api.get(
  '/auth/me',
  asyncRoute(async (req, res) => {
    if (!req.userId) throw unauthorized();
    const user = await findUserById(req.userId);
    if (!user) {
      clearSession(res);
      throw unauthorized();
    }
    res.json(user);
  }),
);

api.patch(
  '/auth/me',
  requireAuth,
  asyncRoute(async (req, res) => {
    const input = profileSchema.parse(req.body);
    const user = await updateProfile(req.userId as string, input);
    if (!user) throw notFound('Usuario');
    res.json(user);
  }),
);

api.post(
  '/auth/password',
  requireAuth,
  asyncRoute(async (req, res) => {
    const input = passwordSchema.parse(req.body);
    await changePassword(req.userId as string, input.current, input.next);
    res.status(204).end();
  }),
);

/* --------------------------------------------------- llaves para agentes --- */

// Solo con sesion del navegador: una llave no puede fabricar mas llaves.
api.get(
  '/tokens',
  requireAuth,
  asyncRoute(async (req, res) => {
    if (req.viaToken) throw unauthorized('Esta ruta necesita sesion en el navegador');
    res.json(await listTokens(req.userId as string));
  }),
);

api.post(
  '/tokens',
  requireAuth,
  asyncRoute(async (req, res) => {
    if (req.viaToken) throw unauthorized('Esta ruta necesita sesion en el navegador');
    const input = tokenSchema.parse(req.body ?? {});
    res.status(201).json(await createToken(req.userId as string, input.label));
  }),
);

api.delete(
  '/tokens/:id',
  requireAuth,
  asyncRoute(async (req, res) => {
    if (req.viaToken) throw unauthorized('Esta ruta necesita sesion en el navegador');
    const ok = await deleteToken(req.userId as string, String(req.params['id']));
    if (!ok) throw notFound('Llave');
    res.status(204).end();
  }),
);

/* ---------------------------------------------------------------- proyectos --- */

api.use('/projects', requireAuth);

/**
 * Buscar y actualizar por nombre. Un agente que trabaja dentro de la carpeta de
 * un proyecto sabe como se llama, no su identificador.
 */
api.get(
  '/projects/by-name/:name',
  asyncRoute(async (req, res) => {
    const project = await findProjectByName(req.userId as string, String(req.params['name']));
    if (!project) throw notFound('Proyecto');
    res.json(project);
  }),
);

/** Si existe lo actualiza, si no lo crea. Devuelve 201 solo cuando lo crea. */
api.put(
  '/projects/by-name/:name',
  asyncRoute(async (req, res) => {
    const userId = req.userId as string;
    const name = String(req.params['name']).trim();
    const existing = await findProjectByName(userId, name);

    if (existing) {
      const input = projectUpdateSchema.parse(req.body ?? {});
      res.json(await updateProject(userId, existing.id, input));
      return;
    }

    const input = projectCreateSchema.parse({ ...(req.body ?? {}), name });
    res.status(201).json(await createProject(userId, input));
  }),
);

api.get(
  '/projects',
  asyncRoute(async (req, res) => {
    res.json(await listProjects(req.userId as string));
  }),
);

api.post(
  '/projects',
  asyncRoute(async (req, res) => {
    const input = projectCreateSchema.parse(req.body);
    res.status(201).json(await createProject(req.userId as string, input));
  }),
);

api.post(
  '/projects/reorder',
  asyncRoute(async (req, res) => {
    const input = reorderSchema.parse(req.body);
    res.json(await reorderProjects(req.userId as string, input.orderedIds));
  }),
);

api.get(
  '/projects/:id',
  asyncRoute(async (req, res) => {
    const project = await findProject(req.userId as string, String(req.params['id']));
    if (!project) throw notFound('Proyecto');
    res.json(project);
  }),
);

api.patch(
  '/projects/:id',
  asyncRoute(async (req, res) => {
    const input = projectUpdateSchema.parse(req.body);
    const project = await updateProject(req.userId as string, String(req.params['id']), input);
    if (!project) throw notFound('Proyecto');
    res.json(project);
  }),
);

api.delete(
  '/projects/:id',
  asyncRoute(async (req, res) => {
    const ok = await deleteProject(req.userId as string, String(req.params['id']));
    if (!ok) throw notFound('Proyecto');
    res.status(204).end();
  }),
);
