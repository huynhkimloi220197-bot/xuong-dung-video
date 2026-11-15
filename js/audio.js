// Âm thanh: đọc file, cắt tại khoảng lặng thật (đo sóng âm), nén khoảng lặng dài, cân âm lượng, trộn nhạc + tiếng động.
import { CHUAN } from './config.js';
export const SR = 48000;
const KH = 0.02; // 20ms / khung đo

let _ac = null;
const ac = () => (_ac ||= new AudioContext({ sampleRate: SR }));

// đọc âm thanh từ file (mp3, wav, m4a, hoặc tiếng trong video mp4/mov) → mono Float32 48k
export async function docAm(file) {
  const buf = await file.arrayBuffer();
  const ab = await ac().decodeAudioData(buf.slice(0));
  const n = ab.length, out = new Float32Array(n);
  for (let c = 0; c < ab.numberOfChannels; c++) { const d = ab.getChannelData(c); for (let i = 0; i < n; i++) out[i] += d[i] / ab.numberOfChannels; }
  return out;
}

export function dbKhung(x) {
  const m = Math.floor(KH * SR), n = Math.floor(x.length / m), e = new Float32Array(n);
  for (let k = 0; k < n; k++) { let s = 0; for (let i = k * m; i < (k + 1) * m; i++) s += x[i] * x[i]; e[k] = 10 * Math.log10(s / m + 1e-18); }
  return e;
}
const phanVi = (e, p) => { const s = Array.from(e).sort((a, b) => a - b); return s[Math.floor(p * (s.length - 1))]; };

// Tìm các đoạn GIỮ (giây, trên file gốc): cắt đầu/cuối tại im lặng thật (không cụt chữ),
// khoảng lặng giữa câu > nen_lang_toi_da thì rút còn nen_lang_con. tu,den = vùng xét (giây).
export function timGiu(x, { tu = 0, den = null, nenGiua = true, langToiDa = CHUAN.am.nen_lang_toi_da, langCon = CHUAN.am.nen_lang_con } = {}) {
  const e = dbKhung(x), k0 = Math.floor(tu / KH), k1 = Math.min(e.length, den == null ? e.length : Math.floor(den / KH));
  if (k1 - k0 < 3) return [];
  const nguong = phanVi(e, 0.1) + CHUAN.am.lang_db, co = i => e[i] > nguong;
  let dau = k0; while (dau < k1 && !co(dau)) dau++; let cuoi = k1 - 1; while (cuoi > dau && !co(cuoi)) cuoi--;
  if (dau >= k1) return [];
  dau = Math.max(k0, dau - 4); cuoi = Math.min(k1 - 1, cuoi + 4);          // đệm 80ms: đuôi chữ tắt dần không bị cụt
  const seg = []; let i = dau;   // các cụm có tiếng (cho phép hở 1 khung)
  while (i <= cuoi) { while (i <= cuoi && !co(i)) i++; if (i > cuoi) break; const a = i; while (i <= cuoi && (co(i) || (i + 1 <= cuoi && co(i + 1)))) i++; seg.push([a, i]); }
  const out = [];
  seg.forEach(([a, b], j) => {
    if (j === 0) { out.push([dau, b]); return; }
    const hở = a - out.at(-1)[1];
    if (nenGiua && hở * KH > langToiDa) { const g = Math.round(langCon / KH / 2); out.at(-1)[1] += g; out.push([a - g, b]); }
    else out.at(-1)[1] = b;
  });
  out.at(-1)[1] = cuoi + 1;
  return out.map(([p, q]) => [p * KH, q * KH]);
}
// ghép các đoạn giữ thành 1 mảng mẫu (mềm mép 12ms) + hàm đổi giờ gốc → giờ mới
export function ghep(x, giu) {
  const parts = giu.map(([a, b]) => x.subarray(Math.floor(a * SR), Math.floor(b * SR)));
  const n = parts.reduce((s, p) => s + p.length, 0), y = new Float32Array(n); let o = 0; const f = Math.floor(0.012 * SR);
  for (const p of parts) { y.set(p, o); for (let k = 0; k < f && k < p.length; k++) { y[o + k] *= k / f; y[o + p.length - 1 - k] *= k / f; } o += p.length; }
  return { x: y, doi: t => { let acc = 0; for (const [a, b] of giu) { if (t < a) return acc; if (t <= b) return acc + t - a; acc += b - a; } return acc; } };
}
// tương thích bản cũ
export function catLang(x, o = {}) {
  const giu = timGiu(x, o); if (!giu.length) return { x: x.slice(0, 1), doan: [] };
  const g = ghep(x, giu); let t = 0; const doan = giu.map(([a, b]) => { const r = [t, t + b - a]; t += b - a; return r; });
  return { x: g.x, doan, giu, doi: g.doi };
}

// cân giọng về −20 dBFS (đo trên phần có tiếng)
export function canGiong(x) {
  const e = dbKhung(x), ng = phanVi(e, 0.4); let s = 0, n = 0;
  e.forEach(v => { if (v > ng) { s += 10 ** (v / 10); n++; } });
  const rms = Math.sqrt(s / Math.max(1, n)), g = 10 ** (CHUAN.am.giong_dbfs / 20) / (rms + 1e-9);
  return x.map(v => v * g);
}

// trộn: tracks = [{x, t, gain}] → AudioBuffer stereo
export function tronAm(tong, tracks, nhac = null) {
  const N = Math.ceil(tong * SR), L = new Float32Array(N);
  for (const tr of tracks) { const s = Math.floor(tr.t * SR), g = tr.gain ?? 1; for (let i = 0; i < tr.x.length && s + i < N; i++) if (s + i >= 0) L[s + i] += tr.x[i] * g; }
  if (nhac) {
    const g = 10 ** ((CHUAN.am.giong_dbfs + CHUAN.am.nhac_db) / 20) / (rmsTB(nhac) + 1e-9), vao = SR * 1, ra = SR * 2.5;
    for (let i = 0; i < N; i++) { let k = g; if (i < vao) k *= i / vao; if (i > N - ra) k *= (N - i) / ra; L[i] += nhac[i % nhac.length] * k; }
  }
  let pk = 0; for (let i = 0; i < N; i++) pk = Math.max(pk, Math.abs(L[i]));
  const lim = 0.89; if (pk > lim) for (let i = 0; i < N; i++) L[i] *= lim / pk;   // chặn đỉnh
  const ab = new AudioBuffer({ length: N, numberOfChannels: 2, sampleRate: SR });
  ab.copyToChannel(L, 0); ab.copyToChannel(L, 1); return ab;
}
function rmsTB(x) { let s = 0; const step = 7; let n = 0; for (let i = 0; i < x.length; i += step) { s += x[i] * x[i]; n++; } return Math.sqrt(s / n); }

const _sfx = {};
export async function sfx(ten) {
  if (!_sfx[ten]) { const r = await fetch(`sfx/${ten}.mp3`); const ab = await ac().decodeAudioData(await r.arrayBuffer()); _sfx[ten] = ab.getChannelData(0).slice(); }
  return _sfx[ten];
}
export const db = d => 10 ** (d / 20);

// NHỊP NHẠC: tìm BPM + pha phách đầu (nhạc được trộn từ giây 0 nên phách nhạc = phách video)
export function timNhip(x) {
  const hop = 512, n = Math.min(Math.floor(x.length / hop) - 1, Math.floor(60 * SR / hop)); if (n < 200) return null;
  const e = new Float32Array(n); let truoc = 0;
  for (let i = 0; i < n; i++) { let s = 0; for (let j = i * hop; j < i * hop + 1024 && j < x.length; j++) s += x[j] * x[j]; const l = Math.log(1e-6 + s); e[i] = Math.max(0, l - truoc); truoc = l; }
  const fps = SR / hop; let tot = 0, P = 0;
  for (let bpm = 70; bpm <= 180; bpm += 0.5) {
    const lag = fps * 60 / bpm, li = Math.floor(lag), f = lag - li; let s = 0;
    for (let i = 0; i + li + 1 < n; i++) s += e[i] * (e[i + li] * (1 - f) + e[i + li + 1] * f);
    s *= Math.exp(-0.5 * (Math.log2(bpm / 120) / 0.9) ** 2);           // ưu tiên nhịp quanh 120
    if (s > tot) { tot = s; P = lag; }
  }
  let pha = 0, best = -1;
  for (let ph = 0; ph < P; ph++) { let s = 0; for (let k = ph; k < n; k += P) s += e[Math.round(k)] || 0; if (s > best) { best = s; pha = ph; } }
  return { nhip: P / fps, pha: pha / fps, bpm: Math.round(60 * fps / P) };
}
