import { inject } from '@angular/core';
import { Router, type CanActivateFn, type Routes } from '@angular/router';
import { SessionStore } from './core/session.store';

/** Exige sesion; si no la hay manda a /entrar. */
const authGuard: CanActivateFn = async () => {
  const session = inject(SessionStore);
  const router = inject(Router);
  if (!session.ready()) await session.restore();
  return session.isAuthenticated() ? true : router.createUrlTree(['/entrar']);
};

/** Impide volver al login cuando ya hay sesion. */
const guestGuard: CanActivateFn = async () => {
  const session = inject(SessionStore);
  const router = inject(Router);
  if (!session.ready()) await session.restore();
  return session.isAuthenticated() ? router.createUrlTree(['/proyectos']) : true;
};

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'proyectos' },
  {
    path: 'entrar',
    title: 'Entrar - Trackpile',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/auth-page').then((m) => m.AuthPageComponent),
  },
  {
    path: 'proyectos',
    title: 'Proyectos - Trackpile',
    canActivate: [authGuard],
    loadComponent: () => import('./features/projects/projects-page').then((m) => m.ProjectsPageComponent),
  },
  { path: '**', redirectTo: 'proyectos' },
];
