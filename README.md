# Poligoni Patriot — faqja e re

Faqe e ndërtuar nga zero me **HTML, Tailwind CSS 4, CSS dhe vanilla JavaScript**. Backend-i është **Supabase** (databaza, Storage dhe hyrja e adminit). Zëvendëson faqen e vjetër WordPress/WooCommerce.

```
poligonipatriot-app/
├─ src/
│  ├─ pages/          ← faqet (një folder = një URL, p.sh. pages/poligoni/index.html → /poligoni/)
│  ├─ partials/       ← pjesët e përbashkëta: head, header, footer, ikonat, harta…
│  └─ styles/app.css  ← Tailwind + sistemi i dizajnit (ngjyrat, tipografia, komponentët)
├─ public/            ← kopjohet siç është: fotot, videot, fontet, JS, të dhënat lokale
│  ├─ assets/js/      ← app.js, data.js, config.js, faqet/*.js, admin/*.js
│  └─ data/*.json     ← produktet, kategoritë dhe galeria (rezervë kur Supabase s'është lidhur)
├─ supabase/
│  ├─ schema.sql      ← tabelat, rregullat e sigurisë (RLS), storage, mbrojtja nga spami
│  └─ seed.sql        ← produktet, kategoritë dhe galeria nga faqja e vjetër
├─ scripts/           ← build.mjs, dev.mjs, seed.mjs (pa varësi të jashtme)
└─ dist/              ← faqja e gatshme për hostim (krijohet nga `npm run build`)
```

## Puna lokale

```bash
npm install
npm run dev        # http://localhost:5173 — rindërtohet vetë kur ndryshon diçka
npm run build      # krijon dist/ për publikim
```

Pa Supabase, faqja punon me të dhënat në `public/data/*.json`: mund ta shikoni dhe ta dizajnoni plotësisht. Formularët shfaqin njoftimin "mënyra demo".

## Lidhja me Supabase (një herë)

1. **Krijo projektin** në [supabase.com](https://supabase.com). Zgjidhni rajonin **Central EU (Frankfurt)**, që është më afër Kosovës.
2. **SQL Editor → New query**: ngjit përmbajtjen e `supabase/schema.sql` dhe kliko **Run**. Pastaj bëj të njëjtën gjë me `supabase/seed.sql`.
   Nëse ndryshon `public/data/*.json`, rigjenero seed-in me `node scripts/seed.mjs`.
3. **Mbyll regjistrimet publike**: Authentication → Sign In / Providers → çaktivizo *Allow new users to sign up*. Kështu askush tjetër nuk mund të krijojë llogari.
4. **Krijo hyrjen tënde në panel.** Authentication → Users → *Add user* → *Create new user*:
   - **Email**: `arianitk2005@gmail.com` ose `poligoni.patriot@gmail.com`. Të dyja bëhen admin automatikisht, pa SQL shtesë.
     Mund të hysh edhe me numër telefoni: përdor si email `38349394850@admin.poligonipatriot.com`.
   - **Password**: fjalëkalimi që zgjedh ti (të paktën 8 karaktere).
   - Aktivizo **Auto Confirm User**.

   Në `/admin/` hyn me **emailin** (ose numrin) dhe **fjalëkalimin**. Për të lejuar një email tjetër si admin, shtoje te dy listat te `grant_admin_by_phone` në `schema.sql`.
5. **Çelësat**: Project Settings → API. Kopjo *Project URL* dhe *anon / publishable key* te `public/assets/js/config.js`. **Mos përdor kurrë `service_role` key në frontend.**
6. *(Opsionale)* Te paneli → **Siguria** mund të aktivizosh verifikimin me dy hapa (2FA) me Google Authenticator. Fjalëkalimin e ndryshon po aty. Nëse e harron, vendos një të ri nga Supabase → SQL Editor:
   ```sql
   update auth.users
   set encrypted_password = extensions.crypt('FJALEKALIMI-I-RI', extensions.gen_salt('bf'))
   where email = 'arianitk2005@gmail.com';
   ```

### Siguria në shkurt
- Rregullat RLS lejojnë **vetëm** llogaritë admin (numri yt) të lexojnë mesazhet dhe aplikimet ose të ndryshojnë produktet. Nëse aktivizon 2FA, kërkohet edhe kodi (niveli `aal2`).
- Vizitorët mund vetëm të **dërgojnë** mesazhe dhe aplikime. Nuk mund t'i lexojnë, as t'i ndryshojnë.
- Letërnjoftimet ruhen në bucket-in privat `aplikimet` dhe hapen në panel me lidhje që skadon pas 2 minutash.
- Kufizim kundër spamit: 3 mesazhe në orë për numër telefoni dhe 3 aplikime në ditë për person.

## Njoftimet për aplikimet (email + WhatsApp)

Llogaritë (Supabase, Resend) mund t'i hapësh në emrin tënd. Njoftimet shkojnë te kontaktet e poligonit:

| Kur | Ku |
|---|---|
| Aplikim i ri për certifikim | Email te **poligoni.patriot@gmail.com** + WhatsApp te **+383 49 394 850** |
| Mesazh nga formulari i kontaktit | Email te poligoni.patriot@gmail.com (opsional) |

Emaili ka emrin, telefonin, emailin, programin, mesazhin dhe butonin **"Hap aplikimin në panel"**. "Reply" në Gmail i përgjigjet direkt aplikantit. WhatsApp-i ka emrin, programin, telefonin dhe lidhjen te paneli.
Numri personal dhe letërnjoftimi **nuk** dërgohen, as me email as në WhatsApp. Ato shihen vetëm në panel.

### 1. Emaili (Resend, falas deri në 3.000 email në muaj)
1. Hap llogari te [resend.com](https://resend.com) me emailin tënd.
2. **Verifiko domenin**: Resend → *Domains* → *Add domain* → `poligonipatriot.com`. Resend të jep 3 rreshta DNS (TXT/MX). Shtoji te paneli i domenit (Bluehost → Domains → DNS) dhe prit derisa statusi të bëhet *Verified*.
   Kjo duhet sepse pa domen të verifikuar Resend dërgon vetëm te emaili me të cilin e ke hapur llogarinë, jo te poligoni.patriot@gmail.com.
3. Resend → *API Keys* → *Create API Key*. Kopjo çelësin `re_...`.
4. Te Supabase → **SQL Editor**:
   ```sql
   select vault.create_secret('re_...', 'resend_api_key');
   select vault.create_secret('Poligoni Patriot <njoftime@poligonipatriot.com>', 'notify_from');
   ```

> Nëse nuk ke qasje në DNS të domenit, alternativa është ta hapësh llogarinë Resend me **poligoni.patriot@gmail.com**. Atëherë hapi 2 dhe rreshti `notify_from` nuk duhen.

### 2. WhatsApp (CallMeBot, falas)
Këtë e bën dikush me telefonin që ka numrin **+383 49 394 850**:
1. Ruaje në kontakte numrin e CallMeBot. Numri aktual është te [callmebot.com](https://www.callmebot.com/blog/free-api-whatsapp-messages/), sepse ndryshon herë pas here.
2. Dërgoji në WhatsApp mesazhin: `I allow callmebot to send me messages`
3. Brenda pak minutash vjen përgjigjja me **APIKEY**.
4. Te Supabase → SQL Editor:
   ```sql
   select vault.create_secret('APIKEY-QË-TË-ERDHI', 'callmebot_apikey');
   ```

### 3. Aktivizimi
Te SQL Editor ekzekuto përmbajtjen e `supabase/notifications.sql`. Pastaj bëj një aplikim provë nga faqja. Emaili dhe WhatsApp-i duhet të vijnë brenda pak sekondash. Herën e parë shiko edhe te Spam.

Opsionale:
- Pa email për mesazhet e kontaktit: `drop trigger if exists messages_notify on public.messages;`
- Ndrysho marrësin e emailit: `select vault.create_secret('emaili@shembull.com', 'notify_to');`
- Ndrysho numrin e WhatsApp: `select vault.create_secret('383XXXXXXXX', 'notify_phone');`
- Nëse njëri nga shërbimet nuk është i ngritur, aplikimet ruhen normalisht. Thjesht nuk dërgohet ai njoftim.

## Paneli admin (`/admin/`)

| Seksioni | Çfarë bën |
|---|---|
| Përmbledhja | Aplikimet dhe mesazhet e reja, numri i produkteve |
| Produktet | Shto, ndrysho, kopjo, fshi. Çmimi, stoku, "në ballinë" dhe publikimi ndryshohen me një klik. Fotot konvertohen vetë në WebP. |
| Kategoritë | Emri, përshkrimi, foto dhe renditja |
| Galeria | Ngarkim i shumë fotove njëherësh, renditje, fshehje dhe fshirje |
| Aplikimet | Detajet, letërnjoftimi, statusi, shënimet; thirrje, WhatsApp ose email me një klik |
| Mesazhet | Mesazhet e formularit të kontaktit |
| Cilësimet | Telefoni, WhatsApp, emaili, orari (për "Hapur tani"), njoftimi në krye të faqes |
| Siguria | Ndryshimi i fjalëkalimit dhe 2FA opsionale |

## Publikimi

Hostimi më i thjeshtë dhe falas është **Cloudflare Pages** ose **Netlify**:
- Build command: `npm run build`
- Output directory: `dist`
- Skedarët `_redirects` dhe `_headers` gjenerohen vetë. Përfshijnë ridrejtimet 301 nga URL-të e vjetra të WordPress-it (`/product/...`, `/product-category/...`, `/shop/`) dhe header-at e sigurisë (CSP, HSTS etj.).

Hostimi te **Bluehost** (cPanel) funksionon gjithashtu: ekzekuto `npm run build` dhe ngarko *përmbajtjen* e `dist/` në `public_html`. Skedari `.htaccess` gjenerohet vetë me ridrejtimet, HTTPS-në dhe header-at.

> Para se ta zëvendësoni WordPress-in, mbani një kopje të plotë të faqes së vjetër (zip-i që keni tashmë).

## Ndryshime të shpeshta

- **Teksti i një faqeje**: `src/pages/<faqja>/index.html`
- **Menyja dhe footer-i**: `src/partials/header.html`, `src/partials/footer.html`
- **Ngjyrat dhe fontet**: blloku `@theme` në `src/styles/app.css`
- **Faqe e re**: krijo `src/pages/emri/index.html` me bllokun `<!--page {...} -->` në krye. Ajo shfaqet te `/emri/` dhe shtohet vetë në sitemap.
