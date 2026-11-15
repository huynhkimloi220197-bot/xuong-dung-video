// Vẽ chữ & hiệu ứng theo quy chuẩn kênh (chuyển từ bộ dựng Python dung_cos17_p1.py sang canvas).
import { CHUAN } from './config.js';
const { W, H } = CHUAN;
export const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
export const ease = x => { x = Math.max(0, Math.min(1, x)); return 1 - (1 - x) ** 3; };
export function nay(x) { // bật vượt rồi về 1
  if (x <= 0) return 0; if (x >= 1) return 1;
  return x > 0.35 ? 1 + 0.25 * Math.sin(x * Math.PI) * (1 - x) * 2.2 : ease(x / 0.35) * 1.15;
}
const FAM = { Anton: "'Anton'", BVX: "'BVX'" };
export const font = (fam, px) => `${fam === 'Anton' ? '' : '800 '}${Math.round(px)}px ${FAM[fam]}`;

// cỡ chữ vừa bề ngang tối đa
export function vuaChu(ctx, txt, fam, px, maxW) {
  ctx.font = font(fam, px); const w = ctx.measureText(txt).width;
  return w > maxW ? px * maxW / w : px;
}

let _tmp = null;
function tam(w, h) { if (!_tmp) _tmp = document.createElement('canvas'); _tmp.width = w; _tmp.height = h; return _tmp; }

// thẻ kính mờ: làm mờ + tối phần nền phía sau, viền trắng mảnh
export function theKinh(ctx, [x0, y0, x1, y1], r = 36, toi = 0.3) {
  const w = x1 - x0, h = y1 - y0, t = tam(w, h), tc = t.getContext('2d');
  tc.clearRect(0, 0, w, h); tc.drawImage(ctx.canvas, x0, y0, w, h, 0, 0, w, h);
  ctx.save(); ctx.beginPath(); ctx.roundRect(x0, y0, w, h, r); ctx.clip();
  ctx.filter = 'blur(24px)'; ctx.drawImage(t, x0 - 30, y0 - 30, w + 60, h + 60); ctx.filter = 'none';
  ctx.fillStyle = `rgba(0,0,0,${toi})`; ctx.fillRect(x0, y0, w, h); ctx.restore();
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x0, y0, w, h, r); ctx.stroke(); ctx.restore();
}

// chữ tô gradient dọc (trắng → xanh trời) có quầng sáng
export function chuGradient(ctx, txt, fam, px, cx, cy, s = 1, c1 = CHUAN.mau.trang, c2 = CHUAN.mau.troi, glow = CHUAN.mau.troi, alpha = 1) {
  if (s <= 0.01 || alpha <= 0.01) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, cy); ctx.scale(s, s);
  ctx.font = font(fam, px); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const g = ctx.createLinearGradient(0, -px * 0.55, 0, px * 0.55); g.addColorStop(0, rgb(c1)); g.addColorStop(1, rgb(c2));
  ctx.shadowColor = rgb(glow, 0.85); ctx.shadowBlur = 26; ctx.fillStyle = g; ctx.fillText(txt, 0, 0);
  ctx.shadowBlur = 0; ctx.fillText(txt, 0, 0); ctx.restore();
}

export function chu(ctx, txt, fam, px, cx, cy, mau = CHUAN.mau.trang, vien = 0, s = 1, alpha = 1) {
  if (s <= 0.01 || alpha <= 0.01) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, cy); ctx.scale(s, s);
  ctx.font = font(fam, px); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (vien) { ctx.lineJoin = 'round'; ctx.lineWidth = vien * 2; ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.strokeText(txt, 0, 0); }
  ctx.fillStyle = typeof mau === 'string' ? mau : rgb(mau); ctx.fillText(txt, 0, 0); ctx.restore();
}

// nhãn kính hình viên thuốc, chấm màu bên trái
export function chip(ctx, txt, cy, cham = null, px = 46, cx = W / 2, s = 1) {
  if (s <= 0.01) return;
  ctx.font = font('BVX', px); const tw = ctx.measureText(txt).width;
  const w = (tw + (cham ? 110 : 70)) * s, h = (px + 50) * s, x0 = cx - w / 2, y0 = cy - h / 2;
  theKinh(ctx, [x0, y0, x0 + w, y0 + h], h / 2, 0.45);
  if (cham) { ctx.fillStyle = rgb(cham); ctx.beginPath(); ctx.arc(x0 + 40 * s, cy, 11 * s, 0, Math.PI * 2); ctx.fill(); chu(ctx, txt, 'BVX', px, cx + 20 * s, cy, CHUAN.mau.trang, 0, s); }
  else chu(ctx, txt, 'BVX', px, cx, cy, CHUAN.mau.trang, 0, s);
}

// nhãn vàng nghiêng (PHẦN 1)
export function nhanVang(ctx, txt, cx, cy, px = 34, s = 1) {
  if (s <= 0.01) return;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-6 * Math.PI / 180); ctx.scale(s, s);
  ctx.font = font('BVX', px); const w = ctx.measureText(txt).width + 44, h = px + 22;
  ctx.fillStyle = rgb(CHUAN.mau.vang); ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2); ctx.fill();
  ctx.fillStyle = '#141414'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, 0, 1); ctx.restore();
}

// thẻ hook lớn (dùng cho mở đầu, kết, ảnh bìa — cùng một khung)
export function theHook(ctx, nho, lon, k = 1, box = CHUAN.an_toan.the_lon, lon2 = null) {
  theKinh(ctx, box, 36, 0.25);
  const [x0, y0, x1, y1] = box, cx = (x0 + x1) / 2, maxW = (x1 - x0) - 60;
  const pn = vuaChu(ctx, nho, 'BVX', 46, maxW);
  chu(ctx, nho, 'BVX', pn, cx, y0 + 72, CHUAN.mau.trang, 0, k);
  if (lon2) {
    const p1 = vuaChu(ctx, lon, 'Anton', 150, maxW), p2 = vuaChu(ctx, lon2, 'Anton', 126, maxW);
    chuGradient(ctx, lon, 'Anton', p1, cx, y0 + 190, k); chuGradient(ctx, lon2, 'Anton', p2, cx, y0 + 332, k);
  } else {
    const pl = vuaChu(ctx, lon, 'Anton', 132, maxW);
    chuGradient(ctx, lon, 'Anton', pl, cx, y0 + 186, k);
  }
}

// phụ đề: hiện cả cụm ≤5 chữ, chữ đã đọc sáng, từ khoá xanh trời, nền mờ vừa khít
export function phuDe(ctx, cum, u, y = CHUAN.an_toan.y_phu_de) {
  if (!cum) return;
  const px = 52, sp = 18; ctx.font = font('BVX', px);
  const ws = cum.map(w => ctx.measureText(w.chu).width), tong = ws.reduce((a, b) => a + b, 0) + sp * (cum.length - 1);
  ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.41)'; ctx.beginPath(); ctx.roundRect(W / 2 - tong / 2 - 30, y - 42, tong + 60, 86, 28); ctx.fill(); ctx.restore();
  let x = W / 2 - tong / 2;
  cum.forEach((w, i) => {
    const doc = u >= w.us - 0.06;
    chu(ctx, w.chu, 'BVX', px, x + ws[i] / 2, y, w.nhan ? CHUAN.mau.troi : CHUAN.mau.trang, doc ? 5 : 3, 1, doc ? 1 : 0.45);
    x += ws[i] + sp;
  });
}

// vòng khoanh nhấp nháy chỗ bấm
export function vong(ctx, x, y, k, mau = CHUAN.mau.vang) {
  ctx.save(); ctx.strokeStyle = rgb(mau); ctx.lineWidth = 9;
  ctx.beginPath(); ctx.arc(x, y, 70 + 18 * Math.sin(k * 10), 0, Math.PI * 2); ctx.stroke();
  const p = (k * 1.6) % 1; ctx.strokeStyle = rgb(mau, 0.8 * (1 - p)); ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(x, y, 70 + 120 * p, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}

// ----- chuyển cảnh -----
export function quetSang(ctx, u, dai = 0.38) {
  if (u >= dai) return; const k = u / dai;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const c0 = -500 + (W + H * 0.45 + 1000) * k, n = 1 + 0.45 * 0.45, p = c => [c / n, 0.45 * c / n];   // vệt chéo x+0.45y=c0
  const g = ctx.createLinearGradient(...p(c0 - 280), ...p(c0 + 280));
  const a = 0.85 * (1 - k); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
}
export function chopMat(ctx, k) { // k=0 mở, 1 khép
  if (k <= 0.001) return; const hh = H / 2 * Math.min(1, k) + 2;
  ctx.save(); ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(W / 2, 0, W * 0.9, hh, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(W / 2, H, W * 0.9, hh, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
export function loe(ctx, u, dai = 0.18, mau = [255, 255, 255]) {
  if (u >= dai) return; ctx.save(); ctx.fillStyle = rgb(mau, 0.85 * (1 - u / dai)); ctx.fillRect(0, 0, W, H); ctx.restore();
}
