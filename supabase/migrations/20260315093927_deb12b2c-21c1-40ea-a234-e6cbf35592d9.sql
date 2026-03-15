-- Add last_message_at to chat_conversations for sorting
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS last_message_at timestamptz DEFAULT now();

-- Create trigger to update last_message_at and send notifications on new messages
CREATE OR REPLACE FUNCTION public.trg_chat_message_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _sender_name text;
  _convo_name text;
  _convo_type text;
  _participant record;
  _preview text;
BEGIN
  -- Update conversation's last_message_at
  UPDATE chat_conversations SET last_message_at = now() WHERE id = NEW.conversation_id;

  -- Get sender name
  SELECT name INTO _sender_name FROM users WHERE id = NEW.sender_id;

  -- Get conversation info
  SELECT name, type INTO _convo_name, _convo_type FROM chat_conversations WHERE id = NEW.conversation_id;

  -- Build preview
  IF NEW.content LIKE '[image](%' THEN
    _preview := '📷 ছবি পাঠিয়েছে';
  ELSE
    _preview := LEFT(NEW.content, 100);
  END IF;

  -- Notify all participants except the sender
  FOR _participant IN
    SELECT user_id FROM chat_participants
    WHERE conversation_id = NEW.conversation_id AND user_id != NEW.sender_id
  LOOP
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (
      _participant.user_id,
      COALESCE(_sender_name, 'Unknown') || ' মেসেজ পাঠিয়েছে',
      _preview,
      'chat'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chat_message_after_insert
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_chat_message_notify();