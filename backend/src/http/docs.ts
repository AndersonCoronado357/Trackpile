/**
 * Documentacion de la API en texto plano, servida desde la propia aplicacion.
 * Esta pensada para que un agente la pida con una peticion y sepa que hacer sin
 * mas contexto: por eso trae ejemplos completos y no una tabla de campos.
 */
export function apiDocs(base: string): string {
  return `# Trackpile - API para agentes

Trackpile es la lista de proyectos personales de Anderson. Cada proyecto tiene
nombre, icono, color, descripcion, stack, estado y enlaces.

Si estas trabajando dentro de la carpeta de uno de esos proyectos, mantenlo al
dia aqui: cambia el estado cuando avance, agrega la tecnologia que se acaba de
introducir y pon el enlace cuando se publique.

Base: ${base}

## Autenticacion

Todas las rutas de /projects piden una llave personal:

    Authorization: Bearer tp_xxxxxxxxxxxxxxxx

La llave se saca en la aplicacion, en el menu de la cuenta -> "Llave para
agentes". Se ve una sola vez.

Para comprobar que la llave sirve:

    GET ${base}/whoami
    -> { "id": "...", "email": "...", "name": "...", "projects": 12 }

## Estados

  idea      apuntado, sin empezar
  building  en desarrollo
  done      terminado
  archived  aparcado, no cuenta en la lista

## Campos de un proyecto

  name         texto, obligatorio, unico en la practica
  description  texto o null
  status       uno de los cuatro de arriba
  stack        lista de textos, p. ej. ["Angular","MySQL"]
  accent       "amber" | "violet" | "teal" | "rose" | "blue" | "lime" | "slate"
               o un hexadecimal "#rrggbb"
  iconUrl      URL de imagen o null
  repoUrl      URL del repositorio o null
  liveUrl      URL de lo publicado o null
  pinned       true/false, lo fija arriba de la lista

## Operaciones

Listar todo:

    GET ${base}/projects

Buscar uno por nombre (asi es como lo encuentras sin saber el id):

    GET ${base}/projects/by-name/Trackpile

Crear o actualizar por nombre, en una sola llamada. Es la que conviene usar:
si existe lo actualiza y si no existe lo crea. Solo toca los campos que mandas.

    PUT ${base}/projects/by-name/Trackpile
    Content-Type: application/json

    {
      "status": "building",
      "stack": ["Angular", "Express", "MySQL"],
      "repoUrl": "github.com/ander/trackpile"
    }

    -> 200 si ya existia, 201 si se acaba de crear

Actualizar por id:

    PATCH ${base}/projects/:id

Crear siempre uno nuevo:

    POST ${base}/projects

Borrar:

    DELETE ${base}/projects/:id

## Ejemplo completo

    curl -X PUT ${base}/projects/by-name/Trackpile \\
      -H "Authorization: Bearer tp_TU_LLAVE" \\
      -H "Content-Type: application/json" \\
      -d '{"status":"done","liveUrl":"trackpile.app"}'

## Reglas

- No borres proyectos por tu cuenta; eso lo decide el usuario.
- No cambies el nombre de un proyecto salvo que te lo pidan: el nombre es la
  clave con la que se le encuentra.
- Los enlaces se pueden mandar sin https://, se completa solo.
- Un error devuelve { "error": "explicacion" } con el codigo correspondiente.
`;
}
