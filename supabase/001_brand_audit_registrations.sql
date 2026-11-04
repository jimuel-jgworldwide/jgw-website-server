-- Run once in the Supabase SQL Editor for the project in .env.example.
-- The API uses a server-only Supabase secret key. Public visitors have no table access.
create table if not exists public.brand_audit_registrations (
  id uuid primary key,
  created_at timestamptz not null default now(),
  full_name text not null check (char_length(full_name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254),
  contact_number text not null check (char_length(contact_number) between 7 and 40),
  company text not null check (char_length(company) between 1 and 160),
  job_title text not null check (char_length(job_title) between 1 and 120),
  brand_name text not null check (char_length(brand_name) between 1 and 160),
  industry text not null,
  industry_other text,
  website_social_links text not null,
  participants text not null check (participants in ('1', '2', '3+')),
  additional_participants text,
  payment_method text not null check (payment_method in ('GCash', 'Bank transfer', 'On-site')),
  proof_path text,
  confirm_accuracy boolean not null check (confirm_accuracy),
  confirm_verification boolean not null check (confirm_verification),
  confirm_policy boolean not null check (confirm_policy)
);

alter table public.brand_audit_registrations enable row level security;
revoke all on public.brand_audit_registrations from anon, authenticated;
grant select, insert, update, delete on public.brand_audit_registrations to service_role;
