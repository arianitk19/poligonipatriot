-- ═══════════════════════════════════════════════════════════════════
--  POLIGONI PATRIOT — Skema e databazës (Supabase / PostgreSQL)
--  Ekzekutoje një herë: Supabase → SQL Editor → New query → Run.
--  Skripti mund të ekzekutohet sërish pa humbur të dhëna.
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ───────────────────────────── Administratorët ─────────────────────
-- Vetëm përdoruesit në këtë tabelë kanë qasje në panelin admin.
-- Shtimi bëhet vetëm nga SQL Editor (shih README, hapi 4).
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
drop policy if exists "admin sheh veten" on public.admins;
create policy "admin sheh veten" on public.admins for select to authenticated using (user_id = auth.uid());

-- Kthen true vetëm për admin. Nëse admini ka aktivizuar verifikimin me dy hapa (TOTP),
-- kërkohet edhe niveli aal2 (pra hyrje me kod nga aplikacioni authenticator).
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid())
     and (
       coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
       or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
     );
$$;
-- Bëhen automatikisht admin: llogaritë me numër telefoni (numri@admin.poligonipatriot.com)
-- dhe dy emailet e lejuara më poshtë. Për të shtuar një email tjetër, shtoje në të dy listat. Regjistrimet publike duhet të jenë të çaktivizuara (README, hapi 3),
-- kështu që këto llogari mund t'i krijosh vetëm ti nga paneli i Supabase.
create or replace function public.grant_admin_by_phone()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email like '%@admin.poligonipatriot.com'
     or lower(new.email) in ('arianitk2005@gmail.com', 'poligoni.patriot@gmail.com') then
    insert into public.admins (user_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end; $$;
drop trigger if exists on_auth_user_admin on auth.users;
create trigger on_auth_user_admin after insert on auth.users for each row execute function public.grant_admin_by_phone();
insert into public.admins (user_id)
select id from auth.users
where email like '%@admin.poligonipatriot.com'
   or lower(email) in ('arianitk2005@gmail.com', 'poligoni.patriot@gmail.com')
on conflict do nothing;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- Fusha updated_at përditësohet automatikisht
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end; $$;

-- ───────────────────────────── Kategoritë ──────────────────────────
create table if not exists public.categories (
  slug        text primary key check (slug ~ '^[a-z0-9-]+$'),
  name        text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 400),
  image       text,
  sort        int not null default 0,
  updated_at  timestamptz not null default now()
);
alter table public.categories enable row level security;
drop trigger if exists categories_touch on public.categories;
create trigger categories_touch before update on public.categories for each row execute function public.touch_updated_at();
drop policy if exists "kategoritë publike" on public.categories;
create policy "kategoritë publike" on public.categories for select to anon, authenticated using (true);
drop policy if exists "admin menaxhon kategoritë" on public.categories;
create policy "admin menaxhon kategoritë" on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ───────────────────────────── Produktet ───────────────────────────
create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name          text not null check (char_length(name) between 1 and 140),
  brand         text check (char_length(brand) <= 60),
  category_slug text references public.categories (slug) on update cascade on delete set null,
  origin        text check (char_length(origin) <= 60),
  caliber       text check (char_length(caliber) <= 60),
  capacity      text check (char_length(capacity) <= 30),
  barrel_length text check (char_length(barrel_length) <= 30),
  weight        text check (char_length(weight) <= 30),
  action        text check (char_length(action) <= 60),
  description   text check (char_length(description) <= 6000),
  price         numeric(10, 2) check (price is null or price >= 0),
  show_price    boolean not null default true,
  images        text[] not null default '{}',
  in_stock      boolean not null default true,
  featured      boolean not null default false,
  published     boolean not null default true,
  sort          int not null default 0,
  legacy_slug   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists products_category_idx on public.products (category_slug, sort);
create index if not exists products_legacy_idx on public.products (legacy_slug);
alter table public.products enable row level security;
drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();
drop policy if exists "produktet e publikuara" on public.products;
create policy "produktet e publikuara" on public.products for select to anon, authenticated using (published or public.is_admin());
drop policy if exists "admin menaxhon produktet" on public.products;
create policy "admin menaxhon produktet" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ───────────────────────────── Galeria ─────────────────────────────
create table if not exists public.gallery (
  id         bigint generated always as identity primary key,
  src        text not null,
  thumb      text,
  alt        text check (char_length(alt) <= 200),
  width      int,
  height     int,
  sort       int not null default 0,
  published  boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists gallery_src_uidx on public.gallery (src);
alter table public.gallery enable row level security;
drop policy if exists "galeria publike" on public.gallery;
create policy "galeria publike" on public.gallery for select to anon, authenticated using (published or public.is_admin());
drop policy if exists "admin menaxhon galerinë" on public.gallery;
create policy "admin menaxhon galerinë" on public.gallery for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ───────────────────────────── Cilësimet e faqes ───────────────────
create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
drop trigger if exists settings_touch on public.site_settings;
create trigger settings_touch before update on public.site_settings for each row execute function public.touch_updated_at();
drop policy if exists "cilësimet publike" on public.site_settings;
create policy "cilësimet publike" on public.site_settings for select to anon, authenticated using (true);
drop policy if exists "admin menaxhon cilësimet" on public.site_settings;
create policy "admin menaxhon cilësimet" on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.site_settings (key, value) values ('site', jsonb_build_object(
  'phone', '+38349394850', 'phoneDisplay', '+383 49 394 850', 'whatsapp', '38349394850',
  'email', 'info@poligonipatriot.com', 'hoursWeek', '09:00 – 22:00', 'hoursSunday', 'Mbyllur',
  'hours', jsonb_build_object('0', null, '1', '[9,22]'::jsonb, '2', '[9,22]'::jsonb, '3', '[9,22]'::jsonb, '4', '[9,22]'::jsonb, '5', '[9,22]'::jsonb, '6', '[9,22]'::jsonb),
  'announcement', null
)) on conflict (key) do nothing;

-- ───────────────────────────── Mesazhet e kontaktit ────────────────
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 120),
  phone      text not null check (char_length(phone) between 6 and 40),
  email      text check (email is null or (char_length(email) <= 160 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  reasons    text[] not null default '{}' check (cardinality(reasons) <= 8),
  message    text not null check (char_length(message) between 2 and 4000),
  source     text check (char_length(source) <= 200),
  status     text not null default 'new' check (status in ('new', 'replied', 'archived')),
  note       text check (char_length(note) <= 2000),
  created_at timestamptz not null default now()
);
create index if not exists messages_created_idx on public.messages (created_at desc);
alter table public.messages enable row level security;
drop policy if exists "kushdo dërgon mesazh" on public.messages;
create policy "kushdo dërgon mesazh" on public.messages for insert to anon, authenticated with check (status = 'new' and note is null);
drop policy if exists "admin lexon mesazhet" on public.messages;
create policy "admin lexon mesazhet" on public.messages for select to authenticated using (public.is_admin());
drop policy if exists "admin ndryshon mesazhet" on public.messages;
create policy "admin ndryshon mesazhet" on public.messages for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin fshin mesazhet" on public.messages;
create policy "admin fshin mesazhet" on public.messages for delete to authenticated using (public.is_admin());

-- ───────────────────────────── Aplikimet për certifikim ────────────
create table if not exists public.applications (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null check (char_length(full_name) between 3 and 120),
  id_number     text not null check (id_number ~ '^[0-9]{8,12}$'),
  phone         text not null check (char_length(phone) between 6 and 40),
  email         text not null check (char_length(email) <= 160 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  program       text not null check (program in ('shkurtra', 'gjata', 'te-dyja')),
  message       text check (char_length(message) <= 2000),
  id_front_path text,
  id_back_path  text,
  consent       boolean not null check (consent),
  status        text not null default 'new' check (status in ('new', 'contacted', 'approved', 'rejected', 'completed')),
  note          text check (char_length(note) <= 2000),
  created_at    timestamptz not null default now(),
  check (id_front_path is null or id_front_path like id::text || '/%'),
  check (id_back_path is null or id_back_path like id::text || '/%')
);
create index if not exists applications_created_idx on public.applications (created_at desc);
alter table public.applications enable row level security;
drop policy if exists "kushdo aplikon" on public.applications;
create policy "kushdo aplikon" on public.applications for insert to anon, authenticated with check (status = 'new' and note is null);
drop policy if exists "admin lexon aplikimet" on public.applications;
create policy "admin lexon aplikimet" on public.applications for select to authenticated using (public.is_admin());
drop policy if exists "admin ndryshon aplikimet" on public.applications;
create policy "admin ndryshon aplikimet" on public.applications for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin fshin aplikimet" on public.applications;
create policy "admin fshin aplikimet" on public.applications for delete to authenticated using (public.is_admin());

-- ───────────────────────────── Mbrojtja nga spami ──────────────────
-- Kufizim: maksimum 3 mesazhe në orë nga i njëjti telefon dhe 3 aplikime në ditë
-- me të njëjtin numër personal ose email.
create or replace function public.limit_messages()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.messages m where m.phone = new.phone and m.created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Kufiri i dërgimeve u arrit (rate limit)' using errcode = 'P0001';
  end if;
  if (select count(*) from public.messages m where m.created_at > now() - interval '1 minute') >= 20 then
    raise exception 'Kufiri i dërgimeve u arrit (rate limit)' using errcode = 'P0001';
  end if;
  return new;
end; $$;
drop trigger if exists messages_limit on public.messages;
create trigger messages_limit before insert on public.messages for each row execute function public.limit_messages();

create or replace function public.limit_applications()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.applications a
        where (a.id_number = new.id_number or lower(a.email) = lower(new.email))
          and a.created_at > now() - interval '1 day') >= 3 then
    raise exception 'Kufiri i aplikimeve u arrit (rate limit)' using errcode = 'P0001';
  end if;
  return new;
end; $$;
drop trigger if exists applications_limit on public.applications;
create trigger applications_limit before insert on public.applications for each row execute function public.limit_applications();

-- ───────────────────────────── Storage ─────────────────────────────
-- media: publik, për fotot e produkteve dhe galerisë (shkruan vetëm admini)
-- aplikimet: privat, për letërnjoftimet (kushdo ngarkon, lexon vetëm admini)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 10485760, array['image/webp', 'image/jpeg', 'image/png', 'image/avif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('aplikimet', 'aplikimet', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "media: admin ngarkon" on storage.objects;
create policy "media: admin ngarkon" on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.is_admin());
drop policy if exists "media: admin ndryshon" on storage.objects;
create policy "media: admin ndryshon" on storage.objects for update to authenticated using (bucket_id = 'media' and public.is_admin());
drop policy if exists "media: admin fshin" on storage.objects;
create policy "media: admin fshin" on storage.objects for delete to authenticated using (bucket_id = 'media' and public.is_admin());
drop policy if exists "media: admin liston" on storage.objects;
create policy "media: admin liston" on storage.objects for select to authenticated using (bucket_id = 'media' and public.is_admin());

drop policy if exists "aplikimet: kushdo ngarkon" on storage.objects;
create policy "aplikimet: kushdo ngarkon" on storage.objects for insert to anon, authenticated with check (
  bucket_id = 'aplikimet'
  and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and array_length(storage.foldername(name), 1) = 1
  and storage.filename(name) ~ '^(front|back)\.(jpg|jpeg|png|webp|pdf)$'
);
drop policy if exists "aplikimet: admin lexon" on storage.objects;
create policy "aplikimet: admin lexon" on storage.objects for select to authenticated using (bucket_id = 'aplikimet' and public.is_admin());
drop policy if exists "aplikimet: admin fshin" on storage.objects;
create policy "aplikimet: admin fshin" on storage.objects for delete to authenticated using (bucket_id = 'aplikimet' and public.is_admin());

-- ───────────────────────────── Statistika për panelin ──────────────
create or replace view public.admin_stats with (security_invoker = true) as
select
  (select count(*) from public.products)                                  as products,
  (select count(*) from public.products where published)                  as products_published,
  (select count(*) from public.applications where status = 'new')         as applications_new,
  (select count(*) from public.messages where status = 'new')             as messages_new,
  (select count(*) from public.gallery)                                   as gallery;
