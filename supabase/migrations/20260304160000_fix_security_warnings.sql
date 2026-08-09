-- Fix mutable search_path security warning for delete_expired_posts
CREATE OR REPLACE FUNCTION public.delete_expired_posts()
RETURNS void AS $$
BEGIN
  DELETE FROM public.posts
  WHERE created_at < now() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Fix mutable search_path security warning for delete_expired_whispers
CREATE OR REPLACE FUNCTION public.delete_expired_whispers()
RETURNS void AS $$
BEGIN
  DELETE FROM public.messages
  WHERE created_at < now() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';