import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { env } from '../config/env.js';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.database,
      waitForConnections: true,
      connectionLimit: env.db.connectionLimit,
      queueLimit: 0,
      charset: 'utf8mb4_general_ci',
      dateStrings: true,
      supportBigNumbers: true,
      multipleStatements: false,
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/** mysql2 tipa los parametros muy estrechamente; en la practica acepta escalares. */
type Params = Parameters<Pool['execute']>[1];
const values = (params: unknown[]): Params => params as Params;

export async function query<T extends RowDataPacket>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await getPool().execute<T[]>(sql, values(params));
  return rows;
}

export async function queryOne<T extends RowDataPacket>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function execute(sql: string, params: unknown[] = []): Promise<ResultSetHeader> {
  const [result] = await getPool().execute<ResultSetHeader>(sql, values(params));
  return result;
}

export async function run(cx: PoolConnection, sql: string, params: unknown[] = []): Promise<ResultSetHeader> {
  const [result] = await cx.execute<ResultSetHeader>(sql, values(params));
  return result;
}

/** Ejecuta una funcion dentro de una transaccion, con rollback si lanza. */
export async function withTransaction<T>(fn: (cx: PoolConnection) => Promise<T>): Promise<T> {
  const cx = await getPool().getConnection();
  try {
    await cx.beginTransaction();
    const result = await fn(cx);
    await cx.commit();
    return result;
  } catch (error) {
    try {
      await cx.rollback();
    } catch {
      /* la conexion ya estaba rota */
    }
    throw error;
  } finally {
    cx.release();
  }
}

export type { PoolConnection, ResultSetHeader, RowDataPacket };
