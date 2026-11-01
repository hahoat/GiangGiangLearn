"""Quản lý tài khoản học viên trong Cloudflare D1: tài khoản = số điện thoại, mật khẩu mặc định 12345678.

Danh sách học viên là một file văn bản, mỗi dòng một người (dòng bắt đầu bằng # bị bỏ qua):
    0912345678 | Nguyễn Văn An
    0987654321
File này chứa số điện thoại học viên → đặt tên hoc_vien*.txt (git đã bỏ qua), không đưa lên mạng.

Dùng:
    python3 scripts/tao_tai_khoan.py hoc_vien.txt               tạo tài khoản (người đã có thì bỏ qua)
    python3 scripts/tao_tai_khoan.py --dat-lai 0912345678 ...   đặt lại mật khẩu về 12345678 (quên mật khẩu)
    python3 scripts/tao_tai_khoan.py --xoa 0912345678 ...       xóa tài khoản và tiến độ học
    python3 scripts/tao_tai_khoan.py --danh-sach                xem danh sách tài khoản

Cần: Account ID (Cloudflare → R2 / Workers, cột bên phải) và một API token có quyền D1 → Edit
(Cloudflare → My Profile → API Tokens → Create Token → Custom token → Permissions: Account · D1 · Edit).
Token chỉ nhập vào Terminal khi chạy, không lưu ra file. database_id được đọc từ wrangler.jsonc.
"""
import base64
import getpass
import hashlib
import json
import os
import re
import secrets
import sys
import urllib.error
import urllib.request

DEFAULT_PASSWORD = '12345678'
PBKDF2_ITER = 100000   # phải giống worker/index.js
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SCHEMA = [   # giống SCHEMA trong worker/index.js – để script chạy được cả trước lần mở web đầu tiên
    """CREATE TABLE IF NOT EXISTS users (
         id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT NOT NULL UNIQUE, name TEXT NOT NULL DEFAULT '',
         password TEXT NOT NULL, fails INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0,
         created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)""",
    """CREATE TABLE IF NOT EXISTS progress (
         user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, data TEXT NOT NULL,
         updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)""",
    "CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
]


def normalize_phone(raw):
    d = re.sub(r'\D', '', raw)
    if d.startswith('84') and len(d) >= 11:
        d = '0' + d[2:]
    return d if re.fullmatch(r'0\d{9,10}', d) else None


def hash_password(password):
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, PBKDF2_ITER)
    return f'pbkdf2${PBKDF2_ITER}${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}'


def database_id():
    text = open(os.path.join(ROOT, 'wrangler.jsonc'), encoding='utf-8').read()
    m = re.search(r'"database_id"\s*:\s*"([0-9a-f-]{36})"', text)
    if not m:
        sys.exit('Chưa điền database_id của D1 vào wrangler.jsonc.')
    return m.group(1)


class D1:
    def __init__(self, account, db, token):
        self.url = f'https://api.cloudflare.com/client/v4/accounts/{account}/d1/database/{db}/query'
        self.token = token

    def query(self, sql, *params):
        req = urllib.request.Request(self.url, method='POST', data=json.dumps({'sql': sql, 'params': list(params)}).encode(),
                                     headers={'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.loads(r.read())
        except urllib.error.HTTPError as e:
            try:
                data = json.loads(e.read())
            except ValueError:
                sys.exit(f'Lỗi Cloudflare {e.code}.')
        if not data.get('success'):
            msg = '; '.join(err.get('message', '') for err in data.get('errors', []))
            sys.exit(f'Lỗi Cloudflare: {msg}\n(Kiểm tra Account ID, API token có quyền D1 Edit, database_id trong wrangler.jsonc)')
        return data['result'][0]


def read_list(path):
    people, bad = [], []
    for i, line in enumerate(open(path, encoding='utf-8'), 1):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        phone, _, name = line.partition('|')
        p = normalize_phone(phone)
        if p:
            people.append((p, name.strip()))
        else:
            bad.append(f'  dòng {i}: "{line}"')
    if bad:
        print('Bỏ qua các dòng có số điện thoại không hợp lệ:\n' + '\n'.join(bad))
    return people


def main():
    args = sys.argv[1:]
    if not args or args[0] in ('-h', '--help'):
        sys.exit(__doc__)
    mode = args[0] if args[0].startswith('--') else 'tao'
    if mode not in ('tao', '--dat-lai', '--xoa', '--danh-sach'):
        sys.exit(__doc__)
    if mode == 'tao':
        people = read_list(args[0])
    elif mode == '--danh-sach':
        people = []
    else:
        people = [(normalize_phone(a), '') for a in args[1:]]
        if not people or not all(p for p, _ in people):
            sys.exit(f'Số điện thoại không hợp lệ. Ví dụ: {mode} 0912345678')
    if mode != '--danh-sach' and not people:
        sys.exit('Danh sách trống.')

    db_id = database_id()
    account = input('Account ID: ').strip()
    token = getpass.getpass('API token (gõ sẽ không hiện): ').strip()
    db = D1(account, db_id, token)
    for sql in SCHEMA:
        db.query(sql)

    if mode == '--danh-sach':
        rows = db.query('SELECT phone, name, created_at FROM users ORDER BY created_at')['results']
        for r in rows:
            print(f"{r['phone']}  {r['name']:<30} tạo {r['created_at']}")
        print(f'Tổng: {len(rows)} tài khoản')
        return

    ok = skipped = 0
    for phone, name in people:
        if mode == 'tao':
            changes = db.query('INSERT INTO users (phone, name, password) VALUES (?, ?, ?) ON CONFLICT (phone) DO NOTHING',
                               phone, name, hash_password(DEFAULT_PASSWORD))['meta']['changes']
        elif mode == '--dat-lai':
            changes = db.query('UPDATE users SET password = ?, fails = 0, locked_until = 0 WHERE phone = ?',
                               hash_password(DEFAULT_PASSWORD), phone)['meta']['changes']
        else:
            db.query('DELETE FROM progress WHERE user_id IN (SELECT id FROM users WHERE phone = ?)', phone)
            changes = db.query('DELETE FROM users WHERE phone = ?', phone)['meta']['changes']
        if changes:
            print(f'✓ {phone} {name}'); ok += 1
        else:
            print(f'– {phone}: ' + ('đã có tài khoản, bỏ qua' if mode == 'tao' else 'chưa có tài khoản')); skipped += 1

    label = {'tao': f'Tạo mới (mật khẩu {DEFAULT_PASSWORD})', '--dat-lai': f'Đặt lại mật khẩu về {DEFAULT_PASSWORD}', '--xoa': 'Đã xóa'}[mode]
    print(f'\n{label}: {ok} · Bỏ qua: {skipped}')


if __name__ == '__main__':
    main()
