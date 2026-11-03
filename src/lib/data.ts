import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Inspection, Vehicle, VehicleWithLast, InspectionStatus } from "./types";

export const QK = {
  vehicles: ["vehicles"] as const,
  inspections: (vehicleId: string) => ["inspections", vehicleId] as const,
};

export function useVehicles() {
  return useQuery({
    queryKey: QK.vehicles,
    queryFn: async (): Promise<VehicleWithLast[]> => {
      const { data: vehicles, error } = await supabase
        .from("vehicles")
        .select("*")
        .order("category", { ascending: true })
        .order("vehicle_number", { ascending: true });
      if (error) throw error;
      const { data: insp, error: e2 } = await supabase
        .from("inspections")
        .select("*")
        .order("inspection_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (e2) throw e2;
      const latest = new Map<string, Inspection>();
      for (const i of (insp ?? []) as Inspection[]) {
        if (!latest.has(i.vehicle_id)) latest.set(i.vehicle_id, i);
      }
      return ((vehicles ?? []) as Vehicle[]).map((v) => ({
        ...v,
        last_inspection: latest.get(v.id) ?? null,
      }));
    },
  });
}

export function useInspections(vehicleId: string | null) {
  return useQuery({
    queryKey: vehicleId ? QK.inspections(vehicleId) : ["inspections", "none"],
    enabled: !!vehicleId,
    queryFn: async (): Promise<Inspection[]> => {
      const { data, error } = await supabase
        .from("inspections")
        .select("*")
        .eq("vehicle_id", vehicleId!)
        .order("inspection_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Inspection[];
    },
  });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return (vehicleId?: string) => {
    qc.invalidateQueries({ queryKey: QK.vehicles });
    if (vehicleId) qc.invalidateQueries({ queryKey: QK.inspections(vehicleId) });
  };
}

export function useAddInspection() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: {
      vehicle_id: string;
      inspection_date: string;
      status: InspectionStatus;
      notes?: string;
      radio_ok?: boolean;
      shov_ok?: boolean;
      winter_ok?: boolean;
    }) => {
      const { error } = await supabase.from("inspections").insert(input);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => invalidate(vars.vehicle_id),
  });
}

export function useSaveVehicle() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      category: string;
      vehicle_number: string;
      notes?: string | null;
    }) => {
      if (input.id) {
        const { error } = await supabase
          .from("vehicles")
          .update({
            category: input.category,
            vehicle_number: input.vehicle_number,
            notes: input.notes ?? null,
          })
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vehicles").insert({
          category: input.category,
          vehicle_number: input.vehicle_number,
          notes: input.notes ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => invalidate(),
  });
}

export function useDeleteVehicle() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });
}

export function useBulkInsertVehicles() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (rows: Array<{ category: string; vehicle_number: string; notes?: string | null }>) => {
      if (!rows.length) return;
      const { error } = await supabase.from("vehicles").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });
}

export function useBulkMarkChecked() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { vehicleIds: string[]; status: InspectionStatus; date: string; notes?: string }) => {
      if (!input.vehicleIds.length) return;
      const rows = input.vehicleIds.map((vid) => ({
        vehicle_id: vid,
        inspection_date: input.date,
        status: input.status,
        notes: input.notes ?? null,
      }));
      const { error } = await supabase.from("inspections").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });
}

export function useBulkDeleteVehicles() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return;
      const { error } = await supabase.from("vehicles").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });
}

export function useDeleteInspection() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { id: string; vehicle_id: string }) => {
      const { error } = await supabase.from("inspections").delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => invalidate(vars.vehicle_id),
  });
}