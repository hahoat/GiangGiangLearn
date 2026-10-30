# Hướng dẫn triển khai web Giang Giang

## 1. Đưa web lên GitHub Pages (bắt buộc)

1. Tạo repo trên GitHub tên **GiangGiangLearn** (trùng với `base` trong `vite.config.js`; nếu đặt tên khác thì sửa `base: '/<tên-repo>/'`).
2. Đẩy code lên:
   ```bash
   cd ~/WEB_HOC_TIENG_TRUNG_GIANG_GIANG
   git remote add origin https://github.com/<tài-khoản>/GiangGiangLearn.git
   git push -u origin main
   ```
3. Trên GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Mỗi lần `git push`, GitHub tự chạy test, build và phát hành. Web có địa chỉ:
   `https://<tài-khoản>.github.io/GiangGiangLearn/`

Chưa cấu hình Supabase thì web vẫn chạy đầy đủ; tiến độ lưu trong trình duyệt của từng học viên.

## 2. Bật đăng nhập + đồng bộ tiến độ (Supabase, tùy chọn)

1. Tạo dự án miễn phí tại https://supabase.com.
2. **SQL Editor** → dán nội dung `supabase/schema.sql` → Run.
3. **Authentication → URL Configuration**:
   - Site URL: `https://<tài-khoản>.github.io/GiangGiangLearn/`
   - Redirect URLs: thêm cùng địa chỉ đó (và `http://localhost:5173/GiangGiangLearn/` nếu chạy thử trên máy).
4. **Project Settings → API**: chép *Project URL* và khóa *anon public*.
5. Trên GitHub: **Settings → Secrets and variables → Actions → Variables** → thêm:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = khóa anon public (khóa này được phép công khai; dữ liệu đã được bảo vệ bằng chính sách ở bước 2)
   - (tùy chọn) `VITE_SUPABASE_GOOGLE` = `1` nếu đã bật đăng nhập Google trong Authentication → Providers.
6. Chạy lại workflow (Actions → Deploy to GitHub Pages → Run workflow). Nút **Đăng nhập** sẽ xuất hiện.

Chạy thử trên máy: tạo file `.env.local` (đã bị git bỏ qua) với hai dòng `VITE_SUPABASE_URL=…` và `VITE_SUPABASE_ANON_KEY=…`, rồi `pnpm dev`.

## 3. Thêm nội dung bài học (HSK 2–5, YCT 1–6)

1. **Nén PowerPoint**: `python3 scripts/nen_pptx.py "<thư mục pptx gốc>" ~/TAI_LIEU_GIANG_GIANG/<CẤP>/pptx_nen`
2. **Xuất bài giảng cho web**: `python3 scripts/xuat_web.py ~/TAI_LIEU_GIANG_GIANG/<CẤP>/pptx_nen <cấp>` (ví dụ `hsk2`). Ảnh slide và âm thanh vào `public/media/<cấp>/`.
3. **Soạn nội dung bài**: tạo `content-src/<cấp>/01.txt, 02.txt…` theo mẫu của `content-src/hsk1/` (từ vựng, ngữ pháp, bài khóa, 30 câu → 15 chọn đáp án + 15 điền + 15 sắp xếp). Dòng `slides:` ghi tên file PowerPoint của bài.
4. **Kiểm tra & tạo JSON**: `python3 scripts/build_content.py`. Script báo lỗi nếu thiếu pinyin, đáp án không nằm trong câu, phương án nhiễu trùng nhau…
5. `pnpm test` rồi `git push`.

Danh sách 11 cấp nằm trong `content-src/courses.json`; cấp chưa có bài sẽ hiện "đang cập nhật".

## 4. Khi dung lượng ảnh/âm thanh lớn dần

Hiện ảnh slide nằm ngay trong repo (`public/media`, HSK 1 ≈ 58 MB). Khi repo gần 1 GB:
1. Tạo bucket Cloudflare R2 (hoặc CDN khác), bật truy cập công khai.
2. Tải thư mục `public/media/` lên bucket, giữ nguyên cấu trúc.
3. Thêm biến GitHub `VITE_MEDIA_BASE` = địa chỉ công khai của bucket (ví dụ `https://media.giang-giang.vn/`), rồi xóa `public/media` khỏi repo.

## 5. Video trong bài giảng

Video (bài 5, 7, 15 và buổi 1–3) chưa được đưa lên web vì cần ffmpeg để nén. Slide có video hiện dấu "🎬 có video". Cài `sudo apt install ffmpeg` rồi báo để bổ sung.
