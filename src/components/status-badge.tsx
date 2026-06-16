import { cn } from "@/lib/utils";
import type { DisplayStatus } from "@/lib/types";
import { DISPLAY_STATUS_LABEL } from "@/lib/types";

export function StatusBadge({ status }: { status: DisplayStatus | null | undefined }) {
  const s: DisplayStatus = status ?? "not_checked";
  const cls =
    s === "ok"
      ? "bg-[color:var(--status-ok)]/15 text-[color:var(--status-ok)] border-[color:var(--status-ok)]/30"
      : s === "not_ok"
        ? "bg-[color:var(--status-bad)]/15 text-[color:var(--status-bad)] border-[color:var(--status-bad)]/30"
        : s === "expired"
          ? "bg-[color:var(--status-bad)]/10 text-[color:var(--status-bad)] border-[color:var(--status-bad)]/30"
          : "bg-muted text-muted-foreground border-border";
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap", cls)}>
      {DISPLAY_STATUS_LABEL[s]}
    </span>
  );
}