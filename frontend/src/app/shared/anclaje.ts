/**
 * Anclaje de desplegables. Uno solo para toda la app: cuando cada menu se
 * colocaba por su cuenta, unos cuadraban con su boton y otros no.
 *
 * La regla es siempre la misma: el menu cuelga del borde derecho de quien lo
 * abre, a `hueco` pixeles por debajo; si no cabe abajo sale arriba; y pase lo
 * que pase no se sale de la ventana.
 */

export interface Anclaje {
  x: number;
  y: number;
  ancho: number;
}

interface Opciones {
  /** Ancho del menu. Por defecto, el mismo del disparador. */
  ancho?: number;
  /** Ancho minimo, para que un disparador diminuto no deje un menu ilegible. */
  anchoMinimo?: number;
  alto: number;
  hueco?: number;
  margen?: number;
  /**
   * Un elemento que cuelgue de donde vaya a vivir el panel. La correccion de
   * `position: fixed` depende de los ancestros del PANEL, no de los del boton:
   * el menu de estado se dibuja fuera de la lista, y midiendo desde el boton se
   * colaba el `transform` del scroll virtual y lo corria 28 px.
   *
   * Por defecto el propio disparador, que es lo correcto cuando el panel es
   * hermano suyo.
   */
  panelDentroDe?: HTMLElement;
}

/**
 * Un ancestro con transform, filter o perspective convierte `position: fixed`
 * en relativo a EL y no a la ventana. Se busca para restar su origen: el cajon
 * de edicion se desliza con un transform y sin esto todo lo que hay dentro se
 * pintaba desplazado.
 */
function origenDeLoFijo(el: HTMLElement): { x: number; y: number } {
  for (let padre: HTMLElement | null = el; padre; padre = padre.parentElement) {
    const estilo = getComputedStyle(padre);
    if (estilo.transform !== 'none' || estilo.filter !== 'none' || estilo.perspective !== 'none') {
      const caja = padre.getBoundingClientRect();
      return { x: caja.left, y: caja.top };
    }
  }
  return { x: 0, y: 0 };
}

/** Coordenadas listas para un elemento en `position: fixed`. */
export function anclarA(disparador: HTMLElement, opciones: Opciones): Anclaje {
  const { alto, hueco = 6, margen = 8 } = opciones;
  const caja = disparador.getBoundingClientRect();
  const ancho = Math.max(opciones.ancho ?? caja.width, opciones.anchoMinimo ?? 0);

  const cabeAbajo = caja.bottom + hueco + alto <= window.innerHeight - margen;
  const y = cabeAbajo ? caja.bottom + hueco : caja.top - alto - hueco;
  const origen = origenDeLoFijo(opciones.panelDentroDe ?? disparador);

  return {
    ancho,
    x: Math.max(margen, Math.min(caja.right - ancho, window.innerWidth - ancho - margen)) - origen.x,
    y: Math.max(margen, Math.min(y, window.innerHeight - alto - margen)) - origen.y,
  };
}
