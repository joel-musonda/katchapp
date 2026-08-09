-- Add persistent profile album (max 5 photos)

CREATE TABLE IF NOT EXISTS public.profile_album_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  photo_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_album_photos_user_created_at
  ON public.profile_album_photos (user_id, created_at DESC);

ALTER TABLE public.profile_album_photos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profile_album_photos'
      AND policyname = 'Profile album photos are viewable by everyone'
  ) THEN
    CREATE POLICY "Profile album photos are viewable by everyone"
      ON public.profile_album_photos
      FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profile_album_photos'
      AND policyname = 'Users can insert their own album photos'
  ) THEN
    CREATE POLICY "Users can insert their own album photos"
      ON public.profile_album_photos
      FOR INSERT
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profile_album_photos'
      AND policyname = 'Users can delete their own album photos'
  ) THEN
    CREATE POLICY "Users can delete their own album photos"
      ON public.profile_album_photos
      FOR DELETE
      USING ((SELECT auth.uid()) = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_profile_album_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_photo_count INTEGER;
BEGIN
  -- Serialize album inserts per user to avoid race conditions across concurrent requests.
  PERFORM 1
  FROM public.profiles
  WHERE user_id = NEW.user_id
  FOR UPDATE;

  SELECT count(*)::INTEGER INTO v_photo_count
  FROM public.profile_album_photos
  WHERE user_id = NEW.user_id;

  IF v_photo_count >= 5 THEN
    RAISE EXCEPTION 'album_limit_exceeded'
      USING ERRCODE = 'P0001',
            DETAIL = 'A profile album can contain up to 5 photos.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_profile_album_limit_trigger ON public.profile_album_photos;
CREATE TRIGGER enforce_profile_album_limit_trigger
  BEFORE INSERT ON public.profile_album_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_album_limit();

INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-album', 'profile-album', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND policyname = 'Public Access for Profile Album'
  ) THEN
    CREATE POLICY "Public Access for Profile Album"
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'profile-album');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND policyname = 'Authenticated users can upload profile album photos'
  ) THEN
    CREATE POLICY "Authenticated users can upload profile album photos"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'profile-album'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND policyname = 'Users can delete their own profile album photos'
  ) THEN
    CREATE POLICY "Users can delete their own profile album photos"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'profile-album'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

-- Include profile album cleanup when user deletes account
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS jsonb AS $$
DECLARE
    v_user_id UUID;
    v_project_id TEXT := 'scvikrxfxijqoedfryvx';
    v_service_key TEXT;
    v_record RECORD;
    v_file_path TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('error', 'unauthorized', 'message', 'You must be logged in');
    END IF;

    SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets
    WHERE name = 'supabase_service_role_key'
    LIMIT 1;

    IF v_service_key IS NOT NULL THEN
        FOR v_record IN
            SELECT media_url FROM public.posts
            WHERE user_id = v_user_id AND media_url IS NOT NULL AND media_url <> ''
        LOOP
            v_file_path := split_part(v_record.media_url, 'post-media/', 2);
            IF v_file_path IS NOT NULL AND v_file_path <> '' THEN
                PERFORM net.http_delete(
                    url := 'https://' || v_project_id || '.supabase.co/storage/v1/object/post-media/' || v_file_path,
                    headers := jsonb_build_object('Authorization', 'Bearer ' || v_service_key)
                );
            END IF;
        END LOOP;

        FOR v_record IN SELECT avatar_url, banner_url FROM public.profiles WHERE user_id = v_user_id LOOP
            IF v_record.avatar_url IS NOT NULL AND v_record.avatar_url <> '' THEN
                v_file_path := split_part(v_record.avatar_url, 'avatars/', 2);
                IF v_file_path IS NOT NULL AND v_file_path <> '' THEN
                    PERFORM net.http_delete(
                        url := 'https://' || v_project_id || '.supabase.co/storage/v1/object/avatars/' || v_file_path,
                        headers := jsonb_build_object('Authorization', 'Bearer ' || v_service_key)
                    );
                END IF;
            END IF;

            IF v_record.banner_url IS NOT NULL AND v_record.banner_url <> '' THEN
                v_file_path := split_part(v_record.banner_url, 'banners/', 2);
                IF v_file_path IS NOT NULL AND v_file_path <> '' THEN
                    PERFORM net.http_delete(
                        url := 'https://' || v_project_id || '.supabase.co/storage/v1/object/banners/' || v_file_path,
                        headers := jsonb_build_object('Authorization', 'Bearer ' || v_service_key)
                    );
                END IF;
            END IF;
        END LOOP;

        FOR v_record IN
            SELECT storage_path FROM public.profile_album_photos
            WHERE user_id = v_user_id AND storage_path IS NOT NULL AND storage_path <> ''
        LOOP
            PERFORM net.http_delete(
                url := 'https://' || v_project_id || '.supabase.co/storage/v1/object/profile-album/' || v_record.storage_path,
                headers := jsonb_build_object('Authorization', 'Bearer ' || v_service_key)
            );
        END LOOP;
    END IF;

    DELETE FROM auth.users WHERE id = v_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Account and data wiped');
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('error', 'internal_error', 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions, vault, net;
