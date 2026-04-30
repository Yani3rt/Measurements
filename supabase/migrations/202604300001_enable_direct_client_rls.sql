alter table public.profiles enable row level security;
alter table public.measurements enable row level security;
alter table public.profile_height_history enable row level security;
alter table public.measurement_history enable row level security;

grant usage on schema public to authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.measurements to authenticated;
grant select on public.profile_height_history to authenticated;
grant select on public.measurement_history to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
  on public.profiles
  for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "measurements_select_own" on public.measurements;
create policy "measurements_select_own"
  on public.measurements
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = measurements.profile_id
        and profiles.user_id = auth.uid()
    )
  );

drop policy if exists "measurements_insert_own" on public.measurements;
create policy "measurements_insert_own"
  on public.measurements
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = measurements.profile_id
        and profiles.user_id = auth.uid()
    )
  );

drop policy if exists "measurements_update_own" on public.measurements;
create policy "measurements_update_own"
  on public.measurements
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = measurements.profile_id
        and profiles.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = measurements.profile_id
        and profiles.user_id = auth.uid()
    )
  );

drop policy if exists "measurements_delete_own" on public.measurements;
create policy "measurements_delete_own"
  on public.measurements
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = measurements.profile_id
        and profiles.user_id = auth.uid()
    )
  );

drop policy if exists "profile_height_history_select_own" on public.profile_height_history;
create policy "profile_height_history_select_own"
  on public.profile_height_history
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = profile_height_history.profile_id
        and profiles.user_id = auth.uid()
    )
  );

drop policy if exists "measurement_history_select_own" on public.measurement_history;
create policy "measurement_history_select_own"
  on public.measurement_history
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = measurement_history.profile_id
        and profiles.user_id = auth.uid()
    )
  );

alter function public.capture_profile_height_history() security definer;
alter function public.capture_measurement_history() security definer;
alter function public.touch_profile_updated_at_from_measurements() security definer;

alter function public.capture_profile_height_history() set search_path = public, auth;
alter function public.capture_measurement_history() set search_path = public, auth;
alter function public.touch_profile_updated_at_from_measurements() set search_path = public, auth;
