/* =====================================================================
 * mathlib.js  —  shared numerical core for the Zeta–Temperament explorer
 *
 * Everything the three panes need, in dependency-free vanilla JS:
 *   - complex arithmetic
 *   - zeta(sigma, t)         via Euler–Maclaurin  (works for any sigma)
 *   - riemannSiegelZ(t)      the real Z-function on the critical line
 *   - rsPartials(t)          term-by-term buildup for the "truncated arrows" demo
 *   - naivePartials(sigma,t) the DIVERGENT sum-of-arrows, for the counter-demo
 *   - rttReport(N, primes)   patent val, per-prime errors, TE badness
 *   - setharesPair / setharesTotal / dissonanceCurve
 *   - the EDO<->height map  t = 2*pi*N / ln2
 *
 * Exposed as the global object  window.ZM.
 * ===================================================================== */
(function (root) {
  "use strict";

  const PI = Math.PI;
  const LN2 = Math.log(2);
  const TWO_PI = 2 * PI;

  /* -------------------- complex arithmetic -------------------- */
  // complex numbers are plain {re, im}
  const C = (re, im) => ({ re: re, im: im || 0 });
  const cadd = (a, b) => ({ re: a.re + b.re, im: a.im + b.im });
  const csub = (a, b) => ({ re: a.re - b.re, im: a.im - b.im });
  const cmul = (a, b) => ({
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  });
  const cscale = (a, k) => ({ re: a.re * k, im: a.im * k });
  const cdiv = (a, b) => {
    const d = b.re * b.re + b.im * b.im;
    return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
  };
  const cabs = (a) => Math.hypot(a.re, a.im);
  const carg = (a) => Math.atan2(a.im, a.re);
  const cexp = (a) => {
    const e = Math.exp(a.re);
    return { re: e * Math.cos(a.im), im: e * Math.sin(a.im) };
  };
  const clog = (a) => ({ re: Math.log(cabs(a)), im: carg(a) });

  // n^{-s} for real integer n>=1 and s = sigma+it.  Cheap closed form.
  function nPowNegS(n, sigma, t) {
    const lg = Math.log(n);
    const mag = Math.pow(n, -sigma);
    return { re: mag * Math.cos(t * lg), im: -mag * Math.sin(t * lg) };
  }

  /* -------------------- zeta via Euler–Maclaurin -------------------- */
  // B_{2k}/(2k)!  coefficients for k = 1..4
  const EM_C = [1 / 12, -1 / 720, 1 / 30240, -1 / 1209600];

  // zeta(sigma + i t) for sigma in (0, ~2], t >= 0.  Accurate to ~1e-9
  // across the plotted range.  For sigma=1 there is a pole at t=0 handled
  // by the caller (we never sample exactly t=0 there).
  function zeta(sigma, t) {
    const s = { re: sigma, im: t };
    // number of direct terms: needs N to exceed ~t/(2*pi) for convergence
    const N = Math.max(18, Math.ceil(Math.abs(t) / TWO_PI) + 12);

    // sum_{n=1}^{N-1} n^{-s}
    let sum = { re: 0, im: 0 };
    for (let n = 1; n < N; n++) sum = cadd(sum, nPowNegS(n, sigma, t));

    // + (1/2) N^{-s}
    const NnegS = nPowNegS(N, sigma, t);
    sum = cadd(sum, cscale(NnegS, 0.5));

    // + N^{1-s}/(s-1)
    const oneMinusS = { re: 1 - sigma, im: -t };
    // N^{1-s} = exp((1-s) ln N)
    const lnN = Math.log(N);
    const N1minusS = cexp({ re: oneMinusS.re * lnN, im: oneMinusS.im * lnN });
    sum = cadd(sum, cdiv(N1minusS, { re: sigma - 1, im: t }));

    // Bernoulli correction terms
    // term_k = C_k * (prod_{j=0}^{2k-2}(s+j)) * N^{-(s+2k-1)}
    let poly = { re: 1, im: 0 }; // running product of (s+j)
    for (let k = 1; k <= EM_C.length; k++) {
      const jmax = 2 * k - 2;
      // extend poly to include factors up to (s + jmax); poly already has
      // factors s..(s+2(k-1)-2) = s..(s+2k-4); add (s+2k-3) and (s+2k-2)
      for (let j = 2 * (k - 1) - 1; j <= jmax; j++) {
        if (j < 0) continue;
        poly = cmul(poly, { re: sigma + j, im: t });
      }
      // N^{-(s+2k-1)} = exp(-(s+2k-1) ln N)
      const expo = { re: -(sigma + 2 * k - 1), im: -t };
      const Npow = cexp({ re: expo.re * lnN, im: expo.im * lnN });
      sum = cadd(sum, cscale(cmul(poly, Npow), EM_C[k - 1]));
    }
    return sum;
  }

  const zetaAbs = (sigma, t) => cabs(zeta(sigma, t));

  /* -------------------- Riemann–Siegel Z(t) -------------------- */
  // theta(t): Riemann–Siegel theta, asymptotic expansion
  function rsTheta(t) {
    return (
      (t / 2) * Math.log(t / TWO_PI) -
      t / 2 -
      PI / 8 +
      1 / (48 * t) +
      7 / (5760 * t * t * t)
    );
  }

  // main-sum truncation index
  function rsN(t) {
    return Math.floor(Math.sqrt(t / TWO_PI));
  }

  // leading Riemann–Siegel remainder correction
  function rsRemainder(t) {
    const a = Math.sqrt(t / TWO_PI);
    const Nrs = Math.floor(a);
    const p = a - Nrs;
    const psi =
      Math.cos(TWO_PI * (p * p - p - 1 / 16)) / Math.cos(TWO_PI * p);
    const sign = (Nrs - 1) % 2 === 0 ? 1 : -1;
    return sign * Math.pow(a, -0.5) * psi;
  }

  // Z(t) = 2 sum_{n<=Nrs} n^{-1/2} cos(theta - t ln n) + remainder
  function riemannSiegelZ(t) {
    if (t < 1) return zeta(0.5, t).re * 2; // tiny-t fallback (rarely used)
    const th = rsTheta(t);
    const Nrs = rsN(t);
    let s = 0;
    for (let n = 1; n <= Nrs; n++) {
      s += Math.cos(th - t * Math.log(n)) / Math.sqrt(n);
    }
    return 2 * s + rsRemainder(t);
  }

  // term-by-term cumulative partial sums of the (truncated, convergent)
  // Riemann–Siegel main sum — this is the HONEST "sum of arrows" picture.
  // returns {Nrs, cumulative:[...], value} where cumulative[k] is the
  // running 2*sum with remainder added at the end.
  function rsPartials(t) {
    const th = rsTheta(t);
    const Nrs = rsN(t);
    const cumulative = [];
    let s = 0;
    for (let n = 1; n <= Nrs; n++) {
      s += Math.cos(th - t * Math.log(n)) / Math.sqrt(n);
      cumulative.push(2 * s);
    }
    const rem = rsRemainder(t);
    return { Nrs, cumulative, value: 2 * s + rem, remainder: rem };
  }

  // The NAIVE, DIVERGENT partial sums of  sum n^{-sigma - i t}, as complex
  // running vectors.  On the critical line (sigma=1/2) the magnitude does
  // NOT settle — this is the counter-demo that breaks the naive picture.
  function naivePartials(sigma, t, M) {
    const pts = [];
    let acc = { re: 0, im: 0 };
    for (let n = 1; n <= M; n++) {
      acc = cadd(acc, nPowNegS(n, sigma, t));
      pts.push({ n, re: acc.re, im: acc.im, mag: cabs(acc) });
    }
    return pts;
  }

  /* -------------------- EDO <-> height map -------------------- */
  const edoToHeight = (N) => (TWO_PI * N) / LN2; // t = 2*pi*N/ln2
  const heightToEdo = (t) => (t * LN2) / TWO_PI;

  // find the local |Z| peak nearest the pure-octave height for EDO N,
  // returns {tPeak, nEff, octaveCents} describing the small octave stretch.
  function zetaPeakNear(N) {
    const t0 = edoToHeight(N);
    const span = TWO_PI / LN2 * 0.35; // ~0.35 EDO either side
    let best = { t: t0, z: -Infinity };
    const steps = 400;
    for (let i = 0; i <= steps; i++) {
      const t = t0 - span + (2 * span * i) / steps;
      const z = Math.abs(riemannSiegelZ(t));
      if (z > best.z) best = { t, z };
    }
    // golden refine
    let lo = best.t - (2 * span) / steps;
    let hi = best.t + (2 * span) / steps;
    for (let i = 0; i < 40; i++) {
      const m1 = lo + (hi - lo) * 0.382;
      const m2 = lo + (hi - lo) * 0.618;
      if (Math.abs(riemannSiegelZ(m1)) > Math.abs(riemannSiegelZ(m2))) hi = m2;
      else lo = m1;
    }
    const tPeak = (lo + hi) / 2;
    const nEff = heightToEdo(tPeak);
    // stretched octave: N steps map to a slightly-off ratio; octave in cents
    const octaveCents = 1200 * (N / nEff);
    return { tPeak, nEff, octaveCents, zAtPeak: Math.abs(riemannSiegelZ(tPeak)) };
  }

  /* -------------------- Regular temperament theory -------------------- */
  const DEFAULT_PRIMES = [2, 3, 5, 7, 11, 13];

  // patent val + per-prime error report for N-EDO
  function rttReport(N, primes) {
    primes = primes || DEFAULT_PRIMES;
    const step = 1200 / N; // cents per step
    const rows = primes.map((p) => {
      const l2 = Math.log2(p);
      const just = 1200 * l2;
      const steps = Math.round(N * l2); // patent-val entry
      const approx = steps * step;
      const errCents = approx - just; // signed cents error
      const weight = 1 / l2; // Tenney weight
      const wErr = errCents / l2; // weighted (cents/octave-ish)
      return { p, l2, just, steps, approx, errCents, weight, wErr };
    });
    // TE-style RMS of weighted errors (skip the octave, which is exact by
    // construction for a patent val, but include it — it's ~0 anyway)
    let ss = 0;
    rows.forEach((r) => (ss += r.wErr * r.wErr));
    const teRms = Math.sqrt(ss / rows.length); // relative error, cents
    // simple "badness" ~ error * complexity(N)
    const badness = teRms * Math.log2(N);
    return { N, step, rows, teRms, badness, val: rows.map((r) => r.steps) };
  }

  /* -------------------- Sethares dissonance -------------------- */
  // sensory dissonance of a single pair of pure tones (Sethares 1998)
  function setharesPair(f1, a1, f2, a2) {
    if (f1 > f2) {
      [f1, f2] = [f2, f1];
      [a1, a2] = [a2, a1];
    }
    const b1 = 3.5,
      b2 = 5.75,
      dstar = 0.24,
      s1 = 0.0207,
      s2 = 18.96;
    const s = dstar / (s1 * f1 + s2);
    const df = f2 - f1;
    const l = Math.min(a1, a2); // loudness weighting
    return l * (Math.exp(-b1 * s * df) - Math.exp(-b2 * s * df));
  }

  // total dissonance of a collection of tones, each an array of partials
  // tones = [ [{f,a},{f,a},...], [...], ... ]
  function setharesTotal(tones) {
    const parts = [];
    tones.forEach((t) => t.forEach((p) => parts.push(p)));
    let d = 0;
    for (let i = 0; i < parts.length; i++)
      for (let j = i + 1; j < parts.length; j++)
        d += setharesPair(parts[i].f, parts[i].a, parts[j].f, parts[j].a);
    return d;
  }

  // build a harmonic timbre: nPartials with 1/k amplitude rolloff (rolloff
  // parameter r: amplitude of partial k = r^{(k-1)})
  function harmonicTimbre(f0, nPartials, rolloff) {
    const parts = [];
    for (let k = 1; k <= nPartials; k++) {
      parts.push({ f: f0 * k, a: Math.pow(rolloff, k - 1) });
    }
    return parts;
  }

  // dissonance curve: sweep a second tone from ratio 1..maxRatio against a
  // fixed root, both with the same timbre.
  function dissonanceCurve(f0, nPartials, rolloff, maxRatio, samples) {
    const root = harmonicTimbre(f0, nPartials, rolloff);
    const xs = [],
      ys = [];
    for (let i = 0; i <= samples; i++) {
      const r = 1 + ((maxRatio - 1) * i) / samples;
      const other = harmonicTimbre(f0 * r, nPartials, rolloff);
      xs.push(r);
      ys.push(setharesTotal([root, other]));
    }
    return { xs, ys };
  }

  /* -------------------- explicit formula for psi(x) -------------------- */
  // psi0(x) = x - sum_rho x^rho/rho - ln(2pi) - 1/2 ln(1 - x^{-2})
  // using the first `nZeros` nontrivial zeros (paired with conjugates).
  // ZEROS list is imaginary parts gamma>0 (loaded from zeros.js).
  function psiExplicit(x, gammas, nZeros) {
    const lnx = Math.log(x);
    let main = x - Math.log(TWO_PI) - 0.5 * Math.log(1 - 1 / (x * x));
    let zeroSum = 0;
    const m = Math.min(nZeros, gammas.length);
    for (let k = 0; k < m; k++) {
      const g = gammas[k];
      // rho = 1/2 + i g ; contribution of rho and conjugate:
      // x^rho/rho + x^{rhobar}/rhobar = 2 Re( x^rho / rho )
      // x^rho = x^{1/2} e^{i g ln x}
      const mag = Math.sqrt(x);
      const xr = { re: mag * Math.cos(g * lnx), im: mag * Math.sin(g * lnx) };
      const rho = { re: 0.5, im: g };
      const term = cdiv(xr, rho);
      zeroSum += 2 * term.re;
    }
    return main - zeroSum;
  }

  // the true Chebyshev psi(x) = sum_{p^k <= x} ln p  (step function)
  function psiTrue(x) {
    let s = 0;
    const limit = Math.floor(x);
    // sieve primes up to x
    const isP = new Uint8Array(limit + 1).fill(1);
    isP[0] = 0;
    if (limit >= 1) isP[1] = 0;
    for (let i = 2; i * i <= limit; i++)
      if (isP[i]) for (let j = i * i; j <= limit; j += i) isP[j] = 0;
    for (let p = 2; p <= limit; p++) {
      if (!isP[p]) continue;
      let pk = p;
      while (pk <= x) {
        s += Math.log(p);
        pk *= p;
      }
    }
    return s;
  }

  /* -------------------- exports -------------------- */
  root.ZM = {
    // constants
    PI, LN2, TWO_PI,
    // complex
    C, cadd, csub, cmul, cdiv, cscale, cabs, carg, cexp, clog,
    // zeta
    zeta, zetaAbs, riemannSiegelZ, rsTheta, rsN, rsPartials, naivePartials,
    // maps
    edoToHeight, heightToEdo, zetaPeakNear,
    // rtt
    DEFAULT_PRIMES, rttReport,
    // sethares
    setharesPair, setharesTotal, harmonicTimbre, dissonanceCurve,
    // explicit formula
    psiExplicit, psiTrue,
  };
})(window);
