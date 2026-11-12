import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/telegram/process")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["TELEGRAM_SCHEDULER_SECRET"];
        const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "");
        if (!expected || !supplied) return new Response("Unauthorized", { status: 401 });
        const { timingSafeEqual } = await import("node:crypto");
        const expectedBytes = Buffer.from(expected),
          suppliedBytes = Buffer.from(supplied);
        if (
          expectedBytes.length !== suppliedBytes.length ||
          !timingSafeEqual(expectedBytes, suppliedBytes)
        )
          return new Response("Unauthorized", { status: 401 });
        const { processDueReports } = await import("@/lib/telegram/service.server");
        return Response.json(await processDueReports());
      },
    },
  },
});
