import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { IconComponent } from './icon';
import { anclarA, type Anclaje } from './anclaje';
import { PRESET_HEX, type Accent } from '../core/models';

/**
 * Selector de color: lo mismo que hace el del navegador —area de saturacion y
 * brillo, mas una tira de tono— pero dibujado con las superficies y los radios
 * de la aplicacion, para que no aparezca una ventana del sistema operativo en
 * medio de la interfaz.
 */
@Component({
  selector: 'tp-color-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: { class: 'block' },
  template: `
    <!-- gap-y mas ancho que gap-x: los aros de los elegidos necesitan aire y si
         no, al saltar de linea se tocan. -->
    <div class="flex flex-wrap items-center gap-x-3 gap-y-3.5">
      @for (preset of presets; track preset) {
        <button
          type="button"
          class="tp-swatch"
          [class.is-on]="value() === preset"
          [style.color]="presetHex[preset]"
          (click)="pickPreset(preset)"
          [attr.aria-label]="'Color ' + preset"
          [attr.aria-pressed]="value() === preset"
        ></button>
      }

      <button
        type="button"
        class="tp-swatch tp-swatch-mas"
        [class.is-on]="isCustom()"
        [style.color]="isCustom() ? hex() : 'var(--ink-4)'"
        (click)="alternar()"
        aria-label="Más colores"
      >
        @if (!isCustom()) {
          <tp-icon name="plus" [size]="11" />
        }
      </button>
    </div>

    <!-- Desplegable de verdad: flota sobre lo demas en posicion fija, no ocupa
         sitio en el flujo y por eso no mueve nada al abrirse ni al cerrarse. -->
    @if (at(); as caja) {
      <div
        class="tp-menu fixed z-[90] !rounded-[var(--r-ctrl)] !p-3"
        style="background: var(--surface-3)"
        [style.left.px]="caja.x"
        [style.top.px]="caja.y"
        [style.width.px]="caja.ancho"
      >
        <!-- Área de saturación y brillo: se arrastra el punto -->
        <div
          #area
          class="relative h-[132px] w-full cursor-crosshair touch-none overflow-hidden rounded-[var(--r-sm)]"
          [style.background]="
            'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(' + hue() + ' 100% 50%))'
          "
          (pointerdown)="startArea($event)"
        >
          <span
            class="pointer-events-none absolute h-[15px] w-[15px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            [style.left.%]="sat() * 100"
            [style.top.%]="(1 - val()) * 100"
            [style.background]="hex()"
            style="box-shadow: 0 0 0 2px #fff, 0 0 0 3.5px rgb(0 0 0 / 0.35)"
          ></span>
        </div>

        <!-- Tira de tono -->
        <div
          #strip
          class="relative mt-3 h-[14px] w-full cursor-pointer touch-none rounded-full"
          style="background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)"
          (pointerdown)="startHue($event)"
        >
          <span
            class="pointer-events-none absolute top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            [style.left.%]="(hue() / 360) * 100"
            [style.background]="'hsl(' + hue() + ' 100% 50%)'"
            style="box-shadow: 0 0 0 2px #fff, 0 0 0 3.5px rgb(0 0 0 / 0.35)"
          ></span>
        </div>

        <!-- Valor y salida -->
        <div class="mt-3 flex items-center gap-2.5">
          <span class="h-7 w-7 flex-none rounded-full" [style.background]="hex()"></span>
          <input
            class="min-w-0 flex-1 rounded-[var(--r-sm)] bg-transparent px-2 py-1 font-mono text-[12.5px] uppercase outline-none"
            style="background: var(--surface-4)"
            [value]="hex()"
            (input)="typeHex($any($event.target).value)"
            spellcheck="false"
            maxlength="7"
            aria-label="Color en hexadecimal"
          />
          <button type="button" class="tp-link-soft text-[12px]" (click)="at.set(null)">Listo</button>
        </div>
      </div>
    }
  `,
})
export class ColorPickerComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly area = viewChild<ElementRef<HTMLElement>>('area');
  private readonly strip = viewChild<ElementRef<HTMLElement>>('strip');

  readonly value = input<Accent>('amber');
  readonly changed = output<string>();

  protected readonly presets = Object.keys(PRESET_HEX) as (keyof typeof PRESET_HEX)[];
  protected readonly presetHex = PRESET_HEX;

  /** Donde se pinta el panel, ya en coordenadas de pantalla. Nulo = cerrado. */
  protected readonly at = signal<Anclaje | null>(null);

  /** Tono, saturación y brillo: lo que se manipula de verdad. */
  protected readonly hue = signal(38);
  protected readonly sat = signal(0.84);
  protected readonly val = signal(0.96);

  protected readonly isCustom = computed(() => this.value().startsWith('#'));
  protected readonly hex = computed(() => hsvToHex(this.hue(), this.sat(), this.val()));

  constructor() {
    // Al abrirlo, los mandos arrancan en el color que ya tiene el proyecto.
    effect(() => {
      const raw = this.value();
      const start = raw.startsWith('#') ? raw : (PRESET_HEX[raw as keyof typeof PRESET_HEX] ?? '#f5a627');
      const [h, s, v] = hexToHsv(start);
      this.hue.set(h);
      this.sat.set(s);
      this.val.set(v);
    });
  }

  protected pickPreset(preset: string): void {
    this.changed.emit(preset);
  }

  /**
   * Se ancla a la fila de muestras entera, no a la bolita de "mas colores":
   * colgado de un punto de 20 px el panel quedaba desplazado 228 px a su
   * izquierda y no cuadraba con nada.
   */
  protected alternar(): void {
    if (this.at()) {
      this.at.set(null);
      return;
    }
    this.at.set(anclarA(this.host.nativeElement as HTMLElement, { alto: ALTO, ancho: ANCHO }));
  }

  /* ------------------------------------------------------------ arrastre --- */

  private dragging: 'area' | 'hue' | null = null;

  protected startArea(event: PointerEvent): void {
    this.dragging = 'area';
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    this.moveArea(event);
  }

  protected startHue(event: PointerEvent): void {
    this.dragging = 'hue';
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    this.moveHue(event);
  }

  @HostListener('document:pointermove', ['$event'])
  protected onMove(event: PointerEvent): void {
    if (this.dragging === 'area') this.moveArea(event);
    else if (this.dragging === 'hue') this.moveHue(event);
  }

  @HostListener('document:pointerup')
  protected onUp(): void {
    if (this.dragging) this.changed.emit(this.hex());
    this.dragging = null;
  }

  private moveArea(event: PointerEvent): void {
    const box = this.area()?.nativeElement.getBoundingClientRect();
    if (!box) return;
    this.sat.set(clamp((event.clientX - box.left) / box.width));
    this.val.set(1 - clamp((event.clientY - box.top) / box.height));
  }

  private moveHue(event: PointerEvent): void {
    const box = this.strip()?.nativeElement.getBoundingClientRect();
    if (!box) return;
    this.hue.set(Math.round(clamp((event.clientX - box.left) / box.width) * 360));
  }

  /** Se puede pegar un hexadecimal a mano; los medios se ignoran hasta ser válidos. */
  protected typeHex(raw: string): void {
    const text = raw.trim().replace(/^#?/, '#');
    if (!/^#[0-9a-fA-F]{6}$/.test(text)) return;
    const [h, s, v] = hexToHsv(text);
    this.hue.set(h);
    this.sat.set(s);
    this.val.set(v);
    this.changed.emit(text.toLowerCase());
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.at()) return;
    if (!(this.host.nativeElement as HTMLElement).contains(event.target as Node)) this.at.set(null);
  }

  /** Si se mueve lo que hay debajo, el panel quedaria colgando en el aire. */
  @HostListener('window:resize')
  protected onResize(): void {
    this.at.set(null);
  }
}

/** Alto y ancho fijos del panel: de ellos depende si abre hacia arriba o abajo. */
const ANCHO = 248;
const ALTO = 222;

const clamp = (n: number): number => Math.min(1, Math.max(0, n));

function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number): string => {
    const k = (n + h / 60) % 6;
    const value = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(5)}${f(3)}${f(1)}`;
}

function hexToHsv(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}
