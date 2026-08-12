import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(here, '..', '..');
const repoRoot = resolve(backendRoot, '..');

// Precedencia: variables del entorno > backend/.env > .env de la raiz.
for (const candidate of [resolve(backendRoot, '.env'), resolve(repoRoot, '.env')]) {
  if (existsSync(candidate)) loadDotenv({ path: candidate, override: false, quiet: true });
}

const str = (name: string, fallback: string): string => {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
};

const int = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const bool = (name: string, fallback: boolean): boolean => {
  const raw = process.env[name];
  if (!raw) return fallback;
  return ['1', 'true', 'yes', 'si', 'on'].includes(raw.toLowerCase());
};

const lista = (name: string): string[] =>
  (process.env[name] ?? '')
    .split(',')
    .map((valor) => valor.trim().toLowerCase())
    .filter(Boolean);

/**
 * Conexion en una sola cadena, que es como la entregan los servidores gestionados:
 * mysql://usuario:clave@servidor:3306/base. Las variables sueltas mandan sobre
 * ella, para poder ajustar una sola pieza sin rehacer la cadena entera.
 */
function desdeUrl(): Partial<Record<'host' | 'user' | 'password' | 'database', string> & { port: number }> {
  const bruto = process.env['DATABASE_URL'] ?? process.env['MYSQL_URL'] ?? '';
  if (!bruto) return {};
  try {
    const url = new URL(bruto);
    return {
      host: url.hostname,
      port: url.port ? Number.parseInt(url.port, 10) : 3306,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ''),
    };
  } catch {
    return {};
  }
}

const url = desdeUrl();
const enProduccion = str('NODE_ENV', 'development') === 'production';

export const env = {
  nodeEnv: str('NODE_ENV', 'development'),
  /** 0 = el sistema operativo asigna un puerto libre. */
  port: int('PORT', 0),
  /** En un contenedor hay que escuchar en todas las interfaces o nadie llega. */
  host: str('HOST', enProduccion ? '0.0.0.0' : '127.0.0.1'),
  /** Direccion publica. Detras de un proxy la peticion llega como localhost. */
  origin: str('ORIGIN', '').replace(/\/$/, ''),
  db: {
    host: str('DB_HOST', url.host ?? '127.0.0.1'),
    port: int('DB_PORT', url.port ?? 3306),
    user: str('DB_USER', url.user ?? 'root'),
    password: str('DB_PASSWORD', url.password ?? ''),
    database: str('DB_NAME', url.database ?? 'trackpile'),
    connectionLimit: int('DB_POOL', 10),
  },
  auth: {
    secret: str('AUTH_SECRET', 'trackpile-dev-secret-cambiar-en-produccion'),
    cookieName: str('AUTH_COOKIE', 'trackpile_session'),
    /** Dias que dura la sesion. */
    days: int('AUTH_DAYS', 30),
    bcryptRounds: int('BCRYPT_ROUNDS', 12),
    /** Permitir registrar cuentas nuevas. */
    allowSignup: bool('ALLOW_SIGNUP', true),
    /**
     * Correos que pueden abrir cuenta. Vacio = cualquiera. En internet abierto
     * esto es lo que evita que la lista personal se llene de desconocidos, sin
     * tener que cerrar el registro y quedarse fuera uno mismo.
     */
    signupAllowlist: lista('SIGNUP_ALLOWLIST'),
    /** Vacio = el boton de Google avisa de que falta configurarlo. */
    googleClientId: str('GOOGLE_CLIENT_ID', ''),
    /** Necesario para canjear el codigo por el token en el flujo de redireccion. */
    googleClientSecret: str('GOOGLE_CLIENT_SECRET', ''),
  },
  paths: { backendRoot, repoRoot },
} as const;
