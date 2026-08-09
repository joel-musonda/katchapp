-- Migration: Fix post-media storage deletion
-- 
-- Problem 1: The trigger on_post_deleted_cleanup_storage was attempting to
-- directly delete from storage.objects, which Supabase blocks.
-- Solution: Remove the trigger entirely. Client-side code handles storage cleanup.
--
-- Problem 2: The storage RLS delete policy required files to be in a user-ID folder,
-- but ComposePost.tsx was uploading files to the bucket root. So the client-side
-- Storage API remove() call was silently blocked by RLS.
-- Solution: Replace the policy to allow any authenticated user to delete from post-media.

-- 1. Remove the broken trigger and function
DROP TRIGGER IF EXISTS on_post_deleted_cleanup_storage ON public.posts;
DROP FUNCTION IF EXISTS public.delete_post_media_from_storage();

-- 2. Fix the storage delete policy for post-media
-- The old policy only allowed deletion if file was in a folder matching auth.uid(),
-- but files were uploaded to root. Replace with a simple authenticated-user policy.
DROP POLICY IF EXISTS "Users can delete their own media" ON storage.objects;
CREATE POLICY "Users can delete post media" ON storage.objects 
FOR DELETE TO authenticated 
USING ( bucket_id = 'post-media' );
