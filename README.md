# Xưởng Dựng Video

Web dựng video TikTok theo quy chuẩn kênh, **chạy hoàn toàn trong Chrome** của người dùng: không cài đặt, không máy chủ, clip không gửi đi đâu.

## Dùng
1. Mở link trên **Google Chrome** (máy tính).
2. **Bước 1:** điền kênh, dòng tên máy, câu hook (hiện giây 0 = ảnh bìa).
3. **Bước 2:** mỗi cảnh thêm clip + file giọng, gõ lại lời nói vào ô phụ đề (`*từ khoá*` sẽ tô xanh).
4. **Bước 3:** xem trước từng cảnh; "Che vùng" để làm mờ IMEI/tên tài khoản; "Đặt vòng" để khoanh chỗ bấm.
5. **Bước 4:** Dựng video (bản gốc hoặc bản nhẹ < 10MB) + Tải ảnh bìa + chép caption có sẵn hashtag.

## Quy chuẩn tự áp dụng
Hook giây 0 · ảnh bìa đồng nhất (chữ trong vùng lưới 3:4) · chữ tránh vùng nút/caption TikTok · cắt giọng tại khoảng lặng thật (không cụt chữ), rút khoảng lặng dài · cân âm lượng giọng · nhạc thấp hơn giọng 20dB · bộ hashtag chuẩn. Sửa chuẩn ở `js/config.js`.

## Kỹ thuật
HTML + JavaScript thuần, không cần build. Đọc/ghi MP4 bằng [Mediabunny](https://github.com/Vanilagy/mediabunny) (MPL-2.0, để trong `vendor/`). Font Anton & Be Vietnam Pro (SIL OFL). Chạy thử: `python3 -m http.server` rồi mở `http://localhost:8000/?thu` (cần thư mục `thu/` chứa clip mẫu, không đưa lên mạng).
