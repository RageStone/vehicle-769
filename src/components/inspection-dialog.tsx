import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [status, setStatus] = useState<InspectionStatus>("ok");
  const [notes, setNotes] = useState("");
  const add = useAddInspection();

  useEffect(() => {
    if (open) {
      setDate(todayISO());
      setStatus("ok");
      setNotes("");
    }
  }, [open]);

  const submit = async () => {
    if (!vehicle) return;
    try {
      await add.mutateAsync({
        vehicle_id: vehicle.id,
        inspection_date: date,
        status,
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
          <div>
            <Label>סטטוס</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as InspectionStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ok">תקין</SelectItem>
                <SelectItem value="not_ok">לא תקין</SelectItem>
                <SelectItem value="not_checked">לא נבדק</SelectItem>
              </SelectContent>
            </Select>
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