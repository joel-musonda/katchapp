-- profiles
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((select auth.uid()) = user_id);

-- posts
DROP POLICY IF EXISTS "Users can create their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;
CREATE POLICY "Users can create their own posts" ON public.posts FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update their own posts" ON public.posts FOR UPDATE USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete their own posts" ON public.posts FOR DELETE USING ((select auth.uid()) = user_id);

-- likes
DROP POLICY IF EXISTS "Users can like posts" ON public.likes;
DROP POLICY IF EXISTS "Users can unlike posts" ON public.likes;
CREATE POLICY "Users can like posts" ON public.likes FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can unlike posts" ON public.likes FOR DELETE USING ((select auth.uid()) = user_id);

-- bookmarks
DROP POLICY IF EXISTS "Users can view their own bookmarks" ON public.bookmarks;
DROP POLICY IF EXISTS "Users can bookmark posts" ON public.bookmarks;
DROP POLICY IF EXISTS "Users can remove bookmarks" ON public.bookmarks;
CREATE POLICY "Users can view their own bookmarks" ON public.bookmarks FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can bookmark posts" ON public.bookmarks FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can remove bookmarks" ON public.bookmarks FOR DELETE USING ((select auth.uid()) = user_id);

-- follows
DROP POLICY IF EXISTS "Users can follow" ON public.follows;
DROP POLICY IF EXISTS "Users can unfollow" ON public.follows;
CREATE POLICY "Users can follow" ON public.follows FOR INSERT WITH CHECK ((select auth.uid()) = follower_id);
CREATE POLICY "Users can unfollow" ON public.follows FOR DELETE USING ((select auth.uid()) = follower_id);

-- comments
DROP POLICY IF EXISTS "Users can create their own comments" ON public.comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON public.comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.comments;
CREATE POLICY "Users can create their own comments" ON public.comments FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update their own comments" ON public.comments FOR UPDATE USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete their own comments" ON public.comments FOR DELETE USING ((select auth.uid()) = user_id);

-- messages
DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can view their own messages" ON public.messages FOR SELECT USING ((select auth.uid()) = sender_id OR (select auth.uid()) = receiver_id);
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK ((select auth.uid()) = sender_id);