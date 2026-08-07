import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProjectsStore } from '../../core/projects.store';
import { ToastService } from '../../core/toast.service';
import { isImage, squareThumbnail } from '../../core/image';
import {
  ACCENTS,
  PRESET_HEX,
  PROJECT_STATUSES,
  STATUS_META,
  type Accent,
  type Project,
  type ProjectStatus,
} from '../../core/models';
import { IconComponent } from '../../shared/icon';
import { ProjectIconComponent } from '../../shared/ui';
import { AdornoComponent } from '../../shared/adorno';
import { StackPickerComponent } from '../../shared/stack-picker';
import { ColorPickerComponent } from '../../shared/color-picker';

interface Draft {
  name: string;
  description: string;
  status: ProjectStatus;
  stack: string[];
  iconUrl: string;
  accent: Accent;
  repoUrl: string;
  liveUrl: string;
  pinned: boolean;
}

const EMPTY: Draft = {
  name: '',
  description: '',
  status: 'idea',
  stack: [],
  iconUrl: '',
  accent: 'amber',
  repoUrl: '',
  liveUrl: '',
  pinned: false,
};

@Component({
  selector: 'tp-project-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    IconComponent,
    ProjectIconComponent,
    AdornoComponent,
    StackPickerComponent,
    ColorPickerComponent,
  ],
  templateUrl: './project-editor.html',
})
export class ProjectEditorComponent {
  protected readonly store = inject(ProjectsStore);
  private readonly toast = inject(ToastService);

  /** null = crear uno nuevo. */
  readonly project = input<Project | null>(null);
  readonly closed = output<void>();

  protected readonly statuses = PROJECT_STATUSES;
  protected readonly statusMeta = STATUS_META;
  protected readonly accents = ACCENTS;
  protected readonly presetHex = PRESET_HEX;

  protected readonly draft = signal<Draft>({ ...EMPTY });
  protected readonly saving = signal(false);
  protected readonly problem = signal<string | null>(null);
  protected readonly loadingIcon = signal(false);
  protected readonly draggingIcon = signal(false);

  protected readonly isEdit = computed(() => this.project() !== null);
  protected readonly canSave = computed(() => this.draft().name.trim().length > 0);

  /** La caja de texto crece con lo que se escribe, sin barra de scroll. */
  protected grow(el: HTMLTextAreaElement): void {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  /** El acento elegido no es ninguno de los siete preajustes. */
  protected readonly isCustom = computed(() => this.draft().accent.startsWith('#'));

  /** Color de partida de la rueda: el actual, ya resuelto a hexadecimal. */
  protected readonly currentColor = computed(() => {
    const accent = this.draft().accent;
    return accent.startsWith('#') ? accent : (PRESET_HEX[accent as keyof typeof PRESET_HEX] ?? '#f5a627');
  });

  constructor() {
    effect(() => {
      const source = this.project();
      this.draft.set(
        source
          ? {
              name: source.name,
              description: source.description ?? '',
              status: source.status,
              stack: [...source.stack],
              iconUrl: source.iconUrl ?? '',
              accent: source.accent,
              repoUrl: source.repoUrl ?? '',
              liveUrl: source.liveUrl ?? '',
              pinned: source.pinned,
            }
          : { ...EMPTY },
      );
      this.problem.set(null);
    });
  }

  protected patch<K extends keyof Draft>(key: K, value: Draft[K]): void {
    this.draft.update((current) => ({ ...current, [key]: value }));
  }

  /* --------------------------------------------- icono propio del proyecto --- */

  protected onIconDrop(event: DragEvent): void {
    event.preventDefault();
    this.draggingIcon.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) void this.acceptIcon(file);
  }

  protected onIconPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) void this.acceptIcon(file);
    input.value = '';
  }

  private async acceptIcon(file: File): Promise<void> {
    if (!isImage(file)) {
      this.toast.error('Ese archivo no es una imagen');
      return;
    }
    this.loadingIcon.set(true);
    try {
      // 192px basta: el icono se ve a 42px en la lista y a 40px en la cabecera.
      this.patch('iconUrl', await squareThumbnail(file, 192));
    } catch {
      this.toast.error('No se pudo procesar la imagen');
    } finally {
      this.loadingIcon.set(false);
    }
  }

  protected clearIcon(): void {
    this.patch('iconUrl', '');
  }

  /** Distingue una imagen subida de una direccion pegada a mano. */
  protected readonly iconIsUpload = computed(() => this.draft().iconUrl.startsWith('data:'));

  protected async save(): Promise<void> {
    const draft = this.draft();
    if (!draft.name.trim()) {
      this.problem.set('El nombre es obligatorio');
      return;
    }

    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      status: draft.status,
      stack: draft.stack,
      iconUrl: draft.iconUrl.trim() || null,
      accent: draft.accent,
      repoUrl: draft.repoUrl.trim() || null,
      liveUrl: draft.liveUrl.trim() || null,
      pinned: draft.pinned,
    };

    this.saving.set(true);
    try {
      const existing = this.project();
      const saved = existing ? await this.store.update(existing.id, payload) : await this.store.create(payload);
      if (saved) this.closed.emit();
    } finally {
      this.saving.set(false);
    }
  }
}
