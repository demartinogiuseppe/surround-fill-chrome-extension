// Surround Fill (5.1 / 7.1, all sites): routes <video>/<audio> audio
// to 6 or 8 channels before it leaves the browser. No added latency.
//   Rear:      FL->BL, FR->BR           (channels 4,5 — the surrounds in 5.1)
//   Side:      FL->SL, FR->SR           (channels 6,7 — 7.1 only)
//   Center:    (FL+FR)/2 -> C           (channel 2)
//   Subwoofer: (FL+FR)/2 low-pass 120 Hz -> LFE (channel 3)
// Windows channel order: 0=FL 1=FR 2=C 3=LFE 4=BL 5=BR 6=SL 7=SR
(() => {
  const state = { rear: false, side: false, center: false, sub: false };
  let ctx = null;
  let outCh = 0; // 6 or 8
  const hooked = new WeakMap(); // media -> gain nodes
  let warned = false;

  const CENTER_GAIN = 0.5; // average of L and R
  const SUB_GAIN = 0.5;    // average of L and R
  const SUB_CUTOFF = 120;  // Hz, subwoofer cutoff frequency

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

  // Skip media that Web Audio would turn silent:
  // DRM (Netflix, Prime, Spotify...) and files from other domains without CORS.
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
        console.warn("[Surround Fill] The audio output only has",
          c.destination.maxChannelCount, "channels. Set Windows to 5.1 or 7.1.");
      }
      return;
    }

    // An element can only have one MediaElementSource: if the page already
    // connected it to its own Web Audio graph, leave it alone (null = skipped)
    let src;
    try {
      src = c.createMediaElementSource(media);
    } catch (e) {
      hooked.set(media, null);
      console.warn("[Surround Fill] Skipped a media element already connected to Web Audio by the page.");
      return;
    }

    // Force stereo (mono sources also end up on L and R)
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

    // Center: sum of L+R (multiple inputs to a GainNode are summed)
    const ctr = c.createGain();
    split.connect(ctr, 0);
    split.connect(ctr, 1);
    ctr.connect(merge, 0, 2);

    // Subwoofer: filtered L+R sum (bass only) on the LFE channel
    const subMix = c.createGain();
    split.connect(subMix, 0);
    split.connect(subMix, 1);
    const lp1 = c.createBiquadFilter();
    const lp2 = c.createBiquadFilter(); // two filters in series = steeper cutoff
    lp1.type = lp2.type = "lowpass";
    lp1.frequency.value = lp2.frequency.value = SUB_CUTOFF;
    lp1.Q.value = lp2.Q.value = -3.0103; // Butterworth (Q in dB): no bass peak
    subMix.connect(lp1);
    lp1.connect(lp2);
    lp2.connect(merge, 0, 3);

    // Copy L/R to a pair of output channels
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
    if (!active()) return; // touch nothing until something is switched on
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

  // Unlock the AudioContext on the first click/key press if the browser keeps it suspended
  ["click", "keydown"].forEach(ev =>
    document.addEventListener(ev, () => ctx && ctx.resume(), true));

  // Retry when a media element starts loading (src not ready yet at scan time)
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
