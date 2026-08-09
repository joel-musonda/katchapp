-- Migration: Add function to allow users to delete their own account with storage cleanup
-- This function runs with SECURITY DEFINER to allow it to delete from auth.users
-- It also cleans up related storage files (avatars, banners, post-media)

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS jsonb AS $$
DECLARE
    v_user_id UUID;
    v_project_id TEXT := 'scvikrxfxijqoedfryvx'; -- Extracted from existing migrations
    v_service_key TEXT;
    v_record RECORD;
    v_file_path TEXT;
BEGIN
    -- Get the ID of the user making the request
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('error', 'unauthorized', 'message', 'You must be logged in to delete your account');
    END IF;

    -- Get service role key for storage cleanup
    SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets
    WHERE name = 'supabase_service_role_key'
    LIMIT 1;

    -- 1. Cleanup Post Media
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

        -- 2. Cleanup Avatar and Banner
        FOR v_record IN 
            SELECT avatar_url, banner_url FROM public.profiles 
            WHERE user_id = v_user_id
        LOOP
            -- Cleanup Avatar
            IF v_record.avatar_url IS NOT NULL AND v_record.avatar_url <> '' THEN
                v_file_path := split_part(v_record.avatar_url, 'avatars/', 2);
                IF v_file_path IS NOT NULL AND v_file_path <> '' THEN
                    PERFORM net.http_delete(
                        url := 'https://' || v_project_id || '.supabase.co/storage/v1/object/avatars/' || v_file_path,
                        headers := jsonb_build_object('Authorization', 'Bearer ' || v_service_key)
                    );
                END IF;
            END IF;

            -- Cleanup Banner
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
    END IF;

    -- 3. Delete the user from auth.users
    -- This will trigger cascading deletes for profiles, posts, etc.
    DELETE FROM auth.users WHERE id = v_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Account and all data wiped successfully');
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('error', 'internal_error', 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions, vault, net;
