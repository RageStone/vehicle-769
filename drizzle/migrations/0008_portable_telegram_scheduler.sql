-- Replace the development-only scheduler with a portable, service-role-only setup.
-- Requires the existing Vault extension; managed Lovable blocks redundant CREATE EXTENSION statements.
CREATE OR REPLACE FUNCTION public.install_telegram_schedule(p_secret text, p_url text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE job_id bigint; existing bigint; secret_id uuid;
BEGIN
 IF length(p_secret) < 32 THEN RAISE EXCEPTION 'Scheduler secret must contain at least 32 characters'; END IF;
 IF p_url !~ '^https://[A-Za-z0-9][A-Za-z0-9.-]+/api/public/telegram/process$' THEN
  RAISE EXCEPTION 'Use the deployed HTTPS Telegram processor URL';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtext('personal-telegram-daily'));
 SELECT id INTO secret_id FROM vault.secrets WHERE name='vehicle_telegram_scheduler';
 IF secret_id IS NULL THEN
  PERFORM vault.create_secret(p_secret,'vehicle_telegram_scheduler','Telegram scheduler bearer secret');
 ELSE
  PERFORM vault.update_secret(secret_id,p_secret);
 END IF;
 SELECT jobid INTO existing FROM cron.job WHERE jobname='personal-telegram-daily';
 IF existing IS NOT NULL THEN PERFORM cron.unschedule(existing); END IF;
 SELECT cron.schedule('personal-telegram-daily','0 * * * *',format(
  'SELECT net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'',''application/json'',''Authorization'',''Bearer '' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name=''vehicle_telegram_scheduler'')), body := ''{}''::jsonb, timeout_milliseconds := 120000);',p_url)) INTO job_id;
 RETURN job_id;
END $$;
REVOKE ALL ON FUNCTION public.install_telegram_schedule(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.install_telegram_schedule(text,text) TO service_role;
