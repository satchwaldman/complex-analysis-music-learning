/* =====================================================================
 * explicit.js — the explicit-formula companion module
 * Depends on ZM (mathlib.js) and ZETA_ZEROS (zeros.js).
 * ===================================================================== */
(function () {
  "use strict";
  const ZM = window.ZM;
  const GAMMAS = window.ZETA_ZEROS;

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

  /* ===== PANE A: psi(x) staircase assembly ===== */
  const psiCanvas = document.getElementById("psiCanvas");
  const XMIN = 2, XMAX = 55;
  let nZeros = 0;

  // precompute true psi staircase samples (fine grid) once
  const stair = (function () {
    const pts = [];
    const M = 900;
    for (let i = 0; i <= M; i++) {
      const x = XMIN + ((XMAX - XMIN) * i) / M;
      pts.push({ x, y: ZM.psiTrue(x) });
    }
    return pts;
  })();

  function drawPsi() {
    const { ctx, w, h } = setup(psiCanvas, 330);
    ctx.clearRect(0, 0, w, h);
    const padL = 40, padR = 14, padT = 14, padB = 26;
    const plotW = w - padL - padR, plotH = h - padT - padB;
    const ymax = XMAX * 1.15, ymin = 0;
    const X = (x) => padL + (plotW * (x - XMIN)) / (XMAX - XMIN);
    const Y = (y) => padT + plotH - (plotH * (y - ymin)) / (ymax - ymin);

    // grid + y=x reference
    ctx.strokeStyle = "#232c37"; ctx.lineWidth = 1;
    for (let gx = 10; gx <= XMAX; gx += 10) {
      ctx.beginPath(); ctx.moveTo(X(gx), padT); ctx.lineTo(X(gx), padT + plotH); ctx.stroke();
      ctx.fillStyle = "#6b7684"; ctx.font = "10px ui-monospace, monospace"; ctx.textAlign = "center";
      ctx.fillText(gx, X(gx), h - 8);
    }
    ctx.fillStyle = "#9aa7b4"; ctx.textAlign = "left"; ctx.font = "11px system-ui";
    ctx.fillText("ψ(x)", padL + 2, padT + 4);
    ctx.textAlign = "right"; ctx.fillText("x →", w - padR, h - 8);

    // main term x - ln2pi (dashed)
    ctx.strokeStyle = "#3d4a5a"; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(X(XMIN), Y(XMIN - Math.log(2 * Math.PI)));
    ctx.lineTo(X(XMAX), Y(XMAX - Math.log(2 * Math.PI)));
    ctx.stroke(); ctx.setLineDash([]);

    // true staircase
    ctx.strokeStyle = "#8a94a6"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < stair.length; i++)
      (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(stair[i].x), Y(stair[i].y));
    ctx.stroke();

    // explicit-formula approximation
    ctx.strokeStyle = "#d16ba5"; ctx.lineWidth = 1.8;
    ctx.beginPath();
    const M = 700;
    for (let i = 0; i <= M; i++) {
      const x = XMIN + ((XMAX - XMIN) * i) / M;
      const y = ZM.psiExplicit(x, GAMMAS, nZeros);
      (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(x), Y(y));
    }
    ctx.stroke();
  }

  document.getElementById("nzSlider").addEventListener("input", (e) => {
    nZeros = parseInt(e.target.value, 10);
    document.getElementById("nzVal").textContent = nZeros;
    drawPsi();
  });

  // animation
  let animId = null;
  document.getElementById("animBtn").addEventListener("click", function () {
    if (animId) { cancelAnimationFrame(animId); animId = null; this.textContent = "▶ Animate"; return; }
    this.textContent = "⏸ Pause";
    const slider = document.getElementById("nzSlider");
    if (nZeros >= 100) { nZeros = 0; }
    const btn = this;
    let last = 0;
    const stepFn = (ts) => {
      if (ts - last > 90) {
        last = ts;
        nZeros = Math.min(100, nZeros + 1);
        slider.value = nZeros;
        document.getElementById("nzVal").textContent = nZeros;
        drawPsi();
        if (nZeros >= 100) { animId = null; btn.textContent = "▶ Animate"; return; }
      }
      animId = requestAnimationFrame(stepFn);
    };
    animId = requestAnimationFrame(stepFn);
  });

  /* ===== PANE B: divergent-partial-sum counter-demo ===== */
  const naiveCanvas = document.getElementById("naiveCanvas");
  let ndSigma = 0.5, ndT = 108.78, ndM = 2000;

  function drawNaive() {
    const { ctx, w, h } = setup(naiveCanvas, 240);
    ctx.clearRect(0, 0, w, h);
    const padL = 40, padR = 14, padT = 14, padB = 26;
    const plotW = w - padL - padR, plotH = h - padT - padB;

    const pts = ZM.naivePartials(ndSigma, ndT, ndM);
    const trueAbs = ZM.zetaAbs(ndSigma, ndT);
    let ymax = trueAbs;
    pts.forEach((p) => (ymax = Math.max(ymax, p.mag)));
    ymax *= 1.12;

    const X = (n) => padL + (plotW * (n - 1)) / (ndM - 1);
    const Y = (v) => padT + plotH - (plotH * v) / ymax;

    // grid
    ctx.strokeStyle = "#232c37"; ctx.lineWidth = 1;
    for (let gy = 0; gy <= ymax; gy += Math.max(1, Math.round(ymax / 4))) {
      ctx.beginPath(); ctx.moveTo(padL, Y(gy)); ctx.lineTo(w - padR, Y(gy)); ctx.stroke();
      ctx.fillStyle = "#6b7684"; ctx.font = "10px ui-monospace, monospace"; ctx.textAlign = "right";
      ctx.fillText(gy.toFixed(0), padL - 5, Y(gy) + 3);
    }
    ctx.fillStyle = "#9aa7b4"; ctx.textAlign = "left"; ctx.font = "11px system-ui";
    ctx.fillText("|partial sum|", padL + 2, padT + 2);
    ctx.textAlign = "right"; ctx.fillText("number of terms n →", w - padR, h - 8);

    // true |zeta| line
    ctx.strokeStyle = "#7ee081"; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(padL, Y(trueAbs)); ctx.lineTo(w - padR, Y(trueAbs)); ctx.stroke();
    ctx.setLineDash([]);

    // RS cutoff marker
    const cut = Math.floor(Math.sqrt(ndT / (2 * Math.PI)));
    if (cut >= 1 && cut <= ndM) {
      ctx.strokeStyle = "#f2b04a"; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(X(cut), padT); ctx.lineTo(X(cut), padT + plotH); ctx.stroke();
      ctx.fillStyle = "#f2b04a"; ctx.font = "10px ui-monospace, monospace"; ctx.textAlign = "left";
      ctx.fillText("n=" + cut, X(cut) + 4, padT + 12);
    }

    // partial-sum magnitude curve
    ctx.strokeStyle = "#5aa9e6"; ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++)
      (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(pts[i].n), Y(pts[i].mag));
    ctx.stroke();

    document.getElementById("nv-true").textContent = trueAbs.toFixed(3);
    document.getElementById("nv-partial").textContent = pts[pts.length - 1].mag.toFixed(3);
    document.getElementById("nv-cut").textContent = cut;
  }

  document.querySelectorAll("#sigmaSeg2 button").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll("#sigmaSeg2 button").forEach((x) => x.classList.remove("on"));
      b.classList.add("on"); ndSigma = parseFloat(b.dataset.s); drawNaive();
    });
  });
  document.getElementById("tInput").addEventListener("change", (e) => {
    const v = parseFloat(e.target.value);
    if (v > 1 && v < 5000) { ndT = v; drawNaive(); }
  });
  document.getElementById("mSlider").addEventListener("input", (e) => {
    ndM = parseInt(e.target.value, 10);
    document.getElementById("mVal").textContent = ndM;
    drawNaive();
  });

  let rz;
  window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { drawPsi(); drawNaive(); }, 120); });
  window.addEventListener("load", () => { drawPsi(); drawNaive(); });
  drawPsi(); drawNaive();
})();
