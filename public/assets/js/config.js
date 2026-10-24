// ─────────────────────────────────────────────────────────────
//  KONFIGURIMI I SUPABASE
//  Vendos këtu "Project URL" dhe "anon / publishable key" nga
//  Supabase → Project Settings → API. Këta çelësa janë publikë
//  (mbrohen nga rregullat RLS në databazë), prandaj lejohet të
//  jenë në frontend. MOS vendos kurrë këtu "service_role key".
//
//  Për sa kohë fushat janë bosh, faqja punon me të dhënat
//  lokale në /data/*.json (mënyra offline / demo).
// ─────────────────────────────────────────────────────────────
export const CONFIG = {
  supabaseUrl: 'https://pvxmjxlvmatzdlvbsksp.supabase.co',
  supabaseAnonKey: 'sb_publishable_GzUxIbwdKHZi-iFM2QtJoA_SNqOtI6k',

  // Emrat e bucket-ave në Supabase Storage
  mediaBucket: 'media',          // publik: fotot e produkteve dhe galerisë
  applicationsBucket: 'aplikimet', // privat: dokumentet e aplikantëve

  site: {
    name: 'Poligoni Patriot',
    url: 'https://poligonipatriot.com',
    phone: '+38349394850',
    phoneDisplay: '+383 49 394 850',
    whatsapp: '38349394850',
    email: 'info@poligonipatriot.com',
    timezone: 'Europe/Belgrade',
  },
};

export const isSupabaseConfigured = () => Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
