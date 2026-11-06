import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { buildChangeReport, reportHeaders, type ReportFilters } from "@/lib/change-report";
import { toCSV } from "@/lib/parse-import";
import { todayISO } from "@/lib/format";
import type { Inspection, Vehicle } from "@/lib/types";
import { toast } from "sonner";

const T = {
  title: "ייצוא דוח שינויים",
  from: "מתאריך", to: "עד תאריך", category: "קטגוריה", allCats: "כל הקטגוריות",
  type: "סוג שינוי", typeAll: "הכל", typeInsp: "רק בדיקות", typeNotes: "רק עדכוני הערות",
  result: "תוצאת בדיקה", resAll: "כל הסטטוסים", resProblems: "רק תקלות / לא כשיר", resRecovered: "רק רכבים שחזרו לתקין",
  number: "מספר רכב (אופציונלי)", export: "ייצוא", empty: "אין שינויים בטווח שנבחר", error: "שגיאה ביצירת הדוח",
  done: (n: number) => `יוצאו ${n} שורות`,
};

export function ChangeReportDialog({ open, onOpenChange, categories }: {
  open: boolean; onOpenChange: (o: boolean) => void; categories: string[];
}) {
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const [f, setF] = useState<ReportFilters>({ from: weekAgo, to: todayISO(), category: "all", type: "all", result: "all", vehicleNumber: "" });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof ReportFilters>(k: K, v: ReportFilters[K]) => setF((p) => ({ ...p, [k]: v }));

  const run = async () => {
    setBusy(true);
    try {
      const [v, i, n] = await Promise.all([
        supabase.from("vehicles").select("*"),
        supabase.from("inspections").select("*"),
        supabase.from("vehicle_note_changes").select("vehicle_id,old_notes,new_notes,changed_at"),
      ]);
      if (v.error || i.error || n.error) throw v.error ?? i.error ?? n.error;
      const rows = buildChangeReport(v.data as Vehicle[], i.data as Inspection[], n.data ?? [], f);
      if (!rows.length) { toast.info(T.empty); return; }
      const csv = "\uFEFF" + toCSV(rows, reportHeaders());
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
      const a = document.createElement("a");
      a.href = url; a.download = `changes-${f.from || "start"}_${f.to || "end"}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      toast.success(T.done(rows.length));
      onOpenChange(false);
    } catch {
      toast.error(T.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader><DialogTitle className="text-right">{T.title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>{T.from}</Label><Input type="date" value={f.from} onChange={(e) => set("from", e.target.value)} /></div>
            <div className="space-y-1"><Label>{T.to}</Label><Input type="date" value={f.to} onChange={(e) => set("to", e.target.value)} /></div>
          </div>
          <div className="space-y-1">
            <Label>{T.category}</Label>
            <Select value={f.category} onValueChange={(x) => set("category", x)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{T.allCats}</SelectItem>
                {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{T.type}</Label>
            <Select value={f.type} onValueChange={(x) => set("type", x as ReportFilters["type"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{T.typeAll}</SelectItem>
                <SelectItem value="inspections">{T.typeInsp}</SelectItem>
                <SelectItem value="notes">{T.typeNotes}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{T.result}</Label>
            <Select value={f.result} onValueChange={(x) => set("result", x as ReportFilters["result"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{T.resAll}</SelectItem>
                <SelectItem value="problems">{T.resProblems}</SelectItem>
                <SelectItem value="recovered">{T.resRecovered}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>{T.number}</Label><Input value={f.vehicleNumber} onChange={(e) => set("vehicleNumber", e.target.value)} /></div>
          <Button className="w-full" onClick={run} disabled={busy}>{T.export}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
