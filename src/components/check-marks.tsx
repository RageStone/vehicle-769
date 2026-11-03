import { CHECK_ITEMS } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { Inspection } from "@/lib/types";

export function CheckMarks({
  inspection,
  className,
}: {
  inspection: Inspection | null | undefined;
  className?: string;
}) {
  if (!inspection) return null;
  const items = CHECK_ITEMS.filter((c) => inspection[c.key] !== null);
  if (!items.length) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs", className)}>
      {items.map((c) => (
        <span
          key={c.key}
          className={cn(
            "inline-flex items-center gap-1 whitespace-nowrap font-medium",
            inspection[c.key]
              ? "text-[color:var(--status-ok)]"
              : "text-[color:var(--status-bad)]",
          )}
        >
          {c.label} {inspection[c.key] ? "✅" : "❌"}
        </span>
      ))}
    </div>
  );
}
