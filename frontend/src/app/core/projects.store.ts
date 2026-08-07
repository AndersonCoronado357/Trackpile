import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService, describeError } from './api.service';
import { ToastService } from './toast.service';
import { PROJECT_STATUSES, type Project, type ProjectPayload, type ProjectStatus } from './models';

export type SortKey = 'updated' | 'created' | 'name' | 'status';

/**
 * Cache en memoria de la lista. Se carga una vez y se filtra/ordena aqui;
 * cada escritura viaja al backend y refresca solo la fila afectada.
 */
@Injectable({ providedIn: 'root' })
export class ProjectsStore {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  private readonly _projects = signal<Project[]>([]);
  private readonly _loading = signal(true);
  private readonly _error = signal<string | null>(null);
  private readonly _busy = signal(false);

  readonly projects = this._projects.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly busy = this._busy.asReadonly();

  readonly query = signal('');
  readonly statusFilter = signal<ProjectStatus | 'all'>('all');
  readonly stackFilter = signal<string | null>(null);
  readonly sort = signal<SortKey>('updated');

  private loaded = false;

  readonly counts = computed(() => {
    const map = Object.fromEntries(PROJECT_STATUSES.map((status) => [status, 0])) as Record<ProjectStatus, number>;
    for (const project of this._projects()) map[project.status] += 1;
    return map;
  });

  readonly allStacks = computed(() => {
    const tally = new Map<string, number>();
    for (const project of this._projects()) {
      for (const tech of project.stack) tally.set(tech, (tally.get(tech) ?? 0) + 1);
    }
    return [...tally.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
      .map(([name, count]) => ({ name, count }));
  });

  readonly visible = computed<Project[]>(() => {
    const needle = this.query().trim().toLowerCase();
    const status = this.statusFilter();
    const stack = this.stackFilter();

    const list = this._projects().filter((project) => {
      if (status === 'all' ? project.status === 'archived' : project.status !== status) return false;
      if (stack && !project.stack.some((tech) => tech.toLowerCase() === stack.toLowerCase())) return false;
      if (needle) {
        const haystack = `${project.name} ${project.description ?? ''} ${project.stack.join(' ')}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });

    const key = this.sort();
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      switch (key) {
        case 'name':
          return a.name.localeCompare(b.name, 'es');
        case 'created':
          return Date.parse(b.createdAt ?? '') - Date.parse(a.createdAt ?? '');
        case 'status':
          return PROJECT_STATUSES.indexOf(a.status) - PROJECT_STATUSES.indexOf(b.status);
        default:
          return Date.parse(b.updatedAt ?? '') - Date.parse(a.updatedAt ?? '');
      }
    });
  });

  /** Los archivados solo aparecen con su filtro explicito. */
  readonly archivedCount = computed(() => this._projects().filter((project) => project.status === 'archived').length);

  readonly hasFilters = computed(
    () => this.query().trim().length > 0 || this.statusFilter() !== 'all' || this.stackFilter() !== null,
  );

  async load(force = false): Promise<void> {
    if (this.loaded && !force) return;
    this._loading.set(true);
    this._error.set(null);
    try {
      this._projects.set(await this.api.listProjects());
      this.loaded = true;
    } catch (error) {
      this._error.set(describeError(error));
    } finally {
      this._loading.set(false);
    }
  }

  /** Se llama al cerrar sesion para no filtrar datos entre cuentas. */
  reset(): void {
    this._projects.set([]);
    this.loaded = false;
    this._loading.set(true);
    this.query.set('');
    this.statusFilter.set('all');
    this.stackFilter.set(null);
  }

  private upsert(project: Project): void {
    this._projects.update((list) => {
      const index = list.findIndex((item) => item.id === project.id);
      if (index === -1) return [project, ...list];
      const copy = [...list];
      copy[index] = project;
      return copy;
    });
  }

  async create(payload: ProjectPayload): Promise<Project | null> {
    this._busy.set(true);
    try {
      const created = await this.api.createProject(payload);
      this.upsert(created);
      this.toast.ok(`"${created.name}" agregado`);
      return created;
    } catch (error) {
      this.toast.error(describeError(error));
      return null;
    } finally {
      this._busy.set(false);
    }
  }

  async update(id: string, payload: Partial<ProjectPayload>): Promise<Project | null> {
    this._busy.set(true);
    try {
      const updated = await this.api.updateProject(id, payload);
      this.upsert(updated);
      return updated;
    } catch (error) {
      this.toast.error(describeError(error));
      return null;
    } finally {
      this._busy.set(false);
    }
  }

  async setStatus(project: Project, status: ProjectStatus): Promise<void> {
    if (project.status === status) return;
    const snapshot = this._projects();
    this.upsert({ ...project, status });
    try {
      this.upsert(await this.api.updateProject(project.id, { status }));
    } catch (error) {
      this._projects.set(snapshot);
      this.toast.error(describeError(error));
    }
  }

  async togglePinned(project: Project): Promise<void> {
    const snapshot = this._projects();
    this.upsert({ ...project, pinned: !project.pinned });
    try {
      this.upsert(await this.api.updateProject(project.id, { pinned: !project.pinned }));
    } catch (error) {
      this._projects.set(snapshot);
      this.toast.error(describeError(error));
    }
  }

  async destroy(project: Project): Promise<boolean> {
    const snapshot = this._projects();
    this._projects.update((list) => list.filter((item) => item.id !== project.id));
    try {
      await this.api.deleteProject(project.id);
      this.toast.ok(`"${project.name}" eliminado`);
      return true;
    } catch (error) {
      this._projects.set(snapshot);
      this.toast.error(describeError(error));
      return false;
    }
  }

  clearFilters(): void {
    this.query.set('');
    this.statusFilter.set('all');
    this.stackFilter.set(null);
  }
}
