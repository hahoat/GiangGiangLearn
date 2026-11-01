"""Chuyển nội dung bài học từ định dạng văn bản (content-src/) sang JSON cho web (public/content/).

Định dạng một bài (content-src/<cấp>/NN.txt):

    id: 3
    title: 我是中国人
    py: Wǒ shì Zhōng guó rén
    vi: Tôi là người Trung Quốc
    goal: Mục tiêu bài học
    slides: 03 我是中国人            (tên deck slide, nhiều deck cách nhau bởi ;)
    canva: https://www.canva.com/design/<mã>/<mã>/view   (tùy chọn: bài giảng là thiết kế Canva, thay cho slide)

    == vocab
    中文 | Zhōng wén | danh từ | tiếng Trung | 他是中文老师。 | Anh ấy là giáo viên tiếng Trung.

    == grammar
    ## Tên điểm ngữ pháp
    Giải thích (nhiều dòng)
    f: A + 的 + B
    ex: 我的老师 | giáo viên của tôi

    == text Bài khóa 1
    白家月: 你叫什么名字？ | Bạn tên là gì?

    == sentences
    我 是 中国 人 。 | Tôi là người Trung Quốc. | 是 | 叫 有 在

Mỗi câu trong "sentences": các từ cách nhau bởi dấu cách | nghĩa | từ khóa (để trống) | 3 phương án nhiễu.
Câu 1–15 → Chọn đáp án; câu 16–30 → Điền đáp án; Sắp xếp câu lấy 15 câu xen kẽ từ cả hai nhóm.

Dùng: python3 scripts/build_content.py
"""
import json
import os
import random
import re
import sys
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'content-src')
OUT = os.path.join(ROOT, 'public', 'content')
HAN = re.compile(r'[㐀-鿿]')
PUNCT = set('，。！？、：；“”‘’（）…—,.!?:; ')

errors = []


def err(where, msg):
    errors.append(f'{where}: {msg}')


def split(line, n, where):
    parts = [p.strip() for p in line.split('|')]
    if len(parts) != n:
        err(where, f'cần {n} cột, có {len(parts)}: {line}')
        parts += [''] * (n - len(parts))
    return parts[:n]


def parse_glossary(path):
    entries = []
    for i, line in enumerate(open(path, encoding='utf-8'), 1):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        han, py, meaning = split(line, 3, f'{os.path.basename(path)}:{i}')
        entries.append({'han': han, 'py': py, 'meaning': meaning})
    return entries


def parse_lesson(path):
    where = os.path.relpath(path, ROOT)
    lesson = {'vocab': [], 'grammar': [], 'texts': [], 'sentences': []}
    section = None
    for i, raw in enumerate(open(path, encoding='utf-8'), 1):
        line = raw.strip()
        loc = f'{where}:{i}'
        if not line or line.startswith('#') and not line.startswith('##'):
            continue
        if line.startswith('== '):
            head = line[3:].strip()
            if head.startswith('text'):
                section = 'text'
                lesson['texts'].append({'title': head[4:].strip() or 'Bài khóa', 'lines': []})
            else:
                section = head
            continue
        if section is None:
            key, _, value = line.partition(':')
            lesson[key.strip()] = value.strip()
        elif section == 'vocab':
            han, py, pos, meaning, ex, ex_vi = split(line, 6, loc)
            lesson['vocab'].append({'han': han, 'py': py, 'pos': pos, 'meaning': meaning, 'example': ex, 'exampleVi': ex_vi})
        elif section == 'grammar':
            if line.startswith('## '):
                lesson['grammar'].append({'title': line[3:].strip(), 'desc': [], 'formula': '', 'examples': []})
            elif line.startswith('f:'):
                lesson['grammar'][-1]['formula'] = line[2:].strip()
            elif line.startswith('ex:'):
                zh, vi = split(line[3:], 2, loc)
                lesson['grammar'][-1]['examples'].append({'han': zh, 'vi': vi})
            else:
                lesson['grammar'][-1]['desc'].append(line)
        elif section == 'text':
            body, vi = split(line, 2, loc)
            who, sep, zh = body.partition(':')
            if not sep:
                who, zh = '', body
            lesson['texts'][-1]['lines'].append({'who': who.strip(), 'han': zh.strip(), 'vi': vi})
        elif section == 'sentences':
            seg, vi, key, dis = split(line, 4, loc)
            tokens = seg.split()
            distractors = dis.split()
            if tokens.count(key) != 1:
                err(loc, f'từ khóa "{key}" phải xuất hiện đúng 1 lần trong: {seg}')
            if len(distractors) != 3 or key in distractors or len(set(distractors)) != 3:
                err(loc, f'cần 3 phương án nhiễu khác nhau và khác đáp án: {dis}')
            lesson['sentences'].append({'tokens': tokens, 'vi': vi, 'key': key, 'distractors': distractors, 'loc': loc})
    return lesson


def deck_slug(name):
    """Giống scripts/xuat_web.py: '03 我是中国人' → 'bai-03'; 'HSK 1 BUỔI 4' → 'buoi-4'."""
    m = re.match(r'^\s*(\d+)', name)
    if m:
        return f'bai-{int(m.group(1)):02d}'
    m = re.search(r'BU[OỔÔ]I\s*(\d+)', name.upper())
    if m:
        return f'buoi-{int(m.group(1))}'
    ascii_name = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', ascii_name.lower()).strip('-') or 'deck'


def canva_embed(url, where):
    """Link xem / nhúng của Canva → link nhúng '.../view?embed'. Không nhận link chỉnh sửa."""
    m = re.match(r'^https://www\.canva\.com/design/([\w-]+)/([\w-]+)/(view|edit|watch)\b', url)
    if not m:
        err(where, f'link Canva không đúng dạng https://www.canva.com/design/…/view: {url}')
        return ''
    if m.group(3) == 'edit':
        err(where, 'đây là link CHỈNH SỬA của Canva – đưa lên web thì ai cũng sửa được thiết kế. '
                   'Trong Canva chọn Chia sẻ → Xem thêm → Nhúng (hoặc "Link chỉ xem") và dán link đó.')
        return ''
    return f'https://www.canva.com/design/{m.group(1)}/{m.group(2)}/view?embed'


def build_practice(lesson, where):
    s = lesson.pop('sentences')
    if len(s) != 30:
        err(where, f'cần đúng 30 câu trong == sentences, có {len(s)}')
    rng = random.Random(lesson['id'])
    choice, fill, order = [], [], []
    for item in s[:15]:
        opts = item['distractors'] + [item['key']]
        rng.shuffle(opts)
        choice.append({'q': ''.join('___' if t == item['key'] else t for t in item['tokens']),
                       'options': opts, 'answer': opts.index(item['key']), 'vi': item['vi']})
    for item in s[15:30]:
        fill.append({'q': ''.join('___' if t == item['key'] else t for t in item['tokens']),
                     'answer': item['key'], 'hint': item['vi']})
    for item in s[0:30:2]:
        words = [t for t in item['tokens'] if not all(c in PUNCT for c in t)]
        end = ''.join(t for t in item['tokens'] if all(c in PUNCT for c in t))
        if len(words) < 2:
            err(item['loc'], 'câu quá ngắn để sắp xếp')
            continue
        shuffled = words[:]
        for _ in range(20):
            rng.shuffle(shuffled)
            if shuffled != words:
                break
        order.append({'words': shuffled, 'answer': words, 'end': end, 'vi': item['vi']})
    lesson['practice'] = {'choice': choice, 'order': order, 'fill': fill}


def check_coverage(texts, dictionary, where):
    longest = max(len(k) for k in dictionary)
    missing = set()
    for text in texts:
        i = 0
        while i < len(text):
            for n in range(min(longest, len(text) - i), 0, -1):
                if text[i:i + n] in dictionary:
                    i += n
                    break
            else:
                if HAN.match(text[i]):
                    missing.add(text[i])
                i += 1
    if missing:
        err(where, 'chưa có pinyin cho chữ: ' + ' '.join(sorted(missing)))


def main():
    courses = json.load(open(os.path.join(SRC, 'courses.json'), encoding='utf-8'))
    glossary = {}
    for g in parse_glossary(os.path.join(SRC, 'glossary-base.txt')):
        glossary.setdefault(g['han'], g)
    lessons_by_course = {}
    for course in courses:
        folder = os.path.join(SRC, course['id'])
        lessons = []
        if os.path.isdir(folder):
            for f in sorted(os.listdir(folder)):
                if f.endswith('.txt'):
                    lesson = parse_lesson(os.path.join(folder, f))
                    lesson['id'] = int(lesson['id'])
                    lesson['decks'] = [deck_slug(n) for n in lesson.pop('slides', '').split(';') if n.strip()]
                    if lesson.get('canva'):
                        lesson['canva'] = canva_embed(lesson['canva'], f'{course["id"]}/{f}')
                    build_practice(lesson, f'{course["id"]}/{f}')
                    lessons.append(lesson)
                    for v in lesson['vocab']:
                        glossary[v['han']] = {'han': v['han'], 'py': v['py'], 'meaning': v['meaning']}
        lessons_by_course[course['id']] = lessons

    for course in courses:
        for lesson in lessons_by_course[course['id']]:
            texts = [lesson['title']] + [v['example'] for v in lesson['vocab']]
            texts += [e['han'] for g in lesson['grammar'] for e in g['examples']]
            texts += [l['han'] for t in lesson['texts'] for l in t['lines']]
            texts += [''.join(c['q'].split('___')) for c in lesson['practice']['choice']]
            texts += [''.join(c['answer']) for c in lesson['practice']['order']]
            check_coverage(texts, glossary, f'{course["id"]}/bài {lesson["id"]}')
            for v in lesson['vocab']:
                n_han = len([c for c in v['han'] if HAN.match(c)])
                erhua = v['han'].endswith('儿') and v['py'].endswith('r') and n_han > 1 and v['py'].split()[-1].lower() not in ('er', 'ér', 'ěr', 'èr')
                if len(v['py'].split()) != n_han - (1 if erhua else 0):
                    err(f'{course["id"]}/bài {lesson["id"]}', f'pinyin của {v["han"]} phải tách theo âm tiết: "{v["py"]}"')

    if errors:
        print('\n'.join(errors))
        print(f'\n{len(errors)} lỗi – chưa ghi file.')
        sys.exit(1)

    os.makedirs(OUT, exist_ok=True)
    index = []
    for course in courses:
        lessons = lessons_by_course[course['id']]
        cdir = os.path.join(OUT, course['id'])
        os.makedirs(cdir, exist_ok=True)
        summary = []
        for lesson in lessons:
            with open(os.path.join(cdir, f'{lesson["id"]}.json'), 'w', encoding='utf-8') as fh:
                json.dump(lesson, fh, ensure_ascii=False, separators=(',', ':'))
            summary.append({'id': lesson['id'], 'title': lesson['title'], 'vi': lesson.get('vi', ''),
                            'words': len(lesson['vocab'])})
        index.append({**course, 'lessons': summary})
    with open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8') as fh:
        json.dump(index, fh, ensure_ascii=False, indent=1)
    with open(os.path.join(OUT, 'glossary.json'), 'w', encoding='utf-8') as fh:
        json.dump(sorted(glossary.values(), key=lambda g: g['han']), fh, ensure_ascii=False, separators=(',', ':'))
    total = sum(len(v) for v in lessons_by_course.values())
    print(f'OK: {len(courses)} cấp, {total} bài, {len(glossary)} từ trong từ điển → {os.path.relpath(OUT, ROOT)}')


if __name__ == '__main__':
    main()
