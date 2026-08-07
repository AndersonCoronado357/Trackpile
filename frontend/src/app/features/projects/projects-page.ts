import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { ProjectsStore, type SortKey } from '../../core/projects.store';
import { ViewportService } from '../../core/viewport.service';
import { PROJECT_STATUSES, STATUS_META, type Project, type ProjectStatus } from '../../core/models';
import { IconComponent } from '../../shared/icon';
import { AgoComponent, ConfirmComponent, EmptyStateComponent, ProjectIconComponent } from '../../shared/ui';
import { AdornoComponent } from '../../shared/adorno';
import { anclarA } from '../../shared/anclaje';
import { ProjectEditorComponent } from './project-editor';

@Component({
  selector: 'tp-projects-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ScrollingModule,
    IconComponent,
    AgoComponent,
    ConfirmComponent,
    EmptyStateComponent,
    ProjectIconComponent,
    AdornoComponent,
    ProjectEditorComponent,
  ],
  templateUrl: './projects-page.html',
})
export class ProjectsPageComponent {
  private readonly raiz = inject(ElementRef<HTMLElement>);
  protected readonly store = inject(ProjectsStore);
  protected readonly viewport = inject(ViewportService);

  /** Tiene que ir con el alto de `.tp-row-slot` de cada tamano de pantalla. */
  protected readonly itemSize = computed(() => (this.viewport.isMobile() ? 152 : 104));

  protected readonly statuses = PROJECT_STATUSES;
  protected readonly meta = STATUS_META;

  protected readonly editing = signal<Project | null | undefined>(undefined);
  protected readonly pendingDelete = signal<Project | null>(null);
  protected readonly statusMenuFor = signal<string | null>(null);

  /** Dónde pintar el menú de estado, ya en coordenadas de pantalla. */
  private readonly menuAt = signal<{ x: number; y: number; w: number } | null>(null);

  protected readonly statusMenu = computed(() => {
    const id = this.statusMenuFor();
    const at = this.menuAt();
    if (!id || !at) return null;
    const project = this.store.visible().find((item) => item.id === id);
    return project ? { project, ...at } : null;
  });

  /**
   * Se ancla al botón con la regla común de la app. El alto va calculado —6 px
   * de aire arriba y abajo más una fila de 34 px por estado— y no a ojo, porque
   * de esa cifra depende si se abre hacia abajo o hacia arriba.
   */
  protected openStatusMenu(project: Project, event: MouseEvent): void {
    if (this.statusMenuFor() === project.id) {
      this.statusMenuFor.set(null);
      return;
    }
    const { x, y, ancho } = anclarA(event.currentTarget as HTMLElement, {
      alto: 12 + this.statuses.length * 34,
      anchoMinimo: 132,
      // El menú se dibuja fuera de la lista, colgando del propio componente.
      panelDentroDe: this.raiz.nativeElement as HTMLElement,
    });
    this.menuAt.set({ x, y, w: ancho });
    this.statusMenuFor.set(project.id);
  }
  protected readonly sortOpen = signal(false);

  protected readonly sortLabels: Record<SortKey, string> = {
    updated: 'Actualizado',
    created: 'Más reciente',
    name: 'Nombre',
    status: 'Estado',
  };

  protected readonly sortKeys = Object.keys(this.sortLabels) as SortKey[];

  /**
   * Identifica la vista actual. Al entrar en la clave de la lista, cambiar de
   * filtro u orden rehace las filas y la entrada escalonada se ve otra vez.
   */
  protected readonly viewKey = computed(
    () => `${this.store.statusFilter()}|${this.store.sort()}|${this.store.stackFilter() ?? ''}`,
  );

  protected readonly filterTabs = computed(() => {
    const counts = this.store.counts();
    const total = this.store.projects().length - counts.archived;
    return [
      { id: 'all' as const, label: 'Todos', count: total },
      ...PROJECT_STATUSES.map((status) => ({ id: status, label: STATUS_META[status].label, count: counts[status] })),
    ];
  });

  constructor() {
    void this.store.load();
  }

  protected openNew(): void {
    this.editing.set(null);
  }

  protected openEdit(project: Project): void {
    this.editing.set(project);
  }

  protected closeEditor(): void {
    this.editing.set(undefined);
  }

  /** La fila que acaba de cambiar se enciende un momento para poder seguirla. */
  protected readonly flashed = signal<string | null>(null);

  protected async setStatus(project: Project, status: ProjectStatus): Promise<void> {
    this.statusMenuFor.set(null);
    if (project.status === status) return;
    await this.store.setStatus(project, status);
    this.flashed.set(project.id);
    setTimeout(() => this.flashed.set(null), 900);
  }

  protected async confirmDelete(): Promise<void> {
    const project = this.pendingDelete();
    if (!project) return;
    this.pendingDelete.set(null);
    await this.store.destroy(project);
  }

  /** Dominio legible para mostrar el enlace publicado sin ruido. */
  protected host(url: string | null): string {
    if (!url) return '';
    try {
      return new URL(url).host.replace(/^www\./, '');
    } catch {
      return url.replace(/^https?:\/\//, '').split('/')[0] ?? url;
    }
  }
}
