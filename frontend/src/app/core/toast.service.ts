import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  text: string;
  tone: 'neutral' | 'ok' | 'error';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private counter = 0;
  readonly toasts = signal<Toast[]>([]);

  show(text: string, tone: Toast['tone'] = 'neutral', ms = 3000): void {
    const id = ++this.counter;
    this.toasts.update((list) => [...list, { id, text, tone }]);
    setTimeout(() => this.dismiss(id), ms);
  }

  ok(text: string): void {
    this.show(text, 'ok');
  }

  error(text: string): void {
    this.show(text, 'error', 4800);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((toast) => toast.id !== id));
  }
}
