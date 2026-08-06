import { z } from 'zod';
import { PROJECT_STATUSES } from './types.js';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v === undefined || v === null || v === '' ? null : v));

/**
 * Los campos, sin valores por defecto. Se declaran aparte a proposito: un
 * `.partial()` sobre un esquema con `.default()` NO quita el defecto, asi que
 * una actualizacion de un solo campo rellenaba todos los demas con su valor
 * inicial. Cambiar el estado desde la lista borraba el stack, el color y el
 * fijado del proyecto.
 */
const projectFields = {
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(160),
  description: optionalText(2000),
  status: z.enum(PROJECT_STATUSES),
  stack: z.array(z.string().trim().min(1).max(40)).max(20),
  // URL remota o data URL de la imagen que el usuario subio para ese proyecto.
  iconUrl: optionalText(3_000_000),
  // Un preajuste con nombre o cualquier color en hexadecimal.
  accent: z
    .string()
    .trim()
    .regex(/^(#[0-9a-fA-F]{6}|amber|violet|teal|rose|blue|lime|slate)$/, 'Color invalido'),
  repoUrl: optionalText(600),
  liveUrl: optionalText(600),
  pinned: z.boolean(),
};

/** Al crear si hay defectos: un proyecto nuevo nace como idea, ambar y suelto. */
export const projectCreateSchema = z.object({
  ...projectFields,
  status: projectFields.status.default('idea'),
  stack: projectFields.stack.default([]),
  accent: projectFields.accent.default('amber'),
  pinned: projectFields.pinned.default(false),
});

/** Al actualizar, solo se toca lo que llega. Lo que no viene, no se toca. */
export const projectUpdateSchema = z.object(projectFields).partial();

export const reorderSchema = z.object({
  orderedIds: z.array(z.uuid()).max(500),
});

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Correo invalido').max(190),
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
  password: z.string().min(8, 'La contrasena debe tener al menos 8 caracteres').max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(190),
  password: z.string().min(1, 'Escribe tu contrasena').max(200),
});

export const profileSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  theme: z.enum(['system', 'light', 'dark']).optional(),
  // Acepta URL remota o data URL de una imagen recortada en el navegador.
  avatarUrl: z
    .string()
    .trim()
    .max(3_000_000, 'La imagen es demasiado grande')
    .nullish()
    .transform((v) => (v === undefined || v === null || v === '' ? null : v))
    .optional(),
  roleLabel: optionalText(80).optional(),
});

export const passwordSchema = z.object({
  current: z.string().min(1, 'Escribe tu contrasena actual'),
  next: z.string().min(8, 'La contrasena nueva debe tener al menos 8 caracteres').max(200),
});

export const forgotSchema = z.object({
  email: z.string().trim().toLowerCase().max(190),
});

export const resetSchema = z.object({
  token: z.string().trim().min(10).max(200),
  password: z.string().min(8, 'La contrasena debe tener al menos 8 caracteres').max(200),
});

export const tokenSchema = z.object({
  label: z.string().trim().min(1).max(80).default('Agente'),
});

export const googleSchema = z.object({
  credential: z.string().trim().min(20).max(5000),
});

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
