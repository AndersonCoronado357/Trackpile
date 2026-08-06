import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { SessionStore } from './core/session.store';
import { ToastService } from './core/toast.service';
import { AccountMenuComponent } from './features/account/account-menu';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, AccountMenuComponent],
  template: `
    @if (!session.ready() || session.switching()) {
      <!-- Pantalla neutra mientras se restaura la sesion: evita el parpadeo -->
      <div class="grid h-full w-full place-items-center" style="background: var(--bg)">
        <img src="assets/trackpile-icon.svg" alt="Trackpile" class="h-8 w-8" style="animation: tp-pulse 1.3s ease-in-out infinite" />
      </div>
    } @else if (session.isAuthenticated()) {
      <div class="grid h-full w-full grid-rows-[auto_minmax(0,1fr)] overflow-hidden" style="background: var(--bg)">
        <!-- Barra superior: llega a los bordes, sin borde inferior -->
        <header class="flex min-w-0 flex-none items-center gap-2.5 px-4 pt-3.5 pb-1 sm:px-7">
          <a routerLink="/proyectos" class="flex flex-none items-center gap-2.5">
            <img src="assets/trackpile-icon.svg" alt="" class="h-6 w-6" />
            <span class="font-display text-[15px] font-bold tracking-[-0.02em]">Trackpile</span>
          </a>
          <tp-account-menu class="ml-auto flex-none" />
        </header>

        <main class="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)] overflow-hidden">
          <router-outlet />
        </main>
      </div>
    } @else {
      <router-outlet />
    }

    <!-- Avisos -->
    <div class="pointer-events-none fixed bottom-5 left-1/2 z-[90] flex w-full max-w-[380px] -translate-x-1/2 flex-col gap-2 px-4">
      @for (toast of toastService.toasts(); track toast.id) {
        <button
          type="button"
          class="pointer-events-auto flex items-start gap-2.5 rounded-[16px] px-3.5 py-2.5 text-left text-[12.5px] leading-5"
          style="background: var(--surface-2); animation: tp-rise 240ms var(--ease) both"
          (click)="toastService.dismiss(toast.id)"
        >
          <span
            class="mt-[7px] h-[6px] w-[6px] flex-none rounded-full"
            [style.background]="toast.tone === 'ok' ? 'var(--ok)' : toast.tone === 'error' ? 'var(--danger)' : 'var(--ink-4)'"
          ></span>
          <span class="min-w-0 flex-1">{{ toast.text }}</span>
        </button>
      }
    </div>
  `,
})
export class App {
  protected readonly session = inject(SessionStore);
  protected readonly toastService = inject(ToastService);
}
