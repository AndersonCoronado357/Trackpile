import { Injectable, signal } from '@angular/core';

/**
 * Corte movil/escritorio en 760px, el mismo de mis otros proyectos. Existe
 * porque hay medidas que el CSS no alcanza: la lista virtualizada necesita el
 * alto de fila en un numero, no en una regla.
 */
@Injectable({ providedIn: 'root' })
export class ViewportService {
  readonly isMobile = signal(window.matchMedia('(max-width: 759px)').matches);

  constructor() {
    window
      .matchMedia('(max-width: 759px)')
      .addEventListener('change', (event) => this.isMobile.set(event.matches));
  }
}
