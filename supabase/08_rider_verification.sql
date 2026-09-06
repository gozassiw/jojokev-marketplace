-- RIDER PARTNER VERIFICATION DATA
alter table rider_profiles add column if not exists first_name text;
alter table rider_profiles add column if not exists last_name text;
alter table rider_profiles add column if not exists date_of_birth date;
alter table rider_profiles add column if not exists gender text;
alter table rider_profiles add column if not exists residential_address text;
alter table rider_profiles add column if not exists proof_of_address_path text;
alter table rider_profiles add column if not exists id_type text;
alter table rider_profiles add column if not exists id_photo_path text;
alter table rider_profiles add column if not exists passport_photo_path text;
alter table rider_profiles add column if not exists service_city text;
alter table rider_profiles add column if not exists review_notes text;

insert into storage.buckets (id, name, public) values ('rider-documents', 'rider-documents', false) on conflict (id) do nothing;
