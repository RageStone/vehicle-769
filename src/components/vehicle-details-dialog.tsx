import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useInspections, useDeleteVehicle, useDeleteInspection } from "@/lib/data";
import type { Vehicle } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { StatusBadge } from "./status-badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

export function VehicleDetailsDialog({
  vehicle, open, onOpenChange, onNewInspection, onEdit,
}: {
  vehicle: Vehicle | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onNewInspection: (v: Vehicle) => void;
  onEdit: (v: Vehicle) => void;
}) {
  const { data: inspections } = useInspections(vehicle?.id ?? null);
  const del = useDeleteVehicle();
  const delInspection = useDeleteInspection();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-right">פרטי רכב</DialogTitle>
        </DialogHeader>
        {vehicle && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-md border p-3 text-sm">
              <div><span className="text-muted-foreground">קטגוריה:</span> {vehicle.category}</div>
              <div><span className="text-muted-foreground">מס׳ רכב:</span> {vehicle.vehicle_number}</div>
              <div className="col-span-2"><span className="text-muted-foreground">הערות:</span> {vehicle.notes || "—"}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => onNewInspection(vehicle)}>
                <Plus className="size-4 ms-1" /> בדיקה חדשה
              </Button>
              <Button size="sm" variant="outline" onClick={() => onEdit(vehicle)}>
                <Pencil className="size-4 ms-1" /> עריכה
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive">
                    <Trash2 className="size-4 ms-1" /> מחק
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent dir="rtl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-right">מחיקת רכב</AlertDialogTitle>
                    <AlertDialogDescription className="text-right">
                      פעולה זו תמחק את הרכב ואת כל היסטוריית הבדיקות שלו. לא ניתן לשחזר.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>ביטול</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        try {
                          await del.mutateAsync(vehicle.id);
                          toast.success("הרכב נמחק");
                          onOpenChange(false);
                        } catch {
                          toast.error("שגיאה במחיקה");
                        }
                      }}
                    >
                      מחק
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <div>
              <h3 className="mb-2 font-medium">היסטוריית בדיקות</h3>
              {!inspections?.length ? (
                <p className="text-sm text-muted-foreground">אין בדיקות עדיין.</p>
              ) : (
                <div className="space-y-2">
                  {inspections.map((ins) => (
                    <div key={ins.id} className="flex items-start justify-between gap-2 rounded-md border p-2 text-sm">
                      <div>
                        <div className="font-medium">{formatDate(ins.inspection_date)}</div>
                        {ins.notes && <div className="text-muted-foreground">{ins.notes}</div>}
                      </div>
                      <StatusBadge status={ins.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}