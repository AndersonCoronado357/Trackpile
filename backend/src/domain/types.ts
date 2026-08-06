export const PROJECT_STATUSES = ['idea', 'building', 'done', 'archived'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** Acentos disponibles para el monograma cuando no hay icono. */
export const ACCENTS = ['amber', 'violet', 'teal', 'rose', 'blue', 'lime', 'slate'] as const;
export type Accent = (typeof ACCENTS)[number];

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  stack: string[];
  iconUrl: string | null;
  accent: Accent;
  repoUrl: string | null;
  liveUrl: string | null;
  pinned: boolean;
  orderIndex: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  roleLabel: string | null;
  theme: 'system' | 'light' | 'dark';
  createdAt: string | null;
}
