ALTER TABLE public.inspections ADD COLUMN IF NOT EXISTS fit_ok boolean;
COMMENT ON COLUMN public.inspections.fit_ok IS 'כשיר/לא כשיר: true = כשיר, false = לא כשיר, null = לא נרשם';