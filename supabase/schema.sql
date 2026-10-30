-- Chạy một lần trong Supabase → SQL Editor.
-- Mỗi học viên có đúng một dòng chứa tiến độ (bước đã học, lịch ôn tập, XP) dạng JSON.
create table if not exists public.progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Bảo mật theo dòng: mỗi người chỉ đọc/ghi được dữ liệu của chính mình.
alter table public.progress enable row level security;

drop policy if exists "Đọc tiến độ của mình" on public.progress;
create policy "Đọc tiến độ của mình" on public.progress
  for select using (auth.uid() = user_id);

drop policy if exists "Tạo tiến độ của mình" on public.progress;
create policy "Tạo tiến độ của mình" on public.progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "Sửa tiến độ của mình" on public.progress;
create policy "Sửa tiến độ của mình" on public.progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
