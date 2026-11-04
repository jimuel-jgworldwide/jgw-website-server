# Brand Audit submission API

This is a small Next.js API for the Brand Audit form already embedded in Webflow. Vercel runs `POST /api/register`; Supabase stores the registration and an optional payment receipt. The form remains in `../jgw-brand-audit-webflow-embed.html`.

## One-time Supabase setup

1. In the Supabase project at `https://dmhcuxukzjwhwglfbsbl.supabase.co`, run [`supabase/001_brand_audit_registrations.sql`](supabase/001_brand_audit_registrations.sql) in the SQL Editor. This creates the registration table with Row Level Security enabled and no public read/write grant.
2. In Supabase Storage, create a **private** bucket named `brand-audit-proofs`. Set its maximum file size to **3 MB** and allow `image/png`, `image/jpeg`, `image/webp`, and `application/pdf`. Do not make receipts public.
3. From Supabase API Keys, copy a server-only **secret** key (`sb_secret_...`). Put it in Vercel as `SUPABASE_SECRET_KEY`. Do not put it in Webflow, in a `NEXT_PUBLIC_` variable, or in source control. The publishable key supplied for this project is valid for browser clients, but this API does not need it.

## Vercel settings

Deploy the `brand-audit-api-vercel` folder as the Vercel project's **Root Directory**. Add these environment variables for Production and any Preview deployment you plan to test:

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | `https://dmhcuxukzjwhwglfbsbl.supabase.co` |
| `SUPABASE_SECRET_KEY` | Your server-only Supabase secret key |
| `ALLOWED_ORIGINS` | Comma-separated exact Webflow origins, e.g. `https://www.jgworldwide.ph,https://jgworldwide.ph,https://jgwebsite.webflow.io` |

After deploying, set `data-api-url` on the `<form>` in `../jgw-brand-audit-webflow-embed.html` to `https://YOUR-VERCEL-DOMAIN/api/register`, then paste the updated embed into Webflow and publish that page. The empty value is deliberate: until you set it, the button cannot transmit a registration.

## Checks

Run `npm test` and `npm run build` from this folder. After configuration, submit one test registration from the published Webflow page. Confirm its row appears in `brand_audit_registrations`; if you include a receipt, confirm it appears only in the private `brand-audit-proofs` bucket. The API returns a registration ID but no personal details.

Receipts are limited to 3 MB because Vercel Functions limit the whole request body to 4.5 MB. The API checks the file signature as well as the declared type. On a database failure after upload, it attempts to remove the uploaded receipt.

Payment verification and confirmation messages remain manual. The GCash QR image is not included in the Webflow embed because the screenshot did not provide a reusable source asset.

## Rollback

To pause new registrations, clear the form's `data-api-url` in Webflow and republish. Existing Supabase rows and receipts remain intact. Do not drop the table or bucket as part of a form rollback.
