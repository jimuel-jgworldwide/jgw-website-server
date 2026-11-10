import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('migration queues emails atomically and concurrent claims/approvals are idempotent', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role;');
    await db.exec(await readFile(new URL('../supabase/001_brand_audit_registrations.sql', import.meta.url), 'utf8'));
    const migration = await readFile(new URL('../supabase/003_payment_review_email.sql', import.meta.url), 'utf8');
    await db.exec(migration); await db.exec(migration);
    const id = 'f97ed9da-b30b-4745-9509-2762a81a317f';
    await db.query(`insert into public.brand_audit_registrations(id,full_name,email,contact_number,company,job_title,brand_name,industry,website_social_links,participants,payment_method,confirm_accuracy,confirm_verification,confirm_policy) values($1,'Test','test@example.test','0000000000','Company','Role','Brand','Technology','example.test','1','GCash',true,true,true)`, [id]);
    assert.equal((await db.query('select * from brand_audit_email_outbox')).rows.length, 1);
    const claims = await Promise.all([db.query("select * from claim_brand_audit_email($1,'receipt')", [id]), db.query("select * from claim_brand_audit_email($1,'receipt')", [id])]);
    assert.equal(claims.reduce((n, r) => n + r.rows.length, 0), 1);
    await db.query("update brand_audit_email_outbox set status='sent' where registration_id=$1", [id]);
    assert.equal((await db.query("select * from claim_brand_audit_email($1,'receipt')", [id])).rows.length, 0);
    await Promise.all([db.query("update brand_audit_registrations set payment_status='approved', reviewed_by=$1 where id=$1 and payment_status='pending'", [id]), db.query("update brand_audit_registrations set payment_status='approved', reviewed_by='00000000-0000-0000-0000-000000000001' where id=$1 and payment_status='pending'", [id])]);
    assert.equal((await db.query("select * from brand_audit_email_outbox where kind='approval'")).rows.length, 1);
    assert.equal((await db.query('select reviewed_by from brand_audit_registrations where id=$1', [id])).rows[0].reviewed_by, id);
    await db.query("update brand_audit_email_outbox set status='failed' where kind='approval'");
    assert.equal((await db.query("select * from claim_brand_audit_email($1,'approval')", [id])).rows.length, 1);
    const shortMigration = await readFile(new URL('../supabase/004_short_registration_form.sql', import.meta.url), 'utf8');
    await db.exec(shortMigration); await db.exec(shortMigration);
    assert.equal((await db.query('select company from brand_audit_registrations where id=$1', [id])).rows[0].company, 'Company');
    await db.query(`insert into public.brand_audit_registrations(id,full_name,email,brand_name,participants,payment_method,confirm_accuracy,confirm_verification,confirm_policy) values('00000000-0000-0000-0000-000000000002','Short form','short@example.test','Business','1','GCash',true,true,true)`);
    assert.equal((await db.query("select contact_number from brand_audit_registrations where email='short@example.test'")).rows[0].contact_number, null);
  } finally { await db.close(); }
});
