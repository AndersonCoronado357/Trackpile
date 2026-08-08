import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { env } from '../config/env.js';
import { readSession } from '../auth/auth.service.js';
import { readApiToken } from '../auth/tokens.service.js';
import { errorHandler } from './errors.js';
import { googleWeb } from './google-web.js';
import { api } from './routes.js';

export function createApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');
  // Detras del proxy, req.protocol y la IP llegan de las cabeceras x-forwarded-*.
  app.set('trust proxy', 1);
  app.use(cors({ origin: true, credentials: true }));
  // Holgado porque la foto de perfil viaja como data URL ya reducida en el cliente.
  app.use(express.json({ limit: '4mb' }));
  app.use(cookieParser());
  app.use(readSession);
  // La cookie manda; si no la hay, se prueba con la llave de API del agente.
  app.use(readApiToken);

  // Sonda de vida, fuera de /api: es la que mira el servidor para saber si el
  // contenedor levanto. Sin ella caeria en el index.html y daria 200 siempre,
  // aunque la base de datos estuviera muerta.
  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'trackpile' });
  });

  app.use('/api', api);
  // Acceso con Google: cuelga de la raiz porque la URI de vuelta registrada en
  // la consola es /auth/google/callback, igual que en las demas aplicaciones.
  app.use(googleWeb);

  // En produccion (npm run build) el backend sirve tambien el frontend compilado.
  const dist = join(env.paths.repoRoot, 'frontend', 'dist', 'frontend', 'browser');
  if (existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(join(dist, 'index.html')));
  }

  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
      return;
    }
    next();
  });

  app.use(errorHandler);
  return app;
}
