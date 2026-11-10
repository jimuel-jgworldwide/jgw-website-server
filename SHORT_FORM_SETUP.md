# Short registration form

Apply `supabase/004_short_registration_form.sql` in the destination Supabase SQL Editor before deploying this backend and publishing `webflow/jgw-brand-audit-webflow-embed.html` in Webflow.

New visitors enter full name, email, and business name, followed by GCash/bank payment and the registration agreements. Each short-form submission registers one person at ₱1,000 per head. Payment proof remains optional as before; admin approval still requires payment verification.

The migration permits NULL in removed fields without deleting old records. The API still validates older, longer submissions where those fields are supplied. Existing registrations and their participant counts stay intact. Apply earlier migrations 001–003 first if setting up a new database.
