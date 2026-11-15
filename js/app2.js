// Xưởng Dựng Video — thả video thô, máy tự edit; nhìn thấy DỰ ÁN trên bảng dựng; sửa tay ngay (bấm/kéo) hoặc gõ góp ý; lịch sử bản.
import { phanTich, lapKeHoach, xuat, anhBia, xemKhung, layAnhChia, boDoan, suaCum } from './tudong.js';
import { hieuGopY, MAU_CAU } from './gopy.js';
import { docAm, db, timNhip } from './audio.js';
import { datMoHinh, gomCum } from './nghe.js';
import { BangDung, TEN_LOAI } from './timeline.js';
const PHIEN_BAN = '0.4.0';
const $ = s => document.querySelector(s);
$('#ban').textContent = 'Phiên bản ' + PHIEN_BAN;

let nhip = null, files = [], kq = new Map(), gop = {}, ban = [], dangXem = -1, nhac = null, huy = { co: false }, banDang = false;
let duAn = null, chuaDung = false, hoanTac = [], lamLai = [], anhChia = null;
window.__xd = { get ban() { return ban; }, get duAn() { return duAn; } };   // để soát lỗi
const tienDo = (m, k) => { $('#tienChu').textContent = m; if (k != null) $('#thanh').style.width = (k * 100).toFixed(1) + '%'; };
const tuNhien = (a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true });
const xem = $('#xem'), nhap = $('#nhap'), nctx = nhap.getContext('2d');

$('#nutCaiDat').onclick = () => $('#caiDat').classList.toggle('an');
for (const id of ['cdPhuDe', 'cdChinhXac', 'cdCao']) { const el = $('#' + id); try { const v = localStorage.getItem('xd_' + id); if (v != null) el.checked = v === '1'; } catch { } el.onchange = () => { try { localStorage.setItem('xd_' + id, el.checked ? '1' : '0'); } catch { } datMoHinh($('#cdChinhXac').checked); }; }
datMoHinh($('#cdChinhXac').checked);
async function kiemBan() { try { const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); const v = (await r.json()).phien_ban; if (v && v !== PHIEN_BAN) $('#banMoi').classList.remove('an'); } catch { } }
$('#taiLai').onclick = () => location.reload(); kiemBan(); setInterval(kiemBan, 600000);

// ---------- thêm file ----------
const tha = $('#tha');
['dragenter', 'dragover'].forEach(e => tha.addEventListener(e, ev => { ev.preventDefault(); tha.classList.add('keo'); }));
['dragleave', 'drop'].forEach(e => tha.addEventListener(e, ev => { ev.preventDefault(); tha.classList.remove('keo'); }));
tha.addEventListener('drop', ev => them([...ev.dataTransfer.files]));
$('#chonFile').onchange = e => { them([...e.target.files]); e.target.value = ''; };
$('#nhac').onchange = async e => { const f = e.target.files[0]; if (!f) return; $('#tenNhac').textContent = 'Đang đọc ' + f.name + '…'; nhac = await docAm(f); nhip = timNhip(nhac); $('#tenNhac').textContent = '🎵 ' + f.name + (nhip ? ` · ${nhip.bpm} BPM — cắt cảnh theo nhịp` : ''); };

function them(ds) {
  ds = ds.filter(f => /^(video|audio)\//.test(f.type) || /\.(mp4|mov|m4v|mp3|wav|m4a|aac)$/i.test(f.name)).sort(tuNhien);
  files.push(...ds); veDs(); phanTichHet();
}
function veDs() {
  const ol = $('#dsFile'); ol.innerHTML = '';
  files.forEach((f, i) => {
    const r = kq.get(f), li = document.createElement('li');
    const vai = !r ? ['đang đọc…', ''] : r.laAm ? (r.coLoi ? ['giọng thu riêng', 'giong'] : ['âm thanh', '']) : r.coLoi ? ['có lời nói', 'loi'] : ['không lời', ''];
    li.innerHTML = `<span class="ten">${i + 1}. ${f.name}${r?.dur ? ` · ${r.dur.toFixed(1)}s` : ''}</span><span class="vai ${vai[1]}">${vai[0]}</span>`;
    for (const [nhan, fn] of [['↑', () => { if (i) { [files[i - 1], files[i]] = [files[i], files[i - 1]]; veDs(); } }], ['↓', () => { if (i < files.length - 1) { [files[i + 1], files[i]] = [files[i], files[i + 1]]; veDs(); } }], ['✕', () => { files.splice(i, 1); veDs(); }]]) {
      const b = document.createElement('button'); b.textContent = nhan; b.onclick = fn; li.append(b);
    }
    ol.append(li);
  });
  $('#dung').disabled = !files.length || files.some(f => !kq.has(f));
}
let _dangDoc = false;
async function phanTichHet() {
  if (_dangDoc) return; _dangDoc = true;
  try {
    for (let f; (f = files.find(x => !kq.has(x)));) {
      tienDo(`Đọc ${f.name}…`);
      try { kq.set(f, await phanTich(f, m => tienDo(`${f.name}: ${m}`), { phuDe: $('#cdPhuDe').checked })); }
      catch (e) { tienDo(`Không đọc được ${f.name}: ${e.message}`); files = files.filter(x => x !== f); }
      veDs();
    }
    tienDo(`Đã đọc ${files.length} file`);
    if (files.length && !ban.length) dung('Bản đầu tiên (máy tự edit)', true);
  } finally { _dangDoc = false; }
}

// ---------- DỰ ÁN ----------
const sao = kh => ({ ...kh, doan: kh.doan.map(s => ({ ...s })), am: kh.am.map(a => ({ ...a })), chu: kh.chu.map(w => ({ ...w })),
  hieu: structuredClone(kh.hieu || []), chen: structuredClone(kh.chen || []), zoomVao: structuredClone(kh.zoomVao || []), che: structuredClone(kh.che || []), hook: kh.hook ? { ...kh.hook } : null });
const saoDu = kh => { const k = sao(kh); k.cum = gomCum(k.chu); return k; };
// ghi lại thao tác tay vào gop.tay để "dựng lại từ kế hoạch" (vd nhanh hơn) vẫn giữ
function ghiTay() {
  const t = gop.tay || {};
  gop.tay = { bo: t.bo || [], cum: t.cum || [], chuyen: t.chuyen || {}, hieu: structuredClone(duAn.hieu), zoom: structuredClone(duAn.zoomVao), chen: structuredClone(duAn.chen), che: structuredClone(duAn.che), hook: duAn.hook ? { ...duAn.hook } : null };
}
function suaTay(fn, moTa) {
  if (!duAn) return;
  hoanTac.push({ duAn: saoDu(duAn), gop: structuredClone(gop) }); if (hoanTac.length > 50) hoanTac.shift(); lamLai = [];
  fn(); duAn.cum = gomCum(duAn.chu); ghiTay(); anhChia = null;
  danhDau(true, moTa); bang.ve(duAn); veThuocTinh(bang.chon); xemNhap();
}
function danhDau(co, moTa = '') {
  chuaDung = co; $('#nutDungLai').classList.toggle('nhay', co); $('#nutDungLai').disabled = !co || banDang;
  $('#trangThai').textContent = co ? `Đã sửa: ${moTa} — bấm "Dựng lại" để ra video mới (khung trên là xem trước)` : '';
  $('#hoanTac').disabled = !hoanTac.length; $('#lamLai').disabled = !lamLai.length;
}
function khoiPhuc(s, moTa) { duAn = s.duAn; gop = s.gop; anhChia = null; bang.chon = null; danhDau(true, moTa); bang.ve(duAn); veThuocTinh(null); xemNhap(); }
$('#hoanTac').onclick = () => { if (!hoanTac.length) return; lamLai.push({ duAn: saoDu(duAn), gop: structuredClone(gop) }); khoiPhuc(hoanTac.pop(), 'hoàn tác'); };
$('#lamLai').onclick = () => { if (!lamLai.length) return; hoanTac.push({ duAn: saoDu(duAn), gop: structuredClone(gop) }); khoiPhuc(lamLai.pop(), 'làm lại'); };

// lapLai = true: lập lại kế hoạch từ clip (vẫn giữ thao tác tay trong gop.tay); false: chỉ xuất dự án hiện tại
async function dung(ghiChu, lapLai = false) {
  if (banDang) return; banDang = true; for (const id of ['#dung', '#sua', '#nutDungLai']) $(id).disabled = true;
  try {
    const ds = files.map(f => kq.get(f)).filter(Boolean); if (!ds.length) return;
    await document.fonts.load("40px 'Anton'"); await document.fonts.load("800 40px 'BVX'");
    if (lapLai || !duAn) duAn = lapKeHoach(ds, { gop, nhip: nhac && gop.nhac !== 0 ? nhip : null });
    duAn.mau = gop.mau || 1; duAn.coChu = gop.coChu ?? 1;
    const t0 = performance.now();
    const blob = await xuat(duAn, { nhac: nhacDung(), cao: $('#cdCao').checked, bao: tienDo, huy });
    ban.push({ so: ban.length + 1, ghiChu, gop: structuredClone(gop), kh: saoDu(duAn), blob, url: URL.createObjectURL(blob), luc: new Date() });
    xemBan(ban.length - 1, false);
    tienDo(`Xong ${duAn.tong.toFixed(1)} giây video · dựng mất ${((performance.now() - t0) / 1000).toFixed(0)} giây`, 1);
    $('#phanHoi').innerHTML = duAn.khongLoi && !duAn.hook ? '<span class="ok">Clip không có lời nói nên máy chưa biết ghi chữ gì — bấm "+ Thẻ mở đầu" hoặc "+ Nhãn" trên thanh công cụ.</span>' : '';
    for (const id of ['#khuGopY', '#khuLichSu', '#taiVe', '#khuBang']) $(id).classList.remove('an');
    banDang = false; danhDau(false); bang.ve(duAn); veThuocTinh(bang.chon);
  } catch (e) { tienDo('Lỗi: ' + e.message); console.error(e); }
  finally { banDang = false; $('#dung').disabled = false; $('#sua').disabled = false; $('#nutDungLai').disabled = !chuaDung; }
}
$('#dung').onclick = () => { if (ban.length && gop.tay && !confirm('Dựng lại từ đầu sẽ bỏ hết phần sửa tay trên bảng dựng. Tiếp tục?')) return; delete gop.tay; hoanTac = []; dung(ban.length ? 'Dựng lại từ đầu' : 'Bản đầu tiên (máy tự edit)', true); };
$('#nutDungLai').onclick = () => dung(($('#trangThai').textContent.match(/^Đã sửa: (.*?) — /) || [, 'Sửa tay'])[1]);
function nhacDung() { if (!nhac || gop.nhac === 0) return null; const k = db((gop.nhacDb ?? -20) + 20); return k === 1 ? nhac : nhac.map(v => v * k); }

function xemBan(i, napDuAn = true) {
  dangXem = i; const b = ban[i]; xem.src = b.url; $('#trong').classList.add('an');
  if (napDuAn) { gop = structuredClone(b.gop); duAn = saoDu(b.kh); anhChia = null; hoanTac = []; lamLai = []; bang.chon = null; danhDau(false); bang.ve(duAn); veThuocTinh(null); }
  const ol = $('#lichSu'); ol.innerHTML = '';
  ban.slice().reverse().forEach(x => {
    const li = document.createElement('li'); if (x === b) li.className = 'dang';
    li.textContent = `Bản ${x.so} · ${x.luc.toLocaleTimeString('vi')} · ${x.ghiChu} · ${x.kh.tong.toFixed(1)}s`;
    if (x !== b) { const bt = document.createElement('button'); bt.textContent = 'Quay lại bản này'; bt.onclick = () => xemBan(ban.indexOf(x)); li.append(bt); }
    ol.append(li);
  });
  veCaption(b.kh);
}

// ---------- XEM TRƯỚC & BẢNG DỰNG ----------
let _ve = 0;
async function xemNhap(t = xem.currentTime || 0) {
  const hien = chuaDung && xem.paused && duAn; nhap.classList.toggle('an', !hien); if (!hien) return;
  const id = ++_ve; anhChia ||= await layAnhChia(duAn); if (id !== _ve) return;
  await xemKhung(nctx, duAn, Math.min(t, duAn.tong - 0.04), anhChia);
}
const bang = new BangDung($('#bang'), {
  tua: t => { xem.pause(); if (xem.duration) xem.currentTime = Math.min(t, xem.duration - 0.03); $('#gio').textContent = t.toFixed(1) + 's'; bang.dauPhat(t); xemNhap(t); },
  chon: m => veThuocTinh(m),
  vung: v => { $('#catVung').disabled = !v; $('#catVung').textContent = v ? `✂ Cắt bỏ ${v[0].toFixed(1)}–${v[1].toFixed(1)}s` : '✂ Cắt bỏ đoạn'; },
  doi: (m, moi) => suaTay(() => {
    if (m.kieu === 'hook') { if (moi.dai) duAn.hook.dai = moi.dai; }
    else if (m.kieu === 'hieu') { const h = timHieu(m.h); if (h) { Object.assign(h, moi); m.h = h; } duAn.hieu.sort((a, b) => a.t - b.t); }
    else if (m.kieu === 'chen') { const c = timChen(m.c); if (c) { Object.assign(c, moi); m.c = c; } }
    else if (m.kieu === 'zoom') { const z = duAn.zoomVao.find(x => x.t === m.z.t); if (z && moi.t != null) { z.t = moi.t; m.z = z; } }
  }, moi.t != null ? `dời ${tenMuc(m)}` : `đổi độ dài ${tenMuc(m)}`),
});
const timHieu = h => duAn.hieu.find(x => x === h) || duAn.hieu.find(x => x.loai === h.loai && Math.abs(x.t - h.t) < 1e-6 && (x.chu || x.ten || '') === (h.chu || h.ten || ''));
const timChen = c => duAn.chen.find(x => x === c) || duAn.chen.find(x => x.t === c.t && x.chu === c.chu);
const tenMuc = m => m.kieu === 'hieu' ? TEN_LOAI[m.h.loai].toLowerCase() : m.kieu === 'hook' ? 'thẻ mở đầu' : m.kieu === 'chen' ? 'chữ chèn' : m.kieu;
$('#phongBang').oninput = e => bang.datPps(+e.target.value);
(function dongBo() { if (!xem.paused && duAn) { bang.dauPhat(xem.currentTime); $('#gio').textContent = xem.currentTime.toFixed(1) + 's'; } requestAnimationFrame(dongBo); })();
xem.addEventListener('play', () => { nhap.classList.add('an'); if (chuaDung) $('#trangThai').textContent = 'Đang phát bản cũ — bấm "Dựng lại" để xem bản đã sửa'; });
xem.addEventListener('pause', () => xemNhap());
xem.addEventListener('seeked', () => { if (!duAn) return; bang.dauPhat(xem.currentTime); $('#gio').textContent = xem.currentTime.toFixed(1) + 's'; xemNhap(); });

// ---------- BẢNG THUỘC TÍNH (sửa khối đang chọn) ----------
const CHUYEN = [['', 'Không'], ['quet_sang', 'Quét sáng'], ['zoom', 'Zoom'], ['truot', 'Trượt'], ['chop_mat', 'Chớp mắt'], ['loe', 'Loé trắng']];
const O = (nhan, ten, gt, kieu = 'text') => `<label>${nhan}<input data-k="${ten}" type="${kieu}" ${kieu === 'number' ? 'step="0.1" min="0"' : ''} value="${String(gt ?? '').replace(/"/g, '&quot;')}"></label>`;
function veThuocTinh(m) {
  const el = $('#thuocTinh'); if (!m || !duAn) { el.innerHTML = '<h3>Sửa nhanh</h3><div class="nho">• Bấm 1 khối trên bảng dựng để sửa chữ, thời gian hoặc xoá.<br>• Kéo khối để dời, kéo mép phải để đổi độ dài.<br>• Kéo trên thước giây để chọn đoạn cần cắt.<br>• Phím: Space phát/dừng · Delete xoá · Ctrl/⌘+Z hoàn tác.</div>'; return; }
  let html = '', luu = null, xoa = null;
  if (m.kieu === 'canh') {
    const s = duAn.doan[m.i]; if (!s) return veThuocTinh(null);
    html = `<h3>Cảnh ${m.i + 1}</h3><div class="nho">${s.r.ten} · lấy ${s.a.toFixed(1)}–${s.b.toFixed(1)}s của clip · đặt ở ${s.t0.toFixed(1)}s, dài ${s.dai.toFixed(1)}s${Math.abs(s.toc - 1) > 0.01 ? ` · tốc độ ×${s.toc.toFixed(2)}` : ''}</div>
      <label>Chuyển cảnh vào<select data-k="chuyen">${CHUYEN.map(([v, t]) => `<option value="${v}" ${(s.chuyen || '') === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
    luu = v => suaTay(() => { duAn.doan[m.i].chuyen = v.chuyen || null; gop.tay ||= {}; gop.tay.chuyen = { ...(gop.tay.chuyen || {}), [m.i]: v.chuyen || '' }; }, 'đổi chuyển cảnh');
    xoa = () => catDoan(s.t0, s.t0 + s.dai, `bỏ cảnh ${m.i + 1}`);
  } else if (m.kieu === 'cum') {
    html = `<h3>Phụ đề ${m.t0.toFixed(1)}–${m.t1.toFixed(1)}s</h3><label>Chữ<textarea data-k="chu" rows="2">${(duAn.cum[m.i] || []).map(w => w.chu).join(' ')}</textarea></label>`;
    const ghi = chu => suaTay(() => { suaCum(duAn, { t0: m.t0, t1: m.t1, chu }); gop.tay ||= {}; gop.tay.cum = [...(gop.tay.cum || []), { t0: m.t0, t1: m.t1, chu }]; }, chu ? 'sửa phụ đề' : 'xoá 1 câu phụ đề');
    luu = v => ghi(v.chu); xoa = () => { bang.chon = null; ghi(''); };
  } else if (m.kieu === 'hook') {
    const h = duAn.hook; if (!h) return veThuocTinh(null);
    html = `<h3>Thẻ mở đầu (cũng là ảnh bìa)</h3>${O('Dòng nhỏ', 'nho', h.nho)}${O('Dòng lớn', 'lon', h.lon)}${O('Dài (giây)', 'dai', (h.dai || 3).toFixed(1), 'number')}`;
    luu = v => suaTay(() => Object.assign(duAn.hook, { nho: v.nho.toUpperCase(), lon: v.lon.toUpperCase(), dai: +v.dai || 3, tuDong: false }), 'sửa thẻ mở đầu');
    xoa = () => suaTay(() => { duAn.hook = null; bang.chon = null; }, 'bỏ thẻ mở đầu');
  } else if (m.kieu === 'hieu') {
    const h = timHieu(m.h); if (!h) return veThuocTinh(null);
    const f = { nhan: O('Chữ', 'chu', h.chu), so: O('Số', 'chu', h.chu), gia: O('Giá', 'chu', h.chu), buoc: O('Bước số', 'so', h.so, 'number') + O('Tên bước', 'ten', h.ten), chia_doi: O('Nhãn nửa trên', 'trai', h.trai) + O('Nhãn nửa dưới', 'phai', h.phai) }[h.loai] || '';
    html = `<h3>${TEN_LOAI[h.loai]}</h3>${f}${O('Bắt đầu (giây)', 't', h.t.toFixed(1), 'number')}${O('Dài (giây)', 'dai', h.dai.toFixed(1), 'number')}`;
    luu = v => suaTay(() => { for (const [k, x] of Object.entries(v)) h[k] = ['t', 'dai', 'so'].includes(k) ? +x : x.toUpperCase(); duAn.hieu.sort((a, b) => a.t - b.t); m.h = h; }, `sửa ${TEN_LOAI[h.loai].toLowerCase()}`);
    xoa = () => suaTay(() => { duAn.hieu = duAn.hieu.filter(x => x !== h); bang.chon = null; }, `xoá ${TEN_LOAI[h.loai].toLowerCase()}`);
  } else if (m.kieu === 'chen') {
    const c = timChen(m.c); if (!c) return veThuocTinh(null);
    html = `<h3>Chữ chèn</h3>${O('Chữ', 'chu', c.chu)}${O('Bắt đầu (giây)', 't', c.t.toFixed(1), 'number')}${O('Dài (giây)', 'dai', (c.dai || 2.5).toFixed(1), 'number')}`;
    luu = v => suaTay(() => { Object.assign(c, { chu: v.chu.toUpperCase(), t: +v.t, dai: +v.dai }); m.c = c; }, 'sửa chữ chèn');
    xoa = () => suaTay(() => { duAn.chen = duAn.chen.filter(x => x !== c); bang.chon = null; }, 'xoá chữ chèn');
  } else if (m.kieu === 'zoom') {
    const z = duAn.zoomVao.find(x => x.t === m.z.t); if (!z) return veThuocTinh(null);
    html = `<h3>Zoom nhấn</h3>${O('Ở giây', 't', z.t.toFixed(1), 'number')}`;
    luu = v => suaTay(() => { z.t = +v.t; m.z = z; }, 'dời zoom'); xoa = () => suaTay(() => { duAn.zoomVao = duAn.zoomVao.filter(x => x !== z); bang.chon = null; }, 'xoá zoom');
  } else if (m.kieu === 'che') {
    html = `<h3>Vùng che mờ</h3><div class="nho">Che suốt video.</div>`; xoa = () => suaTay(() => { duAn.che = duAn.che.filter(x => !(x.x === m.r.x && x.y === m.r.y)); bang.chon = null; }, 'bỏ vùng che');
  }
  el.innerHTML = html + `<div class="hang">${luu ? '<button class="chinh" data-a="luu">Lưu</button>' : ''}${xoa ? '<button class="phu-btn nut-xoa" data-a="xoa">🗑 Xoá</button>' : ''}</div>`;
  const doc = () => Object.fromEntries([...el.querySelectorAll('[data-k]')].map(i => [i.dataset.k, i.value]));
  el.querySelector('[data-a=luu]')?.addEventListener('click', () => luu(doc()));
  el.querySelector('[data-a=xoa]')?.addEventListener('click', xoa);
  el.querySelectorAll('input,textarea').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && luu) { e.preventDefault(); luu(doc()); } }));
  if (m.kieu === 'canh') el.querySelector('select').onchange = () => luu(doc());
}
function catDoan(a, b, moTa) {
  suaTay(() => {
    boDoan(duAn, a, b); const d = b - a; gop.tay ||= {};
    gop.tay.bo = [...(gop.tay.bo || []), [a, b]];
    gop.tay.cum = (gop.tay.cum || []).filter(c => c.t1 <= a || c.t0 >= b).map(c => c.t0 >= b ? { ...c, t0: c.t0 - d, t1: c.t1 - d } : c);
    bang.chon = null; bang.datVung(null); $('#catVung').disabled = true; $('#catVung').textContent = '✂ Cắt bỏ đoạn';
  }, moTa);
}
$('#catVung').onclick = () => { const v = bang.vung; if (v) catDoan(v[0], v[1], `cắt bỏ ${v[0].toFixed(1)}–${v[1].toFixed(1)}s`); };

// ---------- THANH CÔNG CỤ: thêm ở chỗ vạch đỏ ----------
const tNay = () => Math.max(0, Math.min(xem.currentTime || 0, (duAn?.tong || 1) - 0.5));
const THEM = {
  hook: () => { duAn.hook = { nho: '', lon: 'TIÊU ĐỀ VIDEO', dai: 3 }; return { kieu: 'hook' }; },
  chen: () => { const c = { chu: 'CHỮ MỚI', t: tNay(), dai: 2.5 }; duAn.chen.push(c); return { kieu: 'chen', c }; },
  nhan: () => them1({ loai: 'nhan', chu: 'NHÃN MỚI', dai: 2.5 }), so: () => them1({ loai: 'so', chu: '100%', dai: 1.8 }), gia: () => them1({ loai: 'gia', chu: '5 TRIỆU', dai: 2.2 }),
  buoc: () => them1({ loai: 'buoc', so: duAn.hieu.filter(h => h.loai === 'buoc' && h.t < tNay()).length + 1, ten: 'TÊN BƯỚC', dai: 2.5 }),
  chia_doi: () => them1({ loai: 'chia_doi', trai: 'TRƯỚC', phai: 'SAU', dai: 4 }), cta: () => them1({ loai: 'cta', dai: 3 }), xong: () => them1({ loai: 'xong', dai: 1.4 }),
  zoom: () => { const z = { t: tNay() }; duAn.zoomVao.push(z); return { kieu: 'zoom', z }; },
};
function them1(h) { h.t = tNay(); duAn.hieu.push(h); duAn.hieu.sort((a, b) => a.t - b.t); return { kieu: 'hieu', h }; }
document.querySelectorAll('[data-them]').forEach(b => b.onclick = () => {
  if (!duAn) return; let m = null; xem.pause();
  suaTay(() => { m = THEM[b.dataset.them](); bang.chon = m; }, `thêm ${b.textContent.replace('+ ', '').toLowerCase()}`);
  bang.chonKhoi(bang.timLai(m) || m); $('#thuocTinh input[type=text]')?.select();
});
document.addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || !duAn) return;
  if (e.key === ' ') { e.preventDefault(); xem.paused ? xem.play() : xem.pause(); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && bang.chon) { e.preventDefault(); $('#thuocTinh [data-a=xoa]')?.click(); }
  else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); (e.shiftKey ? $('#lamLai') : $('#hoanTac')).click(); }
});

// ---------- GÓP Ý GÕ CHỮ ----------
MAU_CAU.forEach(c => { const s = document.createElement('span'); s.textContent = c; s.onclick = () => { const t = $('#gopY'); t.value = (t.value ? t.value + ' · ' : '') + c; t.focus(); }; $('#mauCau').append(s); });
$('#sua').onclick = async () => {
  const cau = $('#gopY').value.trim(); if (!cau) return;
  const truoc = structuredClone(gop), r = hieuGopY(cau, gop);
  $('#phanHoi').innerHTML = (r.hieu.length ? `<span class="ok">✓ ${r.hieu.join(' · ')}</span>` : '') + (r.khongHieu.length ? `<br><span class="loi">Chưa hiểu: "${r.khongHieu.join('", "')}" — thử viết giống các câu mẫu, hoặc sửa thẳng trên bảng dựng</span>` : '');
  if (!r.hieu.length) return; $('#gopY').value = '';
  const g = r.gop, moTa = r.hieu.join(' · ');
  const lapLai = !duAn || ['nhanh', 'kieu', 'phuDe'].some(k => g[k] !== truoc[k]) || (truoc.tatDaoDien && g.tatDaoDien === false);
  // các ý làm thẳng trên dự án (không phải lập lại kế hoạch)
  const tach = k => { const v = g[k]; delete g[k]; return v; };
  const chen = tach('chen'), them = tach('themHieu'), boH = tach('boHieu'), boL = tach('boLuc'), zv = tach('zoomVao'), che = tach('che'), bo = tach('bo'), coHook = 'hook' in g, hook = tach('hook');
  const suaMoi = (g.sua || []).slice((truoc.sua || []).length);
  if (g.tatDaoDien === false && truoc.tatDaoDien) { delete g.tatDaoDien; if (g.tay) delete g.tay.hieu; }
  gop = g;
  if (duAn) suaTay(() => {
    if (chen) duAn.chen.push(...chen); if (them) duAn.hieu.push(...them); if (zv) duAn.zoomVao.push(...zv); if (che) duAn.che.push(...che); if (coHook) duAn.hook = hook;
    if (boH) { duAn.hieu = duAn.hieu.filter(h => !boH.includes(h.loai)); if (boH.includes('zoom')) duAn.zoomVao = []; }
    for (const n of boL || []) duAn.hieu = duAn.hieu.filter(h => !(n >= h.t - 0.3 && n < h.t + h.dai + 0.3));
    if (g.tatDaoDien) duAn.hieu = [];
    for (const [a, b] of suaMoi) for (const w of duAn.chu) if (w.chu.toLowerCase().replace(/[,.?!]/g, '') === a.toLowerCase()) w.chu = w.chu.replace(new RegExp(a, 'i'), b);
    for (const [a, b] of (bo || []).sort((x, y) => y[0] - x[0])) { boDoan(duAn, a, b); gop.tay ||= {}; gop.tay.bo = [...(gop.tay.bo || []), [a, b]]; }
    duAn.hieu.sort((a, b) => a.t - b.t);
  }, moTa);
  return dung(moTa, lapLai);
};

// che vùng: kéo chuột trên khung video
const cv = $('#veChe'), c2 = cv.getContext('2d'); let keo = null;
$('#nutChe').onclick = () => { const bat = cv.classList.toggle('bat'); xem.pause(); $('#trangThai').textContent = bat ? 'Kéo chuột lên khung video để khoanh vùng cần làm mờ (cả video).' : ''; };
const td = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 1080, (e.clientY - r.top) / r.height * 1920]; };
cv.onpointerdown = e => { keo = td(e); };
cv.onpointermove = e => { if (!keo) return; const p = td(e); c2.clearRect(0, 0, 1080, 1920); c2.strokeStyle = '#ffc83d'; c2.lineWidth = 8; c2.strokeRect(keo[0], keo[1], p[0] - keo[0], p[1] - keo[1]); };
cv.onpointerup = e => {
  if (!keo) return; const p = td(e), x = Math.min(keo[0], p[0]), y = Math.min(keo[1], p[1]), w = Math.abs(p[0] - keo[0]), h = Math.abs(p[1] - keo[1]); keo = null;
  c2.clearRect(0, 0, 1080, 1920); cv.classList.remove('bat'); if (w < 20 || h < 20) return;
  suaTay(() => duAn.che.push({ x, y, w, h, t0: 0, t1: 1e9 }), 'che một vùng');
};

// ---------- tải về ----------
const tai = (blob, ten) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = ten; a.click(); };
const tenGoc = () => (files[0]?.name || 'video').replace(/\.[^.]+$/, '');
$('#taiMp4').onclick = () => tai(ban[dangXem].blob, tenGoc() + '_DUNG.mp4');
$('#taiNhe').onclick = async () => { tienDo('Đang xuất bản nhẹ…'); tai(await xuat(ban[dangXem].kh, { nhe: true, nhac: nhacDung(), bao: tienDo, huy }), tenGoc() + '_DANG.mp4'); };
$('#taiKhongNhac').onclick = async () => { tienDo('Đang xuất bản không nhạc…'); tai(await xuat(ban[dangXem].kh, { khongNhac: true, bao: tienDo, huy }), tenGoc() + '_KHONG_NHAC.mp4'); };
$('#taiBia').onclick = async () => { const b = ban[dangXem]; const hk = b.kh.hook; tai(await anhBia(b.kh, b.gop.biaT ?? 0.5, hk ? { nho: hk.nho, lon: hk.lon } : null), tenGoc() + '_ANH_BIA.jpg'); };

// ---------- caption gợi ý ----------
const TAG = [[/find ?x(\d+)/i, m => '#oppofindx' + m[1]], [/reno ?(\d+)/i, m => '#reno' + m[1]], [/coloros ?(\d+)/i, m => '#coloros' + m[1]], [/a(\d) ?pro/i, m => '#oppoa' + m[1] + 'pro']];
function veCaption(kh) {
  const all = (kh.loi || kh.chu).map(w => w.chu).join(' '), cau = (all.match(/^.*?[.?!](\s|$)/) || [all.split(' ').slice(0, 14).join(' ')])[0].trim();
  const tags = ['#xaykenhtiktok', '#oppo']; for (const [re, f] of TAG) { const m = all.match(re); if (m && !tags.includes(f(m))) tags.push(f(m)); }
  const el = $('#caption'); el.classList.toggle('an', !cau); el.textContent = `Caption gợi ý (bấm để chép):\n${cau} ${tags.join(' ')}`;
  el.onclick = () => navigator.clipboard?.writeText(`${cau} ${tags.join(' ')}`);
}
veThuocTinh(null);
