import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { IconComponent } from './icon';

/**
 * Selector de tecnologias: un desplegable con buscador. Con muchas etiquetas,
 * los chips sueltos no sirven —no caben y no se pueden repasar—, asi que aqui
 * se busca, se marca lo que ya esta puesto y se crea lo que falte sin salir.
 */
@Component({
  selector: 'tp-stack-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: { class: 'block relative' },
  template: `
    <!-- Lo elegido en UNA sola fila que se desplaza de lado: con muchas
         etiquetas, envolverlas empujaba todo el formulario hacia abajo. -->
    @if (value().length) {
      <div class="tp-scroll-x mb-2 flex gap-1.5 overflow-x-auto pb-1">
        @for (tech of value(); track tech) {
          <button
            type="button"
            class="tp-chip h-[28px] flex-none px-3"
            (click)="toggle(tech)"
            [attr.aria-label]="'Quitar ' + tech"
          >
            {{ tech }}
            <tp-icon name="close" [size]="11" style="color: var(--ink-4)" />
          </button>
        }
      </div>
    }

    <button
      type="button"
      class="flex h-[50px] w-full items-center gap-3 rounded-[var(--r-ctrl)] px-[15px] text-left transition-colors"
      [style.background]="open() ? 'var(--surface-3)' : 'var(--surface-2)'"
      (click)="toggleOpen()"
      aria-haspopup="listbox"
      [attr.aria-expanded]="open()"
    >
      <tp-icon name="search" [size]="17" class="flex-none" style="color: var(--ink-3)" />
      <span class="min-w-0 flex-1 truncate text-[14px]" [style.color]="value().length ? 'var(--ink-2)' : 'var(--ink-4)'">
        {{ value().length ? value().length + ' seleccionadas' : 'Buscar o añadir una tecnología' }}
      </span>
      <tp-icon name="chevron-down" [size]="14" class="flex-none" style="color: var(--ink-4)" />
    </button>

    <!-- Se despliega EN LÍNEA, no flotando: flotando lo recortaba el scroll
         del panel y se quedaba a medias. -->
    @if (open()) {
      <div class="mt-1.5 overflow-hidden rounded-[var(--r-ctrl)]" style="background: var(--surface-2)" role="listbox">
        <div class="p-2">
          <input
            #box
            class="h-[42px] w-full rounded-[var(--r-sm)] px-3 text-[14px] outline-none"
            style="background: var(--surface-3)"
            autocomplete="off"
            placeholder="Escribe para filtrar…"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
            (keydown)="onKey($event)"
            aria-label="Filtrar tecnologías"
          />
        </div>

        <div class="tp-scroll max-h-[184px] px-2 pb-2">
          @for (option of filtered(); track option) {
            <button
              type="button"
              class="tp-menu-item !py-2"
              [attr.aria-selected]="value().includes(option)"
              (click)="toggle(option)"
            >
              <span
                class="grid h-[17px] w-[17px] flex-none place-items-center rounded-[5px]"
                [style.background]="value().includes(option) ? 'var(--accent)' : 'transparent'"
                [style.boxShadow]="value().includes(option) ? 'none' : 'inset 0 0 0 1.5px var(--ink-4)'"
              >
                @if (value().includes(option)) {
                  <tp-icon name="check" [size]="11" [weight]="2.8" style="color: var(--on-accent)" />
                }
              </span>
              <span class="flex-1 truncate">{{ option }}</span>
              <span class="mono text-[10.5px]" style="color: var(--ink-4)">{{ counts()[option] || '' }}</span>
            </button>
          }

          @if (canCreate()) {
            <button type="button" class="tp-menu-item !py-2" (click)="create()">
              <tp-icon name="plus" [size]="15" class="flex-none" style="color: var(--accent-ink)" />
              <span class="flex-1 truncate">
                Añadir <span class="font-bold">{{ query().trim() }}</span>
              </span>
              <span class="mono text-[10.5px]" style="color: var(--ink-4)">nueva</span>
            </button>
          }

          @if (!filtered().length && !canCreate()) {
            <p class="px-3 py-6 text-center text-[12.5px]" style="color: var(--ink-4)">Sin coincidencias</p>
          }
        </div>
      </div>
    }
  `,
})
export class StackPickerComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly box = viewChild<ElementRef<HTMLInputElement>>('box');

  readonly value = input<string[]>([]);
  /** Todas las tecnologias ya usadas, con cuantos proyectos las llevan. */
  readonly options = input<{ name: string; count: number }[]>([]);
  readonly changed = output<string[]>();

  protected readonly open = signal(false);
  protected readonly query = signal('');

  protected readonly counts = computed(() => Object.fromEntries(this.options().map((o) => [o.name, o.count])));

  /** Lo ya elegido sube arriba: se repasa de un vistazo. */
  protected readonly filtered = computed(() => {
    const needle = this.query().trim().toLowerCase();
    const chosen = this.value();
    const all = [...new Set([...chosen, ...this.options().map((o) => o.name)])];
    return all
      .filter((name) => !needle || name.toLowerCase().includes(needle))
      .sort((a, b) => {
        const inA = chosen.includes(a) ? 0 : 1;
        const inB = chosen.includes(b) ? 0 : 1;
        if (inA !== inB) return inA - inB;
        return (this.counts()[b] ?? 0) - (this.counts()[a] ?? 0) || a.localeCompare(b, 'es');
      });
  });

  /** Solo se ofrece crear si lo escrito no existe ya, ni puesto ni por poner. */
  protected readonly canCreate = computed(() => {
    const typed = this.query().trim();
    if (!typed) return false;
    const all = [...this.value(), ...this.options().map((o) => o.name)];
    return !all.some((name) => name.toLowerCase() === typed.toLowerCase());
  });

  protected toggleOpen(): void {
    this.open.update((v) => !v);
    if (this.open()) queueMicrotask(() => this.box()?.nativeElement.focus());
  }

  protected toggle(tech: string): void {
    const current = this.value();
    this.changed.emit(current.includes(tech) ? current.filter((t) => t !== tech) : [...current, tech]);
  }

  protected create(): void {
    const typed = this.query().trim();
    if (!typed) return;
    this.changed.emit([...this.value(), typed]);
    this.query.set('');
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.canCreate()) this.create();
      else if (this.filtered().length === 1) this.toggle(this.filtered()[0]!);
    } else if (event.key === 'Escape') {
      this.open.set(false);
    }
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    if (!(this.host.nativeElement as HTMLElement).contains(event.target as Node)) this.open.set(false);
  }
}
