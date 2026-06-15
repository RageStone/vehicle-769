import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSaveVehicle, useBulkInsertVehicles } from "@/lib/data";
import type { Vehicle } from "@/lib/types";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export function VehicleFormDialog({
  vehicle,
  open,
  onOpenChange,
}: {
  vehicle: Vehicle | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const editing = !!vehicle;
  const [category, setCategory] = useState("");
  const [number, setNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Array<{ number: string; notes: string }>>([{ number: "", notes: "" }]);
  const save = useSaveVehicle();
  const bulk = useBulkInsertVehicles();

  useEffect(() => {
    if (open) {
      setCategory(vehicle?.category ?? "");
      setNumber(vehicle?.vehicle_number ?? "");
      setNotes(vehicle?.notes ?? "");
      setRows([{ number: "", notes: "" }]);
    }
  }, [open, vehicle]);

  const submit = async () => {
    try {
      if (editing) {
        if (!category.trim() || !number.trim()) { toast.error("חסרים שדות"); return; }
        await save.mutateAsync({
          id: vehicle!.id,
          category: category.trim(),
          vehicle_number: number.trim(),
          notes: notes.trim() || null,
        });
      } else {
        if (!category.trim()) { toast.error("יש להזין קטגוריה"); return; }
        const valid = rows
          .map((r) => ({ number: r.number.trim(), notes: r.notes.trim() }))
          .filter((r) => r.number);
        if (!valid.length) { toast.error("יש להזין לפחות רכב אחד"); return; }
        await bulk.mutateAsync(
          valid.map((r) => ({ category: category.trim(), vehicle_number: r.number, notes: r.notes || null })),
        );
      }
      toast.success("נשמר");
      onOpenChange(false);
    } catch (e) {
      toast.error("שגיאה בשמירה");
      console.error(e);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-right">{editing ? "עריכת רכב" : "הוספת רכבים"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>קטגוריה</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="לדוגמה: דויד טויוטה" />
          </div>
          {editing ? (
            <>
              <div>
                <Label>מספר רכב</Label>
                <Input value={number} onChange={(e) => setNumber(e.target.value)} />
              </div>
              <div>
                <Label>הערות / תפקיד</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder='לדוגמה: מח"ט' />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label>רכבים</Label>
              {rows.map((r, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="מספר רכב"
                    value={r.number}
                    onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, number: e.target.value } : x)))}
                  />
                  <Input
                    placeholder="הערות"
                    value={r.notes}
                    onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, notes: e.target.value } : x)))}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                    disabled={rows.length === 1}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, { number: "", notes: "" }])}>
                <Plus className="size-4 ms-1" /> הוסף שורה
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button onClick={submit} disabled={save.isPending || bulk.isPending}>שמירה</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}