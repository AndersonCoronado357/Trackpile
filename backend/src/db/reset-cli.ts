/**
 * Vacia por completo la base (usuarios y proyectos) y vuelve a aplicar
 * las migraciones. Pide confirmacion salvo que se pase --yes.
 */
import { createInterface } from 'node:readline/promises';
import { closePool, execute } from './pool.js';
import { runMigrations } from './migrate.js';

if (!process.argv.includes('--yes')) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('Esto borra TODOS los usuarios y proyectos. Escribe "borrar" para confirmar: ');
  rl.close();
  if (answer.trim().toLowerCase() !== 'borrar') {
    console.log('[db] cancelado, no se toco nada');
    await closePool();
    process.exit(0);
  }
}

await execute('DELETE FROM users');
await runMigrations((msg) => console.log(`[db] ${msg}`));
console.log('[db] base vaciada');
await closePool();
