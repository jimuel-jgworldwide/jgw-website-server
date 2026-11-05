# Brand Audit API and admin

The current Webflow embed is versioned at [`webflow/jgw-brand-audit-webflow-embed.html`](webflow/jgw-brand-audit-webflow-embed.html). Paste this file into Webflow separately when publishing form changes; deploying the Next.js app does not update the Webflow page.

This Next.js app serves `POST /api/register` for the Brand Audit form embedded in Webflow and a private payment-review admin at `/admin`. Supabase stores registrations, private payment receipts, review status, and queued email jobs. The form remains in `../jgw-brand-audit-webflow-embed.html`.

## One-time Supabase setup

1. In the Supabase project at `https://dmhcuxukzjwhwglfbsbl.supabase.co`, run [`supabase/001_brand_audit_registrations.sql`](supabase/001_brand_audit_registrations.sql) in the SQL Editor. This creates the registration table with Row Level Security enabled and no public read/write grant.
2. In Supabase Storage, create a **private** bucket named `brand-audit-proofs`. Set its maximum file size to **3 MB** and allow `image/png`, `image/jpeg`, `image/webp`, and `application/pdf`. Do not make receipts public.
3. From Supabase API Keys, copy a server-only **secret** key (`sb_secret_...`). Put it in Vercel as `SUPABASE_SECRET_KEY`. Do not put it in Webflow, in a `NEXT_PUBLIC_` variable, or in source control.
4. In Supabase Authentication → Users, create an email/password user for each admin. Copy each user's **User UID** into `ADMIN_USER_IDS` in Vercel, separated by commas. The admin sign-in uses Supabase Auth, but only listed user IDs can view registrations.

## Vercel settings

Deploy the `brand-audit-api-vercel` folder as the Vercel project's **Root Directory**. Add these environment variables for Production and any Preview deployment you plan to test:

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | `https://dmhcuxukzjwhwglfbsbl.supabase.co` |
| `SUPABASE_SECRET_KEY` | Your server-only Supabase secret key |
| `SUPABASE_PUBLISHABLE_KEY` | The project's `sb_publishable_...` key, used by the server for admin sign-in |
| `ADMIN_USER_IDS` | Comma-separated Supabase Auth User UIDs allowed into `/admin` |
| `ALLOWED_ORIGINS` | Comma-separated exact Webflow origins, e.g. `https://www.jgworldwide.ph,https://jgworldwide.ph,https://jgwebsite.webflow.io` |

After deploying, open `https://YOUR-VERCEL-DOMAIN/admin`. The admin has search, payment filters, and 25/50/100 rows per page. Brand names and View buttons open a dialog with the full registration and protected proof download; the table remains in place. Existing detail URLs still work. Navigation, forms, refresh, and downloads show progress; route transitions include a skeleton. The workshop fee is ₱1,000 per head. The Webflow form shows a success dialog only after the API confirms a saved registration.

Admin sessions use persistent HttpOnly cookies (30-day browser retention) and Supabase refresh tokens. Active sessions refresh on requests and while the page is active. Supabase session expiry/revocation policies still apply. Signed-in visitors are redirected away from `/admin/login`, including after browser Back. Users signed in with the previous access-token-only version should sign out and back in once after upgrading.

Each browser/device receives its own session even when using the same account. Signing out uses Supabase's **local** scope, leaving other devices signed in. In Supabase Auth session settings, keep **Single session per user** disabled for shared-account use. Same-browser tabs share the session and recheck it on focus. No credentials or registration data are placed in localStorage.

Run [`supabase/002_admin_pagination.sql`](supabase/002_admin_pagination.sql) in the Supabase SQL Editor to add indexes for the dashboard's stable date/ID ordering and payment filter. It does not modify existing entries. Search runs on the server, and only one page of records is sent to the browser.

The Webflow form's `data-api-url` must point to `https://YOUR-VERCEL-DOMAIN/api/register`. The current embed already points to the deployed JGW Vercel domain.

## Checks

Run `npm test` and `npm run build` from this folder. After configuration, submit one test registration from the published Webflow page. Confirm its row appears at `/admin`; if you include a receipt, confirm its download requires admin sign-in. The API returns a registration ID but no personal details.

After building, run `node scripts/verify-admin-http.mjs` for an HTTP integration check. It starts local mock Auth/database services, checks sign-in/refresh/redirects/pagination and independent browser logout, then stops the processes. It never uses production registrations. It requires local port 8876.

Receipts are limited to 3 MB because Vercel Functions limit the whole request body to 4.5 MB. The API checks the file signature as well as the declared type. On a database failure after upload, it attempts to remove the uploaded receipt.

Payment verification is manual. Admins preview image/PDF proofs and explicitly approve full payment; approval queues an automatic confirmation email. Registration receipt emails are queued automatically on submission. Failed/unsent email jobs can be retried from the entry panel. The approved GCash QR image is linked from the Webflow embed.

Before deploying payment review, run `supabase/003_payment_review_email.sql`. Configure Gmail using [GMAIL_SETUP.md](GMAIL_SETUP.md); it documents the app-password setup, existing-mailbox costs and quotas, receiving replies, and testing. Until Gmail is configured, emails stay queued. Existing entries start pending and are not automatically emailed receipts.

## Rollback

To pause new registrations, clear the form's `data-api-url` in Webflow and republish. Existing Supabase rows and receipts remain intact. Do not drop the table or bucket as part of a form rollback.
