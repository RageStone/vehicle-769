import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
export const getUserPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("overdue_days")
      .eq("id", context.userId)
      .single();
    if (error) throw new Error("טעינת תקופת הבדיקות נכשלה");
    return { overdueDays: data.overdue_days };
  });
export const saveUserPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ overdueDays: z.number().int().min(0).max(365) }))
  .handler(async ({ context, data }) => {
    const result = await context.supabase
      .from("profiles")
      .update({ overdue_days: data.overdueDays })
      .eq("id", context.userId)
      .select("overdue_days")
      .single();
    if (result.error) throw new Error("שמירת תקופת הבדיקות נכשלה");
    return { overdueDays: result.data.overdue_days };
  });
