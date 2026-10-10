// Objective audio metrics for rendered AudioBuffers (used by sfx loudness normalisation and QA).
//
//   analyze(buffer) -> {
//     duration, activeDur, peakDb, rmsDb, loudS,        // loudS: max short-term (200 ms) K-weighted loudness, LUFS-like
//     loudI,                                          // gated integrated loudness (BS.1770 style), for long renders
//     dc, nan, silent, centroid, hf8k,                // hf8k: fraction of spectral energy above 8 kHz
//   }

function kWeightCoeffs(fs) {
  // BS.1770 pre-filter (libebur128 formulation, valid at any sample rate)
  let f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196;
  let K = Math.tan(Math.PI * f0 / fs);
  const Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const s1 = {
    b: [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0],
    a: [2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0],
  };
  f0 = 38.13547087602444; Q = 0.5003270373238773; K = Math.tan(Math.PI * f0 / fs);
  a0 = 1 + K / Q + K * K;
  const s2 = { b: [1, -2, 1], a: [2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0] };
  return [s1, s2];
}
function biquad(x, { b, a }) {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k], ai = im[i + k];
        const br = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const bi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ar + br; im[i + k] = ai + bi;
        re[i + k + len / 2] = ar - br; im[i + k + len / 2] = ai - bi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

const db = (x) => (x > 0 ? 10 * Math.log10(x) : -Infinity);

export function analyze(buffer, { spectrum = true } = {}) {
  const sr = buffer.sampleRate;
  const chs = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) chs.push(buffer.getChannelData(c));
  const n = chs[0].length;
  let peak = 0, ss = 0, sum = 0, nan = 0;
  for (const d of chs) {
    for (let i = 0; i < n; i++) {
      const v = d[i];
      if (!Number.isFinite(v)) { nan++; continue; }
      const a = Math.abs(v);
      if (a > peak) peak = a;
      ss += v * v; sum += v;
    }
  }
  const total = n * chs.length;
  const rms = Math.sqrt(ss / total);

  // K-weighted short-term (200 ms window, 50 ms hop) and gated integrated loudness
  const [s1, s2] = kWeightCoeffs(sr);
  const kw = chs.map((d) => biquad(biquad(d, s1), s2));
  const blk = Math.floor(sr * 0.05);
  const nb = Math.floor(n / blk);
  const blockMs = new Float64Array(nb); // mean square per 50 ms block (sum over channels)
  for (let b = 0; b < nb; b++) {
    let acc = 0;
    for (const k of kw) for (let i = b * blk; i < (b + 1) * blk; i++) acc += k[i] * k[i];
    blockMs[b] = acc / blk;
  }
  let loudS = -Infinity;
  for (let b = 0; b + 4 <= nb; b++) {
    const m = (blockMs[b] + blockMs[b + 1] + blockMs[b + 2] + blockMs[b + 3]) / 4;
    loudS = Math.max(loudS, -0.691 + db(m));
  }
  if (nb < 4) {
    // shorter than one 200 ms window: treat as zero-padded window
    let acc = 0; for (const k of kw) for (let i = 0; i < n; i++) acc += k[i] * k[i];
    loudS = -0.691 + db(acc / (blk * 4));
  }
  // integrated: 400 ms windows (8 blocks), 75% overlap (hop 2 blocks), abs gate -70, rel gate -10
  const wins = [];
  for (let b = 0; b + 8 <= nb; b += 2) { let m = 0; for (let k = 0; k < 8; k++) m += blockMs[b + k]; wins.push(m / 8); }
  let loudI = -Infinity;
  if (wins.length) {
    const g1 = wins.filter((m) => -0.691 + db(m) > -70);
    if (g1.length) {
      const mean1 = g1.reduce((a, b) => a + b, 0) / g1.length;
      const rel = -0.691 + db(mean1) - 10;
      const g2 = g1.filter((m) => -0.691 + db(m) > rel);
      if (g2.length) loudI = -0.691 + db(g2.reduce((a, b) => a + b, 0) / g2.length);
    }
  }

  // active duration: last 10 ms block within 50 dB of the loudest block
  const blk10 = Math.floor(sr * 0.01);
  let maxB = 0; const b10 = [];
  for (let i = 0; i + blk10 <= n; i += blk10) {
    let a = 0; for (const d of chs) for (let k = i; k < i + blk10; k++) a += d[k] * d[k];
    b10.push(a); if (a > maxB) maxB = a;
  }
  let first = -1, last = -1;
  for (let i = 0; i < b10.length; i++) if (b10[i] > maxB * 1e-5) { if (first < 0) first = i; last = i; }
  const activeDur = first < 0 ? 0 : ((last - first + 1) * blk10) / sr;

  // average power spectrum over the active region
  const N = 4096;
  const spec = new Float64Array(N / 2);
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
  const s0 = Math.max(0, first * blk10), s1e = Math.max(s0 + N, (last + 1) * blk10);
  let frames = 0;
  for (let start = s0; spectrum && start < Math.min(n, s1e); start += N / 2) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      let v = 0; for (const d of chs) v += start + i < n ? d[start + i] || 0 : 0;
      re[i] = (v / chs.length) * win[i];
    }
    fft(re, im);
    for (let k = 0; k < N / 2; k++) spec[k] += re[k] * re[k] + im[k] * im[k];
    frames++;
    if (frames > 400) break;
  }
  let pt = 0, pf = 0, phf = 0;
  for (let k = 1; k < N / 2; k++) {
    const f = (k * sr) / N;
    pt += spec[k]; pf += spec[k] * f; if (f > 8000) phf += spec[k];
  }
  return {
    duration: n / sr,
    activeDur,
    peakDb: 20 * Math.log10(Math.max(peak, 1e-12)),
    rmsDb: 20 * Math.log10(Math.max(rms, 1e-12)),
    loudS,
    loudI,
    dc: sum / total,
    nan,
    silent: peak < 1e-5,
    centroid: pt > 0 ? pf / pt : 0,
    hf8k: pt > 0 ? phf / pt : 0,
  };
}
