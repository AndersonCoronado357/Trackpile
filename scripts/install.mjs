#!/usr/bin/env node
/** Instala las dependencias de backend y frontend en una sola pasada. */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';

for (const folder of ['backend', 'frontend']) {
  console.log(`\n  Instalando dependencias de ${folder}...\n`);
  const result = spawnSync('npm', ['install'], { cwd: join(root, folder), stdio: 'inherit', shell: isWindows });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('\n  Listo. Ahora: npm run db:setup y despues npm start\n');
