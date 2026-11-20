// ============================================================
//  CONFIGURACIÓN DEL CALENDARIO — este es el único archivo
//  que necesitas editar para personalizar el contenido.
// ============================================================

window.CONFIG = {
  para: "Andrea",
  de: "Adrián",
  anio: 2026,

  // Titular de la portada (justo debajo de "Diciembre ha llegado"). El salto de línea
  // (\n) decide dónde se parte; mejor dos líneas cortas.
  tituloPortada: "Una sorpresa te\nespera dentro",

  dedicatoria:
    "Este año quería prepararte algo especial para hacerte un poquito más bonito diciembre. " +
    "Una puerta cada mañana, con pequeñas sorpresas. Te amo.",

  // Sonido de los golpes en la puerta (Universfield, Pixabay). Pon "" para usar el golpe sintetizado.
  golpeArchivo: "assets/puerta-golpe.mp3",
  // Ajuste fino de sincronía (ms) entre el sonido y la sacudida de la puerta.
  // Positivo = la sacudida llega más tarde; negativo = más pronto. Con 0 suele bastar.
  golpeAjusteMs: 0,

  // Música de fondo al entrar al calendario (mp3 propio en assets/). Si lo dejas vacío
  // ("") o el archivo falla, suenan villancicos de dominio público en caja de música.
  musicaArchivo: "assets/musica.mp3?v=10", // sube el ?v= si cambias el mp3 (caché). Pon el volumen en el propio archivo.

  // Días especiales: el texto es la etiqueta que llevan encima. El 19 es la casilla dorada
  // con lazo y el 24 la granate con gorro de Papá Noel (su aspecto va en DISPOSICION, app.js).
  especiales: { 19: "Tu cumpleaños", 24: "Nochebuena" },

  // Clave del modo prueba: abre la web con ?preview=CLAVE para ver todos los días.
  // Añade &hoy=2026-12-05 para simular una fecha concreta.
  clavePreview: "adrian-prueba",

  // ----------------------------------------------------------
  //  Contenido de cada día. Tipos disponibles:
  //   - "texto"   → { titulo, texto }
  //   - "foto"    → { titulo, texto, src: "assets/foto1.jpg" }
  //   - "video"   → { titulo, texto, src: "assets/video.mp4" o enlace de YouTube }
  //   - "cancion" → { titulo, texto, src: enlace de Spotify (track/album/playlist) }
  //   - "vale"    → { titulo: lo que regalas (sale tras «VALE POR»), texto: condiciones, src: foto opcional }
  //  "texto" es opcional en todos los tipos.
  //  Regalo escondido: añade pista: "…" (sale debajo) y, si quieres, pista2: "…"
  //  (más fácil, tras el botón «¿Necesitas otra pista?»).
  // ----------------------------------------------------------
  dias: {
    1:  { tipo: "vale",    titulo: "una caja de Schoko-Bons", src: "assets/dia1.webp" },
    2:  { tipo: "vale",    titulo: "una vela", src: "assets/dia2.webp" },
    3:  { tipo: "cancion", titulo: "Nuestra canción", texto: "Ponla alto.", src: "" },
    4:  { tipo: "vale",    titulo: "un desayuno en la cama", texto: "Canjeable cualquier domingo." },
    5:  { tipo: "vale",    titulo: "una copa", src: "assets/dia5.webp" },
    6:  { tipo: "texto",   titulo: "Día 6", texto: "Contenido pendiente." },
    7:  { tipo: "texto",   titulo: "Día 7", texto: "Contenido pendiente." },
    8:  { tipo: "texto",   titulo: "Día 8", texto: "Contenido pendiente." },
    9:  { tipo: "video",   titulo: "Un vídeo para ti", texto: "Contenido pendiente.", src: "" },
    10: { tipo: "texto",   titulo: "Día 10", texto: "Contenido pendiente." },
    11: { tipo: "texto",   titulo: "Día 11", texto: "Contenido pendiente." },
    12: { tipo: "texto",   titulo: "Día 12", texto: "Contenido pendiente." },
    13: { tipo: "texto",   titulo: "Día 13", texto: "Contenido pendiente." },
    14: { tipo: "texto",   titulo: "Día 14", texto: "Contenido pendiente." },
    15: { tipo: "texto",   titulo: "Día 15", texto: "Contenido pendiente." },
    16: { tipo: "texto",   titulo: "Día 16", texto: "Contenido pendiente." },
    17: { tipo: "texto",   titulo: "Día 17", texto: "Contenido pendiente." },
    18: { tipo: "texto",   titulo: "Día 18", texto: "Contenido pendiente." },
    19: { tipo: "texto",   titulo: "¡Feliz cumpleaños, Andrea!", texto: "Aquí irá tu sorpresa de cumpleaños." },
    20: { tipo: "texto",   titulo: "Día 20", texto: "Contenido pendiente." },
    21: { tipo: "texto",   titulo: "Día 21", texto: "Contenido pendiente." },
    22: { tipo: "texto",   titulo: "Día 22", texto: "Contenido pendiente." },
    23: { tipo: "texto",   titulo: "Día 23", texto: "Contenido pendiente." },
    24: { tipo: "texto",   titulo: "Nochebuena", texto: "La sorpresa final." },
  },
};
