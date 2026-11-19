(() => {
  "use strict";

  const CFG = window.CONFIG;
  const $ = (sel, root = document) => root.querySelector(sel);

  const portada = $("#portada");
  const puerta = $("#puerta");
  const calendario = $("#calendario");
  const rejilla = $("#rejilla");
  const bgDots = $(".bg-dots");
  const destello = $(".destello");

  // Sin zoom en iPhone: Safari ignora user-scalable=no, así que se corta el gesto de pellizco
  // (el doble toque ya lo quita touch-action: manipulation en styles.css)
  ["gesturestart", "gesturechange", "gestureend"].forEach((t) =>
    document.addEventListener(t, (e) => e.preventDefault(), { passive: false })
  );
  // En la portada tampoco se desliza con el dedo (ni el rebote elástico de Safari); en el
  // calendario el scroll sigue normal. El scroll de 1 px de reavivarBarras no se ve afectado.
  document.addEventListener(
    "touchmove",
    (e) => { if (e.touches.length > 1 || !portada.hidden) e.preventDefault(); },
    { passive: false }
  );

  // Color de las barras del navegador del móvil (arriba y abajo): sigue al fondo de
  // cada pantalla, que sale de los tokens de styles.css.
  //  · Safari en iPhone no reacciona a cambiar el `content` de un <meta> existente:
  //    hay que quitarlo y crear uno nuevo.
  //  · Las versiones recientes de iOS ignoran el <meta> y tiñen las barras con el
  //    fondo del <html>, así que éste cambia a la vez (clase `en-calendario` en <html>).
  function colorBarras(variable, enCalendario, { remuestrear = true } = {}) {
    const c = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
    document.documentElement.classList.toggle("en-calendario", enCalendario);
    if (!c) return;
    document.head.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = c;
    document.head.appendChild(meta);
    reavivarBarras(remuestrear);
  }

  // Safari 26 no siempre vuelve a mirar el color de las franjas al cambiar: se sustituyen
  // por nodos nuevos y se hace un scroll mínimo para que repita el muestreo.
  function reavivarBarras(conScroll = true) {
    document.querySelectorAll(".barra-safari").forEach((b) => b.replaceWith(b.cloneNode(false)));
    if (!conScroll) return;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      window.scrollTo(0, y + 1);
      requestAnimationFrame(() => window.scrollTo(0, y));
    });
  }
  // Mientras el velo granate cubre la pantalla, las franjas (barras de Safari) pasan del
  // verde al granate a la vez que él, para que no quede un borde de otro color.
  const barras = document.getElementsByClassName("barra-safari"); // colección viva (se clonan)
  const tokenRgb = (v) => {
    const h = getComputedStyle(document.documentElement).getPropertyValue(v).trim().replace("#", "");
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const VERDE_RGB = tokenRgb("--fondo-portada");
  const GRANATE_RGB = tokenRgb("--fondo-cal");
  let barrasTenidas = false;
  function tenirBarras(t) {
    const c = t == null ? "" : `rgb(${VERDE_RGB.map((v, i) => Math.round(v + (GRANATE_RGB[i] - v) * t)).join(",")})`;
    for (const b of barras) b.style.backgroundColor = c;
    barrasTenidas = t != null;
  }

  const cabecera = $(".cal-cabecera");
  const modal = $("#modal");
  const toastEl = $("#toast");
  const btnSaltar = $("#saltar");

  // La animación de entrada ES el regalo: se reproduce siempre completa, aunque el
  // navegador diga que se prefiere movimiento reducido (en algunos Chrome lo dice
  // sin que el usuario lo haya pedido y la intro se saltaba entera).
  const reducidoSistema = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const reducido = false;
  const esperar = (ms) => new Promise((r) => setTimeout(r, reducido ? Math.min(ms, 30) : ms));

  // ------------------------------------------------------------
  //  Almacenamiento (protegido por si el navegador lo bloquea)
  // ------------------------------------------------------------
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
  };

  // ------------------------------------------------------------
  //  Fecha y modo prueba
  // ------------------------------------------------------------
  const params = new URLSearchParams(location.search);
  const modoPrueba = params.get("preview") === CFG.clavePreview;
  const hoySimulado = modoPrueba && params.get("hoy") ? new Date(params.get("hoy") + "T09:00:00") : null;

  function hoy() {
    return hoySimulado && !isNaN(hoySimulado) ? hoySimulado : new Date();
  }

  // Reloj que avanza (también con fecha simulada, que arranca a las 9:00 de ese día)
  const desfaseReloj = hoySimulado && !isNaN(hoySimulado) ? hoySimulado - Date.now() : 0;
  const ahora = () => new Date(Date.now() + desfaseReloj);

  function fechaDia(n) {
    return new Date(CFG.anio, 11, n, 0, 0, 0);
  }

  function disponible(n) {
    if (modoPrueba && !hoySimulado) return true;
    return hoy() >= fechaDia(n);
  }

  function esHoy(n) {
    const h = hoy();
    return h.getFullYear() === CFG.anio && h.getMonth() === 11 && h.getDate() === n;
  }

  function diasQueFaltan(n) {
    const h = hoy();
    const inicioHoy = new Date(h.getFullYear(), h.getMonth(), h.getDate());
    return Math.round((fechaDia(n) - inicioHoy) / 86400000);
  }

  // Días abiertos (en modo prueba no se guardan)
  // En modo prueba se guardan aparte, para no mezclarlos con los de verdad; &borrar los vacía
  const CLAVE_ABIERTOS = "adviento-abiertos-" + (modoPrueba ? "prueba-" : "") + CFG.anio;
  if (modoPrueba && params.has("borrar")) store.set(CLAVE_ABIERTOS, "[]");
  let abiertosGuardados = [];
  try { abiertosGuardados = JSON.parse(store.get(CLAVE_ABIERTOS) || "[]"); } catch {}
  const abiertos = new Set(abiertosGuardados);
  function marcarAbierto(n) {
    abiertos.add(n);
    store.set(CLAVE_ABIERTOS, JSON.stringify([...abiertos]));
  }

  // ------------------------------------------------------------
  //  Textos personalizados
  // ------------------------------------------------------------
  document.querySelectorAll("[data-de]").forEach((el) => (el.textContent = CFG.de));
  document.querySelectorAll("[data-para]").forEach((el) => (el.textContent = CFG.para));
  document.querySelectorAll("[data-titulo]").forEach((el) => {
    // textContent + <br>: el texto de config.js nunca se interpreta como HTML
    (CFG.tituloPortada || "").split("\n").forEach((linea, i) => {
      if (i) el.appendChild(document.createElement("br"));
      el.appendChild(document.createTextNode(linea));
    });
  });
  document.querySelectorAll("[data-dedicatoria]").forEach((el) => (el.textContent = CFG.dedicatoria));
  document.title = `Para ${CFG.para} · Calendario de Adviento`;

  // Decoración de la puerta: cada hoja recibe la corona y la placa completas
  // y su overflow muestra solo su mitad, así se parten al abrirse.
  document.querySelectorAll(".hoja-deco").forEach((deco) => {
    deco.innerHTML = `<span class="corona"></span><span class="placa"></span>`;
    $(".placa", deco).textContent = CFG.para;
  });

  // ------------------------------------------------------------
  //  Nieve. Cada grupo: n copos, tam [min,max] px, dur [min,max] s de caída,
  //  op opacidad, ax [min,max] px de vaivén lateral y cristal:true para copos
  //  con forma de cristal que giran. Más cerca de la cámara = más grande y rápido.
  // ------------------------------------------------------------
  const capas = [...document.querySelectorAll(".capa")];
  const azar = (a, b) => a + Math.random() * (b - a);

  function sembrar(contenedor, grupos) {
    const frag = document.createDocumentFragment();
    grupos.forEach((g) => {
      for (let i = 0; i < g.n; i++) {
        const s = document.createElement("span");
        const tam = azar(...g.tam);
        const dur = azar(...g.dur);
        const vdur = azar(3.5, 6.5); // cada copo se balancea a su ritmo
        let giro = "";
        if (g.cristal) {
          const t = azar(10, 22); // vueltas lentas, cada cristal a su ritmo y sentido
          giro = `--giro:${t.toFixed(1)}s;--giro-retraso:${(-azar(0, t)).toFixed(1)}s;` +
            `--giro-sentido:${Math.random() < 0.5 ? "normal" : "reverse"};`;
        }
        s.className = g.cristal ? "copo cristal" : "copo";
        s.style.cssText =
          `left:${azar(0, 100)}%;top:0;width:${tam}px;height:${tam}px;opacity:${g.op};` +
          `--ax:${azar(...g.ax).toFixed(1)}px;--deriva:${azar(-40, 40).toFixed(1)}px;${giro}` +
          `animation-duration:${dur}s,${vdur}s;animation-delay:${-azar(0, dur)}s,${-azar(0, vdur)}s`;
        frag.appendChild(s);
      }
    });
    contenedor.appendChild(frag);
  }

  // Portada: tres capas de profundidad
  const CAPAS_COPOS = {
    "capa-lejos": [
      { n: 34, tam: [2, 3.5], dur: [18, 28], op: 0.5, ax: [4, 10] },
      { n: 5, tam: [9, 13], dur: [18, 28], op: 0.5, ax: [6, 14], cristal: true },
    ],
    "capa-media": [
      { n: 20, tam: [4, 6], dur: [11, 17], op: 0.7, ax: [10, 22] },
      { n: 5, tam: [14, 18], dur: [11, 17], op: 0.65, ax: [12, 26], cristal: true },
    ],
    "capa-cerca": [
      { n: 4, tam: [9, 15], dur: [7, 11], op: 0.45, ax: [20, 40] },
      { n: 3, tam: [16, 24], dur: [9, 14], op: 0.6, ax: [20, 40], cristal: true },
    ],
  };
  capas.forEach((capa) => {
    sembrar(capa, CAPAS_COPOS[[...capa.classList].find((k) => CAPAS_COPOS[k])]);
  });

  // Nieve del calendario: se crea al entrar y se quita al volver a la puerta
  // (así no gasta nada mientras se ve la portada). Va siempre por detrás de las casillas.
  const nieve = $("#nieve");
  function nevar() {
    if (nieve.childElementCount) return;
    sembrar(nieve, [
      { n: 22, tam: [2, 3.5], dur: [20, 30], op: 0.55, ax: [4, 10] },
      { n: 14, tam: [4, 7], dur: [12, 18], op: 0.85, ax: [10, 22] },
      { n: 6, tam: [9, 13], dur: [20, 30], op: 0.6, ax: [6, 14], cristal: true },
      { n: 6, tam: [14, 20], dur: [12, 18], op: 0.8, ax: [12, 26], cristal: true },
      { n: 4, tam: [18, 26], dur: [11, 16], op: 0.7, ax: [20, 36], cristal: true },
    ]);
  }

  // ------------------------------------------------------------
  //  Portada en 3D: cámara que avanza por el eje Z
  //  ----------------------------------------------------------
  //  Cada elemento vive a una profundidad z (z>0 = más cerca de la cámara).
  //  Su escala proyectada es s = P / (P - zrel), con zrel = z - camZ.
  //  El parallax sale solo de esa fórmula: lo lejano apenas cambia y lo
  //  cercano crece y se desplaza deprisa.
  //  · Texto y puerta NO se escalan con transform (se pixelarían): se
  //    redimensionan con --zoom (font-size / ancho en px reales).
  //  · Cada elemento se oculta justo antes de cruzar la cámara (NEAR_CUT).
  //  · Cámara y ratón se interpolan cada frame (lerp) para que sea fluido.
  // ------------------------------------------------------------
  const P = 1000;
  const NEAR_CUT = 0.97 * P;
  const CAM_FIN = 0.985 * P; // la cámara acaba justo dentro del hueco de la puerta
  const DUR_DOLLY = reducido ? 1 : 4200;
  const PUNTOS_Z = -2200;
  const RATON_PAN = 70; // px de desplazamiento de cámara con el ratón

  const escala = (zrel) => P / (P - zrel);
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const curvaSuave = (t) => t * t * (3 - 2 * t);
  // Tramo del viaje (0–1) en el que el velo granate cubre la pantalla al cruzar el hueco
  // Debe estar completo antes de que la puerta se recorte al pasar la cámara (~0,84): si no,
  // asoma el fondo verde. El viaje termina en VELO_HASTA (el resto quedaría tapado).
  const VELO_DESDE = 0.6;
  const VELO_HASTA = 0.82;
  const suavizar = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  // fundido entre dos zrel (fracciones de P)
  const fundido = (zrel, desde, hasta) => 1 - clamp01((zrel / P - desde) / (hasta - desde));

  const capas3d = [
    { el: capas[0], z: -1400, tipo: "capa" },
    { el: capas[1], z: -550, tipo: "capa" },
    { el: $(".portada-texto"), z: 180, tipo: "dolly", fade: [0.55, 0.85] },
    // La puerta se repinta nítida hasta ZOOM_MAX; a partir de ahí (ya desbordando la
    // pantalla) el resto lo escala la GPU, que no repinta y no da tirones.
    { el: puerta, z: 0, tipo: "dolly", zoomMax: 3.5 },
    { el: $(".portada-cta"), z: 180, tipo: "dolly", fade: [0.45, 0.75] },
    { el: capas[2], z: 380, tipo: "capa", fade: [0.6, 0.9] },
  ];

  const cam = { x: 0, y: 0, z: 0 };
  const objetivoPuerta = { x: 0, y: 0 };
  let ratonX = 0;
  let ratonY = 0;
  let dolly = null; // { inicio, resolver }
  let progresoDolly = 0;
  let rafPortada = 0;
  let animando = false;

  // Mide la posición inicial (en el layout normal) de cada elemento y la pasa a
  // coordenadas de mundo; luego activa el modo 3D (posicionado desde el centro).
  function medir() {
    portada.classList.remove("modo3d");
    capas3d.forEach((c) => {
      c.el.style.removeProperty("--zoom");
      c.el.style.translate = "";
      c.el.style.transform = "";
    });
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    capas3d.forEach((c) => {
      c.s0 = escala(c.z);
      if (c.tipo === "capa") {
        c.wx = 0;
        c.wy = 0;
        return;
      }
      const r = c.el.getBoundingClientRect();
      c.wx = (r.left + r.width / 2 - cx) / c.s0;
      c.wy = (r.top + r.height / 2 - cy) / c.s0;
    });
    const r = puerta.getBoundingClientRect();
    objetivoPuerta.x = r.left + r.width / 2 - cx;
    objetivoPuerta.y = r.top + r.height * 0.56 - cy; // centro del hueco
    portada.classList.add("modo3d");
  }

  function pintarEscena() {
    capas3d.forEach((c) => {
      const zrel = c.z - cam.z;
      if (zrel > NEAR_CUT) {
        if (c.el.style.visibility !== "hidden") c.el.style.visibility = "hidden";
        return;
      }
      if (c.el.style.visibility) c.el.style.visibility = "";
      const s = escala(zrel);
      const r = s / c.s0;
      const x = (c.wx - cam.x) * s;
      const y = (c.wy - cam.y) * s;
      if (c.tipo === "capa") {
        c.el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${r.toFixed(4)})`;
      } else {
        c.el.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`;
        const zoom = c.zoomMax ? Math.min(r, c.zoomMax) : r;
        c.el.style.setProperty("--zoom", zoom.toFixed(4));
        if (c.zoomMax) {
          c.el.style.transform = r > zoom ? `translate(-50%, -50%) scale(${(r / zoom).toFixed(4)})` : "";
        }
      }
      if (c.fade) c.el.style.opacity = fundido(zrel, ...c.fade).toFixed(3);
    });

    // Fondo de puntos: plano muy lejano. Se escala con background-size (nítido).
    const sp = escala(PUNTOS_Z - cam.z);
    const rp = sp / escala(PUNTOS_Z);
    // Fondo de puntos: solo transform (capa en GPU, sin repintar). Crece poco
    // (máx. ~1,45x), así que los puntos siguen nítidos.
    bgDots.style.transform = `translate3d(${(-cam.x * sp).toFixed(2)}px, ${(-cam.y * sp).toFixed(2)}px, 0) scale(${rp.toFixed(4)})`;

    // Al cruzar el hueco, la luz del interior se va apagando hacia el granate del calendario
    // (velo). Va por tiempo, con curva suave en los dos extremos, y mientras la cámara aún avanza.
    const velo = curvaSuave(clamp01((progresoDolly - VELO_DESDE) / (VELO_HASTA - VELO_DESDE)));
    destello.style.opacity = velo.toFixed(3);
    // Fuera del DOM pintado mientras no se usa: Safari en iPhone lo leería como color de sus barras
    destello.style.display = velo > 0.001 ? "block" : "none";
    if (velo > 0.001) tenirBarras(velo);
    else if (barrasTenidas) tenirBarras(null);
  }

  function bucle(t) {
    rafPortada = requestAnimationFrame(bucle);

    if (dolly) {
      if (dolly.inicio == null) dolly.inicio = t;
      progresoDolly = clamp01((t - dolly.inicio) / DUR_DOLLY);
    }
    const u = suavizar(progresoDolly);

    // Objetivo de cámara: el ratón (paneo; la escena va en sentido contrario al
    // cursor) se va sustituyendo por el centro del hueco según avanza el viaje.
    const tx = ratonX * RATON_PAN * (1 - u) + objetivoPuerta.x * u;
    const ty = ratonY * RATON_PAN * (1 - u) + objetivoPuerta.y * u;
    const k = dolly ? 0.08 + 0.92 * u : 0.06;
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k;
    cam.z = -CAM_FIN * u;

    pintarEscena();

    if (dolly && progresoDolly >= VELO_HASTA) {
      const fin = dolly.resolver;
      dolly = null;
      fin();
    }
  }

  function arrancarPortada() {
    cancelAnimationFrame(rafPortada);
    rafPortada = requestAnimationFrame(bucle);
  }

  function pararPortada() {
    cancelAnimationFrame(rafPortada);
    rafPortada = 0;
  }

  function reiniciarCamara() {
    progresoDolly = 0;
    dolly = null;
    cam.x = cam.y = cam.z = 0;
    capas3d.forEach((c) => {
      c.el.style.opacity = "";
      c.el.style.visibility = "";
    });
  }

  // Medir cuando las fuentes estén cargadas (cambian el tamaño del texto)
  (document.fonts?.ready || Promise.resolve()).then(() => {
    medir();
    pintarEscena();
    arrancarPortada();
  });

  window.addEventListener("resize", () => {
    if (portada.hidden || animando) return;
    medir();
    pintarEscena();
  });

  // ------------------------------------------------------------
  //  Secuencia de entrada: toc-toc → puertas → viaje de cámara
  // ------------------------------------------------------------
  // "Saltar intro" siempre que la puerta esté abierta (desde el 1 de diciembre, también
  // la primera vez); mientras dura la cuenta atrás lo esconde pintarCuenta
  const puedeSaltar = () => true;
  btnSaltar.hidden = false;

  // ------------------------------------------------------------
  //  Cuenta atrás: antes del 1 de diciembre la puerta sigue cerrada
  // ------------------------------------------------------------
  const kickerPortada = $(".portada .kicker");
  const ctaPortada = $(".portada-cta");
  const textoKicker = kickerPortada.textContent;
  const textoCta = ctaPortada.textContent;
  const ariaPuerta = puerta.getAttribute("aria-label");
  let puertaCerrada = false;
  let relojCuenta = null;

  const dos = (v) => String(v).padStart(2, "0");
  function pintarCuenta() {
    const resta = fechaDia(1) - ahora();
    if (resta <= 0 || (modoPrueba && !hoySimulado)) {
      // Ya es diciembre: la portada vuelve a ser la de siempre
      puertaCerrada = false;
      clearInterval(relojCuenta);
      relojCuenta = null;
      kickerPortada.textContent = textoKicker;
      ctaPortada.textContent = textoCta;
      ctaPortada.classList.remove("cuenta");
      puerta.setAttribute("aria-label", ariaPuerta);
      if (puedeSaltar()) btnSaltar.hidden = false;
      return;
    }
    puertaCerrada = true;
    btnSaltar.hidden = true;
    const seg = Math.floor(resta / 1000);
    const d = Math.floor(seg / 86400);
    const h = Math.floor((seg % 86400) / 3600);
    const m = Math.floor((seg % 3600) / 60);
    const sg = seg % 60;
    const bloque = (num, txt) => `<span class="cuenta-bloque"><b>${num}</b><small>${txt}</small></span>`;
    kickerPortada.textContent = "Diciembre está a punto de llegar";
    ctaPortada.classList.add("cuenta");
    ctaPortada.innerHTML =
      `<span class="cuenta-titulo">La puerta se abre en</span><span class="cuenta-reloj">` +
      (d > 0 ? bloque(d, d === 1 ? "día" : "días") : "") +
      bloque(dos(h), "horas") + bloque(dos(m), "min") + bloque(dos(sg), "seg") +
      `</span>`;
    puerta.setAttribute("aria-label", "La puerta se abre el 1 de diciembre");
  }
  pintarCuenta();
  if (puertaCerrada) relojCuenta = setInterval(pintarCuenta, 1000);

  // Si llama antes de tiempo, la puerta solo tiembla
  let avisoCerrada = 0;
  function llamarAntesDeTiempo() {
    sacudirPuerta(0);
    setTimeout(() => sacudirPuerta(1), 260);
    const frases = [
      "Todavía no… vuelve el 1 de diciembre 🎄",
      "Paciencia, que aún no es diciembre ✨",
      "La puerta sigue cerrada con llave 🔒",
    ];
    mostrarToast(frases[avisoCerrada++ % frases.length]);
  }

  // Impacto de un nudillo: la puerta cede de golpe y vuelve con un pequeño rebote
  const marcoPuerta = $(".puerta-marco");
  function sacudirPuerta(i) {
    const f = [1, 0.8, 0.95, 0.75][i] ?? 0.8;
    marcoPuerta.animate(
      [
        { transform: "translateX(0) rotate(0deg)" },
        { transform: `translateX(${-3.6 * f}px) rotate(${-0.5 * f}deg)`, offset: 0.1 },
        { transform: `translateX(${1.7 * f}px) rotate(${0.22 * f}deg)`, offset: 0.42 },
        { transform: `translateX(${-0.6 * f}px) rotate(${-0.06 * f}deg)`, offset: 0.7 },
        { transform: "translateX(0) rotate(0deg)" },
      ],
      { duration: 240, easing: "ease-out" }
    );
  }

  async function entrar() {
    if (animando) return;
    animando = true;
    btnSaltar.hidden = true;

    // Los móviles solo dejan arrancar audio dentro de un toque: se desbloquea ahora
    // para que la música pueda empezar sola cuando termine la animación.
    Sonido.desbloquear();

    // El calendario se monta ya (sigue oculto): al final del viaje solo hay que mostrarlo
    pintarRejilla(700);
    rejillaLista = true;

    // 1. Llamar a la puerta: cada golpe del audio sacude la puerta en su instante exacto
    await Sonido.llamar(sacudirPuerta);

    // 2. Se abren las hojas (2 s); el viaje empieza cuando van por la mitad
    puerta.classList.add("abierta");
    portada.classList.add("viajando");
    Sonido.abrir();
    await esperar(1100);

    // 3. La cámara avanza hacia el hueco
    await new Promise((resolver) => {
      dolly = { inicio: null, resolver };
    });

    store.set("adviento-visto", "1");
    mostrarCalendario({ conDestello: true });
  }

  let rejillaLista = false;

  function mostrarCalendario({ conDestello = false } = {}) {
    pararPortada();
    if (conDestello) {
      // El velo granate cubre la pantalla mientras se cambia de pantalla por debajo
      destello.style.display = "block";
      destello.style.opacity = "1";
      tenirBarras(null);
    }
    portada.hidden = true;
    calendario.hidden = false;
    document.body.classList.add("en-calendario");
    // Con velo, el scroll de 1 px para Safari se deja para cuando se retira (fin)
    colorBarras("--fondo-cal", true, { remuestrear: !conDestello });
    window.scrollTo(0, 0);

    // El fondo de puntos vuelve a su estado normal para el parallax del calendario
    bgDots.style.transform = "";

    if (!rejillaLista) pintarRejilla(100);
    rejillaLista = false;
    animando = false;

    // La música empieza al entrar (viene de un clic, así que el navegador la deja sonar)
    Sonido.musica.iniciar();
    nevar();

    const animarEntrada = () => {
      bgDots.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reducido ? 1 : 1400, easing: "ease-out" });
      cabecera.animate(
        [
          { opacity: 0, transform: "translateY(-30px) scale(1.04)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: reducido ? 1 : 1400, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
      );
      // El botón de música aparece con el calendario, no de golpe
      btnSonido.hidden = false;
      btnSonido.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: reducido ? 1 : 1200,
        delay: conDestello && !reducido ? 600 : 0,
        fill: "backwards",
      });
      if (!conDestello) return;

      // El velo se retira despacio: es del mismo granate que el fondo, así que no hay cambio
      // de color, solo aparecen el calendario, las luces y la nieve que hay debajo.
      // La opacidad en línea sigue a 1 hasta el final (Safari tarda un frame en aplicar una
      // animación nueva; si estuviera ya a 0 se vería un parpadeo).
      const fin = () => {
        destello.style.display = "none";
        destello.style.opacity = "0";
        destello.getAnimations().forEach((a) => a.cancel());
        reavivarBarras();
      };
      destello
        .animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: reducido ? 1 : 1700,
          easing: "cubic-bezier(0.45, 0, 0.55, 1)",
          fill: "forwards",
        })
        .finished.then(fin, fin);
      calendario.animate(
        [
          { opacity: 0, transform: "scale(0.94)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: reducido ? 1 : 2000, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" }
      );
    };

    if (conDestello) {
      // Dos frames de margen: se pinta el calendario ya montado (bajo el velo) y luego se retira
      requestAnimationFrame(() => requestAnimationFrame(animarEntrada));
    } else {
      destello.style.opacity = "0";
      animarEntrada();
    }
  }

  function volverAPuerta() {
    Sonido.musica.parar();
    btnSonido.hidden = true;
    nieve.replaceChildren();
    puerta.classList.remove("abierta");
    portada.classList.remove("viajando");
    calendario.hidden = true;
    portada.hidden = false;
    document.body.classList.remove("en-calendario");
    tenirBarras(null);
    colorBarras("--fondo-portada", false);
    if (!puertaCerrada) btnSaltar.hidden = false;
    window.scrollTo(0, 0);
    reiniciarCamara();
    medir();
    pintarEscena();
    arrancarPortada();
  }

  // Botón de música (esquina inferior izquierda)
  const btnSonido = $("#sonido");
  const pintarBtnSonido = () => {
    const on = Sonido.musica.activa();
    btnSonido.classList.toggle("off", !on);
    btnSonido.setAttribute("aria-pressed", String(on));
    btnSonido.setAttribute("aria-label", on ? "Silenciar la música" : "Activar la música");
  };
  btnSonido.addEventListener("click", () => Sonido.musica.alternar());
  document.addEventListener("sonido-cambio", pintarBtnSonido);
  pintarBtnSonido();

  puerta.addEventListener("click", () => (puertaCerrada ? llamarAntesDeTiempo() : entrar()));
  btnSaltar.addEventListener("click", () => {
    if (animando || puertaCerrada) return;
    mostrarCalendario();
  });
  $("#volver").addEventListener("click", volverAPuerta);

  // ------------------------------------------------------------
  //  Rejilla del calendario
  // ------------------------------------------------------------
  // Orden "aleatorio" fijo, tamaño y color de cada casilla.
  // En 6 columnas rellena exactamente 6 filas.
  const DISPOSICION = [
    [7, "c-rosado"], [15, "c-granate"], [1, "c-rojo w2"], [22, "c-crema"], [10, "c-rojo"],
    [24, "nochebuena w2 h2"], [4, "c-crema"], [13, "c-rosado h2"], [9, "c-rojo w2"],
    [20, "c-granate"], [18, "c-rosado"], [2, "c-crema"],
    [14, "c-granate h2"], [11, "c-rojo"], [3, "c-crema"], [17, "c-granate"], [5, "c-rojo w2"],
    [19, "gran-dia w2 h2"], [12, "c-crema"], [16, "c-rosado w2"],
    [8, "c-crema"], [6, "c-rojo"], [23, "c-granate"], [21, "c-crema"],
  ];

  // Días especiales: llevan etiqueta (texto de config.js → especiales). El aspecto lo da
  // la clase en DISPOSICION: "gran-dia" = dorada con lazo (19), "nochebuena" = granate con gorro (24).
  const ESPECIALES = CFG.especiales || {};

  const LAZO_SVG = `
    <svg class="lazo" viewBox="0 0 120 72" aria-hidden="true">
      <g fill="#f8f4ef" stroke="#d8cdc0" stroke-width="1.6" stroke-linejoin="round">
        <path d="M57 44 L40 71 L49 68 L60 47Z"/>
        <path d="M63 44 L80 71 L71 68 L60 47Z"/>
        <path d="M60 38 C42 8, 6 6, 10 30 C13 50, 44 46, 60 38Z"/>
        <path d="M60 38 C78 8, 114 6, 110 30 C107 50, 76 46, 60 38Z"/>
        <ellipse cx="60" cy="39" rx="9" ry="8.5"/>
      </g>
    </svg>`;

  // Gorro de Papá Noel que se coloca encima del número de la casilla "nochebuena"
  const GORRO_SVG = `
    <svg class="gorro" viewBox="0 0 100 80" aria-hidden="true">
      <defs>
        <linearGradient id="gorro-rojo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#f0473b"/><stop offset="1" stop-color="#a8161c"/>
        </linearGradient>
      </defs>
      <path d="M14 60 C18 34, 38 10, 64 10 C79 10, 89 21, 91 35 L83 39 C80 30, 73 26, 67 29 C73 40, 78 50, 82 58 Z" fill="url(#gorro-rojo)"/>
      <path d="M30 40 C40 24, 52 17, 63 16" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="3" stroke-linecap="round"/>
      <rect x="7" y="53" width="83" height="18" rx="9" fill="#fbf7ef" transform="rotate(-3 48 62)"/>
      <circle cx="90" cy="39" r="9" fill="#fbf7ef"/>
    </svg>`;

  function pintarRejilla(retrasoBase) {
    rejilla.innerHTML = "";
    DISPOSICION.forEach(([n, clases], i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `casilla ${clases}`;
      b.dataset.dia = n;
      b.setAttribute("aria-label", `Día ${n}`);
      if (abiertos.has(n)) b.classList.add("abierta");
      if (esHoy(n)) b.classList.add("hoy");

      if (b.classList.contains("gran-dia")) {
        b.insertAdjacentHTML("beforeend", `<span class="cinta-v"></span><span class="cinta-h"></span>${LAZO_SVG}`);
      }
      if (ESPECIALES[n]) {
        b.insertAdjacentHTML("beforeend", `<span class="etiqueta"></span>`);
        $(".etiqueta", b).textContent = ESPECIALES[n];
        b.setAttribute("aria-label", `Día ${n}: ${ESPECIALES[n]}`);
      }
      const gorro = b.classList.contains("nochebuena") ? GORRO_SVG : "";
      b.insertAdjacentHTML("beforeend", `<span class="numero">${gorro}${n}</span><span class="marca" aria-hidden="true">✓</span>`);

      b.style.setProperty("--retraso", `${retrasoBase / 1000 + i * 0.045}s`);
      b.classList.add("entra");
      b.addEventListener(
        "animationend",
        () => {
          b.classList.remove("entra");
          b.classList.add("visible");
        },
        { once: true }
      );
      b.addEventListener("click", () => pulsarCasilla(b, n));
      rejilla.appendChild(b);
    });
  }

  // ------------------------------------------------------------
  //  Puertecita: al abrir un día, la casilla se abre y deja ver la luz de dentro; de ahí sale
  //  la tarjeta. Las casillas anchas (y el 19, que es un regalo) levantan la tapa hacia arriba;
  //  las estrechas se abren como una puerta con la bisagra en el lado más cercano al centro de
  //  la pantalla, para que la hoja nunca se salga por el borde.
  //  Es una copia de la casilla en position: fixed encima de ella; al cerrar la tarjeta se
  //  vuelve a cerrar y desaparece.
  // ------------------------------------------------------------
  let puertecita = null;
  let abriendoDia = false;

  function abrirPuertecita(el) {
    if (reducido) return;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const esTapa = el.classList.contains("gran-dia") || el.classList.contains("w2");
    const bisagraDcha = !esTapa && r.left + r.width / 2 < window.innerWidth / 2;
    // Al levantarse hacia ti, la tapa se ve más ancha por la perspectiva: cuanto más alta es,
    // más lejos va la cámara (así no crece más que el margen de la pantalla)
    const persp = esTapa ? Math.max(700, r.height * 9) : 700;
    const giro = (g) =>
      `perspective(${persp}px) ${esTapa ? `rotateX(${g}deg)` : `rotateY(${bisagraDcha ? g : -g}deg)`}`;

    const cont = document.createElement("div");
    cont.className = "puertecita";
    cont.setAttribute("aria-hidden", "true");
    Object.assign(cont.style, {
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
      borderRadius: cs.borderRadius,
    });
    cont.innerHTML = `<span class="puertecita-luz"></span><span class="puertecita-hoja"></span>`;
    const luz = cont.firstChild;
    const hoja = cont.lastChild;
    hoja.style.transformOrigin = esTapa ? "50% 0" : bisagraDcha ? "100% 50%" : "0 50%";

    // Cara de delante: la casilla tal cual estaba (sin marca de abierta ni halo de hoy)
    const cara = el.cloneNode(true);
    cara.classList.remove("hoy", "tiembla", "entra", "abierta");
    cara.removeAttribute("aria-label");
    cara.tabIndex = -1;
    cara.style.setProperty("--celda", cs.getPropertyValue("--celda"));
    cara.classList.add("puertecita-cara");
    // Cara de detrás: el mismo color, más oscuro (se ve cuando la hoja pasa de 90°)
    const dorso = document.createElement("span");
    dorso.className = "puertecita-dorso" + (esTapa ? " tapa" : "");
    dorso.style.backgroundColor = cs.backgroundColor;
    dorso.style.backgroundImage = cs.backgroundImage;
    hoja.append(cara, dorso);

    document.body.appendChild(cont);
    el.style.visibility = "hidden";

    const opciones = { duration: 700, easing: "cubic-bezier(0.3, 0.7, 0.2, 1)", fill: "forwards" };
    hoja.animate(
      [
        { transform: giro(0) },
        { transform: giro(-6), offset: 0.12 }, // pequeño tirón antes de abrirse
        { transform: giro(118) },
      ],
      opciones
    );
    luz.animate([{ opacity: 0, transform: "scale(0.6)" }, { opacity: 1, transform: "none" }], {
      ...opciones,
      duration: 600,
      delay: 80,
      fill: "both",
    });
    puertecita = { cont, hoja, luz, el, giro };
  }

  async function cerrarPuertecita() {
    const p = puertecita;
    puertecita = null;
    if (!p) return;
    const opciones = { duration: 420, easing: "cubic-bezier(0.5, 0, 0.75, 0)", fill: "forwards" };
    p.luz.animate([{ opacity: 1 }, { opacity: 0 }], opciones);
    await p.hoja
      .animate([{ transform: p.giro(118) }, { transform: p.giro(0) }], opciones)
      .finished.catch(() => {});
    p.el.style.visibility = "";
    p.cont.remove();
    // Al volver a cerrarse la puertecita, la casilla se apaga despacio y aparece el ✓
    p.el.classList.remove("recien-abierta");
    void p.el.offsetWidth;
    p.el.classList.add("recien-abierta");
    p.el.querySelector(".marca")?.addEventListener("animationend", () => p.el.classList.remove("recien-abierta"), { once: true });
  }

  async function pulsarCasilla(el, n) {
    if (!el.classList.contains("visible") || abriendoDia || modal.open) return;
    if (!disponible(n)) {
      el.classList.remove("tiembla");
      void el.offsetWidth;
      el.classList.add("tiembla");
      el.addEventListener("animationend", () => el.classList.remove("tiembla"), { once: true });
      const f = diasQueFaltan(n);
      const msg =
        f <= 1 ? "Aún no… ¡vuelve mañana! ✨" : `Aún no, paciencia ✨ Faltan ${f} días`;
      mostrarToast(msg);
      return;
    }
    abriendoDia = true;
    abrirPuertecita(el); // antes de marcarla: la hoja es la casilla sin abrir
    marcarAbierto(n);
    el.classList.add("abierta");
    // La tarjeta sale de la luz cuando la puerta va por la mitad
    if (puertecita) await esperar(380);
    abrirModal(n, el);
    // Cumpleaños: confeti cuando la tarjeta termina de salir
    if (el.classList.contains("gran-dia")) setTimeout(Confeti.lanzar, 280);
    abriendoDia = false;
  }

  // ------------------------------------------------------------
  //  Confeti (día del cumpleaños): dos ráfagas desde las esquinas de abajo que suben,
  //  giran y caen revoloteando. Es un <canvas> en popover para quedar en la "capa superior"
  //  por encima de la tarjeta (un <dialog> abierto tapa cualquier z-index normal).
  // ------------------------------------------------------------
  const Confeti = (() => {
    const COLORES = ["#f6d77c", "#e9b949", "#c9902c", "#ffe9a8", "#fbf7ef", "#e5392f", "#8e1b2e"];
    let lienzo, ctx, w, h, raf = 0, ultimo = 0;
    let piezas = [];

    function preparar() {
      if (lienzo) return;
      lienzo = document.createElement("canvas");
      lienzo.className = "confeti";
      lienzo.setAttribute("aria-hidden", "true");
      if ("popover" in HTMLElement.prototype) lienzo.popover = "manual";
      document.body.appendChild(lienzo);
      ctx = lienzo.getContext("2d");
    }

    function medir() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      lienzo.width = Math.round(w * dpr);
      lienzo.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Lo vuelve a poner encima de todo (si el diálogo se abrió después, quedaría debajo)
    function alFrente() {
      if (!lienzo.popover) return;
      try {
        if (lienzo.matches(":popover-open")) lienzo.hidePopover();
        lienzo.showPopover();
      } catch {}
    }

    function rafaga(x, y, angulo, cuantas, fuerza) {
      for (let i = 0; i < cuantas; i++) {
        const a = angulo + (Math.random() - 0.5) * 0.9;
        const v = fuerza * (0.55 + Math.random() * 0.6);
        piezas.push({
          x, y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          giro: Math.random() * Math.PI * 2,
          vgiro: (Math.random() - 0.5) * 0.3,
          fase: Math.random() * Math.PI * 2, // volteo (da la sensación de papel que gira)
          vfase: 0.08 + Math.random() * 0.12,
          tam: 7 + Math.random() * 6,
          redonda: Math.random() < 0.25,
          color: COLORES[(Math.random() * COLORES.length) | 0],
          vida: 0,
        });
      }
    }

    function paso(t) {
      const dt = Math.min(2.5, (t - ultimo) / 16.67);
      ultimo = t;
      ctx.clearRect(0, 0, w, h);
      piezas = piezas.filter((p) => p.y < h + 30 && p.vida < 420);
      const roce = Math.pow(0.985, dt);
      for (const p of piezas) {
        p.vx *= roce;
        p.vy = Math.min(p.vy * roce + 0.32 * dt, 3.2); // al caer, planea (velocidad límite)
        p.x += (p.vx + Math.sin(p.fase) * 0.9) * dt;
        p.y += p.vy * dt;
        p.giro += p.vgiro * dt;
        p.fase += p.vfase * dt;
        p.vida += dt;
        ctx.save();
        ctx.globalAlpha = Math.min(1, (420 - p.vida) / 60);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.giro);
        ctx.scale(1, Math.cos(p.fase));
        ctx.fillStyle = p.color;
        if (p.redonda) {
          ctx.beginPath();
          ctx.arc(0, 0, p.tam * 0.36, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.tam / 2, -p.tam * 0.3, p.tam, p.tam * 0.6);
        }
        ctx.restore();
      }
      if (piezas.length) {
        raf = requestAnimationFrame(paso);
      } else {
        raf = 0;
        ctx.clearRect(0, 0, w, h);
        try { if (lienzo.popover) lienzo.hidePopover(); } catch {}
      }
    }

    function lanzar() {
      Sonido.confeti();
      preparar();
      medir();
      alFrente();
      const fuerza = Math.max(h, 560) * 0.04;
      const cuantas = w < 600 ? 80 : 120;
      rafaga(-10, h + 10, -Math.PI / 3, cuantas, fuerza); // esquina izquierda, hacia arriba y al centro
      rafaga(w + 10, h + 10, (-2 * Math.PI) / 3, cuantas, fuerza); // esquina derecha
      if (!raf) {
        ultimo = performance.now();
        raf = requestAnimationFrame(paso);
      }
    }

    return { lanzar };
  })();

  // ------------------------------------------------------------
  //  Modal del día
  // ------------------------------------------------------------
  const NOMBRES_TIPO = { foto: "una foto", video: "un vídeo", cancion: "una canción" };

  function parrafo(texto) {
    const p = document.createElement("p");
    p.textContent = texto;
    return p;
  }

  function pendiente(tipo) {
    const d = document.createElement("div");
    d.className = "pendiente";
    d.textContent = `Aquí irá ${NOMBRES_TIPO[tipo] || "el contenido"}.`;
    return d;
  }

  function idYoutube(url) {
    const m = url.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/);
    return m ? m[1] : null;
  }

  function construirContenido(dia) {
    const frag = document.createDocumentFragment();
    const { tipo = "texto", texto, src } = dia;

    if (tipo === "vale") {
      const v = document.createElement("div");
      v.className = "vale";
      v.innerHTML = `<div class="vale-etiqueta">Vale</div><p class="vale-titulo"></p>`;
      $(".vale-titulo", v).textContent = dia.titulo || "";
      frag.appendChild(v);
      if (texto) frag.appendChild(parrafo(texto));
      return frag;
    }

    if (texto) frag.appendChild(parrafo(texto));

    if (tipo === "foto") {
      if (!src) return frag.appendChild(pendiente(tipo)), frag;
      const img = document.createElement("img");
      img.src = src;
      img.alt = dia.titulo || "Foto";
      img.loading = "lazy";
      frag.appendChild(img);
    } else if (tipo === "video") {
      if (!src) return frag.appendChild(pendiente(tipo)), frag;
      const id = idYoutube(src);
      if (id) {
        const f = document.createElement("iframe");
        f.className = "yt";
        f.src = `https://www.youtube-nocookie.com/embed/${id}`;
        f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
        f.allowFullscreen = true;
        frag.appendChild(f);
      } else {
        const v = document.createElement("video");
        v.src = src;
        v.controls = true;
        v.playsInline = true;
        frag.appendChild(v);
      }
    } else if (tipo === "cancion") {
      if (!src) return frag.appendChild(pendiente(tipo)), frag;
      const m = src.match(/open\.spotify\.com\/(?:intl-\w+\/)?(track|album|playlist|episode)\/(\w+)/);
      if (m) {
        const f = document.createElement("iframe");
        f.src = `https://open.spotify.com/embed/${m[1]}/${m[2]}`;
        f.height = m[1] === "track" ? "152" : "352";
        f.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
        f.loading = "lazy";
        frag.appendChild(f);
      } else {
        const a = document.createElement("a");
        a.href = src;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = "Escuchar la canción";
        frag.appendChild(a);
      }
    }
    return frag;
  }

  let casillaOrigen = null;

  function abrirModal(n, el) {
    const dia = CFG.dias[n] || { tipo: "texto", titulo: `Día ${n}`, texto: "" };
    casillaOrigen = el;
    $(".modal-dia", modal).textContent = ESPECIALES[n] ? `${n} de diciembre · ${ESPECIALES[n]}` : `${n} de diciembre`;
    $(".modal-titulo", modal).textContent = dia.tipo === "vale" ? "Tienes un vale" : dia.titulo || `Día ${n}`;
    $(".modal-num", modal).textContent = n;
    // Postal del mismo color que su casilla
    const c = el?.classList;
    modal.dataset.tema = !c ? "crema"
      : c.contains("gran-dia") ? "oro"
      : c.contains("nochebuena") ? "nochebuena"
      : c.contains("c-rojo") ? "rojo"
      : c.contains("c-granate") ? "granate"
      : c.contains("c-rosado") ? "rosado"
      : "crema";
    const cuerpo = $(".modal-cuerpo", modal);
    cuerpo.replaceChildren(construirContenido(dia));

    modal.showModal();
    document.body.classList.add("bloqueado-scroll");
    animarDesdeCasilla(false);
  }

  function animarDesdeCasilla(inverso) {
    if (reducido || !casillaOrigen) return Promise.resolve();
    const t = casillaOrigen.getBoundingClientRect();
    const m = modal.getBoundingClientRect();
    const dx = t.left + t.width / 2 - (m.left + m.width / 2);
    const dy = t.top + t.height / 2 - (m.top + m.height / 2);
    const s = Math.max(0.15, t.width / m.width);
    const desde = { transform: `perspective(900px) translate(${dx}px, ${dy}px) scale(${s}) rotateX(25deg)`, opacity: 0.2 };
    const hasta = { transform: "perspective(900px) translate(0, 0) scale(1) rotateX(0deg)", opacity: 1 };
    return modal
      .animate(inverso ? [hasta, desde] : [desde, hasta], {
        duration: inverso ? 320 : 520,
        easing: inverso ? "cubic-bezier(0.5, 0, 0.8, 0.4)" : "cubic-bezier(0.2, 0.9, 0.25, 1.05)",
      })
      .finished.catch(() => {});
  }

  let cerrando = false;
  async function cerrarModal() {
    if (cerrando || !modal.open) return;
    cerrando = true;
    await animarDesdeCasilla(true);
    modal.close();
    cerrando = false;
  }

  modal.addEventListener("close", async () => {
    $(".modal-cuerpo", modal).replaceChildren(); // detiene vídeos/música
    document.body.classList.remove("bloqueado-scroll");
    await cerrarPuertecita();
    casillaOrigen?.focus({ preventScroll: true });
  });
  modal.addEventListener("cancel", (e) => {
    e.preventDefault();
    cerrarModal();
  });
  modal.addEventListener("click", (e) => {
    if (e.target === modal) cerrarModal();
  });
  $(".modal-cerrar", modal).addEventListener("click", cerrarModal);

  // ------------------------------------------------------------
  //  Toast
  // ------------------------------------------------------------
  let toastTimer;
  function mostrarToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("visible"), 2400);
  }

  // ------------------------------------------------------------
  //  Parallax: el fondo y la cabecera se mueven más lento que la rejilla,
  //  y el fondo sigue un poco al ratón.
  // ------------------------------------------------------------
  let rafPendiente = false;

  // En la portada el fondo lo mueve la cámara 3D; esto es solo para el calendario.
  function actualizarParallax() {
    rafPendiente = false;
    if (reducido || calendario.hidden) return;
    const y = window.scrollY;
    bgDots.style.transform = `translate(${ratonX * -14}px, ${-y * 0.18 + ratonY * -14}px)`;
    cabecera.style.transform = `translateY(${y * 0.38}px)`;
    cabecera.style.opacity = String(Math.max(0, 1 - y / 520));
  }

  function pedirParallax() {
    if (!rafPendiente) {
      rafPendiente = true;
      requestAnimationFrame(actualizarParallax);
    }
  }

  window.addEventListener("scroll", pedirParallax, { passive: true });
  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse") return;
      ratonX = e.clientX / window.innerWidth - 0.5;
      ratonY = e.clientY / window.innerHeight - 0.5;
      pedirParallax();
    },
    { passive: true }
  );

  // Diagnóstico: abre la web con ?debug para ver qué detecta el navegador
  if (params.has("debug")) {
    const caja = document.createElement("pre");
    caja.style.cssText =
      "position:fixed;left:8px;top:8px;z-index:99;margin:0;padding:8px 10px;border-radius:8px;" +
      "background:rgba(0,0,0,.8);color:#9f9;font:12px/1.4 monospace;pointer-events:none";
    document.body.appendChild(caja);
    let frames = 0;
    let ultimo = performance.now();
    let fps = 0;
    const tick = (t) => {
      frames++;
      if (t - ultimo >= 500) {
        fps = Math.round((frames * 1000) / (t - ultimo));
        frames = 0;
        ultimo = t;
        caja.textContent =
          `version: v5
movimiento reducido (sistema): ${reducidoSistema}
` +
          `fps: ${fps}
camara z: ${cam.z.toFixed(0)}  progreso: ${(progresoDolly * 100).toFixed(0)}%
` +
          `duracion viaje: ${DUR_DOLLY} ms
${navigator.userAgent.match(/(Edg|Chrome|Firefox)\/[\d.]+/g)?.join(" ")}`;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  if (modoPrueba) {
    const aviso = hoySimulado ? `Modo prueba · simulando ${params.get("hoy")}` : "Modo prueba · todo desbloqueado";
    mostrarToast(params.has("borrar") ? `${aviso} · abiertos borrados` : aviso);
  }
})();
