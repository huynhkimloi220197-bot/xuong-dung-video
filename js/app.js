// Giao diện: 4 bước. Trạng thái chữ lưu trong trình duyệt (localStorage); file clip phải chọn lại khi mở lại trang.
import { CHUAN, CHUYEN_CANH, LOAI_CANH, mauTinhNangMoi } from './config.js';
import { chuanBi, xemKhung, dung, anhBia } from './engine.js';
const $ = s => document.querySelector(s);
const KEY = 'xuongdung_v1';

let dt = taiLai() || mauTinhNangMoi();
let tl = null;              // dòng thời gian đã tính (thời lượng từng cảnh)
let cheDo = null;           // { kieu: 'che'|'vong', clip }
const huy = { co: false };

function taiLai() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } }
function luu() {
  try { localStorage.setItem(KEY, JSON.stringify(dt, (k, v) => (v instanceof File || k.startsWith('_')) ? undefined : v)); } catch { }
  veCaption();
}
const lay = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
const dat = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => (a[k] ??= {}), o)[last] = v; };

// ---------- bước 1 ----------
document.querySelectorAll('[data-k]').forEach(el => {
  el.value = lay(dt, el.dataset.k) ?? '';
  el.addEventListener('input', () => { dat(dt, el.dataset.k, el.value); luu(); hen(); });
});
$('#nhacFile').addEventListener('change', e => { dt.nhac = { bat: !!e.target.files[0], file: e.target.files[0] || null }; });

// ---------- bước 2: các cảnh ----------
Object.entries(LOAI_CANH).forEach(([k, v]) => $('#loaiMoi').add(new Option(v.ten, k)));
$('#themCanh').onclick = () => { dt.canh.push({ loai: $('#loaiMoi').value, chuyen: 'quet_sang', am: 'giong', clips: [], phu_de: '' }); luu(); veDs(); };
$('#mauMoi').onclick = () => { if (confirm('Làm lại từ mẫu "Tính năng mới"? Chữ đã gõ sẽ mất.')) { dt = mauTinhNangMoi(); luu(); location.reload(); } };

const TRUONG = {
  mo: [],
  canh: [['nhan', 'Nhãn trên cùng'], ['nhan_phu', 'Nhãn phụ (tuỳ chọn)'], ['cham', 'Chấm màu', [['troi', 'Xanh trời (bản mới)'], ['xam', 'Xám (bản cũ)']]]],
  chia_doi: [['tieu_de_nho', 'Dòng nhỏ'], ['tieu_de', 'Tiêu đề'], ['trai', 'Nhãn trái'], ['trai_duoi', 'Chú thích trái'], ['phai', 'Nhãn phải'], ['phai_duoi', 'Chú thích phải']],
  buoc: [],
  ket: [['cau_hoi', 'Câu hỏi kết'], ['phan_sau', 'Hẹn phần sau (tuỳ chọn)']],
};
const GOI_Y = {
  mo: 'Clip quay mặt. Thẻ hook (bước 1) hiện ngay giây 0 — khung này cũng là ảnh bìa.',
  canh: 'Thêm 1–3 clip máy; thời lượng theo file giọng, app tự chia đều cho các clip.',
  chia_doi: 'Clip 1 = bên trái (bản cũ), clip 2 = bên phải (bản mới). Chỉnh "Tâm X" để máy nằm giữa khung.',
  buoc: 'Mỗi clip = 1 bước, gõ tên bước. Clip cuối tick "Kết quả" để hiện XONG!. Bấm "Đặt vòng" rồi bấm lên khung xem trước để khoanh chỗ bấm.',
  ket: 'Clip quay mặt. Nửa đầu hiện câu hỏi, nửa sau hiện nút FOLLOW · BÌNH LUẬN.',
};

function veDs() {
  const ds = $('#dsCanh'); ds.innerHTML = '';
  dt.canh.forEach((c, i) => ds.append(veCanh(c, i)));
  const xs = $('#xemCanh'), cu = xs.value; xs.innerHTML = '';
  dt.canh.forEach((c, i) => xs.add(new Option(`Cảnh ${i + 1} · ${LOAI_CANH[c.loai].ten}`, i)));
  if (cu && +cu < dt.canh.length) xs.value = cu;
  veCaption();
}
function veCanh(c, i) {
  const n = $('#tplCanh').content.firstElementChild.cloneNode(true), q = s => n.querySelector(s);
  q('.ten').textContent = `Cảnh ${i + 1}`;
  Object.entries(LOAI_CANH).forEach(([k, v]) => q('.loai').add(new Option(v.ten, k))); q('.loai').value = c.loai;
  Object.entries(CHUYEN_CANH).forEach(([k, v]) => q('.chuyen').add(new Option('Vào: ' + v, k))); q('.chuyen').value = c.chuyen || 'khong';
  q('.loai').onchange = e => { c.loai = e.target.value; luu(); veDs(); };
  q('.chuyen').onchange = e => { c.chuyen = e.target.value; luu(); hen(); };
  q('.len').onclick = () => { if (i) { [dt.canh[i - 1], dt.canh[i]] = [dt.canh[i], dt.canh[i - 1]]; luu(); veDs(); } };
  q('.xuong').onclick = () => { if (i < dt.canh.length - 1) { [dt.canh[i + 1], dt.canh[i]] = [dt.canh[i], dt.canh[i + 1]]; luu(); veDs(); } };
  q('.xoa').onclick = () => { if (confirm(`Xoá cảnh ${i + 1}?`)) { dt.canh.splice(i, 1); luu(); veDs(); } };
  const s = tl?.ds[i]; if (s) q('.gian').textContent = `${s.dai.toFixed(1)} giây`;
  // trường riêng của loại cảnh
  const tr = q('.truong'); const p = document.createElement('p'); p.className = 'nho'; p.textContent = GOI_Y[c.loai]; tr.before(p);
  for (const [k, ten, chon] of TRUONG[c.loai] || []) {
    const lb = document.createElement('label'); lb.textContent = ten; let el;
    if (chon) { el = document.createElement('select'); chon.forEach(([v, t]) => el.add(new Option(t, v))); el.value = c[k] || chon[0][0]; }
    else { el = document.createElement('input'); el.value = c[k] || ''; }
    el.oninput = el.onchange = () => { c[k] = el.value; luu(); hen(); }; lb.append(el); tr.append(lb);
  }
  // tiếng
  q('.am').value = c.am || 'khong'; const oG = q('.giong-o');
  const capNhatAm = () => { oG.style.display = c.am === 'giong' ? '' : 'none'; q('.giong-ten').textContent = c.am === 'giong' ? (c.giong?.name || (c.giongTen ? `(chọn lại: ${c.giongTen})` : 'chưa có file')) : ''; };
  q('.am').onchange = e => { c.am = e.target.value; capNhatAm(); luu(); tl = null; };
  q('.giong').onchange = e => { c.giong = e.target.files[0]; c.giongTen = c.giong?.name; tl = null; luu(); capNhatAm(); };
  capNhatAm();
  // clip
  const box = q('.clips');
  c.clips.forEach((k, j) => box.append(veClip(c, k, j)));
  q('.themClip').onchange = e => { for (const f of e.target.files) c.clips.push({ file: f, ten: f.name, a: 0, zoom: 1, tam_x: 0.5, tam_y: 0.5, che: [] }); tl = null; luu(); veDs(); };
  q('.phude').value = c.phu_de || ''; q('.phude').oninput = e => { c.phu_de = e.target.value; luu(); };
  return n;
}
function so(k, ten, khoa, buoc = 0.1, w = 72) {
  const lb = document.createElement('label'); lb.textContent = ten; const el = document.createElement('input');
  el.type = 'number'; el.step = buoc; el.style.width = w + 'px'; el.value = k[khoa] ?? ''; el.oninput = () => { k[khoa] = el.value === '' ? null : +el.value; tl = null; luu(); hen(); };
  lb.append(el); return lb;
}
function veClip(c, k, j) {
  const d = document.createElement('div'); d.className = 'clip';
  const t = document.createElement('div'); t.className = 'ten-file'; t.textContent = `Clip ${j + 1}: ${k.file?.name || '(chọn lại file: ' + (k.ten || '?') + ')'}${c.loai === 'chia_doi' ? (j === 0 ? ' · TRÁI' : j === 1 ? ' · PHẢI' : ' · (thừa)') : ''}`;
  d.append(t);
  if (!k.file) { const lb = document.createElement('label'); lb.textContent = 'Chọn lại'; const f = document.createElement('input'); f.type = 'file'; f.accept = 'video/*'; f.onchange = e => { k.file = e.target.files[0]; k.ten = k.file?.name; tl = null; veDs(); }; lb.append(f); d.append(lb); }
  d.append(so(k, 'Từ giây', 'a'), so(k, 'Đến giây', 'b'), so(k, 'Dài (giây, trống = tự chia)', 'giay', 0.1, 90), so(k, 'Zoom', 'zoom', 0.05), so(k, 'Tâm X', 'tam_x', 0.02), so(k, 'Tâm Y', 'tam_y', 0.02));
  if (c.loai === 'buoc') {
    const lb = document.createElement('label'); lb.textContent = 'Tên bước'; const el = document.createElement('input'); el.value = k.nhan || ''; el.oninput = () => { k.nhan = el.value; luu(); hen(); }; lb.append(el); d.append(lb);
    const kq = document.createElement('label'); kq.className = 'radio'; const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!k.ket; cb.onchange = () => { k.ket = cb.checked; luu(); hen(); }; kq.append(cb, ' Kết quả (XONG!)'); d.append(kq);
    const bv = document.createElement('button'); bv.textContent = k.vong ? 'Đặt lại vòng' : 'Đặt vòng'; bv.onclick = () => batCheDo('vong', k, c); d.append(bv);
  }
  const bc = document.createElement('button'); bc.textContent = `Che vùng (${k.che?.length || 0})`; bc.onclick = () => batCheDo('che', k, c); d.append(bc);
  if (k.che?.length) { const bx = document.createElement('button'); bx.textContent = 'Bỏ che'; bx.onclick = () => { k.che = []; luu(); veDs(); hen(); }; d.append(bx); }
  const bxoa = document.createElement('button'); bxoa.textContent = '✕'; bxoa.title = 'Xoá clip'; bxoa.onclick = () => { c.clips.splice(j, 1); tl = null; luu(); veDs(); }; d.append(bxoa);
  return d;
}

// ---------- bước 3: xem trước ----------
const cv = $('#xem'), ctx = cv.getContext('2d');
let _hen = 0;
function hen() { clearTimeout(_hen); _hen = setTimeout(veXem, 120); }
async function damBaoTl() {
  if (!tl) { $('#tongQuan').textContent = 'Đang tính thời lượng…'; tl = await chuanBi(dt, m => $('#tongQuan').textContent = m); veDs(); veTong(); }
  return tl;
}
function veTong() {
  if (!tl) return; const [a, b] = CHUAN.do_dai_khuyen;
  $('#tongQuan').innerHTML = `Tổng: <b>${tl.tong.toFixed(1)} giây</b> ` + (tl.tong > b ? `<span class="canh-bao">— dài hơn ${a}–${b}s kênh khuyên, cân nhắc bỏ bớt câu</span>` : '✓')
    + (thieu().length ? `<br><span class="canh-bao">${thieu().join('<br>')}</span>` : '');
}
function thieu() {
  const m = []; if (!dt.hook_lon) m.push('• Thiếu câu hook (bước 1)');
  dt.canh.forEach((c, i) => { if (!c.clips.some(k => k.file)) m.push(`• Cảnh ${i + 1} chưa có clip`); if (c.am === 'giong' && !c.giong) m.push(`• Cảnh ${i + 1} chưa có file giọng`); if (c.loai === 'chia_doi' && c.clips.filter(k => k.file).length < 2) m.push(`• Cảnh ${i + 1} cần đủ 2 clip`); });
  return m;
}
async function veXem() {
  const si = +$('#xemCanh').value || 0; const c = dt.canh[si]; if (!c) return;
  try {
    await document.fonts.load("40px 'Anton'"); await document.fonts.load("800 40px 'BVX'");
    if (!c.clips.some(k => k.file)) { ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 1080, 1920); ctx.fillStyle = '#9aa3b2'; ctx.font = "800 48px 'BVX'"; ctx.textAlign = 'center'; ctx.fillText('Chưa có clip', 540, 960); return; }
    await damBaoTl(); const s = tl.ds[si]; $('#xemU').max = s.dai.toFixed(2);
    await xemKhung(ctx, dt, tl, si, Math.min(+$('#xemU').value, s.dai - 0.01));
  } catch (e) { $('#tongQuan').innerHTML = `<span class="loi">${e.message}</span>`; console.error(e); }
}
$('#xemCanh').onchange = () => { $('#xemU').value = 0.5; hen(); };
$('#xemU').oninput = hen;
$('#tinh').onclick = () => { tl = null; hen(); };

// vẽ vùng che / đặt vòng khoanh lên khung xem trước
function batCheDo(kieu, clip, canh) {
  cheDo = { kieu, clip }; const i = dt.canh.indexOf(canh); $('#xemCanh').value = i; hen();
  $('#cheDo').innerHTML = kieu === 'che' ? '<b>Che vùng:</b> kéo chuột trên khung xem trước để khoanh vùng cần làm mờ.' : '<b>Đặt vòng:</b> bấm lên khung xem trước đúng chỗ ngón tay bấm.';
  document.getElementById('b3').scrollIntoView({ behavior: 'smooth' });
}
const toaDo = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 1080, (e.clientY - r.top) / r.height * 1920]; };
let keo = null;
cv.addEventListener('pointerdown', e => { if (!cheDo) return; const p = toaDo(e); if (cheDo.kieu === 'vong') { cheDo.clip.vong = p.map(Math.round); xongCheDo(); } else keo = p; });
cv.addEventListener('pointerup', e => {
  if (!keo || !cheDo) return; const p = toaDo(e), x = Math.min(keo[0], p[0]), y = Math.min(keo[1], p[1]), w = Math.abs(p[0] - keo[0]), h = Math.abs(p[1] - keo[1]);
  if (w > 10 && h > 10) (cheDo.clip.che ||= []).push([x, y, w, h].map(Math.round)); keo = null; xongCheDo();
});
function xongCheDo() { cheDo = null; $('#cheDo').textContent = ''; luu(); veDs(); hen(); }

// ---------- bước 4: xuất ----------
function hashtag() { return [...CHUAN.hashtag_goc, dt.may, dt.chu_de].filter(Boolean).join(' '); }
function veCaption() { $('#captionDu').textContent = `Caption đăng (bấm để chép):\n${(dt.caption || '').trim()} ${hashtag()}`.trim(); }
$('#captionDu').onclick = () => { navigator.clipboard?.writeText(`${(dt.caption || '').trim()} ${hashtag()}`.trim()); $('#captionDu').classList.add('canh-bao'); };
const tai = (blob, ten) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = ten; a.textContent = '⬇ ' + ten; return a; };
const tenFile = () => (dt.hook_nho || 'video').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '').toUpperCase();

$('#bia').onclick = async () => {
  try { await document.fonts.load("40px 'Anton'"); const b = await anhBia(dt, +dt.bia_giay || 1.0); $('#ketQua').prepend(tai(b, tenFile() + '_ANH_BIA.jpg')); }
  catch (e) { $('#tienChu').innerHTML = `<span class="loi">${e.message}</span>`; }
};
$('#dung').onclick = async () => {
  const m = thieu(); if (m.length && !confirm('Còn thiếu:\n' + m.join('\n') + '\n\nVẫn dựng?')) return;
  const nhe = document.querySelector('input[name=ban]:checked').value === 'nhe';
  $('#dung').disabled = true; $('#huy').hidden = false; huy.co = false;
  const t0 = performance.now();
  try {
    await document.fonts.load("40px 'Anton'"); await document.fonts.load("800 40px 'BVX'");
    const r = await dung(dt, { nhe, huy, baoTien: (msg, k) => { $('#tienChu').textContent = msg; if (k != null) $('#thanh').style.width = (k * 100).toFixed(1) + '%'; } });
    tl = r.tl; veTong();
    const ten = tenFile() + (nhe ? '_DANG.mp4' : '.mp4'), v = document.createElement('video'); v.controls = true; v.src = URL.createObjectURL(r.blob);
    $('#ketQua').prepend(tai(r.blob, ten), v);
    $('#tienChu').textContent = `Xong ${r.tong.toFixed(1)} giây video · ${(r.blob.size / 1048576).toFixed(1)}MB · dựng mất ${((performance.now() - t0) / 1000).toFixed(0)} giây`;
  } catch (e) { $('#tienChu').innerHTML = `<span class="loi">${e.message}</span>`; console.error(e); }
  finally { $('#dung').disabled = false; $('#huy').hidden = true; }
};
$('#huy').onclick = () => { huy.co = true; };

// ?thu = nạp bộ clip thử trong thư mục thu/ (chỉ để kiểm tra app, không đưa lên mạng)
async function napThu() {
  const f = async (ten, kieu) => new File([await (await fetch('thu/' + ten)).blob()], ten, { type: kieu });
  const v = t => f(t, 'video/mp4'), g = t => f(t, 'audio/mpeg');
  dt = mauTinhNangMoi(); const C = dt.canh, k = (file, o = {}) => ({ file, ten: file.name, a: 0, zoom: 1, tam_x: 0.5, tam_y: 0.5, che: [], ...o });
  C[0].clips = [k(await v('mat_dau.mp4'))]; C[0].phu_de = '*OPPO Find X9* và *ColorOS 17* có tính năng gì mới?';
  C[1].clips = [k(await v('reno_gt.mp4')), k(await v('reno_khoa.mp4'))]; C[1].giong = await g('t1.mp3'); C[1].cham = 'xam';
  C[1].phu_de = 'Đây là sản phẩm *Reno16* của mình, hiện tại thì đang sử dụng phiên bản *ColorOS 16*, hình nền cũng là núi này nhưng mà chưa có hiệu ứng thời tiết theo thời gian thực.';
  C[2].clips = [k(await v('x9_khoa.mp4'))]; C[2].giong = await g('t2.mp3'); C[2].phu_de = 'Còn đây là *OPPO Find X9* đã lên *ColorOS 17*.';
  C[3].clips = [k(await v('reno_khoa.mp4'), { tam_x: 0.43 }), k(await v('x9_khoa.mp4'), { tam_x: 0.52 })]; C[3].giong = await g('t3.mp3');
  C[3].phu_de = 'Đứng cùng một chỗ, cách nhau còn 5 phút, một bên *ColorOS 16* chưa có hiệu ứng này, còn một bên là *ColorOS 17* đã có hiệu ứng nắng mưa theo thời gian thực.';
  C[4].clips = [k(await v('buoc1.mp4'), { nhan: 'CÀI ĐẶT' }), k(await v('buoc2.mp4'), { nhan: 'NÚT AI > THỜI TIẾT', vong: [715, 700] }), k(await v('x9_khoa.mp4'), { ket: true })]; C[4].giong = await g('t5.mp3');
  C[5].clips = [k(await v('mat_cuoi.mp4'))]; C[5].phan_sau = 'PHẦN 2: SẮP CÓ';
  dt.caption = 'Ngủ dậy chưa mở rèm, nhìn màn hình là biết trời nắng hay mưa luôn :))';
}
if (location.search.includes('thu')) { await napThu(); document.querySelectorAll('[data-k]').forEach(el => el.value = lay(dt, el.dataset.k) ?? ''); }
veDs(); hen();
