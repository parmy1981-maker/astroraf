-- Tabellen aangemaakt via de SQL-editor krijgen (anders dan via Supabase's
-- Table Editor-UI) geen automatische basisrechten voor anon/authenticated.
-- RLS-policies bepalen enkel WELKE rijen zichtbaar/schrijfbaar zijn, maar
-- zonder deze GRANT mag de rol de tabel sowieso niet aanraken ("permission
-- denied for table albums", code 42501).

grant select on public.albums, public.album_photos to anon, authenticated;
grant insert, update, delete on public.albums, public.album_photos to authenticated;
