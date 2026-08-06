import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';

export type IconName =
  | 'plus'
  | 'search'
  | 'close'
  | 'check'
  | 'chevron-down'
  | 'chevron-left'
  | 'external'
  | 'repo'
  | 'globe'
  | 'pin'
  | 'trash'
  | 'edit'
  | 'sun'
  | 'moon'
  | 'monitor'
  | 'logout'
  | 'user'
  | 'drag'
  | 'inbox'
  | 'sort'
  | 'sort-lines'
  | 'lock'
  | 'mail'
  | 'eye'
  | 'eye-off'
  | 'camera'
  | 'image'
  | 'arrow-right'
  | 'shield'
  | 'copy'
  | 'key'
  | 'alert';

/** Iconos propios, trazo 1.7 para que no compitan con el texto. */
const PATHS: Record<IconName, string> = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.6-3.6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  'chevron-down': '<path d="m5 9.5 7 6 7-6"/>',
  'chevron-left': '<path d="m14.5 5-6 7 6 7"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5.5H4.5V6H10"/>',
  repo: '<path d="M5 4.5h11a2 2 0 0 1 2 2v13H7a2 2 0 0 1-2-2z"/><path d="M5 16.5h13"/>',
  globe: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.5 2.6 2.5 12.4 0 16M12 4c-2.5 2.6-2.5 12.4 0 16"/>',
  pin: '<path d="M9 3.5h6l-.8 5.2 3.3 3.1H6.5l3.3-3.1zM12 11.8V20.5"/>',
  trash: '<path d="M4.5 6.5h15M9.5 6.5V4h5v2.5M7 6.5l.9 13h8.2l.9-13"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 6.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h.5"/>',
  key: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9m-3 0v3.5m-2.5-3.5V15"/>',
  edit: '<path d="M4 20h4l10-10-4-4L4 16zM14.5 5.5l4 4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/>',
  moon: '<path d="M20 13.5A8.5 8.5 0 0 1 10.5 4a8.5 8.5 0 1 0 9.5 9.5z"/>',
  monitor: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M8.5 20h7M12 16.5V20"/>',
  logout: '<path d="M15 4.5H6a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 6 19.5h9"/><path d="M14 12h7m0 0-3-3m3 3-3 3"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  drag: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
  inbox: '<path d="M3.5 13.5h4l1.5 3h6l1.5-3h4"/><path d="M5.6 5h12.8l2.1 8.5v4A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5v-4z"/>',
  // Renglones que menguan a la izquierda y la flecha en su propia banda a la
  // derecha. Antes se pisaban: la punta cruzaba por debajo del renglon largo.
  sort: '<path d="M3.5 7h9M3.5 12h6.5M3.5 17h4"/><path d="M17.5 6.5v11m0 0 3-3m-3 3-3-3"/>',
  // Sin flecha, para cuando el boton se queda solo con el icono: a ese tamano
  // la flecha es ruido. Los renglones se reparten el lienzo entero.
  'sort-lines': '<path d="M4 7h16M4 12h11M4 17h6"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="9.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.6 6.8 8.4 6 8.4-6"/>',
  eye: '<path d="M2.5 12S6.6 5.5 12 5.5 21.5 12 21.5 12 17.4 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3.1"/>',
  'eye-off':
    '<path d="M9.9 5.8A9.6 9.6 0 0 1 12 5.5c5.4 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.2 3.8M6.4 7.6A17.4 17.4 0 0 0 2.5 12S6.6 18.5 12 18.5c1.5 0 2.9-.5 4.1-1.2"/><path d="M10.2 10a3.1 3.1 0 0 0 4.2 4.4"/><path d="m3.5 3.5 17 17"/>',
  camera:
    '<path d="M4.5 8.5h2.7l1.4-2.2h6.8l1.4 2.2h2.7A1.5 1.5 0 0 1 21 10v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18v-8a1.5 1.5 0 0 1 1.5-1.5Z"/><circle cx="12" cy="13.6" r="3.4"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="8.8" cy="9.6" r="1.6"/><path d="m4 16.5 4.6-4.2 4.2 3.7 3-2.6 4.2 3.6"/>',
  'arrow-right': '<path d="M4.5 12h15m0 0-5.5-5.5M19.5 12 14 17.5"/>',
  shield: '<path d="M12 3.2 20 6v6c0 4.6-3.3 7.6-8 8.8-4.7-1.2-8-4.2-8-8.8V6z"/><path d="m8.8 12.2 2.3 2.3 4.1-4.6"/>',
  alert: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.8v4.6M12 16.1h.01"/>',
};

/** El logo de Google va a color, no en trazo: es marca ajena y debe verse igual. */
export const GOOGLE_MARK = `<svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
  <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-2.8-.4-4.1H24v7.4h12.1c-.2 2-1.6 5-4.5 7l-.1.3 6.5 5 .5.1c4.2-3.8 6.6-9.5 6.6-15.7"/>
  <path fill="#34A853" d="M24 46c5.9 0 10.9-1.9 14.5-5.3l-6.9-5.3c-1.8 1.3-4.3 2.2-7.6 2.2-5.8 0-10.8-3.8-12.5-9.1l-.3 0-6.8 5.2-.1.3C8 41.2 15.4 46 24 46"/>
  <path fill="#FBBC05" d="M11.5 28.5c-.5-1.3-.7-2.8-.7-4.5s.3-3.2.7-4.5l0-.3-6.9-5.3-.2.1A22 22 0 0 0 2 24c0 3.5.9 6.9 2.4 9.9z"/>
  <path fill="#EB4335" d="M24 9.5c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 3.4 29.9 1 24 1 15.4 1 8 5.8 4.4 12.8l7.1 5.5C13.2 13 18.2 9.5 24 9.5"/>
</svg>`;

@Component({
  selector: 'tp-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="weight()"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      [innerHTML]="markup()"
    ></svg>
  `,
  styles: [':host{display:inline-flex;align-items:center;justify-content:center;flex:none}'],
})
export class IconComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly name = input.required<IconName>();
  readonly size = input(17);
  readonly weight = input(1.7);

  // El contenido viene de un mapa constante del propio codigo, nunca del usuario.
  protected readonly markup = computed<SafeHtml>(() => this.sanitizer.bypassSecurityTrustHtml(PATHS[this.name()] ?? ''));
}
