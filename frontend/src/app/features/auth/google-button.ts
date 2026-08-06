import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { AuthConfigService } from '../../core/auth-config.service';
import { GOOGLE_MARK } from '../../shared/icon';

/**
 * Entrar con Google.
 *
 * Es un boton normal que lleva a /auth/google/start: el servidor redirige a
 * Google, Google vuelve a /auth/google/callback y alli se abre la sesion.
 *
 * Antes esto era One Tap (`prompt()`), que se suprime sin decir nada y por eso
 * "no abria". El flujo de redireccion siempre responde, y ademas el boton es
 * nuestro de verdad: no hay iframe de Google que haya que disimular.
 */
@Component({
  selector: 'tp-google-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="flex h-[46px] w-full items-center justify-center gap-2.5 rounded-[12px] text-[13.5px] font-semibold transition-colors"
      style="background: var(--surface-2); color: var(--ink)"
      [disabled]="!disponible() || yendo()"
      (click)="entrar()"
    >
      <span class="flex-none" [innerHTML]="mark()"></span>
      {{ yendo() ? 'Abriendo Google...' : disponible() ? 'Continuar con Google' : 'Google no disponible' }}
    </button>
  `,
  styles: [
    `
      button:hover:not(:disabled) {
        background: var(--surface-3);
      }
      button:disabled {
        opacity: 0.6;
      }
    `,
  ],
})
export class GoogleButtonComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly authConfig = inject(AuthConfigService);

  readonly unavailable = output<string>();

  protected readonly yendo = signal(false);
  protected readonly disponible = computed(() => !!this.authConfig.config().googleClientId);

  // Marca ajena en color, definida como constante del propio codigo.
  protected readonly mark: () => SafeHtml = () => this.sanitizer.bypassSecurityTrustHtml(GOOGLE_MARK);

  protected entrar(): void {
    if (!this.disponible()) {
      this.unavailable.emit('Falta configurar GOOGLE_CLIENT_ID para usar Google');
      return;
    }
    // Se sale de la aplicacion entera: no hay vuelta que gestionar aqui, la
    // sesion ya viene puesta cuando Google devuelve el control.
    this.yendo.set(true);
    window.location.assign('/auth/google/start');
  }
}
