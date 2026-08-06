import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { ProfilePatch, Project, ProjectPayload, User } from './models';

/** El proxy del dev-server manda /api al backend Express. */
const BASE = '/api';
const WITH_COOKIES = { withCredentials: true } as const;

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  /* ------------------------------------------------------------------ auth */

  me(): Promise<User> {
    return firstValueFrom(this.http.get<User>(`${BASE}/auth/me`, WITH_COOKIES));
  }

  login(email: string, password: string): Promise<User> {
    return firstValueFrom(this.http.post<User>(`${BASE}/auth/login`, { email, password }, WITH_COOKIES));
  }

  register(email: string, name: string, password: string): Promise<User> {
    return firstValueFrom(this.http.post<User>(`${BASE}/auth/register`, { email, name, password }, WITH_COOKIES));
  }

  logout(): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${BASE}/auth/logout`, {}, WITH_COOKIES));
  }

  loginWithGoogle(credential: string): Promise<User> {
    return firstValueFrom(this.http.post<User>(`${BASE}/auth/google`, { credential }, WITH_COOKIES));
  }

  /** Devuelve el enlace solo en desarrollo, cuando no hay servidor de correo. */
  forgotPassword(email: string): Promise<{ ok: boolean; link?: string }> {
    return firstValueFrom(this.http.post<{ ok: boolean; link?: string }>(`${BASE}/auth/forgot`, { email }, WITH_COOKIES));
  }

  resetPassword(token: string, password: string): Promise<User> {
    return firstValueFrom(this.http.post<User>(`${BASE}/auth/reset`, { token, password }, WITH_COOKIES));
  }

  updateProfile(patch: ProfilePatch): Promise<User> {
    return firstValueFrom(this.http.patch<User>(`${BASE}/auth/me`, patch, WITH_COOKIES));
  }

  changePassword(current: string, next: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${BASE}/auth/password`, { current, next }, WITH_COOKIES));
  }

  /* -------------------------------------------------------------- proyectos */

  listProjects(): Promise<Project[]> {
    return firstValueFrom(this.http.get<Project[]>(`${BASE}/projects`, WITH_COOKIES));
  }

  createProject(payload: ProjectPayload): Promise<Project> {
    return firstValueFrom(this.http.post<Project>(`${BASE}/projects`, payload, WITH_COOKIES));
  }

  updateProject(id: string, payload: Partial<ProjectPayload>): Promise<Project> {
    return firstValueFrom(this.http.patch<Project>(`${BASE}/projects/${id}`, payload, WITH_COOKIES));
  }

  deleteProject(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${BASE}/projects/${id}`, WITH_COOKIES));
  }

  reorder(orderedIds: string[]): Promise<Project[]> {
    return firstValueFrom(this.http.post<Project[]>(`${BASE}/projects/reorder`, { orderedIds }, WITH_COOKIES));
  }

  /* ------------------------------------------------- llaves para agentes */

  listTokens(): Promise<ApiToken[]> {
    return firstValueFrom(this.http.get<ApiToken[]>(`${BASE}/tokens`, WITH_COOKIES));
  }

  /** El texto de la llave solo viaja en esta respuesta; despues ya no existe. */
  createToken(label: string): Promise<ApiToken & { token: string }> {
    return firstValueFrom(
      this.http.post<ApiToken & { token: string }>(`${BASE}/tokens`, { label }, WITH_COOKIES),
    );
  }

  deleteToken(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${BASE}/tokens/${id}`, WITH_COOKIES));
  }
}

export interface ApiToken {
  id: string;
  label: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/** Traduce un error de HttpClient a un mensaje legible. */
export function describeError(error: unknown): string {
  const candidate = error as { error?: { error?: string }; status?: number; message?: string };
  if (candidate?.error?.error) return candidate.error.error;
  if (candidate?.status === 0) return 'No hay conexion con el servidor';
  if (candidate?.status === 401) return 'Tu sesion expiro';
  return candidate?.message ?? 'Ocurrio un error inesperado';
}
