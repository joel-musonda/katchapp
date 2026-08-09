-- Trigger: Send push notification on new whisper (DM)
CREATE OR REPLACE FUNCTION public.send_whisper_push_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_project_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Get the Supabase URL
  v_project_url := current_setting('app.settings.supabase_url', true);
  IF v_project_url IS NULL OR v_project_url = '' THEN
    v_project_url := 'https://scvikrxfxijqoedfryvx.supabase.co';
  END IF;

  -- Get service role key from vault
  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_service_role_key'
  LIMIT 1;

  IF v_service_key IS NOT NULL THEN
    -- Only fire if receiver has push subscriptions
    IF EXISTS (SELECT 1 FROM public.push_subscriptions WHERE user_id = NEW.receiver_id) THEN
      PERFORM net.http_post(
        url := v_project_url || '/functions/v1/send-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_key
        ),
        body := jsonb_build_object(
          'user_id', NEW.receiver_id,
          'type', 'whisper',
          'actor_id', NEW.sender_id,
          'message_content', LEFT(NEW.content, 150)
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, net, vault;

CREATE TRIGGER on_whisper_send_push
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.send_whisper_push_notification();
