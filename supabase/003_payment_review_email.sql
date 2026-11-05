begin;
alter table public.brand_audit_registrations
  add column if not exists payment_status text not null default 'pending' check (payment_status in ('pending','approved')),
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid;

create table if not exists public.brand_audit_email_outbox (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.brand_audit_registrations(id) on delete cascade,
  kind text not null check (kind in ('receipt','approval')),
  status text not null default 'queued' check (status in ('queued','sending','sent','failed')),
  attempts integer not null default 0,
  lease_token uuid,
  claimed_at timestamptz,
  sent_at timestamptz,
  last_error text,
  unique (registration_id, kind)
);
alter table public.brand_audit_email_outbox enable row level security;
revoke all on public.brand_audit_email_outbox from anon, authenticated;
grant all on public.brand_audit_email_outbox to service_role;

create or replace function public.queue_brand_audit_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.brand_audit_email_outbox(registration_id,kind) values(new.id,'receipt') on conflict do nothing;
  elsif new.payment_status = 'approved' and old.payment_status is distinct from 'approved' then
    insert into public.brand_audit_email_outbox(registration_id,kind) values(new.id,'approval') on conflict do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists brand_audit_email_events on public.brand_audit_registrations;
create trigger brand_audit_email_events after insert or update of payment_status on public.brand_audit_registrations
for each row execute function public.queue_brand_audit_email();

create or replace function public.claim_brand_audit_email(registration uuid, email_kind text)
returns setof public.brand_audit_email_outbox
language sql security definer set search_path = '' as $$
  update public.brand_audit_email_outbox set status='sending', attempts=attempts+1,
    lease_token=gen_random_uuid(), claimed_at=now(), last_error=null
  where id in (
    select id from public.brand_audit_email_outbox
    where registration_id=registration and kind=email_kind
      and (status in ('queued','failed') or (status='sending' and claimed_at < now()-interval '5 minutes'))
    limit 1 for update skip locked
  ) returning *;
$$;
revoke all on function public.queue_brand_audit_email() from public, anon, authenticated;
revoke all on function public.claim_brand_audit_email(uuid,text) from public, anon, authenticated;
grant execute on function public.claim_brand_audit_email(uuid,text) to service_role;
create index if not exists brand_audit_review_idx on public.brand_audit_registrations(payment_status, created_at desc, id desc);
commit;
notify pgrst, 'reload schema';
