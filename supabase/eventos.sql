-- ============================================================
--  Barra Tickets · Cerrar y reiniciar evento (con histórico)
--  Ejecuta esto en el SQL Editor de Supabase (ADICIONAL).
-- ============================================================

-- Clave fija para poder reiniciar (cifrada en la config)
alter table config add column if not exists reinicio_hash text;

-- Histórico de eventos cerrados (guarda el resumen de cada fiesta)
create table if not exists eventos_archivados (
  id          bigint generated always as identity primary key,
  nombre      text,
  logo_url    text,
  resumen     jsonb not null default '{}',
  cerrado_en  timestamptz not null default now()
);

alter table eventos_archivados enable row level security;
drop policy if exists "eventos read" on eventos_archivados;
create policy "eventos read" on eventos_archivados
  for select to authenticated using (true);
-- La inserción la hace el servidor (service_role).
