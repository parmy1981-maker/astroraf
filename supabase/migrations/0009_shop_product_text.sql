-- AstroRaf.be — eigen titel + beschrijving per shop-product.
-- Tot nu toe gebruikte de shop de caption van de gekoppelde albumfoto als
-- productnaam. Die caption is bedoeld voor de albums-pagina, niet voor de
-- shop. Elk shop-product krijgt nu een eigen (optionele) titel en
-- beschrijving per taal, te bewerken via het shop-tag-paneel op fotos.html.
-- Run dit in de Supabase SQL-editor na 0008_shop_product_images.sql.

alter table public.shop_products
  add column title_nl text,
  add column title_en text,
  add column title_fr text,
  add column title_de text,
  add column description_nl text,
  add column description_en text,
  add column description_fr text,
  add column description_de text;
