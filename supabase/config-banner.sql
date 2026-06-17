-- ============================================================
--  Barra Tickets · añadir imagen de fondo (story/banner)
--  Ejecuta esto en el SQL Editor de Supabase (es ADICIONAL).
-- ============================================================

alter table config add column if not exists banner_url text;
