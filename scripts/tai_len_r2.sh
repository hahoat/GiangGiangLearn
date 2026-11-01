#!/usr/bin/env bash
# Tải dữ liệu học tập lên Cloudflare R2:
#   public/content → r2:<bucket>/content   (bài học, từ vựng, bài tập – JSON)
#   public/media   → r2:<bucket>/media     (ảnh slide, âm thanh)
# Web đọc từ R2 khi build có biến VITE_DATA_BASE = địa chỉ công khai của bucket.
# Cần rclone:  sudo apt install rclone
# Dùng:        bash scripts/tai_len_r2.sh            (tải cả hai)
#              bash scripts/tai_len_r2.sh content    (chỉ nội dung bài học)
#              bash scripts/tai_len_r2.sh media      (chỉ slide, âm thanh)
# Khóa API chỉ nhập vào Terminal, không lưu ra file.
set -euo pipefail
cd "$(dirname "$0")/.."
WHAT=${1:-all}

command -v rclone >/dev/null || { echo "Chưa có rclone. Chạy: sudo apt install rclone"; exit 1; }

read -rp  "Account ID (Cloudflare → R2 → bên phải trang): " ACCOUNT_ID
read -rp  "Tên bucket [giang-giang-media]: " BUCKET
BUCKET=${BUCKET:-giang-giang-media}
read -rp  "Access Key ID: " ACCESS_KEY
read -rsp "Secret Access Key (gõ sẽ không hiện): " SECRET_KEY; echo

export RCLONE_CONFIG_R2_TYPE=s3
export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$ACCESS_KEY"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$SECRET_KEY"
export RCLONE_CONFIG_R2_ENDPOINT="https://${ACCOUNT_ID}.r2.cloudflarestorage.com"
export RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true

# copy: không xóa gì trên bucket; chạy lại chỉ tải file mới / đã đổi.
up() { rclone copy "$1" "r2:$BUCKET/$2" --progress --transfers 16 --checksum "${@:3}"; }

if [[ $WHAT == all || $WHAT == content ]]; then
  echo "Đang tải public/content → r2:$BUCKET/content …"
  # JSON: luôn kiểm tra bản mới → sửa trên R2 là web thấy ngay khi tải lại trang
  up public/content content --header-upload "Cache-Control: no-cache"
fi
if [[ $WHAT == all || $WHAT == media ]]; then
  echo "Đang tải public/media → r2:$BUCKET/media …"
  up public/media media --header-upload "Cache-Control: no-cache" --include "*/manifest.json"
  # Ảnh, âm thanh: lưu tạm 10 phút → thay file trên R2 thì tối đa 10 phút sau web đổi theo
  up public/media media --header-upload "Cache-Control: public, max-age=600" --exclude "*/manifest.json"
fi
echo "Xong. Kiểm tra: mở <địa chỉ bucket>/content/index.json trên trình duyệt."
