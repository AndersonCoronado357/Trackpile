import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

interface Slab {
  x: number;
  y: number;
  w: number;
  h: number;
  tilt: number;
  drift: number;
  dur: number;
  delay: number;
  nodeY: number;
}

const COUNT = 7;
const BASE_Y = 486;
const STEP = 52;
const TOP_W = 268;
const GROW = 19;
const SLAB_H = 30;

/** Inclinaciones y desplazamientos escritos a mano: una pila real no es simetrica. */
const TILTS = [-2.1, 1.3, -0.7, 1.8, -1.5, 0.6, -1.9];
const NUDGE = [-7, 5, -2, 8, -5, 3, 0];
const DRIFT = [5, -4, 6, -3, 4, -6, 3];
const DUR = [11, 14, 9, 13, 10, 15, 12];

/**
 * EL MOTIVO DE TRACKPILE: una pila de losas vista de frente, con la linea de
 * seguimiento atravesandolas y un nodo por cada una. Es el nombre dibujado:
 * "pile" son las losas, "track" es el hilo que las recorre.
 *
 * Las losas se mueven de lado unos pocos pixeles con ciclos largos y primos
 * entre si, asi que la pila nunca se ve quieta pero tampoco se ve moverse.
 */
@Component({
  selector: 'tp-pile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 600 600" fill="none" aria-hidden="true" class="h-full w-full">
      <!-- El hilo: recorre la pila de abajo arriba con el trazo en marcha -->
      <path
        [attr.d]="threadPath()"
        stroke="currentColor"
        [attr.stroke-width]="weight()"
        stroke-linecap="round"
        stroke-dasharray="5 13"
        [style.animation]="'tp-thread ' + threadSpeed() + 's linear infinite'"
      />

      @for (slab of slabs(); track $index) {
        <g
          [style.transformOrigin]="slab.x + slab.w / 2 + 'px ' + (slab.y + slab.h / 2) + 'px'"
          [style.animation]="'tp-slab ' + slab.dur + 's ease-in-out ' + slab.delay + 's infinite'"
          [style.--drift]="slab.drift + 'px'"
          [style.--tilt]="slab.tilt + 'deg'"
        >
          <rect
            [attr.x]="slab.x"
            [attr.y]="slab.y"
            [attr.width]="slab.w"
            [attr.height]="slab.h"
            [attr.rx]="slab.h / 2.4"
            stroke="currentColor"
            [attr.stroke-width]="weight()"
          />
          <!-- Nodo de seguimiento: el activo va relleno y en el color de marca -->
          <circle
            [attr.cx]="slab.x + slab.w / 2"
            [attr.cy]="slab.nodeY"
            [attr.r]="$index === activeIndex() ? 6.5 : 4.5"
            [attr.fill]="$index === activeIndex() ? accent() : 'none'"
            [attr.stroke]="$index === activeIndex() ? 'none' : 'currentColor'"
            [attr.stroke-width]="weight()"
          />
        </g>
      }
    </svg>
  `,
  host: { class: 'pointer-events-none block' },
})
export class PileComponent {
  readonly weight = input(1.4);
  readonly threadSpeed = input(26);
  readonly accent = input('var(--accent)');
  /** Qué losa lleva el nodo encendido: contando desde abajo. */
  readonly activeIndex = input(4);

  protected readonly slabs = computed<Slab[]>(() =>
    Array.from({ length: COUNT }, (_, i) => {
      const w = TOP_W + (COUNT - 1 - i) * GROW;
      const y = BASE_Y - i * STEP;
      return {
        x: 300 - w / 2 + (NUDGE[i] ?? 0),
        y,
        w,
        h: SLAB_H,
        tilt: TILTS[i] ?? 0,
        drift: DRIFT[i] ?? 4,
        dur: DUR[i] ?? 12,
        delay: i * 0.9,
        nodeY: y + SLAB_H / 2,
      };
    }),
  );

  /** El hilo entra por debajo de la pila y sale por encima. */
  protected readonly threadPath = computed(() => {
    const list = this.slabs();
    const bottom = BASE_Y + SLAB_H + 62;
    const top = (list[list.length - 1]?.y ?? 0) - 62;
    return `M300 ${bottom} L300 ${top}`;
  });
}
