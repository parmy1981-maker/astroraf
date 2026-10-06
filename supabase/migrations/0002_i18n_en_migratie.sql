-- AstroRaf.be — meertalige albums + migratie van de 3 bestaande, hard
-- gecodeerde albums naar de database.
-- Run dit in de Supabase SQL-editor NA 0001_editors_albums.sql.
-- Vervangt albums/album_photos volledig (nog zo goed als leeg na de
-- eerdere testpogingen) door een versie met 4 taalvelden per tekst.

drop table if exists public.album_photos;
drop table if exists public.albums;

create table public.albums (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]+$'),
  name_nl text not null,
  name_en text,
  name_fr text,
  name_de text,
  created_by text,
  created_at timestamptz not null default now()
);

create table public.album_photos (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums(id) on delete cascade,
  storage_path text not null,
  -- like_id behoudt de bestaande like-geschiedenis voor gemigreerde foto's
  -- (de bestandsnaam, zoals vandaag al gebruikt in photo_likes). Null voor
  -- nieuwe foto's -> die gebruiken dan gewoon hun eigen id.
  like_id text,
  caption_nl text,
  caption_en text,
  caption_fr text,
  caption_de text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.albums enable row level security;
alter table public.album_photos enable row level security;

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

-- Migratie van de 3 bestaande albums. storage_path begint met "local:" zodat
-- dynamic-albums.js het bestaande lokale bestand gebruikt i.p.v. iets in
-- Storage te verwachten (geen overbodige heruploads).

insert into public.albums (slug, name_nl, name_en, name_fr, name_de) values
  ('zonsverduistering', 'Zonsverduistering', 'Solar eclipse', 'Éclipse solaire', 'Sonnenfinsternis'),
  ('maansverduistering', 'Maansverduistering', 'Lunar eclipse', 'Éclipse lunaire', 'Mondfinsternis'),
  ('maanreeks', 'Maanreeks', 'Maanreeks', 'Maanreeks', 'Maanreeks');

insert into public.album_photos (album_id, storage_path, like_id, caption_nl, caption_en, caption_fr, caption_de, sort_order)
select id, 'local:foto''s/Eclips_Start.jpg', 'Eclips_Start.jpg',
  'Start van de zonsverduistering, astrofotografie door AstroRaf',
  'Start of the solar eclipse, astrophotography by AstroRaf',
  'Début de l''éclipse solaire, astrophotographie par AstroRaf',
  'Beginn der Sonnenfinsternis, Astrofotografie von AstroRaf', 0
from public.albums where slug = 'zonsverduistering';

insert into public.album_photos (album_id, storage_path, like_id, caption_nl, caption_en, caption_fr, caption_de, sort_order)
select id, 'local:foto''s/Eclips_Corona.jpg', 'Eclips_Corona.jpg',
  'Corona tijdens de totale zonsverduistering, astrofotografie door AstroRaf',
  'Corona during the total solar eclipse, astrophotography by AstroRaf',
  'Couronne solaire pendant l''éclipse totale, astrophotographie par AstroRaf',
  'Korona während der totalen Sonnenfinsternis, Astrofotografie von AstroRaf', 1
from public.albums where slug = 'zonsverduistering';

insert into public.album_photos (album_id, storage_path, like_id, caption_nl, caption_en, caption_fr, caption_de, sort_order)
select id, 'local:foto''s/Eclips_Einde.jpg', 'Eclips_Einde.jpg',
  'Einde van de zonsverduistering, astrofotografie door AstroRaf',
  'End of the solar eclipse, astrophotography by AstroRaf',
  'Fin de l''éclipse solaire, astrophotographie par AstroRaf',
  'Ende der Sonnenfinsternis, Astrofotografie von AstroRaf', 2
from public.albums where slug = 'zonsverduistering';

insert into public.album_photos (album_id, storage_path, like_id, caption_nl, caption_en, caption_fr, caption_de, sort_order)
select id, 'local:foto''s/Maan_Wolken.jpg', 'Maan_Wolken.jpg',
  'Maan achter wolken tijdens de maansverduistering, astrofotografie door AstroRaf',
  'Moon behind clouds during the lunar eclipse, astrophotography by AstroRaf',
  'Lune derrière les nuages pendant l''éclipse lunaire, astrophotographie par AstroRaf',
  'Mond hinter Wolken während der Mondfinsternis, Astrofotografie von AstroRaf', 0
from public.albums where slug = 'maansverduistering';

insert into public.album_photos (album_id, storage_path, like_id, caption_nl, caption_en, caption_fr, caption_de, sort_order)
select id, 'local:foto''s/Maan_Gedeeltelijk.jpg', 'Maan_Gedeeltelijk.jpg',
  'Gedeeltelijke maansverduistering, astrofotografie door AstroRaf',
  'Partial lunar eclipse, astrophotography by AstroRaf',
  'Éclipse lunaire partielle, astrophotographie par AstroRaf',
  'Partielle Mondfinsternis, Astrofotografie von AstroRaf', 1
from public.albums where slug = 'maansverduistering';

insert into public.album_photos (album_id, storage_path, like_id, caption_nl, caption_en, caption_fr, caption_de, sort_order)
select id, 'local:foto''s/Maan_Sikkel.jpg', 'Maan_Sikkel.jpg',
  'Maansverduistering in sikkelvorm, astrofotografie door AstroRaf',
  'Lunar eclipse in crescent shape, astrophotography by AstroRaf',
  'Éclipse lunaire en forme de croissant, astrophotographie par AstroRaf',
  'Mondfinsternis in Sichelform, Astrofotografie von AstroRaf', 2
from public.albums where slug = 'maansverduistering';

insert into public.album_photos (album_id, storage_path, like_id, caption_nl, caption_en, caption_fr, caption_de, sort_order)
select id, 'local:foto''s/Maan_Totaal.jpg', 'Maan_Totaal.jpg',
  'Totale maansverduistering, astrofotografie door AstroRaf',
  'Total lunar eclipse, astrophotography by AstroRaf',
  'Éclipse lunaire totale, astrophotographie par AstroRaf',
  'Totale Mondfinsternis, Astrofotografie von AstroRaf', 3
from public.albums where slug = 'maansverduistering';

insert into public.album_photos (album_id, storage_path, like_id, caption_nl, caption_en, caption_fr, caption_de, sort_order)
select id, 'local:foto''s/Maan.jpg', 'Maan.jpg',
  'De maan, astrofotografie door AstroRaf',
  'De maan, astrofotografie door AstroRaf',
  'De maan, astrofotografie door AstroRaf',
  'De maan, astrofotografie door AstroRaf', 0
from public.albums where slug = 'maanreeks';
