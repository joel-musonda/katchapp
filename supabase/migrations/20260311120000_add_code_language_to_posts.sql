-- Add code_language column to posts table
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS code_language TEXT DEFAULT NULL;

-- Update create_post to accept code_language and preserve existing ban/cooldown logic
CREATE OR REPLACE FUNCTION public.create_post(
  p_content TEXT,
  p_code TEXT DEFAULT '',
  p_tags TEXT[] DEFAULT '{}',
  p_media_url TEXT DEFAULT '',
  p_is_readme BOOLEAN DEFAULT false,
  p_idempotency_key TEXT DEFAULT NULL,
  p_code_language TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_last_action_at TIMESTAMPTZ;
  v_seconds_since_last NUMERIC;
  v_cooldown_seconds INT := 30;
  v_retry_after INT;
  v_new_post_id UUID;
  v_banned_until TIMESTAMPTZ;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated', 'message', 'You must be signed in');
  END IF;

  -- Ban check for posting
  SELECT banned_until INTO v_banned_until
  FROM public.profiles
  WHERE user_id = v_user_id;

  IF v_banned_until IS NOT NULL AND v_banned_until > now() AND NOT public.is_action_allowed('post') THEN
    RETURN jsonb_build_object(
      'error', 'banned',
      'message', 'You are temporarily banned from posting',
      'banned_until', v_banned_until
    );
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.user_action_log
      WHERE user_id = v_user_id AND idempotency_key = p_idempotency_key
    ) THEN
      RETURN jsonb_build_object('success', true, 'deduplicated', true);
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('post:' || v_user_id::text));

  SELECT MAX(created_at) INTO v_last_action_at
  FROM public.user_action_log
  WHERE user_id = v_user_id AND action_type = 'post';

  IF v_last_action_at IS NOT NULL THEN
    v_seconds_since_last := EXTRACT(EPOCH FROM (now() - v_last_action_at));
    IF v_seconds_since_last < v_cooldown_seconds THEN
      v_retry_after := CEIL(v_cooldown_seconds - v_seconds_since_last)::INT;
      RETURN jsonb_build_object(
        'error', 'cooldown_active',
        'message', 'Please wait before posting again',
        'retry_after', v_retry_after
      );
    END IF;
  END IF;

  INSERT INTO public.posts (user_id, content, code, tags, media_url, is_readme, code_language)
  VALUES (v_user_id, p_content, p_code, p_tags, p_media_url, p_is_readme, p_code_language)
  RETURNING id INTO v_new_post_id;

  INSERT INTO public.user_action_log (user_id, action_type, idempotency_key)
  VALUES (v_user_id, 'post', COALESCE(p_idempotency_key, v_new_post_id::text));

  RETURN jsonb_build_object('success', true, 'post_id', v_new_post_id);
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;
