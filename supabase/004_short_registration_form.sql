-- Apply before deploying the shorter form/backend. Existing values are preserved.
begin;
alter table public.brand_audit_registrations
  alter column contact_number drop not null,
  alter column company drop not null,
  alter column job_title drop not null,
  alter column industry drop not null,
  alter column website_social_links drop not null;
commit;
notify pgrst, 'reload schema';
-- Rollback requires collecting missing historical values before restoring NOT NULL.
