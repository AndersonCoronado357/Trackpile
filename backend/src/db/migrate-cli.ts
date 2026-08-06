import { closePool } from './pool.js';
import { runMigrations } from './migrate.js';

const applied = await runMigrations((msg) => console.log(`[db] ${msg}`));
console.log(applied ? `[db] ${applied} migracion(es) aplicadas` : '[db] sin migraciones pendientes');
await closePool();
