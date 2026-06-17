import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { useBulkDeleteVehicles, useBulkMarkChecked, useVehicles } from "@/lib/data";
import { daysSince, effectiveStatus, formatDate, todayISO } from "@/lib/format";
import type { Vehicle, VehicleWithLast } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { InspectionDialog } from "@/components/inspection-dialog";
import { VehicleFormDialog } from "@/components/vehicle-form-dialog";
import { VehicleDetailsDialog } from "@/components/vehicle-details-dialog";
import { toCSV } from "@/lib/parse-import";
import { Plus, Search, Upload, Download, CheckCheck, Trash2, Pencil, Truck, ListChecks, X, Calendar } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const OVERDUE_DAYS = 7;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "מעקב בדיקות רכבים" },
      { name: "description", content: "מערכת לניהול ומעקב בדיקות רכבים" },
      { property: "og:title", content: "מעקב בדיקות רכבים" },
      { property: "og:description", content: "מערכת לניהול ומעקב בדיקות רכבים" },
    ],
  }),
  component: Dashboard,
});

type SortKey = "category" | "vehicle_number" | "last_date";
type StatFilter = null | { kind: "checkedOn"; date: string } | { kind: "overdue"; days: number } | { kind: "never" };

function Dashboard() {
  const { data: vehicles = [], isLoading } = useVehicles();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("category");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statFilter, setStatFilter] = useState<StatFilter>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDateRange, setShowDateRange] = useState(false);

  const [inspectionFor, setInspectionFor] = useState<Vehicle | null>(null);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [detailsVehicle, setDetailsVehicle] = useState<Vehicle | null>(null);

  const bulkMark = useBulkMarkChecked();
  const bulkDelete = useBulkDeleteVehicles();

  const categories = useMemo(() => {
    const s = new Set(vehicles.map((v) => v.category));
    return Array.from(s).sort();
  }, [vehicles]);

  const today = todayISO();

  const stats = useMemo(() => {
    let checkedToday = 0, never = 0, overdue = 0;
    for (const v of vehicles) {
      const last = v.last_inspection;
      if (!last) { never++; continue; }
      if (last.inspection_date === today) checkedToday++;
      const d = daysSince(last.inspection_date);
      if (d !== null && d > OVERDUE_DAYS) overdue++;
    }
    return { total: vehicles.length, checkedToday, never, overdue };
  }, [vehicles, today]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = vehicles.filter((v) => {
      if (category !== "all" && v.category !== category) return false;
      if (statFilter) {
        const last = v.last_inspection;
        if (statFilter.kind === "checkedOn") {
          if (!last || last.inspection_date !== statFilter.date) return false;
        } else if (statFilter.kind === "overdue") {
          if (!last) return false;
          const d = daysSince(last.inspection_date);
          if (d === null || d <= statFilter.days) return false;
        } else if (statFilter.kind === "never") {
          if (last) return false;
        }
      }
      if (dateFrom || dateTo) {
        const lastDate = v.last_inspection?.inspection_date ?? "";
        if (!lastDate) return false;
        if (dateFrom && lastDate < dateFrom) return false;
        if (dateTo && lastDate > dateTo) return false;
      }
      if (!q) return true;
      return (
        v.vehicle_number.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q) ||
        (v.notes ?? "").toLowerCase().includes(q)
      );
    });
    list = [...list].sort((a, b) => {
      if (sortBy === "vehicle_number") return a.vehicle_number.localeCompare(b.vehicle_number, undefined, { numeric: true });
      if (sortBy === "last_date") {
        const ad = a.last_inspection?.inspection_date ?? "";
        const bd = b.last_inspection?.inspection_date ?? "";
        return bd.localeCompare(ad);
      }
      return a.category.localeCompare(b.category, "he") || a.vehicle_number.localeCompare(b.vehicle_number, undefined, { numeric: true });
    });
    return list;
  }, [vehicles, search, category, sortBy, statFilter, dateFrom, dateTo]);

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(filtered.map((v) => v.id)) : new Set());
  };
  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (checked) n.add(id); else n.delete(id);
      return n;
    });
  };

  const exportCSV = () => {
    const rows = filtered.map((v) => ({
      קטגוריה: v.category,
      "מספר רכב": v.vehicle_number,
      הערות: v.notes ?? "",
      "תאריך בדיקה אחרון": v.last_inspection ? formatDate(v.last_inspection.inspection_date) : "",
      "סטטוס אחרון": v.last_inspection?.status ?? "",
    }));
    const csv = "\uFEFF" + toCSV(rows, ["קטגוריה", "מספר רכב", "הערות", "תאריך בדיקה אחרון", "סטטוס אחרון"]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `vehicles-${today}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const markSelectedOk = async () => {
    try {
      await bulkMark.mutateAsync({ vehicleIds: Array.from(selected), status: "ok", date: today });
      toast.success(`סומנו ${selected.size} רכבים כתקינים`);
      setSelected(new Set());
    } catch { toast.error("שגיאה"); }
  };

  const deleteSelected = async () => {
    try {
      const ids = Array.from(selected);
      await bulkDelete.mutateAsync(ids);
      toast.success(`נמחקו ${ids.length} רכבים`);
      setSelected(new Set());
    } catch { toast.error("שגיאה במחיקה"); }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <Truck className="size-5 text-[color:var(--brand)]" />
            <h1 className="text-lg font-bold">מעקב בדיקות רכבים</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/import"><Upload className="size-4 ms-1" /> ייבוא</Link>
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="size-4 ms-1" /> הוסף רכב
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="סה״כ רכבים"
            value={stats.total}
            active={statFilter === null}
            onClick={() => setStatFilter(null)}
          />
          <StatCard
            label="נבדקו היום"
            value={stats.checkedToday}
            tone="ok"
            active={statFilter?.kind === "checkedOn"}
            onClick={() => setStatFilter({ kind: "checkedOn", date: today })}
          />
          <StatCard
            label="לא נבדקו"
            value={stats.never}
            tone="muted"
            active={statFilter?.kind === "never"}
            onClick={() => setStatFilter({ kind: "never" })}
          />
          <StatCard
            label={`באיחור (>${OVERDUE_DAYS} ימים)`}
            value={stats.overdue}
            tone="bad"
            active={statFilter?.kind === "overdue"}
            onClick={() => setStatFilter({ kind: "overdue", days: OVERDUE_DAYS })}
          />
        </div>

        {statFilter && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
            {statFilter.kind === "checkedOn" && (
              <>
                <span className="font-medium">סינון: נבדקו בתאריך</span>
                <Input
                  type="date"
                  value={statFilter.date}
                  onChange={(e) => setStatFilter({ kind: "checkedOn", date: e.target.value })}
                  className="h-8 w-auto"
                />
              </>
            )}
            {statFilter.kind === "overdue" && (
              <>
                <span className="font-medium">סינון: באיחור של יותר מ-</span>
                <Input
                  type="number"
                  min={0}
                  value={statFilter.days}
                  onChange={(e) => setStatFilter({ kind: "overdue", days: Math.max(0, Number(e.target.value) || 0) })}
                  className="h-8 w-20"
                />
                <span>ימים</span>
              </>
            )}
            {statFilter.kind === "never" && <span className="font-medium">סינון: לא נבדקו מעולם</span>}
            <Button size="sm" variant="ghost" onClick={() => setStatFilter(null)}>
              <X className="size-4 ms-1" /> נקה סינון
            </Button>
          </div>
        )}

        <div className="sticky top-0 z-20 -mx-4 border-y bg-background/95 px-4 py-3 backdrop-blur">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="חיפוש לפי מספר, קטגוריה או הערה"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pe-9"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="sm:w-48"><SelectValue placeholder="קטגוריה" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הקטגוריות</SelectItem>
                {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
              <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="category">מיון: קטגוריה</SelectItem>
                <SelectItem value="vehicle_number">מיון: מס׳ רכב</SelectItem>
                <SelectItem value="last_date">מיון: בדיקה אחרונה</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant={showDateRange || dateFrom || dateTo ? "default" : "outline"}
              onClick={() => setShowDateRange((s) => !s)}
              className="h-10"
            >
              <Calendar className="size-4 ms-1" /> טווח תאריכים
            </Button>
          </div>

          {(showDateRange || dateFrom || dateTo) && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <span className="font-medium">בדיקות בין תאריכים:</span>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 w-auto"
              />
              <span className="text-muted-foreground">עד</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 w-auto"
              />
              <Button size="sm" variant="ghost" onClick={() => { setDateFrom(""); setDateTo(""); setShowDateRange(false); }}>
                <X className="size-4 ms-1" /> נקה טווח
              </Button>
            </div>
          )}

          {selected.size > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <span className="font-medium">{selected.size} נבחרו</span>
              <Button size="sm" variant="outline" onClick={markSelectedOk}>
                <CheckCheck className="size-4 ms-1" /> סמן כתקין היום
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive">
                    <Trash2 className="size-4 ms-1" /> מחק נבחרים
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent dir="rtl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-right">מחיקת רכבים</AlertDialogTitle>
                    <AlertDialogDescription className="text-right">
                      פעולה זו תמחק {selected.size} רכבים ואת היסטוריית הבדיקות שלהם.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>ביטול</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteSelected}>מחק</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>נקה</Button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>{filtered.length} רכבים</div>
          <Button size="sm" variant="ghost" onClick={exportCSV}>
            <Download className="size-4 ms-1" /> ייצוא CSV
          </Button>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">טוען…</div>
        ) : filtered.length === 0 ? (
          <EmptyState onAdd={() => setAddOpen(true)} />
        ) : (
          <>
            {/* Mobile cards */}
            <div className="grid gap-2 md:hidden">
              {filtered.map((v) => (
                <VehicleCard
                  key={v.id}
                  v={v}
                  selected={selected.has(v.id)}
                  onToggle={(c) => toggleOne(v.id, c)}
                  onOpen={() => setDetailsVehicle(v)}
                  onInspect={() => setInspectionFor(v)}
                  onEdit={() => setEditVehicle(v)}
                />
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-md border md:block">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-right">
                  <tr>
                    <th className="w-10 p-2">
                      <Checkbox
                        checked={selected.size === filtered.length && filtered.length > 0}
                        onCheckedChange={(c) => toggleAll(!!c)}
                      />
                    </th>
                    <th className="p-2">קטגוריה</th>
                    <th className="p-2">מס׳ רכב</th>
                    <th className="p-2">הערות</th>
                    <th className="p-2">בדיקה אחרונה</th>
                    <th className="p-2">סטטוס</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v) => (
                    <tr key={v.id} className="border-t hover:bg-muted/30">
                      <td className="p-2">
                        <Checkbox
                          checked={selected.has(v.id)}
                          onCheckedChange={(c) => toggleOne(v.id, !!c)}
                        />
                      </td>
                      <td className="p-2">{v.category}</td>
                      <td className="p-2 font-medium">
                        <button className="hover:underline" onClick={() => setDetailsVehicle(v)}>
                          {v.vehicle_number}
                        </button>
                      </td>
                      <td className="p-2 text-muted-foreground">{v.notes || "—"}</td>
                      <td className="p-2">{v.last_inspection ? formatDate(v.last_inspection.inspection_date) : "—"}</td>
                      <td className="p-2"><StatusBadge status={effectiveStatus(v.last_inspection)} /></td>
                      <td className="p-2">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" onClick={() => setInspectionFor(v)}>
                            <ListChecks className="size-4 ms-1" /> בדיקה חדשה
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditVehicle(v)}>
                            <Pencil className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      <InspectionDialog
        vehicle={inspectionFor}
        open={!!inspectionFor}
        onOpenChange={(o) => !o && setInspectionFor(null)}
      />
      <VehicleFormDialog
        vehicle={editVehicle}
        open={!!editVehicle || addOpen}
        onOpenChange={(o) => { if (!o) { setEditVehicle(null); setAddOpen(false); } }}
      />
      <VehicleDetailsDialog
        vehicle={detailsVehicle}
        open={!!detailsVehicle}
        onOpenChange={(o) => !o && setDetailsVehicle(null)}
        onNewInspection={(v) => { setDetailsVehicle(null); setInspectionFor(v); }}
        onEdit={(v) => { setDetailsVehicle(null); setEditVehicle(v); }}
      />
    </div>
  );
}

function StatCard({ label, value, tone, active, onClick }: { label: string; value: number; tone?: "ok" | "bad" | "muted"; active?: boolean; onClick?: () => void }) {
  const color =
    tone === "ok" ? "text-[color:var(--status-ok)]"
      : tone === "bad" ? "text-[color:var(--status-bad)]"
      : tone === "muted" ? "text-muted-foreground"
      : "text-foreground";
  return (
    <Card
      onClick={onClick}
      className={`cursor-pointer transition hover:bg-muted/40 ${active ? "ring-2 ring-[color:var(--brand)]" : ""}`}
    >
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function VehicleCard({
  v, selected, onToggle, onOpen, onInspect, onEdit,
}: {
  v: VehicleWithLast;
  selected: boolean;
  onToggle: (c: boolean) => void;
  onOpen: () => void;
  onInspect: () => void;
  onEdit: () => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <Checkbox checked={selected} onCheckedChange={(c) => onToggle(!!c)} className="mt-1" />
            <button onClick={onOpen} className="text-right">
              <div className="font-bold">{v.vehicle_number}</div>
              <div className="text-xs text-muted-foreground">{v.category}</div>
            </button>
          </div>
          <StatusBadge status={effectiveStatus(v.last_inspection)} />
        </div>
        {v.notes && (
          <div className="rounded-md border border-[color:var(--brand)]/30 bg-[color:var(--brand)]/5 p-2 text-sm font-medium text-foreground whitespace-pre-wrap">
            הערות: {v.notes}
          </div>
        )}
        <div className="text-xs text-muted-foreground">
          בדיקה אחרונה: {v.last_inspection ? formatDate(v.last_inspection.inspection_date) : "—"}
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" className="flex-1" onClick={onInspect}>בדיקה חדשה</Button>
          <Button size="sm" variant="outline" onClick={onEdit}>עריכה</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-md border border-dashed p-10 text-center">
      <Truck className="mx-auto size-10 text-muted-foreground" />
      <h3 className="mt-3 font-medium">אין רכבים עדיין</h3>
      <p className="mt-1 text-sm text-muted-foreground">הוסף רכב חדש או ייבא רשימה.</p>
      <div className="mt-4 flex justify-center gap-2">
        <Button onClick={onAdd}><Plus className="size-4 ms-1" /> הוסף רכב</Button>
        <Button asChild variant="outline">
          <Link to="/import"><Upload className="size-4 ms-1" /> ייבוא</Link>
        </Button>
      </div>
    </div>
  );
}
