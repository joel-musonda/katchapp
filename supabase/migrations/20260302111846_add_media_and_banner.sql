-- 1. Update Tables to support Rich Media and Banners
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS media_url TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banner_url TEXT DEFAULT '';

-- 2. Create the 'post-media' storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-media', 'post-media', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Set up Storage Policies for 'post-media'
-- Allow public access to view images
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Public Access'
    ) THEN
        CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'post-media' );
    END IF;
END
$$;

-- Allow authenticated users to upload images
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Authenticated users can upload'
    ) THEN
        CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'post-media' );
    END IF;
END
$$;

-- Allow users to delete their own images
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Users can delete their own media'
    ) THEN
        CREATE POLICY "Users can delete their own media" ON storage.objects FOR DELETE TO authenticated USING ( bucket_id = 'post-media' AND (storage.foldername(name))[1] = auth.uid()::text );
    END IF;
END
$$;
