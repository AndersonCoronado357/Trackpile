import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/**
 * Avatar del usuario, redondo como en Vexcel y Airlung. Con foto muestra la
 * imagen; sin ella, las iniciales (primera + ultima palabra). El fondo es
 * siempre el mismo tinte del acento: nunca un color derivado del nombre.
 */
@Component({
  selector: 'tp-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (src()) {
      <img [src]="src()" alt="" referrerpolicy="no-referrer" class="h-full w-full rounded-[inherit] object-cover" (error)="broken.set(true)" />
    } @else {
      <span
        class="grid h-full w-full place-items-center rounded-[inherit] font-display font-bold"
        style="background: var(--accent-pill); color: var(--accent-ink)"
        [style.fontSize]="fill() ? '34cqmin' : fontSize() + 'px'"
      >
        {{ initials() }}
      </span>
    }
  `,
  host: {
    '[style.width.px]': 'fill() ? null : size()',
    '[style.height.px]': 'fill() ? null : size()',
    '[class.h-full]': 'fill()',
    '[class.w-full]': 'fill()',
    '[class.flex-none]': '!fill()',
    // El contenedor mide para que las iniciales escalen con la caja.
    '[style.containerType]': 'fill() ? "size" : null',
    class: 'block overflow-hidden rounded-full',
  },
})
export class AvatarComponent {
  readonly name = input('');
  readonly email = input('');
  readonly photo = input<string | null>(null);
  readonly size = input(38);
  /** Ocupa el hueco del padre en vez de medir `size`. */
  readonly fill = input(false);

  /** Si la foto remota falla se cae a las iniciales, sin dejar un hueco roto. */
  protected readonly broken = signal(false);

  protected readonly src = computed(() => (this.broken() ? null : this.photo()));
  protected readonly fontSize = computed(() => (this.fill() ? 0 : Math.max(10, Math.round(this.size() * 0.34))));

  protected readonly initials = computed(() => {
    const source = this.name().trim() || this.email().trim();
    if (!source) return '··';
    const parts = source.split(/[\s@.]+/).filter(Boolean);
    if (!parts.length) return '··';
    const first = parts[0]![0] ?? '';
    // Primera + ultima: 'Anderson Coronado' -> AC, no AN.
    const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? '') : (parts[0]![1] ?? '');
    return (first + last).toUpperCase();
  });
}
