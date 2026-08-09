-- Migration: Add automatic storage cleanup for expired posts
--
-- The existing delete_expired_posts() cron job deletes post records after 24 hours,
-- but leaves the image files in Supabase Storage. This upgrade uses pg_net to call 
-- the Storage API before deleting expired posts.
--
-- SETUP REQUIRED: You must store your service_role key as a Supabase Vault secret.
-- Run this ONE TIME in the SQL Editor:
--
--   SELECT vault.create_secret(
--     'supabase_service_role_key',
--     'YOUR_SERVICE_ROLE_KEY_HERE'
--   );
--
-- You can find your service_role key in:
-- Supabase Dashboard > Settings > API > service_role (secret)

-- 1. Enable pg_net for HTTP requests from SQL
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Upgrade the expired posts cleanup function
CREATE OR REPLACE FUNCTION public.delete_expired_posts()
RETURNS void AS $$
DECLARE
  expired_post RECORD;
  file_path TEXT;
  service_key TEXT;
BEGIN
  -- Get the service role key from Supabase Vault
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_service_role_key'
  LIMIT 1;

  -- If we have the key, clean up storage files first
  IF service_key IS NOT NULL THEN
    FOR expired_post IN
      SELECT id, media_url FROM public.posts
      WHERE created_at < now() - INTERVAL '24 hours'
        AND media_url IS NOT NULL
        AND media_url <> ''
        AND media_url LIKE '%post-media%'
    LOOP
      -- Extract file path after 'post-media/'
      file_path := split_part(expired_post.media_url, 'post-media/', 2);

      IF file_path IS NOT NULL AND file_path <> '' THEN
        -- Call Supabase Storage API to delete the file
        -- Uses DELETE /storage/v1/object/{bucket}/{path}
        PERFORM net.http_delete(
          url := 'https://scvikrxfxijqoedfryvx.supabase.co/storage/v1/object/post-media/' || file_path,
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || service_key
          )
        );
      END IF;
    END LOOP;
  END IF;

  -- Delete expired posts (CASCADE handles comments, likes, bookmarks)
  DELETE FROM public.posts
  WHERE created_at < now() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, net, vault, extensions;
