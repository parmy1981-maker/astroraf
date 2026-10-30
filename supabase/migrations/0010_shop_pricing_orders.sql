-- AstroRaf.be — prijzen + bestellingen voor de Mollie-afrekening.
-- Run dit in de Supabase SQL-editor na 0009_shop_product_text.sql.

-- 1. Eén gedeelde prijstabel voor postergroottes (13 rijen, niet per product).
create table public.shop_format_prices (
  format text primary key check (format in (
    'a4','a3','40x60','a2','a2-lang','b2','60x80','a1','60x90','b1','a0','b0','abri'
  )),
  price_cents integer not null default 0 check (price_cents >= 0),
  updated_at timestamptz not null default now(),
  updated_by text
);

insert into public.shop_format_prices (format) values
  ('a4'),('a3'),('40x60'),('a2'),('a2-lang'),('b2'),('60x80'),
  ('a1'),('60x90'),('b1'),('a0'),('b0'),('abri');

alter table public.shop_format_prices enable row level security;
create policy "shop_format_prices_public_read" on public.shop_format_prices
  for select using (true);
create policy "shop_format_prices_editor_update" on public.shop_format_prices
  for update using (is_editor()) with check (is_editor());

grant select on public.shop_format_prices to anon, authenticated;
grant update on public.shop_format_prices to authenticated;

-- 2. Shop-instellingen: singleton rij (boolean PK afgedwongen op "true").
create table public.shop_settings (
  id boolean primary key default true check (id),
  shipping_fee_cents integer not null default 0 check (shipping_fee_cents >= 0),
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into public.shop_settings (id) values (true);

alter table public.shop_settings enable row level security;
create policy "shop_settings_public_read" on public.shop_settings
  for select using (true);
create policy "shop_settings_editor_update" on public.shop_settings
  for update using (is_editor()) with check (is_editor());

grant select on public.shop_settings to anon, authenticated;
grant update on public.shop_settings to authenticated;

-- 3. Vlakke prijs per niet-poster product (editor vult dit in naast titel/beschrijving).
-- Voor producten in de rubriek "posters" blijft dit ongebruikt (0) -- die prijzen
-- komen uit shop_format_prices, de checkoutlogica splitst op categorie-slug.
alter table public.shop_products
  add column price_cents integer not null default 0 check (price_cents >= 0);

-- 4. Bestellingen. Zelfde opzet als access_requests (0006): RLS aan, geen
-- policies -- enkel bereikbaar via de server (service role) in api/checkout/*.js,
-- want dit bevat persoonsgegevens (naam/adres/e-mail) die nooit via de
-- publieke/anon of editor-sleutel rechtstreeks uit de browser mogen.
create table public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'open'
    check (status in ('open','pending','paid','failed','expired','canceled')),
  customer_name text not null,
  customer_email text not null,
  customer_address text not null,
  customer_notes text,
  subtotal_cents integer not null check (subtotal_cents >= 0),
  shipping_cents integer not null check (shipping_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  currency text not null default 'EUR',
  mollie_payment_id text unique,
  mollie_method text,
  mollie_status text,
  paid_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.shop_orders enable row level security;

create table public.shop_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders(id) on delete cascade,
  product_id uuid references public.shop_products(id) on delete set null,
  category_slug text not null,
  product_title text not null,
  format text,
  material text,
  qty integer not null check (qty > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  line_total_cents integer not null check (line_total_cents >= 0),
  created_at timestamptz not null default now()
);
alter table public.shop_order_items enable row level security;

-- Geen grants naar anon/authenticated voor shop_orders/shop_order_items:
-- enkel de service role (gebruikt in api/checkout/*.js) mag dit lezen/schrijven.
