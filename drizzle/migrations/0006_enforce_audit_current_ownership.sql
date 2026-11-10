CREATE OR REPLACE FUNCTION public.can_read_vehicle_audit(p_vehicle_id uuid,p_event_owner uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT p_event_owner=auth.uid() AND (NOT EXISTS(SELECT 1 FROM public.vehicles WHERE id=p_vehicle_id) OR EXISTS(SELECT 1 FROM public.vehicles WHERE id=p_vehicle_id AND user_id=auth.uid()));
$$;
REVOKE ALL ON FUNCTION public.can_read_vehicle_audit(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_read_vehicle_audit(uuid,uuid) TO authenticated,service_role;
ALTER POLICY own_vehicle_audit ON public.vehicle_audit_events USING(public.can_read_vehicle_audit(vehicle_id,owner_at_event));