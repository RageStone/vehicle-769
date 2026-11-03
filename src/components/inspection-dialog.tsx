import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CHECK_ITEMS } from "@/lib/types";
import { useAddInspection } from "@/lib/data";
import { todayISO } from "@/lib/format";
import type { InspectionStatus, Vehicle } from "@/lib/types";
import { toast } from "sonner";

export function InspectionDialog({
  vehicle,
  open,
  onOpenChange,
}: {
  vehicle: Vehicle | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [date, setDate] = useState(todayISO());
  const [checks, setChecks] = useState({ radio_ok: true, shov_ok: true, winter_ok: true });
  const [notes, setNotes] = useState("");
  const add = useAddInspection();

  useEffect(() => {
    if (open) {
      setDate(todayISO());
      setChecks({ radio_ok: true, shov_ok: true, winter_ok: true });
      setNotes("");
    }
  }, [open]);

  const submit = async () => {
    if (!vehicle) return;
    const status: InspectionStatus = checks.radio_ok && checks.shov_ok && checks.winter_ok ? "ok" : "not_ok";
    try {
      await add.mutateAsync({
        vehicle_id: vehicle.id,
        inspection_date: date,
        status,
        ...checks,
        notes: notes.trim() || undefined,
      });
      toast.success("הבדיקה נשמרה");
      onOpenChange(false);
    } catch (e) {
      toast.error("שגיאה בשמירה");
      console.error(e);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">בדיקה חדשה{vehicle ? ` — ${vehicle.vehicle_number}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>מספר רכב</Label>
            <Input value={vehicle?.vehicle_number ?? ""} readOnly disabled />
          </div>
          <div>
            <Label>תאריך בדיקה</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            {CHECK_ITEMS.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between rounded-md border p-2">
                <span className="font-medium">{label}</span>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={checks[key] ? "default" : "outline"}
                    onClick={() => setChecks((c) => ({ ...c, [key]: true }))}>✅ תקין</Button>
                  <Button type="button" size="sm" variant={!checks[key] ? "destructive" : "outline"}
                    onClick={() => setChecks((c) => ({ ...c, [key]: false }))}>❌ לא תקין</Button>
                </div>
              </div>
            ))}
          </div>
          <div>
            <Label>הערות</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button onClick={submit} disabled={add.isPending}>שמירה</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}