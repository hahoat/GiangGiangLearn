"""Xuất bài giảng PowerPoint sang dạng web: ảnh slide WebP + file âm thanh + manifest.json.

PowerPoint → PDF (LibreOffice) → PNG (pdftoppm) → WebP (Pillow).
Âm thanh mp3/m4a/wav được tách khỏi pptx và gắn vào đúng slide (đọc từ .rels).
Video chưa xuất (cần ffmpeg để nén) – manifest ghi lại để bổ sung sau.

Dùng:
    python3 scripts/xuat_web.py <thư_mục_pptx> <cấp> [thư_mục_ra] [lọc tên deck…]
    vd: python3 scripts/xuat_web.py ~/TAI_LIEU_GIANG_GIANG/HSK1/pptx_nen hsk1
Mặc định ghi vào public/media/<cấp>/<deck>/ (đổi sang CDN bằng VITE_MEDIA_BASE khi build web).
"""
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
import zipfile

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WIDTH, THUMB, QUALITY = 1280, 320, 78
AUDIO = ('.mp3', '.m4a', '.wav')
VIDEO = ('.mp4', '.mov', '.m4v', '.avi', '.wmv')


def slug(name):
    """'03 我是中国人' → 'bai-03'; 'HSK 1 BUỔI 4 ( BỘ THỦ)' → 'buoi-4'."""
    m = re.match(r'^\s*(\d+)', name)
    if m:
        return f'bai-{int(m.group(1)):02d}'
    m = re.search(r'BU[OỔÔ]I\s*(\d+)', name.upper())
    if m:
        return f'buoi-{int(m.group(1))}'
    ascii_name = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', ascii_name.lower()).strip('-') or 'deck'


def visible_slides(z):
    """Danh sách file slide theo thứ tự trình chiếu, bỏ slide ẩn (PDF cũng bỏ)."""
    pres = z.read('ppt/presentation.xml').decode('utf8')
    rels = z.read('ppt/_rels/presentation.xml.rels').decode('utf8')
    targets = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', rels))
    targets.update({k: v for v, k in re.findall(r'Target="([^"]+)"[^>]*Id="([^"]+)"', rels)})
    order = []
    for rid in re.findall(r'<p:sldId [^>]*r:id="([^"]+)"', pres):
        path = 'ppt/' + targets[rid].lstrip('/').replace('ppt/', '')
        xml = z.read(path).decode('utf8', 'ignore')
        if re.search(r'<p:sld [^>]*show="0"', xml):
            continue
        order.append(path)
    return order


def media_of(z, slide_path):
    rel = slide_path.replace('slides/', 'slides/_rels/') + '.rels'
    if rel not in z.namelist():
        return []
    text = z.read(rel).decode('utf8')
    return sorted(set(os.path.basename(t) for t in re.findall(r'Target="\.\./media/([^"]+)"', text)))


def export_deck(pptx, out_dir, level):
    name = os.path.splitext(os.path.basename(pptx))[0]
    deck = slug(name)
    target = os.path.join(out_dir, deck)
    if os.path.exists(target):
        shutil.rmtree(target)
    os.makedirs(os.path.join(target, 'thumbs'))
    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, 'deck.pptx')
        shutil.copy(pptx, src)
        profile = 'file://' + os.path.join(tmp, 'lo-profile')
        subprocess.run(['soffice', f'-env:UserInstallation={profile}', '--headless', '--convert-to', 'pdf',
                        '--outdir', tmp, src], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=900)
        subprocess.run(['pdftoppm', '-scale-to-x', str(WIDTH), '-scale-to-y', '-1', '-png',
                        os.path.join(tmp, 'deck.pdf'), os.path.join(tmp, 'p')], check=True)
        pages = sorted(glob.glob(os.path.join(tmp, 'p-*.png')))
        for i, png in enumerate(pages, 1):
            im = Image.open(png).convert('RGB')
            im.save(os.path.join(target, f'{i:03d}.webp'), 'WEBP', quality=QUALITY, method=6)
            im.thumbnail((THUMB, THUMB))
            im.save(os.path.join(target, 'thumbs', f'{i:03d}.webp'), 'WEBP', quality=70, method=6)

    z = zipfile.ZipFile(pptx)
    order = visible_slides(z)
    aligned = len(order) == len(pages)
    slides, videos, audio_out = [], [], set()
    for i in range(1, len(pages) + 1):
        entry = {'img': f'{i:03d}.webp', 'thumb': f'thumbs/{i:03d}.webp'}
        if aligned:
            media = media_of(z, order[i - 1])
            audio = [m for m in media if m.lower().endswith(AUDIO)]
            if audio:
                os.makedirs(os.path.join(target, 'audio'), exist_ok=True)
                for a in audio:
                    if a not in audio_out:
                        with open(os.path.join(target, 'audio', a), 'wb') as fh:
                            fh.write(z.read('ppt/media/' + a))
                        audio_out.add(a)
                entry['audio'] = [f'audio/{a}' for a in audio]
            vids = [m for m in media if m.lower().endswith(VIDEO)]
            if vids:
                entry['hasVideo'] = True
                videos += vids
        slides.append(entry)
    manifest = {'id': deck, 'title': name.strip(), 'level': level, 'width': WIDTH, 'slides': slides,
                'audioAligned': aligned, 'videosNotExported': sorted(set(videos))}
    with open(os.path.join(target, 'manifest.json'), 'w', encoding='utf-8') as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=1)
    size = sum(os.path.getsize(f) for f in glob.glob(os.path.join(target, '**', '*'), recursive=True) if os.path.isfile(f))
    return deck, len(pages), len(audio_out), aligned, size


if __name__ == '__main__':
    src_dir, level = sys.argv[1], sys.argv[2]
    out_dir = sys.argv[3] if len(sys.argv) > 3 else os.path.join(ROOT, 'public', 'media', level)
    os.makedirs(out_dir, exist_ok=True)
    total = 0
    only = sys.argv[4:]  # tùy chọn: chỉ xuất các deck có tên chứa chuỗi này
    failed = []
    for f in sorted(glob.glob(os.path.join(src_dir, '*.pptx'))):
        if only and not any(o in os.path.basename(f) for o in only):
            continue
        for attempt in (1, 2):
            try:
                deck, n, na, ok, size = export_deck(f, out_dir, level)
                break
            except subprocess.SubprocessError as e:
                if attempt == 2:
                    print(f'LỖI {os.path.basename(f)}: {e}', flush=True)
                    failed.append(f)
        else:
            continue
        total += size
        note = '' if ok else '  (số slide PDF khác pptx – chưa gắn âm thanh)'
        print(f'{deck:10} {n:3} slide, {na} âm thanh, {size / 1e6:5.1f} MB{note}', flush=True)
    print(f'TỔNG: {total / 1e6:.1f} MB → {out_dir}' + (f' – {len(failed)} deck lỗi' if failed else ''))
