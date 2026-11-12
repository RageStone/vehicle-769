ALTER TABLE public.telegram_reports ADD COLUMN telegram_message_ids bigint[] NOT NULL DEFAULT '{}';
ALTER TABLE public.telegram_reports ADD COLUMN message_parts integer NOT NULL DEFAULT 1 CHECK(message_parts>0);
ALTER TABLE public.telegram_reports ADD COLUMN sent_parts integer NOT NULL DEFAULT 0 CHECK(sent_parts>=0 AND sent_parts<=message_parts);
UPDATE public.telegram_reports SET telegram_message_ids=ARRAY[telegram_message_id],sent_parts=1 WHERE delivery_status='sent' AND telegram_message_id IS NOT NULL;
