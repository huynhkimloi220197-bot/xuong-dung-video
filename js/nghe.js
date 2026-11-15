// Nghe giọng ra phụ đề — Whisper chạy ngay trong trình duyệt (transformers.js). Lần đầu tải mô hình, sau đó trình duyệt nhớ.
import { SR } from './audio.js';
// Whisper chạy trong Worker (luồng riêng) → trang không đơ. Mặc định bản nhẹ "base" (~80MB),
// cài đặt "Phụ đề chính xác hơn" dùng bản "small" (~250MB). Trình duyệt tự lưu, chỉ tải lần đầu.
let _w = null, _id = 0; const _cho = new Map(); let _bao = () => {};
function worker() {
  if (_w) return _w;
  _w = new Worker(new URL('./nghe-worker.js', import.meta.url), { type: 'module' });
  _w.onmessage = ({ data }) => {
    if (data.loai === 'tien') return _bao(data.chu);
    const c = _cho.get(data.id); if (!c) return; _cho.delete(data.id);
    data.loai === 'xong' ? c.ok(data.chunks) : c.loi(new Error(data.chu));
  };
  return _w;
}
export let MO_HINH = 'whisper-base';
export const datMoHinh = chinhXac => { MO_HINH = chinhXac ? 'whisper-small' : 'whisper-base'; };
function goiNghe(audio16) { const id = ++_id; return new Promise((ok, loi) => { _cho.set(id, { ok, loi }); worker().postMessage({ id, audio: audio16, model: MO_HINH }, [audio16.buffer]); }); }

// 48k → 16k (trung bình 3 mẫu)
function ha16(x) { const n = Math.floor(x.length / 3), y = new Float32Array(n); for (let i = 0; i < n; i++) y[i] = (x[3 * i] + x[3 * i + 1] + x[3 * i + 2]) / 3; return y; }

// sửa tên riêng hay nghe sai (thêm dần khi gặp)
const SUA = [
  [/\b(Renault|Re no|Rê nô|Reino)\s*(\d+)/gi, 'Reno$2'], [/\b(Fire|Phai|Fai|Fight|Phải)\s*X\s*(\d+)/gi, 'Find X$2'],
  [/\b(Ốp ?pô|Óp ?pô|Ốp ?bô|Oppo|ốp pồ)\b/gi, 'OPPO'], [/\b(Color ?OS|Cô ?lơ ?ô ?ét|Colo OS|colorOS)\s*(\d*)/gi, (m, a, n) => 'ColorOS' + (n ? ' ' + n : '')],
  [/\bflag\b/gi, 'Flux'], [/\bbiểu tưởng\b/gi, 'biểu tượng'], [/\bdèm\b/gi, 'rèm'], [/\bA(\d) ?Pro\b/gi, 'A$1 Pro'],
  [/\bTik ?Tok\b/gi, 'TikTok'], [/\bsub ?scribe\b/gi, ''], [/Ghiền Mì Gõ/gi, ''],
];
export const suaChu = t => SUA.reduce((s, [a, b]) => s.replace(a, b), t).replace(/\s+/g, ' ').trim();
const NHAN = /^(OPPO|Find|X\d+|Reno\d*|ColorOS|\d+[\d.,]*%?|AI|Flux|5G|[A-Z]\d+)$/i;

// x: mono 48k. Trả danh sách chữ [{chu, us, ue, nhan}] theo giây trên x
export async function nghe(x, bao = () => {}) {
  if (x.length < SR * 0.4) return [];
  _bao = bao; const chunks = await goiNghe(ha16(x));
  const dur = x.length / SR, ws = [];
  for (const c of chunks) {
    const txt = suaChu(c.text || ''); if (!txt) continue;
    const a = c.timestamp?.[0] ?? 0, b = Math.min(dur, c.timestamp?.[1] ?? dur), tu = txt.split(' ');
    const tong = tu.reduce((s, w) => s + w.length + 1, 0); let acc = 0;
    for (const w of tu) { const us = a + (b - a) * acc / tong; acc += w.length + 1; ws.push({ chu: w, us, ue: a + (b - a) * acc / tong, nhan: NHAN.test(w.replace(/[,.?!]/g, '')) }); }
  }
  return ws;
}

// gom chữ thành cụm ≤5 chữ hoặc ngắt ở dấu câu
export function gomCum(ws) {
  const cum = []; let cur = [];
  for (const w of ws) { cur.push(w); if (cur.length >= 5 || /[,.?!]$/.test(w.chu)) { cum.push(cur); cur = []; } }
  if (cur.length) cum.push(cur); return cum;
}
