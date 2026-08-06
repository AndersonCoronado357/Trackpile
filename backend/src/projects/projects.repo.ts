import { execute, query, queryOne, run, withTransaction, type RowDataPacket } from '../db/pool.js';
import type { Accent, Project, ProjectStatus } from '../domain/types.js';
import type { ProjectCreateInput, ProjectUpdateInput } from '../domain/schemas.js';
import { newId, normalizeUrl, nowSql, parseJsonArray, toBool, toIso } from '../lib/util.js';

interface ProjectRow extends RowDataPacket {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  stack: unknown;
  icon_url: string | null;
  accent: Accent;
  repo_url: string | null;
  live_url: string | null;
  pinned: number;
  order_index: number;
  created_at: string;
  updated_at: string;
}

const map = (row: ProjectRow): Project => ({
  id: row.id,
  name: row.name,
  description: row.description,
  status: row.status,
  stack: parseJsonArray(row.stack),
  iconUrl: row.icon_url,
  accent: row.accent,
  repoUrl: row.repo_url,
  liveUrl: row.live_url,
  pinned: toBool(row.pinned),
  orderIndex: row.order_index,
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at),
});

export async function listProjects(userId: string): Promise<Project[]> {
  const rows = await query<ProjectRow>(
    'SELECT * FROM projects WHERE user_id = ? ORDER BY pinned DESC, order_index ASC, updated_at DESC',
    [userId],
  );
  return rows.map(map);
}

export async function findProject(userId: string, id: string): Promise<Project | null> {
  const row = await queryOne<ProjectRow>('SELECT * FROM projects WHERE id = ? AND user_id = ?', [id, userId]);
  return row ? map(row) : null;
}

/**
 * Busca por nombre, sin distinguir mayusculas. Es la puerta para los agentes:
 * un asistente que trabaja en una carpeta sabe como se llama el proyecto, pero
 * no su identificador.
 */
export async function findProjectByName(userId: string, name: string): Promise<Project | null> {
  const row = await queryOne<ProjectRow>('SELECT * FROM projects WHERE user_id = ? AND LOWER(name) = LOWER(?)', [
    userId,
    name.trim(),
  ]);
  return row ? map(row) : null;
}

export async function createProject(userId: string, input: ProjectCreateInput): Promise<Project> {
  const id = newId();
  const orderRow = await queryOne<RowDataPacket & { next: number }>(
    'SELECT COALESCE(MIN(order_index), 0) - 1 AS next FROM projects WHERE user_id = ?',
    [userId],
  );

  await execute(
    `INSERT INTO projects
      (id, user_id, name, description, status, stack, icon_url, accent, repo_url, live_url, pinned, order_index, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      userId,
      input.name,
      input.description,
      input.status,
      JSON.stringify(input.stack ?? []),
      normalizeUrl(input.iconUrl),
      input.accent,
      normalizeUrl(input.repoUrl),
      normalizeUrl(input.liveUrl),
      input.pinned ? 1 : 0,
      Number(orderRow?.next ?? 0),
      nowSql(),
      nowSql(),
    ],
  );

  const created = await findProject(userId, id);
  if (!created) throw new Error('No se pudo crear el proyecto');
  return created;
}

const COLUMNS: Record<string, string> = {
  name: 'name',
  description: 'description',
  status: 'status',
  iconUrl: 'icon_url',
  accent: 'accent',
  repoUrl: 'repo_url',
  liveUrl: 'live_url',
  pinned: 'pinned',
};

export async function updateProject(userId: string, id: string, input: ProjectUpdateInput): Promise<Project | null> {
  const current = await findProject(userId, id);
  if (!current) return null;

  const sets: string[] = [];
  const args: unknown[] = [];

  for (const [key, column] of Object.entries(COLUMNS)) {
    if (!(key in input)) continue;
    let value = (input as Record<string, unknown>)[key];
    if (key === 'pinned') value = value ? 1 : 0;
    if (key === 'iconUrl' || key === 'repoUrl' || key === 'liveUrl') value = normalizeUrl(value as string | null);
    sets.push(`${column} = ?`);
    args.push(value ?? null);
  }

  if (input.stack !== undefined) {
    sets.push('stack = ?');
    args.push(JSON.stringify(input.stack));
  }

  sets.push('updated_at = ?');
  args.push(nowSql());

  await execute(`UPDATE projects SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, [...args, id, userId]);
  return findProject(userId, id);
}

export async function deleteProject(userId: string, id: string): Promise<boolean> {
  const result = await execute('DELETE FROM projects WHERE id = ? AND user_id = ?', [id, userId]);
  return result.affectedRows > 0;
}

export async function reorderProjects(userId: string, orderedIds: string[]): Promise<Project[]> {
  await withTransaction(async (cx) => {
    for (const [index, id] of orderedIds.entries()) {
      await run(cx, 'UPDATE projects SET order_index = ? WHERE id = ? AND user_id = ?', [index, id, userId]);
    }
  });
  return listProjects(userId);
}

export async function countProjects(userId: string): Promise<number> {
  const row = await queryOne<RowDataPacket & { n: number }>('SELECT COUNT(*) AS n FROM projects WHERE user_id = ?', [userId]);
  return Number(row?.n ?? 0);
}
