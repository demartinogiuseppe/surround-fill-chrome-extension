// Surround Fill (5.1 / 7.1, tutti i siti): instrada l'audio di <video>/<audio>
// su 6 o 8 canali prima che esca dal browser. Nessun ritardo aggiunto.
//   Posteriori: FL->BL, FR->BR          (canali 4,5 — in 5.1 sono i surround)
//   Laterali:   FL->SL, FR->SR          (canali 6,7 — solo 7.1)
//   Centrale:   (FL+FR)/2 -> C          (canale 2)
//   Subwoofer:  (FL+FR)/2 passa-basso 120 Hz -> LFE (canale 3)
// Ordine canali Windows: 0=FL 1=FR 2=C 3=LFE 4=BL 5=BR 6=SL 7=SR
(() => {
  const state = { rear: false, side: false, center: false, sub: false };
  let ctx = null;
  let outCh = 0; // 6 o 8
  const hooked = new WeakMap(); // media -> gain nodes
  let warned = false;

  const CENTER_GAIN = 0.5; // media di L e R
  const SUB_GAIN = 0.5;    // media di L e R
  const SUB_CUTOFF = 120;  // Hz, frequenza di taglio del subwoofer

  function active() { return state.rear || state.side || state.center || state.sub; }

  function getCtx() {
    if (ctx) return ctx;
    ctx = new AudioContext({ latencyHint: "interactive" });
    const max = ctx.destination.maxChannelCount;
    outCh = max >= 8 ? 8 : max >= 6 ? 6 : 0;
    if (outCh) {
      ctx.destination.channelCount = outCh;
      ctx.destination.channelCountMode = "explicit";
      ctx.destination.channelInterpretation = "discrete";
    }
    return ctx;
  }

  // Salta i media che con Web Audio diventerebbero muti:
  // DRM (Netflix, Prime, Spotify...) e file di altri domini senza CORS.
  function safe(el) {
    if (el.mediaKeys) return false;
    const src = el.currentSrc || el.src;
    if (!src) return false;
    if (src.startsWith("blob:") || src.startsWith("data:")) return true;
    try {
      if (new URL(src, location.href).origin === location.origin) return true;
    } catch (e) { return false; }
    return el.crossOrigin === "anonymous" || el.crossOrigin === "use-credentials";
  }

  function hook(media) {
    if (hooked.has(media)) return;
    if (!safe(media)) return;
    const c = getCtx();
    if (!outCh) {
      if (!warned) {
        warned = true;
        console.warn("[Surround Fill] L'uscita audio ha solo",
          c.destination.maxChannelCount, "canali. Imposta Windows su 5.1 o 7.1.");
      }
      return;
    }

    const src = c.createMediaElementSource(media);

    // Forza stereo (anche le sorgenti mono finiscono su L e R)
    const stereo = c.createGain();
    stereo.channelCount = 2;
    stereo.channelCountMode = "explicit";
    stereo.channelInterpretation = "speakers";

    const split = c.createChannelSplitter(2);
    const merge = c.createChannelMerger(outCh);

    src.connect(stereo);
    stereo.connect(split);
    split.connect(merge, 0, 0);   // FL
    split.connect(merge, 1, 1);   // FR

    // Centrale: somma L+R (più ingressi su un GainNode si sommano)
    const ctr = c.createGain();
    split.connect(ctr, 0);
    split.connect(ctr, 1);
    ctr.connect(merge, 0, 2);

    // Subwoofer: somma L+R filtrata (solo i bassi) sul canale LFE
    const subMix = c.createGain();
    split.connect(subMix, 0);
    split.connect(subMix, 1);
    const lp1 = c.createBiquadFilter();
    const lp2 = c.createBiquadFilter(); // due filtri in serie = taglio più netto
    lp1.type = lp2.type = "lowpass";
    lp1.frequency.value = lp2.frequency.value = SUB_CUTOFF;
    lp1.Q.value = lp2.Q.value = -3.0103; // Butterworth (Q in dB): nessun picco sui bassi
    subMix.connect(lp1);
    lp1.connect(lp2);
    lp2.connect(merge, 0, 3);

    // Copia L/R su una coppia di canali di uscita
    function pair(outL, outR) {
      const gL = c.createGain();
      const gR = c.createGain();
      split.connect(gL, 0);
      split.connect(gR, 1);
      gL.connect(merge, 0, outL);
      gR.connect(merge, 0, outR);
      return [gL, gR];
    }

    const nodes = { ctr, subMix, rear: pair(4, 5), side: outCh === 8 ? pair(6, 7) : [] };
    merge.connect(c.destination);

    hooked.set(media, nodes);
    apply(nodes);

    media.addEventListener("play", () => c.resume());
    if (!media.paused) c.resume();
  }

  function apply(nodes) {
    nodes.ctr.gain.value = state.center ? CENTER_GAIN : 0;
    nodes.subMix.gain.value = state.sub ? SUB_GAIN : 0;
    nodes.rear.forEach(g => (g.gain.value = state.rear ? 1 : 0));
    nodes.side.forEach(g => (g.gain.value = state.side ? 1 : 0));
  }

  function scan() {
    if (!active()) return; // non tocca nulla finché non viene attivato qualcosa
    document.querySelectorAll("video, audio").forEach(hook);
  }

  function refreshAll() {
    document.querySelectorAll("video, audio").forEach(m => {
      const n = hooked.get(m);
      if (n) apply(n);
    });
    scan();
    if (ctx && ctx.state === "suspended") ctx.resume();
  }

  // Sblocca l'AudioContext al primo clic/tasto se il browser lo tiene sospeso
  ["click", "keydown"].forEach(ev =>
    document.addEventListener(ev, () => ctx && ctx.resume(), true));

  // Riprova quando un media inizia a caricare (src non ancora pronto alla scansione)
  document.addEventListener("loadedmetadata", e => {
    if (active() && e.target instanceof HTMLMediaElement) hook(e.target);
  }, true);

  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });

  function load(s) {
    state.rear = !!s.enabled;
    state.side = !!s.side;
    state.center = !!s.center;
    state.sub = !!s.sub;
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    chrome.storage.local.get(["enabled", "side", "center", "sub"]).then(s => {
      load(s);
      refreshAll();
    });
  });

  chrome.storage.local.get(["enabled", "side", "center", "sub"]).then(s => {
    load(s);
    refreshAll();
  });
})();
