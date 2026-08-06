import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ApiService, describeError } from './api.service';
import type { ProfilePatch, ThemeChoice, User } from './models';

/**
 * Sesion y tema. Nada se guarda en el navegador: el usuario vive en una cookie
 * httpOnly y la preferencia de tema en la columna `users.theme` de MySQL.
 * Mientras no hay sesion, manda la preferencia del sistema operativo.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly api = inject(ApiService);
  private readonly document = inject(DOCUMENT);

  private readonly _user = signal<User | null>(null);
  private readonly _ready = signal(false);
  private readonly _busy = signal(false);
  private readonly _error = signal<string | null>(null);

  /**
   * Encendido mientras se entra o se sale. La app pinta una pantalla neutra
   * durante ese rato: si no, el cascaron cambiaba antes de que la ruta llegara
   * y se veian el acceso y la lista a la vez.
   */
  private readonly _switching = signal(false);
  readonly switching = this._switching.asReadonly();

  beginSwitch(): void {
    this._switching.set(true);
  }

  endSwitch(): void {
    this._switching.set(false);
  }

  readonly user = this._user.asReadonly();
  readonly ready = this._ready.asReadonly();
  readonly busy = this._busy.asReadonly();
  readonly error = this._error.asReadonly();

  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly theme = computed<ThemeChoice>(() => this._user()?.theme ?? 'system');

  readonly initials = computed(() => {
    const name = this._user()?.name?.trim() ?? '';
    if (!name) return '?';
    const parts = name.split(/\s+/).slice(0, 2);
    return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
  });

  constructor() {
    // Estampa data-theme en <html>. Sin sesion se quita el atributo para que
    // decida @media (prefers-color-scheme) y no haya parpadeo al cargar.
    effect(() => {
      const choice = this.theme();
      const root = this.document.documentElement;
      if (choice === 'system') root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', choice);
    });
  }

  /** Se llama una vez al arrancar la app. */
  async restore(): Promise<void> {
    try {
      this._user.set(await this.api.me());
    } catch {
      this._user.set(null);
    } finally {
      this._ready.set(true);
    }
  }

  async login(email: string, password: string): Promise<boolean> {
    return this.attempt(() => this.api.login(email, password));
  }

  async register(email: string, name: string, password: string): Promise<boolean> {
    return this.attempt(() => this.api.register(email, name, password));
  }

  private async attempt(action: () => Promise<User>): Promise<boolean> {
    this._busy.set(true);
    this._error.set(null);
    try {
      this._user.set(await action());
      return true;
    } catch (error) {
      this._error.set(describeError(error));
      return false;
    } finally {
      this._busy.set(false);
    }
  }

  async logout(): Promise<void> {
    try {
      await this.api.logout();
    } finally {
      this._user.set(null);
      this._error.set(null);
    }
  }

  clearError(): void {
    this._error.set(null);
  }

  /** Cambio optimista: la UI reacciona al instante y se revierte si falla. */
  async setTheme(theme: ThemeChoice): Promise<void> {
    const current = this._user();
    if (!current) return;
    this._user.set({ ...current, theme });
    try {
      this._user.set(await this.api.updateProfile({ theme }));
    } catch {
      this._user.set(current);
    }
  }

  async patchProfile(patch: ProfilePatch): Promise<boolean> {
    try {
      this._user.set(await this.api.updateProfile(patch));
      return true;
    } catch (error) {
      this._error.set(describeError(error));
      return false;
    }
  }
}
