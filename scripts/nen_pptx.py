"""Nén ảnh bên trong file .pptx mà vẫn giữ nguyên định dạng PowerPoint.

- Ảnh lớn hơn MAX_SIDE px được thu nhỏ (slide 16:9 chiếu Full HD chỉ cần ~1920px).
- JPEG lưu lại chất lượng 80.
- PNG không trong suốt mà là ảnh chụp (nhiều màu) -> đổi sang JPEG, cập nhật tham chiếu trong .rels.
- PNG trong suốt / đồ họa ít màu -> giữ PNG, chỉ thu nhỏ + tối ưu.
- Video (.mp4/.mov/.m4v): nếu máy có ffmpeg thì nén H.264 tối đa 1280px, giữ nguyên tên file
  để không phải sửa tham chiếu; nếu không có ffmpeg thì giữ nguyên.
- Âm thanh, XML giữ nguyên.
Chỉ thay ảnh khi bản mới nhỏ hơn ít nhất 10%.

Dùng: python3 -I nen_pptx.py <thư_mục_vào> <thư_mục_ra>
"""
import io
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from concurrent.futures import ProcessPoolExecutor

from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = 400_000_000
MAX_SIDE = 1920
JPEG_Q = 80


def shrink(im):
    if max(im.size) > MAX_SIDE:
        im = im.copy()
        im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    return im


def save_jpeg(im, info):
    if im.mode not in ('RGB', 'L', 'CMYK'):
        im = im.convert('RGB')
    buf = io.BytesIO()
    kw = {'quality': JPEG_Q, 'optimize': True, 'progressive': True}
    if info.get('icc_profile'):
        kw['icc_profile'] = info['icc_profile']
    if info.get('exif'):
        kw['exif'] = info['exif']
    im.save(buf, 'JPEG', **kw)
    return buf.getvalue()


def process_image(name, data):
    """Trả về (tên_mới, dữ_liệu_mới) hoặc None nếu giữ nguyên."""
    ext = name.rsplit('.', 1)[-1].lower()
    try:
        im = Image.open(io.BytesIO(data))
        im.load()
    except Exception:
        return None
    info = dict(im.info)
    if ext in ('jpg', 'jpeg'):
        out = save_jpeg(shrink(im), info)
        return (name, out) if len(out) < len(data) * 0.9 else None
    if ext != 'png':
        return None
    has_alpha = im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in info)
    if has_alpha:
        rgba = im.convert('RGBA')
        has_alpha = rgba.getchannel('A').getextrema()[0] < 255
    small = shrink(im)
    if not has_alpha and small.convert('RGB').getcolors(maxcolors=4096) is None:
        out = save_jpeg(small.convert('RGB'), {'icc_profile': info.get('icc_profile')})
        if len(out) < len(data) * 0.9:
            return (name[:-4] + '.jpg', out)
    buf = io.BytesIO()
    small.save(buf, 'PNG', optimize=True)
    out = buf.getvalue()
    return (name, out) if len(out) < len(data) * 0.9 else None


FFMPEG = shutil.which('ffmpeg')


def process_video(name, data):
    """Nén video bằng ffmpeg (nếu có). Trả về dữ liệu mới hoặc None."""
    if not FFMPEG:
        return None
    ext = name.rsplit('.', 1)[-1].lower()
    with tempfile.TemporaryDirectory() as tmp:
        src, dst = os.path.join(tmp, 'in.' + ext), os.path.join(tmp, 'out.' + ext)
        with open(src, 'wb') as f:
            f.write(data)
        cmd = [FFMPEG, '-y', '-loglevel', 'error', '-i', src,
               '-vf', "scale='min(1280,iw)':-2", '-c:v', 'libx264', '-crf', '28', '-preset', 'slow',
               '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', dst]
        if subprocess.run(cmd).returncode != 0 or not os.path.exists(dst):
            return None
        out = open(dst, 'rb').read()
    return out if len(out) < len(data) * 0.9 else None


def compress_pptx(src, dst):
    zin = zipfile.ZipFile(src)
    names = set(zin.namelist())
    replaced, renames = {}, {}
    for item in zin.infolist():
        n = item.filename
        if n.startswith('ppt/media/') and n.lower().endswith(('.png', '.jpg', '.jpeg')):
            result = process_image(n, zin.read(n))
            if result:
                new_name, data = result
                if new_name != n:
                    base = new_name
                    k = 1
                    while new_name in names or new_name in replaced:
                        new_name = base[:-4] + f'_{k}.jpg'
                        k += 1
                    renames[n.split('/')[-1]] = new_name.split('/')[-1]
                replaced[n] = (new_name, data)
        elif n.startswith('ppt/media/') and n.lower().endswith(('.mp4', '.mov', '.m4v')):
            data = process_video(n, zin.read(n))
            if data:
                replaced[n] = (n, data)

    with zipfile.ZipFile(dst, 'w') as zout:
        for item in zin.infolist():
            n = item.filename
            if n in replaced:
                new_name, data = replaced[n]
                zout.writestr(zipfile.ZipInfo(new_name, item.date_time), data, compress_type=zipfile.ZIP_STORED)
                continue
            data = zin.read(n)
            if renames and n.endswith('.rels'):
                text = data.decode('utf-8')
                for old, new in renames.items():
                    text = re.sub(r'(Target="[^"]*/)' + re.escape(old) + '"', lambda m: m.group(1) + new + '"', text)
                data = text.encode('utf-8')
            if n == '[Content_Types].xml' and renames:
                text = data.decode('utf-8')
                if not re.search(r'Extension="jpg"', text, re.I):
                    text = text.replace('<Default ', '<Default Extension="jpg" ContentType="image/jpeg"/><Default ', 1)
                data = text.encode('utf-8')
            is_media = n.startswith('ppt/media/')
            zout.writestr(item, data, compress_type=zipfile.ZIP_STORED if is_media else zipfile.ZIP_DEFLATED)
    return len(replaced), len(renames)


def job(args):
    src, dst = args
    changed, renamed = compress_pptx(src, dst)
    return os.path.basename(src), os.path.getsize(src), os.path.getsize(dst), changed, renamed


if __name__ == '__main__':
    src_dir, dst_dir = sys.argv[1], sys.argv[2]
    os.makedirs(dst_dir, exist_ok=True)
    print('ffmpeg:', FFMPEG or 'không có -> giữ nguyên video')
    files = sorted(f for f in os.listdir(src_dir) if f.lower().endswith('.pptx'))
    tasks = [(os.path.join(src_dir, f), os.path.join(dst_dir, f)) for f in files]
    total_in = total_out = 0
    with ProcessPoolExecutor(max_workers=max(1, (os.cpu_count() or 2) - 1)) as pool:
        for name, a, b, changed, renamed in pool.map(job, tasks):
            total_in += a
            total_out += b
            print(f'{name[:40]:40} {a / 1e6:8.1f} MB -> {b / 1e6:7.1f} MB  ({changed} ảnh nén, {renamed} PNG->JPG)', flush=True)
    print(f'TỔNG: {total_in / 1e6:.0f} MB -> {total_out / 1e6:.0f} MB')
