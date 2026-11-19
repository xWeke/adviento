// ============================================================
//  Audio del calendario (todo sintetizado con Web Audio, sin archivos)
//   · Sonido.llamar()   → nudillos en la puerta (grabación real; si falla, sintetizados)
//   · Sonido.abrir()    → crujido de bisagra + pestillo
//   · Sonido.confeti()  → dos lanzaconfeti + brillo de campanitas (día del cumpleaños)
//   · Sonido.musica     → caja de música navideña (o un mp3 propio, ver config.js)
// ============================================================
window.Sonido = (() => {
  "use strict";

  const CFG = window.CONFIG || {};
  const AC = window.AudioContext || window.webkitAudioContext;
  const CLAVE_MUTE = "adviento-musica-off";

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
  };

  // Se crea al cargar (suspendido): crearlo dentro del clic congela la página ~1 s
  // en algunos equipos Windows justo cuando arranca la animación.
  let ctx = null;
  try { ctx = AC ? new AC() : null; } catch { ctx = null; }
  // iPhone: que los sonidos de Web Audio suenen como la música aunque el móvil esté en
  // silencio (si no, al pasar la música por Web Audio para bajarla se callaría)
  try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch {}

  const azar = (a, b) => a + Math.random() * (b - a);
  const listo = () => {
    if (!ctx) return false;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return true;
  };

  // ----------------------------------------------------------
  //  Utilidades: reverb sintético y ruido
  // ----------------------------------------------------------
  function impulso(segundos, caida) {
    const n = Math.floor(ctx.sampleRate * segundos);
    const buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, caida);
    }
    return buf;
  }

  function ruido(segundos) {
    const n = Math.max(1, Math.floor(ctx.sampleRate * segundos));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // Los buses se montan la primera vez que hacen falta
  let salaPuerta = null; // eco corto de pasillo para los golpes
  let bus = null;        // música: gain → (seco + eco + reverb) → salida

  function montarPuerta() {
    if (salaPuerta) return salaPuerta;
    const entrada = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 3200;
    const conv = ctx.createConvolver();
    conv.buffer = impulso(0.45, 3);
    const mojado = ctx.createGain();
    mojado.gain.value = 0.22;
    entrada.connect(lp);
    lp.connect(ctx.destination);
    lp.connect(conv);
    conv.connect(mojado).connect(ctx.destination);
    salaPuerta = entrada;
    return entrada;
  }

  function montarBus() {
    if (bus) return bus;
    const entrada = ctx.createGain();
    entrada.gain.value = 0;
    // eco con realimentación suave
    const eco = ctx.createDelay(1);
    eco.delayTime.value = 0.34;
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    const lpEco = ctx.createBiquadFilter();
    lpEco.type = "lowpass";
    lpEco.frequency.value = 2600;
    const ecoVol = ctx.createGain();
    ecoVol.gain.value = 0.3;
    eco.connect(lpEco).connect(fb).connect(eco);
    lpEco.connect(ecoVol).connect(ctx.destination);
    // reverb de sala
    const conv = ctx.createConvolver();
    conv.buffer = impulso(2.2, 2.6);
    const rev = ctx.createGain();
    rev.gain.value = 0.38;
    entrada.connect(ctx.destination);
    entrada.connect(eco);
    entrada.connect(conv);
    conv.connect(rev).connect(ctx.destination);
    bus = entrada;
    return entrada;
  }

  // ----------------------------------------------------------
  //  Nudillos en la puerta
  //  Un golpe real de nudillo en madera es la suma de:
  //   1. un "thump" grave que cae rápido de tono (la hoja entera se mueve)
  //   2. un "tac" brevísimo y apagado (el hueso contra la madera)
  //   3. un par de resonancias inarmónicas de la madera, que se apagan solas
  // ----------------------------------------------------------
  function golpe(t, fuerza) {
    const salida = montarPuerta();
    const v = azar(0.9, 1.1); // cada golpe es un poco distinto

    // 1. thump grave
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(185 * v, t);
    o.frequency.exponentialRampToValueAtTime(62 * v, t + 0.11);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.95 * fuerza, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.24);
    o.connect(g).connect(salida);
    o.start(t);
    o.stop(t + 0.26);

    // 2. tac del nudillo
    const r = ctx.createBufferSource();
    r.buffer = ruido(0.06);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1150 * v;
    bp.Q.value = 1.3;
    const gr = ctx.createGain();
    gr.gain.setValueAtTime(0.0001, t);
    gr.gain.exponentialRampToValueAtTime(0.7 * fuerza, t + 0.0015);
    gr.gain.exponentialRampToValueAtTime(0.0008, t + 0.04);
    r.connect(bp).connect(gr).connect(salida);
    r.start(t);
    r.stop(t + 0.07);

    // 3. resonancias de la madera
    [[318, 0.22, 0.17], [547, 0.12, 0.11]].forEach(([f, vol, dur]) => {
      const os = ctx.createOscillator();
      os.type = "sine";
      os.frequency.value = f * v;
      const gs = ctx.createGain();
      gs.gain.setValueAtTime(0.0001, t);
      gs.gain.exponentialRampToValueAtTime(vol * fuerza, t + 0.003);
      gs.gain.exponentialRampToValueAtTime(0.0006, t + dur);
      os.connect(gs).connect(salida);
      os.start(t);
      os.stop(t + dur + 0.02);
    });
  }

  // Grabación real de unos nudillos (config.js → golpeArchivo). Se usa un <audio>
  // porque, a diferencia de fetch, funciona también abriendo index.html desde el disco.
  // Si el archivo no existe o no carga, se usa el golpe sintetizado de abajo.
  let golpeEl = null;
  const ARCHIVO_GOLPE = CFG.golpeArchivo ?? "assets/puerta-golpe.mp3";
  if (ARCHIVO_GOLPE) {
    golpeEl = new Audio(ARCHIVO_GOLPE);
    golpeEl.preload = "auto";
    golpeEl.volume = 1;
    golpeEl.addEventListener("error", () => { golpeEl = null; });
    golpeEl.load();
  }

  // Instante (s) de cada golpe dentro de assets/puerta-golpe.mp3 (medidos sobre el audio).
  // Si cambias el archivo, mide los nuevos y ajusta esta lista.
  const GOLPES_ARCHIVO = [0.13, 0.35, 0.57, 0.8];
  // Si en tu equipo el movimiento se ve adelantado/atrasado respecto al sonido,
  // ajústalo en config.js (golpeAjusteMs: positivo = la sacudida se retrasa).
  const AJUSTE = (CFG.golpeAjusteMs ?? 0) / 1000;
  const PAUSA_TRAS_GOLPES = 450; // ms de calma antes de que se abra la puerta

  // Reproduce los golpes y llama a alGolpe(i) en el instante exacto de cada uno, para
  // que la puerta se sacuda a la vez que suena. Devuelve una promesa que se cumple
  // cuando han sonado todos (y pasa una pausa corta).
  function llamar(alGolpe = () => {}) {
    return new Promise((fin) => {
      let cerrado = false;
      const terminar = () => {
        if (cerrado) return;
        cerrado = true;
        setTimeout(fin, PAUSA_TRAS_GOLPES);
      };

      if (!golpeEl) return llamarSintetico(alGolpe, terminar);

      const el = golpeEl;
      el.currentTime = 0;
      el.play()
        .then(() => {
          // La posición de reproducción manda: así la sacudida sigue al audio
          // aunque éste tarde en arrancar o se entrecorte.
          let i = 0;
          const vigilar = () => {
            const t = el.currentTime - AJUSTE;
            while (i < GOLPES_ARCHIVO.length && t >= GOLPES_ARCHIVO[i]) alGolpe(i++);
            if (i < GOLPES_ARCHIVO.length && !cerrado) requestAnimationFrame(vigilar);
            else terminar();
          };
          vigilar();
          // Seguro por si la reproducción se detuviese a medias
          setTimeout(() => {
            while (!cerrado && i < GOLPES_ARCHIVO.length) alGolpe(i++);
            terminar();
          }, 3000);
        })
        .catch(() => llamarSintetico(alGolpe, terminar));
    });
  }

  // Respaldo: "toc-toc ... toc-toc" sintetizado, con el pulso algo irregular
  function llamarSintetico(alGolpe, terminar) {
    const tiempos = [0, 0.17 + azar(-0.015, 0.015), 0.62 + azar(-0.02, 0.02), 0.79 + azar(-0.015, 0.015)];
    const fuerzas = [1, 0.78, 0.95, 0.72];
    const retardo = 0.03; // margen para que el audio esté programado antes de sonar
    if (listo()) {
      const t0 = ctx.currentTime + retardo;
      tiempos.forEach((dt, k) => golpe(t0 + dt, fuerzas[k]));
    }
    tiempos.forEach((dt, k) => setTimeout(() => alGolpe(k), (dt + retardo + AJUSTE) * 1000));
    setTimeout(terminar, (tiempos[3] + retardo) * 1000);
  }

  // ----------------------------------------------------------
  //  Crujido de bisagra + pestillo
  // ----------------------------------------------------------
  function abrir() {
    if (!listo()) return;
    const t = ctx.currentTime + 0.02;
    const salida = montarPuerta();

    // pestillo: dos "clics" secos
    [0, 0.07].forEach((dt, i) => {
      const r = ctx.createBufferSource();
      r.buffer = ruido(0.03);
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 1800 - i * 500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + dt);
      g.gain.exponentialRampToValueAtTime(0.35, t + dt + 0.001);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dt + 0.03);
      r.connect(hp).connect(g).connect(salida);
      r.start(t + dt);
      r.stop(t + dt + 0.04);
    });

    // bisagra: diente de sierra grave con vibrato irregular y filtro que barre
    const ini = t + 0.18;
    const dur = 1.9;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(78, ini);
    o.frequency.linearRampToValueAtTime(96, ini + dur * 0.35);
    o.frequency.linearRampToValueAtTime(118, ini + dur * 0.7);
    o.frequency.linearRampToValueAtTime(86, ini + dur);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 9.5;
    const lfoVol = ctx.createGain();
    lfoVol.gain.value = 7;
    lfo.connect(lfoVol).connect(o.frequency);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 6;
    bp.frequency.setValueAtTime(520, ini);
    bp.frequency.linearRampToValueAtTime(1050, ini + dur * 0.6);
    bp.frequency.linearRampToValueAtTime(700, ini + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ini);
    g.gain.linearRampToValueAtTime(0.1, ini + 0.25);
    g.gain.linearRampToValueAtTime(0.07, ini + dur * 0.7);
    g.gain.linearRampToValueAtTime(0.0001, ini + dur);
    o.connect(bp).connect(g).connect(salida);
    o.start(ini);
    lfo.start(ini);
    o.stop(ini + dur + 0.05);
    lfo.stop(ini + dur + 0.05);
  }

  // ----------------------------------------------------------
  //  Confeti: un "pop" por cada esquina (izquierda y derecha), campanitas que brillan
  //  mientras suben y un susurro de papel al caer. Respeta el botón de silencio.
  // ----------------------------------------------------------
  function confeti() {
    if (silenciada || !listo()) return;
    agacharMusica();
    const t = ctx.currentTime + 0.02;
    const salida = ctx.createGain();
    salida.gain.value = 0.9;
    salida.connect(ctx.destination);
    const lado = (pan) => {
      if (!ctx.createStereoPanner) return salida;
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      p.connect(salida);
      return p;
    };

    // Lanzaconfeti: chasquido de ruido + golpe grave que cae
    [[-0.7, 0], [0.7, 0.07]].forEach(([pan, dt]) => {
      const destino = lado(pan);
      const r = ctx.createBufferSource();
      r.buffer = ruido(0.09);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = azar(1300, 1700);
      bp.Q.value = 0.9;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + dt);
      g.gain.exponentialRampToValueAtTime(0.55, t + dt + 0.003);
      g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.08);
      r.connect(bp).connect(g).connect(destino);
      r.start(t + dt);
      r.stop(t + dt + 0.1);

      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(190, t + dt);
      o.frequency.exponentialRampToValueAtTime(55, t + dt + 0.12);
      const go = ctx.createGain();
      go.gain.setValueAtTime(0.0001, t + dt);
      go.gain.exponentialRampToValueAtTime(0.4, t + dt + 0.004);
      go.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.14);
      o.connect(go).connect(destino);
      o.start(t + dt);
      o.stop(t + dt + 0.16);
    });

    // Campanitas: notas agudas de una escala pentatónica, repartidas a izquierda y derecha
    const escala = [1568, 1760, 2093, 2349, 2637, 3136, 3520];
    for (let i = 0; i < 16; i++) {
      const ti = t + 0.12 + i * azar(0.05, 0.11);
      const f = escala[(Math.random() * escala.length) | 0];
      const destino = lado(azar(-0.8, 0.8));
      const vol = 0.07 * (1 - i / 20);
      [1, 2.76].forEach((mult, k) => {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = f * mult;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, ti);
        g.gain.exponentialRampToValueAtTime(k ? vol * 0.25 : vol, ti + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, ti + (k ? 0.25 : 0.7));
        o.connect(g).connect(destino);
        o.start(ti);
        o.stop(ti + 0.75);
      });
    }

    // Susurro de papel: ruido agudo que tiembla y se apaga mientras el confeti cae
    const dur = 2.6;
    const r = ctx.createBufferSource();
    r.buffer = ruido(dur);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 4200;
    const temblor = ctx.createGain();
    temblor.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 13;
    const lfoVol = ctx.createGain();
    lfoVol.gain.value = 0.5;
    lfo.connect(lfoVol).connect(temblor.gain);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t + 0.15);
    g.gain.linearRampToValueAtTime(0.05, t + 0.5);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    r.connect(hp).connect(temblor).connect(g).connect(salida);
    r.start(t + 0.15);
    lfo.start(t + 0.15);
    r.stop(t + dur + 0.1);
    lfo.stop(t + dur + 0.1);
  }

  // ----------------------------------------------------------
  //  Música: villancicos de dominio público en caja de música
  //  Formato: "NOTA:pulsos", R = silencio. (Jingle Bells, 1857; We Wish You a
  //  Merry Christmas, tradicional inglés.)
  // ----------------------------------------------------------
  const CANCIONES = [
    {
      bpm: 132,
      notas:
        "E5:1 E5:1 E5:2 E5:1 E5:1 E5:2 E5:1 G5:1 C5:1.5 D5:.5 E5:4 " +
        "F5:1 F5:1 F5:1.5 F5:.5 F5:1 E5:1 E5:1 E5:.5 E5:.5 E5:1 D5:1 D5:1 E5:1 D5:2 G5:2 " +
        "E5:1 E5:1 E5:2 E5:1 E5:1 E5:2 E5:1 G5:1 C5:1.5 D5:.5 E5:4 " +
        "F5:1 F5:1 F5:1.5 F5:.5 F5:1 E5:1 E5:1 E5:.5 E5:.5 G5:1 G5:1 F5:1 D5:1 C5:4",
    },
    {
      bpm: 150,
      notas:
        "D4:1 G4:1 G4:.5 A4:.5 G4:.5 F#4:.5 E4:1 E4:1 E4:1 A4:1 A4:.5 B4:.5 A4:.5 G4:.5 " +
        "F#4:1 D4:1 D4:1 B4:1 B4:.5 C5:.5 B4:.5 A4:.5 G4:1 E4:1 D4:.5 D4:.5 E4:1 A4:1 F#4:1 G4:3 R:1",
    },
  ].map((c) => ({
    bpm: c.bpm,
    notas: c.notas.split(" ").map((s) => {
      const [n, b] = s.split(":");
      return [n === "R" ? null : n, Number(b)];
    }),
  }));

  const SEMITONOS = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
  function frecuencia(nombre) {
    const m = nombre.match(/^([A-G]#?)(\d)$/);
    const midi = 12 * (Number(m[2]) + 1) + SEMITONOS[m[1]];
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // Una nota de caja de música: parcial fundamental + armónico agudo que se apaga antes
  function nota(f, t, dur) {
    const salida = montarBus();
    const largo = Math.min(2.4, Math.max(0.9, dur * 1.6));
    [[1, 0.2, largo], [2, 0.07, largo * 0.55], [4.02, 0.025, largo * 0.25]].forEach(([mult, vol, d]) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f * mult;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0004, t + d);
      o.connect(g).connect(salida);
      o.start(t);
      o.stop(t + d + 0.05);
    });
  }

  const estado = { sonando: false, timer: 0, t: 0, i: 0, cancion: 0, audio: null, fade: 0, primed: false };
  let silenciada = store.get(CLAVE_MUTE) === "1";
  const avisar = () => document.dispatchEvent(new CustomEvent("sonido-cambio", { detail: { activa: !silenciada } }));

  function programar() {
    if (!estado.sonando) return;
    while (estado.t < ctx.currentTime + 0.6) {
      const c = CANCIONES[estado.cancion];
      const [n, pulsos] = c.notas[estado.i];
      const dur = (pulsos * 60) / c.bpm;
      if (n) nota(frecuencia(n), estado.t, dur);
      estado.t += dur;
      estado.i++;
      if (estado.i >= c.notas.length) {
        estado.i = 0;
        estado.cancion = (estado.cancion + 1) % CANCIONES.length;
        estado.t += 1.6; // pausa entre villancicos
      }
    }
  }

  // El reproductor de la música se crea una sola vez y se reutiliza: los navegadores
  // de móvil "desbloquean" un reproductor concreto cuando se le da play() dentro de un
  // toque, y a partir de ahí dejan arrancarlo solo (p. ej. al acabar la animación).
  function elementoMusica() {
    if (estado.audio) return estado.audio;
    if (!CFG.musicaArchivo) return null;
    const el = new Audio(CFG.musicaArchivo);
    el.loop = true;
    el.preload = "auto";
    // Si el archivo no existe o no se puede reproducir, suena la caja de música
    el.addEventListener("error", () => {
      estado.audio = null;
      if (estado.sonando) arrancarSintetica();
    }, { once: true });
    estado.audio = el;
    return el;
  }

  // Llamar SIEMPRE desde dentro de un toque/clic (ver entrar() en app.js)
  function desbloquear() {
    // Web Audio (crujido y música sintetizada): reanudar y emitir un instante de silencio
    try {
      if (ctx) {
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        const src = ctx.createBufferSource();
        src.buffer = ctx.createBuffer(1, 1, 22050);
        src.connect(ctx.destination);
        src.start(0);
      }
    } catch { /* sin audio */ }

    // mp3 de música: play() mudo + pausa. No se oye nada, pero queda desbloqueado.
    // Se queda en silencio (muted) hasta arrancar(): si la pausa llega tarde o el
    // iPhone la ignora, la canción no se oye en la puerta.
    const el = silenciada ? null : elementoMusica();
    if (el && !estado.sonando && !estado.primed) {
      estado.primed = true;
      el.muted = true;
      const pausar = () => {
        if (!estado.sonando) { el.pause(); el.currentTime = 0; }
      };
      el.addEventListener("playing", pausar, { once: true });
      el.play().then(pausar).catch(() => {});
    }
  }

  // Si el navegador bloquea el arranque, se reintenta en el siguiente toque
  function reintentarEnGesto(el) {
    const eventos = ["pointerdown", "touchend", "keydown"];
    const intentar = () => {
      eventos.forEach((e) => document.removeEventListener(e, intentar, true));
      if (estado.sonando && el.paused) el.play().catch(() => {});
    };
    eventos.forEach((e) => document.addEventListener(e, intentar, true));
  }

  function fundirArchivo(el, hasta, ms, alFinal) {
    clearInterval(estado.fade);
    const desde = el.volume;
    const ini = performance.now();
    estado.fade = setInterval(() => {
      const k = Math.min(1, (performance.now() - ini) / ms);
      el.volume = desde + (hasta - desde) * k;
      if (k >= 1) {
        clearInterval(estado.fade);
        alFinal?.();
      }
    }, 40);
  }

  function arrancar() {
    if (estado.sonando || silenciada) return;
    estado.sonando = true;

    // ¿mp3 propio? (config.js → musicaArchivo)
    const el = elementoMusica();
    if (el) {
      clearInterval(estado.fade);
      // El volumen y el fundido de entrada van grabados en el propio mp3 (Safari en
      // iPhone ignora el volumen del reproductor), así que aquí siempre al máximo.
      el.volume = 1;
      el.currentTime = 0; // siempre desde el principio (con su fundido), aunque el desbloqueo siga sonando mudo
      el.muted = false;
      el.play().catch(() => reintentarEnGesto(el));
      return;
    }
    arrancarSintetica();
  }

  function arrancarSintetica() {
    if (!listo()) { estado.sonando = false; return; }
    const b = montarBus();
    b.gain.cancelScheduledValues(ctx.currentTime);
    b.gain.setValueAtTime(b.gain.value, ctx.currentTime);
    b.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 3);
    estado.t = ctx.currentTime + 0.4;
    estado.i = 0;
    estado.cancion = 0;
    programar();
    estado.timer = setInterval(programar, 120);
  }

  // ----------------------------------------------------------
  //  Bajar la música un momento (para que se oiga el confeti) y volver a subirla.
  //  · Ordenador: se baja el volumen del <audio> directamente.
  //  · iPhone: Safari ignora ese volumen, así que el mp3 se pasa por Web Audio (una
  //    ganancia). Solo ahí y nunca en file:// (el navegador dejaría la música muda por
  //    seguridad, y una vez conectado no se puede deshacer). Si no se puede, sigue igual.
  // ----------------------------------------------------------
  let volArchivo = null;
  let volumenLibre = null; // ¿el navegador deja cambiar el volumen del <audio>?
  let reponer = 0;

  function puedeCambiarVolumen(el) {
    if (volumenLibre === null) {
      const antes = el.volume;
      try { el.volume = 0.5; } catch {}
      volumenLibre = Math.abs(el.volume - 0.5) < 0.01;
      try { el.volume = antes; } catch {}
    }
    return volumenLibre;
  }

  function ganchoArchivo(el) {
    if (volArchivo) return volArchivo;
    if (location.protocol === "file:" || ctx.state !== "running" || !ctx.createMediaElementSource) return null;
    try {
      const fuente = ctx.createMediaElementSource(el);
      volArchivo = ctx.createGain();
      fuente.connect(volArchivo).connect(ctx.destination);
    } catch {
      return null;
    }
    return volArchivo;
  }

  function agacharMusica(nivel = 0.2, mantener = 2.6) {
    if (!estado.sonando) return;
    const el = estado.audio;

    if (el && !volArchivo && puedeCambiarVolumen(el)) {
      clearTimeout(reponer);
      fundirArchivo(el, nivel, 250);
      reponer = setTimeout(() => {
        if (estado.sonando && estado.audio === el) fundirArchivo(el, 1, 1800);
      }, mantener * 1000);
      return;
    }

    if (!listo()) return;
    const nodo = el ? ganchoArchivo(el) : bus;
    if (!nodo) return;
    const normal = el ? 1 : 0.9; // 0,9 = volumen de la caja de música (arrancarSintetica)
    const t = ctx.currentTime;
    const g = nodo.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(normal * nivel, t + 0.25);
    g.setValueAtTime(normal * nivel, t + mantener);
    g.linearRampToValueAtTime(normal, t + mantener + 1.8);
  }

  function parar(ms = 1200) {
    if (!estado.sonando) return;
    estado.sonando = false;
    clearInterval(estado.timer);
    if (estado.audio) {
      const el = estado.audio;
      fundirArchivo(el, 0, ms, () => el.pause());
      return;
    }
    if (bus) {
      bus.gain.cancelScheduledValues(ctx.currentTime);
      bus.gain.setValueAtTime(bus.gain.value, ctx.currentTime);
      bus.gain.linearRampToValueAtTime(0, ctx.currentTime + ms / 1000);
    }
  }

  // Si se cierra o se oculta la pestaña, que no siga sonando
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) {
      ctx.suspend().catch(() => {});
      estado.audio?.pause();
    } else if (estado.sonando) {
      ctx.resume().catch(() => {});
      estado.audio?.play().catch(() => {});
    }
  });

  return {
    desbloquear,
    llamar,
    abrir,
    confeti,
    musica: {
      iniciar: arrancar,
      parar,
      activa: () => !silenciada,
      // Botón de silencio: devuelve true si la música queda activada
      alternar() {
        silenciada = !silenciada;
        store.set(CLAVE_MUTE, silenciada ? "1" : "0");
        if (silenciada) parar(500);
        else arrancar();
        avisar();
        return !silenciada;
      },
    },
  };
})();
