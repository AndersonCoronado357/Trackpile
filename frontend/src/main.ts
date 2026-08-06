import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));

/**
 * Registro del service worker: es lo que hace que Trackpile se pueda instalar
 * en el telefono. Se hace despues de cargar para no competir con el arranque,
 * y solo sobre HTTPS o localhost, que es donde el navegador lo permite.
 *
 * El ?v= sube cuando cambie sw.js: sin el, la copia vieja se queda pegada.
 */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  const registrar = () => void navigator.serviceWorker.register('/sw.js?v=1').catch(() => undefined);
  if (document.readyState === 'complete') registrar();
  else window.addEventListener('load', registrar, { once: true });
}
