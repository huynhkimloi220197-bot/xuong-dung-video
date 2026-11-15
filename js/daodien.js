// BỘ ĐẠO DIỄN (không cần AI): đọc lời nói đã nghe ra chữ + danh sách cảnh → quyết định hiệu ứng theo nội dung.
// Đúc kết từ cách anh Lợi & em dựng: hook giây 0, nhãn máy, chia đôi khi so sánh, nhãn từng bước, số phát sáng, thẻ giá, nút follow cuối.
// Thuần JS (chạy được cả trong Node để kiểm thử).

// ---- từ điển máy / hệ điều hành / đơn vị ----
const MAY = [
  [/\bfind\s*x\s*(\d+)\s*(pro|ultra|max)?/i, m => `FIND X${m[1]}${m[2] ? ' ' + m[2].toUpperCase() : ''}`],
  [/\breno\s*(\d+)\s*(f|pro|plus|\+)?\s*(5g)?/i, m => `RENO${m[1]}${m[2] ? ' ' + m[2].toUpperCase() : ''}${m[3] ? ' 5G' : ''}`],
  [/\ba\s*(\d)\s*(pro|x)?\b/i, m => `OPPO A${m[1]}${m[2] ? ' ' + m[2].toUpperCase() : ''}`],
  [/\bcoloros\s*(\d+)/i, m => `COLOROS ${m[1]}`],
  [/\b(enco|pad|watch)\s*([\w]+)?/i, m => `OPPO ${m[1].toUpperCase()}${m[2] ? ' ' + m[2].toUpperCase() : ''}`],
  [/\b(iphone|galaxy|xiaomi|vivo|redmi|samsung)\s*([\w]+)?/i, m => `${m[1].toUpperCase()}${m[2] ? ' ' + m[2].toUpperCase() : ''}`],
];
const DON_VI = /^(\d+[.,]?\d*)\s*(mah|w|hz|mp|gb|tb|%|giờ|phút|giây|năm|tháng|ngày|triệu|nghìn|ngàn|k|lần|inch|độ|°)$/i;
const SO = /^\d+[.,]?\d*$/;

const sach = s => s.replace(/[,.?!:;"“”']/g, '');
export function timMay(cau) {   // theo thứ tự xuất hiện trong câu, không trùng
  const out = [];
  for (const [re, f] of MAY) for (const m of cau.matchAll(new RegExp(re.source, 'gi'))) out.push([m.index, f(m)]);
  return out.sort((a, b) => a[0] - b[0]).map(x => x[1]).filter((t, i, a) => a.indexOf(t) === i);
}

// tách câu theo dấu câu hoặc khoảng nghỉ > 0.6s
export function tachCau(chu) {
  const cau = []; let cur = [];
  const MOC = /^(đầu tiên|tiếp theo|và tiếp theo|sau đó|cuối cùng|bấm vào|rồi chọn|bạn thấy|các bạn thấy|hãy follow|nhớ follow)/i;
  chu.forEach((w, i) => {
    // câu dài không dấu chấm: tách trước các từ mốc (bước, kêu gọi)
    if (cur.length >= 3 && MOC.test(chu.slice(i, i + 3).map(x => x.chu).join(' '))) { cau.push(cur); cur = []; }
    cur.push(w); const nghi = chu[i + 1] ? chu[i + 1].us - w.ue : 9;
    if (/[.?!]$/.test(w.chu) || nghi > 0.6) { cau.push(cur); cur = []; }
  });
  if (cur.length) cau.push(cur);
  return cau.map(ws => ({ ws, chu: ws.map(w => w.chu).join(' '), t0: ws[0].us, t1: ws.at(-1).ue }));
}

// ---- 7 công thức hook (học từ sheet 159 hook) — chọn theo câu nói đầu ----
export function hook(cau0, may) {
  const c = cau0.chu, nho = may.slice(0, 2).join(' × ');
  const hoi = c.match(/([^,.!?]*)\?/);
  if (hoi) { const ws = sach(hoi[1]).trim().split(/\s+/); return { nho, lon: ws.slice(-4).join(' ').toUpperCase() + '?' }; }          // 1. câu hỏi → đuôi câu hỏi
  let m = c.match(/sau\s+(\d+|một|hai|ba)\s+(năm|tháng|tuần|ngày)/i); if (m) return { nho, lon: `SAU ${m[1].toUpperCase()} ${m[2].toUpperCase()}…` }; // 2. thời gian dùng thật
  m = c.match(/(đừng|sai lầm|cẩn thận|coi chừng)\s+([^,.!?]{0,24})/i); if (m) return { nho, lon: `${m[1]} ${m[2]}`.trim().toUpperCase() + '!' }; // 3. cảnh báo
  m = c.match(/(\d+[.,]?\d*)\s*(mah|w|hz|mp|gb|triệu|giờ|%)/i); if (m) return { nho, lon: `${m[1]}${m[2].toUpperCase()}` };                // 4. con số gây sốc
  if (/(có gì mới|tính năng (gì )?mới|có gì hay|điểm gì mới)/i.test(c)) return may.length >= 2 ? { nho: `${may[0]} × ${may[1]}`, lon: 'CÓ GÌ MỚI?' } : { nho: '', lon: `${may[0] || 'BẢN MỚI'} CÓ GÌ MỚI?` };  // 4b. tính năng mới
  if (/(so sánh|vs|hay là|hơn)/i.test(c) && may.length >= 2) return { nho: '', lon: `${may[0]} VS ${may[1]}` };                         // 5. đối đầu
  if (/(mẹo|bí kíp|cách để|thủ thuật)/i.test(c)) return { nho, lon: 'MẸO HAY ÍT AI BIẾT' };                                               // 6. mẹo
  return may.length ? { nho: '', lon: `${may[0]} CÓ GÌ HAY?` } : null;                                                                      // 7. mặc định theo máy
}

const BUOC = /^(và )?(để [^,]{0,30} )?(đầu tiên|tiếp theo|sau đó|cuối cùng|bước (\d+|một|hai|ba)|bấm vào|rồi chọn)/i;
const DONG_TU = /\b(vào|chọn|bấm|nhấn|mở|kéo|bật|tắt|gạt)\s+(phần\s+|mục\s+|vào\s+)?/i;

// kh: kế hoạch từ lapKeHoach (doan, chu, tong). Trả danh sách hiệu ứng [{loai, t, dai, ...}]
export function daoDien(kh) {
  const hieu = [], cau = tachCau(kh.chu || []); if (!cau.length) return hieu;
  const mayAll = timMay(cau.map(c => c.chu).join(' '));
  // 1) thẻ hook ở giây 0 (= ảnh bìa)
  const h = hook(cau[0], timMay(cau[0].chu).length ? timMay(cau[0].chu) : mayAll);
  if (h) hieu.push({ loai: 'hook', t: 0, dai: Math.max(2.5, Math.min(4, cau[0].t1 + 0.3)), nho: h.nho, lon: h.lon });
  let soBuoc = 0, nhanTruoc = '', mayTruoc = ''; const dsNhan = [];
  cau.forEach((c, i) => {
    if (i === 0 && h) return;
    const may = timMay(c.chu);
    // 2) bước hướng dẫn
    const lc = c.chu.trim();
    if (BUOC.test(lc) || (soBuoc > 0 && DONG_TU.test(lc))) {
      soBuoc++; const m = lc.match(DONG_TU); let ten = '';
      if (m) { const ws = sach(lc.slice(lc.search(DONG_TU) + m[0].length)).split(/\s+/), k = ws.findIndex((w, j) => j && /^(và|rồi|là|để|thì|nha|nhé|của|xong)$/i.test(w)); ten = ws.slice(0, Math.min(4, k > 0 ? k : 4)).join(' ').toUpperCase(); }
      hieu.push({ loai: 'buoc', t: c.t0, dai: Math.min(4, c.t1 - c.t0 + 0.2), so: soBuoc, ten });
      if (/là xong|xong rồi/i.test(lc)) hieu.push({ loai: 'xong', t: c.t1 - 0.3, dai: 1.4 });
      return;
    }
    if (/là xong|xong rồi|vậy là xong/i.test(lc) && soBuoc) hieu.push({ loai: 'xong', t: c.t1 - 0.3, dai: 1.4 });
    // 3) so sánh 2 bên → chia đôi
    const chiaTruoc = hieu.findLast(h => h.loai === 'chia_doi');
    if (/(một bên|bên này|so với|còn bên|bản cũ|bản mới)/i.test(lc) && (kh.doan || []).length > 1 && !(chiaTruoc && c.t0 - (chiaTruoc.t + chiaTruoc.dai) < 8)) hieu.push({ loai: 'chia_doi', t: c.t0, dai: Math.min(6, Math.max(3, c.t1 - c.t0)), ...(may.length > 1 ? { trai: may[0], phai: may[1] } : may.length ? { trai: mayTruoc && mayTruoc !== may[0] ? mayTruoc : 'TRƯỚC', phai: may[0] } : { trai: dsNhan.at(-2) || 'TRƯỚC', phai: dsNhan.at(-1) || 'SAU' }) });
    // 4) nhãn máy khi nhắc tới máy mới
    else if (may.length) { const nhan = may.slice(0, 2).join(' · '); if (nhan !== nhanTruoc) { hieu.push({ loai: 'nhan', t: c.t0, dai: Math.min(3.5, Math.max(2.5, c.t1 - c.t0)), chu: nhan }); nhanTruoc = nhan; dsNhan.push(nhan); } }
    // 5) con số + đơn vị → số phát sáng; "giá" → thẻ giá
    c.ws.forEach((w, j) => {
      const s = sach(w.chu), s2 = c.ws[j + 1] ? sach(c.ws[j + 1].chu) : '';
      const ghep = SO.test(s) && DON_VI.test(`${s} ${s2}`) ? `${s} ${s2}` : DON_VI.test(s) ? s : null;
      if (!ghep) return;
      const gia = /giá/i.test(c.ws.slice(Math.max(0, j - 3), j).map(x => x.chu).join(' ')) || /triệu|nghìn|ngàn|k$/i.test(ghep);
      hieu.push({ loai: gia ? 'gia' : 'so', t: w.us, dai: 1.8, chu: ghep.replace(/\s+/g, /^[\d.,]+\s*(mah|w|hz|mp|gb|tb|%|k|°)$/i.test(ghep) ? '' : ' ').toUpperCase() });
    });
    // 6) "đây là / nhìn nè / thấy không" → zoom nhấn
    if (/^(đây là|nhìn nè|nhìn này|thấy không|các bạn thấy)/i.test(lc)) hieu.push({ loai: 'zoom', t: c.t0, dai: 1.4 });
  });
  // 7) câu kêu gọi cuối → nút FOLLOW · BÌNH LUẬN
  const cuoi = cau.findLast(c => /(follow|theo dõi|bình luận|comment|chia sẻ|đăng ký)/i.test(c.chu));
  if (cuoi && cuoi.t0 > 0.6 * (kh.tong || cuoi.t1)) hieu.push({ loai: 'cta', t: cuoi.t0, dai: Math.min(4, Math.max(2.5, (kh.tong || cuoi.t1) - cuoi.t0)) });
  return hieu;
}
