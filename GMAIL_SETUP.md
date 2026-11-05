# Gmail setup for hello@jgworldwide.ph

This app sends through your existing Google Workspace Gmail mailbox. Nodemailer is free software and this approach needs no separate paid email service. Your existing Workspace subscription and Vercel/Supabase usage limits still apply; a custom-domain Google Workspace mailbox itself is not a free Gmail account. Gmail is not an unlimited bulk-email service.

Emails go to the registration's Email Address field. Additional participants only supply names, so they do not receive separate emails.

## Setup

1. Run `supabase/003_payment_review_email.sql` in your Supabase project's SQL Editor, after migration 001. It adds payment-review columns and a private email outbox. Existing registrations start as pending; old registrations do not automatically receive receipt emails.
2. Sign into Google as **hello@jgworldwide.ph**. Open [Google Account Security](https://myaccount.google.com/security) and enable **2-Step Verification**.
3. Open [App passwords](https://myaccount.google.com/apppasswords). Create one named **JGW Brand Audit Vercel**. Copy the generated app password. If this option is unavailable, ask the Workspace administrator whether app passwords are permitted. Google policy or Advanced Protection can block them; OAuth is the alternative, requiring a different setup.
4. In Vercel → project → Settings → Environment Variables, add the following to Production (and Preview only if needed):

   ```text
   GMAIL_USER=hello@jgworldwide.ph
   GMAIL_APP_PASSWORD=the-generated-app-password
   ```

   Keep the existing Supabase URL, secret key, publishable key, admin IDs and allowed origins. Do not put the app password in Webflow, a NEXT_PUBLIC variable, Git, or this chat. Use the generated app password, not the normal Gmail login password.
5. Push/redeploy the updated Next.js app. SMTP is fixed to `smtp.gmail.com`, port **465**, with TLS. No Gmail API project or billing account is required for this SMTP configuration.
6. Submit one test registration using an address you control. It should receive a registration receipt, which explicitly says the slot is awaiting verification. In `/admin`, open the entry and check its email status.
7. Preview the proof, verify the actual payment and amount, tick the review checkbox, and approve. Approval saves the reviewer UID/time and queues a separate confirmation email. For 3+ participants, verify the exact headcount manually; the app does not guess a total from the “3+” choice.
8. Reply to the test email. That reply arrives in the **hello@jgworldwide.ph Gmail inbox** because sender and reply-to use this mailbox. The admin app does not read or synchronize your Gmail inbox. Sent automated messages can be checked in Gmail Sent Mail.

## How sending and retries work

- New registration: a database trigger creates one receipt-email job atomically with the registration; the API attempts delivery immediately.
- Payment approval: a conditional database update changes pending to approved only once, and its trigger creates one approval job. Two admins clicking together cannot create two approval jobs or overwrite the first reviewer.
- Missing Gmail settings or a sending failure never deletes the registration or reverses approval. Open the entry and use **Retry email** after fixing the setup. A historical entry can receive a receipt via **Send email**.
- A database claim prevents simultaneous admins from sending the same job together. Sent jobs are not resent. Stale “sending” jobs can be retried after five minutes. Retries are manual; there is no paid queue or scheduled worker.
- SMTP acceptance is not proof of inbox delivery. In a rare timeout/crash after Gmail accepts a message, delivery can be uncertain; check Sent Mail before retrying. SMTP does not provide guaranteed exactly-once delivery.
- Proofs stay private and are never attached to outgoing emails. Preview/download routes still require admin sign-in.

## Limits and cost

Google documents a standard Workspace limit of up to **2,000 messages per user per day**, with lower limits for trial accounts and other account restrictions. Other mailbox activity counts too. This workflow normally sends **two messages per registration** across receipt and approval, so plan below the mailbox limit. Google can block suspicious traffic or temporarily suspend sending after limits are hit.

If you change the Google password, Google may revoke app passwords; generate a replacement and update Vercel. If authentication fails, check the app password, Workspace policy, and Gmail security notices. If the daily quota is exhausted, wait for the quota to reset before retrying jobs.

Sources: [Google app passwords](https://support.google.com/mail/answer/185833), [Google SMTP setup](https://support.google.com/a/answer/176600), [Workspace sending limits](https://support.google.com/a/answer/166852), [Nodemailer Gmail guidance](https://nodemailer.com/usage/using-gmail/).
