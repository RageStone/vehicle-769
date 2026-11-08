CREATE TABLE public.telegram_settings (
 user_id uuid PRIMARY KEY, telegram_bot_id bigint NOT NULL UNIQUE, telegram_bot_username text NOT NULL,
 telegram_chat_id text NOT NULL, telegram_chat_title text NOT NULL,
 connection_verified boolean NOT NULL DEFAULT false, enabled boolean NOT NULL DEFAULT false,
 verified_at timestamptz, enabled_at timestamptz, last_success_at timestamptz, last_error text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT verified_before_enabled CHECK (NOT enabled OR connection_verified),
 CONSTRAINT numeric_chat_id CHECK (telegram_chat_id ~ '^-?[0-9]{1,20}$')
);
GRANT SELECT ON public.telegram_settings TO authenticated;
GRANT ALL ON public.telegram_settings TO service_role;
ALTER TABLE public.telegram_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_telegram_settings ON public.telegram_settings FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE TABLE public.telegram_credentials (
 user_id uuid PRIMARY KEY REFERENCES public.telegram_settings(user_id) ON DELETE CASCADE,
 ciphertext text NOT NULL, key_version integer NOT NULL DEFAULT 1
);
GRANT ALL ON public.telegram_credentials TO service_role;
ALTER TABLE public.telegram_credentials ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.vehicle_audit_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), vehicle_id uuid NOT NULL, owner_at_event uuid,
 actor_id uuid, event_type text NOT NULL, changed_fields text[] NOT NULL,
 before_values jsonb, after_values jsonb, occurred_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vehicle_audit_events TO authenticated;
GRANT ALL ON public.vehicle_audit_events TO service_role;
ALTER TABLE public.vehicle_audit_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX vehicle_audit_owner_time ON public.vehicle_audit_events(owner_at_event,occurred_at);
CREATE POLICY own_vehicle_audit ON public.vehicle_audit_events FOR SELECT TO authenticated USING (
 owner_at_event=auth.uid() AND (EXISTS(SELECT 1 FROM public.vehicles v WHERE v.id=vehicle_id AND v.user_id=auth.uid()) OR NOT EXISTS(SELECT 1 FROM public.vehicles v WHERE v.id=vehicle_id))
);
CREATE TABLE public.telegram_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
 period_start timestamptz NOT NULL, period_end timestamptz NOT NULL,
 changes_count integer NOT NULL DEFAULT 0, vehicles_count integer NOT NULL DEFAULT 0, tests_count integer NOT NULL DEFAULT 0,
 delivery_status text NOT NULL DEFAULT 'claimed' CHECK (delivery_status IN ('claimed','sending','sent','failed','ambiguous','cancelled')),
 telegram_message_id bigint, send_attempts integer NOT NULL DEFAULT 0, last_error text,
 claimed_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz,
 UNIQUE(user_id,period_end), CHECK(period_start<period_end)
);
GRANT SELECT ON public.telegram_reports TO authenticated;
GRANT ALL ON public.telegram_reports TO service_role;
ALTER TABLE public.telegram_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_telegram_reports ON public.telegram_reports FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE INDEX telegram_reports_history ON public.telegram_reports(user_id,period_end DESC);
CREATE OR REPLACE FUNCTION public.audit_vehicle_activity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b jsonb; a jsonb; fields text[]; vid uuid; owner_id uuid; kind text;
BEGIN
 b:=CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD)-'updated_at'-'created_at' END;
 a:=CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW)-'updated_at'-'created_at' END;
 SELECT array_agg(key ORDER BY key) INTO fields FROM jsonb_object_keys(COALESCE(a,b)) key WHERE (a->key) IS DISTINCT FROM (b->key);
 IF fields IS NULL THEN RETURN COALESCE(NEW,OLD); END IF;
 IF TG_TABLE_NAME='vehicles' THEN
  vid:=COALESCE(NEW.id,OLD.id); owner_id:=CASE WHEN TG_OP='DELETE' THEN OLD.user_id ELSE NEW.user_id END; kind:='vehicle_'||lower(TG_OP);
 ELSE
  vid:=CASE WHEN TG_OP='DELETE' THEN OLD.vehicle_id ELSE NEW.vehicle_id END;
  SELECT user_id INTO owner_id FROM public.vehicles WHERE id=vid;
  IF owner_id IS NULL THEN SELECT owner_at_event INTO owner_id FROM public.vehicle_audit_events WHERE vehicle_id=vid AND event_type='vehicle_delete' ORDER BY occurred_at DESC LIMIT 1; END IF;
  kind:='inspection_'||lower(TG_OP);
 END IF;
 INSERT INTO public.vehicle_audit_events(vehicle_id,owner_at_event,actor_id,event_type,changed_fields,before_values,after_values) VALUES(vid,owner_id,auth.uid(),kind,fields,b,a);
 RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER audit_vehicles AFTER INSERT OR UPDATE OR DELETE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.audit_vehicle_activity();
CREATE TRIGGER audit_inspections AFTER INSERT OR UPDATE OR DELETE ON public.inspections FOR EACH ROW EXECUTE FUNCTION public.audit_vehicle_activity();
CREATE OR REPLACE FUNCTION public.save_verified_telegram_config(p_user_id uuid,p_bot_id bigint,p_username text,p_chat_id text,p_title text,p_ciphertext text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.telegram_settings(user_id,telegram_bot_id,telegram_bot_username,telegram_chat_id,telegram_chat_title,connection_verified,verified_at)
 VALUES(p_user_id,p_bot_id,p_username,p_chat_id,p_title,true,now())
 ON CONFLICT(user_id) DO UPDATE SET telegram_bot_id=excluded.telegram_bot_id,telegram_bot_username=excluded.telegram_bot_username,telegram_chat_id=excluded.telegram_chat_id,telegram_chat_title=excluded.telegram_chat_title,connection_verified=true,verified_at=now(),enabled=false,enabled_at=NULL,updated_at=now(),last_error=NULL;
 INSERT INTO public.telegram_credentials(user_id,ciphertext) VALUES(p_user_id,p_ciphertext) ON CONFLICT(user_id) DO UPDATE SET ciphertext=excluded.ciphertext;
END $$;
REVOKE ALL ON FUNCTION public.save_verified_telegram_config(uuid,bigint,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_verified_telegram_config(uuid,bigint,text,text,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.claim_telegram_report(p_user_id uuid,p_start timestamptz,p_end timestamptz) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE report_id uuid;
BEGIN
 INSERT INTO public.telegram_reports(user_id,period_start,period_end)
 SELECT p_user_id,p_start,p_end FROM public.telegram_settings WHERE user_id=p_user_id AND enabled AND connection_verified
 ON CONFLICT(user_id,period_end) DO NOTHING RETURNING id INTO report_id;
 RETURN report_id;
END $$;
REVOKE ALL ON FUNCTION public.claim_telegram_report(uuid,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_telegram_report(uuid,timestamptz,timestamptz) TO service_role;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;