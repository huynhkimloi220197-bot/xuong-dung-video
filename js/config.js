// QUY CHUẨN KÊNH — sửa ở đây là cả app đổi theo. Đơn vị: điểm ảnh trên khung 1080×1920, giây.
export const CHUAN = {
  W: 1080, H: 1920, FPS: 30,
  bitrate_video: 9_000_000,          // bản gốc ~9 Mbps (TikTok nén lại sau)
  bitrate_dang: 1_100_000,           // bản đăng nhẹ (< 10MB cho video ~70s)
  mau: {
    troi: [110, 190, 255],           // xanh trời: chữ nhấn, từ khoá
    vang: [255, 200, 61],            // nhãn PHẦN, chấm bước
    trang: [255, 255, 255],
    xam: [190, 190, 200],            // nhãn "bản cũ" — trung tính, không chê
    hong_follow: [254, 44, 85],
  },
  font: { lon: 'Anton', chu: 'BVX' },
  // vùng an toàn TikTok: không đặt chữ dưới y=1560 (caption, nhạc) và mép phải x>950 vùng y 900–1500 (nút tim/bình luận)
  an_toan: { y_nhan: 210, y_phu_de: 1500, the_lon: [150, 96, 930, 372], phai_max: 950 },
  // lưới trang cá nhân cắt ảnh bìa 3:4 → chữ ảnh bìa nằm trong y 240..1680
  bia_34: [240, 1680],
  am: { giong_dbfs: -17, nhac_db: -20, lang_db: 24, lang_ms: 60, nen_lang_toi_da: 0.35, nen_lang_con: 0.22 },
  do_dai_khuyen: [15, 25],          // cảnh báo vàng nếu dài hơn
  hashtag_goc: ['#xaykenhtiktok', '#oppo'],
};

export const CHUYEN_CANH = {
  khong: 'Cắt thẳng',
  quet_sang: 'Quét sáng chéo',
  chop_mat: 'Chớp mắt (mí khép–mở)',
  zoom: 'Zoom xuyên tâm',
  truot: 'Trượt lên',
};

// MẪU "TÍNH NĂNG MỚI" (theo video ColorOS 17 P1). Mỗi cảnh có loại riêng; người dùng thêm/bớt/đổi thứ tự được.
export const LOAI_CANH = {
  mo:       { ten: 'Mở đầu (quay mặt)', mo_ta: 'Clip mặt + thẻ hook giây 0 (ảnh bìa)' },
  canh:     { ten: 'Cảnh minh hoạ', mo_ta: '1–3 clip máy + nhãn trên cùng + giọng' },
  chia_doi: { ten: 'So sánh chia đôi', mo_ta: '2 clip cạnh nhau (cũ / mới)' },
  buoc:     { ten: 'Hướng dẫn từng bước', mo_ta: 'Mỗi bước 1 đoạn clip + nhãn BƯỚC n' },
  ket:      { ten: 'Kết (quay mặt)', mo_ta: 'Câu hỏi + nút FOLLOW · BÌNH LUẬN' },
};

export function mauTinhNangMoi() {
  return {
    kenh: { ten: 'Lợi Mê Công Nghệ', at: '@loimecongnghe' },
    hook_nho: 'FIND X9 × COLOROS 17', hook_lon: 'CÓ GÌ MỚI?', phan: 'PHẦN 1',
    bia_lon_1: 'HÌNH NỀN', bia_lon_2: 'BIẾT THỜI TIẾT?',
    may: '#oppofindx9', chu_de: '#ColorOS17',
    caption: '',
    nhac: { bat: false, file: null },
    canh: [
      { loai: 'mo', chuyen: 'khong', am: 'clip', clips: [], phu_de: '' },
      { loai: 'canh', chuyen: 'chop_mat', am: 'giong', nhan: 'RENO16 · COLOROS 16', nhan_phu: '', clips: [], phu_de: '' },
      { loai: 'canh', chuyen: 'quet_sang', am: 'giong', nhan: 'FIND X9 · COLOROS 17', nhan_phu: '', clips: [], phu_de: '' },
      { loai: 'chia_doi', chuyen: 'zoom', am: 'giong', tieu_de: 'SO SÁNH', tieu_de_nho: 'CÙNG CHỖ · CÁCH 5 PHÚT',
        trai: 'COLOROS 16', trai_duoi: 'Chưa có hiệu ứng', phai: 'COLOROS 17', phai_duoi: 'Theo trời thật', clips: [], phu_de: '' },
      { loai: 'buoc', chuyen: 'quet_sang', am: 'giong', clips: [], phu_de: '' },
      { loai: 'ket', chuyen: 'quet_sang', am: 'clip', cau_hoi: 'BẠN THẤY SAO?', clips: [], phu_de: '' },
    ],
  };
}
