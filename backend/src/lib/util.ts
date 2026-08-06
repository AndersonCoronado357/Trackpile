import { randomUUID } from 'node:crypto';

export const newId = (): string => randomUUID();

/** Fecha en el formato DATETIME que espera MySQL, en hora local. */
export function nowSql(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/** Convierte un DATETIME de MySQL a ISO, o null. */
export function toIso(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export const toBool = (value: unknown): boolean => value === 1 || value === true || value === '1';

/**
 * Anade https:// si falta el esquema. Las imagenes subidas llegan como
 * `data:image/...`, asi que hay que dejarlas intactas o se corrompen.
 */
export function normalizeUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** MySQL devuelve JSON ya parseado o como texto segun el driver. */
export function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
    } catch {
      return [];
    }
  }
  return [];
}
