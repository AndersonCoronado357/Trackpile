#!/usr/bin/env node
/**
 * Crea la base de datos de Trackpile y, opcionalmente, un usuario dedicado.
 * La contrasena de administrador se pide por consola y nunca se guarda en disco.
 *
 *   node scripts/setup-db.mjs
 *   node scripts/setup-db.mjs --admin-user root --create-app-user
 */
import { createInterface } from 'node:readline';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'backend', 'package.json'));
const mysql = require('mysql2/promise');

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const host = flag('host', '127.0.0.1');
const port = Number(flag('port', '3306'));
const adminUser = flag('admin-user', 'root');
const dbName = flag('db', 'trackpile');
const appUser = flag('app-user', 'trackpile');
const appPassword = flag('app-password', 'trackpile_dev');
const createAppUser = args.includes('--create-app-user');

/** Lee una linea de la consola sin mostrar lo que se escribe. */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    rl._writeToOutput = (chunk) => {
      rl.output.write(muted && !String(chunk).includes(question) ? '*' : chunk);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    muted = true;
  });
}

const password = process.env.MYSQL_ADMIN_PASSWORD ?? (await askHidden(`Contrasena de MySQL para "${adminUser}": `));

let connection;
try {
  connection = await mysql.createConnection({ host, port, user: adminUser, password });
} catch (error) {
  console.error(`\n  No se pudo conectar a MySQL en ${host}:${port}`);
  console.error(`  ${error.message}\n`);
  process.exit(1);
}

await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`);
console.log(`  Base de datos "${dbName}" lista.`);

if (createAppUser) {
  await connection.query('CREATE USER IF NOT EXISTS ?@\'localhost\' IDENTIFIED BY ?', [appUser, appPassword]);
  await connection.query(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO ?@'localhost'`, [appUser]);
  await connection.query('FLUSH PRIVILEGES');
  console.log(`  Usuario "${appUser}" creado con permisos sobre "${dbName}".`);
}

await connection.end();

// Deja preparado backend/.env si todavia no existe.
const envPath = join(root, 'backend', '.env');
if (!existsSync(envPath)) {
  const example = readFileSync(join(root, 'backend', '.env.example'), 'utf8');
  const filled = example
    .replace(/^DB_USER=.*$/m, `DB_USER=${createAppUser ? appUser : adminUser}`)
    .replace(/^DB_PASSWORD=.*$/m, `DB_PASSWORD="${createAppUser ? appPassword : password}"`)
    .replace(/^DB_NAME=.*$/m, `DB_NAME=${dbName}`);
  writeFileSync(envPath, filled);
  console.log('  backend/.env generado.');
}

console.log('\n  Listo. Ahora ejecuta: npm start\n');
