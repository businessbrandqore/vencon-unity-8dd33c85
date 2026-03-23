
-- Add fcm_token column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS fcm_token text;

-- Create trigger function to send push notification on new chat_calls
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
        url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key', true)
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

-- Create trigger function to send push notification on new chat_messages
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
        url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key', true)
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

-- Create triggers
DROP TRIGGER IF EXISTS push_notify_call ON public.chat_calls;
CREATE TRIGGER push_notify_call
  AFTER INSERT ON public.chat_calls
  FOR EACH ROW EXECUTE FUNCTION public.trg_push_notify_call();

DROP TRIGGER IF EXISTS push_notify_message ON public.chat_messages;
CREATE TRIGGER push_notify_message
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_push_notify_message();
