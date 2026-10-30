# Kế hoạch đưa bài giảng HSK 1–4 & YCT 1–4 lên web

## 1. Hiện trạng (HSK 1, đã đo thực tế)

| | Dung lượng |
|---|---|
| 20 file PowerPoint gốc | **1.355 MB** |
| Sau khi nén ảnh (vẫn là .pptx, mở và dạy bình thường) | **674 MB** |
| …trong đó riêng video bài 15 (`大兴机场见`, file .mov) | 416 MB (chưa nén được vì máy chưa có ffmpeg) |
| Ước tính sau khi nén cả video | ~280 MB |
| **Bản cho web** của bài 13: 56 slide WebP + âm thanh (bản gốc 206 MB) | **~4,2 MB** |

Nguyên nhân file nặng: ảnh chụp độ phân giải rất cao (có ảnh hàng chục MB) và video .mov chưa nén.
Bản nén giữ nguyên chất lượng hiển thị. Đã so sánh ảnh render từng slide của bài 13: sai khác trung bình < 1/255, không nhìn thấy khác biệt.

Bản nén nằm ở: `~/TAI_LIEU_GIANG_GIANG/HSK1/pptx_nen/`. Bản gốc giữ nguyên, không bị sửa.

## 2. Nguyên tắc

1. **PowerPoint không đưa thẳng lên web.** Trình duyệt không mở được .pptx, file lại nặng. Web dùng *ảnh slide WebP + file âm thanh/video tách riêng*. File .pptx đã nén chỉ để giáo viên dạy hoặc tải về.
2. **Mã nguồn và tài liệu để ở hai nơi khác nhau.** Code nằm trên GitHub Pages như hiện tại. Ảnh, âm thanh, video để trên kho lưu trữ riêng (CDN). GitHub giới hạn mỗi file 100 MB và repo nên dưới 1 GB, nên không chứa nổi 8 cấp độ. File `.gitignore` đã được thêm để chặn việc lỡ đưa .pptx, .zip, video vào git.
3. **Mọi cấp độ dùng chung một quy trình và một cấu trúc thư mục**, để thêm HSK 2–4 và YCT 1–4 chỉ là chạy lại script.

## 3. Quy trình xử lý cho mỗi cấp độ

```
PowerPoint gốc
  └─(1) Nén ảnh + video ─────────────▶ pptx_nen/            (để dạy, tải về)
        └─(2) Xuất PDF (LibreOffice)
              └─(3) Ảnh slide WebP 1280px + ảnh nhỏ 320px ─▶ web/<cấp>/<bài>/slides/
        └─(4) Tách mp3/mp4, ghi lại slide nào có âm thanh ─▶ web/<cấp>/<bài>/media/
        └─(5) Lấy chữ trên slide (từ vựng, pinyin) ──▶ bản nháp → người duyệt → data/<cấp>.json
  (6) Sinh manifest.json cho từng bài → đẩy thư mục web/ lên CDN
```

- **Bước 1** đã có script: `scripts/nen_pptx.py`.
  ```bash
  python3 scripts/nen_pptx.py "<thư mục pptx gốc>" ~/TAI_LIEU_GIANG_GIANG/<CẤP>/pptx_nen
  ```
  Tự nén video nếu máy có ffmpeg. *Phần nén video chưa được chạy thử vì máy chưa có ffmpeg.*
- **Bước 2–4, 6:** cần viết script `scripts/xuat_web.py`. Đã chạy thử thủ công trên bài 13 và kết quả tốt (số liệu ở mục 1). Âm thanh gắn với slide nào đọc được từ file `.rels` (ví dụ bài 13: audio ở slide 17–18, 41–42, 47–48), nên trên web có thể hiện nút ▶ đúng slide.
- **Bước 5** chỉ tự động được một phần. Chữ lấy từ slide thường lẫn lộn, nên cần người duyệt lại trước khi đưa vào phần flashcard/bài tập.
- **Lưu ý:** trên web, hiệu ứng động và hoạt ảnh của PowerPoint sẽ không còn. Slide hiển thị ở trạng thái cuối.

## 4. Cấu trúc thư mục trên CDN

```
/courses/
  index.json                         ← danh sách cấp: hsk1..hsk4, yct1..yct4
  hsk1/
    course.json                      ← tên bài, số slide, link tải pptx
    13-qing-gei-wo-yi-bei-cha/
      manifest.json                  ← {slides:[{img, thumb, audio?}], video?}
      slides/001.webp … 056.webp
      thumbs/001.webp …
      media/media1.mp3 …
  yct1/ …
/downloads/hsk1/13 请给我一杯茶.pptx  ← bản .pptx đã nén (nếu cho tải)
```

Tên thư mục bài dùng số thứ tự + pinyin không dấu, tránh chữ Hán và dấu cách trong URL.

## 5. Nơi lưu trữ (đề xuất)

| Lựa chọn | Ưu | Nhược |
|---|---|---|
| **Cloudflare R2** + tên miền riêng *(khuyên dùng)* | Có gói miễn phí dung lượng nhỏ, **không tính phí băng thông tải xuống**, phù hợp ảnh/âm thanh | Cần tài khoản Cloudflare và thẻ thanh toán |
| Bunny CDN Storage | Rẻ, nhanh ở châu Á | Trả phí theo dung lượng và băng thông |
| Google Drive | Quen thuộc | Không hợp để nhúng ảnh/âm thanh vào web: chậm, hay bị giới hạn |
| Để chung repo GitHub | Đơn giản | Vượt giới hạn khi có 8 cấp độ |

*Giá và hạn mức thay đổi theo thời gian, nên kiểm tra lại trên trang chính thức trước khi chọn.*

Ước tính dung lượng bản web: khoảng 3–5 MB mỗi bài (chưa tính video), tức khoảng 60–80 MB cho mỗi cấp HSK 1. Tám cấp độ ước khoảng **0,5–1 GB** cả video, tùy số bài.

## 6. Thay đổi trên web

1. Thêm danh sách cấp YCT 1–4 vào `src/data.js` (hiện mới có HSK 1–4).
2. Bỏ dữ liệu ghi cứng; web đọc `index.json` → `course.json` → `manifest.json` từ CDN.
3. Thêm bước **"Bài giảng"** trong mỗi bài: xem slide (vuốt hoặc phím ← →), ảnh tải dần khi cần (lazy load), nút ▶ trên slide có âm thanh, chế độ toàn màn hình, nút tải .pptx (tùy chọn).
4. Giữ nguyên các bước học tương tác hiện có (từ mới, thẻ nhớ, bài tập…), lấy dữ liệu từ `data/<cấp>.json` đã duyệt.

## 7. Lộ trình đề xuất

| Tuần | Việc |
|---|---|
| 1 | Cài ffmpeg, nén video bài 15. Viết `xuat_web.py`. Chọn và tạo CDN. Đưa **HSK 1** lên. Làm bước "Bài giảng" trên web |
| 2 | Duyệt dữ liệu từ vựng/bài tập HSK 1. Gom tài liệu HSK 2 và chạy quy trình |
| 3–4 | HSK 3, HSK 4 |
| 5–6 | YCT 1–4 (thường ít bài hơn, nhiều hình ảnh) |
| Liên tục | Mỗi lần thêm tài liệu: chạy 2 script → kiểm tra → đẩy lên CDN, không cần sửa code |

## 8. Việc bạn cần quyết định / làm

- [ ] **Cài ffmpeg** để nén video: `sudo apt install ffmpeg`, sau đó chạy lại bước 1 cho HSK 1.
- [ ] **Chọn nơi lưu trữ** (đề xuất Cloudflare R2) và tạo tài khoản.
- [ ] **Bản quyền:** slide có dùng hình và nội dung từ giáo trình HSK chuẩn (sách có bản quyền). Nếu đưa công khai, nên cân nhắc giới hạn cho học viên đăng nhập, hoặc chỉ dùng phần nội dung do trung tâm tự soạn.
- [ ] Có cho học viên **tải file .pptx** không, hay chỉ xem trên web?
- [ ] Gửi tài liệu HSK 2–4, YCT 1–4 khi sẵn sàng (giữ cùng cách đặt tên file `01 …`, `02 …`).
- [ ] Dọn dẹp: thư mục gốc và file .zip HSK 1 (mỗi thứ 1,3 GB) đang nằm trong thư mục code web. Nên chuyển sang `~/TAI_LIEU_GIANG_GIANG/HSK1/goc/`.
