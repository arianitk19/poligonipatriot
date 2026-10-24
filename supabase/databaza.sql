-- POLIGONI PATRIOT — Databaza e plotë (struktura + të dhënat)
-- Ngjite gjithë këtë skedar te Supabase → SQL Editor → Run.

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


-- ═══════════ TË DHËNAT: kategoritë, 20 armët, galeria ═══════════
-- Gjeneruar automatikisht nga scripts/seed.mjs më 2026-10-24T09:28:17.457Z
-- Mund të ekzekutohet disa herë: rreshtat ekzistues përditësohen.
begin;

-- Kategoritë
insert into public.categories (slug, name, description, image, sort) values ('arme-te-shkurta', 'Armë të shkurtra', 'Pistoleta dhe revolverë të kalibrave të ndryshëm.', '/assets/img/gallery/thumbs/g113.webp', 10)
  on conflict (slug) do update set name = excluded.name, description = excluded.description, image = excluded.image, sort = excluded.sort;
insert into public.categories (slug, name, description, image, sort) values ('arme-te-gjata', 'Armë të gjata', 'Pushkë gjahu dhe sportive, gjysmë-automatike dhe me shul.', '/assets/img/site/cat-pushka.webp', 20)
  on conflict (slug) do update set name = excluded.name, description = excluded.description, image = excluded.image, sort = excluded.sort;
insert into public.categories (slug, name, description, image, sort) values ('shotgune', 'Shotgunë', 'Modele gjysmë-automatike dhe me pompë për gjueti dhe sport.', '/assets/img/site/cat-shotgun.webp', 30)
  on conflict (slug) do update set name = excluded.name, description = excluded.description, image = excluded.image, sort = excluded.sort;
insert into public.categories (slug, name, description, image, sort) values ('municione', 'Municione', 'Për armë të shkurtra, të gjata, rimfire dhe shotgunë.', '/assets/img/site/municione.webp', 40)
  on conflict (slug) do update set name = excluded.name, description = excluded.description, image = excluded.image, sort = excluded.sort;
insert into public.categories (slug, name, description, image, sort) values ('optika', 'Optika', 'Dylbi, red dot, reflex dhe matës distancash.', '/assets/img/site/cat-optika.webp', 50)
  on conflict (slug) do update set name = excluded.name, description = excluded.description, image = excluded.image, sort = excluded.sort;
insert into public.categories (slug, name, description, image, sort) values ('aksesore-veshje-taktike', 'Aksesorë & veshje taktike', 'Karikatorë, mbajtëse, drita, pastrim, çanta, thika dhe veshje.', '/assets/img/site/cat-taktike.webp', 60)
  on conflict (slug) do update set name = excluded.name, description = excluded.description, image = excluded.image, sort = excluded.sort;

-- Produktet
insert into public.products (slug, name, brand, category_slug, origin, caliber, capacity, barrel_length, weight, action, description, price, show_price, images, in_stock, featured, published, sort, legacy_slug) values ('canik-sfx-rival-s-chrome', 'Canik SFx Rival-S Chrome', 'Canik', 'arme-te-shkurta', 'Turqi', '9x19mm', null, null, null, null, null, null, true, array['/assets/img/products/canik-sfx-rival-s-chrome.webp']::text[], true, true, true, 10, null)
  on conflict (slug) do update set name = excluded.name, brand = excluded.brand, category_slug = excluded.category_slug, origin = excluded.origin, caliber = excluded.caliber, capacity = excluded.capacity, barrel_length = excluded.barrel_length, weight = excluded.weight, action = excluded.action, description = excluded.description, price = excluded.price, show_price = excluded.show_price, images = excluded.images, in_stock = excluded.in_stock, featured = excluded.featured, published = excluded.published, sort = excluded.sort, legacy_slug = excluded.legacy_slug;
insert into public.products (slug, name, brand, category_slug, origin, caliber, capacity, barrel_length, weight, action, description, price, show_price, images, in_stock, featured, published, sort, legacy_slug) values ('canik-tti-combat', 'Canik TTI Combat', 'Canik', 'arme-te-shkurta', 'Turqi', '9x19mm', null, null, null, null, null, null, true, array['/assets/img/products/canik-tti-combat.webp']::text[], true, true, true, 20, null)
  on conflict (slug) do update set name = excluded.name, brand = excluded.brand, category_slug = excluded.category_slug, origin = excluded.origin, caliber = excluded.caliber, capacity = excluded.capacity, barrel_length = excluded.barrel_length, weight = excluded.weight, action = excluded.action, description = excluded.description, price = excluded.price, show_price = excluded.show_price, images = excluded.images, in_stock = excluded.in_stock, featured = excluded.featured, published = excluded.published, sort = excluded.sort, legacy_slug = excluded.legacy_slug;
insert into public.products (slug, name, brand, category_slug, origin, caliber, capacity, barrel_length, weight, action, description, price, show_price, images, in_stock, featured, published, sort, legacy_slug) values ('canik-tp9-sf-elite-s', 'Canik TP9 SF Elite-S', 'Canik', 'arme-te-shkurta', 'Turqi', '9x19mm', null, null, null, null, null, null, true, array['/assets/img/products/canik-tp9-sf-elite-s.webp']::text[], true, false, true, 30, null)
  on conflict (slug) do update set name = excluded.name, brand = excluded.brand, category_slug = excluded.category_slug, origin = excluded.origin, caliber = excluded.caliber, capacity = excluded.capacity, barrel_length = excluded.barrel_length, weight = excluded.weight, action = excluded.action, description = excluded.description, price = excluded.price, show_price = excluded.show_price, images = excluded.images, in_stock = excluded.in_stock, featured = excluded.featured, published = excluded.published, sort = excluded.sort, legacy_slug = excluded.legacy_slug;
insert into public.products (slug, name, brand, category_slug, origin, caliber, capacity, barrel_length, weight, action, description, price, show_price, images, in_stock, featured, published, sort, legacy_slug) values ('cz-shadow-2-carry', 'CZ Shadow 2 Carry', 'CZ', 'arme-te-shkurta', 'Çeki', '9x19mm', null, null, null, null, null, null, true, array['/assets/img/products/cz-shadow-2-carry.webp']::text[], true, true, true, 40, null)
  on conflict (slug) do update set name = excluded.name, brand = excluded.brand, category_slug = excluded.category_slug, origin = excluded.origin, caliber = excluded.caliber, capacity = excluded.capacity, barrel_length = excluded.barrel_length, weight = excluded.weight, action = excluded.action, description = excluded.description, price = excluded.price, show_price = excluded.show_price, images = excluded.images, in_stock = excluded.in_stock, featured = excluded.featured, published = excluded.published, sort = excluded.sort, legacy_slug = excluded.legacy_slug;
insert into public.products (slug, name, brand, category_slug, origin, caliber, capacity, barrel_length, weight, action, description, price, show_price, images, in_stock, featured, published, sort, legacy_slug) values ('sig-sauer-p226', 'Sig Sauer P226', 'Sig Sauer', 'arme-te-shkurta', 'SHBA', '9x19mm', null, null, null, null, null, null, true, array['/assets/img/products/sig-sauer-p226.webp']::text[], true, true, true, 50, null)
  on conflict (slug) do update set name = excluded.name, brand = excluded.brand, category_slug = excluded.category_slug, origin = excluded.origin, caliber = excluded.caliber, capacity = excluded.capacity, barrel_length = excluded.barrel_length, weight = excluded.weight, action = excluded.action, description = excluded.description, price = excluded.price, show_price = excluded.show_price, images = excluded.images, in_stock = excluded.in_stock, featured = excluded.featured, published = excluded.published, sort = excluded.sort, legacy_slug = excluded.legacy_slug;
insert into public.products (slug, name, brand, category_slug, origin, caliber, capacity, barrel_length, weight, action, description, price, show_price, images, in_stock, featured, published, sort, legacy_slug) values ('sig-sauer-p320', 'Sig Sauer P320', 'Sig Sauer', 'arme-te-shkurta', 'SHBA', '9x19mm', null, null, null, null, null, null, true, array['/assets/img/products/sig-sauer-p320.webp']::text[], true, false, true, 60, null)
  on conflict (slug) do update set name = excluded.name, brand = excluded.brand, category_slug = excluded.category_slug, origin = excluded.origin, caliber = excluded.caliber, capacity = excluded.capacity, barrel_length = excluded.barrel_length, weight = excluded.weight, action = excluded.action, description = excluded.description, price = excluded.price, show_price = excluded.show_price, images = excluded.images, in_stock = excluded.in_stock, featured = excluded.featured, published = excluded.published, sort = excluded.sort, legacy_slug = excluded.legacy_slug;
insert into public.products (slug, name, brand, category_slug, origin, caliber, capacity, barrel_length, weight, action, description, price, show_price, images, in_stock, featured, published, sort, legacy_slug) values ('glock-19x', 'Glock 19X', 'Glock', 'arme-te-shkurta', 'Austri', '9x19mm', null, null, null, null, null, null, true, array['/assets/img/products/glock-19x.webp']::text[], true, false, true, 70, null)
  on conflict (slug) do update set name = excluded.name, brand = excluded.brand, category_slug = excluded.category_slug, origin = excluded.origin, caliber = excluded.caliber, capacity = excluded.capacity, barrel_length = excluded.barrel_length, weight = excluded.weight, action = excluded.action, description = excluded.description, price = excluded.price, show_price = excluded.show_price, images = excluded.images, in_stock = excluded.in_stock, featured = excluded.featured, published = excluded.published, sort = excluded.sort, legacy_slug = excluded.legacy_slug;
insert into public.products (slug, name, brand, category_slug, origin, caliber, capacity, barrel_length, weight, action, description, price, show_price, images, in_stock, featured, published, sort, legacy_slug) values ('glock-17', 'Glock 17', 'Glock', 'arme-te-shkurta', 'Austri', '9x19mm', null, null, null, null, null, null, true, array['/assets/img/products/glock-17.webp']::text[], true, false, true, 80, null)
  on conflict (slug) do update set name = excluded.name, brand = excluded.brand, category_slug = excluded.category_slug, origin = excluded.origin, caliber = excluded.caliber, capacity = excluded.capacity, barrel_length = excluded.barrel_length, weight = excluded.weight, action = excluded.action, description = excluded.description, price = excluded.price, show_price = excluded.show_price, images = excluded.images, in_stock = excluded.in_stock, featured = excluded.featured, published = excluded.published, sort = excluded.sort, legacy_slug = excluded.legacy_slug;
insert into public.products (slug, name, brand, category_slug, origin, caliber, capacity, barrel_length, weight, action, description, price, show_price, images, in_stock, featured, published, sort, legacy_slug) values ('glock-19', 'Glock 19', 'Glock', 'arme-te-shkurta', 'Austri', '9x19mm', null, null, null, null, null, null, true, array['/assets/img/products/glock-19.webp']::text[], true, false, true, 90, null)
  on conflict (slug) do update set name = excluded.name, brand = excluded.brand, category_slug = excluded.category_slug, origin = excluded.origin, caliber = excluded.caliber, capacity = excluded.capacity, barrel_length = excluded.barrel_length, weight = excluded.weight, action = excluded.action, description = excluded.description, price = excluded.price, show_price = excluded.show_price, images = excluded.images, in_stock = excluded.in_stock, featured = excluded.featured, published = excluded.published, sort = excluded.sort, legacy_slug = excluded.legacy_slug;
insert into public.products (slug, name, brand, category_slug, origin, caliber, capacity, barrel_length, weight, action, description, price, show_price, images, in_stock, featured, published, sort, legacy_slug) values ('beretta-apx', 'Beretta APX', 'Beretta', 'arme-te-shkurta', 'SHBA', '9x19mm', null, null, null, null, null, null, true, array['/assets/img/products/beretta-apx.webp']::text[], true, false, true, 100, null)
  on conflict (slug) do update set name = excluded.name, brand = excluded.brand, category_slug = excluded.category_slug, origin = excluded.origin, caliber = excluded.caliber, capacity = excluded.capacity, barrel_length = excluded.barrel_length, weight = excluded.weight, action = excluded.action, description = excluded.description, price = excluded.price, show_price = excluded.show_price, images = excluded.images, in_stock = excluded.in_stock, featured = excluded.featured, published = excluded.published, sort = excluded.sort, legacy_slug = excluded.legacy_slug;
insert into public.products (slug, name, brand, category_slug, origin, caliber, capacity, barrel_length, weight, action, description, price, show_price, images, in_stock, featured, published, sort, legacy_slug) values ('arex-delta', 'Arex Delta', 'Arex', 'arme-te-shkurta', 'Slloveni', '9x19mm', null, null, null, null, null, null, true, array['/assets/img/products/arex-delta.webp']::text[], true, false, true, 110, null)
  on conflict (slug) do update set name = excluded.name, brand = excluded.brand, category_slug = excluded.category_slug, origin = excluded.origin, caliber = excluded.caliber, capacity = excluded.capacity, barrel_length = excluded.barrel_length, weight = excluded.weight, action = excluded.action, description = excluded.description, price = excluded.price, show_price = excluded.show_price, images = excluded.images, in_stock = excluded.in_stock, featured = excluded.featured, published = excluded.published, sort = excluded.sort, legacy_slug = excluded.legacy_slug;
insert into public.products (slug, name, brand, category_slug, origin, caliber, capacity, barrel_length, weight, action, description, price, show_price, images, in_stock, featured, published, sort, legacy_slug) values ('arex-zero-1s', 'Arex Zero 1S', 'Arex', 'arme-te-shkurta', 'Slloveni', '9x19mm', null, null, null, null, null, null, true, array['/assets/img/products/arex-zero-1s.webp']::text[], true, false, true, 120, null)
  on conflict (slug) do update set name = excluded.name, brand = excluded.brand, category_slug = excluded.category_slug, origin = excluded.origin, caliber = excluded.caliber, capacity = excluded.capacity, barrel_length = excluded.barrel_length, weight = excluded.weight, action = excluded.action, description = excluded.description, price = excluded.price, show_price = excluded.show_price, images = excluded.images, in_stock = excluded.in_stock, featured = excluded.featured, published = excluded.published, sort = excluded.sort, legacy_slug = excluded.legacy_slug;
insert into public.products (slug, name, brand, category_slug, origin, caliber, capacity, barrel_length, weight, action, description, price, show_price, images, in_stock, featured, published, sort, legacy_slug) values ('arex-zero-1-cp', 'Arex Zero 1 CP', 'Arex', 'arme-te-shkurta', 'Slloveni', '9x19mm', null, null, null, null, null, null, true, array['/assets/img/products/arex-zero-1-cp.webp']::text[], true, false, true, 130, null)
  on conflict (slug) do update set name = excluded.name, brand = excluded.brand, category_slug = excluded.category_slug, origin = excluded.origin, caliber = excluded.caliber, capacity = excluded.capacity, barrel_length = excluded.barrel_length, weight = excluded.weight, action = excluded.action, description = excluded.description, price = excluded.price, show_price = excluded.show_price, images = excluded.images, in_stock = excluded.in_stock, featured = excluded.featured, published = excluded.published, sort = excluded.sort, legacy_slug = excluded.legacy_slug;
insert into public.products (slug, name, brand, category_slug, origin, caliber, capacity, barrel_length, weight, action, description, price, show_price, images, in_stock, featured, published, sort, legacy_slug) values ('taurus-g3', 'Taurus G3', 'Taurus', 'arme-te-shkurta', 'Brazil', '9x19mm', null, null, null, null, null, null, true, array['/assets/img/products/taurus-g3.webp']::text[], true, false, true, 140, null)
  on conflict (slug) do update set name = excluded.name, brand = excluded.brand, category_slug = excluded.category_slug, origin = excluded.origin, caliber = excluded.caliber, capacity = excluded.capacity, barrel_length = excluded.barrel_length, weight = excluded.weight, action = excluded.action, description = excluded.description, price = excluded.price, show_price = excluded.show_price, images = excluded.images, in_stock = excluded.in_stock, featured = excluded.featured, published = excluded.published, sort = excluded.sort, legacy_slug = excluded.legacy_slug;
insert into public.products (slug, name, brand, category_slug, origin, caliber, capacity, barrel_length, weight, action, description, price, show_price, images, in_stock, featured, published, sort, legacy_slug) values ('taurus-g3x', 'Taurus G3X', 'Taurus', 'arme-te-shkurta', 'Brazil', '9x19mm', null, null, null, null, null, null, true, array['/assets/img/products/taurus-g3x.webp']::text[], true, false, true, 150, null)
  on conflict (slug) do update set name = excluded.name, brand = excluded.brand, category_slug = excluded.category_slug, origin = excluded.origin, caliber = excluded.caliber, capacity = excluded.capacity, barrel_length = excluded.barrel_length, weight = excluded.weight, action = excluded.action, description = excluded.description, price = excluded.price, show_price = excluded.show_price, images = excluded.images, in_stock = excluded.in_stock, featured = excluded.featured, published = excluded.published, sort = excluded.sort, legacy_slug = excluded.legacy_slug;
insert into public.products (slug, name, brand, category_slug, origin, caliber, capacity, barrel_length, weight, action, description, price, show_price, images, in_stock, featured, published, sort, legacy_slug) values ('ruger-security-9', 'Ruger Security-9', 'Ruger', 'arme-te-shkurta', 'SHBA', '9x19mm', null, null, null, null, null, null, true, array['/assets/img/products/ruger-security-9.webp']::text[], true, false, true, 160, null)
  on conflict (slug) do update set name = excluded.name, brand = excluded.brand, category_slug = excluded.category_slug, origin = excluded.origin, caliber = excluded.caliber, capacity = excluded.capacity, barrel_length = excluded.barrel_length, weight = excluded.weight, action = excluded.action, description = excluded.description, price = excluded.price, show_price = excluded.show_price, images = excluded.images, in_stock = excluded.in_stock, featured = excluded.featured, published = excluded.published, sort = excluded.sort, legacy_slug = excluded.legacy_slug;
insert into public.products (slug, name, brand, category_slug, origin, caliber, capacity, barrel_length, weight, action, description, price, show_price, images, in_stock, featured, published, sort, legacy_slug) values ('balistik-defence-adam-45s', 'Balistik Defence ADAM 45S', 'Balistik Defence', 'arme-te-shkurta', 'Turqi', '.45 ACP', null, null, null, null, null, null, true, array['/assets/img/products/balistik-defence-adam-45s.webp']::text[], true, false, true, 170, null)
  on conflict (slug) do update set name = excluded.name, brand = excluded.brand, category_slug = excluded.category_slug, origin = excluded.origin, caliber = excluded.caliber, capacity = excluded.capacity, barrel_length = excluded.barrel_length, weight = excluded.weight, action = excluded.action, description = excluded.description, price = excluded.price, show_price = excluded.show_price, images = excluded.images, in_stock = excluded.in_stock, featured = excluded.featured, published = excluded.published, sort = excluded.sort, legacy_slug = excluded.legacy_slug;
insert into public.products (slug, name, brand, category_slug, origin, caliber, capacity, barrel_length, weight, action, description, price, show_price, images, in_stock, featured, published, sort, legacy_slug) values ('balistik-defence-adam-8s', 'Balistik Defence ADAM 8S', 'Balistik Defence', 'arme-te-shkurta', 'Turqi', null, null, null, null, null, null, null, true, array['/assets/img/products/balistik-defence-adam-8s.webp']::text[], true, false, true, 180, null)
  on conflict (slug) do update set name = excluded.name, brand = excluded.brand, category_slug = excluded.category_slug, origin = excluded.origin, caliber = excluded.caliber, capacity = excluded.capacity, barrel_length = excluded.barrel_length, weight = excluded.weight, action = excluded.action, description = excluded.description, price = excluded.price, show_price = excluded.show_price, images = excluded.images, in_stock = excluded.in_stock, featured = excluded.featured, published = excluded.published, sort = excluded.sort, legacy_slug = excluded.legacy_slug;
insert into public.products (slug, name, brand, category_slug, origin, caliber, capacity, barrel_length, weight, action, description, price, show_price, images, in_stock, featured, published, sort, legacy_slug) values ('radikal-rpx9', 'Radikal RPX9', 'Radikal', 'arme-te-shkurta', 'Turqi', '9x19mm', null, null, null, null, null, null, true, array['/assets/img/products/radikal-rpx9.webp']::text[], true, false, true, 190, null)
  on conflict (slug) do update set name = excluded.name, brand = excluded.brand, category_slug = excluded.category_slug, origin = excluded.origin, caliber = excluded.caliber, capacity = excluded.capacity, barrel_length = excluded.barrel_length, weight = excluded.weight, action = excluded.action, description = excluded.description, price = excluded.price, show_price = excluded.show_price, images = excluded.images, in_stock = excluded.in_stock, featured = excluded.featured, published = excluded.published, sort = excluded.sort, legacy_slug = excluded.legacy_slug;
insert into public.products (slug, name, brand, category_slug, origin, caliber, capacity, barrel_length, weight, action, description, price, show_price, images, in_stock, featured, published, sort, legacy_slug) values ('brg-9', 'BRG 9', 'BRG', 'arme-te-shkurta', null, null, null, null, null, null, null, null, true, array['/assets/img/products/brg-9.webp']::text[], true, false, true, 200, null)
  on conflict (slug) do update set name = excluded.name, brand = excluded.brand, category_slug = excluded.category_slug, origin = excluded.origin, caliber = excluded.caliber, capacity = excluded.capacity, barrel_length = excluded.barrel_length, weight = excluded.weight, action = excluded.action, description = excluded.description, price = excluded.price, show_price = excluded.show_price, images = excluded.images, in_stock = excluded.in_stock, featured = excluded.featured, published = excluded.published, sort = excluded.sort, legacy_slug = excluded.legacy_slug;

-- Galeria
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g001.webp', '/assets/img/gallery/thumbs/g001.webp', 'Poligoni Patriot', 1800, 1200, 10, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g002.webp', '/assets/img/gallery/thumbs/g002.webp', 'Poligoni Patriot', 1800, 1200, 20, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g003.webp', '/assets/img/gallery/thumbs/g003.webp', 'Poligoni Patriot', 1800, 1200, 30, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g004.webp', '/assets/img/gallery/thumbs/g004.webp', 'Poligoni Patriot', 1800, 1200, 40, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g005.webp', '/assets/img/gallery/thumbs/g005.webp', 'Poligoni Patriot', 1800, 1200, 50, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g006.webp', '/assets/img/gallery/thumbs/g006.webp', 'Poligoni Patriot', 1800, 1200, 60, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g007.webp', '/assets/img/gallery/thumbs/g007.webp', 'Poligoni Patriot', 1800, 1200, 70, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g008.webp', '/assets/img/gallery/thumbs/g008.webp', 'Poligoni Patriot', 1800, 1200, 80, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g009.webp', '/assets/img/gallery/thumbs/g009.webp', 'Poligoni Patriot', 1800, 1200, 90, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g010.webp', '/assets/img/gallery/thumbs/g010.webp', 'Poligoni Patriot', 1800, 1200, 100, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g011.webp', '/assets/img/gallery/thumbs/g011.webp', 'Poligoni Patriot', 1800, 1200, 110, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g012.webp', '/assets/img/gallery/thumbs/g012.webp', 'Poligoni Patriot', 1800, 1200, 120, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g013.webp', '/assets/img/gallery/thumbs/g013.webp', 'Poligoni Patriot', 1000, 1333, 130, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g014.webp', '/assets/img/gallery/thumbs/g014.webp', 'Poligoni Patriot', 1000, 1333, 140, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g015.webp', '/assets/img/gallery/thumbs/g015.webp', 'Poligoni Patriot', 1000, 1333, 150, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g016.webp', '/assets/img/gallery/thumbs/g016.webp', 'Poligoni Patriot', 1000, 1333, 160, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g017.webp', '/assets/img/gallery/thumbs/g017.webp', 'Poligoni Patriot', 1000, 1333, 170, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g018.webp', '/assets/img/gallery/thumbs/g018.webp', 'Poligoni Patriot', 1000, 1333, 180, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g019.webp', '/assets/img/gallery/thumbs/g019.webp', 'Poligoni Patriot', 1000, 1333, 190, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g020.webp', '/assets/img/gallery/thumbs/g020.webp', 'Poligoni Patriot', 1000, 1333, 200, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g021.webp', '/assets/img/gallery/thumbs/g021.webp', 'Poligoni Patriot', 1000, 1333, 210, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g022.webp', '/assets/img/gallery/thumbs/g022.webp', 'Poligoni Patriot', 1000, 1333, 220, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g023.webp', '/assets/img/gallery/thumbs/g023.webp', 'Poligoni Patriot', 1000, 1333, 230, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g024.webp', '/assets/img/gallery/thumbs/g024.webp', 'Poligoni Patriot', 1000, 1333, 240, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g025.webp', '/assets/img/gallery/thumbs/g025.webp', 'Poligoni Patriot', 1000, 1333, 250, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g026.webp', '/assets/img/gallery/thumbs/g026.webp', 'Poligoni Patriot', 1000, 1333, 260, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g027.webp', '/assets/img/gallery/thumbs/g027.webp', 'Poligoni Patriot', 1000, 1333, 270, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g028.webp', '/assets/img/gallery/thumbs/g028.webp', 'Poligoni Patriot', 1000, 1333, 280, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g029.webp', '/assets/img/gallery/thumbs/g029.webp', 'Poligoni Patriot', 1000, 1333, 290, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g030.webp', '/assets/img/gallery/thumbs/g030.webp', 'Poligoni Patriot', 1000, 1333, 300, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g031.webp', '/assets/img/gallery/thumbs/g031.webp', 'Poligoni Patriot', 1000, 1333, 310, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g032.webp', '/assets/img/gallery/thumbs/g032.webp', 'Poligoni Patriot', 1000, 1333, 320, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g033.webp', '/assets/img/gallery/thumbs/g033.webp', 'Poligoni Patriot', 1000, 1333, 330, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g034.webp', '/assets/img/gallery/thumbs/g034.webp', 'Poligoni Patriot', 1000, 1333, 340, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g035.webp', '/assets/img/gallery/thumbs/g035.webp', 'Poligoni Patriot', 1000, 1333, 350, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g036.webp', '/assets/img/gallery/thumbs/g036.webp', 'Poligoni Patriot', 1000, 1333, 360, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g037.webp', '/assets/img/gallery/thumbs/g037.webp', 'Poligoni Patriot', 1000, 1333, 370, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g038.webp', '/assets/img/gallery/thumbs/g038.webp', 'Poligoni Patriot', 1000, 1333, 380, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g039.webp', '/assets/img/gallery/thumbs/g039.webp', 'Poligoni Patriot', 1000, 1333, 390, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g040.webp', '/assets/img/gallery/thumbs/g040.webp', 'Poligoni Patriot', 1000, 1333, 400, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g041.webp', '/assets/img/gallery/thumbs/g041.webp', 'Poligoni Patriot', 1000, 1333, 410, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g042.webp', '/assets/img/gallery/thumbs/g042.webp', 'Poligoni Patriot', 1000, 1333, 420, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g043.webp', '/assets/img/gallery/thumbs/g043.webp', 'Poligoni Patriot', 1000, 1333, 430, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g044.webp', '/assets/img/gallery/thumbs/g044.webp', 'Poligoni Patriot', 1000, 1333, 440, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g045.webp', '/assets/img/gallery/thumbs/g045.webp', 'Poligoni Patriot', 1000, 1333, 450, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g046.webp', '/assets/img/gallery/thumbs/g046.webp', 'Poligoni Patriot', 1000, 1333, 460, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g047.webp', '/assets/img/gallery/thumbs/g047.webp', 'Poligoni Patriot', 1000, 1333, 470, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g048.webp', '/assets/img/gallery/thumbs/g048.webp', 'Poligoni Patriot', 1000, 1333, 480, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g049.webp', '/assets/img/gallery/thumbs/g049.webp', 'Poligoni Patriot', 1000, 1333, 490, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g050.webp', '/assets/img/gallery/thumbs/g050.webp', 'Poligoni Patriot', 1000, 1333, 500, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g051.webp', '/assets/img/gallery/thumbs/g051.webp', 'Poligoni Patriot', 1000, 1333, 510, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g052.webp', '/assets/img/gallery/thumbs/g052.webp', 'Poligoni Patriot', 1000, 1333, 520, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g053.webp', '/assets/img/gallery/thumbs/g053.webp', 'Poligoni Patriot', 1000, 1333, 530, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g054.webp', '/assets/img/gallery/thumbs/g054.webp', 'Poligoni Patriot', 1000, 1333, 540, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g055.webp', '/assets/img/gallery/thumbs/g055.webp', 'Poligoni Patriot', 1000, 1333, 550, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g056.webp', '/assets/img/gallery/thumbs/g056.webp', 'Poligoni Patriot', 1000, 1333, 560, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g057.webp', '/assets/img/gallery/thumbs/g057.webp', 'Poligoni Patriot', 1000, 1333, 570, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g058.webp', '/assets/img/gallery/thumbs/g058.webp', 'Poligoni Patriot', 1000, 1333, 580, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g059.webp', '/assets/img/gallery/thumbs/g059.webp', 'Poligoni Patriot', 1000, 1333, 590, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g060.webp', '/assets/img/gallery/thumbs/g060.webp', 'Poligoni Patriot', 1000, 1333, 600, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g061.webp', '/assets/img/gallery/thumbs/g061.webp', 'Poligoni Patriot', 1000, 1333, 610, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g062.webp', '/assets/img/gallery/thumbs/g062.webp', 'Poligoni Patriot', 1000, 1333, 620, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g063.webp', '/assets/img/gallery/thumbs/g063.webp', 'Poligoni Patriot', 1000, 1333, 630, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g064.webp', '/assets/img/gallery/thumbs/g064.webp', 'Poligoni Patriot', 1000, 1333, 640, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g065.webp', '/assets/img/gallery/thumbs/g065.webp', 'Poligoni Patriot', 1000, 1333, 650, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g066.webp', '/assets/img/gallery/thumbs/g066.webp', 'Poligoni Patriot', 1000, 1333, 660, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g067.webp', '/assets/img/gallery/thumbs/g067.webp', 'Poligoni Patriot', 1000, 1333, 670, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g068.webp', '/assets/img/gallery/thumbs/g068.webp', 'Poligoni Patriot', 1000, 1333, 680, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g069.webp', '/assets/img/gallery/thumbs/g069.webp', 'Poligoni Patriot', 1000, 1333, 690, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g070.webp', '/assets/img/gallery/thumbs/g070.webp', 'Poligoni Patriot', 1000, 1333, 700, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g071.webp', '/assets/img/gallery/thumbs/g071.webp', 'Poligoni Patriot', 1000, 1333, 710, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g072.webp', '/assets/img/gallery/thumbs/g072.webp', 'Poligoni Patriot', 1000, 1333, 720, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g073.webp', '/assets/img/gallery/thumbs/g073.webp', 'Poligoni Patriot', 1000, 1333, 730, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g074.webp', '/assets/img/gallery/thumbs/g074.webp', 'Poligoni Patriot', 1000, 1333, 740, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g075.webp', '/assets/img/gallery/thumbs/g075.webp', 'Poligoni Patriot', 1000, 1333, 750, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g076.webp', '/assets/img/gallery/thumbs/g076.webp', 'Poligoni Patriot', 1000, 1333, 760, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g077.webp', '/assets/img/gallery/thumbs/g077.webp', 'Poligoni Patriot', 1000, 1333, 770, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g078.webp', '/assets/img/gallery/thumbs/g078.webp', 'Poligoni Patriot', 1000, 1333, 780, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g079.webp', '/assets/img/gallery/thumbs/g079.webp', 'Poligoni Patriot', 1000, 1333, 790, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g080.webp', '/assets/img/gallery/thumbs/g080.webp', 'Poligoni Patriot', 1000, 1333, 800, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g081.webp', '/assets/img/gallery/thumbs/g081.webp', 'Poligoni Patriot', 1000, 1333, 810, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g082.webp', '/assets/img/gallery/thumbs/g082.webp', 'Poligoni Patriot', 1000, 1333, 820, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g083.webp', '/assets/img/gallery/thumbs/g083.webp', 'Poligoni Patriot', 1000, 1333, 830, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g084.webp', '/assets/img/gallery/thumbs/g084.webp', 'Poligoni Patriot', 1000, 1333, 840, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g085.webp', '/assets/img/gallery/thumbs/g085.webp', 'Poligoni Patriot', 1000, 1333, 850, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g086.webp', '/assets/img/gallery/thumbs/g086.webp', 'Poligoni Patriot', 1000, 1333, 860, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g087.webp', '/assets/img/gallery/thumbs/g087.webp', 'Poligoni Patriot', 1000, 1333, 870, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g088.webp', '/assets/img/gallery/thumbs/g088.webp', 'Poligoni Patriot', 1000, 1333, 880, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g089.webp', '/assets/img/gallery/thumbs/g089.webp', 'Poligoni Patriot', 1000, 1333, 890, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g090.webp', '/assets/img/gallery/thumbs/g090.webp', 'Poligoni Patriot', 1000, 1333, 900, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g091.webp', '/assets/img/gallery/thumbs/g091.webp', 'Poligoni Patriot', 1000, 1333, 910, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g092.webp', '/assets/img/gallery/thumbs/g092.webp', 'Poligoni Patriot', 1000, 1333, 920, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g093.webp', '/assets/img/gallery/thumbs/g093.webp', 'Poligoni Patriot', 1000, 1333, 930, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g094.webp', '/assets/img/gallery/thumbs/g094.webp', 'Poligoni Patriot', 1000, 1333, 940, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g095.webp', '/assets/img/gallery/thumbs/g095.webp', 'Poligoni Patriot', 1000, 1333, 950, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g096.webp', '/assets/img/gallery/thumbs/g096.webp', 'Poligoni Patriot', 1000, 1333, 960, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g097.webp', '/assets/img/gallery/thumbs/g097.webp', 'Poligoni Patriot', 1000, 1333, 970, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g098.webp', '/assets/img/gallery/thumbs/g098.webp', 'Poligoni Patriot', 1000, 1333, 980, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g099.webp', '/assets/img/gallery/thumbs/g099.webp', 'Poligoni Patriot', 1000, 1333, 990, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g100.webp', '/assets/img/gallery/thumbs/g100.webp', 'Poligoni Patriot', 1000, 1333, 1000, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g101.webp', '/assets/img/gallery/thumbs/g101.webp', 'Poligoni Patriot', 1000, 1333, 1010, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g102.webp', '/assets/img/gallery/thumbs/g102.webp', 'Poligoni Patriot', 1000, 1333, 1020, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g103.webp', '/assets/img/gallery/thumbs/g103.webp', 'Poligoni Patriot', 1000, 1333, 1030, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g104.webp', '/assets/img/gallery/thumbs/g104.webp', 'Poligoni Patriot', 1000, 1333, 1040, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g105.webp', '/assets/img/gallery/thumbs/g105.webp', 'Poligoni Patriot', 1000, 1333, 1050, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g106.webp', '/assets/img/gallery/thumbs/g106.webp', 'Poligoni Patriot', 1000, 1333, 1060, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g107.webp', '/assets/img/gallery/thumbs/g107.webp', 'Poligoni Patriot', 1000, 1333, 1070, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g108.webp', '/assets/img/gallery/thumbs/g108.webp', 'Poligoni Patriot', 1000, 1333, 1080, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g109.webp', '/assets/img/gallery/thumbs/g109.webp', 'Poligoni Patriot', 1000, 1333, 1090, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g110.webp', '/assets/img/gallery/thumbs/g110.webp', 'Poligoni Patriot', 1000, 1333, 1100, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g111.webp', '/assets/img/gallery/thumbs/g111.webp', 'Poligoni Patriot', 1000, 1333, 1110, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g112.webp', '/assets/img/gallery/thumbs/g112.webp', 'Poligoni Patriot', 1000, 1333, 1120, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g113.webp', '/assets/img/gallery/thumbs/g113.webp', 'Poligoni Patriot', 1000, 1333, 1130, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g114.webp', '/assets/img/gallery/thumbs/g114.webp', 'Poligoni Patriot', 1000, 1333, 1140, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g115.webp', '/assets/img/gallery/thumbs/g115.webp', 'Poligoni Patriot', 1000, 1333, 1150, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g116.webp', '/assets/img/gallery/thumbs/g116.webp', 'Poligoni Patriot', 1000, 1333, 1160, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g117.webp', '/assets/img/gallery/thumbs/g117.webp', 'Poligoni Patriot', 1000, 1333, 1170, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g118.webp', '/assets/img/gallery/thumbs/g118.webp', 'Poligoni Patriot', 1000, 1333, 1180, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g119.webp', '/assets/img/gallery/thumbs/g119.webp', 'Poligoni Patriot', 1000, 1333, 1190, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g120.webp', '/assets/img/gallery/thumbs/g120.webp', 'Poligoni Patriot', 1000, 1333, 1200, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g121.webp', '/assets/img/gallery/thumbs/g121.webp', 'Poligoni Patriot', 1000, 1333, 1210, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g122.webp', '/assets/img/gallery/thumbs/g122.webp', 'Poligoni Patriot', 1000, 1333, 1220, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g123.webp', '/assets/img/gallery/thumbs/g123.webp', 'Poligoni Patriot', 1000, 1333, 1230, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g124.webp', '/assets/img/gallery/thumbs/g124.webp', 'Poligoni Patriot', 1000, 1333, 1240, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g125.webp', '/assets/img/gallery/thumbs/g125.webp', 'Poligoni Patriot', 1000, 1333, 1250, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g126.webp', '/assets/img/gallery/thumbs/g126.webp', 'Poligoni Patriot', 1000, 1333, 1260, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g127.webp', '/assets/img/gallery/thumbs/g127.webp', 'Poligoni Patriot', 1000, 1333, 1270, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g128.webp', '/assets/img/gallery/thumbs/g128.webp', 'Poligoni Patriot', 1000, 1333, 1280, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g129.webp', '/assets/img/gallery/thumbs/g129.webp', 'Poligoni Patriot', 1000, 1333, 1290, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g130.webp', '/assets/img/gallery/thumbs/g130.webp', 'Poligoni Patriot', 1000, 1333, 1300, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g131.webp', '/assets/img/gallery/thumbs/g131.webp', 'Poligoni Patriot', 1000, 1333, 1310, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g132.webp', '/assets/img/gallery/thumbs/g132.webp', 'Poligoni Patriot', 1000, 1333, 1320, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g133.webp', '/assets/img/gallery/thumbs/g133.webp', 'Poligoni Patriot', 1000, 1333, 1330, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g134.webp', '/assets/img/gallery/thumbs/g134.webp', 'Poligoni Patriot', 1000, 1333, 1340, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g135.webp', '/assets/img/gallery/thumbs/g135.webp', 'Poligoni Patriot', 1000, 1333, 1350, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g136.webp', '/assets/img/gallery/thumbs/g136.webp', 'Poligoni Patriot', 1000, 1333, 1360, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g137.webp', '/assets/img/gallery/thumbs/g137.webp', 'Poligoni Patriot', 1000, 1333, 1370, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;
insert into public.gallery (src, thumb, alt, width, height, sort, published) values ('/assets/img/gallery/g138.webp', '/assets/img/gallery/thumbs/g138.webp', 'Poligoni Patriot', 1000, 1333, 1380, true)
  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;

commit;
