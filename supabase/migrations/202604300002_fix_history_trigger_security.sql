alter function public.capture_profile_height_history() security definer;
alter function public.capture_measurement_history() security definer;
alter function public.touch_profile_updated_at_from_measurements() security definer;

alter function public.capture_profile_height_history() set search_path = public, auth;
alter function public.capture_measurement_history() set search_path = public, auth;
alter function public.touch_profile_updated_at_from_measurements() set search_path = public, auth;
