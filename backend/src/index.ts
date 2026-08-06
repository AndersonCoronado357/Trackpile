import type { AddressInfo } from 'node:net';
import { env } from './config/env.js';
import { closePool, getPool } from './db/pool.js';
import { runMigrations } from './db/migrate.js';
import { createApp } from './http/app.js';

const log = (msg: string) => console.log(`[api] ${msg}`);

async function main(): Promise<void> {
  try {
    await getPool().query('SELECT 1');
    log(`conectado a MySQL ${env.db.user}@${env.db.host}:${env.db.port}/${env.db.database}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('\n[api] No se pudo conectar a MySQL.');
    if (message.includes('ER_BAD_DB_ERROR')) console.error(`      La base "${env.db.database}" no existe. Ejecuta: npm run db:setup`);
    else if (message.includes('ER_ACCESS_DENIED')) console.error('      Credenciales rechazadas. Revisa backend/.env');
    else if (message.includes('ECONNREFUSED')) console.error('      Verifica que el servicio MySQL80 este corriendo.');
    else console.error(`      ${message}`);
    process.exit(1);
  }

  const applied = await runMigrations(log);
  if (applied > 0) log(`${applied} migracion(es) aplicadas`);

  const server = createApp().listen(env.port, env.host, () => {
    const address = server.address() as AddressInfo;
    // El lanzador lee esta linea para configurar el proxy.
    console.log(`TRACKPILE_API_PORT=${address.port}`);
    log(`escuchando en http://${env.host}:${address.port}`);
  });

  const shutdown = (signal: string) => {
    log(`${signal} recibido, cerrando...`);
    server.close(() => {
      closePool()
        .catch(() => undefined)
        .finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 3000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  console.error('[api] fallo al arrancar:', error);
  process.exit(1);
});
