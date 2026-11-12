# Telegram alerts

Each user connects their own bot and numeric chat ID in the Telegram settings dialog. Saved bot tokens are AES-GCM encrypted and available only to server code. Reports contain aggregate counts and a link; vehicle details stay behind authentication.

## Local verification

Use Node.js 22. Install dependencies with `npm ci --legacy-peer-deps`, then run `npm test`, `npm run typecheck`, and `npm run build`. Tests use synthetic bot credentials and mocked Telegram/database responses; they do not send messages.

For local development, place private settings in `.env.local` (ignored by git). Copy public Supabase settings from `.env` as needed. Required server settings:

- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_ENCRYPTION_KEY`: a strong random secret; retain the existing value when moving an existing database, or reconnect every bot after changing it.
- `TELEGRAM_SCHEDULER_SECRET`: at least 32 random characters; use the same value in the deployed server and scheduler setup.
- `APP_URL`: the deployed HTTPS origin, such as `https://vehicle-769.lovable.app`.

Never prefix private keys with `VITE_`. Do not put them in tracked `.env` or commit them.

## Deployment and activation

1. Ensure Vault, pg_cron, and pg_net are installed (already present in this live project). Apply missing existing migrations in order, followed by `drizzle/migrations/0008_portable_telegram_scheduler.sql`. On a fresh database, the initial schema in `supabase/migrations` is required before the Drizzle migrations. Do not replay applied migrations on the production database.
2. Set server secrets in the hosting dashboard, deploy the code, and check the protected `/api/public/telegram/process` endpoint rejects an unauthenticated POST with 401.
3. Put the destination Supabase URL, service-role key, APP_URL, and matching scheduler secret into ignored `.env.local`, then run `npm run telegram:setup`. This replaces the shared `personal-telegram-daily` job and stores its bearer secret in Vault rather than the cron command text. The setup does not send messages.
4. In the app, connect a bot, verify its destination, save, and send a test message using the confirmation dialog. Start a private conversation with the bot first, or grant posting rights in the destination group/channel.
5. Enable automatic reporting. The hourly scheduler checks which periods ended at 20:00 Asia/Jerusalem, including daylight-saving changes. Each invocation handles at most 25 accounts, one overdue period per account, so backlog may take several runs.
6. Check the personal delivery history and Supabase Cron/pg_net results. A successful cron enqueue is not proof of HTTP success or Telegram delivery.

## Delivery policy

Only one account/period claim is accepted. A report must transition from claimed to sending and return its persisted ID before Telegram is contacted. Uncertain network delivery or a failed database write after Telegram sends is marked ambiguous when possible and is never automatically retried. A process crash can leave a claimed/sending row; investigate rather than deleting it or blindly resending. Explicit failures are recorded and skipped for that period; fixing a bot enables subsequent periods, not automatic replay of failed messages.

Settings changes and pauses are checked immediately before sending; a Telegram request already in flight cannot be recalled. Saving a changed bot pauses automatic reports until explicitly enabled again. Do not run two independent schedulers against different copies of the database.

## Live verification still required

Local tests cannot prove production migrations, RLS policies, secrets, scheduler installation, actual bot permissions, or delivery. Verify with two test accounts that each account can read only its own settings/history/audit events and cannot access encrypted credentials. Test a real aggregate report before treating alerts as operational. Live account IDs and the encryption key must survive any database migration.
