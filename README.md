# Zeta &amp; Temperament — an interactive learning tool

A dependency-free static website for learning the **Riemann zeta ↔ equal-temperament
correspondence** from a signal-processing point of view: build the intuition, then flag
exactly where it breaks.

Everything is computed live in the browser — no build step, no servers, no libraries.
Open `index.html` (or serve the folder) and go.

## Pages

| Page | What it does |
|------|--------------|
| **`index.html`** | Overview, the one-paragraph story, and the "rigorous vs heuristic vs numerical" framing. |
| **`explorer.html`** | The three-pane explorer. **Zeta pane:** \|Z(t)\| along the critical line with the x-axis relabeled as EDO number `N = t·ln2/2π`; draggable cursor, peak-snap, a σ ∈ {½, ¾, 1} toggle, and a live Riemann–Siegel phasor diagram. **Temperament pane:** patent val, per-prime tuning errors, and TE-weighted badness for the selected EDO. **Audio pane:** Web-Audio synthesis of a chord in just intonation vs its N-EDO approximation, an adjustable partial count, and a Sethares dissonance curve marking where the JI and EDO intervals fall. |
| **`explicit.html`** | The explicit-formula companion. Add zeta zeros one at a time (or animate) and watch ψ(x) assemble out of waves; plus the counter-demo that **breaks** the naive "sum of arrows" picture — the divergent partial sums of Σ n^(−½−it) on the critical line vs the true \|ζ\| and the Riemann–Siegel cutoff. |
| **`reference.html`** | The corrected number-theory fact base (RH verification height, % on the line, Skewes, Mertens), the minimum-viable complex-analysis syllabus, the two open research questions, and a staged Mazur–Stein → Stein–Shakarchi → Edwards reading path. |

## The numerical core (`js/mathlib.js`)

- `zeta(σ, t)` — ζ(σ+it) by **Euler–Maclaurin** (≈1e−7 across the plotted range, any σ).
- `riemannSiegelZ(t)` / `rsPartials(t)` — the real **Z-function** and its finite term-by-term buildup.
- `naivePartials(σ, t, M)` — the **divergent** Dirichlet partial sums, for the counter-demo.
- `zetaPeakNear(N)` — golden-section search for the \|Z\| peak and the implied octave stretch.
- `rttReport(N, primes)` — patent val, per-prime errors, TE-weighted RMS, badness.
- `setharesPair` / `dissonanceCurve` — sensory-dissonance model (Sethares 1998).
- `psiExplicit` / `psiTrue` — the explicit formula and the true Chebyshev ψ(x) staircase.

`js/zeros.js` holds the imaginary parts of the first 100 nontrivial zeros (Odlyzko/LMFDB).

## What this tool is honest about

The identity |ζ(σ+it)|² = (a Tenney-weighted error metric over rationals) is **real
mathematics for σ > 1**. Extending it to the critical line σ = ½ is **analytic
continuation, not a theorem about tuning** — the peaks-are-EDOs match is an excellent
*numerical* fit. Telling those apart is the whole point; the explicit-formula counter-demo
and the reference caveats keep it straight.

The first peer-reviewed treatment is A. Guillet, *Journal of Mathematics and Music* (2026),
DOI 10.1080/17459737.2026.2628778.

## Running locally

```sh
# any static server works, e.g.
python3 -m http.server 8000
# then open http://localhost:8000/
```

Or just open `index.html` directly in a browser.
