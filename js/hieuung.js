// THƯ VIỆN HIỆU ỨNG do bộ đạo diễn gọi (vẽ trên canvas, không cần CapCut).
// Hai "khe" để chữ không chồng nhau: khe TRÊN (nhãn máy, bước) ở y=210, khe DƯỚI (số, giá, xong, follow) ở y≈1290 — trên phụ đề (1500).
import { CHUAN } from './config.js';
import * as E from './effects.js';
const { W, H } = CHUAN, Y_TREN = CHUAN.an_toan.y_nhan, Y_DUOI = 1290;
const KHE = { nhan: 'tren', buoc: 'tren', so: 'duoi', gia: 'duoi', xong: 'duoi', cta: 'duoi' };
const XANH_LA = [60, 220, 120];

// độ hiện: nảy vào 0.3s, mờ ra 0.25s cuối
const vao = (u, dai) => ({ s: E.nay(u / 0.3), a: Math.min(1, Math.max(0, (dai - u) / 0.25)) });

// chọn hiệu ứng đang chạy cho từng khe (cái bắt đầu sau cùng thắng)
export function dangChay(hieu, t) {
  const kq = { tren: null, duoi: null, chia: null };
  for (const h of hieu) {
    if (t < h.t || t >= h.t + h.dai) continue;
    if (h.loai === 'chia_doi') { kq.chia = h; continue; }
    const k = KHE[h.loai]; if (k && (!kq[k] || h.t >= kq[k].t)) kq[k] = h;
  }
  return kq;
}

let _tam = null;
const tam = () => { if (!_tam) { _tam = document.createElement('canvas'); _tam.width = W; _tam.height = H; } return _tam; };

// CHIA ĐÔI: trên = clip kia (anhKhac), dưới = clip hiện tại; lấy dải giữa của mỗi khung
export function chiaDoi(ctx, h, u, anhKhac) {
  if (!anhKhac) return;
  const c = tam(), cc = c.getContext('2d'); cc.drawImage(ctx.canvas, 0, 0);
  const k = E.ease(u / 0.35), nua = H / 2, sy = H * 0.25;
  ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(anhKhac, 0, sy, W, nua, -W * (1 - k), 0, W, nua);        // trượt từ trái vào
  ctx.drawImage(c, 0, sy, W, nua, W * (1 - k), nua, W, nua);              // trượt từ phải vào
  ctx.fillStyle = '#fff'; ctx.fillRect(0, nua - 4, W * k, 8); ctx.restore();
  const a = vao(u, h.dai);
  E.chip(ctx, h.trai, 120, CHUAN.mau.xam || [170, 170, 170], 40, W / 2, a.s);
  E.chip(ctx, h.phai, nua + 120, CHUAN.mau.troi, 40, W / 2, a.s);
}

function nhan(ctx, h, u) { const a = vao(u, h.dai); ctx.save(); ctx.globalAlpha = a.a; E.chip(ctx, h.chu, Y_TREN, CHUAN.mau.troi, 46, W / 2, a.s); ctx.restore(); }

function buoc(ctx, h, u) {
  const a = vao(u, h.dai), txt = h.ten ? `BƯỚC ${h.so} · ${h.ten}` : `BƯỚC ${h.so}`;
  ctx.save(); ctx.globalAlpha = a.a;
  const px = E.vuaChu(ctx, txt, 'BVX', 46, 860); E.chip(ctx, txt, Y_TREN, CHUAN.mau.vang, px, W / 2, a.s);
  ctx.restore();
}

// số phát sáng: chữ to, quầng nhấp nháy, gạch chân chạy
function so(ctx, h, u) {
  const a = vao(u, h.dai), px = E.vuaChu(ctx, h.chu, 'Anton', 190, 900), nhip = 1 + 0.03 * Math.sin(u * 12);
  ctx.save(); ctx.globalAlpha = a.a;
  E.chuGradient(ctx, h.chu, 'Anton', px, W / 2, Y_DUOI, a.s * nhip, CHUAN.mau.trang, CHUAN.mau.vang, [255, 170, 60]);
  ctx.font = E.font('Anton', px); const w = ctx.measureText(h.chu).width * a.s, k = E.ease((u - 0.2) / 0.4);
  ctx.fillStyle = E.rgb(CHUAN.mau.vang); ctx.fillRect(W / 2 - w / 2, Y_DUOI + px * 0.55, w * k, 10);
  ctx.restore();
}

// thẻ giá: nền vàng, chữ đen, nhãn "GIÁ" nhỏ nghiêng
function gia(ctx, h, u) {
  const a = vao(u, h.dai); if (a.s <= 0.01) return;
  ctx.save(); ctx.globalAlpha = a.a; ctx.translate(W / 2, Y_DUOI); ctx.rotate(-3 * Math.PI / 180); ctx.scale(a.s, a.s);
  const px = E.vuaChu(ctx, h.chu, 'Anton', 150, 780); ctx.font = E.font('Anton', px);
  const w = ctx.measureText(h.chu).width + 120, hh = px + 70;
  ctx.shadowColor = 'rgba(255,200,61,0.7)'; ctx.shadowBlur = 40; ctx.fillStyle = E.rgb(CHUAN.mau.vang);
  ctx.beginPath(); ctx.roundRect(-w / 2, -hh / 2, w, hh, 30); ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = '#141414'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(h.chu, 0, 6);
  // nhãn đỏ "GIÁ CHỈ" ngồi trên mép trái thẻ
  ctx.font = E.font('BVX', 44); const lw = ctx.measureText('GIÁ CHỈ').width + 44, lh = 66;
  ctx.translate(-w / 2 + lw / 2 + 10, -hh / 2 - 8); ctx.rotate(-3 * Math.PI / 180);
  ctx.fillStyle = E.rgb(CHUAN.mau.hong_follow); ctx.beginPath(); ctx.roundRect(-lw / 2, -lh / 2, lw, lh, lh / 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText('GIÁ CHỈ', 0, 3);
  ctx.restore();
}

function xong(ctx, h, u) {
  const a = vao(u, h.dai); if (a.s <= 0.01) return;
  ctx.save(); ctx.globalAlpha = a.a;
  const r = 70 * a.s, cx = W / 2 - 170, k = E.ease((u - 0.15) / 0.35);
  ctx.fillStyle = E.rgb(XANH_LA); ctx.beginPath(); ctx.arc(cx, Y_DUOI, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 14 * a.s; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
  const p = [[cx - r * 0.45, Y_DUOI], [cx - r * 0.1, Y_DUOI + r * 0.35], [cx + r * 0.5, Y_DUOI - r * 0.35]];
  ctx.moveTo(...p[0]); if (k < 0.5) ctx.lineTo(p[0][0] + (p[1][0] - p[0][0]) * k * 2, p[0][1] + (p[1][1] - p[0][1]) * k * 2);
  else { ctx.lineTo(...p[1]); ctx.lineTo(p[1][0] + (p[2][0] - p[1][0]) * (k - 0.5) * 2, p[1][1] + (p[2][1] - p[1][1]) * (k - 0.5) * 2); }
  ctx.stroke(); ctx.restore();
  ctx.save(); ctx.globalAlpha = a.a; E.chu(ctx, 'XONG!', 'Anton', 150, W / 2 + 80, Y_DUOI, CHUAN.mau.trang, 6, a.s); ctx.restore();
}

// nút FOLLOW đỏ + BÌNH LUẬN kính, có vòng sóng quanh nút follow
function cta(ctx, h, u) {
  const a = vao(u, h.dai); if (a.s <= 0.01) return;
  const px = 50; ctx.font = E.font('BVX', px);
  const t1 = '+ FOLLOW', t2 = 'BÌNH LUẬN', w1 = ctx.measureText(t1).width + 80, w2 = ctx.measureText(t2).width + 80, hh = 104, gap = 30;
  const x1 = W / 2 - (w1 + w2 + gap) / 2, x2 = x1 + w1 + gap, y0 = Y_DUOI - hh / 2;
  ctx.save(); ctx.globalAlpha = a.a; ctx.translate(W / 2, Y_DUOI); ctx.scale(a.s, a.s); ctx.translate(-W / 2, -Y_DUOI);
  const p = (u * 1.2) % 1; ctx.strokeStyle = E.rgb(CHUAN.mau.hong_follow || [254, 44, 85], 0.8 * (1 - p)); ctx.lineWidth = 6;
  ctx.beginPath(); ctx.roundRect(x1 - 30 * p, y0 - 30 * p, w1 + 60 * p, hh + 60 * p, hh / 2 + 30 * p); ctx.stroke();
  ctx.fillStyle = E.rgb(CHUAN.mau.hong_follow || [254, 44, 85]); ctx.beginPath(); ctx.roundRect(x1, y0, w1, hh, hh / 2); ctx.fill();
  E.chu(ctx, t1, 'BVX', px, x1 + w1 / 2, Y_DUOI, CHUAN.mau.trang);
  ctx.restore();
  ctx.save(); ctx.globalAlpha = a.a; E.theKinh(ctx, [x2, y0, x2 + w2 * a.s, y0 + hh], hh / 2, 0.45); E.chu(ctx, t2, 'BVX', px, x2 + w2 / 2, Y_DUOI, CHUAN.mau.trang, 0, a.s); ctx.restore();
}

const VE = { nhan, buoc, so, gia, xong, cta };
// vẽ mọi hiệu ứng đang chạy ở giây t. anhChia: Map(h → canvas clip kia) cho chia đôi
export function veHieu(ctx, kh, t, anhChia) {
  if (!kh.hieu?.length) return;
  const d = dangChay(kh.hieu, t), hookDangHien = kh.hook && t < (kh.hook.dai || 3);
  if (d.chia) chiaDoi(ctx, d.chia, t - d.chia.t, anhChia?.get(d.chia));
  if (d.tren && !hookDangHien && !(d.chia && anhChia?.get(d.chia))) VE[d.tren.loai](ctx, d.tren, t - d.tren.t);
  if (d.duoi && !hookDangHien && !(d.chia && d.duoi.loai === 'so')) VE[d.duoi.loai](ctx, d.duoi, t - d.duoi.t);
}

// tiếng đi kèm từng hiệu ứng
export const TIENG = { nhan: ['pop', -20], buoc: ['tich', -18], so: ['ding', -20], gia: ['ding', -18], xong: ['tada', -20], cta: ['pop', -18], chia_doi: ['vut_zoom', -20] };
