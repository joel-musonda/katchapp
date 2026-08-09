-- Add post view tracking with unique viewer dedupe (per post lifecycle)

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS views_count BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.post_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  viewer_key TEXT NOT NULL,
  viewer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  trigger TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, viewer_key)
);

CREATE INDEX IF NOT EXISTS idx_post_views_post_id ON public.post_views(post_id);
CREATE INDEX IF NOT EXISTS idx_post_views_viewer_user_id ON public.post_views(viewer_user_id);
CREATE INDEX IF NOT EXISTS idx_post_views_created_at ON public.post_views(created_at DESC);

ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.record_post_view(
  p_post_id UUID,
  p_viewer_key TEXT,
  p_trigger TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_post_owner UUID;
  v_user_id UUID;
  v_user_key TEXT;
  v_guest_key TEXT;
  v_views_count BIGINT := 0;
  v_inserted_rows INTEGER := 0;
BEGIN
  IF p_post_id IS NULL THEN
    RETURN jsonb_build_object('counted', false, 'reason', 'invalid_input');
  END IF;

  v_user_id := auth.uid();
  IF p_viewer_key IS NOT NULL AND btrim(p_viewer_key) <> '' THEN
    v_guest_key := btrim(p_viewer_key);
  END IF;

  SELECT user_id, views_count
  INTO v_post_owner, v_views_count
  FROM public.posts
  WHERE id = p_post_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('counted', false, 'reason', 'post_not_found');
  END IF;

  IF v_user_id IS NOT NULL THEN
    v_user_key := 'u:' || v_user_id::text;

    -- Do not count author self views.
    IF v_post_owner = v_user_id THEN
      RETURN jsonb_build_object(
        'counted', false,
        'reason', 'self_view',
        'views_count', COALESCE(v_views_count, 0)
      );
    END IF;

    -- If user was already counted (by user key or previous linked guest row), stop.
    IF EXISTS (
      SELECT 1
      FROM public.post_views
      WHERE post_id = p_post_id
        AND (viewer_key = v_user_key OR viewer_user_id = v_user_id)
    ) THEN
      RETURN jsonb_build_object(
        'counted', false,
        'reason', 'already_counted',
        'views_count', COALESCE(v_views_count, 0)
      );
    END IF;

    -- If same browser already counted as guest, link row to user and do not increment again.
    IF v_guest_key IS NOT NULL
       AND left(v_guest_key, 2) = 'g:'
       AND length(v_guest_key) BETWEEN 12 AND 82
       AND v_guest_key ~ '^g:[a-z0-9-]+$' THEN
      UPDATE public.post_views
      SET viewer_user_id = v_user_id
      WHERE post_id = p_post_id
        AND viewer_key = v_guest_key;

      GET DIAGNOSTICS v_inserted_rows = ROW_COUNT;
      IF v_inserted_rows > 0 THEN
        RETURN jsonb_build_object(
          'counted', false,
          'reason', 'already_counted',
          'views_count', COALESCE(v_views_count, 0)
        );
      END IF;
    END IF;

    INSERT INTO public.post_views (post_id, viewer_key, viewer_user_id, trigger)
    VALUES (p_post_id, v_user_key, v_user_id, p_trigger)
    ON CONFLICT (post_id, viewer_key) DO NOTHING;
  ELSE
    -- Guest path: require a bounded key with expected prefix/charset.
    IF v_guest_key IS NULL
       OR left(v_guest_key, 2) <> 'g:'
       OR length(v_guest_key) NOT BETWEEN 12 AND 82
       OR v_guest_key !~ '^g:[a-z0-9-]+$' THEN
      RETURN jsonb_build_object('counted', false, 'reason', 'invalid_input');
    END IF;

    INSERT INTO public.post_views (post_id, viewer_key, viewer_user_id, trigger)
    VALUES (p_post_id, v_guest_key, NULL, p_trigger)
    ON CONFLICT (post_id, viewer_key) DO NOTHING;
  END IF;

  GET DIAGNOSTICS v_inserted_rows = ROW_COUNT;

  IF v_inserted_rows > 0 THEN
    UPDATE public.posts
    SET views_count = views_count + 1
    WHERE id = p_post_id
    RETURNING views_count INTO v_views_count;

    RETURN jsonb_build_object(
      'counted', true,
      'reason', 'counted',
      'views_count', COALESCE(v_views_count, 0)
    );
  END IF;

  SELECT views_count INTO v_views_count
  FROM public.posts
  WHERE id = p_post_id;

  RETURN jsonb_build_object(
    'counted', false,
    'reason', 'already_counted',
    'views_count', COALESCE(v_views_count, 0)
  );
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;
