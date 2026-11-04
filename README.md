# Brand Audit API and admin

This Next.js app serves `POST /api/register` for the Brand Audit form embedded in Webflow and a private, read-only admin at `/admin`. Supabase stores registrations and optional payment receipts. The form remains in `../jgw-brand-audit-webflow-embed.html`.

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

After deploying, open `https://YOUR-VERCEL-DOMAIN/admin`. The admin lists 25 submissions per page; each entry has a detail page and, when supplied, a protected proof download. Sessions last up to one hour, after which the admin signs in again. The pages are server-rendered and are never intended as public links.

The Webflow form's `data-api-url` must point to `https://YOUR-VERCEL-DOMAIN/api/register`. The current embed already points to the deployed JGW Vercel domain.

## Checks

Run `npm test` and `npm run build` from this folder. After configuration, submit one test registration from the published Webflow page. Confirm its row appears at `/admin`; if you include a receipt, confirm its download requires admin sign-in. The API returns a registration ID but no personal details.

Receipts are limited to 3 MB because Vercel Functions limit the whole request body to 4.5 MB. The API checks the file signature as well as the declared type. On a database failure after upload, it attempts to remove the uploaded receipt.

Payment verification and confirmation messages remain manual. The approved GCash QR image is linked from the Webflow embed.

## Rollback

To pause new registrations, clear the form's `data-api-url` in Webflow and republish. Existing Supabase rows and receipts remain intact. Do not drop the table or bucket as part of a form rollback.
