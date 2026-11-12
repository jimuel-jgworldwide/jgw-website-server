# Short registration form

Apply `supabase/004_short_registration_form.sql` in the destination Supabase SQL Editor before deploying this backend and publishing `webflow/jgw-brand-audit-webflow-embed.html` in Webflow.

New visitors enter full name, email, and business name, followed by GCash/bank payment and the registration agreements. Each short-form submission registers one person at ₱1,000 per head. Payment proof remains optional as before; admin approval still requires payment verification.

The migration permits NULL in removed fields without deleting old records. The API still validates older, longer submissions where those fields are supplied. Existing registrations and their participant counts stay intact. Apply earlier migrations 001–003 first if setting up a new database.

For the signup-first flow, also apply `supabase/005_deferred_payment.sql` before deploying and publishing. New signups enter three details and accept the agreement. The receipt email links to the payment instructions and private proof upload. Set up Gmail and the private `brand-audit-proofs` bucket before publishing. The link uses the existing production backend URL unless `BRAND_AUDIT_PUBLIC_URL` is set. Rotating the Supabase secret invalidates links signed with the old key.

Test a signup, receipt email, proof upload, and admin approval before opening the form to the public. Failed payment emails can be retried in the registration details. If rolling back, restore the older Webflow embed and keep the migration in place so pending signup rows remain intact. Keep the new backend available while emailed upload links are in use.
