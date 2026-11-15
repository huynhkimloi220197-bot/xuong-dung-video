// Hiểu góp ý tiếng Việt (không cần AI): mỗi câu → 1 thay đổi. Trả { gop mới, hieu: [mô tả], khongHieu: [câu] }.
// Nhiều ý trong 1 lần: ngăn bằng dấu chấm, xuống dòng hoặc " · ".
const so = s => parseFloat(String(s).replace(',', '.'));
const giay = s => { const m = String(s).match(/(\d+)[:h'](\d+)/); return m ? +m[1] * 60 + +m[2] : so(s); };
const MAU = { vàng: [255, 200, 61], đỏ: [254, 44, 85], xanh: [110, 190, 255], 'xanh lá': [60, 220, 120], trắng: [255, 255, 255], hồng: [255, 90, 220], cam: [255, 140, 40] };

const LUAT = [
  // hiệu ứng tự động (bộ đạo diễn)
  [/(bỏ|tắt|xoá|xóa) hiệu ứng (ở |lúc |tại )?(giây )?([\d:.,h']+)/i, (g, m) => { (g.boLuc ||= []).push(giay(m[4])); return `Bỏ hiệu ứng ở giây ${giay(m[4])}`; }],
  [/(bật|thêm|mở) (lại )?hiệu ứng( tự động)?/i, (g) => { g.tatDaoDien = false; return 'Bật lại hiệu ứng tự động'; }],
  [/(tắt|bỏ|không cần) (hết |toàn bộ |mọi )?hiệu ứng/i, (g) => { g.tatDaoDien = true; return 'Tắt hiệu ứng tự động (chỉ giữ cắt, phụ đề, chuyển cảnh)'; }],
  [/chia đôi( màn hình)?( ["“'](.+?)["”'] ?(và|với|vs) ?["“'](.+?)["”'])? ?(từ )?(giây )?([\d:.,h']+) ?(s|giây)? ?(đến|tới|-|→) ?(giây )?([\d:.,h']+)/i, (g, m) => { const a = giay(m[8]), b = giay(m[12]); (g.themHieu ||= []).push({ loai: 'chia_doi', t: a, dai: Math.max(1, b - a), trai: (m[3] || 'TRƯỚC').toUpperCase(), phai: (m[5] || 'SAU').toUpperCase() }); return `Chia đôi màn hình ${a}s → ${b}s`; }],
  [/(thẻ giá|giá) ["“'](.+?)["”'] ?(ở|tại|lúc)? ?(giây )?([\d:.,h']+)/i, (g, m) => { (g.themHieu ||= []).push({ loai: 'gia', t: giay(m[5]), dai: 2.2, chu: m[2].toUpperCase() }); return `Thẻ giá "${m[2].toUpperCase()}" ở giây ${giay(m[5])}`; }],
  [/(nhãn|tên máy) ["“'](.+?)["”'] ?(ở|tại|lúc)? ?(giây )?([\d:.,h']+)/i, (g, m) => { (g.themHieu ||= []).push({ loai: 'nhan', t: giay(m[5]), dai: 2.5, chu: m[2].toUpperCase() }); return `Nhãn "${m[2].toUpperCase()}" ở giây ${giay(m[5])}`; }],
  [/(con số|số) ["“'](.+?)["”'] ?(ở|tại|lúc)? ?(giây )?([\d:.,h']+)/i, (g, m) => { (g.themHieu ||= []).push({ loai: 'so', t: giay(m[5]), dai: 1.8, chu: m[2].toUpperCase() }); return `Số phát sáng "${m[2].toUpperCase()}" ở giây ${giay(m[5])}`; }],
  [/bước (\d+) ["“'](.+?)["”'] ?(ở|tại|lúc)? ?(giây )?([\d:.,h']+)/i, (g, m) => { (g.themHieu ||= []).push({ loai: 'buoc', t: giay(m[5]), dai: 2.5, so: +m[1], ten: m[2].toUpperCase() }); return `Nhãn bước ${m[1]} ở giây ${giay(m[5])}`; }],
  [/(nút )?follow (ở|tại|lúc|từ) (giây )?([\d:.,h']+)/i, (g, m) => { (g.themHieu ||= []).push({ loai: 'cta', t: giay(m[4]), dai: 3 }); return `Nút follow ở giây ${giay(m[4])}`; }],
  [/(bỏ|tắt|không cần) (nhãn máy|nhãn|thẻ giá|giá|số phát sáng|số|bước|chia đôi|nút follow|follow|zoom tự động)/i, (g, m) => { const k = { 'nhãn máy': 'nhan', nhãn: 'nhan', 'thẻ giá': 'gia', giá: 'gia', 'số phát sáng': 'so', số: 'so', bước: 'buoc', 'chia đôi': 'chia_doi', 'nút follow': 'cta', follow: 'cta', 'zoom tự động': 'zoom' }[m[2].toLowerCase()]; (g.boHieu ||= []).push(k); return `Bỏ ${m[2].toLowerCase()} tự động`; }],
  [/(nhanh|gọn|dồn) ?(hơn|lên|lại)?/i, (g) => { g.nhanh = Math.min(2.5, (g.nhanh || 1) * 1.35); return 'Rút ngắn khoảng lặng, cắt nhịp nhanh hơn'; }],
  [/(chậm|thong thả|từ từ) ?(hơn|lại)?/i, (g) => { g.nhanh = Math.max(0.5, (g.nhanh || 1) / 1.35); return 'Giữ nhịp chậm hơn, để thở hơn'; }],
  [/(bỏ|cắt|xoá|xóa) (đoạn |khúc )?(từ )?(giây )?([\d:.,h']+) ?(s|giây)? ?(đến|tới|-|→) ?(giây )?([\d:.,h']+)/i, (g, m) => { (g.bo ||= []).push([giay(m[5]), giay(m[9])]); return `Bỏ đoạn ${giay(m[5])}s → ${giay(m[9])}s`; }],
  [/(thêm|chèn|ghi) chữ ["“'](.+?)["”'] ?(màu (\S+( lá)?))? ?(ở|tại|lúc)? ?(giây )?([\d:.,h']+)?/i, (g, m) => { const t = m[8] ? giay(m[8]) : 0; (g.chen ||= []).push({ chu: m[2].toUpperCase(), t, dai: 2.5, mau: MAU[(m[4] || '').toLowerCase()] }); return `Chèn chữ "${m[2].toUpperCase()}" ở giây ${t}`; }],
  [/(hook|chữ mở đầu|tiêu đề|tựa)( là|:)? ["“'](.+?)["”']( ?\/ ?["“'](.+?)["”'])?/i, (g, m) => { g.hook = { lon: m[3].toUpperCase(), nho: (m[5] || '').toUpperCase(), dai: 3 }; return `Thẻ mở đầu: "${m[3].toUpperCase()}"`; }],
  [/(bỏ|tắt|không cần) (hook|chữ mở đầu|tiêu đề)/i, (g) => { g.hook = null; return 'Bỏ thẻ chữ mở đầu'; }],
  [/(sửa|đổi) (chữ )?["“'](.+?)["”'] (thành|ra|sang) ["“'](.+?)["”']/i, (g, m) => { (g.sua ||= []).push([m[3], m[5]]); return `Sửa phụ đề "${m[3]}" → "${m[5]}"`; }],
  [/(bỏ|tắt|không cần|không) phụ đề/i, (g) => { g.phuDe = false; return 'Tắt phụ đề'; }],
  [/(bật|thêm|cần) phụ đề/i, (g) => { g.phuDe = true; return 'Bật phụ đề'; }],
  [/chữ (to|lớn) (hơn|lên)/i, (g) => { g.coChu = Math.min(1.5, (g.coChu || 1) * 1.15); return 'Chữ to hơn'; }],
  [/chữ (nhỏ|bé) (hơn|lại|đi)/i, (g) => { g.coChu = Math.max(0.7, (g.coChu || 1) / 1.15); return 'Chữ nhỏ hơn'; }],
  [/(sáng|tươi) (hơn|lên)/i, (g) => { g.mau = Math.min(1.4, (g.mau || 1) * 1.1); return 'Hình sáng hơn'; }],
  [/(tối|trầm) (hơn|lại|đi)/i, (g) => { g.mau = Math.max(0.7, (g.mau || 1) / 1.1); return 'Hình tối hơn'; }],
  [/(zoom|phóng) (vào|to) (ở |lúc |tại )?(giây )?([\d:.,h']+)/i, (g, m) => { (g.zoomVao ||= []).push({ t: giay(m[5]) }); return `Zoom vào ở giây ${giay(m[5])}`; }],
  [/(bỏ|tắt|không) nhạc/i, (g) => { g.nhac = 0; return 'Bỏ nhạc nền'; }],
  [/nhạc (nhỏ|bé) (lại|hơn|đi)/i, (g) => { g.nhacDb = (g.nhacDb ?? -20) - 4; return 'Nhạc nhỏ hơn'; }],
  [/nhạc (to|lớn) (lên|hơn)/i, (g) => { g.nhacDb = (g.nhacDb ?? -20) + 4; return 'Nhạc to hơn'; }],
  [/(đổi|kiểu khác|dựng lại|chuyển cảnh khác)/i, (g) => { g.kieu = (g.kieu || 0) + 1; return 'Đổi kiểu chuyển cảnh'; }],
  [/ảnh bìa (ở|lúc|tại) (giây )?([\d:.,h']+)/i, (g, m) => { g.biaT = giay(m[3]); return `Ảnh bìa lấy ở giây ${giay(m[3])}`; }],
];

export const MAU_CAU = ['nhanh hơn', 'bỏ đoạn từ giây 10 đến 15', 'thêm chữ "GIÁ CHỈ 5 TRIỆU" ở giây 3', 'hook là "CÓ GÌ MỚI?"', 'sửa "Renault" thành "Reno"',
  'chữ to hơn', 'không cần phụ đề', 'sáng hơn', 'zoom vào giây 7', 'bỏ nhạc', 'đổi kiểu chuyển cảnh', 'ảnh bìa ở giây 2',
  'chia đôi từ giây 8 đến 14', 'thẻ giá "15 TRIỆU" ở giây 20', 'bỏ hiệu ứng ở giây 12', 'tắt hiệu ứng tự động'];

export function hieuGopY(cau, gopCu = {}) {
  const g = structuredClone(gopCu), hieu = [], khongHieu = [];
  for (const y of cau.split(/\n|·|;|\.(?=\s|$)/).map(s => s.trim()).filter(Boolean)) {
    let ok = false;
    for (const [re, fn] of LUAT) { const m = y.match(re); if (m) { hieu.push(fn(g, m)); ok = true; break; } }
    if (!ok) khongHieu.push(y);
  }
  return { gop: g, hieu, khongHieu };
}
