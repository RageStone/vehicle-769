CREATE TABLE public.vehicle_note_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  user_id uuid DEFAULT auth.uid(),
  old_notes text,
  new_notes text,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.vehicle_note_changes (user_id, changed_at);
GRANT SELECT ON public.vehicle_note_changes TO authenticated;
GRANT ALL ON public.vehicle_note_changes TO service_role;
ALTER TABLE public.vehicle_note_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own note changes" ON public.vehicle_note_changes FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.log_vehicle_note_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.notes IS DISTINCT FROM OLD.notes THEN
    INSERT INTO public.vehicle_note_changes (vehicle_id, user_id, old_notes, new_notes)
    VALUES (NEW.id, NEW.user_id, OLD.notes, NEW.notes);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER vehicles_note_change AFTER UPDATE OF notes ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.log_vehicle_note_change();