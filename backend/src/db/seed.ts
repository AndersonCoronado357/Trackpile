import { createProject, countProjects } from '../projects/projects.repo.js';
import type { ProjectCreateInput } from '../domain/schemas.js';

/**
 * Lo unico que se siembra al crear una cuenta: la propia Trackpile.
 *
 * Antes venia con media docena de proyectos inventados de relleno. Una lista
 * personal no se estrena con proyectos ajenos; se estrena con el unico que a
 * esas alturas existe de verdad, que es esta.
 */
const PRIMERO: ProjectCreateInput = {
  name: 'Trackpile',
  description: 'Lista personal de todos mis proyectos: en que estado va cada uno, con que stack y donde esta publicado.',
  status: 'building',
  stack: ['Angular', 'TypeScript', 'Tailwind', 'Express', 'MySQL'],
  iconUrl: null,
  accent: 'amber',
  repoUrl: 'https://github.com/AndersonCoronado357/Trackpile',
  liveUrl: 'https://trackpile.acmsy.com',
  pinned: true,
};

/** Deja la cuenta recien creada con su primer proyecto. No pisa nada. */
export async function seedForUser(userId: string): Promise<number> {
  if ((await countProjects(userId)) > 0) return 0;
  await createProject(userId, PRIMERO);
  return 1;
}
