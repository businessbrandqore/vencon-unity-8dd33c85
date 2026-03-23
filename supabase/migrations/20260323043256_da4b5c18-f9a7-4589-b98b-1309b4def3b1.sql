
-- Update trigger functions to use direct URL instead of app.settings
CREATE OR REPLACE FUNCTION public.trg_push_notify_call()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _participant record;
  _caller_name text;
  _caller_phone text;
  _receiver_token text;
  _supabase_url text := 'https://glpspuybeyayqwxkpfqb.supabase.co';
  _anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdscHNwdXliZXlheXF3eGtwZnFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzY4NDcsImV4cCI6MjA4ODcxMjg0N30.vqyegYG9rBEee77D_S0RgURJM9oe4Gy0AA1jmEou3RI';
BEGIN
  IF NEW.status != 'ringing' THEN RETURN NEW; END IF;

  SELECT name, phone INTO _caller_name, _caller_phone FROM users WHERE id = NEW.caller_id;

  FOR _participant IN
    SELECT cp.user_id FROM chat_participants cp
    WHERE cp.conversation_id = NEW.conversation_id AND cp.user_id != NEW.caller_id
  LOOP
    SELECT fcm_token INTO _receiver_token FROM users WHERE id = _participant.user_id AND fcm_token IS NOT NULL;
    IF _receiver_token IS NOT NULL THEN
      PERFORM net.http_post(
        url := _supabase_url || '/functions/v1/send-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || _anon_key
        ),
        body := jsonb_build_object(
          'fcm_token', _receiver_token,
          'type', 'call',
          'caller_name', COALESCE(_caller_name, 'Unknown'),
          'caller_number', COALESCE(_caller_phone, '')
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_push_notify_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _participant record;
  _sender_name text;
  _preview text;
  _receiver_token text;
  _supabase_url text := 'https://glpspuybeyayqwxkpfqb.supabase.co';
  _anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdscHNwdXliZXlheXF3eGtwZnFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzY4NDcsImV4cCI6MjA4ODcxMjg0N30.vqyegYG9rBEee77D_S0RgURJM9oe4Gy0AA1jmEou3RI';
BEGIN
  SELECT name INTO _sender_name FROM users WHERE id = NEW.sender_id;

  IF NEW.content LIKE '[image](%' THEN
    _preview := '📷 ছবি পাঠিয়েছে';
  ELSE
    _preview := LEFT(NEW.content, 100);
  END IF;

  FOR _participant IN
    SELECT cp.user_id FROM chat_participants cp
    WHERE cp.conversation_id = NEW.conversation_id AND cp.user_id != NEW.sender_id
  LOOP
    SELECT fcm_token INTO _receiver_token FROM users WHERE id = _participant.user_id AND fcm_token IS NOT NULL;
    IF _receiver_token IS NOT NULL THEN
      PERFORM net.http_post(
        url := _supabase_url || '/functions/v1/send-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || _anon_key
        ),
        body := jsonb_build_object(
          'fcm_token', _receiver_token,
          'type', 'chat',
          'title', COALESCE(_sender_name, 'Unknown'),
          'body', _preview
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;
