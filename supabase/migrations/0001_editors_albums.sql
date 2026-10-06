-- AstroRaf.be — editors + dynamic albums
-- Run this once in the Supabase SQL editor (project fqjlfonsdazjwgwchvko).
-- Before running: check the exact column names of storage.buckets on this
-- Supabase version with `select * from storage.buckets limit 1;` and adjust
-- the insert below if `file_size_limit` / `allowed_mime_types` differ.

-- 1. Allow-list of approved editor emails.
-- RLS enabled with NO policies at all, so no role (anon or authenticated)
-- can SELECT/INSERT/UPDATE/DELETE it directly — only the project owner via
-- the Supabase dashboard (service role) can touch it.
create table public.editors (
  email text primary key,
  created_at timestamptz not null default now()
);
alter table public.editors enable row level security;

-- 2. is_editor(): security definer so it can read `editors` despite the
-- table's own RLS blocking normal querying. Only ever returns a boolean,
-- so nothing about the allow-list itself leaks to callers.
create or replace function public.is_editor()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.editors e
    where lower(e.email) = lower(coalesce(auth.jwt()->>'email', ''))
  );
$$;
revoke all on function public.is_editor() from public;
grant execute on function public.is_editor() to anon, authenticated;

-- 3. Albums + photos.
-- slug is constrained to [a-z0-9-] because it is reused verbatim as the
-- data-open-album / data-album-detail value and inside the "#album:photo"
-- URL-hash deep-link syntax gallery.js parses by splitting on ":".
create table public.albums (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  created_by text,
  created_at timestamptz not null default now()
);

create table public.album_photos (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums(id) on delete cascade,
  storage_path text not null,
  caption text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.albums enable row level security;
alter table public.album_photos enable row level security;

-- Public read (anon), editor-only write.
create policy "albums_public_read" on public.albums
  for select using (true);
create policy "albums_editor_insert" on public.albums
  for insert with check (is_editor());
create policy "albums_editor_update" on public.albums
  for update using (is_editor()) with check (is_editor());
create policy "albums_editor_delete" on public.albums
  for delete using (is_editor());

create policy "album_photos_public_read" on public.album_photos
  for select using (true);
create policy "album_photos_editor_insert" on public.album_photos
  for insert with check (is_editor());
create policy "album_photos_editor_update" on public.album_photos
  for update using (is_editor()) with check (is_editor());
create policy "album_photos_editor_delete" on public.album_photos
  for delete using (is_editor());

-- 4. Storage bucket for uploaded photos: public read, editor-only write.
-- File-type/size limits enforced at the Storage layer itself, since there
-- is no serverless function to validate uploads server-side.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('album-photos', 'album-photos', true, 15728640,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "album_photos_bucket_public_read" on storage.objects
  for select using (bucket_id = 'album-photos');
create policy "album_photos_bucket_editor_insert" on storage.objects
  for insert with check (bucket_id = 'album-photos' and is_editor());
create policy "album_photos_bucket_editor_update" on storage.objects
  for update using (bucket_id = 'album-photos' and is_editor())
  with check (bucket_id = 'album-photos' and is_editor());
create policy "album_photos_bucket_editor_delete" on storage.objects
  for delete using (bucket_id = 'album-photos' and is_editor());

-- 5. First trusted editor — replace with the real email before running,
-- or update it afterwards with:
--   update public.editors set email = 'real@gmail.com' where email = 'REPLACE_WITH_REAL_EMAIL@gmail.com';
insert into public.editors (email) values ('REPLACE_WITH_REAL_EMAIL@gmail.com');
