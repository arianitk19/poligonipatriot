-- ═══════════════════════════════════════════════════════════════════
--  POLIGONI PATRIOT — Njoftimet për aplikimet
--  Aplikim i ri  → email te poligoni.patriot@gmail.com (Resend)
--                → WhatsApp te +383 49 394 850 (CallMeBot, falas)
--  Mesazh kontakti → email (mund të çaktivizohet, shih fundin e skedarit)
--
--  Ekzekutoje pasi të kesh ekzekutuar schema.sql.
--  Hapat e plotë (llogaria Resend + çelësi) janë te README.md.
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

-- ───────── Aplikim i ri për certifikim ─────────
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
  -- Numri personal dhe letërnjoftimi NUK dërgohen me email; shihen vetëm në panel.
  perform public.send_notification(
    'Aplikim i ri: ' || new.full_name || ' (' || program_label || ')',
    public.mail_layout(
      'Aplikim i ri për certifikim',
      public.mail_row('Emri', public.html_esc(new.full_name))
        || public.mail_row('Programi', public.html_esc(program_label))
        || public.mail_row('Telefoni', '<a style="color:#f6f5f2" href="tel:' || public.html_esc(tel) || '">' || public.html_esc(new.phone) || '</a>')
        || public.mail_row('Emaili', public.html_esc(new.email))
        || public.mail_row('Letërnjoftimi', case when new.id_front_path is not null then 'Ngarkuar, shihet në panel' else 'Mungon' end),
      case when new.message is not null then public.html_esc(new.message) end,
      site || '/admin/#/aplikimet/' || new.id,
      'Hap aplikimin në panel'
    ),
    new.email
  );
  perform public.send_whatsapp(
    '*Aplikim i ri për certifikim*' || chr(10)
    || new.full_name || chr(10)
    || program_label || chr(10)
    || 'Tel: ' || new.phone || chr(10)
    || site || '/admin/#/aplikimet/' || new.id
  );
  return new;
end; $$;
drop trigger if exists applications_notify on public.applications;
create trigger applications_notify after insert on public.applications for each row execute function public.notify_new_application();

-- ───────── Mesazh i ri nga formulari i kontaktit ─────────
create or replace function public.notify_new_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  site text := coalesce(public.notify_secret('site_url'), 'https://poligonipatriot.com');
  tel text := regexp_replace(new.phone, '[^0-9+]', '', 'g');
  reasons text := (
    select string_agg(case r
      when 'trajnimet' then 'Trajnime & certifikime' when 'poligoni' then 'Poligoni' when 'anetaresimi' then 'Anëtarësimi'
      when 'blerje' then 'Blerje armësh & aksesorësh' when 'riparimi' then 'Riparimi & mirëmbajtja' else 'Të tjera' end, ', ')
    from unnest(new.reasons) r);
begin
  perform public.send_notification(
    'Mesazh i ri: ' || new.name || coalesce(' (' || reasons || ')', ''),
    public.mail_layout(
      'Mesazh i ri nga faqja',
      public.mail_row('Emri', public.html_esc(new.name))
        || public.mail_row('Arsyeja', public.html_esc(coalesce(reasons, '—')))
        || public.mail_row('Telefoni', '<a style="color:#f6f5f2" href="tel:' || public.html_esc(tel) || '">' || public.html_esc(new.phone) || '</a>')
        || public.mail_row('Emaili', public.html_esc(coalesce(new.email, '—'))),
      public.html_esc(new.message),
      site || '/admin/#/mesazhet/' || new.id,
      'Hap mesazhin në panel'
    ),
    new.email
  );
  return new;
end; $$;
drop trigger if exists messages_notify on public.messages;
create trigger messages_notify after insert on public.messages for each row execute function public.notify_new_message();

-- Nëse nuk do email për mesazhet e kontaktit (vetëm për aplikimet), ekzekuto:
--   drop trigger if exists messages_notify on public.messages;
