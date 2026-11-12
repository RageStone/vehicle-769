import { describe, it } from "node:test";
import { strictEqual, rejects } from "node:assert";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../integrations/supabase/types";
import { processReports, sendManualReport } from "./service.server";
import { TelegramFailure } from "./api.server";

function fixture(
  options: {
    historyFailure?: boolean;
    claimFailure?: boolean;
    lostClaim?: boolean;
    paused?: boolean;
    settingsFailure?: boolean;
    ambiguous?: boolean;
    resultFailure?: boolean;
    multipartFailure?: boolean;
    multipleParts?: boolean;
    rotateAfterFirstPart?: boolean;
  } = {},
) {
  const configs = ["A", "B"].map((user_id) => ({
    user_id,
    enabled: !options.paused,
    report_hour: 20,
    connection_verified: true,
    enabled_at: "2026-11-08T10:00:00.000Z",
    updated_at: "version-1",
    telegram_chat_id: user_id,
  }));
  const reports = new Map<string, Record<string, unknown>>();
  let sends = 0;
  const admin = {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      let patch: Record<string, unknown> | undefined;
      let columns = "";
      const q = {
        select(value: string) {
          columns = value;
          return q;
        },
        eq(key: string, value: unknown) {
          filters[key] = value;
          return q;
        },
        order() {
          return q;
        },
        limit() {
          return q;
        },
        single() {
          return q;
        },
        maybeSingle() {
          return q;
        },
        update(value: Record<string, unknown>) {
          patch = value;
          return q;
        },
        then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
          return Promise.resolve()
            .then(() => {
              if (table === "telegram_settings") {
                if (patch) return { data: null, error: null };
                if (filters.user_id)
                  return columns === "*"
                    ? { data: configs.find((c) => c.user_id === filters.user_id), error: null }
                    : {
                        data: {
                          enabled: !options.paused,
                          updated_at:
                            options.rotateAfterFirstPart && sends > 0 ? "version-2" : "version-1",
                        },
                        error: options.settingsFailure ? { message: "offline" } : null,
                      };
                return { data: configs, error: null };
              }
              if (!patch) {
                if (filters.request_key)
                  return {
                    data: [...reports.values()].find(
                      (r) => r.request_key === filters.request_key && r.user_id === filters.user_id,
                    ),
                    error: null,
                  };
                if (options.historyFailure && filters.user_id === "A")
                  return { data: null, error: { message: "offline" } };
                return {
                  data: [...reports.values()].filter(
                    (r) =>
                      r.user_id === filters.user_id &&
                      (!filters.delivery_kind || r.delivery_kind === filters.delivery_kind),
                  ),
                  error: null,
                };
              }
              const row = reports.get(String(filters.id));
              if (patch.delivery_status === "sending" && options.lostClaim)
                return { data: null, error: null };
              if (patch.delivery_status === "sent" && options.resultFailure)
                return { data: null, error: { message: "offline" } };
              if (
                !row ||
                (filters.delivery_status && row.delivery_status !== filters.delivery_status)
              )
                return { data: null, error: null };
              Object.assign(row, patch);
              return { data: columns === "id" ? { id: filters.id } : null, error: null };
            })
            .then(resolve, reject);
        },
      };
      return q;
    },
    async rpc(_name: string, args: { p_user_id: string; p_end: string; p_request_key?: string }) {
      if (options.claimFailure && args.p_user_id === "A")
        return { data: null, error: { message: "offline" } };
      const id = args.p_request_key ? args.p_user_id + ":" + args.p_request_key : args.p_user_id;
      if (reports.has(id)) return { data: null, error: null };
      reports.set(id, {
        user_id: args.p_user_id,
        request_key: args.p_request_key,
        delivery_kind: args.p_request_key ? "manual" : "scheduled",
        period_end: args.p_end,
        delivery_status: "claimed",
      });
      return { data: id, error: null };
    },
  } as unknown as SupabaseClient<Database>;
  const actions = {
    async generateReport(_client: unknown, _id: string, period: { start: string; end: string }) {
      return {
        period,
        counts: { changes_count: 0, vehicles_count: 0, tests_count: 0 },
        message: "report",
        messages: options.multipleParts ? ["part one", "part two"] : ["report"],
        events: [],
        vehicles: {},
      };
    },
    async storedToken() {
      return "synthetic";
    },
    async verifyDestination() {
      return { botId: 1, username: "synthetic", chatId: "1", title: "test", privateChat: true };
    },
    async sendMessage() {
      sends++;
      if (options.multipartFailure && sends === 2) throw new TelegramFailure(429, false);
      if (options.ambiguous) throw new TelegramFailure(0, true);
      return { message_id: 1 };
    },
  };
  const run = () => processReports(admin, actions, new Date("2026-11-08T19:00:00Z"));
  return {
    run,
    reports,
    sends: () => sends,
    manual: (key: string) =>
      sendManualReport(admin, actions, "A", key, new Date("2026-11-08T17:00:00Z")),
  };
}

describe("Telegram report delivery", () => {
  it("concurrent scheduler invocations send once per account and period", async () => {
    const f = fixture();
    await Promise.all([f.run(), f.run()]);
    strictEqual(f.sends(), 2);
    strictEqual(f.reports.get("A")?.delivery_status, "sent");
    strictEqual(f.reports.get("B")?.delivery_status, "sent");
  });
  it("never sends without winning the persisted sending transition", async () => {
    const f = fixture({ lostClaim: true });
    await f.run();
    strictEqual(f.sends(), 0);
  });
  it("a history database failure stops that account but allows other accounts", async () => {
    const f = fixture({ historyFailure: true });
    await rejects(f.run);
    strictEqual(f.sends(), 1);
    strictEqual(f.reports.has("A"), false);
  });
  it("a claim database failure is surfaced after processing other accounts", async () => {
    const f = fixture({ claimFailure: true });
    await rejects(f.run);
    strictEqual(f.sends(), 1);
  });
  it("pausing before delivery cancels a claimed report", async () => {
    const f = fixture({ paused: true });
    await f.run();
    strictEqual(f.sends(), 0);
    strictEqual(f.reports.get("A")?.delivery_status, "cancelled");
  });
  it("a failed settings read does not send", async () => {
    const f = fixture({ settingsFailure: true });
    await f.run();
    strictEqual(f.sends(), 0);
    strictEqual(f.reports.get("A")?.delivery_status, "failed");
  });
  it("ambiguous Telegram delivery is persisted and never retried", async () => {
    const f = fixture({ ambiguous: true });
    await f.run();
    await f.run();
    strictEqual(f.sends(), 2);
    strictEqual(f.reports.get("A")?.delivery_status, "ambiguous");
  });
  it("a failed post-send persistence never causes a second send", async () => {
    const f = fixture({ resultFailure: true });
    await f.run();
    await f.run();
    strictEqual(f.sends(), 2);
    strictEqual(f.reports.get("A")?.delivery_status, "ambiguous");
  });
});

it("manual reporting works while the automatic schedule is paused and repeated requests do not resend", async () => {
  const f = fixture({ paused: true });
  await Promise.all([f.manual("same-key"), f.manual("same-key")]);
  strictEqual(f.sends(), 1);
});
it("manual reports do not move the automatic delivery cursor", async () => {
  const f = fixture();
  await f.manual("manual-key");
  await f.run();
  strictEqual(f.sends(), 3);
});

it("multipart delivery stores all successful parts", async () => {
  const f = fixture({ paused: true, multipleParts: true });
  await f.manual("parts");
  strictEqual(f.sends(), 2);
  strictEqual(f.reports.get("A:parts")?.sent_parts, 2);
  strictEqual(f.reports.get("A:parts")?.delivery_status, "sent");
});
it("a failure after one part never blindly resends a partially delivered report", async () => {
  const f = fixture({ paused: true, multipleParts: true, multipartFailure: true });
  await f.manual("parts");
  await f.manual("parts");
  strictEqual(f.sends(), 2);
  strictEqual(f.reports.get("A:parts")?.sent_parts, 1);
  strictEqual(f.reports.get("A:parts")?.delivery_status, "ambiguous");
});

it("changing the bot configuration stops the remaining report parts", async () => {
  const f = fixture({ paused: true, multipleParts: true, rotateAfterFirstPart: true });
  await f.manual("parts");
  strictEqual(f.sends(), 1);
  strictEqual(f.reports.get("A:parts")?.sent_parts, 1);
  strictEqual(f.reports.get("A:parts")?.delivery_status, "ambiguous");
});
