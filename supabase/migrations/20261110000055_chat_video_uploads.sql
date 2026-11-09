-- 10 Nov 2026 (asked for by Taj): Tali watches videos.
-- Videos are uploaded by the app to the same private chat-uploads bucket as photos and PDFs, under
-- <user id>/<conversation id>/, and sent to tali-chat as { kind: 'video', path, name, size, seconds }.
-- The bucket only took images, PDFs and audio up to 10 MB, so this raises the limit to 200 MB and
-- adds the three video types. The storage policies (own folder only) are unchanged.
-- NOT APPLIED YET: Taj runs this in the SQL editor
-- (https://supabase.com/dashboard/project/jbyzblwrywgxilhmfyjt/sql/new) before the video build ships.
update storage.buckets
   set file_size_limit = 209715200,
       allowed_mime_types = (
         select array_agg(distinct t)
           from unnest(coalesce(allowed_mime_types, '{}') || array['video/mp4', 'video/quicktime', 'video/webm']) as t
       )
 where id = 'chat-uploads';
