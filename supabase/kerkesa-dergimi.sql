-- ═══════════════════════════════════════════════════════════════════
--  POLIGONI PATRIOT — Dërgimi automatik i kërkesës zyrtare
--  Sapo aplikanti nënshkruan dhe dërgon kërkesën:
--    • EMAIL te poligoni.patriot@gmail.com me kërkesën si PDF dhe si foto (JPG)
--    • WHATSAPP te +383 49 394 850 me të dhënat e kërkesës dhe lidhjen në panel
--  Ngjite gjithë këtë skedar te Supabase → SQL Editor → Run.
--  Mund të ekzekutohet disa herë pa problem. Nuk fshin asnjë aplikim.
--
--  Kërkon çelësat në Vault (njësoj si te notifications.sql / README):
--    resend_api_key   → çelësi i Resend (email)
--    callmebot_apikey → çelësi i CallMeBot (WhatsApp)
--
--  Kontrolli pas një kërkese prove (200 = u dërgua):
--    select status_code, left(content::text, 160) as pergjigja, created
--      from net._http_response order by created desc limit 5;
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists pg_net;

-- ───────── Leximi i sekreteve nga Vault (çelësi i Resend, adresat) ─────────
create or replace function public.notify_secret(secret_name text)
returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = secret_name limit 1;
$$;
revoke all on function public.notify_secret(text) from public, anon, authenticated;

create or replace function public.html_esc(t text)
returns text language sql immutable set search_path = '' as $$
  select replace(replace(replace(replace(coalesce(t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;');
$$;

-- ───────── Dërgimi i emailit (asinkron, nuk e ndal kurrë ruajtjen) ─────────
create or replace function public.send_notification(subject text, html text, reply_to text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  api_key text := public.notify_secret('resend_api_key');
  mail_to text := coalesce(public.notify_secret('notify_to'), 'poligoni.patriot@gmail.com');
  mail_from text := coalesce(public.notify_secret('notify_from'), 'Poligoni Patriot <onboarding@resend.dev>');
  payload jsonb;
begin
  if api_key is null then
    raise notice 'Njoftimi nuk u dërgua: mungon resend_api_key në Vault';
    return;
  end if;
  payload := jsonb_build_object('from', mail_from, 'to', jsonb_build_array(mail_to), 'subject', subject, 'html', html);
  if reply_to is not null and reply_to <> '' then
    payload := payload || jsonb_build_object('reply_to', reply_to);
  end if;
  perform net.http_post(
    url := 'https://api.resend.com/emails',
    body := payload,
    headers := jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json'),
    timeout_milliseconds := 8000
  );
exception when others then
  raise warning 'Njoftimi me email dështoi: %', sqlerrm;
end; $$;
revoke all on function public.send_notification(text, text, text) from public, anon, authenticated;

-- ───────── WhatsApp te numri i poligonit (CallMeBot) ─────────
create or replace function public.send_whatsapp(msg text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  api_key text := public.notify_secret('callmebot_apikey');
  phone text := coalesce(public.notify_secret('notify_phone'), '38349394850');
begin
  if api_key is null then
    raise notice 'WhatsApp nuk u dërgua: mungon callmebot_apikey në Vault';
    return;
  end if;
  perform net.http_get(
    url := 'https://api.callmebot.com/whatsapp.php',
    params := jsonb_build_object('phone', phone, 'text', msg, 'apikey', api_key),
    timeout_milliseconds := 8000
  );
exception when others then
  raise warning 'Njoftimi me WhatsApp dështoi: %', sqlerrm;
end; $$;
revoke all on function public.send_whatsapp(text) from public, anon, authenticated;

-- Pjesa e përbashkët e emailit
create or replace function public.mail_layout(title text, rows text, body_text text, button_url text, button_label text)
returns text language sql immutable set search_path = '' as $$
  select
    '<div style="background:#0a0a0b;padding:28px 12px;font-family:Arial,Helvetica,sans-serif">'
    || '<div style="max-width:560px;margin:0 auto;background:#111113;border:1px solid #222225;border-radius:12px;overflow:hidden">'
    || '<div style="height:4px;background:#e3343b"></div>'
    || '<div style="padding:26px 26px 8px"><p style="margin:0;color:#8d8d93;font-size:13px">Poligoni Patriot</p>'
    || '<h1 style="margin:6px 0 0;color:#f6f5f2;font-size:22px;line-height:1.25">' || title || '</h1></div>'
    || '<table style="width:100%;border-collapse:collapse;margin:14px 0 0">' || rows || '</table>'
    || coalesce('<div style="padding:18px 26px 0"><p style="margin:0 0 6px;color:#8d8d93;font-size:13px">Mesazhi</p><p style="margin:0;color:#f6f5f2;font-size:15px;line-height:1.55;white-space:pre-wrap">' || body_text || '</p></div>', '')
    || '<div style="padding:24px 26px 28px"><a href="' || button_url || '" style="display:inline-block;background:#e3343b;color:#fff;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 20px;border-radius:6px">' || button_label || '</a></div>'
    || '</div><p style="text-align:center;color:#4b4b50;font-size:12px;margin:16px 0 0">Njoftim automatik nga poligonipatriot.com</p></div>';
$$;

create or replace function public.mail_row(label text, value text)
returns text language sql immutable set search_path = '' as $$
  select '<tr><td style="padding:10px 26px;border-top:1px solid #222225;color:#8d8d93;font-size:14px;width:38%">' || label
      || '</td><td style="padding:10px 26px;border-top:1px solid #222225;color:#f6f5f2;font-size:14px;font-weight:bold">' || value || '</td></tr>';
$$;


-- ───────── Fushat e përkohshme për dokumentin (nuk ruhen; fshihen pas dërgimit) ─────────
alter table public.applications
  add column if not exists doc_jpg text,
  add column if not exists doc_pdf text;

-- ───────── Email me bashkëngjitje (Resend) ─────────
create or replace function public.send_notification_files(subject text, html text, files jsonb, reply_to text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  api_key text := public.notify_secret('resend_api_key');
  mail_to text := coalesce(public.notify_secret('notify_to'), 'poligoni.patriot@gmail.com');
  mail_from text := coalesce(public.notify_secret('notify_from'), 'Poligoni Patriot <onboarding@resend.dev>');
  payload jsonb;
begin
  if api_key is null then
    raise notice 'Emaili nuk u dërgua: mungon resend_api_key në Vault';
    return;
  end if;
  payload := jsonb_build_object('from', mail_from, 'to', jsonb_build_array(mail_to), 'subject', subject, 'html', html);
  if files is not null and jsonb_array_length(files) > 0 then
    payload := payload || jsonb_build_object('attachments', files);
  end if;
  if reply_to is not null and reply_to <> '' then
    payload := payload || jsonb_build_object('reply_to', reply_to);
  end if;
  perform net.http_post(
    url := 'https://api.resend.com/emails',
    body := payload,
    headers := jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json'),
    timeout_milliseconds := 30000
  );
exception when others then
  raise warning 'Emaili me bashkëngjitje dështoi: %', sqlerrm;
end; $$;
revoke all on function public.send_notification_files(text, text, jsonb, text) from public, anon, authenticated;

-- ───────── Kërkesa zyrtare: dërgohet në email + WhatsApp në momentin e ruajtjes ─────────
-- Ekzekutohet BRENDA ruajtjes: nëse ruajtja dështon, asgjë nuk dërgohet; nëse ruhet, dërgohet.
create or replace function public.send_kerkese()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  site text := coalesce(public.notify_secret('site_url'), 'https://poligonipatriot.com');
  full_name text := concat_ws(' ', new.first_name, new.father_name, new.last_name);
  classes text := (
    select string_agg(k || '. ' || case k
      when 'A' then 'Armë e shkurtër e zjarrit'
      when 'B' then 'Armë e gjatë e zjarrit me vijaska'
      else 'Armë e gjatë e zjarrit pa vijaska' end, ', ' order by k)
    from unnest(coalesce(new.weapon_classes, array[]::text[])) k);
  bd text := to_char(new.birth_date, 'DD.MM.YYYY');
  sd text := to_char(coalesce(new.signed_on, current_date), 'DD.MM.YYYY');
  tel text := regexp_replace(coalesce(new.phone, ''), '[^0-9+]', '', 'g');
  idn text := coalesce(new.id_number, '');
  id_masked text := case when length(idn) > 4 then repeat('•', length(idn) - 4) || right(idn, 4) else idn end;
  fname text := 'Kerkesa-' || trim(both '-' from regexp_replace(translate(concat_ws('-', new.first_name, new.last_name), 'ëËçÇ', 'eEcC'), '[^A-Za-z0-9]+', '-', 'g'));
  link text := site || '/admin/#/aplikimet/' || new.id;
  files jsonb := '[]'::jsonb;
begin
  if new.kind is distinct from 'kerkese' then
    new.doc_jpg := null; new.doc_pdf := null;
    return new;
  end if;

  -- Pranohen vetëm PDF dhe JPG të vërteta, deri në ~2.2 MB secili
  if new.doc_pdf is not null and length(new.doc_pdf) <= 3000000 and left(new.doc_pdf, 7) = 'JVBERi0' and new.doc_pdf ~ '^[A-Za-z0-9+/]+={0,2}$' then
    files := files || jsonb_build_array(jsonb_build_object('filename', fname || '.pdf', 'content', new.doc_pdf));
  end if;
  if new.doc_jpg is not null and length(new.doc_jpg) <= 3000000 and left(new.doc_jpg, 4) = '/9j/' and new.doc_jpg ~ '^[A-Za-z0-9+/]+={0,2}$' then
    files := files || jsonb_build_array(jsonb_build_object('filename', fname || '.jpg', 'content', new.doc_jpg));
  end if;

  perform public.send_notification_files(
    'Kërkesë e re për trajnim: ' || full_name || coalesce(' (' || array_to_string(new.weapon_classes, ', ') || ')', ''),
    public.mail_layout(
      'Kërkesë për trajnim profesional për armë',
      public.mail_row('Emri, emri i babait, mbiemri', public.html_esc(full_name))
        || public.mail_row('Data e lindjes', public.html_esc(bd))
        || public.mail_row('Vendi dhe shteti i lindjes', public.html_esc(new.birth_place))
        || public.mail_row('Nr. i telefonit', '<a style="color:#f6f5f2" href="tel:' || public.html_esc(tel) || '">' || public.html_esc(new.phone) || '</a>')
        || public.mail_row('Nr. i letërnjoftimit', public.html_esc(idn))
        || public.mail_row('Trajnimi', public.html_esc(classes))
        || public.mail_row('Data e nënshkrimit', public.html_esc(sd))
        || public.mail_row('Kërkesa', case when jsonb_array_length(files) > 0
             then 'E bashkëngjitur si PDF dhe foto' else 'Shihet në panel' end),
      null,
      link,
      'Hap kërkesën në panel'
    ),
    files
  );

  perform public.send_whatsapp(
    '*Kërkesë e re për trajnim profesional për armë*' || chr(10) || chr(10)
    || 'Emri: ' || full_name || chr(10)
    || 'Data e lindjes: ' || coalesce(bd, '') || chr(10)
    || 'Vendi i lindjes: ' || coalesce(new.birth_place, '') || chr(10)
    || 'Tel: ' || coalesce(new.phone, '') || chr(10)
    || 'Nr. i letërnjoftimit: ' || id_masked || chr(10)
    || 'Trajnimi: ' || coalesce(classes, '') || chr(10)
    || 'Data: ' || sd || chr(10) || chr(10)
    || case when jsonb_array_length(files) > 0 then 'Kërkesa e plotë (PDF + foto) është në email.' else 'Kërkesa e plotë shihet në panel.' end || chr(10)
    || 'Panel: ' || link
  );

  -- Dokumenti nuk ruhet në bazë (paneli e rikrijon kur të duhet)
  new.doc_jpg := null; new.doc_pdf := null;
  return new;
end; $$;
drop trigger if exists applications_send_kerkese on public.applications;
create trigger applications_send_kerkese before insert on public.applications for each row execute function public.send_kerkese();

-- ───────── Njoftimi i vjetër: tani vetëm për aplikimet online (që kërkesa të mos dërgohet dy herë) ─────────
create or replace function public.notify_new_application()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  program_label text := case new.program
    when 'shkurtra' then 'Armë të shkurtra'
    when 'gjata' then 'Armë të gjata'
    else 'Armë të shkurtra dhe të gjata' end;
  site text := coalesce(public.notify_secret('site_url'), 'https://poligonipatriot.com');
  tel text := regexp_replace(new.phone, '[^0-9+]', '', 'g');
begin
  if new.kind = 'kerkese' then return new; end if;
  perform public.send_notification(
    'Aplikim i ri: ' || new.full_name || ' (' || program_label || ')',
    public.mail_layout(
      'Aplikim i ri për certifikim',
      public.mail_row('Emri', public.html_esc(new.full_name))
        || public.mail_row('Programi', public.html_esc(program_label))
        || public.mail_row('Telefoni', '<a style="color:#f6f5f2" href="tel:' || public.html_esc(tel) || '">' || public.html_esc(new.phone) || '</a>')
        || case when new.email is not null then public.mail_row('Emaili', public.html_esc(new.email)) else '' end,
      case when new.message is not null then public.html_esc(new.message) end,
      site || '/admin/#/aplikimet/' || new.id,
      'Hap aplikimin në panel'
    ),
    new.email
  );
  perform public.send_whatsapp(
    '*Aplikim i ri për certifikim*' || chr(10) || new.full_name || chr(10) || program_label || chr(10)
    || 'Tel: ' || new.phone || chr(10) || site || '/admin/#/aplikimet/' || new.id
  );
  return new;
end; $$;
drop trigger if exists applications_notify on public.applications;
create trigger applications_notify after insert on public.applications for each row execute function public.notify_new_application();

-- Rifreskon skemën e API-së që fushat e reja të njihen menjëherë
notify pgrst, 'reload schema';
