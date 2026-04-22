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
    if exists (
      select 1
      from public.profiles
      where id = old.profile_id
    ) then
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
    end if;

    return old;
  end if;

  return null;
end;
$function$;
