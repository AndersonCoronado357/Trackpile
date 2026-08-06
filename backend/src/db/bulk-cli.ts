/**
 * Mete muchos proyectos de golpe para ver como se porta la lista con volumen.
 *
 *   npm run bulk -- --email demo@trackpile.local --count 500
 *   npm run bulk -- --email demo@trackpile.local --clean
 */
import { closePool, execute, queryOne, type RowDataPacket } from './pool.js';
import { newId, nowSql } from '../lib/util.js';
import { PROJECT_STATUSES } from '../domain/types.js';

const args = process.argv.slice(2);
const flag = (name: string, fallback: string): string => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback;
};

const email = flag('email', 'demo@trackpile.local');
const count = Number(flag('count', '500'));
const clean = args.includes('--clean');

const user = await queryOne<RowDataPacket & { id: string }>('SELECT id FROM users WHERE email = ?', [email]);
if (!user) {
  console.error(`[db] no existe la cuenta ${email}`);
  await closePool();
  process.exit(1);
}

// Los de relleno se marcan en el nombre para poder quitarlos despues.
const MARK = '[demo] ';

if (clean) {
  const result = await execute('DELETE FROM projects WHERE user_id = ? AND name LIKE ?', [user.id, `${MARK}%`]);
  console.log(`[db] ${result.affectedRows} proyectos de relleno borrados`);
  await closePool();
  process.exit(0);
}

const NOUNS = ['Panel', 'Bot', 'Cliente', 'Servidor', 'Extension', 'Generador', 'Lector', 'Editor', 'Buscador', 'Sincronizador'];
const THEMES = ['de notas', 'de gastos', 'de recetas', 'de habitos', 'de fotos', 'de musica', 'de tareas', 'de rutas', 'de plantas', 'de libros'];
const STACKS = [
  ['Angular', 'TypeScript'], ['React', 'Next.js'], ['Vue', 'Nuxt'], ['Svelte', 'SvelteKit'],
  ['Go', 'Docker'], ['Rust', 'Axum'], ['Node.js', 'Express'], ['Python', 'FastAPI'],
  ['Tailwind', 'Vite'], ['MySQL', 'Prisma'], ['Postgres', 'Drizzle'], ['Electron', 'SQLite'],
];
const ACCENTS = ['amber', 'violet', 'teal', 'rose', 'blue', 'lime', 'slate'];

const rows: unknown[][] = [];
for (let i = 0; i < count; i += 1) {
  const noun = NOUNS[i % NOUNS.length]!;
  const theme = THEMES[Math.floor(i / NOUNS.length) % THEMES.length]!;
  const status = PROJECT_STATUSES[i % PROJECT_STATUSES.length]!;
  const stack = STACKS[i % STACKS.length]!;
  const aged = new Date();
  aged.setDate(aged.getDate() - (i % 400));

  rows.push([
    newId(),
    user.id,
    `${MARK}${noun} ${theme} ${i + 1}`,
    `Proyecto de prueba número ${i + 1}, generado para ver cómo se porta la lista con mucho volumen.`,
    status,
    JSON.stringify(stack),
    null,
    ACCENTS[i % ACCENTS.length]!,
    i % 3 === 0 ? `https://github.com/tu-usuario/demo-${i + 1}` : null,
    i % 4 === 0 ? `https://demo-${i + 1}.ejemplo.com` : null,
    0,
    i,
    nowSql(aged),
    nowSql(aged),
  ]);
}

// De 200 en 200: una sola sentencia con 500 filas es innecesariamente pesada.
const CHUNK = 200;
for (let start = 0; start < rows.length; start += CHUNK) {
  const slice = rows.slice(start, start + CHUNK);
  const placeholders = slice.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',');
  await execute(
    `INSERT INTO projects
      (id, user_id, name, description, status, stack, icon_url, accent, repo_url, live_url, pinned, order_index, created_at, updated_at)
     VALUES ${placeholders}`,
    slice.flat(),
  );
  console.log(`[db] ${Math.min(start + CHUNK, rows.length)}/${rows.length}`);
}

console.log(`[db] ${rows.length} proyectos de prueba en ${email}`);
await closePool();
