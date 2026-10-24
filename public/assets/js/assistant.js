// Asistenti virtual: përgjigjet nga informacionet e faqes (pa server, pa AI të jashtëm).
// Gjen temën e pyetjes me fjalë kyçe, njeh markat/modelet e armëve dhe, kur nuk e di
// përgjigjen, e dërgon vizitorin te stafi në WhatsApp me pyetjen e shkruar.
import { openStatus } from './app.js';
import { mediaUrl } from './data.js';
import { esc, priceLabel, productUrl } from './ui.js';

const MAPS = 'https://www.google.com/maps/dir/?api=1&destination=42.36872,20.45724';

export const norm = (s) => String(s || '').toLowerCase()
  .replace(/ë/g, 'e').replace(/ç/g, 'c').replace(/&/g, ' ')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9€\s]/g, ' ').replace(/\s+/g, ' ').trim();

/* ───────── Temat ─────────
   strong = 3 pikë, weak = 1 pikë. "=fjala" = fjalë e plotë; "dy fjalë" = frazë; ndryshe = fillimi i fjalës.
   Kur dy tema kanë të njëjtat pikë, fiton ajo që është më lart në listë. */
const TOPICS = [
  { id: 'human', strong: ['njeri', 'operator', 'agjent', 'fol me stafin', 'fol me dike', 'fol me nje', 'person real'] },
  { id: 'thanks', strong: ['faleminderit', '=flm', 'rrofsh', '=thanks', '=thank', '=tnx', '=fala', '=rrofsh'] },
  { id: 'apply', strong: ['aplik', 'regjistr', 'formular', '=forma', 'si te filloj', 'si me fillu', 'si mund te filloj'], weak: ['online'] },
  { id: 'requirements', strong: ['dokument', 'leternjoftim', 'cfare duhet', 'cka duhet', 'qka duhet', 'kerkes', 'nevoj', '=id'], weak: ['duhet', 'sjell'] },
  { id: 'experience', strong: ['pervoj', 'fillestar', 'here te pare', 'kurre nuk kam', 'asnjehere'] },
  { id: 'courseTime', strong: ['zgjat', 'kohezgjat', 'sa dite', 'sa ore', '=datat', 'kur fillon', 'fillon kursi', '=grupi', 'grupet'], weak: ['kur'] },
  { id: 'cert', strong: ['certifik', 'trajnim', '=kurs', 'kursi', 'kursin', 'instruktor', 'provim', 'licenc', 'leje arme', 'leje per arme', 'lejen e armes'], weak: ['leje', 'meso', 'mesim'] },
  { id: 'members', strong: ['anetar', 'kartel', 'vjetor', 'rinovim', 'abonim'], weak: ['zbritj'] },
  { id: 'noLicense', strong: ['pa leje', 'nuk kam leje', 'skam leje', 's kam leje', 'pa arme', 'nuk kam arme', 'skam arme', 'me qira', 'arme te poligonit'] },
  { id: 'rules', strong: ['rregull', 'siguri', 'syze', 'kufje', 'mbrojtj', '=ndal'] },
  { id: 'range', strong: ['poligon', 'qitj', 'qelloj', 'gjuaj', 'korsi', 'brendsh', 'jashtem', 'rezerv', 'termin', '=vizit', 'vizite', 'vizitoj', 'distanc'] },
  { id: 'repair', strong: ['riparim', 'ripar', 'servis', 'pastrim', 'mirembajt', 'defekt', 'prish', '=pjese', 'rregulloj'] },
  { id: 'buyLaw', strong: ['ligj', 'blej pa leje', 'kushtet per blerje', 'a mund te blej', 'kush mund te blej'] },
  { id: 'price', strong: ['cmim', 'kushton', '=euro', '=€', '=eur', 'tarif', 'pages', '=sa bon', '=sa ben', '=sa del', 'sa kushton'] },
  { id: 'shop', strong: ['dyqan', '=blej', '=ble', '=me ble', 'blerj', 'red dot', 'reddot', '=nishan', '=plumba', 'shitj', 'shisni', 'pistolet', 'pushk', 'shotgun', 'municion', 'fishek', 'optik', 'dylbi', 'aksesor', 'thik', 'veshj', 'taktik', 'kobur', 'revolver', '=arme', 'armet', 'armen', 'modele', '=model', '=stok', 'disponuesh'], weak: ['=keni', 'marke', 'marka'] },
  { id: 'hours', strong: ['orar', '=ora', '=oret', '=oren', 'deri ne sa', 'deri kur', 'hapur', 'mbyll', 'punoni', '=diel', 'fundjav', '=shtune', 'hapeni', 'jeni hapur'], weak: ['kur', '=sot', 'neser'] },
  { id: 'location', strong: ['=ku', 'adres', 'lokacion', 'gjendeni', 'gjindeni', 'qysh me ardh', 'qysh vij', 'hart', 'rruga', 'drejtim', 'udhezim', '=gps', 'prizren', 'vendndodh', '=maps', 'si te vij', 'si vij', 'si me ardh'] },
  { id: 'contact', strong: ['telefon', '=numri', '=nr', 'numrin', 'email', '=mail', 'kontakt', 'thirr', 'whatsapp', '=wa', 'viber'] },
  { id: 'privacy', strong: ['privat', 'te dhenat', 'ruhen', '=ruani', 'gdpr', 'dokumentet e mia', 'te sigurta'] },
  { id: 'about', strong: ['kush jeni', 'rreth jush', 'rreth nesh', '=histori', '=ekipi', '=stafi'] },
  { id: 'gallery', strong: ['foto', 'galeri', 'video', '=pamje'] },
  { id: 'greet', strong: ['pershendet', '=tung', '=hi', '=hello', '=hey', '=hej', 'mirdita', 'mirembrema', 'mirmengjes', '=ckemi', '=si jeni'] },
];

function scoreTopics(q) {
  const toks = q.split(' ');
  const padded = ` ${q} `;
  const has = (k) => {
    if (k.startsWith('=')) return toks.includes(k.slice(1)) || (k.includes(' ') && padded.includes(` ${k.slice(1)} `));
    if (k.includes(' ')) return padded.includes(` ${k}`);
    return toks.some((t) => t.startsWith(k));
  };
  return TOPICS.map((t, i) => ({
    id: t.id, i,
    score: (t.strong || []).filter(has).length * 3 + (t.weak || []).filter(has).length,
  })).filter((t) => t.score >= 2).sort((a, b) => b.score - a.score || a.i - b.i);
}

/* ───────── Markat dhe modelet ───────── */
const BRAND_ALIASES = { sig: 'sig sauer', sauer: 'sig sauer', glock: 'glock', cz: 'cz', canik: 'canik', beretta: 'beretta', arex: 'arex', taurus: 'taurus', ruger: 'ruger', balistik: 'balistik defence', radikal: 'radikal', brg: 'brg' };
const SHELF_BRANDS = { smith: 'Smith & Wesson', wesson: 'Smith & Wesson', sarsilmaz: 'Sarsılmaz', 'shadow systems': 'Shadow Systems' };
const MODEL_STOP = new Set(['arme', 'defence', 'sauer', 'chrome']);
const CATS = [
  [['pistolet', 'kobur', 'revolver', 'arme te shkurtra', 'arme te shkurta'], 'arme-te-shkurta', 'armët e shkurtra'],
  [['pushk', 'arme te gjata', 'karabin'], 'arme-te-gjata', 'armët e gjata'],
  [['shotgun', 'pompe', 'pompa'], 'shotgune', 'shotgunët'],
  [['municion', 'fishek', 'plumb'], 'municione', 'municionet'],
  [['optik', 'dylbi', 'red dot', 'reddot', 'nishan'], 'optika', 'optikat'],
  [['aksesor', 'veshj', 'taktik', 'thik', 'kellef', 'qant'], 'aksesore-veshje-taktike', 'aksesorët dhe veshjet taktike'],
];

function brandOf(p) {
  const b = norm(p.brand || p.name.split(' ')[0]);
  return Object.values(BRAND_ALIASES).find((v) => b.startsWith(v)) || b;
}

export function matchProducts(q, products) {
  const toks = q.split(' ');
  const padded = ` ${q} `;
  if (padded.includes(' shadow systems ')) return { shelf: 'Shadow Systems' };
  const brands = new Set(toks.map((t) => BRAND_ALIASES[t]).filter(Boolean));
  const modelTokens = (p) => {
    const bt = new Set(norm(brandOf(p)).split(' '));
    return norm(p.name).split(' ').filter((t) => !bt.has(t) && !MODEL_STOP.has(t) && t.length >= 2);
  };
  const scoreOf = (p) => modelTokens(p).filter((t) => toks.includes(t)).length;

  if (brands.size) {
    const cands = products.filter((p) => brands.has(brandOf(p)));
    if (!cands.length) return null;
    const best = Math.max(...cands.map(scoreOf));
    return { list: best > 0 ? cands.filter((p) => scoreOf(p) === best) : cands, brandOnly: best === 0, brand: cands[0].brand };
  }
  // pa markë: vetëm emra modelesh të veçantë (p.sh. "p320", "shadow", "apx"), jo numra të thjeshtë
  const distinct = (t) => t.length >= 3 && !/^\d+$/.test(t);
  const hits = products.filter((p) => modelTokens(p).some((t) => distinct(t) && toks.includes(t)));
  if (hits.length) return { list: hits };
  const shelf = Object.entries(SHELF_BRANDS).find(([k]) => toks.includes(k));
  return shelf ? { shelf: shelf[1] } : null;
}

function categoryOf(q) {
  const toks = q.split(' ');
  const padded = ` ${q} `;
  return CATS.find(([keys]) => keys.some((k) => (k.includes(' ') ? padded.includes(` ${k}`) : toks.some((t) => t.startsWith(k))))) || null;
}

/* ───────── Përgjigjet ───────── */
const A = {
  wa: (label = 'Vazhdo në WhatsApp', text) => ({ wa: true, label, text }),
  link: (label, href) => ({ label, href }),
  ask: (label, q) => ({ label, ask: q }),
};

function answerFor(id, ctx) {
  const s = ctx.settings;
  const st = openStatus(s.hours);
  const phone = esc(s.phoneDisplay || '+383 49 394 850');
  switch (id) {
    case 'hours':
      return {
        text: `${st.open ? `<b>Jemi hapur tani</b> dhe mbyllemi në <b>${st.time}</b>.` : `<b>Tani jemi mbyllur.</b> ${esc(st.meta)} <b>${st.time}</b>.`}<br>Orari: e hënë – e shtunë <b>${esc(s.hoursWeek || '09:00 – 22:00')}</b>, e diel ${esc((s.hoursSunday || 'Mbyllur').toLowerCase())}.`,
        actions: [A.link('Merr udhëzimet', MAPS)],
      };
    case 'location':
      return {
        text: 'Na gjeni te <b>Magjistralja Gjakovë–Prizren, km 2</b>, 50000 Gjakovë. Me makinë jeni te ne për pak minuta nga qendra e Gjakovës.',
        actions: [A.link('Hap në Google Maps', MAPS), A.ask('Orari i punës', 'Cili është orari?')],
      };
    case 'contact':
      return {
        text: `Telefoni dhe WhatsApp: <b>${phone}</b><br>Email: <b>${esc(s.email || 'info@poligonipatriot.com')}</b><br>Gjatë orarit të punës ju përgjigjemi shpejt.`,
        actions: [A.link('Telefono', `tel:${(s.phone || '+38349394850').replace(/\s/g, '')}`), A.wa('Shkruaj në WhatsApp')],
      };
    case 'cert':
      return {
        text: 'Ofrojmë trajnim dhe certifikim profesional në tre programe: <b>armë të shkurtra</b> (pistoleta, revolverë), <b>armë të gjata</b> (pushkë, shotgunë) ose <b>të dyja bashkë</b>.<br>Kursi ndërthur teorinë në klasë me praktikën në poligon: funksionimi i armës, rregullat e sigurisë, teknikat e saktësisë dhe mirëmbajtja. Pas përfundimit me sukses merrni certifikatën profesionale.',
        actions: [A.link('Apliko online', '/apliko/'), A.ask('Çfarë dokumentesh duhen?', 'Çfarë dokumentesh duhen për aplikim?'), A.link('Më shumë', '/trajnimet-certifikimet/')],
      };
    case 'apply':
      return {
        text: 'Aplikimi bëhet online për pak minuta:<ol><li>Plotësoni formularin dhe ngarkoni fotot e letërnjoftimit.</li><li>Ju telefonojmë për të caktuar grupin dhe datat.</li><li>Trajnimi me instruktor, teori dhe praktikë.</li><li>Merrni certifikatën.</li></ol>',
        actions: [A.link('Apliko tani', '/apliko/')],
      };
    case 'requirements':
      return {
        text: 'Për aplikim ju duhen:<ul><li>Letërnjoftimi (foto e anës së parë dhe të pasme)</li><li>Numri i telefonit dhe emaili</li><li>Programi që dëshironi</li></ul>Dokumentet ruhen të mbyllura dhe përdoren vetëm për procesin e certifikimit.',
        actions: [A.link('Apliko online', '/apliko/')],
      };
    case 'experience':
      return {
        text: 'Jo, nuk ju duhet përvojë paraprake. Kursi fillon nga bazat dhe instruktori ju udhëheq hap pas hapi, përfshirë përdorimin e parë të armës në poligon.',
        actions: [A.link('Apliko online', '/apliko/')],
      };
    case 'courseTime':
      return {
        text: 'Grupi dhe datat e kursit caktohen pasi të pranojmë aplikimin: ju telefonojmë dhe zgjidhni datat që ju përshtaten. Për kohëzgjatjen e saktë të programit që ju intereson, stafi ju informon menjëherë.',
        actions: [A.link('Apliko online', '/apliko/'), A.wa('Pyet stafin', 'Përshëndetje, sa zgjat kursi i certifikimit dhe kur fillon grupi i radhës?')],
      };
    case 'members':
      return {
        text: 'Anëtarësimi vjetor është për <b>poseduesit e armëve me leje</b>: qasje në poligon me armën tuaj personale gjatë orarit, zbritje në armë, aksesorë, municione dhe servis, si dhe qasje në trajnime dhe evente.<br><b>Si bëheni anëtar:</b> na kontaktoni, ejani me letërnjoftimin dhe lejen e vlefshme të armës dhe merrni kartelën personale, që rinovohet çdo vit.',
        actions: [A.link('Kushtet e anëtarësimit', '/anetaresimet/'), A.wa('Dua të bëhem anëtar', 'Përshëndetje, dua të bëhem anëtar i Poligonit Patriot.')],
      };
    case 'noLicense':
      return {
        text: 'Në poligon qëllojnë <b>anëtarët</b> (me leje dhe armën e tyre personale) dhe <b>pjesëmarrësit e trajnimeve</b>, nën mbikëqyrjen e instruktorit. Nëse nuk keni ende leje, hapi i parë është trajnimi me certifikim. Për raste të veçanta, pyesni stafin.',
        actions: [A.link('Trajnimet', '/trajnimet-certifikimet/'), A.wa('Pyet stafin')],
      };
    case 'rules':
      return {
        text: 'Rregullat që vlejnë për çdo qitës, në çdo korsi:<ul><li>Gryka gjithmonë drejt zonës së qitjes</li><li>Syze dhe kufje mbrojtëse të detyrueshme</li><li>Gishti jashtë këmbëzës deri në qitje</li><li>Komanda "ndal" zbatohet menjëherë</li><li>Sillni lejen e armës dhe letërnjoftimin</li><li>Arma e pastër dhe funksionale</li></ul>',
        actions: [A.link('Rregullat e poligonit', '/poligoni/')],
      };
    case 'range':
      return {
        text: 'Kemi dy poligone me të njëjtin standard sigurie:<br><b>I brendshëm</b>: hapur gjatë gjithë vitit, me ventilim dhe ndriçim profesional dhe staf në çdo seancë.<br><b>I jashtëm</b>: distanca më të gjata dhe kushte reale terreni, deri te qitja në lëvizje.<br>Qëllojnë anëtarët me armën personale dhe pjesëmarrësit e trajnimeve. Për termin ose grupe, na shkruani.',
        actions: [A.wa('Rezervo një termin', 'Përshëndetje, dua të rezervoj një termin në poligon.'), A.link('Poligoni', '/poligoni/')],
      };
    case 'repair':
      return {
        text: 'Servisi ynë bën diagnostikim dhe riparim defektesh, mirëmbajtje të rregullt dhe ndërrim pjesësh me materiale cilësore, për çdo lloj dhe model arme. Takimin e caktoni në WhatsApp ose në telefon.',
        actions: [A.wa('Cakto termin për servis', 'Përshëndetje, dua të caktoj një termin për servisin e armës.'), A.link('Më shumë', '/riparimin-e-armeve/')],
      };
    case 'buyLaw':
      return {
        text: 'Armët shiten vetëm për persona që plotësojnë kushtet e <b>Ligjit për armët</b> në Republikën e Kosovës. Nëse nuk keni ende certifikatë, filloni me trajnimin. Në dyqan stafi ju këshillon për modelin sipas qëllimit: mbrojtje personale, sport apo gjueti.',
        actions: [A.link('Trajnimet', '/trajnimet-certifikimet/'), A.link('Dyqani', '/dyqani/')],
      };
    case 'price':
      return {
        text: 'Çmimet i konfirmojmë direkt, sepse varen nga programi ose modeli. Për armët, çmimi dhe disponueshmëria konfirmohen në dyqan ose në telefon. Na shkruani dhe ju përgjigjemi shpejt.',
        actions: [A.wa('Pyet për çmimin')],
      };
    case 'shop': {
      const cat = categoryOf(ctx.q);
      return {
        text: cat
          ? `Po, në dyqan kemi ${cat[2]}. I gjeni të gjitha në katalog; disponueshmëria dhe çmimi konfirmohen në dyqan ose në telefon.`
          : 'Në dyqan kemi pistoleta, pushkë, shotgunë, municione, optika, thika, aksesorë dhe veshje taktike nga Glock, CZ, Beretta, Sig Sauer, Canik, Smith &amp; Wesson, Ruger, Taurus, Arex, Sarsılmaz, Shadow Systems e Balistik. Mund të më pyesni për një model konkret, p.sh. "a keni Glock 19?".',
        actions: [A.link(cat ? `Shiko ${cat[2]}` : 'Shiko dyqanin', cat ? `/dyqani/?kategoria=${cat[1]}` : '/dyqani/')],
        featured: !cat,
      };
    }
    case 'privacy':
      return {
        text: 'Dokumentet ruhen në një hapësirë të mbyllur, të qasshme vetëm nga administrata e Poligonit Patriot, përdoren vetëm për procesin e certifikimit dhe nuk ndahen me palë të treta.',
        actions: [A.link('Politika e privatësisë', '/privatesia/')],
      };
    case 'about':
      return {
        text: 'Poligoni Patriot është qendër e integruar në Gjakovë: poligon i avancuar, trajnime me certifikim, shitje armësh dhe servis profesional, me instruktorë, shitës dhe teknikë me përvojë.',
        actions: [A.link('Rreth nesh', '/rreth-nesh/')],
      };
    case 'gallery':
      return { text: 'Fotot dhe videot nga poligoni dhe dyqani i gjeni në galeri.', actions: [A.link('Hap galerinë', '/galeria/')] };
    case 'greet':
      return { text: 'Përshëndetje! Si mund t\'ju ndihmoj? Pyesni për orarin, trajnimet dhe certifikimin, poligonin, anëtarësimin ose armët në dyqan.', chips: true };
    case 'thanks':
      return { text: 'S\'ka përse! Nëse keni pyetje tjetër, jam këtu. Për çdo gjë tjetër, stafi ju përgjigjet edhe në WhatsApp.' };
    case 'human':
      return { text: 'Sigurisht. Vazhdoni bisedën me stafin tonë në WhatsApp; pyetja juaj shkon e shkruar.', actions: [A.wa()] };
    default:
      return null;
  }
}

function productAnswer(m, ctx) {
  if (m.shelf) {
    return { text: `Markën <b>${esc(m.shelf)}</b> e kemi në raftet tona. Për modelet që janë në stok tani, pyesni stafin.`, actions: [A.wa('Pyet për modelet', `Përshëndetje, cilat modele ${m.shelf} i keni në stok?`)] };
  }
  const list = m.list.slice(0, 4);
  const one = list.length === 1 && !m.brandOnly;
  const anyPrice = list.some((p) => p.price != null && p.show_price !== false);
  const names = list.map((p) => p.name).join(', ');
  return {
    text: one
      ? `Po, <b>${esc(list[0].name)}</b> është në katalogun tonë${list[0].caliber ? ` (${esc(list[0].caliber)})` : ''}.${anyPrice ? '' : ' Çmimi dhe disponueshmëria konfirmohen në dyqan ose në telefon.'}`
      : `${m.brandOnly ? `Nga <b>${esc(m.brand)}</b> në katalog kemi:` : 'Këto modele i kemi në katalog:'}${anyPrice ? '' : ' Çmimi dhe disponueshmëria konfirmohen në dyqan ose në telefon.'}`,
    products: list,
    actions: [A.wa(one ? 'Pyet për këtë model' : 'Pyet stafin', `Përshëndetje, a e keni në stok ${one ? list[0].name : names}?`), A.link('Të gjitha armët', '/dyqani/')],
  };
}

const FALLBACK = {
  text: 'Për këtë pyetje nuk kam përgjigje të saktë. Stafi ynë ju përgjigjet shpejt në WhatsApp, ose zgjidhni një nga temat më poshtë.',
  chips: true,
};

/** Kthen { text, actions, products, chips, featured }. */
export async function answer(question, { settings, products }) {
  const q = norm(question);
  if (!q) return FALLBACK;
  const ctx = { q, settings };
  const noLicense = /\b(pa leje|nuk kam leje|s ?kam leje|pa licenc)/.test(q);
  if (noLicense && /\b(blej|ble|blerj|shisni|shitj)/.test(q)) return answerFor('buyLaw', ctx);
  if (noLicense) return answerFor('noLicense', ctx);
  const topics = scoreTopics(q);
  const top = topics[0]?.id;

  // Pyetje për një armë konkrete (përveç servisit)
  if (top !== 'repair' && top !== 'members' && top !== 'cert') {
    const list = await products();
    const m = matchProducts(q, list);
    if (m) return productAnswer(m, ctx);
  }
  if (!topics.length) return { ...FALLBACK, actions: [A.wa('Pyet stafin në WhatsApp', question)] };

  const first = answerFor(top, ctx);
  // Dy tema në të njëjtën pyetje (p.sh. "orari dhe adresa")
  const second = topics[1] && topics[1].score >= 3 && !['greet', 'thanks'].includes(topics[1].id) && !['greet', 'thanks', 'human'].includes(top)
    ? answerFor(topics[1].id, ctx) : null;
  if (top === 'greet' && topics[1] && topics[1].score >= 3) return answerFor(topics[1].id, ctx);
  if (!second) return first;
  return {
    text: `${first.text}<br><br>${second.text}`,
    actions: (() => {
      const all = [...(first.actions || []), ...(second.actions || [])].filter((a, i, arr) => !a.ask && arr.findIndex((b) => b.label === a.label || (b.href && b.href === a.href)) === i);
      const wa = all.find((a) => a.wa);
      const top = all.filter((a) => !a.wa).slice(0, wa ? 2 : 3);
      return wa ? [...top, wa] : top;
    })(),
  };
}

/** Kartë e vogël produkti brenda bisedës. */
export const productChip = (p) => `
  <a class="chat-prod" href="${productUrl(p)}">
    <span class="chat-prod-img"><img src="${esc(mediaUrl(p.images?.[0]))}" alt="" loading="lazy"></span>
    <span class="grid min-w-0"><b>${esc(p.name)}</b><small>${esc([p.caliber, priceLabel(p)].filter(Boolean).join(' · '))}</small></span>
    <svg aria-hidden="true"><use href="#i-arrow"/></svg>
  </a>`;
