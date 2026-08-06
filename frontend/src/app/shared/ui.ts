import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { STATUS_META, accentColor, type Accent, type ProjectStatus } from '../core/models';
import { IconComponent } from './icon';

/* ------------------------------------------------ icono / monograma del proyecto */

const STOPWORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'para', 'con', 'en', 'a', 'of', 'the', 'for']);

@Component({
  selector: 'tp-project-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (url()) {
      <img
        [src]="url()"
        [alt]="''"
        class="h-full w-full rounded-[inherit] object-cover"
        loading="lazy"
        (error)="broken.set(true)"
      />
    } @else {
      <span
        class="grid h-full w-full place-items-center rounded-[inherit] font-display font-bold"
        [style.background]="tint()"
        [style.color]="color()"
        [style.fontSize.px]="size() * 0.4"
      >
        {{ monogram() }}
      </span>
    }
  `,
  imports: [],
  host: {
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[style.borderRadius.px]': 'size() >= 40 ? 12 : 9',
    class: 'block flex-none overflow-hidden',
  },
})
export class ProjectIconComponent {
  readonly name = input.required<string>();
  readonly iconUrl = input<string | null>(null);
  readonly accent = input<Accent>('amber');
  readonly size = input(38);

  /** Si la imagen remota falla, se cae al monograma sin dejar un hueco roto. */
  protected readonly broken = signal(false);

  protected url(): string | null {
    return this.broken() ? null : this.iconUrl();
  }

  protected color(): string {
    return accentColor(this.accent());
  }

  protected tint(): string {
    return `color-mix(in srgb, ${accentColor(this.accent())} 16%, transparent)`;
  }

  protected monogram(): string {
    const clean = this.name().trim();
    if (!clean) return '?';
    // Los conectores no aportan nada al monograma: "Bot de reportes" -> BR, no BD.
    const words = clean.split(/\s+/).filter((word) => !STOPWORDS.has(word.toLowerCase()));
    const useful = (words.length ? words : clean.split(/\s+/)).slice(0, 2);
    return useful.length > 1
      ? useful.map((word) => word[0]?.toUpperCase() ?? '').join('')
      : (useful[0] ?? clean).slice(0, 2).toUpperCase();
  }
}

/* ------------------------------------------------------------ punto de estado */

@Component({
  selector: 'tp-status',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="inline-flex items-center gap-1.5" [title]="meta().label">
      <span class="h-[6px] w-[6px] flex-none rounded-full" [style.background]="meta().color"></span>
      @if (showLabel()) {
        <span class="text-[11.5px] font-medium" style="color: var(--ink-2)">{{ meta().label }}</span>
      }
    </span>
  `,
})
export class StatusPipComponent {
  readonly status = input.required<ProjectStatus>();
  readonly showLabel = input(true);
  protected readonly meta = computed(() => STATUS_META[this.status()]);
}

/* ----------------------------------------------------------------- fecha relativa */

@Component({
  selector: 'tp-ago',
  standalone: true,
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [title]="(value() | date: 'medium') ?? ''">{{ text() }}</span>`,
})
export class AgoComponent {
  readonly value = input<string | null>(null);

  protected text(): string {
    const raw = this.value();
    if (!raw) return '—';
    const ms = Date.now() - Date.parse(raw);
    if (Number.isNaN(ms)) return '—';
    const minutes = Math.round(ms / 60000);
    if (minutes < 1) return 'ahora';
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440) return `${Math.round(minutes / 60)} h`;
    if (minutes < 43200) return `${Math.round(minutes / 1440)} d`;
    return `${Math.round(minutes / 43200)} meses`;
  }
}

/* ------------------------------------------------------------------ estado vacio */

@Component({
  selector: 'tp-empty',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-start gap-4 px-2 py-16">
      <span class="grid h-14 w-14 place-items-center rounded-[14px]" style="background: var(--ink); color: var(--bg)">
        <tp-icon [name]="icon()" [size]="24" />
      </span>
      <div class="space-y-1.5">
        <h2 class="text-[22px]">{{ title() }}</h2>
        @if (hint()) {
          <p class="max-w-[46ch] text-[13.5px] leading-6" style="color: var(--ink-3)">{{ hint() }}</p>
        }
      </div>
      <ng-content />
    </div>
  `,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly hint = input<string | null>(null);
  readonly icon = input<'inbox' | 'search' | 'plus'>('inbox');
}

/* ------------------------------------------------------------------ confirmacion */

@Component({
  selector: 'tp-confirm',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style="background: var(--scrim); animation: tp-fade 160ms var(--ease) both"
      (click)="cancel.emit()"
    >
      <div
        class="tp-panel w-full max-w-[380px] p-5"
        style="animation: tp-rise 240ms var(--ease) both"
        (click)="$event.stopPropagation()"
      >
        <h2 class="text-[16px]">{{ title() }}</h2>
        <p class="mt-2 text-[13px] leading-[1.5rem]" style="color: var(--ink-3)">{{ message() }}</p>
        <div class="mt-5 flex justify-end gap-2">
          <button type="button" class="tp-btn tp-btn-ghost" (click)="cancel.emit()">Cancelar</button>
          <button type="button" class="tp-btn tp-btn-danger" (click)="confirm.emit()">{{ confirmLabel() }}</button>
        </div>
      </div>
    </div>
  `,
})
export class ConfirmComponent {
  readonly title = input('Confirmar');
  readonly message = input('Esta accion no se puede deshacer.');
  readonly confirmLabel = input('Eliminar');
  readonly confirm = output<void>();
  readonly cancel = output<void>();
}
