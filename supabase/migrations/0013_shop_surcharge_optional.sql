-- AstroRaf.be — algemene kosten (bv. Verzendkosten) kunnen voortaan verplicht
-- of optioneel zijn. Verplicht: komt altijd bij, zoals vandaag. Optioneel: de
-- klant krijgt op de productpagina een aanvinkvakje en beslist zelf.
-- Run dit in de Supabase SQL-editor na 0012_shop_category_pricing_fields.sql.

alter table public.shop_category_fields
  add column mandatory boolean not null default true;
