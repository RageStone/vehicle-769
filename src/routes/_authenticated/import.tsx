import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseImport, type ParsedRow } from "@/lib/parse-import";
import { useBulkInsertVehicles } from "@/lib/data";
import { ArrowRight, Trash2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/import")({
  head: () => ({
    meta: [
      { title: "ייבוא רכבים" },
      { name: "description", content: "ייבוא רשימת רכבים מטקסט או קובץ" },
    ],
  }),
  component: ImportPage,
});

function ImportPage() {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const bulk = useBulkInsertVehicles();
  const navigate = useNavigate();

  const onFile = async (file: File) => {
    const t = await file.text();
    setText(t);
    setRows(parseImport(t));
  };

  const doParse = () => {
    const r = parseImport(text);
    setRows(r);
    if (!r.length) toast.error("לא זוהו רכבים");
  };

  const updateRow = (i: number, patch: Partial<ParsedRow>) => {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };

  const removeRow = (i: number) => setRows((rs) => rs.filter((_, j) => j !== i));

  const save = async () => {
    const valid = rows
      .map((r) => ({
        category: r.category.trim() || "ללא קטגוריה",
        vehicle_number: r.vehicle_number.trim(),
        notes: r.notes.trim() || null,
      }))
      .filter((r) => r.vehicle_number);
    if (!valid.length) { toast.error("אין שורות לשמירה"); return; }
    try {
      await bulk.mutateAsync(valid);
      toast.success(`יובאו ${valid.length} רכבים`);
      navigate({ to: "/" });
    } catch (e) {
      toast.error("שגיאה בייבוא");
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <h1 className="text-lg font-bold">ייבוא רכבים</h1>
          <Button asChild variant="outline" size="sm">
            <Link to="/"><ArrowRight className="size-4 ms-1" /> חזרה</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-4">
        <section className="space-y-3 rounded-md border bg-card p-4">
          <div>
            <Label className="mb-1 block">הדבק טקסט</Label>
            <Textarea
              rows={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`דויד טויוטה\n617598 מחט\n617597 סמחט\n617176`}
              className="font-mono"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={doParse}>נתח</Button>
            <Label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
              <FileSpreadsheet className="size-4" />
              העלה CSV / טקסט
              <input
                type="file"
                accept=".csv,.txt,text/plain,text/csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              />
            </Label>
            <span className="text-xs text-muted-foreground">
              שורת קטגוריה ללא מספרים, ואחריה שורות עם מספר רכב והערות.
            </span>
          </div>
        </section>

        {rows.length > 0 && (
          <section className="space-y-3 rounded-md border bg-card p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">תצוגה מקדימה ({rows.length} שורות)</h2>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setRows([])}>נקה</Button>
                <Button onClick={save} disabled={bulk.isPending}>שמור הכל</Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-right">
                  <tr>
                    <th className="p-2">קטגוריה</th>
                    <th className="p-2">מספר רכב</th>
                    <th className="p-2">הערות</th>
                    <th className="w-10 p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-1">
                        <Input value={r.category} onChange={(e) => updateRow(i, { category: e.target.value })} />
                      </td>
                      <td className="p-1">
                        <Input value={r.vehicle_number} onChange={(e) => updateRow(i, { vehicle_number: e.target.value })} />
                      </td>
                      <td className="p-1">
                        <Input value={r.notes} onChange={(e) => updateRow(i, { notes: e.target.value })} />
                      </td>
                      <td className="p-1">
                        <Button variant="ghost" size="icon" onClick={() => removeRow(i)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}