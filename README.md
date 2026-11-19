# Calendario de Adviento

Web estática (HTML + CSS + JS, sin build) pensada para GitHub Pages.

## Editar el contenido
Todo se cambia en `config.js`:
- `para`, `de`, `dedicatoria`, `anio`.
- `dias`: un objeto por día con `tipo` (`texto`, `foto`, `video`, `cancion`, `vale`), `titulo`, `texto` y `src`.
- Las fotos y vídeos propios van en `assets/` (p. ej. `src: "assets/dia2.jpg"`). Para vídeos, mejor YouTube (oculto) que archivos pesados.

**Importante:** cada vez que cambies `config.js`, `app.js` o `styles.css`, sube el número `?v=` en
`index.html` (p. ej. `?v=4` → `?v=5`). Si no, el navegador puede seguir usando la versión antigua en caché.

## Probar
Servir la carpeta en local (por ejemplo `npx serve .` o la extensión Live Server) y abrir:
- Normal: `http://localhost:3000/`
- Todo desbloqueado: `?preview=adrian-prueba`
- Simular una fecha: `?preview=adrian-prueba&hoy=2026-12-05`

La clave del modo prueba está en `config.js` (`clavePreview`). En modo prueba los días abiertos se guardan aparte de los de verdad; añade `&borrar` para vaciarlos.

## Publicar en GitHub Pages
1. Crear un repo y subir el contenido de esta carpeta.
2. Settings → Pages → Deploy from branch → `main` / `(root)`.

Ojo: el repo y `config.js` son públicos; quien mire el código puede ver las sorpresas.
