// Xưởng Dựng Video v0.2 — thả video thô, máy tự edit; sửa bằng góp ý gõ chữ; lịch sử bản.
import { phanTich, lapKeHoach, xuat, anhBia } from './tudong.js';
import { hieuGopY, MAU_CAU } from './gopy.js';
import { docAm, db, timNhip } from './audio.js';
import { datMoHinh } from './nghe.js';
const PHIEN_BAN = '0.3.2';
const $ = s => document.querySelector(s);
$('#ban').textContent = 'Phiên bản ' + PHIEN_BAN;

let nhip = null, files = [], kq = new Map(), gop = {}, ban = [], dangXem = -1, nhac = null, huy = { co: false }, banDang = null;
window.__xd = { get ban() { return ban; } };   // để soát lỗi
const tienDo = (m, k) => { $('#tienChu').textContent = m; if (k != null) $('#thanh').style.width = (k * 100).toFixed(1) + '%'; };
const tuNhien = (a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true });

$('#nutCaiDat').onclick = () => $('#caiDat').classList.toggle('an');
// nhớ cài đặt trên máy
for (const id of ['cdPhuDe', 'cdChinhXac', 'cdCao']) { const el = $('#' + id); try { const v = localStorage.getItem('xd_' + id); if (v != null) el.checked = v === '1'; } catch { } el.onchange = () => { try { localStorage.setItem('xd_' + id, el.checked ? '1' : '0'); } catch { } datMoHinh($('#cdChinhXac').checked); }; }
datMoHinh($('#cdChinhXac').checked);
// có bản mới? (kiểm mỗi 10 phút)
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
    tienDo(`Đã đọc ${files.length} file — bấm "Tự động dựng"`);
    if (files.length && !ban.length) dung('Bản đầu tiên (máy tự edit)');
  } finally { _dangDoc = false; }
}

// ---------- dựng ----------
$('#dung').onclick = () => dung(ban.length ? 'Dựng lại' : 'Bản đầu tiên (máy tự edit)');
async function dung(ghiChu) {
  if (banDang) return; banDang = true; $('#dung').disabled = true; $('#sua').disabled = true;
  try {
    const ds = files.map(f => kq.get(f)).filter(Boolean); if (!ds.length) return;
    await document.fonts.load("40px 'Anton'"); await document.fonts.load("800 40px 'BVX'");
    const kh = lapKeHoach(ds, { gop, nhip: nhac && gop.nhac !== 0 ? nhip : null }); kh.mau = gop.mau || 1;
    const t0 = performance.now();
    const blob = await xuat(kh, { nhac: nhacDung(), cao: $('#cdCao').checked, bao: tienDo, huy });
    ban.push({ so: ban.length + 1, ghiChu, gop: structuredClone(gop), kh, blob, url: URL.createObjectURL(blob), luc: new Date() });
    xemBan(ban.length - 1);
    tienDo(`Xong ${kh.tong.toFixed(1)} giây video · dựng mất ${((performance.now() - t0) / 1000).toFixed(0)} giây`, 1);
    if (kh.khongLoi && !kh.hook) $('#phanHoi').innerHTML = '<span class="ok">Clip không có lời nói nên máy chưa biết ghi chữ gì. Gõ thử: hook là "MÀN HÌNH ĐẸP CỠ NÀO?" / "OPPO FIND X9" · nhãn "THIẾT KẾ" ở giây 6</span>';
    $('#khuGopY').classList.remove('an'); $('#khuLichSu').classList.remove('an'); $('#taiVe').classList.remove('an');
  } catch (e) { tienDo('Lỗi: ' + e.message); console.error(e); }
  finally { banDang = false; $('#dung').disabled = false; $('#sua').disabled = false; }
}
function nhacDung() { if (!nhac || gop.nhac === 0) return null; const k = db((gop.nhacDb ?? -20) + 20); return k === 1 ? nhac : nhac.map(v => v * k); }

function xemBan(i) {
  dangXem = i; const b = ban[i]; $('#xem').src = b.url; $('#trong').classList.add('an');
  const ol = $('#lichSu'); ol.innerHTML = '';
  ban.slice().reverse().forEach(x => {
    const li = document.createElement('li'); if (x === b) li.className = 'dang';
    li.textContent = `Bản ${x.so} · ${x.luc.toLocaleTimeString('vi')} · ${x.ghiChu} · ${x.kh.tong.toFixed(1)}s`;
    if (x !== b) { const bt = document.createElement('button'); bt.textContent = 'Quay lại bản này'; bt.onclick = () => { gop = structuredClone(x.gop); xemBan(ban.indexOf(x)); }; li.append(bt); }
    ol.append(li);
  });
  veCaption(b.kh);
}

// ---------- góp ý ----------
MAU_CAU.forEach(c => { const s = document.createElement('span'); s.textContent = c; s.onclick = () => { const t = $('#gopY'); t.value = (t.value ? t.value + ' · ' : '') + c; t.focus(); }; $('#mauCau').append(s); });
$('#sua').onclick = async () => {
  const cau = $('#gopY').value.trim(); if (!cau) return;
  const r = hieuGopY(cau, gop);
  $('#phanHoi').innerHTML = (r.hieu.length ? `<span class="ok">✓ ${r.hieu.join(' · ')}</span>` : '') + (r.khongHieu.length ? `<br><span class="loi">Chưa hiểu: "${r.khongHieu.join('", "')}" — thử viết giống các câu mẫu</span>` : '');
  if (!r.hieu.length) return;
  gop = r.gop; $('#gopY').value = ''; await dung(r.hieu.join(' · '));
};

// che vùng: kéo chuột trên khung video
const cv = $('#veChe'), c2 = cv.getContext('2d'); let keo = null;
$('#nutChe').onclick = () => { const bat = cv.classList.toggle('bat'); $('#xem').pause(); $('#phanHoi').textContent = bat ? 'Kéo chuột lên khung video để khoanh vùng cần làm mờ (cả video).' : ''; };
const td = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 1080, (e.clientY - r.top) / r.height * 1920]; };
cv.onpointerdown = e => { keo = td(e); };
cv.onpointermove = e => { if (!keo) return; const p = td(e); c2.clearRect(0, 0, 1080, 1920); c2.strokeStyle = '#ffc83d'; c2.lineWidth = 8; c2.strokeRect(keo[0], keo[1], p[0] - keo[0], p[1] - keo[1]); };
cv.onpointerup = async e => {
  if (!keo) return; const p = td(e), x = Math.min(keo[0], p[0]), y = Math.min(keo[1], p[1]), w = Math.abs(p[0] - keo[0]), h = Math.abs(p[1] - keo[1]); keo = null;
  c2.clearRect(0, 0, 1080, 1920); cv.classList.remove('bat'); if (w < 20 || h < 20) return;
  (gop.che ||= []).push({ x, y, w, h, t0: 0, t1: 1e9 }); await dung('Che một vùng');
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
