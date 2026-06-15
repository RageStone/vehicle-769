export interface ParsedRow {
  category: string;
  vehicle_number: string;
  notes: string;
}

export function parseImport(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: ParsedRow[] = [];
  let currentCategory = "";
  for (const line of lines) {
    const m = line.match(/(\d{3,})/);
    if (!m) {
      currentCategory = line;
      continue;
    }
    const num = m[1];
    const rest = (line.slice(0, m.index!) + " " + line.slice(m.index! + num.length))
      .replace(/\s+/g, " ")
      .trim();
    rows.push({ category: currentCategory, vehicle_number: num, notes: rest });
  }
  return rows;
}

export function toCSV(rows: Array<Record<string, unknown>>, headers: string[]): string {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const out = [headers.join(",")];
  for (const r of rows) out.push(headers.map((h) => esc(r[h])).join(","));
  return out.join("\n");
}