# Trackpile

Lista personal de proyectos. Registras nombre, icono, stack, descripción y los enlaces
(repositorio y publicado), y marcas en qué estado va cada uno: **Idea**, **En desarrollo**,
**Terminado** o **Archivado**.

Con cuenta propia, tema claro/oscuro y todo guardado en MySQL.

## Arrancar

```bash
npm start
```

Busca un puerto libre para el API y otro para la app, levanta ambos e imprime la URL.

Si es la primera vez en esta máquina:

```bash
npm run setup
```

```bash
npm run db:setup
```

`db:setup` pide la contraseña de MySQL en tu terminal (no se muestra ni se guarda),
crea la base `trackpile` y genera `backend/.env`.

Ya hay una cuenta de prueba con proyectos de ejemplo: **demo@trackpile.local** /
**trackpile2026**. Bórrala y crea la tuya desde "Crear una cuenta" cuando quieras.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Angular 22 standalone + signals + zoneless, Tailwind 4 |
| Backend | Express 5 + TypeScript, `mysql2` con pool y transacciones |
| Base de datos | MySQL 8 (`users`, `projects`) con migraciones versionadas |
| Sesión | JWT en cookie `httpOnly` + `SameSite=Lax`, contraseñas con bcrypt (12 rondas) |
| Tipografía | Space Grotesk (títulos) · Plus Jakarta Sans (UI) · JetBrains Mono (datos) |

Las fuentes están auto-hospedadas en `frontend/public/fonts`: la app no pide nada a
ningún CDN.

## Dónde vive el estado

**Nada se guarda en el navegador.** No hay `localStorage` ni `sessionStorage`.

- La sesión es una cookie `httpOnly` que el JavaScript de la página no puede leer.
- La preferencia de tema vive en la columna `users.theme` de MySQL, así que te sigue
  entre navegadores y equipos.
- La lista se cachea en memoria (signals) mientras la pestaña está abierta, para que
  navegar no vuelva a pedir todo al servidor.

## Estructura

```
backend/
  src/
    config/env.ts          configuración por variables de entorno
    db/                    pool, migraciones, semilla
    auth/auth.service.ts   registro, login, sesión, bcrypt
    projects/              repositorio de proyectos
    http/                  app Express, rutas, errores
frontend/
  src/
    styles.css             sistema visual completo (tokens claro/oscuro)
    app/
      core/                modelos, API, stores de sesión y proyectos
      shared/              iconos y componentes de UI
      features/            auth · projects · settings
scripts/
  dev.mjs                  lanzador con puerto libre automático
  setup-db.mjs             crea la base y el .env
  install.mjs              instala dependencias de ambos paquetes
```

## API

Todo bajo `/api`. Las rutas de proyectos exigen sesión y solo devuelven lo tuyo.

| Método | Ruta | Qué hace |
|---|---|---|
| `POST` | `/auth/register` | Crea cuenta, abre sesión y siembra ejemplos |
| `POST` | `/auth/login` | Inicia sesión |
| `POST` | `/auth/logout` | Cierra sesión |
| `GET` | `/auth/me` | Usuario actual |
| `PATCH` | `/auth/me` | Cambia nombre o tema |
| `POST` | `/auth/password` | Cambia la contraseña |
| `GET` | `/projects` | Lista tus proyectos |
| `POST` | `/projects` | Crea uno |
| `PATCH` | `/projects/:id` | Edita uno |
| `DELETE` | `/projects/:id` | Elimina uno |
| `POST` | `/projects/reorder` | Guarda el orden manual |

## Otros comandos

```bash
npm run build
```

Compila el frontend y el backend. Después, `npm run serve` sirve todo desde Express en
un solo proceso.

```bash
npm run db:reset
```

Vacía la base por completo. Pide confirmación escrita.
