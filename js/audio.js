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

// Trả { x: mẫu đã cắt, doan: [[t0,t1],...] các đoạn có tiếng (giây, trên mẫu mới) }
// - cắt đầu/cuối tại im lặng thật (không cụt chữ), chừa đệm
// - khoảng lặng giữa câu > nen_lang_toi_da thì rút còn nen_lang_con (nhịp gọn, không đổi giọng)
export function catLang(x, { nenGiua = true } = {}) {
  const e = dbKhung(x); if (!e.length) return { x, doan: [] };
  const nguong = phanVi(e, 0.1) + CHUAN.am.lang_db, coTieng = Array.from(e, v => v > nguong);
  let dau = coTieng.indexOf(true), cuoi = coTieng.lastIndexOf(true);
  if (dau < 0) return { x: x.slice(0, 1), doan: [] };
  dau = Math.max(0, dau - 4); cuoi = Math.min(e.length - 1, cuoi + 4);   // đệm 80ms, phần đuôi tắt dần không bị cụt
  // gom các đoạn có tiếng
  const doanGoc = []; let i = dau;
  while (i <= cuoi) {
    while (i <= cuoi && !coTieng[i]) i++; if (i > cuoi) break; const a = i;
    while (i <= cuoi && (coTieng[i] || (i + 1 <= cuoi && coTieng[i + 1]))) i++; doanGoc.push([a, i]);
  }
  const m = Math.floor(KH * SR), parts = [], doan = []; let t = 0;
  const lay = (k0, k1) => { const s = x.subarray(k0 * m, k1 * m); parts.push(s); return s.length / SR; };
  let truoc = dau;
  doanGoc.forEach(([a, b], j) => {
    const lang = (a - truoc) * KH;
    if (j === 0) t += lay(dau, a);
    else if (nenGiua && lang > CHUAN.am.nen_lang_toi_da) { const giu = Math.round(CHUAN.am.nen_lang_con / KH / 2); t += lay(truoc, truoc + giu); t += lay(a - giu, a); }
    else t += lay(truoc, a);
    const t0 = t; t += lay(a, b); doan.push([t0, t]); truoc = b;
  });
  t += lay(truoc, cuoi + 1);
  const tong = parts.reduce((s, p) => s + p.length, 0), y = new Float32Array(tong); let o = 0;
  for (const p of parts) { y.set(p, o); o += p.length; }
  const f = Math.floor(0.012 * SR); for (let k = 0; k < f && k < y.length; k++) { y[k] *= k / f; y[y.length - 1 - k] *= k / f; }
  return { x: y, doan };
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
