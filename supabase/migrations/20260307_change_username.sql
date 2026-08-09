-- =============================================================================
-- Server-side username change with 7-day cooldown
-- =============================================================================


-- 1. RPC: change_username
-- Validates format, enforces 7-day cooldown, checks uniqueness, updates profile
CREATE OR REPLACE FUNCTION public.change_username(p_new_username TEXT)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_normalized TEXT;
  v_last_change_at TIMESTAMPTZ;
  v_days_remaining INT;
  v_cooldown_days INT := 7;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated', 'message', 'You must be signed in');
  END IF;

  -- Normalize
  v_normalized := LOWER(TRIM(p_new_username));

  -- Validate format
  IF LENGTH(v_normalized) < 3 OR LENGTH(v_normalized) > 20 THEN
    RETURN jsonb_build_object('error', 'invalid_format', 'message', 'Username must be 3–20 characters');
  END IF;

  IF v_normalized !~ '^[a-z0-9_]+$' THEN
    RETURN jsonb_build_object('error', 'invalid_format', 'message', 'Only lowercase letters, numbers, and underscores allowed');
  END IF;

  -- Check if unchanged
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = v_user_id AND username = v_normalized) THEN
    RETURN jsonb_build_object('error', 'unchanged', 'message', 'That is already your username');
  END IF;

  -- Check cooldown (7 days)
  SELECT MAX(created_at) INTO v_last_change_at
  FROM public.user_action_log
  WHERE user_id = v_user_id AND action_type = 'username_change';

  IF v_last_change_at IS NOT NULL AND v_last_change_at > now() - make_interval(days => v_cooldown_days) THEN
    v_days_remaining := CEIL(EXTRACT(EPOCH FROM (v_last_change_at + make_interval(days => v_cooldown_days) - now())) / 86400)::INT;
    RETURN jsonb_build_object(
      'error', 'cooldown_active',
      'message', 'You can change your username again in ' || v_days_remaining || ' day' || CASE WHEN v_days_remaining != 1 THEN 's' ELSE '' END,
      'retry_after_days', v_days_remaining,
      'available_at', v_last_change_at + make_interval(days => v_cooldown_days)
    );
  END IF;

  -- Check uniqueness
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = v_normalized AND user_id != v_user_id) THEN
    RETURN jsonb_build_object('error', 'username_taken', 'message', 'This username is already taken');
  END IF;

  -- Set session variable to allow the trigger to pass
  PERFORM set_config('app.allow_username_change', 'true', true);

  -- Perform the update
  UPDATE public.profiles
  SET username = v_normalized
  WHERE user_id = v_user_id;

  -- Log the action for cooldown tracking
  INSERT INTO public.user_action_log (user_id, action_type)
  VALUES (v_user_id, 'username_change');

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 2. Trigger: prevent direct username changes (bypass protection)
CREATE OR REPLACE FUNCTION public.prevent_direct_username_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.username IS DISTINCT FROM NEW.username THEN
    IF current_setting('app.allow_username_change', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Use the change_username() function to change your username';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'guard_username_change'
  ) THEN
    CREATE TRIGGER guard_username_change
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.prevent_direct_username_change();
  END IF;
END $$;


-- 3. Fix cleanup: preserve username_change logs for 7 days (not 48 hours)
CREATE OR REPLACE FUNCTION public.delete_expired_action_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.user_action_log
  WHERE (action_type != 'username_change' AND created_at < now() - INTERVAL '48 hours')
     OR (action_type = 'username_change' AND created_at < now() - INTERVAL '7 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 4. RPC: get_username_cooldown (single source of truth for cooldown period)
CREATE OR REPLACE FUNCTION public.get_username_cooldown()
RETURNS JSONB AS $$
DECLARE
  v_last_change_at TIMESTAMPTZ;
  v_cooldown_days INT := 7;
  v_available_at TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('on_cooldown', false);
  END IF;

  SELECT MAX(created_at) INTO v_last_change_at
  FROM public.user_action_log
  WHERE user_id = auth.uid() AND action_type = 'username_change';

  IF v_last_change_at IS NULL THEN
    RETURN jsonb_build_object('on_cooldown', false);
  END IF;

  v_available_at := v_last_change_at + make_interval(days => v_cooldown_days);

  IF v_available_at > now() THEN
    RETURN jsonb_build_object('on_cooldown', true, 'available_at', v_available_at);
  ELSE
    RETURN jsonb_build_object('on_cooldown', false);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
