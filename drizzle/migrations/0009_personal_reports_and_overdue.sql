ALTER TABLE public.profiles ADD COLUMN overdue_days integer NOT NULL DEFAULT 7 CHECK(overdue_days BETWEEN 0 AND 365);
GRANT UPDATE(overdue_days) ON public.profiles TO authenticated;
CREATE POLICY own_profile_preferences ON public.profiles FOR UPDATE TO authenticated USING(id=auth.uid()) WITH CHECK(id=auth.uid());
ALTER TABLE public.telegram_settings ADD COLUMN report_hour integer NOT NULL DEFAULT 20 CHECK(report_hour BETWEEN 0 AND 23);
ALTER TABLE public.telegram_settings ADD COLUMN schedule_changed_at timestamptz;
ALTER TABLE public.telegram_reports ADD COLUMN delivery_kind text NOT NULL DEFAULT 'scheduled' CHECK(delivery_kind IN ('scheduled','manual'));
ALTER TABLE public.telegram_reports ADD COLUMN request_key uuid;
CREATE UNIQUE INDEX telegram_manual_request ON public.telegram_reports(user_id,request_key) WHERE request_key IS NOT NULL;
ALTER TABLE public.vehicle_audit_events ADD COLUMN vehicle_snapshot jsonb;
CREATE OR REPLACE FUNCTION public.claim_manual_telegram_report(p_user_id uuid,p_request_key uuid,p_start timestamptz,p_end timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE report_id uuid;
BEGIN
 IF p_request_key IS NULL THEN RAISE EXCEPTION 'Request key required'; END IF;
 INSERT INTO public.telegram_reports(user_id,period_start,period_end,delivery_kind,request_key)
 SELECT p_user_id,p_start,p_end,'manual',p_request_key FROM public.telegram_settings WHERE user_id=p_user_id AND connection_verified
 ON CONFLICT(user_id,request_key) WHERE request_key IS NOT NULL DO NOTHING RETURNING id INTO report_id;
 RETURN report_id;
END $$;
REVOKE ALL ON FUNCTION public.claim_manual_telegram_report(uuid,uuid,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_manual_telegram_report(uuid,uuid,timestamptz,timestamptz) TO service_role;
CREATE OR REPLACE FUNCTION public.audit_vehicle_activity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b jsonb; a jsonb; fields text[]; vid uuid; owner_id uuid; kind text; identity_snapshot jsonb;
BEGIN
 b:=CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD)-'updated_at'-'created_at' END;
 a:=CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW)-'updated_at'-'created_at' END;
 IF TG_TABLE_NAME='vehicles' THEN
  vid:=COALESCE(NEW.id,OLD.id); owner_id:=CASE WHEN TG_OP='DELETE' THEN OLD.user_id ELSE NEW.user_id END; kind:='vehicle_'||lower(TG_OP);
  identity_snapshot:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 ELSE
  vid:=CASE WHEN TG_OP='DELETE' THEN OLD.vehicle_id ELSE NEW.vehicle_id END;
  SELECT user_id,to_jsonb(v) INTO owner_id,identity_snapshot FROM public.vehicles v WHERE id=vid;
  IF owner_id IS NULL THEN SELECT owner_at_event,vehicle_snapshot INTO owner_id,identity_snapshot FROM public.vehicle_audit_events WHERE vehicle_id=vid AND event_type='vehicle_delete' ORDER BY occurred_at DESC LIMIT 1; END IF;
  kind:='inspection_'||lower(TG_OP);
  IF TG_OP='INSERT' THEN
   SELECT to_jsonb(i)-'created_at' INTO b FROM public.inspections i
    WHERE i.vehicle_id=vid AND i.id<>NEW.id AND i.user_id=owner_id
    ORDER BY i.inspection_date DESC,i.created_at DESC,i.id DESC LIMIT 1;
  END IF;
 END IF;
 SELECT array_agg(key ORDER BY key) INTO fields FROM jsonb_object_keys(COALESCE(a,b)) key WHERE (a->key) IS DISTINCT FROM (b->key);
 IF fields IS NULL THEN RETURN COALESCE(NEW,OLD); END IF;
 INSERT INTO public.vehicle_audit_events(vehicle_id,owner_at_event,actor_id,event_type,changed_fields,before_values,after_values,vehicle_snapshot)
 VALUES(vid,owner_id,auth.uid(),kind,fields,b,a,identity_snapshot);
 RETURN COALESCE(NEW,OLD);
END $$;
