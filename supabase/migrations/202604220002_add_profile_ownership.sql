alter table public.profiles
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists profiles_user_id_created_at_idx
  on public.profiles (user_id, created_at desc, id desc);
