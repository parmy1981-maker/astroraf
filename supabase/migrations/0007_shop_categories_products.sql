-- AstroRaf.be — shop-rubrieken en shop-producten.
-- Koppelt een bestaande albumfoto aan een rubriek (bv. "Posters", "T-shirts")
-- met een eigen "mockup"-foto (bv. de foto gedrukt op een T-shirt), zodat
-- bezoekers in de shop het eindresultaat zien in plaats van de ruwe foto.
-- Run dit in de Supabase SQL-editor na 0006_access_requests.sql.

create table public.shop_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]+$'),
  name_nl text not null,
  name_en text,
  name_fr text,
  name_de text,
  sort_order int not null default 0,
  created_by text,
  created_at timestamptz not null default now()
);

create table public.shop_products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.shop_categories(id) on delete cascade,
  album_photo_id uuid not null references public.album_photos(id) on delete cascade,
  -- Zelfde opslagvak als albumfoto's (bucket "album-photos"), enkel onder
  -- het submapje "shop/" -- geen nieuw opslagvak nodig.
  mockup_storage_path text not null,
  active boolean not null default true,
  sort_order int not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  unique (category_id, album_photo_id)
);

alter table public.shop_categories enable row level security;
alter table public.shop_products enable row level security;

create policy "shop_categories_public_read" on public.shop_categories
  for select using (true);
create policy "shop_categories_editor_insert" on public.shop_categories
  for insert with check (is_editor());
create policy "shop_categories_editor_update" on public.shop_categories
  for update using (is_editor()) with check (is_editor());
create policy "shop_categories_editor_delete" on public.shop_categories
  for delete using (is_editor());

create policy "shop_products_public_read" on public.shop_products
  for select using (true);
create policy "shop_products_editor_insert" on public.shop_products
  for insert with check (is_editor());
create policy "shop_products_editor_update" on public.shop_products
  for update using (is_editor()) with check (is_editor());
create policy "shop_products_editor_delete" on public.shop_products
  for delete using (is_editor());

-- Tabellen aangemaakt via de SQL-editor krijgen geen automatische
-- basisrechten voor anon/authenticated (zie 0003_grants.sql) -- zonder dit
-- geeft elke query "permission denied for table ..." (code 42501).
grant select on public.shop_categories, public.shop_products to anon, authenticated;
grant insert, update, delete on public.shop_categories, public.shop_products to authenticated;
