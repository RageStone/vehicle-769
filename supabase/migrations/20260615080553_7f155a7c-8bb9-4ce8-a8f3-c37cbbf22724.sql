
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  vehicle_number TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vehicles_category ON public.vehicles(category);
CREATE INDEX idx_vehicles_number ON public.vehicles(vehicle_number);

CREATE TABLE public.inspections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL CHECK (status IN ('ok','not_ok','not_checked')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_inspections_vehicle ON public.inspections(vehicle_id);
CREATE INDEX idx_inspections_date ON public.inspections(inspection_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO anon, authenticated;
GRANT ALL ON public.vehicles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspections TO anon, authenticated;
GRANT ALL ON public.inspections TO service_role;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access vehicles" ON public.vehicles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access inspections" ON public.inspections FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
