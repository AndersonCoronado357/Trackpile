#!/usr/bin/env node
/**
 * Arranca Trackpile completo con un solo comando:
 *   1. busca un puerto libre para el API y otro para el frontend,
 *   2. levanta el backend Express contra MySQL,
 *   3. escribe el proxy que manda /api al backend,
 *   4. levanta el dev-server de Angular e imprime la URL final.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { networkInterfaces } from 'node:os';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const backend = join(root, 'backend');
const frontend = join(root, 'frontend');
const isWindows = process.platform === 'win32';

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  brand: (s) => `\x1b[38;5;214m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
};

/** ¿Puedo escuchar en este puerto y en esta direccion? */
function puedoEscuchar(port, host) {
  return new Promise((resolve) => {
    const server = createServer();
    server.unref();
    server.on('error', () => resolve(false));
    server.listen(port, host, () => server.close(() => resolve(true)));
  });
}

/**
 * Libre de verdad: libre en las dos direcciones a las que puede resolver
 * `localhost`, ademas de en el comodin IPv4.
 *
 * Mirando solo 127.0.0.1 el puerto parecia libre aunque otro proyecto ya
 * estuviera escuchando en ::1. Los dos arrancaban —son familias distintas— pero
 * `localhost` en Windows resuelve antes a IPv6, asi que al abrir la direccion
 * contestaba la otra aplicacion y esta parecia rota sin estarlo. El comodin `::`
 * tampoco vale para detectarlo: deja enlazar aunque ::1 este cogido.
 */
async function isFree(port) {
  for (const host of ['0.0.0.0', '127.0.0.1', '::1']) {
    if (!(await puedoEscuchar(port, host))) return false;
  }
  return true;
}

/**
 * Puerto estable: se prefiere siempre el mismo para que la URL no cambie en
 * cada arranque. Tener varias copias vivas en puertos distintos hacia que se
 * mirara una compilacion vieja sin saberlo. Si esta ocupado, se busca el
 * siguiente libre.
 */
async function pickPort(preferred) {
  for (let port = preferred; port < preferred + 40; port += 1) {
    if (await isFree(port)) return port;
  }
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

/**
 * IP de la maquina en la red local, para abrir Trackpile desde el telefono.
 * Se descarta lo virtual (WSL, Docker, VirtualBox) quedandose con el primer
 * rango domestico de verdad.
 */
function ipDeLaRed() {
  const candidatas = [];
  for (const [nombre, direcciones] of Object.entries(networkInterfaces())) {
    if (/vethernet|virtualbox|vmware|loopback|docker|wsl/i.test(nombre)) continue;
    for (const dir of direcciones ?? []) {
      if (dir.family !== 'IPv4' || dir.internal) continue;
      candidatas.push(dir.address);
    }
  }
  return candidatas.find((ip) => /^(192\.168\.|10\.)/.test(ip)) ?? candidatas[0] ?? null;
}

const children = [];

function run(command, args, options) {
  const child = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: isWindows,
    ...options,
  });
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  for (const child of children) {
    try {
      child.kill();
    } catch {
      /* ya estaba muerto */
    }
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

const apiPort = await pickPort(4300);
const webPort = await pickPort(4200);

// El proxy evita CORS en desarrollo: el navegador siempre habla con el dev-server.
writeFileSync(
  join(frontend, 'proxy.conf.json'),
  `${JSON.stringify(
    {
      '/api': {
        target: `http://127.0.0.1:${apiPort}`,
        secure: false,
        changeOrigin: true,
        // Manda las cabeceras x-forwarded-*: sin ellas el backend cree que su
        // direccion es 127.0.0.1 y le da esa a los agentes, que no les sirve.
        xfwd: true,
        logLevel: 'warn',
      },
    },
    null,
    2,
  )}\n`,
);

console.log(`\n  ${c.brand('Trackpile')} ${c.dim('- arrancando...')}\n`);

/* ------------------------------------------------------------------ backend */

// `dev` = tsx watch: al tocar el backend se reinicia solo, como hace Angular.
const api = run('npm', ['run', 'dev'], {
  cwd: backend,
  env: { ...process.env, PORT: String(apiPort), HOST: '127.0.0.1' },
});

let apiReady = false;

api.stdout.on('data', (chunk) => {
  const text = String(chunk);
  if (text.includes('TRACKPILE_API_PORT=')) {
    apiReady = true;
    return;
  }
  for (const line of text.split('\n')) {
    if (line.trim() && !line.startsWith('>')) console.log(`  ${c.dim(line.trim())}`);
  }
});

api.stderr.on('data', (chunk) => {
  const text = String(chunk).trim();
  if (text && !text.startsWith('npm warn')) console.log(`  ${c.red(text)}`);
});

api.on('exit', (code) => {
  if (code !== 0) {
    console.log(`\n  ${c.red('El backend se detuvo.')} Revisa la conexion con MySQL.\n`);
    shutdown(code ?? 1);
  }
});

// Se espera a que el API confirme que esta escuchando antes de abrir Angular.
const started = Date.now();
while (!apiReady && Date.now() - started < 40_000) {
  await new Promise((resolve) => setTimeout(resolve, 150));
}

if (!apiReady) {
  console.log(`\n  ${c.red('El backend no respondio a tiempo.')}\n`);
  shutdown(1);
}

console.log(`  ${c.green('*')} API en ${c.dim(`http://127.0.0.1:${apiPort}/api`)}`);

/* ----------------------------------------------------------------- frontend */

// 0.0.0.0: tambien escucha en la red local para poder abrirlo desde el telefono.
// El API sigue solo en 127.0.0.1; se llega a el por el proxy del dev-server.
const web = run(
  'npm',
  ['run', 'ng', '--', 'serve', '--port', String(webPort), '--host', '0.0.0.0', '--proxy-config', 'proxy.conf.json'],
  { cwd: frontend },
);

const ipLocal = ipDeLaRed();
let announced = false;

web.stdout.on('data', (chunk) => {
  const text = String(chunk);

  if (!announced && (text.includes('Watch mode enabled') || text.includes('Local:') || text.includes('building...'))) {
    announced = true;
    const url = `http://localhost:${webPort}`;
    console.log(`\n  ${c.bold('Trackpile esta listo')}`);
    console.log(`  ${c.brand('->')} ${c.bold(url)}`);
    if (ipLocal) {
      console.log(`  ${c.brand('->')} ${c.bold(`http://${ipLocal}:${webPort}`)} ${c.dim('(desde el telefono)')}`);
      console.log(`  ${c.dim(`API para agentes: http://${ipLocal}:${webPort}/api/docs`)}`);
    }
    console.log(`  ${c.dim('Ctrl+C para detener')}\n`);
  }

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('>')) continue;
    if (/error|failed|ERROR/i.test(trimmed)) console.log(`  ${c.red(trimmed)}`);
    else if (/Application bundle generation complete|Watch mode/i.test(trimmed)) console.log(`  ${c.dim(trimmed)}`);
  }
});

web.stderr.on('data', (chunk) => {
  const text = String(chunk).trim();
  if (text && !text.startsWith('npm warn')) console.log(`  ${c.red(text)}`);
});

web.on('exit', (code) => shutdown(code ?? 0));
