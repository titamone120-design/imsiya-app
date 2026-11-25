alter table public.orders
  add column if not exists delivery_full_name text,
  add column if not exists delivery_phone text,
  add column if not exists delivery_county text,
  add column if not exists delivery_town text,
  add column if not exists delivery_address text,
  add column if not exists delivery_notes text;

alter table public.orders
  drop constraint if exists orders_delivery_fields_length_check;
alter table public.orders
  add constraint orders_delivery_fields_length_check
  check (
    (delivery_full_name is null or char_length(delivery_full_name) <= 120) and
    (delivery_phone is null or char_length(delivery_phone) <= 40) and
    (delivery_county is null or char_length(delivery_county) <= 100) and
    (delivery_town is null or char_length(delivery_town) <= 120) and
    (delivery_address is null or char_length(delivery_address) <= 500) and
    (delivery_notes is null or char_length(delivery_notes) <= 1000)
  );