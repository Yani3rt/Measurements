create or replace function public.touch_profile_updated_at_from_measurements()
returns trigger
language plpgsql
as $function$
begin
  update public.profiles
  set updated_at = now()
  where id = new.profile_id;

  return new;
end;
$function$;

drop trigger if exists measurements_touch_profile_updated_at on public.measurements;
create trigger measurements_touch_profile_updated_at
after insert or update on public.measurements
for each row
execute function public.touch_profile_updated_at_from_measurements();
