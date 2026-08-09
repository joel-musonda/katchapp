-- =============================================================================
-- Migration: Mention Notifications
-- Adds support for @mention notifications in posts and comments.
-- =============================================================================

-- 1. Update the check constraint for notification types
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN ('like', 'comment', 'follow', 'mention'));

-- 2. Function to extract mentions and create notifications
-- Rules: 
-- - Mention format: @username
-- - Usernames are 3-30 chars, alphanumeric + underscore
-- - No self-mention notifications
CREATE OR REPLACE FUNCTION public.handle_mentions(
  p_content TEXT,
  p_actor_id UUID,
  p_post_id UUID,
  p_comment_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_mention RECORD;
  v_target_user_id UUID;
BEGIN
  -- Regexp explained:
  -- (^|[^a-z0-9_]): ensures @ is at start of string or preceded by a non-username character
  -- @: starts with @
  -- ([a-z0-9_]{3,30}): captures the username (3-30 alphanumeric/underscore)
  -- (?![a-z0-9_]): lookahead to ensure we don't match middle of a longer word
  -- 'gi': global and case-insensitive
  FOR v_mention IN 
    SELECT DISTINCT (regexp_matches(p_content, '(^|[^a-z0-9_])@([a-z0-9_]{3,30})(?![a-z0-9_])', 'gi'))[2] as username
  LOOP
    -- Find the user_id for this username
    SELECT user_id INTO v_target_user_id 
    FROM public.profiles 
    WHERE LOWER(username) = LOWER(v_mention.username);

    -- If user exists and is not the actor, create notification
    IF v_target_user_id IS NOT NULL AND v_target_user_id <> p_actor_id THEN
      -- Avoid duplicate mention notifications for the same post/comment
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications 
        WHERE user_id = v_target_user_id 
          AND actor_id = p_actor_id 
          AND type = 'mention' 
          AND post_id = p_post_id 
          AND (p_comment_id IS NULL OR comment_id = p_comment_id)
      ) THEN
        INSERT INTO public.notifications (user_id, actor_id, type, post_id, comment_id)
        VALUES (v_target_user_id, p_actor_id, 'mention', p_post_id, p_comment_id);
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Trigger function for posts
CREATE OR REPLACE FUNCTION public.notify_on_post_mention()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.content IS NOT NULL AND NEW.content <> '' THEN
    PERFORM public.handle_mentions(NEW.content, NEW.user_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Trigger function for comments
CREATE OR REPLACE FUNCTION public.notify_on_comment_mention()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.content IS NOT NULL AND NEW.content <> '' THEN
    PERFORM public.handle_mentions(NEW.content, NEW.user_id, NEW.post_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Attach triggers
DROP TRIGGER IF EXISTS on_post_mention_notify ON public.posts;
CREATE TRIGGER on_post_mention_notify
  AFTER INSERT OR UPDATE OF content ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_post_mention();

DROP TRIGGER IF EXISTS on_comment_mention_notify ON public.comments;
CREATE TRIGGER on_comment_mention_notify
  AFTER INSERT OR UPDATE OF content ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment_mention();
