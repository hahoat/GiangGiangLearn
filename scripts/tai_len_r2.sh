#!/usr/bin/env bash
# Tải thư mục public/media lên Cloudflare R2 (giữ nguyên cấu trúc thư mục).
# Cần rclone:  sudo apt install rclone
# Dùng:        bash scripts/tai_len_r2.sh
# Khóa API chỉ nhập vào Terminal, không lưu ra file.
set -euo pipefail
cd "$(dirname "$0")/.."

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

echo "Đang tải public/media → r2:$BUCKET …"
# copy (không xóa gì trên bucket); chạy lại chỉ tải file mới/đổi.
rclone copy public/media "r2:$BUCKET" --progress --transfers 16 --checksum \
  --header-upload "Cache-Control: public, max-age=31536000, immutable" \
  --exclude "*/manifest.json"
# manifest.json có thể thay đổi khi xuất lại slide → cache ngắn hơn.
rclone copy public/media "r2:$BUCKET" --progress --transfers 16 --checksum \
  --header-upload "Cache-Control: public, max-age=300" \
  --include "*/manifest.json"
echo "Xong. Kiểm tra: rclone ls r2:$BUCKET | head"
