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

Bản trên GitHub Pages không có đăng nhập (mở thẳng, tiến độ lưu trong trình duyệt). Đăng nhập chỉ có khi chạy trên Cloudflare Workers (mục 2).

## 1b. Đưa web lên Cloudflare Pages

1. Vào https://dash.cloudflare.com → **Workers & Pages** → **Create** → tab **Pages** → **Connect to Git**.
2. Cho phép Cloudflare truy cập GitHub, chọn repo **GiangGiangLearn** → **Begin setup**.
3. Cấu hình build:
   - Production branch: `main`
   - Framework preset: `Vite` (hoặc None)
   - Build command: `pnpm build`
   - Build output directory: `dist`
   - Environment variables: `NODE_VERSION` = `22` (thêm `VITE_DATA_BASE` nếu có, giống GitHub)
4. **Save and Deploy**. Web có địa chỉ `https://<tên-dự-án>.pages.dev/`. Mỗi lần `git push` Cloudflare tự build lại.
5. (Tùy chọn) **Custom domains** để gắn tên miền riêng.

Không cần sửa `base`: khi build trên Cloudflare (có biến `CF_PAGES`), web tự chạy ở gốc tên miền.

## 2. Đăng nhập bằng số điện thoại (Cloudflare Workers + D1)

Web chạy trên **Cloudflare Workers** (`wrangler.jsonc`) thì bắt buộc đăng nhập: tài khoản = **số điện thoại** học viên, mật khẩu mặc định **12345678**, do giáo viên tạo; học viên không tự đăng ký được. Tài khoản và tiến độ học lưu trong cơ sở dữ liệu **D1**. Bài học, slide, âm thanh trên R2 chỉ được gửi cho người đã đăng nhập.

**Cài một lần**
1. Cloudflare → **Storage & databases → D1 SQL Database → Create** → tên `giang-giang` → **Create**. Không cần tạo bảng: web tự tạo ở lần chạy đầu.
2. Chép **Database ID** (ở trang của database vừa tạo), dán vào `wrangler.jsonc` thay cho `DIEN_DATABASE_ID_VAO_DAY`, rồi `git push`.
3. Kiểm tra `bucket_name` trong `wrangler.jsonc` trùng tên bucket R2 (mặc định `giang-giang-media`).
4. Worker (**Workers & Pages → gianggianglearn**) tự build lại sau khi push. Mở web sẽ thấy màn hình đăng nhập.

**Tạo quản trị viên đầu tiên** (một lần) – chọn một trong hai cách:
- **Trên trang Cloudflare:** D1 → `giang-giang` → **Console**, dán lệnh dưới (thay số điện thoại, tên) → **Execute**. Chuỗi `pbkdf2$…` là mật khẩu `12345678` đã mã hóa, dùng lại được cho mọi tài khoản:
  ```sql
  INSERT INTO users (phone, name, password, role)
  VALUES ('0912345678', 'Tên giáo viên', 'pbkdf2$100000$EMGro94MrColvcEM7+Q8gg==$UhvwKzNq81JR6rn3yTtvduaBIjcvgqQ/GFTOD+8QL0U=', 'admin');
  ```
  (Cần mở web ít nhất một lần sau khi deploy để web tự tạo bảng.) Bỏ `role` và `'admin'` là tạo tài khoản học viên thường.
- **Bằng script:** `python3 scripts/tao_tai_khoan.py --quan-tri 0912345678` (cần API token D1, xem dưới).

**Tạo tài khoản học viên trên web:** quản trị viên đăng nhập → mục **👥 Học viên** trên thanh trên cùng:
- Dán danh sách (mỗi dòng `0912345678 | Nguyễn Văn An`, hoặc dán thẳng 2 cột họ tên + số điện thoại từ Excel) → **Tạo tài khoản**. Mật khẩu mặc định 12345678, người đã có được bỏ qua.
- Trong danh sách: **Đặt lại MK** (về 12345678), **Cấp / Bỏ quản trị**, **Xóa**.

**Hoặc dùng script trên máy** (cần API token: Cloudflare → ảnh đại diện → **My Profile → API Tokens → Create Token → Custom token** → Permissions: `Account` · `D1` · `Edit`):
1. Tạo file `hoc_vien.txt` (git đã bỏ qua file này), mỗi dòng `0912345678 | Nguyễn Văn An`.
2. `python3 scripts/tao_tai_khoan.py hoc_vien.txt`, nhập Account ID và API token khi được hỏi.
3. Khác: `--dat-lai <số>` (mật khẩu về 12345678), `--xoa <số>`, `--danh-sach`, `--quan-tri <số>`.

Học viên tự đổi mật khẩu ở nút 👤 góc phải web. Nên nhắc học viên đổi, vì ai biết số điện thoại cũng thử được mật khẩu 12345678. Nhập sai mật khẩu 10 lần liên tiếp thì tài khoản bị khóa 15 phút.

Chạy thử trên máy bằng `pnpm dev` thì không có đăng nhập (web mở thẳng). Muốn thử cả đăng nhập: `pnpm build` rồi `npx wrangler dev` (dùng D1 và R2 giả lập trên máy).

## 3. Thêm nội dung bài học (HSK 2–5, YCT 1–6)

1. **Nén PowerPoint**: `python3 scripts/nen_pptx.py "<thư mục pptx gốc>" ~/TAI_LIEU_GIANG_GIANG/<CẤP>/pptx_nen`
2. **Xuất bài giảng cho web**: `python3 scripts/xuat_web.py ~/TAI_LIEU_GIANG_GIANG/<CẤP>/pptx_nen <cấp>` (ví dụ `hsk2`). Ảnh slide và âm thanh vào `public/media/<cấp>/`.
3. **Soạn nội dung bài**: tạo `content-src/<cấp>/01.txt, 02.txt…` theo mẫu của `content-src/hsk1/` (từ vựng, ngữ pháp, bài khóa, 30 câu → 15 chọn đáp án + 15 điền + 15 sắp xếp). Dòng `slides:` ghi tên file PowerPoint của bài.
4. **Kiểm tra & tạo JSON**: `python3 scripts/build_content.py`. Script báo lỗi nếu thiếu pinyin, đáp án không nằm trong câu, phương án nhiễu trùng nhau…
5. `pnpm test` rồi `git push`.

Danh sách 11 cấp nằm trong `content-src/courses.json`; cấp chưa có bài sẽ hiện "đang cập nhật".

## 4. Dữ liệu học tập trên Cloudflare R2

Bài học (`content/`) và slide, âm thanh (`media/`) nằm trong bucket R2. Trên Cloudflare Workers, Worker đọc bucket trực tiếp (binding `MEDIA` trong `wrangler.jsonc`) và chỉ gửi cho người đã đăng nhập – **không cần** bật địa chỉ công khai, CORS hay biến `VITE_DATA_BASE`.

1. **R2 → Create bucket** (ví dụ `giang-giang-media`; tên phải trùng `bucket_name` trong `wrangler.jsonc`).
2. **R2 → Manage API tokens → Create API token**, quyền *Object Read & Write* cho bucket này. Chép Access Key ID, Secret Access Key.
3. Tải dữ liệu lên: `bash scripts/tai_len_r2.sh` (cần `sudo apt install rclone`).
4. Nếu trước đây đã bật **Settings → Public Development URL** cho bucket thì **tắt** đi, để người chưa đăng nhập không mở được file bằng link trực tiếp.

Sửa dữ liệu: sửa `content-src/…` → `python3 scripts/build_content.py` → `bash scripts/tai_len_r2.sh content`.
Không cần build lại web. Nội dung bài đổi ngay khi tải lại trang, ảnh/âm thanh đổi sau tối đa 10 phút.
Nếu thay file trực tiếp trên trang R2, lần chạy script sau sẽ ghi đè bằng bản trên máy, nên sửa ở máy rồi tải lên là chắc chắn nhất.

(Bản GitHub Pages không có Worker: muốn nó đọc từ R2 thì phải bật Public Development URL, thêm CORS `[{"AllowedOrigins":["*"],"AllowedMethods":["GET","HEAD"],"AllowedHeaders":["*"],"MaxAgeSeconds":3600}]` và đặt biến `VITE_DATA_BASE` = địa chỉ công khai của bucket – khi đó dữ liệu là công khai.)

## 5. Video trong bài giảng

Video (bài 5, 7, 15 và buổi 1–3) chưa được đưa lên web vì cần ffmpeg để nén. Slide có video hiện dấu "🎬 có video". Cài `sudo apt install ffmpeg` rồi báo để bổ sung.
