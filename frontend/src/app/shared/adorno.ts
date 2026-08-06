import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

interface Slab {
  /** Centro horizontal y vertical de la losa. */
  cx: number;
  cy: number;
  w: number;
  tilt: number;
  /** A trazos en vez de continua. */
  hueca?: boolean;
  /** Nodo del hilo encendido sobre esta losa. */
  nodo?: boolean;
}

interface Composicion {
  slabs: Slab[];
  /** Recorrido del hilo: x fijo, de arriba abajo. */
  hilo: number;
}

const H = 26;

/**
 * EL ADORNO DE UNA FICHA: fragmentos de la pila.
 *
 * Losas finas y grandes recortadas por la esquina de la tarjeta, atravesadas por
 * el hilo de seguimiento. El adorno no esta en meter mas losas, sino EN las
 * losas: alguna va a trazos y otras llevan el nodo del hilo sentado encima.
 *
 * Seis composiciones, una por ficha, para que ninguna tarjeta repita dibujo.
 */
@Component({
  selector: 'tp-adorno',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Quien lo usa decide el ancho de la banda; aqui solo se fija que no estorbe.
  host: { class: 'pointer-events-none absolute inset-y-0 right-0 overflow-hidden' },
  template: `
    <svg
      class="h-full w-full"
      [attr.viewBox]="lienzo()"
      preserveAspectRatio="xMaxYMid slice"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      aria-hidden="true"
    >
      <path
        [attr.d]="'M' + composicion().hilo + ' -40 L' + composicion().hilo + ' ' + (altoLienzo() + 40)"
        stroke-dasharray="2.5 11"
      />
      @for (s of composicion().slabs; track $index) {
        <rect
          [attr.x]="s.cx - s.w / 2"
          [attr.y]="s.cy - alto / 2"
          [attr.width]="s.w"
          [attr.height]="alto"
          [attr.rx]="alto / 2.4"
          [attr.stroke-dasharray]="s.hueca ? '2.5 10' : null"
          [attr.transform]="'rotate(' + s.tilt + ' ' + s.cx + ' ' + s.cy + ')'"
        />
      }
      @for (n of nodos(); track $index) {
        <circle [attr.cx]="n[0]" [attr.cy]="n[1]" r="3.6" fill="currentColor" stroke="none" />
      }
    </svg>
  `,
})
export class AdornoComponent {
  readonly n = input(0);
  /** Una ficha alta o una fila ancha: cambia el lienzo y la composicion. */
  readonly forma = input<'ficha' | 'fila'>('ficha');

  /** Grosor de cada losa dentro del lienzo. */
  protected readonly alto = H;

  protected readonly altoLienzo = computed(() => (this.forma() === 'fila' ? 76 : 240));
  protected readonly lienzo = computed(() => (this.forma() === 'fila' ? '0 0 900 76' : '0 0 400 240'));

  /** Filas: las losas cruzan el filo derecho de sobra, nunca lo rozan. */
  private static readonly FILAS: Composicion[] = [
    { hilo: 806, slabs: [{ cx: 848, cy: 20, w: 210, tilt: -3, nodo: true }, { cx: 872, cy: 58, w: 176, tilt: 2, hueca: true }] },
    { hilo: 838, slabs: [{ cx: 880, cy: 12, w: 190, tilt: 2.5, hueca: true }, { cx: 852, cy: 52, w: 224, tilt: -2, nodo: true }] },
    { hilo: 790, slabs: [{ cx: 826, cy: 34, w: 240, tilt: -1.5, nodo: true }, { cx: 890, cy: 72, w: 160, tilt: 3 }] },
  ];

  private static readonly FICHAS: Composicion[] = [
    {
      hilo: 336,
      slabs: [
        { cx: 372, cy: 46, w: 196, tilt: -3.2, nodo: true },
        { cx: 356, cy: 92, w: 232, tilt: 1.8, hueca: true },
        { cx: 384, cy: 138, w: 178, tilt: -1.2 },
      ],
    },
    {
      hilo: 358,
      slabs: [
        { cx: 388, cy: 74, w: 214, tilt: 2.4, hueca: true },
        { cx: 364, cy: 120, w: 250, tilt: -2.6, nodo: true },
        { cx: 392, cy: 166, w: 190, tilt: 1.4 },
      ],
    },
    {
      hilo: 318,
      slabs: [
        { cx: 350, cy: 38, w: 170, tilt: -1.8 },
        { cx: 376, cy: 84, w: 228, tilt: 2.8, nodo: true },
        { cx: 344, cy: 130, w: 196, tilt: -2.2, hueca: true },
        { cx: 382, cy: 176, w: 158, tilt: 1.6 },
      ],
    },
    {
      hilo: 372,
      slabs: [
        { cx: 396, cy: 60, w: 236, tilt: 1.6, hueca: true },
        { cx: 370, cy: 106, w: 188, tilt: -3, nodo: true },
      ],
    },
    {
      hilo: 300,
      slabs: [
        { cx: 340, cy: 92, w: 206, tilt: -2.4, nodo: true },
        { cx: 368, cy: 138, w: 242, tilt: 2, hueca: true },
        { cx: 336, cy: 184, w: 174, tilt: -1.4 },
      ],
    },
    {
      hilo: 346,
      slabs: [
        { cx: 380, cy: 52, w: 182, tilt: 2.2 },
        { cx: 352, cy: 98, w: 220, tilt: -2, hueca: true, nodo: true },
        { cx: 388, cy: 144, w: 200, tilt: 1.2 },
      ],
    },
  ];

  protected readonly composicion = computed(() => {
    const juego = this.forma() === 'fila' ? AdornoComponent.FILAS : AdornoComponent.FICHAS;
    return juego[this.n() % juego.length]!;
  });

  /** Los nodos, ya resueltos al punto donde el hilo cruza cada losa marcada. */
  protected readonly nodos = computed<[number, number][]>(() => {
    const { slabs, hilo } = this.composicion();
    return slabs.filter((s) => s.nodo).map((s) => [hilo, s.cy] as [number, number]);
  });
}
