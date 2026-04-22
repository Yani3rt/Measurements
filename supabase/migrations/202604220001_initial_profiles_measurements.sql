create extension if not exists pgcrypto;

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 48),
  sex text not null check (sex in ('female', 'male')),
  height_cm numeric(6, 2) not null check (height_cm between 80 and 260),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_created_at_idx
  on public.profiles (created_at desc, id desc);

create table if not exists public.profile_height_history (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('insert', 'update')),
  previous_height_cm numeric(6, 2),
  height_cm numeric(6, 2) not null check (height_cm between 80 and 260),
  changed_at timestamptz not null default now()
);

create index if not exists profile_height_history_profile_changed_at_idx
  on public.profile_height_history (profile_id, changed_at desc, id desc);

create table if not exists public.measurements (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  measurement_key text not null check (
    measurement_key in (
      'hatSize',
      'neck',
      'shoulderCircumference',
      'bust',
      'underBust',
      'waist',
      'rise',
      'thigh',
      'hips',
      'knee',
      'shoulder',
      'sleeveLength',
      'back',
      'torso',
      'outseam',
      'inseam'
    )
  ),
  value_cm numeric(6, 2) not null check (value_cm between 0 and 400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, measurement_key)
);

create table if not exists public.measurement_history (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  measurement_key text not null check (
    measurement_key in (
      'hatSize',
      'neck',
      'shoulderCircumference',
      'bust',
      'underBust',
      'waist',
      'rise',
      'thigh',
      'hips',
      'knee',
      'shoulder',
      'sleeveLength',
      'back',
      'torso',
      'outseam',
      'inseam'
    )
  ),
  event_type text not null check (event_type in ('insert', 'update', 'delete')),
  previous_value_cm numeric(6, 2),
  value_cm numeric(6, 2),
  changed_at timestamptz not null default now()
);

create index if not exists measurement_history_profile_changed_at_idx
  on public.measurement_history (profile_id, changed_at desc, id desc);

create or replace function public.capture_profile_height_history()
returns trigger
language plpgsql
as $function$
begin
  if tg_op = 'INSERT' then
    insert into public.profile_height_history (
      profile_id,
      event_type,
      previous_height_cm,
      height_cm,
      changed_at
    )
    values (
      new.id,
      'insert',
      null,
      new.height_cm,
      coalesce(new.created_at, now())
    );

    return new;
  elsif tg_op = 'UPDATE' then
    if new.height_cm is distinct from old.height_cm then
      insert into public.profile_height_history (
        profile_id,
        event_type,
        previous_height_cm,
        height_cm,
        changed_at
      )
      values (
        new.id,
        'update',
        old.height_cm,
        new.height_cm,
        now()
      );
    end if;

    return new;
  end if;

  return null;
end;
$function$;

create or replace function public.capture_measurement_history()
returns trigger
language plpgsql
as $function$
begin
  if tg_op = 'INSERT' then
    insert into public.measurement_history (
      profile_id,
      measurement_key,
      event_type,
      previous_value_cm,
      value_cm,
      changed_at
    )
    values (
      new.profile_id,
      new.measurement_key,
      'insert',
      null,
      new.value_cm,
      coalesce(new.created_at, now())
    );

    return new;
  elsif tg_op = 'UPDATE' then
    if new.value_cm is distinct from old.value_cm then
      insert into public.measurement_history (
        profile_id,
        measurement_key,
        event_type,
        previous_value_cm,
        value_cm,
        changed_at
      )
      values (
        new.profile_id,
        new.measurement_key,
        'update',
        old.value_cm,
        new.value_cm,
        now()
      );
    end if;

    return new;
  elsif tg_op = 'DELETE' then
    insert into public.measurement_history (
      profile_id,
      measurement_key,
      event_type,
      previous_value_cm,
      value_cm,
      changed_at
    )
    values (
      old.profile_id,
      old.measurement_key,
      'delete',
      old.value_cm,
      null,
      now()
    );

    return old;
  end if;

  return null;
end;
$function$;

create or replace function public.touch_profile_updated_at_from_measurements()
returns trigger
language plpgsql
as $function$
begin
  if tg_op = 'DELETE' then
    update public.profiles
    set updated_at = now()
    where id = old.profile_id;

    return old;
  end if;

  update public.profiles
  set updated_at = now()
  where id = new.profile_id;

  return new;
end;
$function$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists profiles_capture_height_history on public.profiles;
create trigger profiles_capture_height_history
after insert or update on public.profiles
for each row
execute function public.capture_profile_height_history();

drop trigger if exists measurements_set_updated_at on public.measurements;
create trigger measurements_set_updated_at
before update on public.measurements
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists measurements_capture_history on public.measurements;
create trigger measurements_capture_history
after insert or update or delete on public.measurements
for each row
execute function public.capture_measurement_history();

drop trigger if exists measurements_touch_profile_updated_at on public.measurements;
create trigger measurements_touch_profile_updated_at
after insert or update or delete on public.measurements
for each row
execute function public.touch_profile_updated_at_from_measurements();
