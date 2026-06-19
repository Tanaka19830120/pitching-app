-- profiles テーブル（ユーザー情報）
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text not null,
  total_pitches integer default 0,
  streak_days integer default 0,
  last_practiced_at date,
  created_at timestamptz default now()
);

-- 新規ユーザー登録時に自動でprofileを作成するトリガー
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- pitch_records テーブル（練習記録）
create table pitch_records (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  practiced_at date not null,
  max_speed integer not null,
  avg_speed integer,
  total_pitches integer not null,
  strike_count integer default 0,
  pitch_types text[] default '{}',
  memo text,
  xp_gained integer default 0,
  created_at timestamptz default now()
);

-- Row Level Security（自分のデータのみ書き込み・全員読み取り可）
alter table profiles enable row level security;
alter table pitch_records enable row level security;

create policy "誰でも読める" on profiles for select using (true);
create policy "自分だけ更新" on profiles for update using (auth.uid() = id);

create policy "誰でも読める" on pitch_records for select using (true);
create policy "自分だけ書き込める" on pitch_records for insert with check (auth.uid() = user_id);
create policy "自分だけ削除できる" on pitch_records for delete using (auth.uid() = user_id);
