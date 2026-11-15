// LÕI DỰNG: đọc clip (Mediabunny) → vẽ từng khung theo quy chuẩn → ghép tiếng → xuất MP4. Chạy hoàn toàn trong trình duyệt.
import { Input, BlobSource, ALL_FORMATS, CanvasSink, Output, Mp4OutputFormat, BufferTarget, CanvasSource, AudioBufferSource, canEncodeAudio }
  from '../vendor/mediabunny.mjs';   // Mediabunny 1.61.3 (MPL-2.0), để sẵn trong app, không phụ thuộc mạng
import { CHUAN } from './config.js';
import * as E from './effects.js';
import { docAm, catLang, canGiong, tronAm, sfx, db, SR } from './audio.js';
const { W, H, FPS } = CHUAN;

// ---------- clip ----------
const _clip = new Map();
export async function moClip(file) {
  if (_clip.has(file)) return _clip.get(file);
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  if (!track) throw new Error(`"${file.name}" không có hình`);
  const dur = await input.computeDuration();
  const o = { input, track, dur, sink: new CanvasSink(track, { width: W, height: H, fit: 'cover', poolSize: 3 }) };
  _clip.set(file, o); return o;
}

// ---------- chuẩn bị dòng thời gian ----------
function tachChu(text) { // "*ColorOS 17*" = từ khoá tô xanh
  const out = []; let nhan = false;
  for (const tk of (text || '').split(/\s+/).filter(Boolean)) {
    let t = tk; const mo = t.startsWith('*'), dong = t.endsWith('*') || t.endsWith('*,') || t.endsWith('*.');
    if (mo) { nhan = true; t = t.slice(1); }
    const n = nhan; if (dong) { nhan = false; t = t.replace(/\*([,.?!]?)$/, '$1'); }
    out.push({ chu: t, nhan: n || mo });
  }
  return out;
}
// rải chữ phụ đề lên các đoạn có tiếng theo độ dài chữ
function raiPhuDe(text, doan, dai) {
  const ws = tachChu(text); if (!ws.length) return [];
  const seg = doan.length ? doan : [[0, dai]], tongTieng = seg.reduce((s, [a, b]) => s + b - a, 0);
  const tongChu = ws.reduce((s, w) => s + w.chu.length + 1, 0); let acc = 0;
  const gio = r => { let t = r * tongTieng; for (const [a, b] of seg) { if (t <= b - a) return a + t; t -= b - a; } return seg.at(-1)[1]; };
  ws.forEach(w => { w.us = gio(acc / tongChu); acc += w.chu.length + 1; w.ue = gio(acc / tongChu); });
  const cum = []; let cur = [];
  ws.forEach(w => { cur.push(w); if (cur.length >= 5 || /[,.?!]$/.test(w.chu)) { cum.push(cur); cur = []; } }); if (cur.length) cum.push(cur);
  return cum;
}

export async function chuanBi(dt, baoTien = () => {}) {
  const ds = []; let t = 0;
  for (const [i, c] of dt.canh.entries()) {
    baoTien(`Đọc tiếng cảnh ${i + 1}…`);
    const clips = c.clips.filter(k => k.file);
    for (const k of clips) { const o = await moClip(k.file); k._dur = o.dur; if (k.b == null || k.b > o.dur) k.b = o.dur; if (k.a == null) k.a = 0; }
    let am = null, doan = [];
    if (c.am === 'giong' && c.giong) { const r = catLang(await docAm(c.giong)); am = canGiong(r.x); doan = r.doan; }
    else if (c.am === 'clip' && clips[0]) {
      const x = await docAm(clips[0].file), k = clips[0];
      const r = catLang(x.subarray(Math.floor(k.a * SR), Math.floor(k.b * SR))); am = canGiong(r.x); doan = r.doan;
    }
    const duoi = c.loai === 'buoc' ? 1.2 : 0;
    let dai = am ? am.length / SR + 0.06 + duoi : Math.max(1.5, clips.reduce((s, k) => s + (k.b - k.a), 0) || 3);
    if (c.loai === 'chia_doi') dai = am ? dai : 4;
    // chia thời lượng cho các mảnh clip (chia đôi: 2 clip chạy song song cả cảnh)
    const manh = []; const cl = c.loai === 'chia_doi' ? clips.slice(0, 1) : clips;
    const dat = cl.filter(k => k.giay > 0).reduce((s, k) => s + +k.giay, 0), conLai = cl.filter(k => !(k.giay > 0)).length;
    let u = 0;
    cl.forEach((k, j) => {
      const d = j === cl.length - 1 ? dai - u : (k.giay > 0 ? +k.giay : Math.max(0.4, (dai - dat) / Math.max(1, conLai)));
      manh.push({ clip: k, u0: u, u1: u + d, toc: Math.min(3, Math.max(0.25, (k.b - k.a) / d)) }); u += d;
    });
    ds.push({ canh: c, i, t0: t, dai, am, phuDe: raiPhuDe(c.phu_de, doan, dai), manh, clips }); t += dai;
  }
  return { ds, tong: t };
}

// ---------- vẽ 1 khung ----------
function veNen(ctx, src, k) {
  if (!src) { ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H); return; }
  const z = +(k?.zoom || 1), cx = W * (+(k?.tam_x ?? 0.5)), cy = H * (+(k?.tam_y ?? 0.5));
  ctx.save(); ctx.setTransform(z, 0, 0, z, cx * (1 - z), cy * (1 - z)); ctx.drawImage(src, 0, 0, W, H); ctx.restore();
  for (const r of k?.che || []) { // che thông tin riêng
    ctx.save(); ctx.beginPath(); ctx.roundRect(r[0], r[1], r[2], r[3], 18); ctx.clip(); ctx.filter = 'blur(22px)';
    ctx.drawImage(ctx.canvas, r[0] - 40, r[1] - 40, r[2] + 80, r[3] + 80, r[0] - 40, r[1] - 40, r[2] + 80, r[3] + 80); ctx.restore();
  }
}
const cumLuc = (pd, u) => {
  for (let i = 0; i < pd.length; i++) { const dau = pd[i][0].us - 0.08, cuoi = i + 1 < pd.length ? pd[i + 1][0].us - 0.08 : pd[i].at(-1).ue + 0.4; if (u >= dau && u < cuoi) return pd[i]; }
  return null;
};

export function veKhung(ctx, dt, s, u, src, src2, tiep, truocAnh) {
  const c = s.canh, mi = s.manh.findIndex(m => u >= m.u0 && u < m.u1), m = s.manh[mi < 0 ? s.manh.length - 1 : mi], k = m?.clip;
  // chuyển cảnh "zoom": khung phóng nhẹ + mờ lúc vào
  if (c.chuyen === 'zoom' && u < 0.3) { ctx.save(); ctx.filter = `blur(${12 * (1 - u / 0.3)}px)`; }
  if (c.loai === 'chia_doi') veChiaDoi(ctx, c, s, u, src, src2);
  else veNen(ctx, src, k);
  if (c.chuyen === 'zoom' && u < 0.3) { ctx.restore(); const z = 1 + 0.1 * (1 - u / 0.3) ** 2; ctx.save(); ctx.globalAlpha = 0.35 * (1 - u / 0.3); ctx.setTransform(z, 0, 0, z, W / 2 * (1 - z), H / 2 * (1 - z)); ctx.drawImage(ctx.canvas, 0, 0); ctx.restore(); }
  const nh = x => E.nay(x);
  if (c.loai === 'mo') {
    const kk = 1 + 0.04 * Math.sin(Math.min(u, 1.2) * 9) * Math.max(0, 1 - u / 1.2);   // khung đầu đã đủ chữ = ảnh bìa
    E.theHook(ctx, dt.hook_nho, dt.hook_lon, kk); if (dt.phan) E.nhanVang(ctx, dt.phan, 205, 100);
  } else if (c.loai === 'canh') {
    if (c.nhan) E.chip(ctx, c.nhan, CHUAN.an_toan.y_nhan, c.cham === 'xam' ? CHUAN.mau.xam : CHUAN.mau.troi, 46, W / 2, nh(u / 0.3));
    if (c.nhan_phu) E.chip(ctx, c.nhan_phu, 318, null, 40, W / 2, nh((u - 0.4) / 0.3));
  } else if (c.loai === 'buoc') {
    const so = s.manh.indexOf(m) + 1, txt = k?.ket ? (k.nhan || 'XONG!') : `BƯỚC ${so}${k?.nhan ? ' · ' + k.nhan : ''}`;
    E.chip(ctx, txt, CHUAN.an_toan.y_nhan, k?.ket ? CHUAN.mau.troi : CHUAN.mau.vang, 46, W / 2, nh((u - m.u0) / 0.28));
    if (k?.vong && u - m.u0 > 0.3 && !k.ket) E.vong(ctx, k.vong[0], k.vong[1], u - m.u0);
  } else if (c.loai === 'ket') {
    const nua = s.dai * 0.5;
    if (u < nua) E.theHook(ctx, dt.hook_nho, c.cau_hoi || 'BẠN THẤY SAO?', nh(u / 0.3));
    else {
      const kk = nh((u - nua) / 0.3);
      pill(ctx, 'FOLLOW', 330, 190, CHUAN.mau.hong_follow, '#fff', kk); pill(ctx, 'BÌNH LUẬN', 750, 190, [255, 255, 255], '#141414', kk);
      if (c.phan_sau) E.chip(ctx, c.phan_sau, 318, CHUAN.mau.vang, 40, W / 2, nh((u - nua - 0.25) / 0.3));
    }
  }
  E.phuDe(ctx, cumLuc(s.phuDe, u), u);
  // chuyển cảnh
  if (c.chuyen === 'quet_sang') E.quetSang(ctx, u);
  if (c.chuyen === 'chop_mat' && u < 0.25) E.chopMat(ctx, 1 - u / 0.25);
  if (c.chuyen === 'truot' && u < 0.25 && truocAnh) { const kk = E.ease(u / 0.25), dy = H * (1 - kk); ctx.save(); ctx.globalAlpha = 1; ctx.drawImage(truocAnh, 0, 0, W, H - dy, 0, 0, W, H - dy); ctx.restore(); ctx.drawImage(ctx.canvas, 0, 0, W, H, 0, dy, W, H); }
  if (tiep?.chuyen === 'chop_mat' && u > s.dai - 0.22) E.chopMat(ctx, (u - (s.dai - 0.22)) / 0.22);   // mí khép cuối cảnh trước
}
function pill(ctx, txt, x, y, nen, mauChu, s) {
  if (s <= 0.01) return; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.font = E.font('BVX', 50);
  const w = ctx.measureText(txt).width + 90, h = 104; ctx.fillStyle = E.rgb(nen); ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2); ctx.fill();
  ctx.fillStyle = mauChu; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, 0, 2); ctx.restore();
}
function veChiaDoi(ctx, c, s, u, a, b) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#04081a'); g.addColorStop(1, '#0e2149'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const PW = 442, PH = 1000, PY = 380, kin = E.ease(u / 0.35), k17 = u > s.dai * 0.5;
  const panel = (src, x, k, sang, vien) => {
    if (!src) return; const cw = W * 0.5 / (+(k?.zoom || 1)), ch = cw * PH / PW, cx = W * (+(k?.tam_x ?? 0.5)), cy = H * (+(k?.tam_y ?? 0.52));
    ctx.save(); if (sang) { ctx.shadowColor = E.rgb(CHUAN.mau.troi, 0.9); ctx.shadowBlur = 40; }
    ctx.beginPath(); ctx.roundRect(x, PY, PW, PH, 32); ctx.fillStyle = '#000'; ctx.fill(); ctx.shadowBlur = 0; ctx.clip();
    ctx.filter = sang ? 'none' : 'brightness(0.82)'; ctx.drawImage(src, cx - cw / 2, cy - ch / 2, cw, ch, x, PY, PW, PH); ctx.restore();
    ctx.save(); ctx.strokeStyle = E.rgb(vien); ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(x, PY, PW, PH, 32); ctx.stroke(); ctx.restore();
  };
  panel(a, 50 - 600 * (1 - kin), s.clips[0], !k17, CHUAN.mau.xam); panel(b, 510 + 600 * (1 - kin), s.clips[1], true, CHUAN.mau.troi);
  E.theKinh(ctx, [150, 96, 930, 262], 34, 0.2);
  E.chu(ctx, c.tieu_de_nho || '', 'BVX', 38, W / 2, 148, [200, 215, 235]); E.chuGradient(ctx, c.tieu_de || 'SO SÁNH', 'Anton', 84, W / 2, 216);
  E.chip(ctx, c.trai || '', 322, CHUAN.mau.xam, 38, 271, E.nay((u - 0.25) / 0.3)); E.chip(ctx, c.phai || '', 322, CHUAN.mau.troi, 38, 731, E.nay((u - 0.35) / 0.3));
  if (u > s.dai * 0.3) E.chu(ctx, c.trai_duoi || '', 'BVX', 38, 271, 1418, [205, 205, 215], 4);
  if (k17) E.chu(ctx, c.phai_duoi || '', 'BVX', 38, 731, 1418, CHUAN.mau.troi, 4);
}

// ---------- xem trước 1 khung ----------
export async function xemKhung(ctx, dt, tl, si, u) {
  const s = tl.ds[si]; if (!s) return;
  const m = s.manh.find(m => u >= m.u0 && u < m.u1) || s.manh.at(-1);
  const lay = async (k, t) => { if (!k?.file) return null; const o = await moClip(k.file); const w = await o.sink.getCanvas(Math.min(o.dur - 0.05, t)); return w?.canvas || null; };
  const src = m ? await lay(m.clip, m.clip.a + (u - m.u0) * m.toc) : null;
  const src2 = s.canh.loai === 'chia_doi' ? await lay(s.clips[1], s.clips[1]?.a + u * ((s.clips[1]?.b - s.clips[1]?.a) / s.dai)) : null;
  ctx.clearRect(0, 0, W, H); veKhung(ctx, dt, s, u, src, src2, tl.ds[si + 1]?.canh, null);
}

// ---------- dựng & xuất ----------
export async function dung(dt, { nhe = false, baoTien = () => {}, huy = { co: false } } = {}) {
  const tl = await chuanBi(dt, baoTien), tong = tl.tong;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d', { willReadFrequently: false });
  const bitrate = nhe ? Math.max(700_000, Math.floor(9.5 * 8 * 1024 * 1024 / tong - 140_000)) : CHUAN.bitrate_video;
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const vs = new CanvasSource(cv, { codec: 'avc', bitrate, keyFrameInterval: 2 }); output.addVideoTrack(vs, { frameRate: FPS });
  let codecAm = 'aac'; try { if (!(await canEncodeAudio('aac'))) codecAm = 'opus'; } catch { }
  const as = new AudioBufferSource({ codec: codecAm, bitrate: 160_000 }); output.addAudioTrack(as);
  await output.start();
  const anh = document.createElement('canvas'); anh.width = W; anh.height = H; const actx = anh.getContext('2d');
  let f = 0; const tongF = Math.round(tong * FPS);
  for (const [si, s] of tl.ds.entries()) {
    const f1 = Math.round((s.t0 + s.dai) * FPS), tiep = tl.ds[si + 1]?.canh;
    // khung nguồn cho từng mảnh (đọc tuần tự, nhanh)
    let it2 = null, last2 = null;
    if (s.canh.loai === 'chia_doi' && s.clips[1]) {
      const k = s.clips[1], o = await moClip(k.file), r = (k.b - k.a) / s.dai, ts = [];
      for (let g = f; g < f1; g++) ts.push(Math.min(o.dur - 0.05, k.a + (g / FPS - s.t0) * r));
      it2 = o.sink.canvasesAtTimestamps(ts)[Symbol.asyncIterator]();
    }
    for (const m of s.manh) {
      const g1 = Math.min(f1, Math.round((s.t0 + m.u1) * FPS)), o = m.clip.file ? await moClip(m.clip.file) : null, ts = [];
      for (let g = f; g < g1; g++) ts.push(Math.min((o?.dur || 1) - 0.05, m.clip.a + (g / FPS - s.t0 - m.u0) * m.toc));
      const it = o ? o.sink.canvasesAtTimestamps(ts)[Symbol.asyncIterator]() : null; let last = null;
      for (; f < g1; f++) {
        if (huy.co) throw new Error('Đã huỷ');
        if (it) { const r = await it.next(); if (!r.done && r.value) last = r.value.canvas; }
        if (it2) { const r = await it2.next(); if (!r.done && r.value) last2 = r.value.canvas; }
        const u = f / FPS - s.t0; veKhung(ctx, dt, s, u, last, last2, tiep, anh);
        await vs.add(f / FPS, 1 / FPS);
        if (f % 15 === 0) baoTien(`Dựng hình ${Math.round(f / tongF * 100)}%`, f / tongF);
      }
      await it?.return?.();
    }
    await it2?.return?.();
    actx.drawImage(cv, 0, 0);   // giữ khung cuối cho chuyển cảnh "trượt lên"
  }
  baoTien('Ghép tiếng…', 0.97);
  const tr = [];
  for (const s of tl.ds) {
    if (s.am) tr.push({ x: s.am, t: s.t0 });
    const pk = x => 1 / (x.reduce((a, v) => Math.max(a, Math.abs(v)), 0) + 1e-9);
    if (s.i > 0) { const v = await sfx('vut_zoom'); tr.push({ x: v, t: s.t0 - 0.12, gain: pk(v) * db(-21) }); }
    const p = await sfx('pop'); tr.push({ x: p, t: s.t0 + 0.15, gain: pk(p) * db(-22) });
    if (s.canh.loai === 'buoc') for (const m of s.manh.slice(1)) { const t = await sfx(m.clip.ket ? 'tada' : 'tich'); tr.push({ x: t, t: s.t0 + m.u0 + 0.05, gain: pk(t) * db(-16) }); }
  }
  const nhac = dt.nhac?.bat && dt.nhac.file ? await docAm(dt.nhac.file) : null;
  await as.add(tronAm(tong, tr, nhac));
  await output.finalize();
  baoTien('Xong', 1);
  return { blob: new Blob([output.target.buffer], { type: 'video/mp4' }), tong, tl };
}

// ---------- ảnh bìa theo khuôn kênh (chữ nằm trong vùng lưới 3:4) ----------
export async function anhBia(dt, giay = 1.0) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
  const mo = dt.canh.find(c => c.loai === 'mo'), k = mo?.clips.find(x => x.file);
  let src = null; if (k) { const o = await moClip(k.file); src = (await o.sink.getCanvas(Math.min(o.dur - 0.05, (k.a || 0) + giay)))?.canvas; }
  veNen(ctx, src, k);
  E.theHook(ctx, dt.hook_nho, dt.bia_lon_1 || dt.hook_lon, 1, [90, 300, 990, 720], dt.bia_lon_2 || null);
  if (dt.phan) E.nhanVang(ctx, dt.phan, 175, 305, 40);
  return await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.92));
}
