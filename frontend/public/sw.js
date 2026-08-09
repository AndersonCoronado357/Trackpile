/**
 * Service worker de Trackpile.
 *
 * Para que el navegador ofrezca instalarla basta con que exista un listener de
 * 'fetch'. Aqui NO se llama a respondWith en las peticiones normales: si se
 * intercepta y la red falla sin nada en cache, el navegador tira el error
 * "Failed to convert value to 'Response'" y la pagina se queda en blanco.
 *
 * Lo unico que si se guarda es el cascaron: fuentes e iconos, que no cambian y
 * pesan. Los datos NUNCA se cachean —la lista de proyectos tiene que llegar
 * fresca del servidor— y las peticiones a /api se dejan pasar tal cual.
 */

const CASCARON = 'trackpile-cascaron-v1';

const PERMANENTES = [
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-512-maskable.png',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CASCARON)
      .then((cache) => cache.addAll(PERMANENTES))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== CASCARON).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const peticion = event.request;
  if (peticion.method !== 'GET') return;

  const url = new URL(peticion.url);
  if (url.origin !== self.location.origin) return;
  // La sesion y los proyectos siempre del servidor: son de un solo usuario y
  // cambian a cada rato. Una respuesta cacheada aqui seria una mentira.
  if (url.pathname.startsWith('/api/')) return;

  const estatico = /\.(?:woff2|png|svg|ico|webmanifest)$/.test(url.pathname);
  if (!estatico) return;

  event.respondWith(
    caches.match(peticion).then(
      (guardado) =>
        guardado ??
        fetch(peticion).then((respuesta) => {
          if (respuesta.ok) {
            const copia = respuesta.clone();
            caches
              .open(CASCARON)
              .then((cache) => cache.put(peticion, copia))
              .catch(() => undefined);
          }
          return respuesta;
        }),
    ),
  );
});
