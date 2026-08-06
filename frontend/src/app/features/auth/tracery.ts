import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Los hilos del fondo del acceso: curvas largas que cruzan la pantalla con
 * nodos sentados encima, mas puntos y rayitas sueltas. Todo en el amarillo de
 * marca y a muy baja opacidad, asi que se ve si lo buscas y no compite.
 *
 * Es el mismo lenguaje que la pila: hilo + nodos, pero suelto por el lienzo.
 */
@Component({
  selector: 'tp-tracery',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'pointer-events-none absolute inset-0 overflow-hidden' },
  template: `
    <svg
      class="h-full w-full"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <!-- Curvas largas: nacen y mueren fuera del lienzo -->
      <g stroke-width="1.2" opacity="0.30">
        <path d="M-120 214 C 210 132, 372 318, 664 250 S 1120 96, 1560 190" />
        <path d="M-120 686 C 264 760, 470 566, 780 640 S 1210 806, 1560 700" stroke-dasharray="3 12" />
        <path d="M-120 452 C 300 452, 300 452, 700 452 S 1180 452, 1560 452" stroke-dasharray="1 22" opacity="0.7" />
      </g>

      <!-- Arcos amplios recortados por las esquinas -->
      <g stroke-width="1.1" opacity="0.22">
        <path d="M-180 900 A 700 700 0 0 1 520 200" />
        <path d="M-60 900 A 560 560 0 0 1 500 340" stroke-dasharray="4 14" />
        <path d="M1620 0 A 660 660 0 0 0 960 660" />
        <path d="M1520 0 A 520 520 0 0 0 1000 520" stroke-dasharray="4 14" />
      </g>

      <!-- Nodos sentados sobre los hilos -->
      <g fill="currentColor" stroke="none">
        <circle cx="210" cy="164" r="3.4" opacity="0.75" />
        <circle cx="664" cy="250" r="4.6" opacity="0.9" />
        <circle cx="1104" cy="126" r="3" opacity="0.6" />
        <circle cx="780" cy="640" r="4.2" opacity="0.85" />
        <circle cx="322" cy="722" r="3" opacity="0.6" />
        <circle cx="1246" cy="742" r="3.4" opacity="0.7" />
        <circle cx="700" cy="452" r="2.6" opacity="0.5" />
      </g>

      <!-- Rayitas sueltas: el detalle que se ve de cerca -->
      <g stroke-width="1.4" stroke-linecap="round" opacity="0.4">
        <path d="M132 372 h26" />
        <path d="M118 392 h14" />
        <path d="M1288 318 h26" />
        <path d="M1302 338 h14" />
        <path d="M556 812 h22" />
        <path d="M888 122 h18" />
      </g>
    </svg>
  `,
})
export class TraceryComponent {}
