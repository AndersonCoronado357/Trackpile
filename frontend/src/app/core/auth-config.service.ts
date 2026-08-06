import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

interface AuthConfig {
  allowSignup: boolean;
  googleClientId: string | null;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(options: {
            client_id: string;
            callback: (r: { credential: string }) => void;
            ux_mode?: 'popup' | 'redirect';
            auto_select?: boolean;
            itp_support?: boolean;
            use_fedcm_for_prompt?: boolean;
          }): void;
          prompt(): void;
          renderButton(el: HTMLElement, options: Record<string, unknown>): void;
          cancel(): void;
        };
      };
    };
  }
}

/**
 * Configuracion publica del acceso. El script de Google solo se carga si hay
 * clave configurada: sin ella la app no pide nada a ningun servidor externo.
 */
@Injectable({ providedIn: 'root' })
export class AuthConfigService {
  private readonly http = inject(HttpClient);

  readonly config = signal<AuthConfig>({ allowSignup: true, googleClientId: null });
  readonly googleReady = signal(false);

  private loading: Promise<void> | null = null;

  async load(): Promise<void> {
    try {
      this.config.set(await firstValueFrom(this.http.get<AuthConfig>('/api/config')));
    } catch {
      /* sin configuracion se asume lo minimo */
    }
  }

  /**
   * Dibuja el boton propio de Google dentro de `destino` y avisa con el token
   * cuando el usuario entra.
   *
   * Antes esto usaba `prompt()`, que es One Tap, y por eso "no abria": One Tap
   * se suprime sin decir nada —tiene periodo de espera si lo cerraste antes, y
   * varios navegadores no lo muestran—. El boton dibujado por Google siempre
   * abre su ventana al pulsarlo, que es lo que se espera de un boton.
   */
  async renderGoogleButton(destino: HTMLElement, ancho: number, alEntrar: (credential: string) => void): Promise<void> {
    const clientId = this.config().googleClientId;
    if (!clientId) throw new Error('sin clave de Google');

    await this.loadScript();
    const id = window.google?.accounts.id;
    if (!id) throw new Error('Google no cargo');

    id.initialize({
      client_id: clientId,
      callback: (respuesta) => {
        if (respuesta.credential) alEntrar(respuesta.credential);
      },
      ux_mode: 'popup',
      auto_select: false,
      // Safari bloquea las cookies de terceros; con esto Google usa su rodeo.
      itp_support: true,
    });

    destino.innerHTML = '';
    id.renderButton(destino, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      logo_alignment: 'center',
      // Google solo acepta entre 200 y 400.
      width: Math.min(400, Math.max(200, Math.round(ancho))),
    });
  }

  private loadScript(): Promise<void> {
    if (this.googleReady()) return Promise.resolve();
    if (this.loading) return this.loading;

    this.loading = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        this.googleReady.set(true);
        resolve();
      };
      script.onerror = () => reject(new Error('No se pudo cargar Google'));
      document.head.appendChild(script);
    });
    return this.loading;
  }
}
