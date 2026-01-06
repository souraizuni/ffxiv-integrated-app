-- ============================================
-- Supabase 資料庫設定腳本
-- 在 Supabase Dashboard 的 SQL Editor 中執行
-- ============================================

-- 啟用 UUID 擴充
create extension if not exists "uuid-ossp";

-- 建立收集物品表
create table if not exists public.collected_items (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  item_id integer not null,
  is_hq boolean default false,
  notes text,
  collected_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- 確保同一使用者不會重複收集相同物品
  unique(user_id, item_id)
);

-- 建立使用者設定表
create table if not exists public.user_settings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade unique not null,
  default_server text default 'Tonberry',
  default_data_center text default 'Elemental',
  crafter_stats jsonb default '[]'::jsonb,
  theme text default 'system',
  language text default 'zh-TW',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 建立製作清單表
create table if not exists public.crafting_lists (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  items jsonb default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 建立索引以提升查詢效能
create index if not exists idx_collected_items_user_id on public.collected_items(user_id);
create index if not exists idx_collected_items_item_id on public.collected_items(item_id);
create index if not exists idx_crafting_lists_user_id on public.crafting_lists(user_id);

-- 設定 Row Level Security (RLS)
alter table public.collected_items enable row level security;
alter table public.user_settings enable row level security;
alter table public.crafting_lists enable row level security;

-- 建立 RLS 政策：使用者只能存取自己的資料
create policy "Users can view their own collected items"
  on public.collected_items for select
  using (auth.uid() = user_id);

create policy "Users can insert their own collected items"
  on public.collected_items for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own collected items"
  on public.collected_items for delete
  using (auth.uid() = user_id);

create policy "Users can view their own settings"
  on public.user_settings for select
  using (auth.uid() = user_id);

create policy "Users can update their own settings"
  on public.user_settings for all
  using (auth.uid() = user_id);

create policy "Users can manage their own crafting lists"
  on public.crafting_lists for all
  using (auth.uid() = user_id);

-- 建立自動更新 updated_at 的觸發器
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create trigger update_user_settings_updated_at
  before update on public.user_settings
  for each row execute function update_updated_at_column();

create trigger update_crafting_lists_updated_at
  before update on public.crafting_lists
  for each row execute function update_updated_at_column();
