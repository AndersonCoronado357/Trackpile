export const PROJECT_STATUSES = ['idea', 'building', 'done', 'archived'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** Preajustes rápidos; además se admite cualquier color en hexadecimal. */
export const ACCENTS = ['amber', 'violet', 'teal', 'rose', 'blue', 'lime', 'slate'] as const;
export type AccentPreset = (typeof ACCENTS)[number];
export type Accent = string;

const PRESET_VAR: Record<string, string> = {
  amber: 'var(--a-amber)',
  violet: 'var(--a-violet)',
  teal: 'var(--a-teal)',
  rose: 'var(--a-rose)',
  blue: 'var(--a-blue)',
  lime: 'var(--a-lime)',
  slate: 'var(--a-slate)',
};

/** Traduce el acento guardado a un color usable, sea preajuste o hexadecimal. */
export function accentColor(accent: Accent | null | undefined): string {
  if (!accent) return PRESET_VAR['amber']!;
  return PRESET_VAR[accent] ?? accent;
}

/** Color de partida del selector libre, ya en hexadecimal. */
export const PRESET_HEX: Record<AccentPreset, string> = {
  amber: '#f5a627',
  violet: '#8b6ce0',
  teal: '#2fa08c',
  rose: '#dd6c8a',
  blue: '#4f86d6',
  lime: '#7ba33c',
  slate: '#7d8794',
};

export interface StatusMeta {
  id: ProjectStatus;
  label: string;
  color: string;
}

export const STATUS_META: Record<ProjectStatus, StatusMeta> = {
  idea: { id: 'idea', label: 'Idea', color: 'var(--ink-4)' },
  building: { id: 'building', label: 'En desarrollo', color: 'var(--accent)' },
  done: { id: 'done', label: 'Terminado', color: 'var(--ok)' },
  archived: { id: 'archived', label: 'Archivado', color: 'var(--surface-4)' },
};

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

export type ProjectPayload = Partial<Omit<Project, 'id' | 'orderIndex' | 'createdAt' | 'updatedAt'>> & { name: string };

export type ThemeChoice = 'system' | 'light' | 'dark';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  roleLabel: string | null;
  theme: ThemeChoice;
  createdAt: string | null;
}

export interface ProfilePatch {
  name?: string;
  theme?: ThemeChoice;
  avatarUrl?: string | null;
  roleLabel?: string | null;
}

/** Fecha corta en español: "12 feb", sin el punto de la abreviatura. */
export function shortDate(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es', { day: 'numeric', month: 'short' }).replace('.', '');
}
