-- AstroRaf.be — auteursrecht-veld per album.
-- Run dit in de Supabase SQL-editor na de vorige migraties.
-- Bestaande RLS/GRANT op public.albums (zie 0001/0003) is rij-niveau en
-- dekt deze nieuwe kolom dus al automatisch mee; geen aparte policy of
-- GRANT nodig.

alter table public.albums add column if not exists copyright text;
