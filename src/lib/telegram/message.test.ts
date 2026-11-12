import { it } from "node:test";
import { strictEqual, ok } from "node:assert";
import { detailedReportMessage, splitTelegramReport } from "./message";
import { reportMessage } from "./domain";
const period = { start: "2026-11-12T18:00:00Z", end: "2026-11-12T19:00:00Z" };
const event = {
  vehicle_id: "v",
  event_type: "inspection_insert",
  occurred_at: "2026-11-12T18:54:00Z",
  changed_fields: ["status", "fit_ok", "user_id", "ciphertext"],
  before_values: {
    status: "unfit",
    fit_ok: false,
    user_id: "private-account",
    ciphertext: "private-token",
  },
  after_values: { status: "ok", fit_ok: true },
};
it("Telegram contains actual vehicle identity and clear before and after values", () => {
  const message = detailedReportMessage(
    reportMessage(period, { changes_count: 1, vehicles_count: 1, tests_count: 1 }),
    [event],
    { v: { number: "507338", name: "ג׳יפ רנגלר" } },
    "https://vehicle.example",
  );
  ok(message.includes("507338 — ג׳יפ רנגלר"));
  ok(message.includes("לפני: לא כשיר"));
  ok(message.includes("אחרי: תקין"));
  ok(message.includes("אחרי: כשיר ✅"));
  strictEqual(message.includes("private-account"), false);
  strictEqual(message.includes("private-token"), false);
  ok(message.endsWith("https://vehicle.example"));
});
it("long detailed reports retain all vehicles in numbered Telegram-safe messages", () => {
  const text = Array.from({ length: 100 }, (_, i) => `רכב ${i}: ${"בדיקה ✅ ".repeat(35)}`).join(
    "\n\n",
  );
  const parts = splitTelegramReport(text);
  ok(parts.length > 1);
  ok(parts.every((p) => p.length <= 4096));
  for (let i = 0; i < 100; i++) ok(parts.join("\n").includes(`רכב ${i}:`));
  ok(parts[0].startsWith(`📄 חלק 1 מתוך ${parts.length}`));
});
it("long individual fields split without broken emoji surrogate pairs", () => {
  const parts = splitTelegramReport("🚙".repeat(5000));
  strictEqual(parts.join("").match(/🚙/gu)?.length, 5000);
  ok(parts.every((p) => p.length <= 4096));
  ok(parts.every((p) => !/[\uD800-\uDBFF]$/.test(p)));
});
it("empty reports stay concise", () => {
  const summary = reportMessage(period, { changes_count: 0, vehicles_count: 0, tests_count: 0 });
  strictEqual(detailedReportMessage(summary, [], {}, "https://example.com"), summary);
});
