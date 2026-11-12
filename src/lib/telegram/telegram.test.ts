import { describe, it } from "node:test";
import { deepStrictEqual, strictEqual, rejects, ok } from "node:assert";
import {
  atIsrael20,
  eligibleEvents,
  nextDuePeriod,
  reportPeriod,
  reportMessage,
  summarize,
} from "./domain";
import { encryptToken, decryptToken } from "./crypto.server";
import { verifyDestination, sendMessage, TelegramFailure } from "./api.server";
// A synthetic encryption key is scoped to this isolated test process.
process.env.TELEGRAM_ENCRYPTION_KEY = "synthetic-encryption-key-for-tests-only";
const event = (
  id: string,
  vehicle: string,
  owner: string,
  time = "2026-11-08T17:00:00.000Z",
  kind = "vehicle_update",
) => ({ id, vehicle_id: vehicle, owner_at_event: owner, occurred_at: time, event_type: kind });
describe("personal Telegram rules", () => {
  it("Israel daily delivery is 20:00, including winter and summer", () => {
    strictEqual(atIsrael20("2026-11-08"), "2026-11-08T18:00:00.000Z");
    strictEqual(atIsrael20("2026-07-08"), "2026-07-08T17:00:00.000Z");
  });
  it("spring and autumn reporting intervals follow local days, not 24 hours", () => {
    const spring = { start: atIsrael20("2026-03-26"), end: atIsrael20("2026-03-27") };
    const autumn = { start: atIsrael20("2026-10-24"), end: atIsrael20("2026-10-25") };
    strictEqual((Date.parse(spring.end) - Date.parse(spring.start)) / 3600000, 23);
    strictEqual((Date.parse(autumn.end) - Date.parse(autumn.start)) / 3600000, 25);
  });
  it("20:00 inclusive start and exclusive end", () => {
    const p = reportPeriod(new Date("2026-11-08T18:00:00Z"));
    const events = [event("start", "a", "A", p.start), event("end", "a", "A", p.end)];
    deepStrictEqual(
      eligibleEvents(events, "A", new Map([["a", "A"]]), p.start, p.end).map((e) => e.id),
      ["start"],
    );
  });
  it("A and B reports follow vehicle ownership, not editor identity", () => {
    const events = [{ ...event("1", "a", "A"), actor_id: "B" }, event("2", "b", "B")];
    const owners = new Map([
      ["a", "A"],
      ["b", "B"],
    ]);
    deepStrictEqual(
      eligibleEvents(events, "A", owners, "2026-11-07", "2026-11-09").map((e) => e.id),
      ["1"],
    );
    deepStrictEqual(
      eligibleEvents(events, "B", owners, "2026-11-07", "2026-11-09").map((e) => e.id),
      ["2"],
    );
  });
  it("ownership transfer excludes former owner and does not disclose old history to new owner", () => {
    const events = [event("1", "a", "A"), event("2", "a", "B")],
      owners = new Map([["a", "B"]]);
    strictEqual(eligibleEvents(events, "A", owners, "2026-11-07", "2026-11-09").length, 0);
    deepStrictEqual(
      eligibleEvents(events, "B", owners, "2026-11-07", "2026-11-09").map((e) => e.id),
      ["2"],
    );
  });
  it("deleted vehicle events remain isolated to final owner", () => {
    strictEqual(
      eligibleEvents([event("1", "deleted", "A")], "B", new Map(), "2026-11-07", "2026-11-09")
        .length,
      0,
    );
  });
  it("every real event counts, distinct vehicles are deduplicated, only new tests count as performed", () => {
    deepStrictEqual(
      summarize([
        event("1", "a", "A"),
        event("2", "a", "A", undefined, "inspection_insert"),
        event("3", "b", "A", undefined, "inspection_delete"),
      ]),
      { changes_count: 3, vehicles_count: 2, tests_count: 1 },
    );
  });
  it("empty days generate an aggregate-only report", () => {
    const p = reportPeriod(new Date("2026-11-08T19:00:00Z"));
    const message = reportMessage(p, summarize([]));
    ok(message.includes("לא בוצעו עדכונים"));
    ok(message.includes("08/11/2026"));
  });
  it("resume skips periods from the pause, and old history does not restart delivery in the past", () => {
    strictEqual(
      nextDuePeriod(
        "2026-11-08T10:00:00Z",
        "2026-11-01T18:00:00Z",
        new Date("2026-11-08T19:00:00Z"),
      )?.end,
      "2026-11-08T18:00:00.000Z",
    );
  });
  it("not due before local 20:00", () => {
    strictEqual(
      nextDuePeriod("2026-11-08T10:00:00Z", undefined, new Date("2026-11-08T17:59:59Z")),
      null,
    );
  });
  it("encrypted tokens are account-bound, cannot be read under another account", async () => {
    const cipher = await encryptToken("synthetic-test-only", "A");
    strictEqual(await decryptToken(cipher, "A"), "synthetic-test-only");
    await rejects(() => decryptToken(cipher, "B"));
  });
});
describe("Telegram synthetic API failures", () => {
  it("validates bot, negative channel ID and posting permissions; rejects a removed bot", async () => {
    const original = globalThis.fetch;
    let removed = false;
    globalThis.fetch = async (input) => {
      const url = String(input);
      const result = url.endsWith("/getMe")
        ? { id: 1, is_bot: true, username: "synthetic" }
        : url.endsWith("/getChat")
          ? { id: -100, type: "channel", title: "synthetic" }
          : { status: removed ? "left" : "administrator", can_post_messages: true };
      return Response.json({ ok: true, result });
    };
    try {
      strictEqual((await verifyDestination("synthetic", "-100")).chatId, "-100");
      removed = true;
      await rejects(() => verifyDestination("synthetic", "-100"));
    } finally {
      globalThis.fetch = original;
    }
  });
  it("revoked token yields sanitized failure without leaking credentials", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => Response.json({ ok: false, error_code: 401 }, { status: 401 });
    try {
      await rejects(
        () => verifyDestination("synthetic", "-100"),
        (e) => e instanceof TelegramFailure && e.code === 401 && !e.message.includes("synthetic"),
      );
    } finally {
      globalThis.fetch = original;
    }
  });
  it("ambiguous send is marked and is not retried", async () => {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      throw new Error("network");
    };
    try {
      await rejects(
        () => sendMessage("synthetic", "-100", "safe"),
        (e) => e instanceof TelegramFailure && e.ambiguous,
      );
      strictEqual(calls, 1);
    } finally {
      globalThis.fetch = original;
    }
  });
});

it("report links can target the independently hosted app", () => {
  const p = reportPeriod(new Date("2026-11-08T19:00:00Z"));
  const text = reportMessage(p, summarize([]), "https://vehicle.example");
  ok(text.includes("https://vehicle.example"));
  strictEqual(text.includes("lovable.app"), false);
});

it("enabling just before 20:00 does not skip the first due report", () => {
  strictEqual(
    nextDuePeriod("2026-11-08T17:59:59.500Z", undefined, new Date("2026-11-08T18:00:00Z"))?.end,
    "2026-11-08T18:00:00.000Z",
  );
});
