# Calendario de Adviento

Regalo de **Adrián para Andrea** (diciembre de 2026): web interactiva, HTML + CSS + JS
vanilla **sin build**, publicada en GitHub Pages. Una portada con una puerta roja a la que
se llama; al entrar, un viaje de cámara 3D atraviesa la puerta y aparece un calendario
tipo mosaico con 24 casillas (una por día, bloqueadas hasta su fecha). Referencias visuales:
las dos capturas que aportó el usuario (portada con puerta y mosaico con el 24 dorado).

- Web: https://xweke.github.io/adviento/ · Repo: https://github.com/xWeke/adviento (público)
- Los textos de la web y las conversaciones con el usuario son en **español**.

## Estado actual

- Funcionando y probado en Chrome (escritorio y móvil simulado) y en el móvil del usuario.
- **Contenido pendiente**: los 24 días de `config.js` son placeholders (el usuario dirá qué
  lleva cada uno: mezcla de texto, foto, vídeo, canción y vales). El 19 es su cumpleaños.
- Lo último subido a GitHub es el commit `04207ae` (música fiable en móvil). Todo lo posterior
  está **sin commit**: verde `#086a39` de la portada con viñeta, nieve nueva (cristales),
  fondo del calendario granate con luz animada, casillas `--vino`, titular nuevo y este archivo.

## Archivos

```
index.html   # portada (#portada), calendario (#calendario), modal (<dialog>), botón de música, toast
styles.css   # tokens en :root, portada/puerta, nieve, mosaico, casilla dorada, modal
config.js    # ÚNICO archivo de contenido: nombres, titular, dedicatoria, días, especiales, audio, clave de prueba
app.js       # intro 3D, secuencia de entrada, nieve, rejilla, bloqueo por fecha, modal, parallax
audio.js     # window.Sonido: golpes, crujido, música (mp3 o sintetizada), desbloqueo en móvil
assets/      # puerta-golpe.mp3, musica.mp3 (+ las fotos/vídeos que se añadan)
README.md    # cómo editar contenido, probar y publicar
```

Orden de scripts en `index.html`: `config.js` → `audio.js` → `app.js` (app.js usa `window.CONFIG`
y `window.Sonido`).

## Cómo funciona

### Portada y viaje de cámara 3D (app.js, bloque «Portada en 3D»)
- Cada elemento tiene una profundidad `z` (`capas3d`). Una cámara avanza por Z y en cada
  frame se calcula la escala proyectada `s = P / (P − zrel)` con `P = 1000`. De esa fórmula
  sale el parallax: lo lejano apenas cambia y lo cercano crece y se desplaza deprisa.
- **La puerta y el texto NO se escalan con `transform: scale`** (se pixelan): se redimensionan
  con la variable CSS `--zoom` (ancho de la puerta y `font-size` la multiplican). La puerta
  limita `--zoom` a `zoomMax: 3.5` y a partir de ahí el resto lo hace un `scale` de GPU.
- Cada elemento se oculta de golpe justo antes de cruzar la cámara (`NEAR_CUT = 0.97·P`).
- Las capas de nieve y el fondo de puntos sí usan `transform` (son blandos, no se ven pixelados).
- Cámara y ratón se interpolan por frame (lerp). Antes de entrar, el ratón desplaza cada capa
  según su profundidad (`RATON_PAN`). El viaje dura `DUR_DOLLY` = 4200 ms con curva suave.
- La luz del interior (`.destello`) llena la pantalla al cruzar y de ella emerge el calendario.
- Si se cambia el layout de la portada hay que volver a llamar a `medir()` (ya se hace en `resize`).

### Secuencia de entrada (`entrar()`)
1. `Sonido.desbloquear()` (dentro del clic) → 2. `Sonido.llamar(sacudirPuerta)`: cuatro golpes;
cada uno sacude la puerta **en el instante exacto del audio** → 3. se abren las hojas +
crujido → 4. viaje de cámara → 5. `mostrarCalendario()` (música + nieve del calendario).
Hay un botón «Saltar intro» si ya se vio antes (`localStorage: adviento-visto`) y «Volver a la puerta».

### Audio (audio.js)
- **Golpes**: grabación real `assets/puerta-golpe.mp3` (4 golpes en 0,13/0,35/0,57/0,80 s,
  constante `GOLPES_ARCHIVO`). La sacudida se dispara leyendo `currentTime` del `<audio>` en
  cada frame, así que sigue al sonido aunque tarde en arrancar. Si el mp3 falla, respaldo
  sintetizado. Ajuste fino por equipo (p. ej. Bluetooth): `golpeAjusteMs` en config.js.
  **Si se cambia el mp3 hay que medir de nuevo los instantes** (ffmpeg `astats`/`silencedetect`).
- **Crujido de bisagra + pestillo**: sintetizados (Web Audio) al abrirse.
- **Música**: `assets/musica.mp3`, en bucle, al entrar al calendario. Botón de silencio abajo a la
  izquierda (se recuerda en `localStorage: adviento-musica-off`). Se pausa si se oculta la pestaña.
  Respaldo si falta el mp3: caja de música sintetizada con Jingle Bells y We Wish You a Merry
  Christmas (dominio público).
- **Móvil/iPhone**: los navegadores solo dejan arrancar audio dentro de un toque. `desbloquear()`
  hace un `play()` mudo + pausa del reproductor de la música en el clic de la puerta (y reanuda el
  `AudioContext`); luego `arrancar()` puede iniciarla sola al acabar la animación. Plan B:
  `reintentarEnGesto()` la arranca en el siguiente toque. Safari iOS **ignora `audio.volume`**, por eso el
  volumen (60 %) y el fundido de entrada (0,8 s) están **grabados en el propio mp3**, no en JS.
- El `AudioContext` se crea al cargar la página (suspendido): crearlo dentro del clic congelaba ~1 s la
  animación en algunos Windows.

### Calendario
- Rejilla CSS Grid de 6 columnas (3 en móvil ≤ 720 px) con `grid-auto-flow: dense`. El orden y el tamaño
  de cada casilla están fijos en `DISPOSICION` (app.js). **Las áreas deben sumar 36** (6×6 en escritorio,
  12×3 en móvil) o quedan huecos. Hay dos casillas 2×2 (24 y 19). Para cambiar el mosaico hay que
  simular el empaquetado en ambas columnas (se hizo con un script de Python de búsqueda) y comprobar
  `gridTemplateRows × columnas == suma de áreas`.
- **Días especiales**: `especiales` en config.js (`19: "Tu cumpleaños"`, `24: "El gran día"`) → casilla
  dorada con lazo y etiqueta. Añadir otro día especial exige hacerle hueco 2×2 en `DISPOSICION`.
- **Bloqueo por fecha**: el día N se abre si hoy ≥ N de diciembre de `anio`. Casilla futura → tiembla + toast.
  Los días abiertos se guardan en `localStorage` (`adviento-abiertos-2026`).
- **Modo prueba** (solo para Adrián): `?preview=adrian-prueba` abre todo sin guardar estado;
  `&hoy=2026-12-05` simula una fecha; `?debug` muestra un recuadro con versión, fps y datos de la cámara.
- Modal `<dialog>` por tipo: `texto`, `foto`, `video` (mp4 propio o YouTube), `cancion` (Spotify),
  `vale` (tarjeta tipo cupón). Si `src` está vacío muestra «Aquí irá…». Se vacía al cerrar (para el audio/vídeo).
- Parallax del calendario: fondo y cabecera más lentos que la rejilla (`actualizarParallax`).

### Fondo y nieve
- Portada: verde `#086a39` + viñeta negra suave (`.portada::before`, valores 0.16/0.42) + nieve en 3 capas.
- Calendario: granate oscuro `#150a0c` + `.aurora` (dos degradados granate/dorado que se desplazan despacio)
  + nieve **solo por detrás de las casillas** (decisión del usuario).
- Nieve: una única función `sembrar(contenedor, grupos)`; cada grupo `{n, tam, dur, op, ax, cristal}`.
  Los números están en `CAPAS_COPOS` (portada) y en `nevar()` (calendario). El usuario ajustó mucho la
  cantidad: portada ≈ 71 copos (13 cristales), calendario ≈ 52 (16 cristales). Se creó/quitó al
  entrar/volver para no gastar nada en la portada.
- **Trampa que ya nos mordió**: no animar `rotate` en el mismo elemento que cae con `transform`. El navegador aplica
  `translate → rotate → scale → transform`, así que la caída queda *dentro* de la rotación y el cristal deriva en círculos.
  El giro va en `.copo.cristal::before` y la caída/vaivén en el elemento exterior.
- Casillas `c-granate` usan `--vino` (`#74192b`) con un filo de luz: con el fondo tan oscuro el granate original
  (`--granate`, que sigue usándose para textos) se fundía con él.

## Reglas y trampas importantes

1. **Caché**: tras cualquier cambio en `styles.css`, `app.js`, `audio.js` o `config.js` hay que subir el `?v=N` de los 4
   enlaces de `index.html` (ahora `?v=24`). Chrome guardaba una versión antigua y parecía un fallo de animación.
   Los mp3 también cachean: `musicaArchivo: "assets/musica.mp3?v=10"` lleva su propia versión.
2. **`prefers-reduced-motion` se ignora a propósito** en la intro (`const reducido = false`): el Chrome del usuario
   lo reporta activo sin haberlo pedido y la intro se saltaba entera («va rapidísimo»). No reintroducir atajos.
3. **Rendimiento en Chrome**: evitar `filter: blur/brightness` en capas animadas, animar `font-size`/`background-size`
   o repintar fondos grandes cada frame; todo va con `transform`/`translate`/`opacity`. Medir fps con rAF antes y después.
4. Los días y textos nuevos van en `config.js`, no en el código. El titular de la portada es `tituloPortada` (`\n` = salto).
5. **Al escribir `\n` o `\\` desde la línea de comandos se perdían las barras** (heredocs/Python): para cadenas con
   barras invertidas usar la herramienta Edit, y comprobar con `node --check` + abrir la página.
6. Los textos de `config.js` se insertan con `textContent` / nodos de texto, nunca como HTML.

## Derechos y publicación

- `assets/musica.mp3` es un recorte de un «Jingle Bells • Karaoke» (canal «Lugn»), con casi seguridad con
  derechos. El usuario lo eligió; el repo es **público**, así que queda descargable. Se le avisó. Alternativa:
  dejar `musicaArchivo: ""` (vuelve la caja de música) o una pista libre (p. ej. Pixabay).
- `assets/puerta-golpe.mp3`: Universfield (Pixabay), licencia libre.
- El repo y `config.js` son públicos: quien mire el código ve las sorpresas y la clave del modo prueba.
- Pages sirve `main` / raíz, sin workflow (no hay build). `git push` y esperar ~1 min.
- **Commits solo cuando el usuario lo pida** (su preferencia; «súbelo» = commit + push).
  Mensajes en español con el pie de coautoría de Claude.
- `gh` tiene sesión propia (cuenta xWeke, keyring). No extraer el token del gestor de credenciales de git
  (el entorno lo bloquea).

## Pruebas y entorno

- No hay suite de tests. Se prueba con Playwright **reutilizando el de `../Lista_Compra/node_modules`** y
  `chromium.launch({ channel: "chrome" })` (no están instalados los navegadores de Playwright). Los scripts de
  prueba van en el scratchpad de la sesión, no en el repo.
- Abrir `index.html` por `file:///` funciona (los audios usan `<audio>`, no `fetch`).
- Para simular las condiciones de un móvil: `--autoplay-policy=user-gesture-required` y un clic **real** (`page.click`,
  no `element.click()` por JS, que no cuenta como gesto de usuario).
- Medir sincronía de golpes: interceptar `Element.prototype.animate` en `.puerta-marco` y leer `currentTime` del audio.
- Verificar siempre en escritorio (1280×800) y móvil (390×844, y 320×568 para textos largos).
- Windows + PowerShell/Git Bash: usar rutas absolutas; `ffmpeg`/`ffprobe` están en el PATH.

## Pendiente

1. Rellenar los 24 días con contenido real (fotos en `assets/`, enlaces de YouTube/Spotify, vales).
2. Decidir qué lleva el 19 (cumpleaños) y el 24 (final).
3. Subir los cambios pendientes a GitHub y probar en el móvil de Andrea (que no lo vea antes del 1 de diciembre).
4. Opcional: ráfaga de nieve más intensa durante el viaje por la puerta; confeti al abrir el 19; revisar el
   derecho de uso de `musica.mp3`.
