import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFound = (what = 'Recurso') => new HttpError(404, `${what} no encontrado`);
export const badRequest = (message: string) => new HttpError(400, message);
export const unauthorized = (message = 'Necesitas iniciar sesion') => new HttpError(401, message);
export const conflict = (message: string) => new HttpError(409, message);

/** Envuelve handlers async para que los rechazos lleguen al middleware de error. */
export function asyncRoute(handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: error.issues[0]?.message ?? 'Datos invalidos',
      issues: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('ER_ACCESS_DENIED')) {
    res.status(500).json({ error: 'MySQL rechazo las credenciales. Revisa backend/.env' });
    return;
  }
  if (message.includes('ER_BAD_DB_ERROR')) {
    res.status(500).json({ error: 'La base de datos no existe. Ejecuta: npm run db:setup' });
    return;
  }
  if (message.includes('ECONNREFUSED')) {
    res.status(503).json({ error: 'MySQL no responde. Verifica que el servicio MySQL80 este corriendo.' });
    return;
  }

  console.error('[trackpile] error no controlado:', error);
  res.status(500).json({ error: 'Error interno del servidor' });
}
