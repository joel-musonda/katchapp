-- Migration: Add trigger for post media storage cleanup
-- This ensures that when a post is deleted (manually or via 24h cron), 
-- its associated media file is removed from Supabase Storage.

CREATE OR REPLACE FUNCTION public.delete_post_media_from_storage()
RETURNS TRIGGER AS $$
DECLARE
  file_path TEXT;
BEGIN
  -- Only proceed if there is a media URL and it looks like it belongs to our storage
  -- We check for the bucket 'post-media' in the URL
  IF OLD.media_url IS NOT NULL AND OLD.media_url <> '' AND OLD.media_url LIKE '%/storage/v1/object/public/post-media/%' THEN
    
    -- Extract the file path (filename) from the URL
    -- The URL structure is: .../post-media/[filename]
    file_path := reverse(split_part(reverse(OLD.media_url), '/', 1));
    
    -- Delete the object record from storage.objects
    -- This physically deletes the file from the bucket managed by Supabase
    -- Using SECURITY DEFINER on the function ensures it has permissions to modify storage.objects
    DELETE FROM storage.objects
    WHERE bucket_id = 'post-media'
    AND name = file_path;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, storage;

-- Add the trigger to the posts table
-- Fires BEFORE DELETE so we can access OLD.media_url
DROP TRIGGER IF EXISTS on_post_deleted_cleanup_storage ON public.posts;
CREATE TRIGGER on_post_deleted_cleanup_storage
  BEFORE DELETE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_post_media_from_storage();
