import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
// El color del icono lo decide el error; el foco solo lo enciende desde CSS.
import { IconComponent, type IconName } from './icon';

/**
 * Campo de formulario. La etiqueta arriba, con su enlace de accion a la derecha
 * en la misma linea. El icono vive DENTRO de la caja y al enfocar no cambia el
 * tono del bloque: se encienden los iconos. Con error manda el error, que si no
 * el foco lo taparia. El mensaje va suelto debajo, sin caja de color.
 */
@Component({
  selector: 'tp-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: { class: 'block' },
  template: `
    <span class="mb-2 flex items-baseline justify-between gap-4">
      <span class="tp-label mb-0">{{ label() }}</span>
      @if (action()) {
        <button type="button" class="tp-link-soft text-[12.5px]" (click)="actioned.emit()">
          {{ action() }}
        </button>
      }
    </span>

    <label>
      <!-- El color va por CSS, no en linea: en linea ganaba siempre y el foco
           no llegaba a encender el icono. -->
      <tp-icon [name]="icon()" [size]="17" class="tp-field-icon shrink-0 transition-colors" [class.is-bad]="!!error()" />
      <!-- name e id son lo que el gestor de contrasenas usa para reconocer el
           formulario. Sin ellos no puede guardar una credencial de esta app y
           acaba ofreciendo la de otro subdominio hermano. -->
      <input
        [type]="reveal() ? 'text' : type()"
        [value]="value()"
        [placeholder]="placeholder()"
        [autocomplete]="autocomplete()"
        [attr.name]="name() || null"
        [attr.id]="name() ? 'campo-' + name() : null"
        [attr.inputmode]="inputmode() || null"
        [attr.aria-invalid]="error() ? 'true' : null"
        [attr.aria-label]="label()"
        [spellcheck]="false"
        class="min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none"
        (input)="changed.emit($any($event.target).value)"
        (keyup)="watchCaps($event)"
        (keydown)="watchCaps($event)"
        (blur)="caps.set(false)"
      />
      @if (type() === 'password') {
        <!-- El ojo está SIEMPRE, no solo al escribir, y se enciende con el foco
             igual que el candado de la izquierda. -->
        <button
          type="button"
          class="tp-field-eye -mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors"
          [attr.aria-label]="reveal() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
          [attr.aria-pressed]="reveal()"
          (click)="toggleReveal.emit(); $event.preventDefault()"
        >
          <tp-icon [name]="reveal() ? 'eye-off' : 'eye'" [size]="17" />
        </button>
      }
    </label>

    @if (error()) {
      <span class="mt-1.5 block text-[12.5px] font-medium" style="color: var(--danger)" role="alert">
        {{ error() }}
      </span>
    } @else if (caps()) {
      <!-- El aviso que hace falta y casi nadie pone: el error de acceso mas comun -->
      <span class="mt-1.5 flex items-center gap-1.5 text-[12px] font-medium" style="color: var(--warn)">
        <tp-icon name="alert" [size]="13" />
        Tienes las mayúsculas activadas
      </span>
    }
  `,
  styles: [
    `
      label {
        display: flex;
        height: 50px;
        align-items: center;
        gap: 12px;
        padding: 0 15px;
        border-radius: var(--r-ctrl);
        background: var(--surface-2);
        cursor: text;
        transition: background var(--t-fast) var(--ease);
      }
      label:hover {
        background: var(--surface-3);
      }
      /* Al enfocar se enciende el icono en el amarillo de marca; el fondo
         apenas sube un tono. Con error manda el error. */
      .tp-field-icon {
        color: var(--ink-3);
      }
      label:focus-within {
        background: var(--surface-3);
      }
      label:focus-within .tp-field-icon {
        color: var(--accent-ink);
      }
      .tp-field-icon.is-bad,
      label:focus-within .tp-field-icon.is-bad {
        color: var(--danger);
      }
      .tp-field-eye {
        color: var(--ink-3);
      }
      label:focus-within .tp-field-eye,
      .tp-field-eye:hover {
        color: var(--accent-ink);
      }
    `,
  ],
})
export class FieldComponent {
  readonly label = input.required<string>();
  readonly icon = input<IconName>('mail');
  readonly value = input('');
  readonly placeholder = input('');
  readonly type = input<'text' | 'email' | 'password'>('text');
  readonly autocomplete = input('off');
  /** Nombre del campo. Lo lee el gestor de contrasenas para identificarlo. */
  readonly name = input('');
  readonly inputmode = input<string | undefined>(undefined);
  readonly reveal = input(false);
  /** Enlace que va en la misma linea que la etiqueta, a la derecha. */
  readonly action = input('');
  /** El mensaje del error, o vacio si el campo esta bien. */
  readonly error = input('');

  readonly changed = output<string>();
  readonly toggleReveal = output<void>();
  readonly actioned = output<void>();

  /** Bloq Mayus encendido mientras se escribe la contrasena. */
  protected readonly caps = signal(false);

  protected watchCaps(event: KeyboardEvent): void {
    if (this.type() !== 'password') return;
    this.caps.set(event.getModifierState?.('CapsLock') ?? false);
  }
}
