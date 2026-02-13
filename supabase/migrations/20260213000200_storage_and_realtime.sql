insert into storage.buckets (id, name, public)
values ('damage-photos', 'damage-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true)
on conflict (id) do nothing;

drop policy if exists "damage_photos_public_read" on storage.objects;
create policy "damage_photos_public_read"
on storage.objects for select
to authenticated
using (bucket_id = 'damage-photos');

drop policy if exists "damage_photos_owner_upload" on storage.objects;
create policy "damage_photos_owner_upload"
on storage.objects for insert
to authenticated
with check (bucket_id = 'damage-photos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "chat_attachments_public_read" on storage.objects;
create policy "chat_attachments_public_read"
on storage.objects for select
to authenticated
using (bucket_id = 'chat-attachments');

drop policy if exists "chat_attachments_owner_upload" on storage.objects;
create policy "chat_attachments_owner_upload"
on storage.objects for insert
to authenticated
with check (bucket_id = 'chat-attachments' and auth.uid()::text = (storage.foldername(name))[1]);

alter publication supabase_realtime add table public.messages;
