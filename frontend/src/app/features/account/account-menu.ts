import { ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SessionStore } from '../../core/session.store';
import { ProjectsStore } from '../../core/projects.store';
import { ToastService } from '../../core/toast.service';
import { isImage, squareThumbnail } from '../../core/image';
import type { ThemeChoice } from '../../core/models';
import { IconComponent } from '../../shared/icon';
import { AvatarComponent } from '../../shared/avatar';
import { AgentKeysComponent } from './agent-keys';

const AVATAR_PX = 288;

/**
 * Cuenta: el chip de la barra y su menu. Aqui vive todo lo que hay que ajustar
 * —foto, nombre y tema—, que es poco: una pantalla entera de ajustes para esto
 * sobraba. Sin librerias de overlay: una signal y un listener de documento.
 */
@Component({
  selector: 'tp-account-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, AvatarComponent, AgentKeysComponent],
  template: `
    <div class="relative">
      <button
        type="button"
        class="flex items-center gap-2.5 rounded-[999px] py-[5px] pl-[5px] pr-2.5 transition-colors hover:bg-[var(--surface-2)]"
        [style.background]="open() ? 'var(--surface-2)' : 'transparent'"
        (click)="toggle($event)"
        aria-haspopup="menu"
        [attr.aria-expanded]="open()"
      >
        <tp-avatar
          [name]="session.user()?.name ?? ''"
          [email]="session.user()?.email ?? ''"
          [photo]="session.user()?.avatarUrl ?? null"
          [size]="30"
        />
        <span class="hidden min-w-0 flex-col items-start leading-[1.25] sm:flex">
          <span class="max-w-[150px] truncate text-[12.5px] font-semibold">{{ session.user()?.name }}</span>
          <span class="max-w-[150px] truncate font-mono text-[10.5px]" style="color: var(--ink-3)">
            {{ session.user()?.email }}
          </span>
        </span>
        <tp-icon name="chevron-down" [size]="13" style="color: var(--ink-4)" />
      </button>

      @if (open()) {
        <!-- 6 px de hueco, el mismo que usan todos los desplegables. -->
        <div class="tp-menu absolute right-0 top-[calc(100%+6px)] z-50 w-[268px]" role="menu" (click)="$event.stopPropagation()">
          <!-- La foto es el botón: se pulsa o se suelta una imagen encima -->
          <div class="flex flex-col items-center gap-3 px-3 pb-1 pt-3">
            <button
              type="button"
              class="group relative block rounded-full"
              [style.outline]="dragging() ? '2px dashed var(--accent)' : 'none'"
              [style.outlineOffset]="'5px'"
              (click)="file.click()"
              (dragover)="$event.preventDefault(); dragging.set(true)"
              (dragleave)="dragging.set(false)"
              (drop)="onDrop($event)"
              aria-label="Cambiar tu foto"
            >
              <tp-avatar
                [name]="session.user()?.name ?? ''"
                [email]="session.user()?.email ?? ''"
                [photo]="session.user()?.avatarUrl ?? null"
                [size]="92"
              />
              <!-- La capa que tapa la foto es solo para el puntero. -->
              <span
                class="tp-foto-capa absolute inset-0 flex flex-col items-center justify-center gap-1 overflow-hidden rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                style="background: color-mix(in srgb, var(--bg) 76%, transparent); color: var(--ink)"
              >
                <tp-icon name="camera" [size]="18" />
                <span class="text-[10.5px] font-semibold">
                  {{ uploading() ? 'Subiendo…' : dragging() ? 'Soltar' : session.user()?.avatarUrl ? 'Cambiar' : 'Subir' }}
                </span>
              </span>
              <!-- En tactil no hay hover: la pista es una chapa en la esquina, y
                   la foto se ve entera. -->
              <span class="tp-foto-chapa" aria-hidden="true">
                <tp-icon name="camera" [size]="14" />
              </span>
            </button>
            <input #file type="file" accept="image/*" class="hidden" (change)="onPick($event)" [disabled]="uploading()" />

            <!-- El nombre se escribe donde se lee, y se guarda solo -->
            <input
              class="w-full bg-transparent text-center font-display text-[16px] font-extrabold tracking-[-0.02em] outline-none"
              [value]="session.user()?.name ?? ''"
              (input)="editName($any($event.target).value)"
              maxlength="60"
              spellcheck="false"
              aria-label="Tu nombre"
            />
            <p class="-mt-1.5 flex w-full items-center justify-center gap-1.5 truncate font-mono text-[10.5px]" style="color: var(--ink-4)">
              <span class="truncate">{{ session.user()?.email }}</span>
              <tp-icon name="lock" [size]="11" class="flex-none" />
            </p>

            @if (session.user()?.avatarUrl) {
              <button type="button" class="tp-link-soft text-[11.5px]" (click)="removePhoto()">Quitar la foto</button>
            }
          </div>

          <div class="tp-sep"></div>

          <p class="px-2.5 pb-1.5 pt-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em]" style="color: var(--ink-4)">
            Tema
          </p>
          <div class="tp-track mb-1">
            @for (option of themes; track option.id) {
              <button
                type="button"
                class="flex-1 justify-center"
                [attr.data-on]="session.theme() === option.id"
                (click)="session.setTheme(option.id)"
                [attr.aria-label]="option.label"
              >
                <tp-icon [name]="option.icon" [size]="14" />
              </button>
            }
          </div>

          <div class="tp-sep"></div>

          <button type="button" class="tp-menu-item" (click)="open.set(false); keys.set(true)" role="menuitem">
            <tp-icon name="key" [size]="16" />
            Llaves para agentes
          </button>

          <button type="button" class="tp-menu-item tp-menu-item-danger" (click)="logout()" role="menuitem">
            <tp-icon name="logout" [size]="16" />
            Cerrar sesión
          </button>
        </div>
      }
    </div>

    @if (keys()) {
      <tp-agent-keys (closed)="keys.set(false)" />
    }
  `,
})
export class AccountMenuComponent {
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly toast = inject(ToastService);
  protected readonly session = inject(SessionStore);
  protected readonly projects = inject(ProjectsStore);

  protected readonly open = signal(false);
  protected readonly keys = signal(false);
  protected readonly uploading = signal(false);
  protected readonly dragging = signal(false);

  protected readonly themes: { id: ThemeChoice; label: string; icon: 'sun' | 'moon' | 'monitor' }[] = [
    { id: 'light', label: 'Claro', icon: 'sun' },
    { id: 'dark', label: 'Oscuro', icon: 'moon' },
    { id: 'system', label: 'Sistema', icon: 'monitor' },
  ];

  protected toggle(event: MouseEvent): void {
    event.stopPropagation();
    this.open.update((value) => !value);
  }

  /* ------------------------------------------------------------- nombre --- */

  private timer: ReturnType<typeof setTimeout> | null = null;

  /** Se guarda solo cuando dejas de escribir. No hay botón de guardar. */
  protected editName(value: string): void {
    if (this.timer) clearTimeout(this.timer);
    const name = value.trim();
    this.timer = setTimeout(() => {
      if (name && name !== this.session.user()?.name) void this.session.patchProfile({ name });
    }, 700);
  }

  /* --------------------------------------------------------------- foto --- */

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) void this.acceptPhoto(file);
  }

  protected onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) void this.acceptPhoto(file);
    input.value = '';
  }

  private async acceptPhoto(file: File): Promise<void> {
    if (!isImage(file)) {
      this.toast.error('Ese archivo no es una imagen');
      return;
    }
    this.uploading.set(true);
    try {
      await this.session.patchProfile({ avatarUrl: await squareThumbnail(file, AVATAR_PX) });
      this.toast.ok('Foto actualizada');
    } catch {
      this.toast.error('No se pudo procesar la imagen');
    } finally {
      this.uploading.set(false);
    }
  }

  protected async removePhoto(): Promise<void> {
    await this.session.patchProfile({ avatarUrl: null });
    this.toast.ok('Foto quitada');
  }

  /* -------------------------------------------------------------- salir --- */

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    if (!(this.host.nativeElement as HTMLElement).contains(event.target as Node)) this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.open.set(false);
  }

  /**
   * Salir es instantaneo: se navega primero y se limpia despues, asi que no
   * hace falta pantalla de espera. No hay nada que cargar para irse.
   */
  protected async logout(): Promise<void> {
    this.open.set(false);
    this.projects.reset();
    await this.session.logout();
    await this.router.navigate(['/entrar']);
  }
}
