-- AstroRaf.be — shop-artikelen voortaan volledig aanmaken/bewerken vanuit
-- shop.html zelf, albumfoto's krijgen enkel nog een lichte many-to-many
-- koppeling (via een leesbaar volgnummer) naar bestaande artikelen.
-- Run na 0010_shop_pricing_orders.sql.

-- 1. album_photo_id optioneel maken + de oude 1-op-1 unique-constraint weg
-- (inline aangemaakt zonder naam in 0007 -- dit is Postgres' standaardnaam;
-- verifieer na het draaien met \d shop_products dat hij echt weg is).
alter table public.shop_products
  drop constraint if exists shop_products_category_id_album_photo_id_key;

alter table public.shop_products
  alter column album_photo_id drop not null;

-- 2. Leesbaar volgnummer: een editor koppelt een albumfoto aan een artikel
-- door gewoon dit nummer te typen, geen UUID nodig. Formaat: JJVV (2-cijferig
-- jaartal + 2-cijferig volgnummer binnen dat jaar, bv. 2601, 2602, ... 2701
-- vanaf 2027). Telt per jaar opnieuw vanaf 01 -- bij meer dan 99 artikelen in
-- hetzelfde jaar loopt het volgnummer gewoon door naar 3+ cijfers (JJ100).
create table public.shop_product_number_seq (
  year_two_digit int primary key,
  next_seq int not null default 1
);

-- RLS aan, geen policies, geen grants -- enkel bereikbaar via de
-- security-definer functie hieronder (draait als de tabel-eigenaar, dus
-- RLS-onafhankelijk), nooit rechtstreeks vanuit de browser.
alter table public.shop_product_number_seq enable row level security;

create or replace function public.next_shop_product_number()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  yy int := (extract(year from now())::int % 100);
  seq int;
begin
  insert into public.shop_product_number_seq (year_two_digit, next_seq)
  values (yy, 2)
  on conflict (year_two_digit) do update set next_seq = shop_product_number_seq.next_seq + 1
  returning next_seq - 1 into seq;
  return yy * 100 + seq;
end;
$$;

revoke all on function public.next_shop_product_number() from public;
grant execute on function public.next_shop_product_number() to authenticated;

alter table public.shop_products
  add column product_number int unique not null default public.next_shop_product_number();

-- 3. Many-to-many koppeling tussen albumfoto's en shop-artikelen -- dit is
-- voortaan de enige bron voor de publieke "beschikbaar in shop"-badge,
-- los van het optionele album_photo_id-basisfotoveld op shop_products zelf.
create table public.shop_product_photo_links (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.shop_products(id) on delete cascade,
  photo_id uuid not null references public.album_photos(id) on delete cascade,
  created_by text,
  created_at timestamptz not null default now(),
  unique (product_id, photo_id)
);

alter table public.shop_product_photo_links enable row level security;

create policy "shop_product_photo_links_public_read" on public.shop_product_photo_links
  for select using (true);
create policy "shop_product_photo_links_editor_insert" on public.shop_product_photo_links
  for insert with check (is_editor());
create policy "shop_product_photo_links_editor_delete" on public.shop_product_photo_links
  for delete using (is_editor());

grant select on public.shop_product_photo_links to anon, authenticated;
grant insert, delete on public.shop_product_photo_links to authenticated;

-- 4. Backfill: het bestaande 1-op-1-verband overzetten naar de nieuwe
-- linktabel, zodat die foto onmiddellijk de nieuwe badge krijgt.
insert into public.shop_product_photo_links (product_id, photo_id)
select id, album_photo_id from public.shop_products where album_photo_id is not null
on conflict (product_id, photo_id) do nothing;
