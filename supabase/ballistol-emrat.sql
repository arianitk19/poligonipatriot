-- Ekzekutoje në Supabase → SQL Editor (vetëm 2 rreshta): emrat e saktë të dy produkteve JW nga Ballistol
update public.products set name = 'Ballistol JW-Laufreiniger Patch-Rolle' where slug = 'ballistol-laufreiniger-patch-rolle-100';
update public.products set name = 'Ballistol JW-Waffenpflegetücher' where slug = 'ballistol-waffen-pflegetucher-60';

-- Kategoria e para në dyqan + foto/përshkrime shtesë
update public.categories set sort = 5 where slug = 'mirembajtje';
update public.products set description = 'Rrotull me 100 pecka (patches) për pastrimin e tytës. Pecka grisen nga rrotulla, vendosen në shufrën e pastrimit me adapterin JW dhe kalohen nëpër tytë.

Për të gjitha kalibrat. Thithëse, nuk lënë push, nuk grisen lehtë dhe janë rezistente ndaj vajit dhe tretësve. Për një pastrim nevojiten nga ½ deri në 6 pecka, sipas kalibrit.', images = array['/assets/img/products/ballistol-laufreiniger-patch-rolle-100.webp', '/assets/img/products/ballistol-laufreiniger-patch-rolle-100-2.webp', '/assets/img/products/ballistol-laufreiniger-patch-rolle-100-3.webp']::text[] where slug = 'ballistol-laufreiniger-patch-rolle-100';
update public.products set images = array['/assets/img/products/ballistol-waffen-pflegetucher-60.webp', '/assets/img/products/ballistol-waffen-pflegetucher-60-2.webp']::text[] where slug = 'ballistol-waffen-pflegetucher-60';
