-- Supports the dashboard's stable date + ID order as registrations grow.
create index if not exists brand_audit_registrations_received_idx
  on public.brand_audit_registrations (created_at desc, id desc);

create index if not exists brand_audit_registrations_payment_received_idx
  on public.brand_audit_registrations (payment_method, created_at desc, id desc);
