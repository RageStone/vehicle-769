CREATE OR REPLACE FUNCTION public.install_telegram_schedule(p_secret text,p_url text) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE job_id bigint; existing bigint;
BEGIN
 IF p_url <> 'https://project--d51e6d99-42f6-4089-8d93-77e71050f930-dev.lovable.app/api/public/telegram/process' THEN RAISE EXCEPTION 'Invalid scheduler URL'; END IF;
 SELECT jobid INTO existing FROM cron.job WHERE jobname='personal-telegram-daily';
 IF existing IS NOT NULL THEN PERFORM cron.unschedule(existing); END IF;
 SELECT cron.schedule('personal-telegram-daily','0 * * * *',format('SELECT net.http_post(url := %L, headers := %L::jsonb, body := ''{}''::jsonb, timeout_milliseconds := 120000);',p_url,jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||p_secret)::text)) INTO job_id;
 RETURN job_id;
END $$;
REVOKE ALL ON FUNCTION public.install_telegram_schedule(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.install_telegram_schedule(text,text) TO service_role;