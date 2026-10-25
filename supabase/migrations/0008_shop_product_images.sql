-- AstroRaf.be — meerdere mockup-foto's per shop-product.
-- Elk shop_products-rij kreeg tot nu toe precies 1 mockup-foto
-- (mockup_storage_path). Dat wordt vervangen door een eigen tabel zodat
-- een product 2 of meer foto's kan hebben (hover = 2de foto tonen,
-- klikken in de detailweergave = links/rechts door de foto's bladeren).
-- Run dit in de Supabase SQL-editor na 0007_shop_categories_products.sql.

create table public.shop_product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.shop_products(id) on delete cascade,
  storage_path text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.shop_product_images enable row level security;

create policy "shop_product_images_public_read" on public.shop_product_images
  for select using (true);
create policy "shop_product_images_editor_insert" on public.shop_product_images
  for insert with check (is_editor());
create policy "shop_product_images_editor_update" on public.shop_product_images
  for update using (is_editor()) with check (is_editor());
create policy "shop_product_images_editor_delete" on public.shop_product_images
  for delete using (is_editor());

grant select on public.shop_product_images to anon, authenticated;
grant insert, update, delete on public.shop_product_images to authenticated;

-- Bestaande enkelvoudige mockup-foto's overzetten (no-op als er nog geen
-- producten getagd waren) vóór de oude kolom verdwijnt.
insert into public.shop_product_images (product_id, storage_path, sort_order)
select id, mockup_storage_path, 0 from public.shop_products;

alter table public.shop_products drop column mockup_storage_path;
