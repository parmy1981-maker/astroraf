-- AstroRaf.be — gebruikersbeheer via de website (admin-only)
-- Run this once in de Supabase SQL editor (project fqjlfonsdazjwgwchvko).

-- 1. Editors krijgen een rol: enkel 'admin' mag aanvragen beheren, een
-- gewone 'editor' blijft albums/foto's mogen bewerken zoals vandaag.
alter table public.editors add column role text not null default 'editor'
  check (role in ('editor', 'admin'));

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.editors e
    where lower(e.email) = lower(coalesce(auth.jwt()->>'email', ''))
      and e.role = 'admin'
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- 2. Toegangsaanvragen. Zelfde opzet als `editors`: RLS aan, geen policies,
-- dus enkel bereikbaar via de server (service role) — nooit rechtstreeks
-- vanuit de browser, ook niet voor ingelogde admins.
create table public.access_requests (
  email text primary key,
  display_name text,
  message text,
  status text not null default 'pending' check (status in ('pending', 'blocked')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text
);
alter table public.access_requests enable row level security;

-- 3. Eerste admin — vervang door het echte e-mailadres en voer apart uit.
-- Vereist dat dat e-mailadres al als editor in de tabel staat.
-- update public.editors set role = 'admin' where email = 'REPLACE_WITH_REAL_EMAIL@gmail.com';
