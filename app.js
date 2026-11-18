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
  const CLAVE_ABIERTOS = "adviento-abiertos-" + CFG.anio;
  const abiertos = new Set(modoPrueba ? [] : JSON.parse(store.get(CLAVE_ABIERTOS) || "[]"));
  function marcarAbierto(n) {
    abiertos.add(n);
    if (!modoPrueba) store.set(CLAVE_ABIERTOS, JSON.stringify([...abiertos]));
  }

  // ------------------------------------------------------------
  //  Textos personalizados
  // ------------------------------------------------------------
  document.querySelectorAll("[data-de]").forEach((el) => (el.textContent = CFG.de));
  document.querySelectorAll("[data-para]").forEach((el) => (el.textContent = CFG.para));
  document.querySelectorAll("[data-dedicatoria]").forEach((el) => (el.textContent = CFG.dedicatoria));
  document.title = `Para ${CFG.para} · Calendario de Adviento`;

  // Decoración de la puerta: cada hoja recibe la corona y la placa completas
  // y su overflow muestra solo su mitad, así se parten al abrirse.
  document.querySelectorAll(".hoja-deco").forEach((deco) => {
    deco.innerHTML = `<span class="corona"></span><span class="placa"></span>`;
    $(".placa", deco).textContent = CFG.para;
  });

  // Copos de nieve: cuanto más cerca está la capa, más grandes y rápidos
  const capas = [...document.querySelectorAll(".capa")];
  const CAPAS_COPOS = {
    "capa-lejos": { n: 40, tam: [1.5, 3], dur: [22, 34] },
    "capa-media": { n: 24, tam: [3, 5], dur: [14, 22] },
    "capa-cerca": { n: 10, tam: [7, 12], dur: [8, 13] },
  };
  const azar = (a, b) => a + Math.random() * (b - a);
  capas.forEach((capa) => {
    const c = CAPAS_COPOS[[...capa.classList].find((k) => CAPAS_COPOS[k])];
    for (let i = 0; i < c.n; i++) {
      const s = document.createElement("span");
      const tam = azar(...c.tam);
      const dur = azar(...c.dur);
      s.className = "copo";
      s.style.cssText = `left:${azar(0, 100)}%;top:0;width:${tam}px;height:${tam}px;` +
        `animation-duration:${dur}s;animation-delay:${-azar(0, dur)}s;--deriva:${azar(-40, 40)}px`;
      capa.appendChild(s);
    }
  });

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

    // La luz del interior llena la pantalla al cruzar la puerta
    const sPuerta = escala(-cam.z);
    destello.style.opacity = clamp01((sPuerta - 12) / 24).toFixed(3);
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

    if (dolly && progresoDolly >= 1) {
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
  if (store.get("adviento-visto")) btnSaltar.hidden = false;

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

  function mostrarCalendario({ conDestello = false } = {}) {
    pararPortada();
    portada.hidden = true;
    calendario.hidden = false;
    document.body.classList.add("en-calendario");
    window.scrollTo(0, 0);

    // El fondo de puntos vuelve a su estado normal para el parallax del calendario
    bgDots.style.transform = "";
    bgDots.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reducido ? 1 : 1200, easing: "ease-out" });

    destello.style.opacity = "0";
    if (conDestello) {
      // La luz se disuelve y el calendario emerge desde dentro
      destello.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reducido ? 1 : 1600, easing: "ease-out" });
      calendario.animate(
        [
          { opacity: 0, transform: "scale(0.9)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: reducido ? 1 : 1800, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
      );
    }

    cabecera.animate(
      [
        { opacity: 0, transform: "translateY(-30px) scale(1.04)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: reducido ? 1 : 1200, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
    );

    pintarRejilla(conDestello ? 450 : 100);
    animando = false;

    // La música empieza al entrar (viene de un clic, así que el navegador la deja sonar)
    btnSonido.hidden = false;
    Sonido.musica.iniciar();
  }

  function volverAPuerta() {
    Sonido.musica.parar();
    btnSonido.hidden = true;
    puerta.classList.remove("abierta");
    portada.classList.remove("viajando");
    calendario.hidden = true;
    portada.hidden = false;
    document.body.classList.remove("en-calendario");
    btnSaltar.hidden = false;
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

  puerta.addEventListener("click", entrar);
  btnSaltar.addEventListener("click", () => {
    if (animando) return;
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
    [24, "gran-dia w2 h2"], [4, "c-crema"], [13, "c-rosado h2"], [9, "c-rojo w2"],
    [20, "c-granate"], [18, "c-rosado"], [2, "c-crema"],
    [14, "c-granate h2"], [11, "c-rojo"], [3, "c-crema"], [17, "c-granate"], [5, "c-rojo w2"],
    [19, "gran-dia w2 h2"], [12, "c-crema"], [16, "c-rosado w2"],
    [8, "c-crema"], [6, "c-rojo"], [23, "c-granate"], [21, "c-crema"],
  ];

  // Días con casilla dorada y lazo. El texto sale de config.js → especiales.
  const ESPECIALES = CFG.especiales || { 24: "El gran día" };

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

      if (ESPECIALES[n]) {
        b.innerHTML = `
          <span class="cinta-v"></span><span class="cinta-h"></span>
          ${LAZO_SVG}
          <span class="etiqueta"></span>`;
        $(".etiqueta", b).textContent = ESPECIALES[n];
        b.setAttribute("aria-label", `Día ${n}: ${ESPECIALES[n]}`);
      }
      b.insertAdjacentHTML("beforeend", `<span class="numero">${n}</span><span class="marca" aria-hidden="true">✓</span>`);

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

  function pulsarCasilla(el, n) {
    if (!el.classList.contains("visible")) return;
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
    marcarAbierto(n);
    el.classList.add("abierta");
    abrirModal(n, el);
  }

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

  modal.addEventListener("close", () => {
    $(".modal-cuerpo", modal).replaceChildren(); // detiene vídeos/música
    document.body.classList.remove("bloqueado-scroll");
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
    mostrarToast(hoySimulado ? `Modo prueba · simulando ${params.get("hoy")}` : "Modo prueba · todo desbloqueado");
  }
})();
