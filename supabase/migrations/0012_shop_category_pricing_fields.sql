-- AstroRaf.be — generieke, per-rubriek editor-gedefinieerde prijsvelden.
-- Vervangt het hardgecodeerde "posters"-tweeledig prijsmodel (shop_format_prices
-- + shop_settings.shipping_fee_cents) door twee generieke tabellen:
--   - shop_category_fields: per rubriek editor-gedefinieerde velden, type
--     'variant' (bv. L/XL/XXL, 30x40/30x50, ... -- prijs per ARTIKEL) of
--     'surcharge' (bv. Transportkost -- ÉÉN gedeelde prijs per RUBRIEK).
--   - shop_product_field_prices: de eigen prijs van één artikel voor één
--     variant-veld van zijn rubriek.
-- Run dit in de Supabase SQL-editor na 0011_shop_products_restructure.sql.

create table public.shop_category_fields (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.shop_categories(id) on delete cascade,
  field_type text not null check (field_type in ('variant', 'surcharge')),
  label text not null,
  -- Enkel betekenisvol voor 'surcharge'-rijen (gedeeld per rubriek); blijft 0
  -- voor 'variant'-rijen, die hun echte prijs per artikel krijgen via
  -- shop_product_field_prices hieronder.
  price_cents integer not null default 0 check (price_cents >= 0),
  sort_order int not null default 0,
  created_by text,
  created_at timestamptz not null default now()
);

create table public.shop_product_field_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.shop_products(id) on delete cascade,
  field_id uuid not null references public.shop_category_fields(id) on delete cascade,
  price_cents integer not null default 0 check (price_cents >= 0),
  unique (product_id, field_id)
);

alter table public.shop_category_fields enable row level security;
alter table public.shop_product_field_prices enable row level security;

create policy "shop_category_fields_public_read" on public.shop_category_fields
  for select using (true);
create policy "shop_category_fields_editor_insert" on public.shop_category_fields
  for insert with check (is_editor());
create policy "shop_category_fields_editor_update" on public.shop_category_fields
  for update using (is_editor()) with check (is_editor());
create policy "shop_category_fields_editor_delete" on public.shop_category_fields
  for delete using (is_editor());

create policy "shop_product_field_prices_public_read" on public.shop_product_field_prices
  for select using (true);
create policy "shop_product_field_prices_editor_insert" on public.shop_product_field_prices
  for insert with check (is_editor());
create policy "shop_product_field_prices_editor_update" on public.shop_product_field_prices
  for update using (is_editor()) with check (is_editor());
create policy "shop_product_field_prices_editor_delete" on public.shop_product_field_prices
  for delete using (is_editor());

-- Zoals elke tabel in dit project aangemaakt via de SQL-editor: expliciete
-- grants, anders 42501 "permission denied" op elke query.
grant select on public.shop_category_fields, public.shop_product_field_prices to anon, authenticated;
grant insert, update, delete on public.shop_category_fields, public.shop_product_field_prices to authenticated;

-- ---------------------------------------------------------------------------
-- Eenmalige datamigratie: de 13 gedeelde postergroottes uit shop_format_prices
-- worden gewone 'variant'-velden van de rubriek "posters", en elk bestaand
-- posterartikel krijgt zijn eigen startprijs per veld -- gelijk aan de oude
-- gedeelde prijs, zodat niets verandert totdat een editor ze later laat
-- uiteenlopen.
with poster_cat as (
  select id from public.shop_categories where slug = 'posters'
),
format_order (format, ord) as (
  values
    ('a4', 1), ('a3', 2), ('40x60', 3), ('a2', 4), ('a2-lang', 5), ('b2', 6),
    ('60x80', 7), ('a1', 8), ('60x90', 9), ('b1', 10), ('a0', 11), ('b0', 12), ('abri', 13)
),
new_fields as (
  insert into public.shop_category_fields (category_id, field_type, label, price_cents, sort_order)
  select pc.id, 'variant', fo.format, 0, fo.ord
  from format_order fo, poster_cat pc
  returning id, label
)
insert into public.shop_product_field_prices (product_id, field_id, price_cents)
select sp.id, nf.id, fmt.price_cents
from public.shop_products sp
join poster_cat pc on sp.category_id = pc.id
join new_fields nf on true
join public.shop_format_prices fmt on fmt.format = nf.label;

-- Nu veilig: niets anders in de codebase leest shop_format_prices/shop_settings
-- meer (enkel shop.js en api/checkout/create-payment.js deden dit, allebei
-- herschreven in deze wijziging).
drop table public.shop_format_prices;
drop table public.shop_settings;
