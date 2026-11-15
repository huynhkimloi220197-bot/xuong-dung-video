// TỰ ĐỘNG EDIT: phân tích clip → lập kế hoạch dựng → dựng & xuất. Không áp khuôn nội dung:
// giữ đúng thứ tự file, chỉ làm phần kỹ thuật (cắt lặng, bỏ đoạn tối, phụ đề, màu, tiếng, chuyển cảnh).
import { Input, BlobSource, ALL_FORMATS, CanvasSink, AudioBufferSink, Output, Mp4OutputFormat, BufferTarget, CanvasSource, AudioBufferSource, canEncodeAudio } from '../vendor/mediabunny.mjs';
import { CHUAN } from './config.js';
import * as E from './effects.js';
import { docAm, timGiu, ghep, canGiong, tronAm, sfx, db, SR, dbKhung } from './audio.js';
import { nghe, gomCum } from './nghe.js';
import { daoDien } from './daodien.js';
import { veHieu, TIENG } from './hieuung.js';

// ---------- mở & phân tích 1 file ----------
const _cache = new Map();
export async function phanTich(file, bao = () => {}, { phuDe = true } = {}) {
  const k = file.name + file.size + file.lastModified; if (_cache.has(k)) return _cache.get(k);
  const laAm = file.type.startsWith('audio') || /\.(mp3|wav|m4a|aac|ogg)$/i.test(file.name);
  const r = { file, ten: file.name, laAm };
  let am = null; try { am = await docAmLuong(file); } catch (e) { try { am = await docAm(file); } catch { } }
  if (!laAm) {
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    const track = await input.getPrimaryVideoTrack(); if (!track) throw new Error(`"${file.name}" không đọc được hình`);
    r.track = track; r.dur = await input.computeDuration(); r.w = await track.getDisplayWidth(); r.h = await track.getDisplayHeight();
    r.sink = new CanvasSink(track, { width: CHUAN.W, height: CHUAN.H, fit: 'cover', poolSize: 3 });
    // độ sáng theo thời gian (bỏ đoạn tối đầu/cuối) + thông số chỉnh màu
    const nho = new CanvasSink(track, { width: 36, height: 64, fit: 'cover' }), ts = [];
    for (let t = 0; t < r.dur; t += 0.25) ts.push(t);
    const sang = []; let tong = 0, n = 0;
    for await (const w of nho.canvasesAtTimestamps(ts)) {
      if (!w) { sang.push(0); continue; }
      const d = w.canvas.getContext('2d').getImageData(0, 0, 36, 64).data; let s = 0;
      for (let i = 0; i < d.length; i += 4) s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const m = s / (d.length / 4); sang.push(m); tong += m; n++;
    }
    let a = 0; while (a < sang.length - 1 && sang[a] < 28) a++; let b = sang.length - 1; while (b > a && sang[b] < 28) b--;
    r.sangTu = a * 0.25; r.sangDen = Math.min(r.dur, (b + 1) * 0.25); r.sang = sang;
    const tb = tong / Math.max(1, n); r.mau = { sang: Math.min(1.25, Math.max(0.9, 118 / Math.max(40, tb))), tuong: 1.06, bao: 1.12 };
  } else r.dur = am ? am.length / SR : 0;
  // có lời nói không? (tỉ lệ khung có tiếng)
  if (am && am.length > SR * 0.5) {
    const e = dbKhung(am), s = Array.from(e).sort((x, y) => x - y), ng = s[Math.floor(0.1 * (s.length - 1))] + CHUAN.am.lang_db;
    const ti = e.filter(v => v > ng).length / e.length, max = s.at(-1);
    r.coLoi = (laAm || ti > 0.25) && max > -45; r.am = am;
  } else r.coLoi = false;
  if (r.coLoi && phuDe) { try { r.chu = await nghe(am, bao); } catch (e) { console.warn('nghe lỗi', e); r.chu = []; r.loiNghe = e.message; } }
  _cache.set(k, r); return r;
}

// đọc riêng rãnh tiếng theo từng đoạn (không nạp cả file video 4K vào bộ nhớ) → mono 48k
async function docAmLuong(file) {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS }), at = await input.getPrimaryAudioTrack();
  if (!at) return null;
  const parts = []; let sr = SR, n = 0;
  for await (const { buffer } of new AudioBufferSink(at).buffers()) {
    sr = buffer.sampleRate; const k = buffer.numberOfChannels, m = new Float32Array(buffer.length);
    for (let c = 0; c < k; c++) { const d = buffer.getChannelData(c); for (let i = 0; i < m.length; i++) m[i] += d[i] / k; }
    parts.push(m); n += m.length;
  }
  let x = new Float32Array(n), o = 0; for (const p of parts) { x.set(p, o); o += p.length; }
  if (sr !== SR) { const r = sr / SR, y = new Float32Array(Math.floor(n / r)); for (let i = 0; i < y.length; i++) { const t = i * r, a = Math.floor(t), f = t - a; y[i] = x[a] * (1 - f) + (x[a + 1] ?? x[a]) * f; } x = y; }
  return x;
}

// ---------- lập kế hoạch ----------
// cd: { gop: kết quả góp ý (đã gộp), phuDe: bool }
const KIEU = ['quet_sang', 'zoom', 'truot', 'chop_mat', 'loe'];
export function lapKeHoach(ds, cd) {
  const g = cd.gop || {}, nhanh = g.nhanh ?? 1, langCon = Math.max(0.08, CHUAN.am.nen_lang_con / nhanh), langToiDa = Math.max(0.15, CHUAN.am.nen_lang_toi_da / nhanh);
  const doan = [], am = [], chu = []; let t = 0, so = (g.kieu || 0);
  const video = ds.filter(r => !r.laAm), broll = ds.filter(r => !r.laAm && !r.coLoi);
  const daDung = new Set();
  const themChu = (ws, doi, t0, phamVi) => { for (const w of ws || []) { if (phamVi && (w.us < phamVi[0] || w.us > phamVi[1])) continue; chu.push({ ...w, us: t0 + doi(w.us), ue: t0 + doi(w.ue) }); } };
  for (let i = 0; i < ds.length; i++) {
    const r = ds[i]; if (daDung.has(r)) continue;
    if (!r.laAm && r.coLoi) {                       // clip có lời (quay mặt / vừa quay vừa nói): cắt lặng = cắt nhảy, zoom xen kẽ che mối nối
      const giu = timGiu(r.am, { tu: r.sangTu, den: r.sangDen, langCon, langToiDa }); if (!giu.length) continue;
      const gh = ghep(r.am, giu); am.push({ x: canGiong(gh.x), t });
      giu.forEach(([a, b], j) => doan.push({ r, a, b, toc: 1, t0: t + gh.doi(a), dai: b - a, zoom: j % 2 ? 1.08 : 1, chuyen: j === 0 && doan.length ? KIEU[so++ % KIEU.length] : null }));
      themChu(r.chu, gh.doi, t); t += gh.x.length / SR; daDung.add(r);
    } else if (r.laAm && r.coLoi) {                 // file giọng thu riêng: phủ các clip không lời ngay sau nó
      const giu = timGiu(r.am, { langCon, langToiDa }); if (!giu.length) continue;
      const gh = ghep(r.am, giu), D = gh.x.length / SR; am.push({ x: canGiong(gh.x), t });
      let phu = []; for (let j = i + 1; j < ds.length && !ds[j].coLoi; j++) if (!ds[j].laAm) phu.push(ds[j]);
      if (!phu.length) phu = broll.filter(v => !daDung.has(v)).slice(0, 2);
      if (!phu.length) phu = video.slice(-1);
      const tongDung = phu.reduce((s, v) => s + (v.sangDen - v.sangTu), 0); let u = 0;
      phu.forEach((v, j) => {
        const d = j === phu.length - 1 ? D - u : D * (v.sangDen - v.sangTu) / tongDung, dung = v.sangDen - v.sangTu;
        const toc = Math.min(1.6, Math.max(0.6, dung / d)), b = Math.min(v.sangDen, v.sangTu + d * toc);
        doan.push({ r: v, a: v.sangTu, b, toc, t0: t + u, dai: d, zoom: 1, chuyen: doan.length ? KIEU[so++ % KIEU.length] : null }); u += d; daDung.add(v);
      });
      themChu(r.chu, gh.doi, t); t += D; daDung.add(r);
    } else if (!r.laAm) {                            // clip không lời đứng riêng: dựng nhanh, tối đa 3 giây/clip, giữ tiếng nền nhỏ
      const dung = r.sangDen - r.sangTu, d = Math.min(3 / nhanh, dung);
      doan.push({ r, a: r.sangTu, b: r.sangTu + d, toc: 1, t0: t, dai: d, zoom: 1, chuyen: doan.length ? KIEU[so++ % KIEU.length] : null, nen: true });
      if (r.am) am.push({ x: r.am.subarray(Math.floor(r.sangTu * SR), Math.floor((r.sangTu + d) * SR)), t, gain: db(-14) });
      t += d; daDung.add(r);
    }
  }
  let tong = t + 0.05;
  // góp ý: sửa chữ, bỏ đoạn, chữ chèn, hook
  for (const [a, b] of g.sua || []) for (const w of chu) if (w.chu.toLowerCase().replace(/[,.?!]/g, '') === a.toLowerCase()) w.chu = w.chu.replace(new RegExp(a, 'i'), b);
  const kh = { doan, am, chu, cum: [], tong, chen: g.chen || [], hook: g.hook || null, coChu: g.coChu ?? 1, nhac: g.nhac ?? 1, che: g.che || [], zoomVao: g.zoomVao || [] };
  // bỏ đoạn (theo giờ video): dời mọi thứ phía sau lên
  for (const [a, b] of (g.bo || []).slice().sort((x, y) => y[0] - x[0])) boDoan(kh, a, b);
  // BỘ ĐẠO DIỄN: đọc lời nói → tự đặt hook, nhãn máy, chia đôi, bước, số, giá, follow (góp ý có thể bỏ/thêm)
  let hieu = g.tatDaoDien ? [] : daoDien(kh);
  hieu = hieu.filter(h => !(g.boHieu || []).includes(h.loai));
  for (const n of g.boLuc || []) hieu = hieu.filter(h => h.loai === 'hook' || !(n >= h.t - 0.3 && n < h.t + h.dai + 0.3));
  hieu.push(...(g.themHieu || []));
  const hk = hieu.find(h => h.loai === 'hook'); if (!('hook' in g) && hk) kh.hook = { nho: hk.nho, lon: hk.lon, dai: hk.dai, tuDong: true };
  kh.zoomVao = [...kh.zoomVao, ...hieu.filter(h => h.loai === 'zoom').map(h => ({ t: h.t }))];
  kh.hieu = hieu.filter(h => h.loai !== 'hook' && h.loai !== 'zoom').sort((a, b) => a.t - b.t);
  kh.loi = kh.chu; if (g.phuDe === false) kh.chu = [];
  kh.cum = gomCum(kh.chu); return kh;
}
function boDoan(kh, a, b) {
  a = Math.max(0, a); b = Math.min(kh.tong, b); if (b <= a) return; const d = b - a;
  const moi = [];
  for (const s of kh.doan) {
    const e = s.t0 + s.dai;
    if (e <= a) moi.push(s);
    else if (s.t0 >= b) moi.push({ ...s, t0: s.t0 - d });
    else { // cắt bớt phần nằm trong [a,b]
      if (s.t0 < a) moi.push({ ...s, dai: a - s.t0, b: s.a + (a - s.t0) * s.toc });
      if (e > b) moi.push({ ...s, t0: a, a: s.a + (b - s.t0) * s.toc, dai: e - b, chuyen: 'quet_sang' });
    }
  }
  kh.doan = moi;
  kh.am = kh.am.map(tr => {
    const s = tr.t, e = s + tr.x.length / SR; if (e <= a) return tr; if (s >= b) return { ...tr, t: s - d };
    const i0 = Math.max(0, Math.floor((a - s) * SR)), i1 = Math.min(tr.x.length, Math.floor((b - s) * SR)), y = new Float32Array(tr.x.length - (i1 - i0));
    y.set(tr.x.subarray(0, i0)); y.set(tr.x.subarray(i1), i0); return { ...tr, x: y, t: Math.min(s, a) };
  });
  kh.chu = kh.chu.filter(w => w.us < a || w.us >= b).map(w => w.us >= b ? { ...w, us: w.us - d, ue: w.ue - d } : w);
  kh.chen = kh.chen.map(c => c.t >= b ? { ...c, t: c.t - d } : c); kh.tong -= d;
}

// ---------- vẽ 1 khung ----------
const { W, H, FPS } = CHUAN;
function veNen(ctx, src, s, u, kh) {
  if (!src) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); return; }
  const m = s.r.mau || { sang: 1, tuong: 1, bao: 1 }, gm = kh.mau || 1;
  let z = s.zoom || 1; for (const zv of kh.zoomVao) if (s.t0 + u >= zv.t && s.t0 + u < zv.t + 1.5) z *= 1 + 0.18 * E.ease((s.t0 + u - zv.t) / 0.25);
  ctx.save(); ctx.filter = `brightness(${m.sang * gm}) contrast(${m.tuong}) saturate(${m.bao})`;
  ctx.setTransform(z, 0, 0, z, W / 2 * (1 - z), H * 0.45 * (1 - z)); ctx.drawImage(src, 0, 0, W, H); ctx.restore();
}
function cumLuc(cum, t) { for (let i = 0; i < cum.length; i++) { const dau = cum[i][0].us - 0.08, cuoi = i + 1 < cum.length ? Math.min(cum[i + 1][0].us - 0.08, cum[i].at(-1).ue + 0.6) : cum[i].at(-1).ue + 0.5; if (t >= dau && t < cuoi) return cum[i]; } return null; }
export function veKhung(ctx, kh, s, u, src, truocAnh, anhChia) {
  const t = s.t0 + u; veNen(ctx, src, s, u, kh);
  for (const r of kh.che) { if (t < r.t0 || t > r.t1) continue; ctx.save(); ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 18); ctx.clip(); ctx.filter = 'blur(24px)'; ctx.drawImage(ctx.canvas, r.x - 40, r.y - 40, r.w + 80, r.h + 80, r.x - 40, r.y - 40, r.w + 80, r.h + 80); ctx.restore(); }
  veHieu(ctx, kh, t, anhChia);
  if (kh.hook && t < (kh.hook.dai || 3)) E.theHook(ctx, kh.hook.nho || '', kh.hook.lon, 1 + 0.04 * Math.sin(Math.min(t, 1.2) * 9) * Math.max(0, 1 - t / 1.2));
  for (const c of kh.chen) if (t >= c.t && t < c.t + (c.dai || 2.5)) {
    const k = E.nay((t - c.t) / 0.3), px = E.vuaChu(ctx, c.chu, 'Anton', 120 * kh.coChu, 960);
    E.theKinh(ctx, [90, 560 - px * 0.7, 990, 560 + px * 0.7], 36, 0.3); E.chuGradient(ctx, c.chu, 'Anton', px, W / 2, 560, k, CHUAN.mau.trang, c.mau || CHUAN.mau.vang, c.mau || [255, 170, 60]);
  }
  ctxPhuDe(ctx, cumLuc(kh.cum, t), t, kh.coChu);
  if (s.chuyen === 'quet_sang') E.quetSang(ctx, u);
  else if (s.chuyen === 'chop_mat' && u < 0.25) E.chopMat(ctx, 1 - u / 0.25);
  else if (s.chuyen === 'loe') E.loe(ctx, u);
  else if (s.chuyen === 'truot' && u < 0.25 && truocAnh) { const k = E.ease(u / 0.25), dy = H * (1 - k); ctx.drawImage(ctx.canvas, 0, 0, W, H, 0, dy, W, H); ctx.drawImage(truocAnh, 0, H - dy, W, dy, 0, 0, W, dy); }
  else if (s.chuyen === 'zoom' && u < 0.3) { const z = 1 + 0.1 * (1 - u / 0.3) ** 2; ctx.save(); ctx.globalAlpha = 0.4 * (1 - u / 0.3); ctx.setTransform(z, 0, 0, z, W / 2 * (1 - z), H / 2 * (1 - z)); ctx.drawImage(ctx.canvas, 0, 0); ctx.restore(); }
}
function ctxPhuDe(ctx, cum, t, co) { if (!cum) return; ctx.save(); if (co !== 1) { ctx.translate(W / 2, CHUAN.an_toan.y_phu_de); ctx.scale(co, co); ctx.translate(-W / 2, -CHUAN.an_toan.y_phu_de); } E.phuDe(ctx, cum, t); ctx.restore(); }

// xem nhanh 1 khung ở giây t của video
export async function xemKhung(ctx, kh, t) {
  const s = kh.doan.find(s => t >= s.t0 && t < s.t0 + s.dai) || kh.doan.at(-1); if (!s) return;
  const u = t - s.t0, w = await s.r.sink.getCanvas(Math.min(s.r.dur - 0.05, s.a + u * s.toc));
  ctx.clearRect(0, 0, W, H); veKhung(ctx, kh, s, u, w?.canvas || null, null);
}

// chia đôi: lấy 1 khung của clip KHÁC (clip trước đó, không có thì clip sau) để đặt nửa trên
async function layAnhChia(kh) {
  const m = new Map();
  for (const h of (kh.hieu || []).filter(h => h.loai === 'chia_doi')) {
    const i = kh.doan.findIndex(s => h.t >= s.t0 && h.t < s.t0 + s.dai); if (i < 0) continue;
    const cur = kh.doan[i].r, kia = kh.doan.slice(0, i).reverse().find(s => s.r !== cur) || kh.doan.slice(i + 1).find(s => s.r !== cur);
    if (!kia) continue;
    try {
      const w = await kia.r.sink.getCanvas(Math.min(kia.r.dur - 0.05, (kia.a + kia.b) / 2)); if (!w) continue;
      const c = document.createElement('canvas'); c.width = W; c.height = H; const cc = c.getContext('2d'), mm = kia.r.mau || { sang: 1, tuong: 1, bao: 1 };
      cc.filter = `brightness(${mm.sang * (kh.mau || 1)}) contrast(${mm.tuong}) saturate(${mm.bao})`; cc.drawImage(w.canvas, 0, 0, W, H); m.set(h, c);
    } catch (e) { console.warn('chia đôi', e); }
  }
  return m;
}

// ---------- dựng & xuất ----------
export async function xuat(kh, { nhe = false, khongNhac = false, nhac = null, cao = false, bao = () => {}, huy = { co: false } } = {}) {
  const tong = kh.tong, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
  const bitrate = nhe ? Math.max(700_000, Math.floor(9.5 * 8 * 1024 * 1024 / tong - 140_000)) : (cao ? 14_000_000 : CHUAN.bitrate_video);
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const vs = new CanvasSource(cv, { codec: 'avc', bitrate, keyFrameInterval: 2 }); output.addVideoTrack(vs, { frameRate: FPS });
  let codec = 'aac'; try { if (!(await canEncodeAudio('aac'))) codec = 'opus'; } catch { }
  const as = new AudioBufferSource({ codec, bitrate: 192_000 }); output.addAudioTrack(as); await output.start();
  const anh = document.createElement('canvas'); anh.width = W; anh.height = H; const actx = anh.getContext('2d');
  const tongF = Math.round(tong * FPS); let f = 0;
  const anhChia = await layAnhChia(kh);
  for (const [i, s] of kh.doan.entries()) {
    const f1 = Math.min(tongF, Math.round((s.t0 + s.dai) * FPS)), ts = [];
    for (let k = f; k < f1; k++) ts.push(Math.min(s.r.dur - 0.05, s.a + (k / FPS - s.t0) * s.toc));
    const it = s.r.sink.canvasesAtTimestamps(ts)[Symbol.asyncIterator](); let last = null;
    for (; f < f1; f++) {
      if (huy.co) throw new Error('Đã huỷ');
      const r = await it.next(); if (!r.done && r.value) last = r.value.canvas;
      veKhung(ctx, kh, s, f / FPS - s.t0, last, anh, anhChia); await vs.add(f / FPS, 1 / FPS);
      if (f % 15 === 0) bao(`Dựng hình ${Math.round(f / tongF * 100)}%`, f / tongF);
    }
    await it.return?.(); actx.drawImage(cv, 0, 0);
  }
  bao('Ghép tiếng…', 0.98);
  const tr = kh.am.map(a => ({ ...a }));
  const pk = x => 1 / (x.reduce((m, v) => Math.max(m, Math.abs(v)), 0) + 1e-9);
  for (const s of kh.doan) if (s.chuyen) { const v = await sfx(s.chuyen === 'chop_mat' ? 'pop' : 'vut_zoom'); tr.push({ x: v, t: s.t0 - 0.1, gain: pk(v) * db(-22) }); }
  for (const c of kh.chen) { const v = await sfx('pop'); tr.push({ x: v, t: c.t, gain: pk(v) * db(-18) }); }
  for (const h of kh.hieu || []) { const [ten, d] = TIENG[h.loai] || []; if (!ten) continue; try { const v = await sfx(ten); tr.push({ x: v, t: h.t, gain: pk(v) * db(d) }); } catch { } }
  await as.add(tronAm(tong, tr, khongNhac ? null : nhac));
  await output.finalize(); bao('Xong', 1);
  return new Blob([output.target.buffer], { type: 'video/mp4' });
}

export async function anhBia(kh, t = 0.5, chu = null) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
  await xemKhung(ctx, { ...kh, cum: [], chen: [], hook: null, hieu: [] }, t);
  if (chu?.lon) { E.theHook(ctx, chu.nho || '', chu.lon, 1, [90, 300, 990, 720], chu.lon2 || null); }
  return await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.92));
}
