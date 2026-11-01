# Tiếng Trung Giang Giang · Học tiếng Trung HSK

Website học tiếng Trung bằng React + Vite, giao diện tiếng Việt.

## Chạy local

```bash
pnpm install
pnpm dev
```

Cần Node.js ≥ 20.19 và pnpm 9. Mở địa chỉ Vite hiển thị trong terminal.

- Nội dung bài học: `content-src/` → `python3 scripts/build_content.py` → `public/content/`
- Bài giảng (ảnh slide, âm thanh): `public/media/`
- Triển khai, đăng nhập (Cloudflare D1), thêm cấp mới: xem `HUONG_DAN_TRIEN_KHAI.md`

## Tính năng

- 11 cấp giáo trình: HSK 1–5, YCT 1–6 (HSK 1 đã đủ 16 bài; các cấp khác đang cập nhật).
- Mỗi bài: Bài giảng (slide + âm thanh) → Ôn tập (Flashcard, Ngữ pháp, Từ vựng) → Thực hành (Bài khóa, 15 câu Chọn đáp án, 15 câu Sắp xếp, 15 câu Điền đáp án).
- Bắt buộc đăng nhập bằng số điện thoại (tài khoản do giáo viên cấp), đồng bộ tiến độ giữa các thiết bị (Cloudflare Workers + D1).

- Pinyin hiển thị phía trên chữ Hán, tô màu theo thanh điệu (bật/tắt được).
- Chạm vào bất kỳ từ nào trong hội thoại, bài khóa, ví dụ để xem nghĩa, nghe phát âm, thêm vào bộ ôn tập.
- Thẻ nhớ có lặp lại ngắt quãng (SRS): tự chấm Chưa nhớ/Không chắc/Đã nhớ (có nút “Từ khác” để bỏ qua), hệ thống tự hẹn ngày ôn lại. Mặt trước không tô màu để không lộ thanh điệu.
- Trang Ôn tập riêng cho các thẻ đến hạn, có phím tắt (Space, 1–4).
- Bài tập phản hồi ngay sau mỗi câu, có đáp án đúng và câu hoàn chỉnh để nghe lại.
- Mục tiêu XP mỗi ngày và chuỗi ngày học liên tiếp.
- Cài đặt hiển thị (nút Aa): pinyin, màu thanh điệu, bản dịch, cỡ chữ, tốc độ đọc, nghe chậm 🐢, chế độ tối.
- Tiến độ, thẻ ôn tập và cài đặt được lưu trong trình duyệt (localStorage).

## Kiểm thử

```bash
pnpm test
```
