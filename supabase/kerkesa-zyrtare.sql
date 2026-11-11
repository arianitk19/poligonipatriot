-- ═══════════════════════════════════════════════════════════════════
--  POLIGONI PATRIOT — Kërkesa zyrtare për trajnim (me nënshkrim digjital)
--  Ngjite gjithë këtë skedar te Supabase → SQL Editor → Run.
--  Mund të ekzekutohet disa herë pa problem. Nuk fshin asnjë aplikim.
-- ═══════════════════════════════════════════════════════════════════

-- 1) Fushat e reja te aplikimet
alter table public.applications
  add column if not exists kind           text not null default 'online',
  add column if not exists first_name     text,
  add column if not exists last_name      text,
  add column if not exists father_name    text,
  add column if not exists birth_date     date,
  add column if not exists birth_place    text,
  add column if not exists weapon_classes text[],
  add column if not exists signature_path text,
  add column if not exists signed_on      date;

-- Emaili nuk kërkohet te kërkesa zyrtare (fleta letër nuk e ka)
alter table public.applications alter column email drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'applications_kind_chk') then
    alter table public.applications add constraint applications_kind_chk check (kind in ('online', 'kerkese'));
  end if;
  alter table public.applications drop constraint if exists applications_kerkese_chk;
  alter table public.applications add constraint applications_kerkese_chk check (
    kind <> 'kerkese' or coalesce(
      char_length(first_name) between 2 and 60
      and char_length(last_name) between 2 and 60
      and char_length(father_name) between 2 and 60
      and char_length(birth_place) between 2 and 120
      and birth_date between date '1900-01-01' and current_date
      and cardinality(weapon_classes) between 1 and 3
      and weapon_classes <@ array['A', 'B', 'C']::text[]
      and signature_path like id::text || '/%'
      and signed_on is not null, false)
  ) not valid;
  if not exists (select 1 from pg_constraint where conname = 'applications_online_email_chk') then
    alter table public.applications add constraint applications_online_email_chk check (kind <> 'online' or email is not null);
  end if;
end $$;

-- 2) Kufizimi i spamit: numëron edhe kërkesat pa email
create or replace function public.limit_applications()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.applications a
        where (a.id_number = new.id_number or (new.email is not null and lower(a.email) = lower(new.email)))
          and a.created_at > now() - interval '1 day') >= 3 then
    raise exception 'Kufiri i aplikimeve u arrit (rate limit)' using errcode = 'P0001';
  end if;
  return new;
end; $$;

-- 3) Storage: lejo edhe skedarin e nënshkrimit (nenshkrimi.png)
drop policy if exists "aplikimet: kushdo ngarkon" on storage.objects;
create policy "aplikimet: kushdo ngarkon" on storage.objects for insert to anon, authenticated with check (
  bucket_id = 'aplikimet'
  and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and array_length(storage.foldername(name), 1) = 1
  and storage.filename(name) ~ '^(front|back|nenshkrimi)\.(jpg|jpeg|png|webp|pdf)$'
);

-- 4) Njoftimi (email + WhatsApp) — vetëm nëse njoftimet janë instaluar.
--    Numri personal dhe nënshkrimi NUK dërgohen; shihen vetëm në panel.
do $outer$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'send_notification') then
    execute $fn$
    create or replace function public.notify_new_application()
    returns trigger language plpgsql security definer set search_path = '' as $body$
    declare
      program_label text := case new.program
        when 'shkurtra' then 'Armë të shkurtra'
        when 'gjata' then 'Armë të gjata'
        else 'Armë të shkurtra dhe të gjata' end;
      kind_label text := case when new.kind = 'kerkese' then 'Kërkesë zyrtare me nënshkrim' else 'Aplikim online' end;
      site text := coalesce(public.notify_secret('site_url'), 'https://poligonipatriot.com');
      tel text := regexp_replace(new.phone, '[^0-9+]', '', 'g');
    begin
      if new.kind = 'kerkese' then return new; end if; -- kërkesa dërgohet nga kerkesa-dergimi.sql
      perform public.send_notification(
        'Aplikim i ri: ' || new.full_name || ' (' || program_label || ')',
        public.mail_layout(
          'Aplikim i ri për certifikim',
          public.mail_row('Emri', public.html_esc(new.full_name))
            || public.mail_row('Lloji', public.html_esc(kind_label))
            || public.mail_row('Programi', public.html_esc(program_label))
            || public.mail_row('Telefoni', '<a style="color:#f6f5f2" href="tel:' || public.html_esc(tel) || '">' || public.html_esc(new.phone) || '</a>')
            || case when new.email is not null then public.mail_row('Emaili', public.html_esc(new.email)) else '' end
            || case when new.kind = 'kerkese'
                 then public.mail_row('Nënshkrimi', 'Nënshkruar digjitalisht, shihet në panel')
                 else public.mail_row('Letërnjoftimi', case when new.id_front_path is not null then 'Ngarkuar, shihet në panel' else 'Mungon' end) end,
          case when new.message is not null then public.html_esc(new.message) end,
          site || '/admin/#/aplikimet/' || new.id,
          'Hap aplikimin në panel'
        ),
        new.email
      );
      perform public.send_whatsapp(
        '*Aplikim i ri për certifikim*' || chr(10)
        || new.full_name || chr(10)
        || kind_label || chr(10)
        || program_label || chr(10)
        || 'Tel: ' || new.phone || chr(10)
        || site || '/admin/#/aplikimet/' || new.id
      );
      return new;
    end; $body$;
    $fn$;
  end if;
end $outer$;

-- 5) Emaili i kontaktit në faqe: poligoni.patriot@gmail.com
update public.site_settings
   set value = jsonb_set(value, '{email}', to_jsonb('poligoni.patriot@gmail.com'::text))
 where key = 'site';

-- Rifreskon skemën e API-së që fushat e reja të njihen menjëherë
notify pgrst, 'reload schema';
