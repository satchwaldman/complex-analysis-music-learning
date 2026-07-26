/* =====================================================================
 * explorer.js — the three-pane interactive explorer
 * Depends on ZM (mathlib.js).
 * ===================================================================== */
(function () {
  "use strict";
  const ZM = window.ZM;
  const { edoToHeight, heightToEdo, riemannSiegelZ, zetaAbs, rsTheta, rsN } = ZM;

  const EDO_MIN = 5, EDO_MAX = 72;
  const BASE_FREQ = 220;      // A3
  const ROLLOFF = 0.75;       // partial amplitude rolloff for timbre/curve
  const NOTABLE = [5,7,10,12,15,17,19,22,24,26,29,31,34,36,41,43,46,50,53,58,60,65,72];
  const PRIME_COLORS = { 2:"#8a94a6", 3:"#5aa9e6", 5:"#7ee081", 7:"#f2b04a", 11:"#d16ba5", 13:"#ff6b6b" };

  const state = {
    cursorN: 12,        // continuous cursor position (EDO units)
    N: 12,              // selected integer EDO
    sigma: 0.5,
    primeLimit: 7,
    partials: 6,
    chord: "4:5:6",
  };

  /* ---------- canvas helper (DPR-crisp) ---------- */
  function setup(canvas, cssH) {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || canvas.parentElement.clientWidth;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.height = cssH + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: cssW, h: cssH };
  }

  function primesFor(limit) {
    return ZM.DEFAULT_PRIMES.filter((p) => p <= limit);
  }

  /* ================= ZETA PANE ================= */
  const zetaCanvas = document.getElementById("zetaCanvas");
  function zval(N) {
    const t = edoToHeight(N);
    return state.sigma === 0.5 ? Math.abs(riemannSiegelZ(t)) : zetaAbs(state.sigma, t);
  }

  function drawZeta() {
    const { ctx, w, h } = setup(zetaCanvas, 300);
    const padL = 34, padR = 12, padT = 14, padB = 26;
    const plotW = w - padL - padR, plotH = h - padT - padB;
    ctx.clearRect(0, 0, w, h);

    // sample
    const M = Math.max(400, Math.floor(plotW));
    const xs = [], ys = [];
    let ymax = 1e-9;
    for (let i = 0; i <= M; i++) {
      const N = EDO_MIN + ((EDO_MAX - EDO_MIN) * i) / M;
      const v = zval(N);
      xs.push(N); ys.push(v);
      if (v > ymax) ymax = v;
    }
    ymax *= 1.08;
    const X = (N) => padL + (plotW * (N - EDO_MIN)) / (EDO_MAX - EDO_MIN);
    const Y = (v) => padT + plotH - (plotH * v) / ymax;

    // integer gridlines
    for (let N = EDO_MIN; N <= EDO_MAX; N++) {
      const notable = NOTABLE.includes(N);
      ctx.strokeStyle = notable ? "#3d4a5a" : "#232c37";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X(N), padT); ctx.lineTo(X(N), padT + plotH); ctx.stroke();
      if (notable) {
        ctx.fillStyle = "#6b7684";
        ctx.font = "11px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText(N, X(N), h - 9);
      }
    }
    // axis title
    ctx.fillStyle = "#9aa7b4"; ctx.font = "11px system-ui"; ctx.textAlign = "right";
    ctx.fillText("EDO number  N = t·ln2 / 2π  →", w - padR, padT + 2);

    // curve (filled)
    ctx.beginPath();
    ctx.moveTo(X(xs[0]), Y(0));
    for (let i = 0; i <= M; i++) ctx.lineTo(X(xs[i]), Y(ys[i]));
    ctx.lineTo(X(xs[M]), Y(0)); ctx.closePath();
    ctx.fillStyle = "rgba(90,169,230,0.16)"; ctx.fill();
    ctx.beginPath();
    for (let i = 0; i <= M; i++) (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(xs[i]), Y(ys[i]));
    ctx.strokeStyle = "#5aa9e6"; ctx.lineWidth = 1.6; ctx.stroke();

    // peak dots (local maxima above a threshold)
    for (let i = 2; i < M - 2; i++) {
      if (ys[i] > ys[i - 1] && ys[i] >= ys[i + 1] && ys[i] > ymax * 0.45) {
        ctx.beginPath(); ctx.arc(X(xs[i]), Y(ys[i]), 2.6, 0, 7); ctx.fillStyle = "#8fd0ff"; ctx.fill();
      }
    }

    // cursor
    const cx = X(state.cursorN);
    ctx.strokeStyle = "#f2b04a"; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(cx, padT); ctx.lineTo(cx, padT + plotH); ctx.stroke();
    const cv = zval(state.cursorN);
    ctx.beginPath(); ctx.arc(cx, Y(cv), 4, 0, 7); ctx.fillStyle = "#f2b04a"; ctx.fill();
    // cursor label
    ctx.fillStyle = "#f2b04a"; ctx.font = "bold 12px ui-monospace, monospace"; ctx.textAlign = "center";
    ctx.fillText("N=" + state.cursorN.toFixed(2), cx, padT + 12);
  }

  /* ================= ARROW (phasor) PANE ================= */
  const arrowCanvas = document.getElementById("arrowCanvas");
  function drawArrows() {
    const { ctx, w, h } = setup(arrowCanvas, 260);
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const t = edoToHeight(state.N);
    const th = rsTheta(t), Nrs = rsN(t);
    // complex arrows e^{i(theta - t ln n)}/sqrt(n); running sum
    const pts = [{ x: 0, y: 0 }];
    let sx = 0, sy = 0, ext = 0.2;
    for (let n = 1; n <= Nrs; n++) {
      const ph = th - t * Math.log(n), r = 1 / Math.sqrt(n);
      sx += r * Math.cos(ph); sy += r * Math.sin(ph);
      pts.push({ x: sx, y: sy });
      ext = Math.max(ext, Math.hypot(sx, sy));
      ext = Math.max(ext, Math.hypot(pts[n - 1].x, pts[n - 1].y));
    }
    const scale = (Math.min(w, h) / 2 - 24) / (ext + 1e-6);
    const PX = (x) => cx + x * scale, PY = (y) => cy - y * scale;

    // axes
    ctx.strokeStyle = "#232c37"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();

    // spiral of partial sums
    ctx.beginPath(); ctx.moveTo(PX(0), PY(0));
    for (const p of pts) ctx.lineTo(PX(p.x), PY(p.y));
    ctx.strokeStyle = "#5a6673"; ctx.lineWidth = 1.4; ctx.stroke();
    // dots at each partial sum
    for (const p of pts) { ctx.beginPath(); ctx.arc(PX(p.x), PY(p.y), 2, 0, 7); ctx.fillStyle = "#7d8794"; ctx.fill(); }

    // resultant
    ctx.beginPath(); ctx.moveTo(PX(0), PY(0)); ctx.lineTo(PX(sx), PY(sy));
    ctx.strokeStyle = "#f2b04a"; ctx.lineWidth = 2.4; ctx.stroke();
    // arrowhead
    const ang = Math.atan2(-(PY(sy) - PY(0)), PX(sx) - PX(0));
    ctx.save(); ctx.translate(PX(sx), PY(sy)); ctx.rotate(-ang);
    ctx.fillStyle = "#f2b04a"; ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(-9, -4); ctx.lineTo(-9, 4); ctx.closePath(); ctx.fill();
    ctx.restore();

    const Zval = 2 * sx; // Z(t) = 2 Re(sum)
    document.getElementById("arrow-terms").textContent = Nrs;
    document.getElementById("arrow-res").textContent = Zval.toFixed(2);
    document.getElementById("arrowN").textContent = Nrs;
  }

  /* ================= RTT PANE ================= */
  function drawRTT() {
    const primes = primesFor(state.primeLimit);
    const rep = ZM.rttReport(state.N, primes);
    document.getElementById("rtt-N").textContent = state.N;
    document.getElementById("playEdoLbl").textContent = state.N;
    document.getElementById("rtt-val").textContent = "⟨ " + rep.val.join(" ") + " ]";
    document.getElementById("rtt-te").innerHTML = rep.teRms.toFixed(2) + "<small> ¢</small>";
    document.getElementById("rtt-bad").textContent = rep.badness.toFixed(2);

    const tb = document.querySelector("#rttTable tbody");
    tb.innerHTML = "";
    const HALF = 60; // px each side, ±50c full
    rep.rows.forEach((r) => {
      const tr = document.createElement("tr");
      const col = PRIME_COLORS[r.p] || "#888";
      const e = Math.max(-50, Math.min(50, r.errCents));
      const bw = (Math.abs(e) / 50) * HALF;
      const bar = e < 0
        ? `<span class="errbar" style="background:${col}; width:${bw}px; margin-left:${HALF - bw}px"></span>`
        : `<span class="errbar" style="background:${col}; width:${bw}px; margin-left:${HALF}px"></span>`;
      tr.innerHTML =
        `<td style="color:${col}">${r.p}</td>` +
        `<td class="num">${r.steps}</td>` +
        `<td class="num" style="color:${Math.abs(r.errCents) > 15 ? "#ff9b9b" : "var(--text)"}">${r.errCents >= 0 ? "+" : ""}${r.errCents.toFixed(1)}</td>` +
        `<td class="bar-cell">${bar}</td>`;
      tb.appendChild(tr);
    });
  }

  /* ================= DISSONANCE CURVE ================= */
  const dissCanvas = document.getElementById("dissCanvas");
  function parseChord(str) {
    const nums = str.split(":").map(Number);
    return nums.map((n) => n / nums[0]); // ratios relative to root
  }
  function drawDiss() {
    const { ctx, w, h } = setup(dissCanvas, 180);
    ctx.clearRect(0, 0, w, h);
    const padL = 8, padR = 8, padT = 10, padB = 18;
    const plotW = w - padL - padR, plotH = h - padT - padB;
    const maxR = 2.05;
    const curve = ZM.dissonanceCurve(BASE_FREQ, state.partials, ROLLOFF, maxR, 500);
    let ymax = 1e-9;
    curve.ys.forEach((y) => (ymax = Math.max(ymax, y)));
    ymax *= 1.1;
    const X = (r) => padL + (plotW * (r - 1)) / (maxR - 1);
    const Y = (y) => padT + plotH - (plotH * y) / ymax;

    // curve
    ctx.beginPath();
    for (let i = 0; i < curve.xs.length; i++)
      (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(curve.xs[i]), Y(curve.ys[i]));
    ctx.strokeStyle = "#8fb7d6"; ctx.lineWidth = 1.6; ctx.stroke();

    // baseline
    ctx.strokeStyle = "#232c37";
    ctx.beginPath(); ctx.moveTo(padL, Y(0)); ctx.lineTo(w - padR, Y(0)); ctx.stroke();

    // chord ratios: JI (green) + EDO approx (amber)
    const ratios = parseChord(state.chord);
    const step = 1200 / state.N;
    ratios.forEach((r) => {
      if (r < 1 || r > maxR) return;
      // JI
      ctx.strokeStyle = "#7ee081"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(X(r), padT); ctx.lineTo(X(r), padT + plotH); ctx.stroke();
      // EDO approx
      const cents = 1200 * Math.log2(r);
      const k = Math.round(cents / step);
      const er = Math.pow(2, k / state.N);
      if (er <= maxR) {
        ctx.strokeStyle = "#f2b04a"; ctx.lineWidth = 1.4; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(X(er), padT); ctx.lineTo(X(er), padT + plotH); ctx.stroke();
        ctx.setLineDash([]);
      }
    });
    // x labels
    ctx.fillStyle = "#6b7684"; ctx.font = "10px ui-monospace, monospace"; ctx.textAlign = "center";
    [1, 1.25, 1.5, 2].forEach((r) => ctx.fillText(r.toFixed(2), X(r), h - 5));
    ctx.textAlign = "left";
    ctx.fillText("more dissonant ↑", padL + 2, padT + 10);
  }

  /* ================= AUDIO ENGINE ================= */
  let audioCtx = null, activeNodes = [];
  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  }
  function stopAudio() {
    const now = audioCtx ? audioCtx.currentTime : 0;
    activeNodes.forEach((n) => {
      try { n.gain.gain.cancelScheduledValues(now); n.gain.gain.setValueAtTime(n.gain.gain.value, now); n.gain.gain.linearRampToValueAtTime(0, now + 0.05); n.osc.stop(now + 0.08); } catch (e) {}
    });
    activeNodes = [];
  }
  function playChord(useEDO) {
    ensureAudio(); stopAudio();
    const now = audioCtx.currentTime;
    const dur = 2.6;
    const ratios = parseChord(state.chord);
    const step = 1200 / state.N;
    const master = audioCtx.createGain();
    master.gain.value = 0.9; master.connect(audioCtx.destination);
    ratios.forEach((r) => {
      let ratio = r;
      if (useEDO) { const k = Math.round((1200 * Math.log2(r)) / step); ratio = Math.pow(2, k / state.N); }
      const f = BASE_FREQ * ratio;
      const noteGain = 0.32 / ratios.length;
      for (let k = 1; k <= state.partials; k++) {
        const osc = audioCtx.createOscillator();
        osc.type = "sine"; osc.frequency.value = f * k;
        const g = audioCtx.createGain();
        const amp = noteGain * Math.pow(ROLLOFF, k - 1);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(amp, now + 0.02);
        g.gain.setValueAtTime(amp, now + dur - 0.5);
        g.gain.linearRampToValueAtTime(0, now + dur);
        osc.connect(g); g.connect(master); osc.start(now); osc.stop(now + dur + 0.05);
        activeNodes.push({ osc, gain: g });
      }
    });
  }

  /* ================= READOUTS + ORCHESTRATION ================= */
  function updateStats() {
    const t = edoToHeight(state.cursorN);
    document.getElementById("stat-t").textContent = t.toFixed(2);
    document.getElementById("stat-z").textContent = zval(state.cursorN).toFixed(3);
    const pk = ZM.zetaPeakNear(state.N);
    document.getElementById("stat-neff").textContent = pk.nEff.toFixed(3);
    document.getElementById("stat-oct").innerHTML = pk.octaveCents.toFixed(1) + "<small> ¢</small>";
    document.getElementById("edoVal").textContent = state.N;
  }
  function renderAll() {
    drawZeta(); drawArrows(); drawRTT(); drawDiss(); updateStats();
  }

  /* ================= EVENTS ================= */
  function setCursorFromPixel(clientX) {
    const rect = zetaCanvas.getBoundingClientRect();
    const padL = 34, padR = 12;
    const plotW = rect.width - padL - padR;
    let frac = (clientX - rect.left - padL) / plotW;
    frac = Math.max(0, Math.min(1, frac));
    const N = EDO_MIN + (EDO_MAX - EDO_MIN) * frac;
    state.cursorN = Math.round(N * 100) / 100;
    state.N = Math.max(EDO_MIN, Math.min(EDO_MAX, Math.round(N)));
    document.getElementById("edoSlider").value = state.N;
    renderAll();
  }
  let dragging = false;
  zetaCanvas.addEventListener("mousedown", (e) => { dragging = true; setCursorFromPixel(e.clientX); });
  window.addEventListener("mousemove", (e) => { if (dragging) setCursorFromPixel(e.clientX); });
  window.addEventListener("mouseup", () => (dragging = false));
  zetaCanvas.addEventListener("touchstart", (e) => { setCursorFromPixel(e.touches[0].clientX); e.preventDefault(); }, { passive: false });
  zetaCanvas.addEventListener("touchmove", (e) => { setCursorFromPixel(e.touches[0].clientX); e.preventDefault(); }, { passive: false });

  document.getElementById("edoSlider").addEventListener("input", (e) => {
    state.N = parseInt(e.target.value, 10);
    state.cursorN = state.N;
    renderAll();
  });
  document.getElementById("snapBtn").addEventListener("click", () => {
    const pk = ZM.zetaPeakNear(state.N);
    state.cursorN = Math.round(pk.nEff * 100) / 100;
    state.N = Math.round(pk.nEff);
    document.getElementById("edoSlider").value = state.N;
    renderAll();
  });
  document.querySelectorAll("#sigmaSeg button").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll("#sigmaSeg button").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      state.sigma = parseFloat(b.dataset.s);
      renderAll();
    });
  });
  document.getElementById("primeLimit").addEventListener("change", (e) => {
    state.primeLimit = parseInt(e.target.value, 10); drawRTT();
  });
  document.getElementById("partSlider").addEventListener("input", (e) => {
    state.partials = parseInt(e.target.value, 10);
    document.getElementById("partVal").textContent = state.partials;
    drawDiss();
  });
  document.getElementById("chordSel").addEventListener("change", (e) => { state.chord = e.target.value; drawDiss(); });
  document.getElementById("playJI").addEventListener("click", () => playChord(false));
  document.getElementById("playEDO").addEventListener("click", () => playChord(true));
  document.getElementById("stopBtn").addEventListener("click", stopAudio);

  let rzTimer;
  window.addEventListener("resize", () => { clearTimeout(rzTimer); rzTimer = setTimeout(renderAll, 120); });

  // initial render (after layout)
  window.addEventListener("load", renderAll);
  renderAll();
})();
