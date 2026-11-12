-- NULL means signup received and payment proof is still outstanding.
alter table public.brand_audit_registrations
  alter column payment_method drop not null;
notify pgrst, 'reload schema';
