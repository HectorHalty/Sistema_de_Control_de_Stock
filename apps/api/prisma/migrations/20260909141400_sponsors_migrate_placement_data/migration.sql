-- Migración de datos de sponsors a los slots home/cantina.
-- Va en su propia migración porque usa valores de enum agregados en la anterior
-- (Postgres no permite usar un valor de enum recién creado en la misma transacción).

-- banner con etiqueta de Cantina -> cantina
UPDATE "patrocinadores"
SET "placement" = 'cantina'
WHERE "placement" = 'banner'
  AND "banner_label" ILIKE '%cantina%';

-- resto de banner (incluye "Home" y banners sin etiqueta) -> home
UPDATE "patrocinadores"
SET "placement" = 'home'
WHERE "placement" = 'banner';

-- sidebar / footer dejan de mostrarse
UPDATE "patrocinadores"
SET "active" = false
WHERE "placement" IN ('sidebar', 'footer');
