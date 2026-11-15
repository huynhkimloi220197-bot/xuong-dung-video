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
  [/\b(Op-?op|Ốp-?ốp|Ô ?pô|Ốp ?pô ?pô)\b/gi, 'OPPO'],
  [/\b(file|fine|phai|fai|find|phải)\s+(?:X\s*|ích\s*)?(\d{1,2})\b/gi, (m, a, n) => 'Find X' + (n.length === 2 && n[0] === '1' && n[1] !== '0' ? n[1] : n)],   // "file 19" → Find X9
  [/\bColor\s*(Work|Wat|Watt|What|Web|Wap|Wak|Ốt|ô ét|OS)?\s+(\d{1,2})\b/gi, 'ColorOS $2'], [/\bColor ?(Work|Wat|Watt|What)\b/gi, 'ColorOS'],
  [/\bKenp\b/gi, 'kênh'], [/\b(FI|Fi|Phi|Phí|phá|Phá|Fai)[- ]?X ?(\d+)/g, 'Find X$2'], [/\bColor ?(West|Wes|Quét|Ướt)\b/gi, 'ColorOS'],
  [/\bgèm\b/gi, 'rèm'], [/\bHình nên\b/gi, 'Hình nền'], [/\bcầm mày\b/gi, 'cầm máy'], [/\btời\b/gi, 'trời'], [/\bxáng\b/gi, 'sáng'], [/\bđang bưa\b/gi, 'đang mưa'], [/\bop ?4 ?(phái|phải|fai)\s*(\d)\b/gi, 'OPPO Find X$2'], [/\b(phái|phải) chính\b/gi, 'Find X9'], [/\bColor ?s ?(\d{1,2})\b/gi, 'ColorOS $1'],
  [/\b(sẽ|ta|rồi|và|bạn) trọng\b/gi, '$1 chọn'], [/\bthởi tiếp|thời tiếp\b/gi, 'thời tiết'], [/\blà sông\b/gi, 'là xong'], [/\btính (lang|nóng|nang)\b/gi, 'tính năng'],
  [/\bbị luật\b/gi, 'bình luận'], [/\bchia sạc\b/gi, 'chia sẻ'], [/\bbiểu tường\b/gi, 'biểu tượng'], [/\bviên bản\b/gi, 'phiên bản'], [/\bsạch phẩm\b/gi, 'sản phẩm'], [/\bbiến năng\b/gi, 'tính năng'],
  [/\bColorOS (6|7)\b/g, 'ColorOS 1$1'],   // "Color Work 7" = ColorOS 17 (bản 6/7 đã cũ)
  [/\b(Renault|Re no|Rê nô|Reino)\s*(\d+)/gi, 'Reno$2'], [/\b(Fire|Phai|Fai|Fight|Phải)\s*X\s*(\d+)/gi, 'Find X$2'],
  [/\b(Ốp ?pô|Óp ?pô|Ốp ?bô|Oppo|ốp pồ)\b/gi, 'OPPO'], [/\b(Color ?OS|Cô ?lơ ?ô ?ét|Colo OS|colorOS)\s*(\d*)/gi, (m, a, n) => 'ColorOS' + (n ? ' ' + n : '')],
  [/\bflag\b/gi, 'Flux'], [/\bbiểu tưởng\b/gi, 'biểu tượng'], [/\bdèm\b/gi, 'rèm'], [/\bA(\d) ?Pro\b/gi, 'A$1 Pro'],
  [/\bColorOS (6|7)\b/g, 'ColorOS 1$1'], [/\bTik ?Tok\b/gi, 'TikTok'], [/\bsub ?scribe\b/gi, ''], [/Ghiền Mì Gõ/gi, ''],
];
export const suaChu = t => SUA.reduce((s, [a, b]) => s.replace(a, b), t).replace(/\s+/g, ' ').trim();
const NHAN = /^(OPPO|Find|X\d+|Reno\d*|ColorOS|\d+[\d.,]*%?|AI|Flux|5G|[A-Z]\d+)$/i;

// x: mono 48k. Trả danh sách chữ [{chu, us, ue, nhan}] theo giây trên x
// nhớ kết quả nghe trên máy (IndexedDB): mở lại trang không phải nghe lại
const _db = () => new Promise((ok, loi) => { const q = indexedDB.open('xuong_dung', 1); q.onupgradeneeded = () => q.result.createObjectStore('nghe'); q.onsuccess = () => ok(q.result); q.onerror = () => loi(q.error); });
async function nhoLay(k) { try { const d = await _db(); return await new Promise(ok => { const q = d.transaction('nghe').objectStore('nghe').get(k); q.onsuccess = () => ok(q.result); q.onerror = () => ok(null); }); } catch { return null; } }
async function nhoGhi(k, v) { try { const d = await _db(); d.transaction('nghe', 'readwrite').objectStore('nghe').put(v, k); } catch { } }
export async function nghe(x, bao = () => {}, khoa = null) {
  if (x.length < SR * 0.4) return [];
  _bao = bao; const kk = khoa && `${khoa}|${MO_HINH}`;
  let chunks = kk ? await nhoLay(kk) : null;
  if (chunks) bao('Đã nhớ phụ đề từ lần trước'); else { chunks = await goiNghe(ha16(x)); if (kk) nhoGhi(kk, chunks); }
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
