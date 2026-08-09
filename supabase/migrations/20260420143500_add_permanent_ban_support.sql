-- Add permanent-ban capability to moderation system

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ban_permanent BOOLEAN NOT NULL DEFAULT false;

-- Remove legacy overloads so admin_ban_user resolves consistently to the new signature.
DROP FUNCTION IF EXISTS public.admin_ban_user(UUID, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.admin_ban_user(UUID, INTEGER, TEXT, TEXT[]);

-- Helper: Check if a given action is allowed for the current user (supports permanent bans)
CREATE OR REPLACE FUNCTION public.is_action_allowed(p_action TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_banned_until TIMESTAMPTZ;
  v_scopes TEXT[];
  v_ban_permanent BOOLEAN;
BEGIN
  SELECT banned_until, ban_scopes, ban_permanent
  INTO v_banned_until, v_scopes, v_ban_permanent
  FROM public.profiles
  WHERE user_id = auth.uid();

  -- If ban is not permanent, then no active/expired timestamp means allowed.
  IF NOT COALESCE(v_ban_permanent, false)
     AND (v_banned_until IS NULL OR v_banned_until <= now()) THEN
    RETURN true;
  END IF;

  -- Banned and no specific scopes set -> block all actions
  IF v_scopes IS NULL OR array_length(v_scopes, 1) IS NULL THEN
    RETURN false;
  END IF;

  -- If this action is in the blocked scopes -> disallow
  IF p_action = ANY (v_scopes) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Admin RPC: admin_ban_user (supports permanent bans)
CREATE OR REPLACE FUNCTION public.admin_ban_user(
  p_user_id UUID,
  p_minutes INTEGER,
  p_reason TEXT DEFAULT NULL,
  p_scopes TEXT[] DEFAULT NULL,
  p_permanent BOOLEAN DEFAULT false
)
RETURNS VOID AS $$
DECLARE
  v_until TIMESTAMPTZ;
  v_updated_rows INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF COALESCE(p_permanent, false) THEN
    v_until := NULL;
  ELSE
    IF p_minutes IS NULL OR p_minutes <= 0 THEN
      RAISE EXCEPTION 'invalid_ban_duration';
    END IF;
    v_until := now() + make_interval(mins => p_minutes);
  END IF;

  UPDATE public.profiles
  SET banned_until = v_until,
      ban_permanent = COALESCE(p_permanent, false),
      ban_reason = COALESCE(p_reason, ban_reason),
      ban_scopes = COALESCE(p_scopes, '{}'::text[])
  WHERE user_id = p_user_id;

  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  IF v_updated_rows = 0 THEN
    RAISE EXCEPTION 'user_profile_not_found';
  END IF;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Admin RPC: admin_unban_user (also clears permanent flag)
CREATE OR REPLACE FUNCTION public.admin_unban_user(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_updated_rows INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE public.profiles
  SET banned_until = NULL,
      ban_permanent = false,
      ban_reason = NULL,
      ban_scopes = '{}'::text[]
  WHERE user_id = p_user_id;

  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  IF v_updated_rows = 0 THEN
    RAISE EXCEPTION 'user_profile_not_found';
  END IF;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- create_post: respects permanent bans
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
  v_ban_permanent BOOLEAN := false;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated', 'message', 'You must be signed in');
  END IF;

  -- Ban check for posting
  SELECT banned_until, ban_permanent
  INTO v_banned_until, v_ban_permanent
  FROM public.profiles
  WHERE user_id = v_user_id;

  IF NOT public.is_action_allowed('post') THEN
    RETURN jsonb_build_object(
      'error', 'banned',
      'message', CASE
        WHEN v_ban_permanent THEN 'You are permanently banned from posting'
        ELSE 'You are temporarily banned from posting'
      END,
      'banned_until', v_banned_until,
      'ban_permanent', v_ban_permanent
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- create_comment: respects permanent bans
CREATE OR REPLACE FUNCTION public.create_comment(
  p_post_id UUID,
  p_content TEXT,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_last_action_at TIMESTAMPTZ;
  v_seconds_since_last NUMERIC;
  v_cooldown_seconds INT := 15;
  v_retry_after INT;
  v_new_comment_id UUID;
  v_banned_until TIMESTAMPTZ;
  v_ban_permanent BOOLEAN := false;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated', 'message', 'You must be signed in');
  END IF;

  -- Ban check for commenting
  SELECT banned_until, ban_permanent
  INTO v_banned_until, v_ban_permanent
  FROM public.profiles
  WHERE user_id = v_user_id;

  IF NOT public.is_action_allowed('comment') THEN
    RETURN jsonb_build_object(
      'error', 'banned',
      'message', CASE
        WHEN v_ban_permanent THEN 'You are permanently banned from commenting'
        ELSE 'You are temporarily banned from commenting'
      END,
      'banned_until', v_banned_until,
      'ban_permanent', v_ban_permanent
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

  PERFORM pg_advisory_xact_lock(hashtext('comment:' || v_user_id::text));

  SELECT MAX(created_at) INTO v_last_action_at
  FROM public.user_action_log
  WHERE user_id = v_user_id AND action_type = 'comment';

  IF v_last_action_at IS NOT NULL THEN
    v_seconds_since_last := EXTRACT(EPOCH FROM (now() - v_last_action_at));
    IF v_seconds_since_last < v_cooldown_seconds THEN
      v_retry_after := CEIL(v_cooldown_seconds - v_seconds_since_last)::INT;
      RETURN jsonb_build_object(
        'error', 'cooldown_active',
        'message', 'Please wait before commenting again',
        'retry_after', v_retry_after
      );
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.posts WHERE id = p_post_id) THEN
    RETURN jsonb_build_object('error', 'post_not_found', 'message', 'Post not found');
  END IF;

  INSERT INTO public.comments (post_id, user_id, content)
  VALUES (p_post_id, v_user_id, p_content)
  RETURNING id INTO v_new_comment_id;

  INSERT INTO public.user_action_log (user_id, action_type, idempotency_key)
  VALUES (v_user_id, 'comment', COALESCE(p_idempotency_key, v_new_comment_id::text));

  RETURN jsonb_build_object('success', true, 'comment_id', v_new_comment_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
