import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { ApiService, describeError, type ApiToken } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { IconComponent } from '../../shared/icon';
import { AgoComponent } from '../../shared/ui';

/**
 * Llaves para agentes. La idea: mientras trabajas en otro proyecto con una IA,
 * le pasas el enlace de instrucciones y la llave, y ella deja la ficha al dia
 * sola. La llave se ve una unica vez; despues solo queda su principio.
 */
@Component({
  selector: 'tp-agent-keys',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, AgoComponent],
  template: `
    <div
      class="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style="background: var(--scrim); animation: tp-fade 160ms var(--ease) both"
      (click)="closed.emit()"
    >
      <div
        class="tp-panel tp-scroll flex max-h-[86vh] w-full max-w-[560px] flex-col overflow-y-auto p-6"
        style="animation: tp-rise 240ms var(--ease) both"
        (click)="$event.stopPropagation()"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="tp-eyebrow">Automatizacion</p>
            <h2 class="mt-1 text-[19px] tracking-[-0.02em]">Llaves para agentes</h2>
          </div>
          <button type="button" class="tp-icon-btn -mr-1 -mt-1 flex-none" (click)="closed.emit()" aria-label="Cerrar">
            <tp-icon name="close" [size]="17" />
          </button>
        </div>

        <p class="mt-3 text-[13px] leading-[1.55rem]" style="color: var(--ink-3)">
          Una llave deja que un asistente lea tu pila y la actualice mientras trabajas en cualquiera de tus
          proyectos: cambiar el estado, agregar una tecnologia o poner el enlace cuando lo publiques.
        </p>

        <!-- Lo que se le pega al asistente. Un solo bloque, un solo boton. -->
        <section class="mt-5">
          <p class="tp-eyebrow mb-2.5">Pegale esto a tu IA</p>
          <div class="tp-sunken p-3.5">
            <pre class="tp-scroll-x whitespace-pre font-mono text-[11.5px] leading-[1.5rem]" style="color: var(--ink-2)">{{ instruccion() }}</pre>
          </div>
          <div class="mt-2.5 flex flex-wrap items-center gap-2">
            <button type="button" class="tp-btn tp-btn-soft h-9" (click)="copiar(instruccion(), 'Instrucciones copiadas')">
              <tp-icon name="copy" [size]="14" />
              Copiar
            </button>
            <a class="tp-link-soft text-[12px]" [href]="docsUrl()" target="_blank" rel="noopener noreferrer">
              Ver la documentacion completa
            </a>
          </div>
        </section>

        <!-- La llave recien creada: unica ventana para verla entera -->
        @if (nueva(); as llave) {
          <section class="mt-5 rounded-[var(--r-ctrl)] p-4" style="background: var(--accent-pill)">
            <p class="text-[12.5px] font-semibold" style="color: var(--accent-ink)">
              Copiala ahora: no se vuelve a mostrar
            </p>
            <div class="mt-2.5 flex items-center gap-2">
              <code class="tp-scroll-x min-w-0 flex-1 whitespace-nowrap font-mono text-[12px]">{{ llave }}</code>
              <button type="button" class="tp-btn tp-btn-primary h-9 flex-none" (click)="copiar(llave, 'Llave copiada')">
                <tp-icon name="copy" [size]="14" />
                Copiar
              </button>
            </div>
          </section>
        }

        <!-- Llaves activas -->
        <section class="mt-6">
          <div class="mb-2.5 flex items-center justify-between gap-3">
            <p class="tp-eyebrow">Llaves activas</p>
            <button type="button" class="tp-btn tp-btn-soft h-9" [disabled]="creando()" (click)="crear()">
              <tp-icon name="plus" [size]="14" />
              {{ creando() ? 'Creando…' : 'Nueva llave' }}
            </button>
          </div>

          @if (cargando()) {
            <div class="flex flex-col gap-2">
              <div class="tp-skeleton h-[54px]"></div>
              <div class="tp-skeleton h-[54px]"></div>
            </div>
          } @else if (!llaves().length) {
            <p class="rounded-[var(--r-ctrl)] px-4 py-5 text-center text-[12.5px]" style="background: var(--surface-2); color: var(--ink-4)">
              Todavia no has creado ninguna.
            </p>
          } @else {
            <ul class="flex flex-col gap-1.5">
              @for (llave of llaves(); track llave.id) {
                <li class="flex items-center gap-3 rounded-[var(--r-ctrl)] px-4 py-3" style="background: var(--surface-2)">
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-[13px] font-semibold">{{ llave.label }}</p>
                    <p class="mt-0.5 flex items-center gap-1.5 font-mono text-[11px]" style="color: var(--ink-4)">
                      <span>{{ llave.prefix }}…</span>
                      <span>·</span>
                      @if (llave.lastUsedAt) {
                        <span>usada <tp-ago [value]="llave.lastUsedAt" /></span>
                      } @else {
                        <span>sin usar</span>
                      }
                    </p>
                  </div>
                  <button
                    type="button"
                    class="tp-icon-btn flex-none"
                    (click)="borrar(llave)"
                    [attr.aria-label]="'Revocar ' + llave.label"
                  >
                    <tp-icon name="trash" [size]="15" />
                  </button>
                </li>
              }
            </ul>
          }
        </section>
      </div>
    </div>
  `,
})
export class AgentKeysComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly closed = output<void>();

  protected readonly llaves = signal<ApiToken[]>([]);
  protected readonly cargando = signal(true);
  protected readonly creando = signal(false);
  protected readonly nueva = signal<string | null>(null);

  /** El origen real: si abres desde el telefono, sale la IP y no localhost. */
  private readonly origen = location.origin;
  protected readonly docsUrl = computed(() => `${this.origen}/api/docs`);

  protected readonly instruccion = computed(
    () =>
      `Trackpile es mi lista de proyectos. Mantenla al dia con este proyecto.\n` +
      `Lee primero las instrucciones: ${this.docsUrl()}\n` +
      `Autenticate con la cabecera: Authorization: Bearer ${this.nueva() ?? '<TU_LLAVE>'}`,
  );

  constructor() {
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.llaves.set(await this.api.listTokens());
    } catch (error) {
      this.toast.error(describeError(error));
    } finally {
      this.cargando.set(false);
    }
  }

  protected async crear(): Promise<void> {
    this.creando.set(true);
    try {
      const creada = await this.api.createToken(`Agente ${this.llaves().length + 1}`);
      this.nueva.set(creada.token);
      this.llaves.update((lista) => [creada, ...lista]);
    } catch (error) {
      this.toast.error(describeError(error));
    } finally {
      this.creando.set(false);
    }
  }

  protected async borrar(llave: ApiToken): Promise<void> {
    try {
      await this.api.deleteToken(llave.id);
      this.llaves.update((lista) => lista.filter((item) => item.id !== llave.id));
      this.toast.ok('Llave revocada');
    } catch (error) {
      this.toast.error(describeError(error));
    }
  }

  protected async copiar(texto: string, mensaje: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(texto);
      this.toast.ok(mensaje);
    } catch {
      this.toast.error('El navegador no dejo copiar');
    }
  }
}
