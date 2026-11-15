// BẢNG DỰNG (timeline): nhìn thấy dự án đang edit — cảnh, âm thanh, phụ đề, chữ & hiệu ứng — bấm để sửa, kéo để dời/đổi độ dài.
import { SR } from './audio.js';

export const TEN_LOAI = { hook: 'Thẻ mở đầu', nhan: 'Nhãn', buoc: 'Bước', so: 'Số phát sáng', gia: 'Thẻ giá', xong: 'Xong!', cta: 'Follow', chia_doi: 'Chia đôi', chen: 'Chữ chèn', zoom: 'Zoom', che: 'Che mờ' };
const MAU = { hook: '#fe2c55', nhan: '#6ebeff', buoc: '#ffc83d', so: '#ff9f43', gia: '#ffd84d', xong: '#3ddc84', cta: '#ff5c8a', chia_doi: '#b38cff', chen: '#ffffff', zoom: '#9aa3b2', che: '#7d8597' };
const HANG = [['canh', 'Cảnh'], ['am', 'Âm thanh'], ['phude', 'Phụ đề'], ['tren', 'Chữ trên'], ['duoi', 'Chữ dưới'], ['phu', 'Zoom · che']];
const HANG_LOAI = { hook: 'tren', nhan: 'tren', buoc: 'tren', chia_doi: 'tren', chen: 'tren', so: 'duoi', gia: 'duoi', xong: 'duoi', cta: 'duoi', zoom: 'phu', che: 'phu' };
const nhanCua = h => h.loai === 'hook' ? h.lon : h.loai === 'buoc' ? `B${h.so} ${h.ten || ''}` : h.loai === 'chia_doi' ? `${h.trai} | ${h.phai}` : h.loai === 'cta' ? 'FOLLOW' : h.loai === 'xong' ? 'XONG!' : h.loai === 'zoom' ? '🔍' : h.loai === 'che' ? 'mờ' : h.chu || '';

export class BangDung {
  constructor(goc, cb) {
    this.cb = cb; this.pps = 40; this.kh = null; this.chon = null; this.vung = null; this.anh = new Map();
    goc.innerHTML = `<div class="bd-khung"><div class="bd-nhan">${HANG.map(([k, t]) => `<div class="bd-ten bd-h-${k}">${t}</div>`).join('')}</div>
      <div class="bd-cuon"><div class="bd-thuoc"></div>${HANG.map(([k]) => `<div class="bd-hang bd-h-${k}" data-hang="${k}"></div>`).join('')}<div class="bd-vung an"></div><div class="bd-dau"></div></div></div>`;
    this.cuon = goc.querySelector('.bd-cuon'); this.thuoc = goc.querySelector('.bd-thuoc'); this.dau = goc.querySelector('.bd-dau'); this.vungEl = goc.querySelector('.bd-vung');
    this.hang = Object.fromEntries(HANG.map(([k]) => [k, goc.querySelector(`.bd-hang[data-hang=${k}]`)]));
    // bấm chỗ trống → tua; kéo trên thước → chọn vùng cắt
    this.cuon.addEventListener('pointerdown', e => {
      if (e.target.closest('.bd-khoi')) return;
      const t = this.tAt(e); if (e.target === this.thuoc) { this.keoVung = t; this.datVung([t, t]); this.thuoc.setPointerCapture(e.pointerId); }
      else { this.datVung(null); this.chonKhoi(null); }
      this.cb.tua(t);
    });
    this.thuoc.addEventListener('pointermove', e => { if (this.keoVung != null) { const t = this.tAt(e); this.datVung([Math.min(this.keoVung, t), Math.max(this.keoVung, t)]); this.cb.tua(t); } });
    this.thuoc.addEventListener('pointerup', () => { if (this.keoVung == null) return; this.keoVung = null; if (this.vung && this.vung[1] - this.vung[0] < 0.15) this.datVung(null); this.cb.vung(this.vung); });
  }
  tAt(e) { const r = this.cuon.getBoundingClientRect(); return Math.max(0, Math.min(this.kh?.tong || 0, (e.clientX - r.left + this.cuon.scrollLeft) / this.pps)); }
  x(t) { return t * this.pps; }
  datPps(p) { this.pps = p; if (this.kh) this.ve(this.kh); }
  datVung(v) { this.vung = v; this.vungEl.classList.toggle('an', !v); if (v) { this.vungEl.style.left = this.x(v[0]) + 'px'; this.vungEl.style.width = Math.max(2, this.x(v[1] - v[0])) + 'px'; } }
  dauPhat(t) { this.dau.style.left = this.x(t) + 'px'; const L = this.x(t) - this.cuon.scrollLeft; if (L < 0 || L > this.cuon.clientWidth - 30) this.cuon.scrollLeft = Math.max(0, this.x(t) - 80); }

  ve(kh) {
    this.kh = kh; this._lan = {}; const W = Math.max(this.cuon.clientWidth, this.x(kh.tong) + 60);
    for (const el of [this.thuoc, ...Object.values(this.hang)]) { el.innerHTML = ''; el.style.width = W + 'px'; }
    // thước giây
    const buoc = this.pps >= 60 ? 1 : this.pps >= 25 ? 2 : 5;
    for (let s = 0; s <= kh.tong; s += buoc) { const v = document.createElement('span'); v.style.left = this.x(s) + 'px'; v.textContent = s + 's'; this.thuoc.append(v); }
    // cảnh
    kh.doan.forEach((s, i) => {
      const b = this.khoi('canh', s.t0, s.dai, (s.r.ten || '').replace(/\.[^.]+$/, ''), { kieu: 'canh', i });
      if (s.chuyen) { const c = document.createElement('i'); c.className = 'bd-chuyen'; c.title = 'Chuyển cảnh: ' + s.chuyen; b.append(c); }
      this.anhCanh(s).then(u => { if (u) b.style.backgroundImage = `url(${u})`; });
    });
    // âm thanh: dạng sóng tổng
    const cv = document.createElement('canvas'), Wd = Math.ceil(this.x(kh.tong)); cv.width = Wd; cv.height = 40; cv.className = 'bd-song';
    const c2 = cv.getContext('2d'), pk = new Float32Array(Wd);
    for (const tr of kh.am) { const s0 = tr.t * this.pps, g = tr.gain ?? 1, step = SR / this.pps; for (let px = 0; px < tr.x.length / step; px++) { const X = Math.floor(s0 + px); if (X < 0 || X >= Wd) continue; let m = 0; const i0 = Math.floor(px * step); for (let i = i0; i < i0 + step && i < tr.x.length; i += 16) m = Math.max(m, Math.abs(tr.x[i])); pk[X] = Math.max(pk[X], m * g); } }
    const mx = Math.max(1e-6, ...pk.filter((_, i) => i % 7 === 0)); c2.fillStyle = '#5fd38a';
    for (let X = 0; X < Wd; X++) { const h = Math.min(1, pk[X] / mx) * 36; c2.fillRect(X, 20 - h / 2, 1, Math.max(1, h)); }
    this.hang.am.append(cv);
    // phụ đề
    (kh.cum || []).forEach((cm, i) => { const t0 = cm[0].us, t1 = Math.max(cm.at(-1).ue, t0 + 0.3); this.khoi('phude', t0, t1 - t0, cm.map(w => w.chu).join(' '), { kieu: 'cum', i, t0, t1 }); });
    // chữ & hiệu ứng
    if (kh.hook) this.khoi('tren', 0, kh.hook.dai || 3, kh.hook.lon, { kieu: 'hook' }, 'hook', true);
    (kh.hieu || []).forEach(h => this.khoi(HANG_LOAI[h.loai] || 'tren', h.t, h.dai, nhanCua(h), { kieu: 'hieu', h }, h.loai, true));
    (kh.chen || []).forEach(c => this.khoi('tren', c.t, c.dai || 2.5, c.chu, { kieu: 'chen', c }, 'chen', true));
    (kh.zoomVao || []).forEach(z => this.khoi('phu', z.t, 1.5, '🔍', { kieu: 'zoom', z }, 'zoom', true));
    (kh.che || []).forEach(r => this.khoi('phu', r.t0, Math.min(kh.tong, r.t1) - r.t0, 'che mờ', { kieu: 'che', r }, 'che'));
    if (this.chon) this.chonKhoi(this.timLai(this.chon), true);
  }
  khoi(hang, t, dai, chu, muc, loai = null, keoDuoc = false) {
    const b = document.createElement('div'); b.className = 'bd-khoi' + (loai ? ' bd-' + loai : ''); b.style.left = this.x(t) + 'px'; b.style.width = Math.max(6, this.x(dai) - 2) + 'px';
    if (loai) b.style.setProperty('--m', MAU[loai]); b.title = (loai ? TEN_LOAI[loai] + ': ' : '') + chu; b.innerHTML = `<span>${chu.replace(/</g, '&lt;')}</span>`; b._muc = muc;
    b.onpointerdown = e => { e.stopPropagation(); this.chonKhoi(muc); this.cb.tua(Math.max(t + 0.05, Math.min(this.tAt(e), t + dai - 0.05))); if (keoDuoc) this.batDauKeo(e, b, muc, e.target.classList.contains('bd-mep') ? 'dai' : 'doi'); };
    if (keoDuoc) { const m = document.createElement('i'); m.className = 'bd-mep'; b.append(m); }
    // khối chồng giờ nhau trong cùng hàng → chia đôi chiều cao (2 làn) để bấm được cả hai
    if (loai && hang !== 'phude') { const L = (this._lan ||= {})[hang] ||= [0, 0]; const ket = t + dai;
      if (t < L[0] - 0.01) { b.classList.add('lan2'); L[1] = Math.max(L[1], ket); const truoc = this.hang[hang].lastElementChild; if (truoc && !truoc.classList.contains('lan2')) truoc.classList.add('lan1'); } else L[0] = ket; }
    this.hang[hang].append(b); return b;
  }
  batDauKeo(e, b, muc, kieu) {
    const x0 = e.clientX, v = this.layTD(muc); if (!v) return; let doi = false; b.setPointerCapture(e.pointerId);
    b.onpointermove = ev => { const dt = (ev.clientX - x0) / this.pps; if (Math.abs(ev.clientX - x0) < 3 && !doi) return; doi = true;
      if (kieu === 'doi') b.style.left = this.x(Math.max(0, v.t + dt)) + 'px'; else b.style.width = Math.max(6, this.x(Math.max(0.3, v.dai + dt))) + 'px'; };
    b.onpointerup = ev => { b.onpointermove = b.onpointerup = null; if (!doi) return; const dt = (ev.clientX - x0) / this.pps;
      const moi = kieu === 'doi' ? { t: Math.max(0, Math.min(this.kh.tong - 0.3, v.t + dt)) } : { dai: Math.max(0.3, v.dai + dt) }; this.cb.doi(muc, moi); };
  }
  layTD(m) { return m.kieu === 'hook' ? { t: 0, dai: this.kh.hook.dai || 3 } : m.kieu === 'hieu' ? m.h : m.kieu === 'chen' ? { t: m.c.t, dai: m.c.dai || 2.5 } : m.kieu === 'zoom' ? { t: m.z.t, dai: 1.5 } : null; }
  timLai(m) { // sau khi vẽ lại, tìm khối tương ứng
    for (const el of this.cuon.querySelectorAll('.bd-khoi')) { const n = el._muc; if (n.kieu === m.kieu && (n.i === m.i && m.i != null || n.h === m.h && m.h || n.c === m.c && m.c || n.z === m.z && m.z || n.r === m.r && m.r || m.kieu === 'hook')) return n; }
    return null;
  }
  chonKhoi(muc, imLang = false) {
    this.chon = muc; for (const el of this.cuon.querySelectorAll('.bd-khoi')) el.classList.toggle('chon', !!muc && el._muc === muc);
    if (!imLang) this.cb.chon(muc);
  }
  async anhCanh(s) {
    const k = s.r.ten + '|' + s.a.toFixed(2); if (this.anh.has(k)) return this.anh.get(k);
    const p = (async () => { try { const w = await s.r.sink.getCanvas(Math.min(s.r.dur - 0.05, s.a + 0.3)); if (!w) return null; const c = document.createElement('canvas'); c.width = 45; c.height = 80; c.getContext('2d').drawImage(w.canvas, 0, 0, 45, 80); return c.toDataURL('image/jpeg', 0.6); } catch { return null; } })();
    this.anh.set(k, p); return p;
  }
}
