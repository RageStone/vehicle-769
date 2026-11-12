import { createClient } from "@supabase/supabase-js";
const required = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "APP_URL",
  "TELEGRAM_SCHEDULER_SECRET",
];
for (const name of required) if (!process.env[name]) throw new Error(`Missing ${name}`);
const url = new URL(process.env.APP_URL);
if (
  url.protocol !== "https:" ||
  url.pathname !== "/" ||
  url.search ||
  url.hash ||
  url.username ||
  url.password
)
  throw new Error("APP_URL must be the deployed HTTPS origin");
if (process.env.TELEGRAM_SCHEDULER_SECRET.length < 32)
  throw new Error("Scheduler secret must contain at least 32 characters");
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await client.rpc("install_telegram_schedule", {
  p_secret: process.env.TELEGRAM_SCHEDULER_SECRET,
  p_url: new URL("/api/public/telegram/process", url).href,
});
if (error) {
  console.error(
    `Scheduler installation failed (${error.code ?? "unknown"}). Check migration 0008 and database logs.`,
  );
  process.exitCode = 1;
} else
  console.log(
    `Installed hourly Telegram schedule (job ${data}). Reports are due at 20:00 Asia/Jerusalem.`,
  );
