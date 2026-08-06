import {
  ApplicationConfig,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  inject,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { routes } from './app.routes';
import { SessionStore } from './core/session.store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch()),
    // SIN transiciones de vista en el router: capturan la pantalla entera y
    // dejaban la vieja y la nueva encima a la vez. La que entra se anima sola
    // desde su propio CSS, asi que nunca hay dos.
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    // Se resuelve la sesion antes del primer render para no mostrar la pantalla equivocada.
    provideAppInitializer(() => inject(SessionStore).restore()),
  ],
};
