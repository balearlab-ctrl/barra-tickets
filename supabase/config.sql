-- ============================================================
--  Barra Tickets · configuración de marca y aspecto
--  Ejecuta esto en el SQL Editor de Supabase (es ADICIONAL al
--  schema.sql que ya ejecutaste; no borra nada).
-- ============================================================

create table if not exists config (
  id             int primary key default 1,
  evento_nombre  text not null default 'Mi Fiesta',
  subtitulo      text not null default 'Pide y recoge en barra',
  logo_url       text,                       -- imagen en base64 (data URL)
  color1         text not null default '#FF2D78',  -- acento principal
  color2         text not null default '#7C5CFF',  -- acento secundario
  fondo          text not null default '#0B0A0F',  -- color de fondo
  actualizado_en timestamptz not null default now(),
  constraint solo_una_fila check (id = 1)
);

insert into config (id) values (1) on conflict do nothing;

-- RLS: la marca es pública (la carta la lee), el personal la edita.
alter table config enable row level security;

drop policy if exists "config lectura publica" on config;
create policy "config lectura publica" on config
  for select using (true);

drop policy if exists "config gestion staff" on config;
create policy "config gestion staff" on config
  for all to authenticated using (true) with check (true);
